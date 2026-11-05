// Graphiques SVG sur mesure : courbe du poids (tracé + morphing), barres en cascade, anneaux, sparkline.
import { tween, ease, clamp, lerp, reduced } from './anim.js';
import { fmtNum } from './data.js';

const NS = 'http://www.w3.org/2000/svg';
const S = (name, attrs = {}, parent) => {
  const n = document.createElementNS(NS, name);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  parent?.append(n);
  return n;
};
let uid = 0;
const SAMPLES = 96;

// Interpolation cubique monotone (Fritsch–Carlson) : pas de bosse au-delà des valeurs réelles.
function monotoneSamples(pts, n = SAMPLES) {
  const out = new Array(n);
  if (pts.length === 1) {
    for (let i = 0; i < n; i++) out[i] = [pts[0][0], pts[0][1]];
    return out;
  }
  const m = pts.length;
  const dx = []; const slope = []; const tan = new Array(m);
  for (let i = 0; i < m - 1; i++) {
    dx[i] = pts[i + 1][0] - pts[i][0] || 1e-6;
    slope[i] = (pts[i + 1][1] - pts[i][1]) / dx[i];
  }
  tan[0] = slope[0];
  tan[m - 1] = slope[m - 2];
  for (let i = 1; i < m - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) tan[i] = 0;
    else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      tan[i] = (w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]);
    }
  }
  let seg = 0;
  const x0 = pts[0][0];
  const xN = pts[m - 1][0];
  for (let i = 0; i < n; i++) {
    const x = lerp(x0, xN, i / (n - 1));
    while (seg < m - 2 && x > pts[seg + 1][0]) seg++;
    const h = dx[seg];
    const t = clamp((x - pts[seg][0]) / h);
    const t2 = t * t;
    const t3 = t2 * t;
    const y = (2 * t3 - 3 * t2 + 1) * pts[seg][1] + (t3 - 2 * t2 + t) * h * tan[seg]
      + (-2 * t3 + 3 * t2) * pts[seg + 1][1] + (t3 - t2) * h * tan[seg + 1];
    out[i] = [x, y];
  }
  return out;
}

const linePath = (s) => {
  let d = `M${s[0][0].toFixed(1)} ${s[0][1].toFixed(1)}`;
  for (let i = 1; i < s.length; i++) d += `L${s[i][0].toFixed(1)} ${s[i][1].toFixed(1)}`;
  return d;
};

// Bulle + sélection tactile communes aux graphiques.
function attachPicker(host, svg, onPick, onClear) {
  const pick = (e) => {
    const r = svg.getBoundingClientRect();
    onPick(e.clientX - r.left);
  };
  host.addEventListener('pointerdown', (e) => { host.dataset.active = '1'; pick(e); });
  host.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' || host.dataset.active) pick(e);
  });
  host.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { delete host.dataset.active; onClear(); } });
  document.addEventListener('pointerdown', (e) => { if (!host.contains(e.target)) { delete host.dataset.active; onClear(); } });
  host.addEventListener('pointerup', () => { delete host.dataset.active; });
  host.addEventListener('pointercancel', () => { delete host.dataset.active; });
}

function placeBubble(bubble, hostW, x, y) {
  const w = bubble.offsetWidth;
  const h = bubble.offsetHeight;
  const bx = clamp(x - w / 2, 0, hostW - w);
  const by = y - h - 14 < 0 ? y + 14 : y - h - 14;
  bubble.style.transform = `translate3d(${bx}px, ${by}px, 0)`;
  bubble.firstElementChild.style.transformOrigin = `${clamp(x - bx, 0, w)}px ${by < y ? '100%' : '0%'}`;
  bubble.classList.add('show');
}

