// Shared helpers. Every module hangs off the global RW namespace so the game runs from file:// with plain <script> tags.
(function () {
  const RW = (window.RW = window.RW || {});

  // Small seeded RNG (mulberry32) so maps can be reproduced from a seed.
  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 2D value noise with smooth interpolation, built on a seeded permutation.
  function makeNoise(seed) {
    const rng = makeRng(seed);
    const perm = new Uint8Array(512);
    const vals = new Float32Array(256);
    for (let i = 0; i < 256; i++) { perm[i] = i; vals[i] = rng(); }
    for (let i = 255; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
    const v = (x, y) => vals[perm[(x & 255) + perm[y & 255]]];
    const s = (t) => t * t * (3 - 2 * t);
    function n2(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1);
      const u = s(xf), w = s(yf);
      return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
    }
    return function fbm(x, y, oct = 3) {
      let sum = 0, amp = 1, f = 1, norm = 0;
      for (let i = 0; i < oct; i++) { sum += n2(x * f, y * f) * amp; norm += amp; amp *= 0.5; f *= 2; }
      return sum / norm;
    };
  }

  const U = {
    makeRng,
    makeNoise,
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    rand: (a = 0, b = 1) => a + Math.random() * (b - a),
    randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
    chance: (p) => Math.random() < p,
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
      return arr;
    },
    dist: (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz),
    dist2: (ax, az, bx, bz) => (ax - bx) * (ax - bx) + (az - bz) * (az - bz),
    wrapAngle(a) {
      while (a > Math.PI) a -= Math.PI * 2;
      while (a < -Math.PI) a += Math.PI * 2;
      return a;
    },
    // Rotate angle a toward b by at most step.
    turnToward(a, b, step) {
      const d = U.wrapAngle(b - a);
      if (Math.abs(d) <= step) return b;
      return U.wrapAngle(a + Math.sign(d) * step);
    },
    uid: (() => { let n = 1; return (p = 'id') => p + '_' + (n++) + '_' + Math.floor(Math.random() * 1e6).toString(36); })(),
    fmtTime(s) {
      s = Math.max(0, Math.floor(s));
      return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    },
    fmt: (n) => Math.round(n).toLocaleString('en-US'),
    hex(c) { return '#' + c.toString(16).padStart(6, '0'); },
    // Mix two #rrggbb colors.
    mixHex(a, b, t) {
      const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
      const r = Math.round(U.lerp((pa >> 16) & 255, (pb >> 16) & 255, t));
      const g = Math.round(U.lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
      const bl = Math.round(U.lerp(pa & 255, pb & 255, t));
      return '#' + ((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0');
    },
    escape(s) {
      return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
    $: (sel, root = document) => root.querySelector(sel),
    $$: (sel, root = document) => Array.from(root.querySelectorAll(sel)),
    // Create a DOM element from an HTML string.
    html(str) {
      const t = document.createElement('template');
      t.innerHTML = str.trim();
      return t.content.firstElementChild;
    },
    deepClone: (o) => JSON.parse(JSON.stringify(o)),
  };

  // Binary min-heap keyed by numeric priority (used by A*).
  class Heap {
    constructor() { this.items = []; this.prio = []; }
    get size() { return this.items.length; }
    push(item, p) {
      const it = this.items, pr = this.prio;
      let i = it.length; it.push(item); pr.push(p);
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (pr[parent] <= p) break;
        it[i] = it[parent]; pr[i] = pr[parent]; i = parent;
      }
      it[i] = item; pr[i] = p;
    }
    pop() {
      const it = this.items, pr = this.prio;
      const top = it[0];
      const lastI = it.pop(), lastP = pr.pop();
      if (it.length > 0) {
        let i = 0; const n = it.length;
        while (true) {
          let c = 2 * i + 1;
          if (c >= n) break;
          if (c + 1 < n && pr[c + 1] < pr[c]) c++;
          if (pr[c] >= lastP) break;
          it[i] = it[c]; pr[i] = pr[c]; i = c;
        }
        it[i] = lastI; pr[i] = lastP;
      }
      return top;
    }
  }
  U.Heap = Heap;

  RW.util = U;
})();
