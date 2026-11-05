// Génère les icônes et écrans de démarrage (PNG) sans dépendance : node tools/make-icons.mjs
import { deflateSync, crc32 } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = new URL('../icons/', import.meta.url);
mkdirSync(OUT, { recursive: true });

function png(w, h, rgb) {
  const chunk = (type, data) => {
    const t = Buffer.from(type);
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])) >>> 0);
    return Buffer.concat([len, t, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const clamp01 = (v) => Math.min(1, Math.max(0, v));

const RINGS = [
  { R: 0.335, sweep: 0.80, a: hex('#FF4FA3'), b: hex('#FF8AC4') },
  { R: 0.235, sweep: 0.66, a: hex('#9BE22D'), b: hex('#C9F75C') },
  { R: 0.135, sweep: 0.87, a: hex('#2BC8E0'), b: hex('#7DEBF5') },
];
const STROKE = 0.078;

// Dessine les anneaux dans un buffer, centrés en (cx, cy), avec une échelle `s` en pixels.
function drawRings(buf, W, H, cx, cy, s) {
  const half = (s * 0.42) | 0;
  const x0 = Math.max(0, (cx - half) | 0), x1 = Math.min(W, (cx + half) | 0);
  const y0 = Math.max(0, (cy - half) | 0), y1 = Math.min(H, (cy + half) | 0);
  const w = STROKE * s;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const r = Math.hypot(dx, dy);
      let th = Math.atan2(dx, -dy) / (2 * Math.PI);
      if (th < 0) th += 1;
      const i = (y * W + x) * 3;
      let c = [buf[i], buf[i + 1], buf[i + 2]];
      for (const ring of RINGS) {
        const R = ring.R * s;
        const track = clamp01(0.5 - (Math.abs(r - R) - w / 2));
        if (track > 0) c = mix(c, ring.a, track * 0.17);
        let d;
        if (th <= ring.sweep) d = Math.abs(r - R) - w / 2;
        else {
          const ang = ring.sweep * 2 * Math.PI;
          const ex = Math.sin(ang) * R, ey = -Math.cos(ang) * R;
          d = Math.min(Math.hypot(dx - ex, dy - ey), Math.hypot(dx, dy + R)) - w / 2;
        }
        const cov = clamp01(0.5 - d);
        if (cov > 0) c = mix(c, mix(ring.a, ring.b, Math.min(th / ring.sweep, 1)), cov);
      }
      buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2];
    }
  }
}

function icon(size, scale = 1) {
  const buf = Buffer.alloc(size * size * 3);
  const top = hex('#1B1D2B'), bottom = hex('#07080C');
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = mix(top, bottom, clamp01((x * 0.25 + y * 0.75) / size));
      const i = (y * size + x) * 3;
      buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2];
    }
  }
  drawRings(buf, size, size, size / 2, size / 2, size * scale);
  return png(size, size, buf);
}

function splash(W, H) {
  const buf = Buffer.alloc(W * H * 3);
  const bg = hex('#07080C');
  for (let i = 0; i < buf.length; i += 3) { buf[i] = bg[0]; buf[i + 1] = bg[1]; buf[i + 2] = bg[2]; }
  drawRings(buf, W, H, W / 2, H / 2, W * 0.42);
  return png(W, H, buf);
}

writeFileSync(new URL('apple-touch-icon.png', OUT), icon(180));
writeFileSync(new URL('icon-192.png', OUT), icon(192));
writeFileSync(new URL('icon-512.png', OUT), icon(512));
writeFileSync(new URL('icon-maskable-512.png', OUT), icon(512, 0.78));

// Formats iPhone (largeur × hauteur en pixels physiques)
for (const [w, h] of [[750, 1334], [828, 1792], [1125, 2436], [1170, 2532], [1179, 2556], [1206, 2622], [1242, 2688], [1284, 2778], [1290, 2796], [1320, 2868]]) {
  writeFileSync(new URL(`splash-${w}x${h}.png`, OUT), splash(w, h));
}
console.log('Icônes générées');
