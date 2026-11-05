// Élan : logique de l'application (onglets, vues, feuille d'ajout, réglages, export/import).
import * as db from './db.js';
import { Odometer, confetti, installSpring, reduced } from './anim.js';
import { WeightChart, BarChart, Rings, drawSpark } from './charts.js';
import {
  dayKey, parseDay, fmtNum, fmtSigned, longDate, relativeDay,
  weightModel, sportModel, rangeStats, weekStats, currentWeight, demoData,
} from './data.js';
import { INTENSITIES, MET, kcal, metFor } from './calories.js';

const $ = (s, root = document) => root.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const TYPES = {
  course: ['Course', '<svg viewBox="0 0 24 24"><circle cx="14.5" cy="4.5" r="1.8"/><path d="M6 11l3.5-3.5 4 1.5-2.5 5 3.5 2.5V21"/><path d="M11 14.5 9 18H5"/><path d="M13.5 9l2.5 3H20"/></svg>'],
  muscu: ['Muscu', '<svg viewBox="0 0 24 24"><path d="M8 8v8M16 8v8M8 12h8M4.5 9.5v5M19.5 9.5v5"/></svg>'],
  kickboxing: ['Kick boxing', '<svg viewBox="0 0 24 24"><path d="M7 20v-4.5C5.2 14 4.5 12 4.5 10A5.5 5.5 0 0 1 10 4.5h3A5.5 5.5 0 0 1 18.5 10c0 2.5-1 4-2.5 5.5V20z"/><path d="M7 17.5h9M4.5 10.5c2 .2 3.5 1 4 3"/></svg>'],
  velo: ['Vélo', '<svg viewBox="0 0 24 24"><circle cx="6" cy="16.5" r="3.5"/><circle cx="18" cy="16.5" r="3.5"/><path d="M6 16.5 9.5 9.5h6L18 16.5M9.5 9.5l3 7H6M15.5 9.5 15 6.5h-2.5"/></svg>'],
  natation: ['Natation', '<svg viewBox="0 0 24 24"><circle cx="16.5" cy="7" r="1.8"/><path d="M5 12l5-3.5 3 2.5"/><path d="M3 16c1.5 0 1.5 1 3 1s1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1"/></svg>'],
  marche: ['Marche', '<svg viewBox="0 0 24 24"><circle cx="12.5" cy="4.5" r="1.8"/><path d="M12 8.5 9 11v3.5M12 8.5l1 5.5-2.5 7M13 14l3 7M12.5 9l3.5 3"/></svg>'],
  yoga: ['Yoga', '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.8"/><path d="M12 8.5V14M12 9.5 7 13M12 9.5l5 3.5M12 14l-6.5 5h13z"/></svg>'],
  hiit: ['HIIT', '<svg viewBox="0 0 24 24"><path d="M13 3 5.5 13.5H11l-1 7.5 8-11h-5.5z"/></svg>'],
  autre: ['Autre', '<svg viewBox="0 0 24 24"><path d="M12 4l2 5.5 5.5 2-5.5 2L12 19l-2-5.5-5.5-2 5.5-2z"/></svg>'],
};
const DEFAULTS = { goalSessions: 4, goalMinutes: 150, goalDays: 4, direction: 'lose', theme: 'dark' };
const SCALE_ICON = '<svg viewBox="0 0 24 24"><rect x="3.5" y="4" width="17" height="16" rx="5"/><path d="M8 9.2a5.6 5.6 0 0 1 8 0l-2.4 2.3h-3.2z"/></svg>';

const state = {
  weights: [], workouts: [], settings: { ...DEFAULTS },
  tab: 0, range: 'month', histFilter: 'all', histLimit: 60,
};

/* ---------- Réglages et thème ---------- */
function applyTheme() {
  const t = state.settings.theme;
  document.documentElement.dataset.theme = t;
  $('meta[name="theme-color"]').content = t === 'light' ? '#EEF0F6' : '#07080C';
}
async function saveSetting(key, value) {
  state.settings[key] = value;
  await db.put('settings', { key, value });
}

/* ---------- Vues ---------- */
const od = {};
['w-current', 'rings-pct', 't-sessions', 't-minutes', 's-avg', 's-min', 's-max', 's-minutes', 's-sessions'].forEach((id) => { od[id] = new Odometer($(`#${id}`)); });

const RING_DEFS = [
  { key: 'sessions', name: 'Séances', a: '#E5182F', b: '#E5182F', unit: '' },
  { key: 'minutes', name: 'Minutes', a: 'var(--ring-2)', b: 'var(--ring-2)', unit: ' min' },
  { key: 'days', name: 'Jours actifs', a: '#8E8E96', b: '#8E8E96', unit: '' },
];
const rings = new Rings($('#rings'), RING_DEFS);
const weightChart = new WeightChart($('#weight-chart'));
const sportChart = new BarChart($('#sport-chart'));

