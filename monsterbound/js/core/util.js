// Monsterbound — core utilities. Everything hangs off the global MB namespace so the
// game runs from file:// with plain <script> tags (no bundler, no server, offline).
'use strict';
const MB = (window.MB = window.MB || {});

MB.W = 320; // logical screen width (pixels)
MB.H = 240; // logical screen height
MB.T = 16; // tile size

MB.hash = function (str) {
  let h = 2166136261 >>> 0;
  str = String(str);
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  // final avalanche
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0; h ^= h >>> 15;
  return h >>> 0;
};

// Small fast seeded PRNG (mulberry32)
MB.RNG = class {
  constructor(seed) { this.s = (typeof seed === 'string' ? MB.hash(seed) : seed >>> 0) || 1; }
  next() {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  range(a, b) { return a + this.next() * (b - a); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
  shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
  weighted(items, wf) {
    let tot = 0; for (const it of items) tot += wf(it);
    let r = this.next() * tot;
    for (const it of items) { r -= wf(it); if (r <= 0) return it; }
    return items[items.length - 1];
  }
};

MB.rng = new MB.RNG(Date.now() >>> 0);
MB.rand = () => MB.rng.next();
MB.randInt = (a, b) => MB.rng.int(a, b);
MB.pick = (a) => MB.rng.pick(a);
MB.chance = (p) => MB.rng.chance(p);

MB.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
MB.lerp = (a, b, t) => a + (b - a) * t;
MB.cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
MB.pad = (n, w) => String(n).padStart(w, '0');
MB.uid = () => Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36);
MB.deepCopy = (o) => JSON.parse(JSON.stringify(o));

// ---- colour helpers ----
MB.hsl = function (h, s, l) {
  h = ((h % 360) + 360) % 360; s = MB.clamp(s, 0, 100) / 100; l = MB.clamp(l, 0, 100) / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
};
MB.rgbStr = (c, a) => (a === undefined ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`);
MB.hex = function (h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
MB.shade = (c, f) => [MB.clamp(Math.round(c[0] * f), 0, 255), MB.clamp(Math.round(c[1] * f), 0, 255), MB.clamp(Math.round(c[2] * f), 0, 255)];
MB.mix = (a, b, t) => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];

MB.makeCanvas = function (w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return c;
};

// Word-wrap text to a pixel width using a context's current font
MB.wrap = function (ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    const words = para.split(' ');
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test;
    }
    out.push(line);
  }
  return out;
};

MB.dirs = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
MB.opposite = { up: 'down', down: 'up', left: 'right', right: 'left' };

MB.log = (...a) => { if (MB.DEBUG) console.log('[MB]', ...a); };
