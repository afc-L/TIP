// OPERATION: IRON FRONT — core utilities. Everything hangs off the global IF namespace
// so the game runs from plain <script> tags (works from file:// on a school laptop).
(function (G) {
  'use strict';
  const IF = (G.IF = G.IF || {});

  const U = (IF.U = {});

  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.smooth = (t) => t * t * (3 - 2 * t);
  U.dist2 = (ax, az, bx, bz) => { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; };
  U.dist = (ax, az, bx, bz) => Math.sqrt(U.dist2(ax, az, bx, bz));
  U.angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
  U.wrapAng = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  U.turnTo = (cur, target, maxStep) => { const d = U.angDiff(cur, target); return Math.abs(d) <= maxStep ? target : U.wrapAng(cur + Math.sign(d) * maxStep); };
  // yaw convention: yaw 0 faces -Z (north); dir = (sin(yaw)*-1?) -> we use dx = -sin(yaw), dz = -cos(yaw)
  U.yawTo = (fx, fz, tx, tz) => Math.atan2(-(tx - fx), -(tz - fz));
  U.dirX = (yaw) => -Math.sin(yaw);
  U.dirZ = (yaw) => -Math.cos(yaw);

  // Seeded RNG (mulberry32)
  U.makeRng = function (seed) {
    let s = seed >>> 0;
    const r = function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.range = (a, b) => a + (b - a) * r();
    r.int = (a, b) => Math.floor(a + (b - a + 1) * r());
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    r.chance = (p) => r() < p;
    r.shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; };
    return r;
  };
  // global gameplay rng (not seeded for map gen)
  U.rand = Math.random;
  U.rr = (a, b) => a + (b - a) * Math.random();
  U.ri = (a, b) => Math.floor(a + (b - a + 1) * Math.random());
  U.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  U.gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 1.15;

  // Value noise with fBm (seeded)
  U.makeNoise = function (seed) {
    const rng = U.makeRng(seed);
    const P = new Uint8Array(512), V = new Float32Array(256);
    for (let i = 0; i < 256; i++) { P[i] = i; V[i] = rng() * 2 - 1; }
    for (let i = 255; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = P[i]; P[i] = P[j]; P[j] = t; }
    for (let i = 0; i < 256; i++) P[i + 256] = P[i];
    const val = (ix, iz) => V[P[(ix & 255) + P[iz & 255]]];
    const n2 = function (x, z) {
      const ix = Math.floor(x), iz = Math.floor(z);
      const fx = x - ix, fz = z - iz;
      const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
      const a = val(ix, iz), b = val(ix + 1, iz), c = val(ix, iz + 1), d = val(ix + 1, iz + 1);
      return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
    };
    n2.fbm = function (x, z, oct) {
      let s = 0, amp = 0.5, f = 1, norm = 0;
      for (let o = 0; o < oct; o++) { s += amp * n2(x * f, z * f); norm += amp; amp *= 0.5; f *= 2.03; }
      return s / norm;
    };
    n2.ridge = function (x, z, oct) {
      let s = 0, amp = 0.5, f = 1, norm = 0;
      for (let o = 0; o < oct; o++) { s += amp * (1 - Math.abs(n2(x * f, z * f))); norm += amp; amp *= 0.5; f *= 2.03; }
      return s / norm;
    };
    return n2;
  };

  // distance from point to segment, also returns t via out
  U.segDist = function (px, pz, ax, az, bx, bz, out) {
    const dx = bx - ax, dz = bz - az;
    const l2 = dx * dx + dz * dz || 1e-6;
    let t = ((px - ax) * dx + (pz - az) * dz) / l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = ax + dx * t, cz = az + dz * t;
    if (out) { out.t = t; out.x = cx; out.z = cz; }
    return Math.sqrt((px - cx) * (px - cx) + (pz - cz) * (pz - cz));
  };
  U.polyDist = function (px, pz, pts, out) {
    let best = 1e9, tmp = { t: 0, x: 0, z: 0 };
    for (let i = 0; i < pts.length - 1; i++) {
      const d = U.segDist(px, pz, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], tmp);
      if (d < best) { best = d; if (out) { out.x = tmp.x; out.z = tmp.z; out.seg = i; out.t = tmp.t; } }
    }
    return best;
  };
  // segments intersect (2D)
  U.segX = function (ax, az, bx, bz, cx, cz, dx, dz) {
    const d1x = bx - ax, d1z = bz - az, d2x = dx - cx, d2z = dz - cz;
    const den = d1x * d2z - d1z * d2x;
    if (Math.abs(den) < 1e-9) return -1;
    const t = ((cx - ax) * d2z - (cz - az) * d2x) / den;
    const u = ((cx - ax) * d1z - (cz - az) * d1x) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : -1;
  };

  U.fmtTime = (s) => { s = Math.max(0, Math.floor(s)); const m = Math.floor(s / 60); return m + ':' + String(s % 60).padStart(2, '0'); };
  U.now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  // Tiny event bus for decoupling sim from presentation
  const handlers = {};
  IF.on = (ev, fn) => { (handlers[ev] = handlers[ev] || []).push(fn); };
  IF.emit = (ev, a, b, c, d) => { const h = handlers[ev]; if (h) for (let i = 0; i < h.length; i++) h[i](a, b, c, d); };
  IF.offAll = () => { for (const k in handlers) delete handlers[k]; };
})(typeof window !== 'undefined' ? window : globalThis);