function renderToday(animate = true) {
  const now = new Date();
  $('#today-date').textContent = longDate(dayKey(now)).replace(' ', ' · ');
  const hasAny = state.weights.length || state.workouts.length;
  const cur = currentWeight(state.weights, now);
  $('#hero').hidden = !cur;
  $('#hero-empty').hidden = !!hasAny;

  if (cur) {
    od['w-current'].set(fmtNum(cur.value, 1), { roll: animate });
    const box = $('#w-delta');
    if (cur.delta == null) {
      box.hidden = true;
      $('#w-badge').hidden = true;
    } else {
      box.hidden = false;
      const d = Math.round(cur.delta * 10) / 10;
      box.dataset.dir = d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
      box.dataset.tone = deltaTone(d);
      $('#w-delta-text').textContent = `${fmtSigned(d)} kg sur ${cur.since} j`;
      $('#w-badge').hidden = false;
      $('#w-badge').textContent = d > 0 ? 'En hausse' : d < 0 ? 'En baisse' : 'Stable';
    }
    drawSpark($('#w-spark'), cur.spark.map((p) => p.value));
  }

  const week = weekStats(state.workouts, now);
  const s = state.settings;
  const vals = { sessions: [week.sessions, s.goalSessions], minutes: [week.minutes, s.goalMinutes], days: [week.activeDays, s.goalDays] };
  rings.set(RING_DEFS.map((r) => vals[r.key][0] / vals[r.key][1]), {
    fromZero: animate,
    label: `Objectif de la semaine : ${week.sessions} séances sur ${s.goalSessions}, ${week.minutes} minutes sur ${s.goalMinutes}, ${week.activeDays} jours actifs sur ${s.goalDays}`,
  });
  $('#ring-legend').innerHTML = RING_DEFS.map((r) => `
    <li><i style="background:${r.a}"></i><span class="rl-name">${r.name}</span>
    <span class="rl-val">${fmtNum(vals[r.key][0])}<small> / ${fmtNum(vals[r.key][1])}${r.unit}</small></span></li>`).join('');
  const ratios = RING_DEFS.map((r) => Math.min(vals[r.key][0] / vals[r.key][1], 1));
  od['rings-pct'].set(fmtNum(Math.round((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100)), { roll: animate });
  const left = 7 - ((now.getDay() + 6) % 7) - 1;
  $('#rings-days').textContent = left === 0 ? 'Dernier jour' : `${left} j restant${left > 1 ? 's' : ''}`;

  const blockCount = Math.min(s.goalSessions, 10);
  renderBlocks($('#t-sessions-blocks'), Math.round((week.sessions / s.goalSessions) * blockCount), blockCount);
  renderBlocks($('#t-minutes-blocks'), Math.round((week.minutes / s.goalMinutes) * 8), 8);
  od['t-sessions'].set(fmtNum(week.sessions), { roll: animate, delay: 80 });
  od['t-minutes'].set(fmtNum(week.minutes), { roll: animate, delay: 140 });
  $('#t-sessions-foot').textContent = `Sem. dernière : ${fmtNum(week.prevSessions)}`;
  $('#t-minutes-foot').textContent = `Sem. dernière : ${fmtNum(week.prevMinutes)}`;

  const recent = allEntries().slice(0, 4);
  $('#recent-card').hidden = !recent.length;
  $('#recent').innerHTML = recent.map((e) => rowHtml(e, true)).join('');
}

function renderBlocks(host, filled, total) {
  host.innerHTML = Array.from({ length: total }, (_, i) => `<i class="block${i < filled ? ' on' : ''}" style="--i:${i}"></i>`).join('');
}

function deltaTone(d) {
  const dir = state.settings.direction;
  if (Math.abs(d) < 0.05) return 'flat';
  if (dir === 'lose') return d < 0 ? 'good' : 'bad';
  if (dir === 'gain') return d > 0 ? 'good' : 'bad';
  return Math.abs(d) <= 0.5 ? 'good' : 'bad';
}

function renderProgress(mode = 'draw') {
  const { weights, workouts, range } = state;
  const st = rangeStats(weights, workouts, range);
  const roll = mode === 'draw';
  const w = (v) => (v == null ? '–' : fmtNum(v, 1));
  od['s-avg'].set(w(st.avg), { roll });
  od['s-min'].set(w(st.min), { roll, delay: 40 });
  od['s-max'].set(w(st.max), { roll, delay: 80 });
  od['s-minutes'].set(fmtNum(st.minutes), { roll });
  od['s-sessions'].set(fmtNum(st.sessions), { roll, delay: 40 });
  weightChart.set(weightModel(weights, range), mode);
  sportChart.set(sportModel(workouts, range), mode);
}

function allEntries() {
  const list = [
    ...state.weights.map((w) => ({ kind: 'weight', ...w })),
    ...state.workouts.map((w) => ({ kind: 'workout', ...w })),
  ];
  return list.sort((a, b) => (a.date === b.date ? (b.createdAt || 0) - (a.createdAt || 0) : a.date < b.date ? 1 : -1));
}

function rowHtml(e, showDay = false) {
  const day = showDay ? relativeDay(e.date) : '';
  if (e.kind === 'weight') {
    return `<li><button class="row press" data-kind="weight" data-id="${esc(e.id)}">
      <span class="row-ico w">${SCALE_ICON}</span>
      <span class="row-main"><div class="row-title">Pesée</div>${day ? `<div class="row-sub">${esc(day)}</div>` : ''}</span>
      <span class="row-val">${fmtNum(e.value, 1)} kg</span></button></li>`;
  }
  const [name, icon] = TYPES[e.type] || TYPES.autre;
  const burn = kcal(e, state.weights);
  const parts = [];
  if (day) parts.push(day);
  if (e.distance) parts.push(`${fmtNum(e.distance, e.distance % 1 ? 1 : 0)} km`);
  if (e.load) parts.push(`${fmtNum(e.load, e.load % 1 ? 1 : 0)} kg`);
  return `<li><button class="row press" data-kind="workout" data-id="${esc(e.id)}">
    <span class="row-ico">${icon}</span>
    <span class="row-main"><div class="row-title">${esc(name)}</div>${parts.length ? `<div class="row-sub">${esc(parts.join(' · '))}</div>` : ''}</span>
    <span class="row-val">${fmtNum(e.duration)} min${burn != null ? `<small>≈ ${fmtNum(burn)} kcal</small>` : ''}</span></button></li>`;
}

function renderHistory() {
  const f = state.histFilter;
  const entries = allEntries().filter((e) => f === 'all' || e.kind === f);
  const host = $('#history');
  if (!entries.length) {
    host.innerHTML = '<article class="card"><p class="empty-line">Rien pour l’instant. Touche le bouton + pour commencer.</p></article>';
    return;
  }
  const shown = entries.slice(0, state.histLimit);
  const groups = [];
  shown.forEach((e) => {
    const g = groups[groups.length - 1];
    if (g && g.date === e.date) g.items.push(e);
    else groups.push({ date: e.date, items: [e] });
  });
  host.innerHTML = groups.map((g, i) => `
    <h3 class="hist-day">${esc(relativeDay(g.date))}</h3>
    <div class="card hist-group" style="--i:${Math.min(i, 10)}"><ul class="rows">${g.items.map((e) => rowHtml(e)).join('')}</ul></div>`).join('')
    + (entries.length > shown.length ? '<div class="more-wrap"><button class="btn press" id="hist-more">Afficher plus</button></div>' : '');
}

function replayEntrance(view) {
  view.classList.remove('entering');
  void view.offsetWidth;
  view.classList.add('entering');
}

function enterTab(i) {
  const view = VIEWS[i];
  replayEntrance(view);
  if (i === 0) renderToday(true);
  if (i === 1) renderProgress('draw');
  if (i === 2) renderHistory();
}

/* ---------- Onglets et balayage ---------- */
const views = $('#views');
const VIEWS = [$('#view-today'), $('#view-progress'), $('#view-history')];
const tabs = [...document.querySelectorAll('.tab')];
const rootStyle = document.documentElement.style;

function goTab(i, { force = false } = {}) {
  if (i === state.tab && !force) return;
  state.tab = i;
  rootStyle.setProperty('--tab', i);
  tabs.forEach((t, n) => t.setAttribute('aria-selected', String(n === i)));
  VIEWS.forEach((v, n) => { v.inert = n !== i; });
  enterTab(i);
}
tabs.forEach((t) => t.addEventListener('click', () => {
  const i = Number(t.dataset.tab);
  if (i === state.tab) VIEWS[i].scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
  else goTab(i);
}));

(function swipe() {
  let startX = 0; let startY = 0; let id = null; let dragging = false; let width = 1;
  views.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || e.target.closest('.chart, .seg, input')) return;
    id = e.pointerId; startX = e.clientX; startY = e.clientY; dragging = false; width = innerWidth;
  });
  views.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!dragging) {
      if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
      dragging = true;
      views.classList.add('dragging');
    }
    const atEdge = (state.tab === 0 && dx > 0) || (state.tab === 2 && dx < 0);
    views.style.setProperty('--drag', `${atEdge ? dx * 0.25 : dx}px`);
  });
  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    if (!dragging) return;
    dragging = false;
    views.classList.remove('dragging');
    const dx = e.clientX - startX;
    views.style.setProperty('--drag', '0px');
    if (e.type === 'pointerup' && Math.abs(dx) > width * 0.22) {
      const next = state.tab + (dx < 0 ? 1 : -1);
      if (next >= 0 && next <= 2) goTab(next);
    }
  };
  views.addEventListener('pointerup', end);
  views.addEventListener('pointercancel', end);
})();