function niceScale(min, max) {
  const span = Math.max(max - min, 0.6);
  const steps = [0.2, 0.5, 1, 2, 5, 10, 20, 50];
  for (const step of steps) {
    const lo = Math.floor((min - Math.max(0, 3 * step - span) / 2) / step) * step;
    if (step * 3 >= span * 1.1 && lo + step * 3 >= max) return { lo, step };
  }
  return { lo: Math.floor(min / 50) * 50, step: 50 };
}

export class WeightChart {
  constructor(host, { height = 232 } = {}) {
    this.host = host;
    this.H = height;
    this.id = `wc${uid++}`;
    host.classList.add('chart');
    host.style.height = `${height}px`;
    host.innerHTML = `<div class="bubble"><div class="bubble-in"></div></div><div class="chart-empty" hidden>Pas encore de pesée sur cette période</div>`;
    this.bubble = host.firstElementChild;
    this.emptyEl = host.querySelector('.chart-empty');
    const svg = this.svg = S('svg', { class: 'chart-svg', role: 'img' });
    host.prepend(svg);
    const defs = S('defs', {}, svg);
    const g = S('linearGradient', { id: `${this.id}a`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    S('stop', { offset: '0%', 'stop-color': 'var(--c-weight)', 'stop-opacity': 0.38 }, g);
    S('stop', { offset: '100%', 'stop-color': 'var(--c-weight)', 'stop-opacity': 0 }, g);
    this.clipRect = S('rect', { x: 0, y: -6, width: 0, height: height + 12 }, S('clipPath', { id: `${this.id}c` }, defs));
    this.gridG = S('g', { class: 'grid' }, svg);
    this.grid = [0, 1, 2, 3].map(() => ({ line: S('line', {}, this.gridG), text: S('text', { 'text-anchor': 'end' }, this.gridG) }));
    this.labelsWrap = S('g', {}, svg);
    this.plot = S('g', { class: 'plot', 'clip-path': `url(#${this.id}c)` }, svg);
    this.area = S('path', { fill: `url(#${this.id}a)` }, this.plot);
    this.glow = S('path', { class: 'w-glow' }, this.plot);
    this.line = S('path', { class: 'w-line' }, this.plot);
    this.maLine = S('path', { class: 'w-ma' }, this.plot);
    this.dots = S('g', { class: 'w-dots' }, svg);
    this.cross = S('line', { class: 'crosshair', opacity: 0 }, svg);
    this.pickDot = S('circle', { class: 'pick-dot', r: 5.5, opacity: 0 }, svg);
    this.tip = S('circle', { class: 'tip-dot', r: 5, opacity: 0 }, svg);
    this.ticks = [0, 0, 0, 0];
    this.dec = 0;
    this.cur = null;
    this.cancel = () => {};
    attachPicker(host, svg, (x) => this.#pick(x), () => this.clearPick());
    new ResizeObserver(() => {
      if (this.model && host.clientWidth !== this.W && host.clientWidth > 0) this.set(this.model, 'none');
    }).observe(host);
  }

  #measure() {
    this.W = this.host.clientWidth || 320;
    this.svg.setAttribute('viewBox', `0 0 ${this.W} ${this.H}`);
    this.svg.setAttribute('width', this.W);
    this.svg.setAttribute('height', this.H);
    this.m = { t: 12, r: 36, b: 26, l: 6 };
    this.iw = this.W - this.m.l - this.m.r;
    this.ih = this.H - this.m.t - this.m.b;
    this.grid.forEach((g, i) => {
      const y = this.m.t + (this.ih * i) / 3;
      g.line.setAttribute('x1', this.m.l); g.line.setAttribute('x2', this.W - this.m.r + 2);
      g.line.setAttribute('y1', y); g.line.setAttribute('y2', y);
      g.text.setAttribute('x', this.W); g.text.setAttribute('y', y + 3.5);
    });
  }

  #x(f) { return this.m.l + 6 + f * (this.iw - 12); }

  #labels(labels, animate) {
    const old = this.labelsWrap.lastElementChild;
    const g = S('g', { class: 'x-labels' }, this.labelsWrap);
    labels.forEach((l) => {
      const t = S('text', { x: this.#x(l.f), y: this.H - 6, 'text-anchor': 'middle' }, g);
      t.textContent = l.text;
    });
    if (old && animate && !reduced()) {
      g.style.opacity = 0;
      requestAnimationFrame(() => { g.style.opacity = 1; old.style.opacity = 0; });
      setTimeout(() => old.remove(), 340);
    } else old?.remove();
  }

  // mode : 'draw' (tracé gauche→droite), 'morph' (transition depuis l'état courant), 'none'.
  set(model, mode = 'draw') {
    this.cancel();
    this.model = model;
    this.clearPick();
    this.#measure();
    this.#labels(model.labels, mode === 'morph');
    this.dots.textContent = '';
    this.tip.setAttribute('opacity', 0);
    this.svg.setAttribute('aria-label', this.#summary());
    const pts = model.points;
    this.emptyEl.hidden = pts.length > 0;
    if (!pts.length) {
      this.plot.style.opacity = 0;
      this.cur = null;
      this.gridG.style.opacity = 0.5;
      return;
    }
    this.gridG.style.opacity = 1;
    this.plot.style.opacity = 1;

    const vals = pts.flatMap((p) => (p.ma != null ? [p.v, p.ma] : [p.v]));
    const { lo, step } = niceScale(Math.min(...vals), Math.max(...vals));
    const hi = lo + step * 3;
    const Y = (v) => this.m.t + ((hi - v) / (hi - lo)) * this.ih;
    this.pix = pts.map((p) => ({ ...p, x: this.#x(p.f), y: Y(p.v) }));
    const target = {
      line: monotoneSamples(this.pix.map((p) => [p.x, p.y])),
      ma: monotoneSamples(pts.map((p) => [this.#x(p.f), Y(p.ma ?? p.v)])),
    };
    const newTicks = [0, 1, 2, 3].map((i) => hi - i * step);
    const fromTicks = this.ticks;
    this.dec = step < 1 ? 1 : 0;

    const paintTicks = (t) => this.grid.forEach((g, i) => {
      g.text.textContent = fmtNum(lerp(fromTicks[i], newTicks[i], t), this.dec);
    });

    if (mode === 'morph' && this.cur && !reduced()) {
      this.clipRect.setAttribute('width', this.W);
      const from = this.cur;
      const live = { line: target.line.map((p) => [...p]), ma: target.ma.map((p) => [...p]) };
      this.cancel = tween({
        duration: 720,
        easing: ease.linear,
        onUpdate: (_, raw) => {
          for (let i = 0; i < SAMPLES; i++) {
            const local = ease.inOutCubic(clamp(raw * 1.3 - (i / SAMPLES) * 0.3));
            for (const key of ['line', 'ma']) {
              live[key][i][0] = lerp(from[key][i][0], target[key][i][0], local);
              live[key][i][1] = lerp(from[key][i][1], target[key][i][1], local);
            }
          }
          this.#paint(live);
          paintTicks(ease.inOutCubic(raw));
          this.cur = live;
        },
        onDone: () => { this.cur = target; this.ticks = newTicks; this.#paint(target); this.#showDots(); },
      });
      return;
    }

    this.ticks = newTicks;
    this.grid.forEach((g, i) => { g.text.textContent = fmtNum(newTicks[i], this.dec); });
    this.#paint(target);
    this.cur = target;

    if (mode === 'draw' && !reduced()) {
      const x0 = target.line[0][0] - 8;
      const xN = target.line[SAMPLES - 1][0] + 8;
      this.clipRect.setAttribute('x', x0);
      this.clipRect.setAttribute('width', 0);
      this.tip.setAttribute('opacity', 1);
      this.cancel = tween({
        duration: 1250,
        delay: 180,
        easing: ease.inOutCubic,
        onUpdate: (p) => {
          this.clipRect.setAttribute('width', (xN - x0) * p);
          const s = target.line[Math.round(p * (SAMPLES - 1))];
          this.tip.setAttribute('cx', s[0]);
          this.tip.setAttribute('cy', s[1]);
        },
        onDone: () => {
          this.tip.setAttribute('opacity', 0);
          this.clipRect.setAttribute('x', 0);
          this.clipRect.setAttribute('width', this.W);
          this.#showDots();
        },
      });
    } else {
      this.clipRect.setAttribute('x', 0);
      this.clipRect.setAttribute('width', this.W);
      this.#showDots();
    }
  }

  #paint(s) {
    const d = linePath(s.line);
    this.line.setAttribute('d', d);
    this.glow.setAttribute('d', d);
    this.maLine.setAttribute('d', linePath(s.ma));
    const base = this.m.t + this.ih;
    const a = s.line[0];
    const b = s.line[s.line.length - 1];
    this.area.setAttribute('d', `${d}L${b[0].toFixed(1)} ${base}L${a[0].toFixed(1)} ${base}Z`);
  }

  #showDots() {
    this.dots.textContent = '';
    const pts = this.pix;
    if (!pts?.length) return;
    if (pts.length <= 14) pts.slice(0, -1).forEach((p) => S('circle', { class: 'w-dot', cx: p.x, cy: p.y, r: 3.5 }, this.dots));
    const l = pts[pts.length - 1];
    S('circle', { class: 'w-pulse', cx: l.x, cy: l.y, r: 5 }, this.dots);
    S('circle', { class: 'w-last', cx: l.x, cy: l.y, r: 5 }, this.dots);
  }

  #pick(x) {
    const pts = this.pix;
    if (!pts?.length || !this.model.points.length) return;
    let best = pts[0];
    for (const p of pts) if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
    if (this.picked === best) return;
    this.picked = best;
    this.cross.setAttribute('x1', best.x); this.cross.setAttribute('x2', best.x);
    this.cross.setAttribute('y1', this.m.t); this.cross.setAttribute('y2', this.m.t + this.ih);
    this.cross.setAttribute('opacity', 1);
    this.pickDot.setAttribute('cx', best.x); this.pickDot.setAttribute('cy', best.y);
    this.pickDot.setAttribute('opacity', 1);
    const ma = best.ma != null ? `<em>Moy. 7 j : ${fmtNum(best.ma, 1)} kg</em>` : '';
    this.bubble.firstElementChild.innerHTML = `<b>${fmtNum(best.v, 1)} kg</b><span>${best.title}</span>${ma}`;
    placeBubble(this.bubble, this.W, best.x, best.y);
    navigator.vibrate?.(4);
  }

  clearPick() {
    this.picked = null;
    this.bubble.classList.remove('show');
    this.cross.setAttribute('opacity', 0);
    this.pickDot.setAttribute('opacity', 0);
  }

  #summary() {
    const p = this.model.points;
    if (!p.length) return 'Courbe du poids : aucune donnée sur cette période';
    return `Courbe du poids, ${p.length} mesures, de ${fmtNum(p[0].v, 1)} à ${fmtNum(p[p.length - 1].v, 1)} kg`;
  }
}

const barPath = (x, base, w, h) => {
  if (h <= 0.2 || w <= 0) return '';
  const r = Math.min(4, w / 2, h);
  const y = base - h;
  return `M${x.toFixed(1)} ${base}V${(y + r).toFixed(1)}Q${x.toFixed(1)} ${y.toFixed(1)} ${(x + r).toFixed(1)} ${y.toFixed(1)}H${(x + w - r).toFixed(1)}Q${(x + w).toFixed(1)} ${y.toFixed(1)} ${(x + w).toFixed(1)} ${(y + r).toFixed(1)}V${base}Z`;
};

export class BarChart {
  constructor(host, { height = 200 } = {}) {
    this.host = host;
    this.H = height;
    this.id = `bc${uid++}`;
    host.classList.add('chart');
    host.style.height = `${height}px`;
    host.innerHTML = `<div class="bubble"><div class="bubble-in"></div></div>`;
    this.bubble = host.firstElementChild;
    const svg = this.svg = S('svg', { class: 'chart-svg', role: 'img' });
    host.prepend(svg);
    const g = S('linearGradient', { id: `${this.id}g`, x1: 0, y1: 0, x2: 0, y2: 1 }, S('defs', {}, svg));
    S('stop', { offset: '0%', 'stop-color': 'var(--c-sport)' }, g);
    S('stop', { offset: '100%', 'stop-color': 'var(--c-sport)', 'stop-opacity': 0.62 }, g);
    this.gridG = S('g', { class: 'grid' }, svg);
    this.grid = [0, 1, 2].map(() => ({ line: S('line', {}, this.gridG), text: S('text', { 'text-anchor': 'end' }, this.gridG) }));
    this.labelsWrap = S('g', {}, svg);
    this.barsG = S('g', { class: 'bars', fill: `url(#${this.id}g)` }, svg);
    this.state = [];
    this.els = [];
    this.tickMax = 0;
    this.cancel = () => {};
    attachPicker(host, svg, (x) => this.#pick(x), () => this.clearPick());
    new ResizeObserver(() => {
      if (this.model && host.clientWidth !== this.W && host.clientWidth > 0) this.set(this.model, 'none');
    }).observe(host);
  }

  #measure() {
    this.W = this.host.clientWidth || 320;
    this.svg.setAttribute('viewBox', `0 0 ${this.W} ${this.H}`);
    this.svg.setAttribute('width', this.W);
    this.svg.setAttribute('height', this.H);
    this.m = { t: 10, r: 36, b: 26, l: 6 };
    this.iw = this.W - this.m.l - this.m.r;
    this.base = this.H - this.m.b;
    this.ih = this.base - this.m.t;
    this.grid.forEach((g, i) => {
      const y = this.m.t + (this.ih * i) / 2;
      g.line.setAttribute('x1', this.m.l); g.line.setAttribute('x2', this.W - this.m.r + 2);
      g.line.setAttribute('y1', y); g.line.setAttribute('y2', y);
      g.text.setAttribute('x', this.W); g.text.setAttribute('y', y + 3.5);
    });
  }

  #labels(labels, geom, animate) {
    const old = this.labelsWrap.lastElementChild;
    const g = S('g', { class: 'x-labels' }, this.labelsWrap);
    labels.forEach((l) => {
      const t = S('text', { x: geom[l.i].x + geom[l.i].w / 2, y: this.H - 6, 'text-anchor': 'middle' }, g);
      t.textContent = l.text;
    });
    if (old && animate && !reduced()) {
      g.style.opacity = 0;
      requestAnimationFrame(() => { g.style.opacity = 1; old.style.opacity = 0; });
      setTimeout(() => old.remove(), 340);
    } else old?.remove();
  }

  set(model, mode = 'draw') {
    this.cancel();
    this.model = model;
    this.clearPick();
    this.#measure();
    const { bars, labels } = model;
    const n = bars.length;
    const maxV = Math.max(...bars.map((b) => b.v), 1);
    const niceMax = [30, 60, 90, 120, 180, 240, 300, 600, 900, 1200, 1800, 2400, 3000, 4800, 6000, 9000, 12000].find((m) => m >= maxV) || Math.ceil(maxV / 1000) * 1000;
    const pitch = this.iw / n;
    const w = Math.max(Math.min(pitch - 2, n <= 7 ? 26 : 22), 2);
    const target = bars.map((b, i) => ({
      x: this.m.l + i * pitch + (pitch - w) / 2,
      w,
      h: b.v > 0 ? Math.max((b.v / niceMax) * this.ih, 3) : 0,
    }));
    this.geom = target;
    this.#labels(labels, target, mode === 'morph');
    this.svg.setAttribute('aria-label', `Minutes de sport, total ${fmtNum(bars.reduce((s, b) => s + b.v, 0))}`);

    const fromMax = this.tickMax;
    const paintTicks = (t) => this.grid.forEach((g, i) => {
      g.text.textContent = fmtNum(Math.round(lerp(fromMax, niceMax, t) * (1 - i / 2)));
    });
    this.tickMax = niceMax;

    const syncEls = (count) => {
      while (this.els.length < count) this.els.push(S('path', { class: 'bar' }, this.barsG));
      while (this.els.length > count) this.els.pop().remove();
    };

    if (mode === 'none' || reduced()) {
      syncEls(n);
      target.forEach((t, i) => this.els[i].setAttribute('d', barPath(t.x, this.base, t.w, t.h)));
      this.state = target;
      paintTicks(1);
      return;
    }

    if (mode === 'morph' && this.state.length) {
      // Chaque barre part d'une barre existante : le nombre de barres change sans à-coup.
      const old = this.state;
      const count = Math.max(old.length, n);
      syncEls(count);
      const pairs = [];
      for (let i = 0; i < count; i++) {
        const from = old.length >= n ? old[i] : old[Math.min(Math.floor((i / n) * old.length), old.length - 1)];
        const to = old.length >= n ? target[Math.min(Math.floor((i / old.length) * n), n - 1)] : target[i];
        pairs.push({ from, to });
      }
      this.cancel = tween({
        duration: 680,
        easing: ease.linear,
        onUpdate: (_, raw) => {
          pairs.forEach(({ from, to }, i) => {
            const p = ease.inOutCubic(clamp(raw * 1.35 - (i / count) * 0.35));
            this.els[i].setAttribute('d', barPath(lerp(from.x, to.x, p), this.base, lerp(from.w, to.w, p), lerp(from.h, to.h, p)));
          });
          paintTicks(ease.inOutCubic(raw));
        },
        onDone: () => {
          syncEls(n);
          target.forEach((t, i) => this.els[i].setAttribute('d', barPath(t.x, this.base, t.w, t.h)));
        },
      });
      this.state = target;
      return;
    }

    // Cascade : les barres montent une par une.
    syncEls(n);
    this.els.forEach((el) => el.setAttribute('d', ''));
    paintTicks(1);
    const stagger = Math.min(70, 620 / n);
    const each = 620;
    const total = each + stagger * (n - 1);
    this.cancel = tween({
      duration: total,
      delay: 220,
      easing: ease.linear,
      onUpdate: (_, raw) => {
        const now = raw * total;
        target.forEach((t, i) => {
          const p = ease.outBack(clamp((now - i * stagger) / each));
          this.els[i].setAttribute('d', barPath(t.x, this.base, t.w, Math.max(0, t.h * p)));
        });
      },
    });
    this.state = target;
  }

  #pick(x) {
    const g = this.geom;
    if (!g?.length) return;
    const pitch = this.iw / g.length;
    const i = clamp(Math.floor((x - this.m.l) / pitch), 0, g.length - 1);
    if (this.pickedI === i) return;
    this.pickedI = i;
    const b = this.model.bars[i];
    this.barsG.classList.add('dim');
    this.els.forEach((el, j) => el.classList.toggle('on', j === i));
    const sessions = b.count ? `${b.count} séance${b.count > 1 ? 's' : ''}` : 'Repos';
    this.bubble.firstElementChild.innerHTML = `<b>${fmtNum(b.v)} min</b><span>${b.title}</span><em>${sessions}</em>`;
    placeBubble(this.bubble, this.W, g[i].x + g[i].w / 2, this.base - g[i].h);
    navigator.vibrate?.(4);
  }

  clearPick() {
    this.pickedI = null;
    this.bubble.classList.remove('show');
    this.barsG.classList.remove('dim');
    this.els.forEach((el) => el.classList.remove('on'));
  }
}

// Anneaux façon Apple Watch.
export class Rings {
  constructor(host, defs) {
    this.host = host;
    this.defs = defs;
    const size = 148;
    const c = size / 2;
    const stroke = 12;
    const gap = 3;
    const svg = S('svg', { viewBox: `0 0 ${size} ${size}`, class: 'rings-svg', role: 'img' });
    this.svg = svg;
    const d = S('defs', {}, svg);
    this.arcs = defs.map((def, i) => {
      const id = `ring${uid++}`;
      const g = S('linearGradient', { id, x1: 0, y1: 0, x2: 1, y2: 1 }, d);
      S('stop', { offset: '0%', 'stop-color': def.a }, g);
      S('stop', { offset: '100%', 'stop-color': def.b }, g);
      const r = c - stroke / 2 - i * (stroke + gap);
      S('circle', { class: 'ring-track', cx: c, cy: c, r, 'stroke-width': stroke, stroke: def.a }, svg);
      const arc = S('circle', {
        class: 'ring-arc', cx: c, cy: c, r, 'stroke-width': stroke, stroke: `url(#${id})`,
        pathLength: 100, 'stroke-dasharray': '0 100', opacity: 0, transform: `rotate(-90 ${c} ${c})`,
      }, svg);
      return { arc, p: 0 };
    });
    host.append(svg);
    this.cancels = [];
  }

  set(values, { fromZero = true, label = '' } = {}) {
    this.cancels.forEach((f) => f());
    this.svg.setAttribute('aria-label', label);
    this.cancels = this.arcs.map((a, i) => {
      const from = fromZero ? 0 : a.p;
      const to = clamp(values[i], 0, 1) * 100;
      return tween({
        duration: 1300,
        delay: 150 + i * 170,
        easing: ease.outQuart,
        onUpdate: (p) => {
          a.p = lerp(from, to, p);
          a.arc.setAttribute('stroke-dasharray', `${a.p.toFixed(2)} 100`);
          a.arc.setAttribute('opacity', a.p > 0.05 ? 1 : 0);
        },
      });
    });
  }
}

// Mini-courbe de la carte « Aujourd'hui ».
export function drawSpark(host, values) {
  host.textContent = '';
  if (values.length < 2) return;
  const W = host.clientWidth || 120;
  const H = host.clientHeight || 56;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [3 + (i / (values.length - 1)) * (W - 8), 6 + ((max - v) / span) * (H - 14)]);
  const s = monotoneSamples(pts, 60);
  const svg = S('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'aria-hidden': 'true' }, host);
  const id = `sp${uid++}`;
  const g = S('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 }, S('defs', {}, svg));
  S('stop', { offset: '0%', 'stop-color': 'var(--c-weight)', 'stop-opacity': 0.32 }, g);
  S('stop', { offset: '100%', 'stop-color': 'var(--c-weight)', 'stop-opacity': 0 }, g);
  const d = linePath(s);
  const area = S('path', { d: `${d}L${s[59][0]} ${H}L${s[0][0]} ${H}Z`, fill: `url(#${id})`, class: 'spark-area' }, svg);
  const line = S('path', { d, class: 'spark-line', pathLength: 1 }, svg);
  const dot = S('circle', { cx: s[59][0], cy: s[59][1], r: 3.5, class: 'spark-dot' }, svg);
  if (reduced()) return;
  line.style.strokeDasharray = '1';
  line.style.strokeDashoffset = '1';
  area.style.opacity = 0;
  dot.style.opacity = 0;
  tween({
    duration: 1000, delay: 260, easing: ease.inOutCubic,
    onUpdate: (p) => { line.style.strokeDashoffset = 1 - p; area.style.opacity = p; dot.style.opacity = p > 0.97 ? 1 : 0; },
  });
}
