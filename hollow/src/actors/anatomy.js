// Organic geometry helpers: tapered, muscled limb segments built with lathes and
// displaced by noise so characters read as sculpted bodies rather than primitives.
import * as THREE from 'three';
import { noise2, fbm } from '../core/util.js';

// A limb hanging along -Y from the origin (joint) with rounded caps.
export function limbGeo(len, r0, r1, { bulge = 0.15, seg = 12, rings = 10, noise = 0.0, bulgeAt = 0.4, flat = 1, ribs = 0, seed = 0 } = {}) {
  const pts = [];
  const capN = 4;
  for (let i = 0; i <= capN; i++) { const a = (i / capN) * Math.PI / 2; pts.push(new THREE.Vector2(Math.sin(a) * r0 + 0.0005, Math.cos(a) * r0 * 0.7)); }
  for (let i = 1; i < rings; i++) {
    const t = i / rings;
    const b = Math.exp(-Math.pow((t - bulgeAt) / 0.28, 2)) * bulge;
    let r = THREE.MathUtils.lerp(r0, r1, t) * (1 + b);
    if (ribs) r *= 1 + Math.max(0, Math.sin(t * Math.PI * ribs)) * 0.06;
    pts.push(new THREE.Vector2(r, -t * len));
  }
  for (let i = 0; i <= capN; i++) { const a = (i / capN) * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * r1 + 0.0005, -len - Math.sin(a) * r1 * 0.7)); }
  const g = new THREE.LatheGeometry(pts, seg);
  if (flat !== 1) g.scale(1, 1, flat);
  if (noise > 0) displace(g, noise, seed);
  g.computeVertexNormals();
  return g;
}

// Push vertices along their radial direction by fbm noise -> knotted, sinewy surface.
export function displace(g, amount, seed = 0, freq = 9) {
  const p = g.attributes.position; const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const rl = Math.hypot(v.x, v.z); if (rl < 1e-4) continue;
    const n = fbm(v.x * freq + v.y * 3 + seed, v.z * freq - v.y * 5 + seed * 2, 3) - 0.5;
    const k = 1 + n * amount / Math.max(rl, 0.02);
    p.setXYZ(i, v.x * k, v.y, v.z * k);
  }
  g.computeVertexNormals();
}

// Ellipsoid-ish blob (palms, heads of NPCs, muscles).
export function blob(rx, ry, rz, { seg = 14, noise = 0, seed = 0 } = {}) {
  const g = new THREE.SphereGeometry(1, seg, Math.max(8, seg * 0.7 | 0));
  g.scale(rx, ry, rz);
  if (noise) {
    const p = g.attributes.position; const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = fbm(v.x * 12 + seed, v.y * 12 + v.z * 7, 3) - 0.5; v.multiplyScalar(1 + n * noise); p.setXYZ(i, v.x, v.y, v.z); }
  }
  g.computeVertexNormals();
  return g;
}

// Curved horn / claw / spine: a cone bent along an arc.
export function hornGeo(len, r, bend = 0.5, seg = 7, rings = 8) {
  const g = new THREE.ConeGeometry(r, len, seg, rings, false);
  g.translate(0, len / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), t = y / len;
    p.setZ(i, p.getZ(i) + Math.pow(t, 2) * bend * len);
  }
  g.computeVertexNormals();
  return g;
}

// Torso lathe from a radius profile [[y, r], ...] with an elliptical cross-section.
export function torsoGeo(profile, { sx = 1, sz = 0.7, seg = 18, noise = 0, ribs = 0, ribRange = [0, 1], seed = 0 } = {}) {
  const pts = profile.map(([y, r]) => new THREE.Vector2(Math.max(r, 0.0005), y));
  const g = new THREE.LatheGeometry(pts, seg);
  g.scale(sx, 1, sz);
  const p = g.attributes.position; const v = new THREE.Vector3();
  const y0 = profile[0][0], y1 = profile[profile.length - 1][0];
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const t = (v.y - y0) / (y1 - y0);
    let k = 1;
    if (ribs && t > ribRange[0] && t < ribRange[1]) {
      const front = Math.max(0, -v.z) > 0 ? 1 : 0.4; // ribs show most on the sides/front
      k += Math.pow(Math.max(0, Math.sin(t * Math.PI * ribs)), 3) * 0.07 * front * (Math.abs(v.x) > 0.02 ? 1 : 0.5);
    }
    if (noise) k += (fbm(v.x * 8 + seed, v.y * 8 + v.z * 5, 3) - 0.5) * noise;
    p.setXYZ(i, v.x * k, v.y, v.z * k);
  }
  g.computeVertexNormals();
  return g;
}