/* ---------- Contrôles segmentés ---------- */
function bindSeg(seg, value, onChange) {
  const btns = [...seg.querySelectorAll('button')];
  seg.style.setProperty('--n', btns.length);
  const select = (v) => {
    const idx = btns.findIndex((b) => b.dataset.value === v);
    seg.style.setProperty('--idx', idx);
    btns.forEach((b, i) => b.setAttribute('aria-selected', String(i === idx)));
  };
  select(value);
  btns.forEach((b) => b.addEventListener('click', () => {
    if (b.getAttribute('aria-selected') === 'true') return;
    select(b.dataset.value);
    onChange(b.dataset.value);
  }));
}
bindSeg($('#range'), state.range, (v) => { state.range = v; renderProgress('morph'); });
bindSeg($('#hist-filter'), state.histFilter, (v) => {
  state.histFilter = v; state.histLimit = 60;
  renderHistory();
  replayEntrance(VIEWS[2]);
});

/* ---------- Feuille ---------- */
const sheet = $('#sheet');
const scrim = $('#scrim');
const body = $('#sheet-body');
let lastFocus = null;

function openSheet(render) {
  lastFocus = document.activeElement;
  body.innerHTML = '';
  render(body);
  $('#success').classList.remove('show');
  sheet.hidden = false;
  scrim.hidden = false;
  void sheet.offsetWidth;
  sheet.classList.add('open');
  scrim.classList.add('open');
  sheet.setAttribute('tabindex', '-1');
  sheet.focus({ preventScroll: true });
}
function closeSheet() {
  document.activeElement?.blur?.();
  sheet.classList.remove('open');
  scrim.classList.remove('open');
  sheet.style.removeProperty('--sheet-y');
  setTimeout(() => {
    if (sheet.classList.contains('open')) return;
    sheet.hidden = true;
    scrim.hidden = true;
    body.innerHTML = '';
  }, reduced() ? 0 : 320);
  lastFocus?.focus?.({ preventScroll: true });
}
scrim.addEventListener('click', closeSheet);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheet.classList.contains('open')) closeSheet(); });

