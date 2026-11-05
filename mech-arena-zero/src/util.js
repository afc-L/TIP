import * as THREE from 'three';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
export function wrapAngle(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
export function dampAngle(a, b, k, dt) { return a + wrapAngle(b - a) * (1 - Math.exp(-k * dt)); }
export const dist2D = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function fmtTime(s) { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
export function fmtNum(n) { return Math.round(n).toLocaleString(); }

/** Segment (p0 -> p1) vs sphere. Returns t in [0,1] of first intersection or -1. */
export function segSphere(p0, p1, c, r) {
  const dx = p1.x - p0.x, dy = p1.y - p0.y, dz = p1.z - p0.z;
  const fx = p0.x - c.x, fy = p0.y - c.y, fz = p0.z - c.z;
  const a = dx * dx + dy * dy + dz * dz;
  if (a < 1e-9) return (fx * fx + fy * fy + fz * fz <= r * r) ? 0 : -1;
  const b = 2 * (fx * dx + fy * dy + fz * dz);
  const cc = fx * fx + fy * fy + fz * fz - r * r;
  if (cc <= 0) return 0;
  const disc = b * b - 4 * a * cc;
  if (disc < 0) return -1;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : -1;
}

/** Segment vs AABB (slab). box: {minX,minY,minZ,maxX,maxY,maxZ}. Returns t or -1. */
export function segBox(p0, p1, b) {
  let tmin = 0, tmax = 1;
  const d = [p1.x - p0.x, p1.y - p0.y, p1.z - p0.z];
  const o = [p0.x, p0.y, p0.z];
  const mn = [b.minX, b.minY, b.minZ], mx = [b.maxX, b.maxY, b.maxZ];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < mn[i] || o[i] > mx[i]) return -1;
    } else {
      const inv = 1 / d[i];
      let t1 = (mn[i] - o[i]) * inv, t2 = (mx[i] - o[i]) * inv;
      if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return -1;
    }
  }
  return tmin;
}

export const tmpV = new THREE.Vector3();
export const tmpV2 = new THREE.Vector3();
export const tmpV3 = new THREE.Vector3();
export const UP = new THREE.Vector3(0, 1, 0);
