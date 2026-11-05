// Moteur d'animation : tweens, compteurs à rouleaux, confettis, respect de « Réduire les animations ».
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
export const reduced = () => motionQuery.matches;

export const ease = {
  linear: (t) => t,
  outCubic: (t) => 1 - (1 - t) ** 3,
  outQuart: (t) => 1 - (1 - t) ** 4,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  outBack: (t) => { const c = 1.35; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; },
};

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;

// Tween piloté par requestAnimationFrame. Renvoie une fonction d'annulation.
export function tween({ duration = 600, delay = 0, easing = ease.outCubic, onUpdate, onDone }) {
  if (reduced() || duration <= 0) {
    onUpdate?.(1, 1);
    onDone?.();
    return () => {};
  }
  let raf;
  let start;
  let cancelled = false;
  const frame = (now) => {
    if (cancelled) return;
    start ??= now + delay;
    const t = clamp((now - start) / duration);
    if (now >= start) onUpdate?.(easing(t), t);
    if (t < 1) raf = requestAnimationFrame(frame);
    else onDone?.();
  };
  raf = requestAnimationFrame(frame);
  return () => { cancelled = true; cancelAnimationFrame(raf); };
}

// Ressort amorti converti en courbe CSS linear() (Safari 17.2+), sinon cubic-bezier de secours.
export function installSpring() {
  if (!CSS.supports('transition-timing-function', 'linear(0, 1)')) return;
  const curve = (zeta, omega, steps = 40) => {
    const stops = [];
    const wd = omega * Math.sqrt(1 - zeta * zeta);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const v = i === steps ? 1 : 1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + (zeta * omega / wd) * Math.sin(wd * t));
      stops.push(v.toFixed(4));
    }
    return `linear(${stops.join(',')})`;
  };
  const root = document.documentElement.style;
  root.setProperty('--spring', curve(0.68, 11));
  root.setProperty('--spring-soft', curve(0.86, 10));
}

const STRIP = Array.from({ length: 30 }, (_, i) => i % 10).join('\n');

// Compteur à rouleaux : chaque chiffre défile jusqu'à sa valeur.
export class Odometer {
  constructor(el) {
    this.el = el;
    el.classList.add('od');
    this.mask = null;
    this.cols = [];
  }

  // text : valeur déjà formatée. roll=true repart de zéro, sinon glisse depuis la valeur en cours.
  set(text, { roll = true, delay = 0 } = {}) {
    text = String(text);
    this.el.setAttribute('aria-label', text);
    if (reduced()) {
      this.mask = null;
      this.el.textContent = text;
      return;
    }
    const mask = text.replace(/\d/g, '0');
    if (roll || mask !== this.mask) this.#build(text, mask);
    const digits = [...text].filter((c) => /\d/.test(c)).map(Number);
    requestAnimationFrame(() => {
      void this.el.offsetWidth; // force la position de départ avant de lancer la transition
      this.cols.forEach((strip, i) => {
        strip.style.transitionDuration = `${850 + i * 120}ms`;
        strip.style.transitionDelay = `${delay + i * 40}ms`;
        strip.style.transform = `translate3d(0, ${(-(20 + digits[i]) / 30) * 100}%, 0)`;
      });
    });
  }

  #build(text, mask) {
    this.mask = mask;
    this.el.textContent = '';
    this.cols = [];
    for (const ch of text) {
      if (/\d/.test(ch)) {
        const col = document.createElement('span');
        col.className = 'od-col';
        col.setAttribute('aria-hidden', 'true');
        const strip = document.createElement('span');
        strip.className = 'od-strip';
        strip.textContent = STRIP;
        col.append(strip);
        this.el.append(col);
        this.cols.push(strip);
      } else {
        const s = document.createElement('span');
        s.className = 'od-sym';
        s.setAttribute('aria-hidden', 'true');
        s.textContent = ch;
        this.el.append(s);
      }
    }
  }
}

// Confettis légers sur un canvas plein écran.
export function confetti(canvas, originX, originY) {
  if (reduced()) return;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const W = innerWidth;
  const H = innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const colors = ['#E5182F', '#FFFFFF', '#FF5A6E', '#8E8E96', '#E5182F'];
  const parts = Array.from({ length: 34 }, (_, i) => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
    const v = 260 + Math.random() * 360;
    return {
      x: originX, y: originY,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 12,
      w: 5 + Math.random() * 4, h: 3 + Math.random() * 3,
      c: colors[i % colors.length],
    };
  });
  let last = performance.now();
  const startT = last;
  const LIFE = 1100;
  const frame = (now) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const age = now - startT;
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = clamp(1.5 - (age / LIFE) * 1.5);
    for (const p of parts) {
      p.vy += 980 * dt;
      p.vx *= 0.985;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.r += p.vr * dt;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (age < LIFE) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, W, H);
  };
  requestAnimationFrame(frame);
}