(function dragSheet() {
  const grab = $('#grab');
  let y0 = 0; let t0 = 0; let dy = 0; let on = false;
  grab.addEventListener('pointerdown', (e) => {
    on = true; y0 = e.clientY; t0 = e.timeStamp; dy = 0;
    grab.setPointerCapture(e.pointerId);
    sheet.classList.add('dragging');
  });
  grab.addEventListener('pointermove', (e) => {
    if (!on) return;
    dy = Math.max(0, e.clientY - y0);
    sheet.style.setProperty('--sheet-y', `${dy}px`);
  });
  const up = (e) => {
    if (!on) return;
    on = false;
    sheet.classList.remove('dragging');
    const speed = dy / Math.max(e.timeStamp - t0, 1);
    if (dy > 120 || speed > 0.7) closeSheet();
    else sheet.style.removeProperty('--sheet-y');
  };
  grab.addEventListener('pointerup', up);
  grab.addEventListener('pointercancel', up);
})();

// Le clavier iOS réduit le visualViewport : on remonte le contenu de la feuille d'autant.
window.visualViewport?.addEventListener('resize', () => {
  const kb = Math.max(0, innerHeight - visualViewport.height - visualViewport.offsetTop);
  sheet.style.setProperty('--kb', `${kb}px`);
});

