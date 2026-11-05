// Calculs purs : dates, séries pour les graphiques, statistiques, format français.
export const pad2 = (n) => String(n).padStart(2, '0');
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const parseDay = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const diffDays = (a, b) => Math.round((a - b) / 864e5);
export const startOfWeek = (d = new Date()) => addDays(d, -((d.getDay() + 6) % 7)); // lundi

const dFmt = (o) => new Intl.DateTimeFormat('fr-FR', o);
const fmtShort = dFmt({ day: 'numeric', month: 'short' });
const fmtWeekday = dFmt({ weekday: 'short', day: 'numeric', month: 'short' });
const fmtLong = dFmt({ weekday: 'long', day: 'numeric', month: 'long' });
const fmtMonth = dFmt({ month: 'long', year: 'numeric' });
const WEEK_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export const fmtNum = (v, dec = 0) => v.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
export const fmtSigned = (v, dec = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmtNum(Math.abs(v), dec)}`;
export const longDate = (s) => { const t = fmtLong.format(parseDay(s)); return t[0].toUpperCase() + t.slice(1); };

export function relativeDay(s, today = new Date()) {
  const n = diffDays(parseDay(dayKey(today)), parseDay(s));
  if (n === 0) return 'Aujourd’hui';
  if (n === 1) return 'Hier';
  return longDate(s);
}

// Une seule valeur par jour : la dernière saisie.
export function dailyWeights(weights) {
  const map = new Map();
  [...weights].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).forEach((w) => map.set(w.date, w.value));
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([date, value]) => ({ date, value, day: parseDay(date) }));
}

// Moyenne mobile sur 7 jours glissants (calendaires).
export function withMovingAverage(daily) {
  let from = 0;
  let sum = 0;
  return daily.map((p, i) => {
    sum += p.value;
    while (diffDays(p.day, daily[from].day) > 6) { sum -= daily[from].value; from += 1; }
    return { ...p, ma: sum / (i - from + 1) };
  });
}

const RANGE_DAYS = { week: 7, month: 30, year: 365 };

function axisLabels(range, start, span) {
  const labels = [];
  if (range === 'week') {
    for (let i = 0; i < 7; i++) labels.push({ f: i / 6, text: WEEK_LETTERS[addDays(start, i).getDay()] });
  } else if (range === 'month') {
    for (let i = 1; i < span; i += 7) labels.push({ f: i / span, text: fmtShort.format(addDays(start, i)).replace('.', '') });
  } else {
    for (let i = 0; i <= span; i++) {
      const d = addDays(start, i);
      if (d.getDate() === 1) labels.push({ f: i / span, text: MONTH_LETTERS[d.getMonth()] });
    }
  }
  return labels;
}

export function weightModel(weights, range, today = new Date()) {
  const days = RANGE_DAYS[range];
  const end = parseDay(dayKey(today));
  const start = addDays(end, -(days - 1));
  const span = days - 1;
  const all = withMovingAverage(dailyWeights(weights));
  let pts = all.filter((p) => p.day >= start && p.day <= end);

  if (range === 'year') {
    const buckets = new Map();
    pts.forEach((p) => {
      const b = Math.floor(diffDays(p.day, start) / 7);
      if (!buckets.has(b)) buckets.set(b, []);
      buckets.get(b).push(p);
    });
    pts = [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([, list]) => {
      const lastP = list[list.length - 1];
      return {
        day: lastP.day, date: lastP.date, ma: lastP.ma,
        value: list.reduce((s, p) => s + p.value, 0) / list.length,
        week: true,
      };
    });
  }

  return {
    labels: axisLabels(range, start, span),
    points: pts.map((p) => ({
      f: diffDays(p.day, start) / span,
      v: p.value,
      ma: p.ma,
      title: p.week ? `Semaine du ${fmtShort.format(addDays(p.day, -6)).replace('.', '')}` : fmtWeekday.format(p.day).replace(/\./g, ''),
    })),
  };
}

export function sportModel(workouts, range, today = new Date()) {
  const end = parseDay(dayKey(today));
  const bars = [];
  const labels = [];
  if (range === 'year') {
    const firstMonth = new Date(end.getFullYear(), end.getMonth() - 11, 1);
    for (let i = 0; i < 12; i++) {
      const m = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + i, 1);
      const key = dayKey(m).slice(0, 7);
      const list = workouts.filter((w) => w.date.startsWith(key));
      const title = fmtMonth.format(m);
      bars.push({ v: list.reduce((s, w) => s + w.duration, 0), count: list.length, title: title[0].toUpperCase() + title.slice(1) });
      labels.push({ i, text: MONTH_LETTERS[m.getMonth()] });
    }
  } else {
    const n = RANGE_DAYS[range];
    const byDay = new Map();
    workouts.forEach((w) => {
      const e = byDay.get(w.date) || { v: 0, count: 0 };
      e.v += w.duration; e.count += 1;
      byDay.set(w.date, e);
    });
    for (let i = 0; i < n; i++) {
      const d = addDays(end, i - n + 1);
      const e = byDay.get(dayKey(d)) || { v: 0, count: 0 };
      bars.push({ ...e, title: fmtWeekday.format(d).replace(/\./g, '') });
      if (range === 'week') labels.push({ i, text: WEEK_LETTERS[d.getDay()] });
      else if ((i - 1) % 7 === 0) labels.push({ i, text: fmtShort.format(d).replace('.', '') });
    }
  }
  return { bars, labels };
}

export function rangeStats(weights, workouts, range, today = new Date()) {
  const days = RANGE_DAYS[range];
  const end = parseDay(dayKey(today));
  const start = addDays(end, -(days - 1));
  const pts = dailyWeights(weights).filter((p) => p.day >= start && p.day <= end);
  const vals = pts.map((p) => p.value);
  const startKey = dayKey(start);
  const endKey = dayKey(end);
  const ws = workouts.filter((w) => w.date >= startKey && w.date <= endKey);
  return {
    avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
    min: vals.length ? Math.min(...vals) : null,
    max: vals.length ? Math.max(...vals) : null,
    change: vals.length > 1 ? vals[vals.length - 1] - vals[0] : null,
    sessions: ws.length,
    minutes: ws.reduce((s, w) => s + w.duration, 0),
  };
}

export function weekStats(workouts, today = new Date()) {
  const start = dayKey(startOfWeek(today));
  const prevStart = dayKey(addDays(startOfWeek(today), -7));
  const inWeek = workouts.filter((w) => w.date >= start);
  const prev = workouts.filter((w) => w.date >= prevStart && w.date < start);
  const sum = (l) => l.reduce((s, w) => s + w.duration, 0);
  return {
    sessions: inWeek.length,
    minutes: sum(inWeek),
    activeDays: new Set(inWeek.map((w) => w.date)).size,
    prevSessions: prev.length,
    prevMinutes: sum(prev),
  };
}

// Poids actuel et variation par rapport à la dernière pesée d'il y a 7 jours ou plus.
export function currentWeight(weights, today = new Date()) {
  const daily = dailyWeights(weights);
  if (!daily.length) return null;
  const last = daily[daily.length - 1];
  const ref = addDays(parseDay(dayKey(today)), -7);
  const before = [...daily].reverse().find((p) => p.day <= ref) || (daily.length > 1 ? daily[0] : null);
  return {
    value: last.value,
    date: last.date,
    delta: before ? last.value - before.value : null,
    since: before ? diffDays(parseDay(last.date), before.day) : 0,
    spark: daily.slice(-14),
  };
}

// Jeu de démonstration déterministe sur 300 jours (marqué demo: true pour pouvoir l'effacer).
export function demoData(newId, today = new Date()) {
  let seed = 42;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const weights = [];
  const workouts = [];
  const types = [['course', 35, 6.5, null], ['muscu', 55, null, 60], ['velo', 60, 22, null], ['course', 40, 7.5, null], ['muscu', 50, null, 65], ['kickboxing', 60, null, null], ['natation', 40, 1.5, null]];
  for (let i = 300; i >= 0; i--) {
    const day = addDays(today, -i);
    const date = dayKey(day);
    if (i === 0 || rnd() < 0.82) {
      const trend = 84.6 - ((300 - i) / 300) * 6.2 + Math.sin(i / 13) * 0.5;
      weights.push({ id: newId(), date, value: Math.round((trend + (rnd() - 0.5) * 0.9) * 10) / 10, createdAt: day.getTime(), demo: true });
    }
    if (rnd() < 0.5 && i !== 0) {
      const [type, dur, dist, load] = types[Math.floor(rnd() * types.length)];
      workouts.push({
        id: newId(), date, type,
        duration: Math.round(dur * (0.8 + rnd() * 0.45) / 5) * 5,
        distance: dist ? Math.round(dist * (0.85 + rnd() * 0.3) * 10) / 10 : null,
        load: load ? Math.round(load * (0.9 + rnd() * 0.25) / 2.5) * 2.5 : null,
        createdAt: day.getTime(), demo: true,
      });
    }
  }
  return { weights, workouts };
}