const parseNum = (s) => {
  const v = parseFloat(String(s).replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(v) ? v : null;
};

function formError(root, msg, field) {
  $('.form-error', root).textContent = msg;
  if (field) { field.classList.remove('shake'); void field.offsetWidth; field.classList.add('shake'); }
}

function openAdd(kind = 'weight', entry = null) {
  openSheet((root) => {
    root.innerHTML = `
      <h2 class="sheet-title">${entry ? 'Modifier' : 'Ajouter'}</h2>
      ${entry ? '' : `<div class="seg seg-solid" id="add-kind">
        <span class="seg-thumb"></span>
        <button class="press" data-value="weight">Poids</button>
        <button class="press" data-value="workout">Séance</button>
      </div>`}
      <div id="add-panel"></div>`;
    let current = kind;
    const panel = $('#add-panel', root);
    const paint = (dir = 0) => {
      panel.innerHTML = '';
      const inner = document.createElement('div');
      inner.className = 'sheet-panel';
      inner.style.setProperty('--from', `${dir * 26}px`);
      panel.append(inner);
      if (current === 'weight') weightForm(inner, entry); else workoutForm(inner, entry);
    };
    if (!entry) bindSeg($('#add-kind', root), kind, (v) => { current = v; paint(v === 'workout' ? 1 : -1); });
    paint();
  });
}

function dateField(value) {
  return `<div class="field"><label for="f-date">Date</label><input id="f-date" type="date" value="${esc(value)}" max="${dayKey()}"></div>`;
}
function footButtons(entry) {
  return `<p class="form-error" role="alert"></p>
    <button class="btn btn-primary btn-block press" id="f-save">${entry ? 'Enregistrer les modifications' : 'Enregistrer'}</button>
    ${entry ? '<button class="btn btn-block btn-danger press" id="f-delete">Supprimer</button>' : ''}`;
}

function weightForm(root, entry) {
  const last = currentWeight(state.weights);
  const initial = entry ? entry.value : last ? last.value : 75;
  root.innerHTML = `
    <div class="stepper">
      <button class="press" id="w-minus" aria-label="Moins 100 grammes">−</button>
      <div class="stepper-val"><input id="f-weight" inputmode="decimal" autocomplete="off" aria-label="Poids en kilos" value="${fmtNum(initial, 1)}"><span>kg</span></div>
      <button class="press" id="w-plus" aria-label="Plus 100 grammes">+</button>
    </div>
    ${dateField(entry ? entry.date : dayKey())}
    ${footButtons(entry)}`;
  const input = $('#f-weight', root);
  const step = (d) => {
    const v = (parseNum(input.value) ?? initial) + d;
    input.value = fmtNum(Math.max(0, Math.round(v * 10) / 10), 1);
    navigator.vibrate?.(4);
  };
  $('#w-minus', root).onclick = () => step(-0.1);
  $('#w-plus', root).onclick = () => step(0.1);
  $('#f-save', root).onclick = async (e) => {
    const value = parseNum(input.value);
    const date = $('#f-date', root).value;
    if (value == null || value < 20 || value > 400) return formError(root, 'Indique un poids entre 20 et 400 kg.', input);
    if (!date) return formError(root, 'Choisis une date.', $('#f-date', root));
    const rec = entry
      ? { ...strip(entry), value: Math.round(value * 10) / 10, date }
      : { id: db.newId(), value: Math.round(value * 10) / 10, date, createdAt: Date.now() };
    await commit('weights', rec, e.currentTarget);
  };
  if (entry) $('#f-delete', root).onclick = () => deleteEntry('weights', entry);
}

function workoutForm(root, entry) {
  const lastW = [...state.workouts].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
  let type = entry ? entry.type : lastW?.type || 'course';
  let intensity = entry?.intensity || 'mid';
  const initial = entry ? entry.duration : lastW?.duration || 30;
  root.innerHTML = `
    <div class="type-grid" id="f-types">${Object.entries(TYPES).map(([k, [n, icon]]) => `<button class="type-tile press" data-type="${k}" aria-pressed="${k === type}">${icon}<span>${n}</span></button>`).join('')}</div>
    <div class="stepper">
      <button class="press" id="d-minus" aria-label="Moins 5 minutes">−</button>
      <div class="stepper-val"><input class="short" id="f-duration" inputmode="numeric" autocomplete="off" aria-label="Durée en minutes" value="${fmtNum(initial)}"><span>min</span></div>
      <button class="press" id="d-plus" aria-label="Plus 5 minutes">+</button>
    </div>
    <div class="seg seg-solid" id="f-intensity" aria-label="Intensité">
      <span class="seg-thumb"></span>
      ${Object.entries(INTENSITIES).map(([k, n]) => `<button class="press" data-value="${k}">${n}</button>`).join('')}
    </div>
    <div class="field-pair">
      <div class="field"><label for="f-distance">Distance</label><input id="f-distance" inputmode="decimal" autocomplete="off" placeholder="–" value="${entry?.distance ? fmtNum(entry.distance, entry.distance % 1 ? 1 : 0) : ''}"><em>km</em></div>
      <div class="field"><label for="f-load">Charge</label><input id="f-load" inputmode="decimal" autocomplete="off" placeholder="–" value="${entry?.load ? fmtNum(entry.load, entry.load % 1 ? 1 : 0) : ''}"><em>kg</em></div>
    </div>
    ${dateField(entry ? entry.date : dayKey())}
    <p class="estimate" id="f-est"></p>
    ${footButtons(entry)}`;
  const chips = $('#f-types', root);
  const input = $('#f-duration', root);
  const estimate = () => {
    const draft = {
      type, intensity, duration: parseNum(input.value), date: $('#f-date', root).value || dayKey(),
      distance: parseNum($('#f-distance', root).value),
    };
    const burn = kcal(draft, state.weights);
    $('#f-est', root).textContent = burn == null
      ? 'Ajoute une pesée pour estimer les calories.'
      : `≈ ${fmtNum(burn)} kcal estimées · MET ${fmtNum(metFor(draft), 1)}`;
  };
  chips.addEventListener('click', (e) => {
    const b = e.target.closest('.type-tile');
    if (!b) return;
    type = b.dataset.type;
    chips.querySelectorAll('.type-tile').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
    estimate();
  });
  bindSeg($('#f-intensity', root), intensity, (v) => { intensity = v; estimate(); });
  ['#f-duration', '#f-distance', '#f-date'].forEach((s) => $(s, root).addEventListener('input', estimate));
  const step = (d) => {
    const v = (parseNum(input.value) ?? initial) + d;
    input.value = String(Math.max(5, Math.round(v / 5) * 5));
    navigator.vibrate?.(4);
    estimate();
  };
  estimate();
  $('#d-minus', root).onclick = () => step(-5);
  $('#d-plus', root).onclick = () => step(5);
  $('#f-save', root).onclick = async (e) => {
    const duration = parseNum(input.value);
    const date = $('#f-date', root).value;
    const distRaw = $('#f-distance', root).value.trim();
    const loadRaw = $('#f-load', root).value.trim();
    const distance = distRaw ? parseNum(distRaw) : null;
    const load = loadRaw ? parseNum(loadRaw) : null;
    if (duration == null || duration < 1 || duration > 1440) return formError(root, 'Indique une durée entre 1 et 1 440 minutes.', input);
    if (distRaw && (distance == null || distance < 0)) return formError(root, 'La distance doit être un nombre.', $('#f-distance', root));
    if (loadRaw && (load == null || load < 0)) return formError(root, 'La charge doit être un nombre.', $('#f-load', root));
    if (!date) return formError(root, 'Choisis une date.', $('#f-date', root));
    const base = { type, intensity, duration: Math.round(duration), distance: distance || null, load: load || null, date };
    const rec = entry ? { ...strip(entry), ...base } : { id: db.newId(), createdAt: Date.now(), ...base };
    await commit('workouts', rec, e.currentTarget);
  };
  if (entry) $('#f-delete', root).onclick = () => deleteEntry('workouts', entry);
}

const strip = ({ kind, ...rest }) => rest;

async function commit(store, rec, button) {
  button.disabled = true;
  const list = state[store];
  const i = list.findIndex((r) => r.id === rec.id);
  await db.put(store, rec);
  if (i >= 0) list[i] = rec; else list.push(rec);
  celebrate(button);
}

function celebrate(button) {
  const success = $('#success');
  success.classList.add('show');
  navigator.vibrate?.([8, 40, 12]);
  const disc = $('.success-disc', success).getBoundingClientRect();
  setTimeout(() => confetti($('#confetti'), disc.left + disc.width / 2, disc.top + disc.height / 2), reduced() ? 0 : 140);
  setTimeout(() => {
    closeSheet();
    button.disabled = false;
    enterTab(state.tab);
  }, reduced() ? 500 : 1000);
}

async function deleteEntry(store, entry) {
  const rec = strip(entry);
  await db.remove(store, rec.id);
  state[store] = state[store].filter((r) => r.id !== rec.id);
  closeSheet();
  enterTab(state.tab);
  showToast('Entrée supprimée', 'Annuler', async () => {
    await db.put(store, rec);
    state[store].push(rec);
    enterTab(state.tab);
  });
}

function openEntry(kind, id) {
  const entry = (kind === 'weight' ? state.weights : state.workouts).find((r) => r.id === id);
  if (entry) openAdd(kind, entry);
}
document.addEventListener('click', (e) => {
  if (e.target.closest('#hist-more')) {
    state.histLimit += 60;
    renderHistory();
    return;
  }
  const row = e.target.closest('.row');
  if (row) openEntry(row.dataset.kind, row.dataset.id);
});

$('#fab').addEventListener('click', () => openAdd('weight'));
$('#empty-add').addEventListener('click', () => openAdd('weight'));
$('#empty-demo').addEventListener('click', loadDemo);
$('#open-settings').addEventListener('click', openSettings);

/* ---------- Toast ---------- */
const toastEl = $('#toast');
let toastTimer;
function showToast(msg, action, onAction) {
  clearTimeout(toastTimer);
  toastEl.textContent = msg;
  if (action) {
    const b = document.createElement('button');
    b.textContent = action;
    b.onclick = () => { toastEl.classList.remove('show'); onAction(); };
    toastEl.append(b);
  }
  toastEl.classList.add('show');
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), action ? 5000 : 2800);
}

/* ---------- Réglages, export, import ---------- */
function openSettings() {
  const s = state.settings;
  const hasDemo = state.weights.some((w) => w.demo) || state.workouts.some((w) => w.demo);
  openSheet((root) => {
    root.innerHTML = `
      <h2 class="sheet-title">Réglages</h2>
      <p class="set-title">Objectifs de la semaine</p>
      <div class="set-group">
        <div class="field"><label for="g-s">Séances</label><input id="g-s" inputmode="numeric" value="${s.goalSessions}"></div>
        <div class="field"><label for="g-m">Minutes</label><input id="g-m" inputmode="numeric" value="${s.goalMinutes}"></div>
        <div class="field"><label for="g-d">Jours actifs</label><input id="g-d" inputmode="numeric" value="${s.goalDays}"></div>
      </div>
      <p class="set-title">Objectif de poids</p>
      <div class="seg seg-solid" id="set-dir">
        <span class="seg-thumb"></span>
        <button class="press" data-value="lose">Perdre</button>
        <button class="press" data-value="keep">Maintenir</button>
        <button class="press" data-value="gain">Prendre</button>
      </div>
      <p class="set-title">Apparence</p>
      <div class="seg seg-solid" id="set-theme">
        <span class="seg-thumb"></span>
        <button class="press" data-value="dark">Sombre</button>
        <button class="press" data-value="light">Clair</button>
      </div>
      <p class="set-title">Comprendre</p>
      <div class="set-group"><button class="set-btn" id="open-guide">Guide des calories</button></div>
      <p class="set-title">Mes données</p>
      <div class="set-group">
        <button class="set-btn" id="do-export">Exporter en JSON</button>
        <button class="set-btn" id="do-import">Importer un fichier JSON</button>
        ${hasDemo ? '<button class="set-btn" id="do-undemo">Retirer les données de démo</button>' : '<button class="set-btn" id="do-demo">Charger des données de démo</button>'}
        <button class="set-btn btn-danger" id="do-wipe">Tout effacer</button>
      </div>
      <p class="set-note">Tes données restent sur cet iPhone. Supprimer l’app de l’écran d’accueil les efface : exporte-les régulièrement.</p>`;
    const num = (id, key) => {
      $(id, root).addEventListener('change', (e) => {
        const v = Math.round(parseNum(e.target.value) ?? 0);
        if (v < 1) { e.target.value = state.settings[key]; return; }
        e.target.value = v;
        saveSetting(key, v);
        if (state.tab === 0) renderToday(false);
      });
    };
    num('#g-s', 'goalSessions'); num('#g-m', 'goalMinutes'); num('#g-d', 'goalDays');
    bindSeg($('#set-dir', root), s.direction, (v) => { saveSetting('direction', v); if (state.tab === 0) renderToday(false); });
    bindSeg($('#set-theme', root), s.theme, (v) => { saveSetting('theme', v); applyTheme(); });
    $('#open-guide', root).onclick = openGuide;
    $('#do-export', root).onclick = exportData;
    $('#do-import', root).onclick = () => $('#import-file').click();
    $('#do-wipe', root).onclick = wipeAll;
    if (hasDemo) $('#do-undemo', root).onclick = removeDemo;
    else $('#do-demo', root).onclick = loadDemo;
  });
}

function openGuide() {
  const last = currentWeight(state.weights);
  const kg = last ? last.value : 75;
  openSheet((root) => {
    root.innerHTML = `
      <h2 class="sheet-title">Guide des calories</h2>
      <p class="set-note guide-note">Calories brûlées par heure pour ${fmtNum(kg, 1)} kg${last ? '' : ' (poids d’exemple)'}, repos inclus.</p>
      <table class="guide">
        <thead><tr><th scope="col">Sport</th>${Object.values(INTENSITIES).map((n) => `<th scope="col">${n}</th>`).join('')}</tr></thead>
        <tbody>${Object.entries(TYPES).map(([k, [n]]) => `<tr><th scope="row">${n}</th>${['low', 'mid', 'high'].map((i) => `<td>${fmtNum(Math.round(MET[k][i][0] * kg))}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
      <p class="set-note guide-note">Calcul : MET × poids (kg) × durée (h). Si tu saisis une distance en course, vélo ou marche, la vitesse réelle remplace l’intensité.</p>
      <p class="set-note guide-note">C’est une moyenne, pas une mesure : ton chiffre réel peut être assez différent. Valeurs issues du <a href="https://pacompendium.com/" target="_blank" rel="noopener">Compendium of Physical Activities 2024</a>.</p>`;
  });
}

async function exportData() {
  const payload = {
    app: 'elan', version: 1, exportedAt: new Date().toISOString(),
    weights: state.weights, workouts: state.workouts, settings: state.settings,
  };
  const name = `elan-${dayKey()}.json`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
    } catch (err) {
      if (err.name !== 'AbortError') showToast('Export impossible');
    }
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  showToast('Fichier exporté');
}

const validDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseDay(s).getTime());
const posOrNull = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);

function sanitizeWeight(r) {
  if (!r || typeof r.id !== 'string' || !validDay(r.date)) return null;
  if (typeof r.value !== 'number' || !(r.value >= 20 && r.value <= 400)) return null;
  return { id: r.id, date: r.date, value: r.value, createdAt: Number(r.createdAt) || parseDay(r.date).getTime(), ...(r.demo ? { demo: true } : {}) };
}
function sanitizeWorkout(r) {
  if (!r || typeof r.id !== 'string' || !validDay(r.date)) return null;
  if (typeof r.duration !== 'number' || !(r.duration >= 1 && r.duration <= 1440)) return null;
  return {
    id: r.id, date: r.date, duration: r.duration, type: TYPES[r.type] ? r.type : 'autre',
    intensity: INTENSITIES[r.intensity] ? r.intensity : 'mid',
    distance: posOrNull(r.distance), load: posOrNull(r.load),
    createdAt: Number(r.createdAt) || parseDay(r.date).getTime(), ...(r.demo ? { demo: true } : {}),
  };
}

$('#import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'elan' || !Array.isArray(data.weights) || !Array.isArray(data.workouts)) throw new Error('format');
    const weights = data.weights.map(sanitizeWeight).filter(Boolean);
    const workouts = data.workouts.map(sanitizeWorkout).filter(Boolean);
    await db.put('weights', ...weights);
    await db.put('workouts', ...workouts);
    await loadState();
    closeSheet();
    enterTab(state.tab);
    showToast(`${weights.length + workouts.length} entrées importées`);
  } catch {
    showToast('Ce fichier n’est pas un export Élan valide');
  }
});

async function loadDemo() {
  const { weights, workouts } = demoData(db.newId);
  await db.put('weights', ...weights);
  await db.put('workouts', ...workouts);
  await loadState();
  if (sheet.classList.contains('open')) closeSheet();
  enterTab(state.tab);
  showToast('Données de démo chargées');
}

async function removeDemo() {
  await db.remove('weights', ...state.weights.filter((w) => w.demo).map((w) => w.id));
  await db.remove('workouts', ...state.workouts.filter((w) => w.demo).map((w) => w.id));
  await loadState();
  closeSheet();
  enterTab(state.tab);
  showToast('Données de démo retirées');
}

async function wipeAll() {
  if (!confirm('Effacer toutes les pesées et séances ? Cette action est définitive.')) return;
  await db.clear('weights', 'workouts');
  await loadState();
  closeSheet();
  enterTab(state.tab);
  showToast('Données effacées');
}

/* ---------- Démarrage ---------- */
async function loadState() {
  const [weights, workouts, settings] = await Promise.all([db.getAll('weights'), db.getAll('workouts'), db.getAll('settings')]);
  state.weights = weights;
  state.workouts = workouts;
  state.settings = { ...DEFAULTS, ...Object.fromEntries(settings.map((s) => [s.key, s.value])) };
}

async function boot() {
  installSpring();
  document.addEventListener('touchstart', () => {}, { passive: true }); // active :active sur iOS
  await loadState();
  applyTheme();
  goTab(0, { force: true });
  navigator.storage?.persist?.();

  // Au retour dans l'app : la date a pu changer et les compteurs rejouent.
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = Date.now();
    else if (Date.now() - hiddenAt > 60000 && !sheet.classList.contains('open')) enterTab(state.tab);
  });

  const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
  if ('serviceWorker' in navigator && (!isLocal || location.search.includes('sw=1'))) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
boot();
