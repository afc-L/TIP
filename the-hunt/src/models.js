import * as THREE from 'three';
import { makeRng } from './util.js';

// Procedural low-poly models. Static props are merged into a single vertex-coloured
// geometry so each one costs one draw call (or one instance).

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

export function mat4(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  return new THREE.Matrix4().compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
}

/** Collects primitives with a colour each and merges them into one geometry. */
export class GeoBuilder {
  constructor() { this.parts = []; }
  add(geom, color, matrix, { jitter = 0, rng = null, shade = 0 } = {}) {
    let g = geom.index ? geom.toNonIndexed() : geom.clone();
    if (matrix) g.applyMatrix4(matrix);
    if (jitter && rng) {
      const p = g.attributes.position;
      // jitter by position hash so shared corners stay welded
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
        const f = h - Math.floor(h);
        const h2 = Math.sin(x * 93.9898 + y * 67.345 + z * 12.123) * 24634.6345;
        const f2 = h2 - Math.floor(h2);
        p.setXYZ(i, x + (f - 0.5) * jitter, y + (f2 - 0.5) * jitter * 0.6, z + (f2 - f) * jitter);
      }
    }
    g.computeVertexNormals();
    const c = new THREE.Color(color);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      // subtle per-vertex shade variation with height for depth
      const k = 1 + shade * (g.attributes.position.getY(i) * 0.05);
      col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    this.parts.push(g);
    return this;
  }
  build() {
    let total = 0;
    for (const p of this.parts) total += p.attributes.position.count;
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3), uv = new Float32Array(total * 2);
    let o = 0;
    for (const p of this.parts) {
      pos.set(p.attributes.position.array, o * 3);
      nor.set(p.attributes.normal.array, o * 3);
      col.set(p.attributes.color.array, o * 3);
      uv.set(p.attributes.uv.array, o * 2);
      o += p.attributes.position.count;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.computeBoundingSphere();
    return g;
  }
}

export const vcMat = new THREE.MeshLambertMaterial({ vertexColors: true });
export const vcMatFlat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
export const vcMatDouble = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });

// ---------------------------------------------------------------- vegetation

export function pineGeometry(seed) {
  const r = makeRng(seed);
  const b = new GeoBuilder();
  const h = 13 + r() * 5;
  b.add(new THREE.CylinderGeometry(0.11, 0.3, h, 6, 1), '#4e4034', mat4(0, h / 2, 0));
  const tiers = 5;
  const start = h * 0.42;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const rad = 2.5 - t * 1.7 + r() * 0.3;
    const ch = 3.2 - t * 0.8;
    const y = start + t * (h - start) + ch * 0.2;
    const col = new THREE.Color('#334a3a').lerp(new THREE.Color('#4a6048'), t * 0.6 + r() * 0.2);
    b.add(new THREE.ConeGeometry(rad, ch, 7, 1, true), col, mat4(r() * 0.3 - 0.15, y, r() * 0.3 - 0.15, 0, r() * 6, 0), { jitter: 0.5, rng: r });
  }
  return b.build();
}

export function spruceGeometry(seed) {
  const r = makeRng(seed);
  const b = new GeoBuilder();
  const h = 9 + r() * 4;
  b.add(new THREE.CylinderGeometry(0.1, 0.28, h * 0.35, 6), '#46382b', mat4(0, h * 0.175, 0));
  const tiers = 6;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const rad = 3.0 - t * 2.4;
    const ch = 3.0 - t * 1.2;
    const y = 1.6 + t * (h - 2.4) + ch / 2;
    const col = new THREE.Color('#2c4231').lerp(new THREE.Color('#465e44'), t * 0.7 + r() * 0.15);
    b.add(new THREE.ConeGeometry(rad, ch, 8, 1, true), col, mat4(0, y, 0, 0, r() * 6, 0), { jitter: 0.6, rng: r });
  }
  return b.build();
}

export function deadTreeGeometry(seed) {
  const r = makeRng(seed);
  const b = new GeoBuilder();
  const h = 8 + r() * 6;
  b.add(new THREE.CylinderGeometry(0.08, 0.32, h, 6), '#4a423a', mat4(0, h / 2, 0, r() * 0.06, 0, r() * 0.06));
  for (let i = 0; i < 6; i++) {
    const y = h * (0.35 + r() * 0.55);
    const len = 1.5 + r() * 2.5;
    const a = r() * Math.PI * 2;
    const tilt = 0.6 + r() * 0.6;
    const m = new THREE.Matrix4().makeRotationY(a).multiply(mat4(0, y, 0, 0, 0, tilt)).multiply(mat4(0, len / 2, 0));
    b.add(new THREE.CylinderGeometry(0.02, 0.08, len, 4), '#4d453c', m);
  }
  return b.build();
}

export function farTreeGeometry() {
  const b = new GeoBuilder();
  b.add(new THREE.CylinderGeometry(0.15, 0.25, 8, 4), '#33291f', mat4(0, 4, 0));
  b.add(new THREE.ConeGeometry(2.4, 10, 5, 1, true), '#283a2a', mat4(0, 10, 0));
  return b.build();
}

export function saplingGeometry(seed) {
  const r = makeRng(seed);
  const b = new GeoBuilder();
  const h = 1.2 + r() * 1.5;
  for (let i = 0; i < 3; i++) {
    const t = i / 2;
    b.add(new THREE.ConeGeometry(0.7 - t * 0.4, h * 0.5, 6, 1, true), new THREE.Color('#2c432c').lerp(new THREE.Color('#42593a'), t),
      mat4(0, h * 0.25 + t * h * 0.5, 0, 0, r() * 6, 0), { jitter: 0.2, rng: r });
  }
  return b.build();
}

export function bushGeometry(seed) {
  // low shrub: a few squat, jittered cones (juniper / young fir)
  const r = makeRng(seed);
  const b = new GeoBuilder();
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const h = 0.6 + r() * 0.7;
    const rad = 0.35 + r() * 0.3;
    b.add(new THREE.ConeGeometry(rad, h, 6, 1, false), new THREE.Color('#2c3f2a').lerp(new THREE.Color('#465a38'), r()),
      mat4(r() * 0.9 - 0.45, h * 0.42, r() * 0.9 - 0.45, r() * 0.3 - 0.15, r() * 6, r() * 0.3 - 0.15), { jitter: 0.18, rng: r });
  }
  return b.build();
}

export function rockGeometry(seed) {
  const r = makeRng(seed);
  const b = new GeoBuilder();
  b.add(new THREE.DodecahedronGeometry(1, 0), new THREE.Color('#4a4c4a').lerp(new THREE.Color('#5d5a52'), r()),
    mat4(0, 0.25, 0, r(), r(), r(), 1, 0.55 + r() * 0.3, 0.8 + r() * 0.4), { jitter: 0.35, rng: r });
  return b.build();
}

export function logGeometry(seed) {
  const r = makeRng(seed);
  const b = new GeoBuilder();
  const len = 3 + r() * 4;
  b.add(new THREE.CylinderGeometry(0.25, 0.3, len, 7), '#3e3328', mat4(0, 0.25, 0, 0, 0, Math.PI / 2), { jitter: 0.06, rng: r });
  b.add(new THREE.CylinderGeometry(0.03, 0.06, 1, 4), '#3e3328', mat4(len * 0.2, 0.6, 0.1, 0.4, 0, 0.3));
  return b.build();
}

/** Solid low-poly fern: curved fronds made of leaflet triangles (no alpha textures). */
export function fernGeometry() {
  const r = makeRng(21);
  const pos = [], col = [];
  const c1 = new THREE.Color('#3f5a30'), c2 = new THREE.Color('#5a7a3c');
  const fronds = 6;
  for (let f = 0; f < fronds; f++) {
    const a = (f / fronds) * Math.PI * 2 + r() * 0.4;
    const ca = Math.cos(a), sa = Math.sin(a);
    const len = 0.8 + r() * 0.4;
    const P = (t) => {
      // arching stem: rises then droops
      const d = t * len;
      return [d, Math.sin(t * Math.PI * 0.75) * 0.45 * len, 0];
    };
    const seg = 7;
    for (let i = 0; i < seg; i++) {
      const t0 = i / seg, t1 = (i + 1) / seg;
      const p0 = P(t0), p1 = P(t1);
      const w = (1 - t0) * 0.22 + 0.03;
      const cc = c1.clone().lerp(c2, t0 + r() * 0.2);
      for (const side of [-1, 1]) {
        const tip = [ (p0[0] + p1[0]) / 2 + 0.02, (p0[1] + p1[1]) / 2 - 0.05, side * w ];
        for (const v of [p0, side > 0 ? p1 : tip, side > 0 ? tip : p1]) {
          // rotate around Y by frond angle
          pos.push(v[0] * ca + v[2] * sa, v[1], -v[0] * sa + v[2] * ca);
          col.push(cc.r, cc.g, cc.b);
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  // ferns are lit mostly from above: bias normals upward for a soft look
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) {
    const x = n.getX(i) * 0.4, y = Math.abs(n.getY(i)) + 0.6, z = n.getZ(i) * 0.4;
    const l = Math.hypot(x, y, z) || 1;
    n.setXYZ(i, x / l, y / l, z / l);
  }
  return g;
}

// ---------------------------------------------------------------- props

export function totemGeometry(seed, scale = 1) {
  // Stick figures lashed together with twine: the forest's warning signs.
  const r = makeRng(seed);
  const b = new GeoBuilder();
  const bone = '#cfc6b0';
  const stick = (x1, y1, x2, y2, th = 0.035) => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const ang = Math.atan2(x2 - x1, y2 - y1);
    b.add(new THREE.CylinderGeometry(th * 0.7, th, len, 4), bone, mat4((x1 + x2) / 2 * scale, (y1 + y2) / 2 * scale, 0, 0, 0, -ang, scale));
  };
  stick(0, 0, 0, 1.4, 0.045); // spine
  stick(-0.6, 1.0, 0.6, 1.1); // arms
  stick(-0.45, 0.0, 0.35, 0.75); // X legs
  stick(0.45, 0.0, -0.35, 0.75);
  stick(-0.2, 1.4, 0.25, 1.75); // antler-ish head
  stick(0.2, 1.4, -0.25, 1.8);
  if (r() < 0.6) stick(-0.6, 1.0, -0.75, 1.5);
  // twine knots / rag
  b.add(new THREE.BoxGeometry(0.12, 0.12, 0.12), '#7a6a50', mat4(0, 1.05 * scale, 0, 0, 0.6, 0, scale));
  b.add(new THREE.PlaneGeometry(0.25, 0.45), '#8f8a78', mat4(0.15 * scale, 0.8 * scale, 0.02, 0, 0, 0.2, scale));
  return b.build();
}

export function tentGeometry({ torn = false, color = '#5b6b45' } = {}) {
  const b = new GeoBuilder();
  const w = 2.2, l = 2.6, h = 1.5;
  const side = new THREE.PlaneGeometry(l, Math.hypot(w / 2, h));
  const ang = Math.atan2(w / 2, h);
  b.add(side, color, mat4(0, h / 2, -w / 4, -(Math.PI / 2 - ang) + Math.PI / 2 - ang * 2 + ang, 0, 0));
  // simpler: two tilted planes forming an A-frame
  b.parts.pop();
  const s1 = mat4(0, h / 2, w / 4, ang, 0, 0);
  const s2 = mat4(0, h / 2, -w / 4, -ang, 0, 0);
  b.add(side, color, s1);
  if (!torn) b.add(side, color, s2);
  else b.add(new THREE.PlaneGeometry(l * 0.6, Math.hypot(w / 2, h) * 0.7), color, mat4(-0.4, h * 0.3, -w / 4 - 0.1, -ang * 0.4, 0.2, 0.3));
  // end triangles
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.Float32BufferAttribute([0, h, 0, -w / 2, 0, 0, w / 2, 0, 0], 3));
  b.add(tri, color, mat4(-l / 2, 0, 0, 0, Math.PI / 2, 0));
  if (!torn) b.add(tri, color, mat4(l / 2, 0, 0, 0, Math.PI / 2, 0, 1, 1, 1));
  // poles
  b.add(new THREE.CylinderGeometry(0.02, 0.02, h + 0.1, 4), '#777', mat4(-l / 2, h / 2, 0));
  b.add(new THREE.CylinderGeometry(0.02, 0.02, h + 0.1, 4), '#777', mat4(l / 2, h / 2, 0, torn ? 0.5 : 0, 0, 0));
  return b.build();
}

export function campfireGeometry() {
  const b = new GeoBuilder();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    b.add(new THREE.DodecahedronGeometry(0.16, 0), '#555350', mat4(Math.cos(a) * 0.55, 0.08, Math.sin(a) * 0.55, a, a, 0));
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    b.add(new THREE.CylinderGeometry(0.05, 0.06, 0.8, 5), '#2a2018', mat4(Math.cos(a) * 0.15, 0.2, Math.sin(a) * 0.15, Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1));
  }
  b.add(new THREE.CircleGeometry(0.45, 8), '#1a1714', mat4(0, 0.02, 0, -Math.PI / 2, 0, 0));
  return b.build();
}

export function truckGeometry() {
  const b = new GeoBuilder();
  const body = '#5a3f2a', dark = '#151515';
  b.add(new THREE.BoxGeometry(2.0, 0.7, 5.0), body, mat4(0, 0.95, 0));
  b.add(new THREE.BoxGeometry(1.9, 0.9, 1.7), body, mat4(0, 1.75, -0.6));
  b.add(new THREE.BoxGeometry(1.8, 0.6, 0.05), '#223038', mat4(0, 1.85, -1.46, -0.25, 0, 0)); // windshield
  b.add(new THREE.BoxGeometry(1.95, 0.5, 2.3), body, mat4(0, 1.45, 1.35)); // bed sides (approx)
  b.add(new THREE.BoxGeometry(1.7, 0.45, 2.1), '#1c1612', mat4(0, 1.55, 1.35));
  b.add(new THREE.BoxGeometry(2.05, 0.25, 0.3), '#888', mat4(0, 0.7, -2.55));
  b.add(new THREE.BoxGeometry(0.3, 0.15, 0.05), '#ddd8b0', mat4(-0.7, 1.1, -2.52));
  b.add(new THREE.BoxGeometry(0.3, 0.15, 0.05), '#ddd8b0', mat4(0.7, 1.1, -2.52));
  for (const [x, z] of [[-1, -1.6], [1, -1.6], [-1, 1.6], [1, 1.6]]) {
    b.add(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10), dark, mat4(x, 0.42, z, 0, 0, Math.PI / 2));
  }
  return b.build();
}

export function crateGeometry(color = '#6a5236') {
  const b = new GeoBuilder();
  b.add(new THREE.BoxGeometry(0.8, 0.55, 0.55), color, mat4(0, 0.275, 0));
  b.add(new THREE.BoxGeometry(0.84, 0.06, 0.58), '#3e2f1e', mat4(0, 0.55, 0));
  return b.build();
}

export function boneGeometry(seed) {
  const r = makeRng(seed);
  const b = new GeoBuilder();
  for (let i = 0; i < 5; i++) {
    b.add(new THREE.CylinderGeometry(0.025, 0.03, 0.35 + r() * 0.3, 4), '#d6cfbd', mat4(r() * 0.8 - 0.4, 0.04, r() * 0.8 - 0.4, Math.PI / 2, r() * 6, 0));
  }
  // rib cage-ish arcs
  for (let i = 0; i < 4; i++) {
    b.add(new THREE.TorusGeometry(0.22, 0.02, 3, 8, Math.PI), '#d6cfbd', mat4(0.1 + i * 0.09, 0.05, 0.3, 0, Math.PI / 2, 0));
  }
  b.add(new THREE.DodecahedronGeometry(0.11, 0), '#e0d9c6', mat4(-0.4, 0.09, 0.2, 0, 0, 0, 1, 0.8, 1.3));
  return b.build();
}

// ---------------------------------------------------------------- items

export function itemMesh(type) {
  const b = new GeoBuilder();
  switch (type) {
    case 'ammo':
      b.add(new THREE.BoxGeometry(0.22, 0.12, 0.14), '#8a2b1c', mat4(0, 0.06, 0));
      b.add(new THREE.BoxGeometry(0.23, 0.04, 0.15), '#d8c27a', mat4(0, 0.08, 0));
      break;
    case 'battery':
      b.add(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 8), '#c8a028', mat4(-0.04, 0.03, 0, Math.PI / 2, 0, 0));
      b.add(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 8), '#1d1d1d', mat4(0.04, 0.03, 0, Math.PI / 2, 0, 0));
      b.add(new THREE.BoxGeometry(0.18, 0.02, 0.16), '#c8c8c8', mat4(0, 0.005, 0));
      break;
    case 'food':
      b.add(new THREE.CylinderGeometry(0.05, 0.05, 0.11, 10), '#9c9d9a', mat4(0, 0.055, 0));
      b.add(new THREE.CylinderGeometry(0.051, 0.051, 0.07, 10), '#b04a2a', mat4(0, 0.055, 0));
      b.add(new THREE.BoxGeometry(0.14, 0.03, 0.09), '#6b4a2a', mat4(0.13, 0.015, 0.03, 0, 0.4, 0));
      break;
    case 'medkit':
      b.add(new THREE.BoxGeometry(0.3, 0.12, 0.2), '#b8b2a8', mat4(0, 0.06, 0));
      b.add(new THREE.BoxGeometry(0.1, 0.125, 0.03), '#b0201a', mat4(0, 0.061, 0));
      b.add(new THREE.BoxGeometry(0.03, 0.125, 0.1), '#b0201a', mat4(0, 0.061, 0));
      break;
    case 'note':
    case 'document':
      b.add(new THREE.BoxGeometry(0.22, 0.005, 0.3), '#e4dccb', mat4(0, 0.005, 0, 0, 0.3, 0));
      if (type === 'document') b.add(new THREE.BoxGeometry(0.24, 0.02, 0.32), '#7a6a4a', mat4(0, 0.0, 0, 0, 0.3, 0));
      break;
    case 'radio':
      b.add(new THREE.BoxGeometry(0.08, 0.2, 0.05), '#2b2e2a', mat4(0, 0.1, 0));
      b.add(new THREE.CylinderGeometry(0.008, 0.008, 0.18, 4), '#111', mat4(0.025, 0.28, 0));
      break;
    case 'jerrycan':
      b.add(new THREE.BoxGeometry(0.35, 0.45, 0.16), '#7a1d14', mat4(0, 0.225, 0));
      b.add(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 6), '#222', mat4(0.12, 0.48, 0));
      break;
    case 'kerosene':
      b.add(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 10), '#3a5a72', mat4(0, 0.15, 0));
      b.add(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 6), '#ddd', mat4(0, 0.33, 0));
      break;
    case 'key':
      b.add(new THREE.TorusGeometry(0.03, 0.008, 4, 8), '#c9a93e', mat4(0, 0.01, 0, Math.PI / 2, 0, 0));
      b.add(new THREE.BoxGeometry(0.09, 0.008, 0.015), '#c9a93e', mat4(0.07, 0.01, 0));
      b.add(new THREE.BoxGeometry(0.2, 0.01, 0.06), '#8a6a3a', mat4(0.06, 0.0, 0.06)); // tag
      break;
    case 'gear': // abandoned hunting gear: backpack + spent shells
      b.add(new THREE.BoxGeometry(0.45, 0.55, 0.28), '#4a5236', mat4(0, 0.25, 0, 0.2, 0.3, 0.1));
      b.add(new THREE.BoxGeometry(0.4, 0.2, 0.08), '#3d442c', mat4(0, 0.2, 0.18, 0.2, 0.3, 0.1));
      for (let i = 0; i < 3; i++) b.add(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 5), '#b03020', mat4(0.4 + i * 0.07, 0.01, 0.2 - i * 0.05, Math.PI / 2, i, 0));
      break;
    case 'recorder':
      b.add(new THREE.BoxGeometry(0.16, 0.05, 0.1), '#3a3530', mat4(0, 0.025, 0));
      b.add(new THREE.BoxGeometry(0.08, 0.01, 0.05), '#111', mat4(-0.02, 0.052, 0));
      break;
    default:
      b.add(new THREE.BoxGeometry(0.2, 0.2, 0.2), '#888', mat4(0, 0.1, 0));
  }
  const mesh = new THREE.Mesh(b.build(), vcMat);
  return mesh;
}

// ---------------------------------------------------------------- animals

function part(geom, mat, x, y, z) {
  const m = new THREE.Mesh(geom, mat);
  m.position.set(x, y, z);
  return m;
}

/** Deer with pivoting legs, neck and head. Buck has antlers. */
export function makeDeer(buck) {
  const coat = new THREE.MeshLambertMaterial({ color: buck ? 0x6e5236 : 0x80603f, flatShading: true });
  const dark = new THREE.MeshLambertMaterial({ color: 0x3a2a1c, flatShading: true });
  const pale = new THREE.MeshLambertMaterial({ color: 0xd9cdb6, flatShading: true });
  const g = new THREE.Group();
  const s = buck ? 1.12 : 1;
  const root = new THREE.Group();
  root.scale.setScalar(s);
  g.add(root);
  const body = new THREE.Group();
  body.position.y = 1.0;
  root.add(body);
  const torso = part(new THREE.CapsuleGeometry(0.28, 0.85, 3, 7), coat, 0, 0, 0);
  torso.rotation.x = Math.PI / 2;
  torso.scale.set(1, 1, 1.15);
  body.add(torso);
  const belly = part(new THREE.SphereGeometry(0.22, 6, 4), pale, 0, -0.14, 0.05);
  belly.scale.set(1, 0.6, 2.4);
  body.add(belly);
  const tail = part(new THREE.ConeGeometry(0.07, 0.2, 5), pale, 0, 0.12, 0.72);
  tail.rotation.x = -2.4;
  body.add(tail);
  const neck = new THREE.Group();
  neck.position.set(0, 0.15, -0.55);
  body.add(neck);
  const neckMesh = part(new THREE.CylinderGeometry(0.1, 0.16, 0.6, 6), coat, 0, 0.25, -0.08);
  neckMesh.rotation.x = -0.45;
  neck.add(neckMesh);
  const head = new THREE.Group();
  head.position.set(0, 0.55, -0.22);
  neck.add(head);
  const skull = part(new THREE.ConeGeometry(0.11, 0.42, 6), coat, 0, 0, -0.14);
  skull.rotation.x = -Math.PI / 2;
  head.add(skull);
  const nose = part(new THREE.SphereGeometry(0.045, 5, 4), dark, 0, -0.02, -0.35);
  head.add(nose);
  for (const sx of [-1, 1]) {
    const ear = part(new THREE.ConeGeometry(0.05, 0.18, 4), coat, sx * 0.09, 0.12, 0.03);
    ear.rotation.z = -sx * 0.9;
    head.add(ear);
    const eye = part(new THREE.SphereGeometry(0.022, 4, 3), dark, sx * 0.075, 0.03, -0.1);
    head.add(eye);
    if (buck) {
      const ant = new THREE.Group();
      ant.position.set(sx * 0.06, 0.1, 0);
      head.add(ant);
      const main = part(new THREE.CylinderGeometry(0.012, 0.022, 0.5, 4), pale, sx * 0.12, 0.2, 0.05);
      main.rotation.z = -sx * 0.55;
      ant.add(main);
      for (let i = 0; i < 3; i++) {
        const tine = part(new THREE.CylinderGeometry(0.008, 0.014, 0.2, 4), pale, sx * (0.1 + i * 0.07), 0.15 + i * 0.1, -0.03);
        tine.rotation.x = -0.5;
        ant.add(tine);
      }
    }
  }
  const legs = [];
  for (const [x, z, front] of [[-0.15, -0.42, true], [0.15, -0.42, true], [-0.15, 0.45, false], [0.15, 0.45, false]]) {
    const hip = new THREE.Group();
    hip.position.set(x, -0.05, z);
    body.add(hip);
    const upper = part(new THREE.CylinderGeometry(0.05, 0.08, 0.5, 5), coat, 0, -0.25, 0);
    hip.add(upper);
    const knee = new THREE.Group();
    knee.position.y = -0.5;
    hip.add(knee);
    const lower = part(new THREE.CylinderGeometry(0.025, 0.04, 0.48, 4), dark, 0, -0.24, 0);
    knee.add(lower);
    legs.push({ hip, knee, front });
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, root, body, neck, head, legs };
}

export function makeRabbit() {
  const fur = new THREE.MeshLambertMaterial({ color: 0x7d6e5c, flatShading: true });
  const pale = new THREE.MeshLambertMaterial({ color: 0xcfc4b0, flatShading: true });
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const torso = part(new THREE.SphereGeometry(0.14, 6, 5), fur, 0, 0.14, 0);
  torso.scale.set(0.9, 0.85, 1.4);
  body.add(torso);
  const head = part(new THREE.SphereGeometry(0.08, 6, 5), fur, 0, 0.24, -0.17);
  body.add(head);
  for (const sx of [-1, 1]) {
    const ear = part(new THREE.CapsuleGeometry(0.018, 0.12, 2, 4), fur, sx * 0.03, 0.36, -0.15);
    ear.rotation.z = sx * 0.2;
    body.add(ear);
  }
  body.add(part(new THREE.SphereGeometry(0.04, 5, 4), pale, 0, 0.17, 0.2));
  return { group: g, body };
}

export function makeCrow() {
  const mat = new THREE.MeshLambertMaterial({ color: 0x111214, side: THREE.DoubleSide, flatShading: true });
  const g = new THREE.Group();
  const body = part(new THREE.ConeGeometry(0.07, 0.35, 5), mat, 0, 0, 0);
  body.rotation.x = Math.PI / 2;
  g.add(body);
  const wings = [];
  for (const sx of [-1, 1]) {
    const w = new THREE.Group();
    g.add(w);
    const shape = new THREE.BufferGeometry();
    shape.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.08, sx * 0.4, 0, 0.02, 0, 0, 0.12], 3));
    shape.computeVertexNormals();
    w.add(new THREE.Mesh(shape, mat));
    wings.push(w);
  }
  return { group: g, wings };
}

// ---------------------------------------------------------------- the creature

/**
 * The Keeper: very tall, emaciated, limbs too long, a crown of branches.
 * Built from pivots so it can stand unnaturally still, walk, crouch or reach.
 */
export function makeCreature() {
  const skin = new THREE.MeshLambertMaterial({ color: 0x2e2924, flatShading: true });
  const bark = new THREE.MeshLambertMaterial({ color: 0x3a3026, flatShading: true });
  const g = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 1.75;
  g.add(hips);
  const pelvis = part(new THREE.BoxGeometry(0.34, 0.2, 0.2), skin, 0, 0, 0);
  hips.add(pelvis);
  const spine = new THREE.Group();
  hips.add(spine);
  const torso = part(new THREE.CylinderGeometry(0.2, 0.12, 0.95, 6), skin, 0, 0.5, 0);
  torso.scale.z = 0.6;
  spine.add(torso);
  // ribs
  for (let i = 0; i < 4; i++) {
    const rib = part(new THREE.TorusGeometry(0.16 - i * 0.012, 0.016, 3, 8, Math.PI), bark, 0, 0.55 + i * 0.1, -0.02);
    rib.rotation.x = Math.PI / 2;
    rib.rotation.z = Math.PI;
    rib.scale.y = 0.6;
    spine.add(rib);
  }
  const neck = new THREE.Group();
  neck.position.y = 1.0;
  spine.add(neck);
  neck.add(part(new THREE.CylinderGeometry(0.04, 0.06, 0.3, 5), skin, 0, 0.15, 0));
  const head = new THREE.Group();
  head.position.y = 0.32;
  neck.add(head);
  const skull = part(new THREE.SphereGeometry(0.13, 6, 5), skin, 0, 0.08, 0);
  skull.scale.set(0.85, 1.35, 0.95);
  head.add(skull);
  const jaw = part(new THREE.ConeGeometry(0.08, 0.2, 5), skin, 0, -0.05, -0.03);
  jaw.rotation.x = Math.PI;
  head.add(jaw);
  // branch crown
  const r = makeRng(77);
  for (let i = 0; i < 7; i++) {
    const side = i % 2 ? 1 : -1;
    const len = 0.4 + r() * 0.6;
    const br = part(new THREE.CylinderGeometry(0.008, 0.025, len, 4), bark, side * (0.05 + r() * 0.05), 0.2 + len / 2, r() * 0.08 - 0.04);
    br.rotation.z = -side * (0.25 + r() * 0.6);
    br.rotation.x = r() * 0.4 - 0.2;
    head.add(br);
    if (r() < 0.7) {
      const tw = part(new THREE.CylinderGeometry(0.005, 0.012, len * 0.5, 3), bark, side * (0.15 + r() * 0.15), 0.3 + len * 0.6, 0);
      tw.rotation.z = side * 0.5;
      head.add(tw);
    }
  }
  // pale pinprick eyes (additive sprites, see creature.js)
  const eyes = new THREE.Group();
  eyes.position.set(0, 0.1, -0.12);
  head.add(eyes);

  const arms = [];
  for (const sx of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(sx * 0.22, 0.92, 0);
    spine.add(shoulder);
    shoulder.add(part(new THREE.CylinderGeometry(0.035, 0.05, 0.85, 5), skin, 0, -0.42, 0));
    const elbow = new THREE.Group();
    elbow.position.y = -0.85;
    shoulder.add(elbow);
    elbow.add(part(new THREE.CylinderGeometry(0.025, 0.035, 0.85, 5), skin, 0, -0.42, 0));
    const hand = new THREE.Group();
    hand.position.y = -0.86;
    elbow.add(hand);
    for (let f = 0; f < 4; f++) {
      const fin = part(new THREE.CylinderGeometry(0.004, 0.012, 0.32, 3), skin, (f - 1.5) * 0.025, -0.15, 0);
      fin.rotation.z = (f - 1.5) * 0.12;
      hand.add(fin);
    }
    arms.push({ shoulder, elbow, hand, sx });
  }
  const legs = [];
  for (const sx of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(sx * 0.12, -0.05, 0);
    hips.add(hip);
    hip.add(part(new THREE.CylinderGeometry(0.045, 0.07, 0.9, 5), skin, 0, -0.45, 0));
    const knee = new THREE.Group();
    knee.position.y = -0.9;
    hip.add(knee);
    knee.add(part(new THREE.CylinderGeometry(0.03, 0.045, 0.85, 5), skin, 0, -0.42, 0));
    const foot = part(new THREE.BoxGeometry(0.08, 0.04, 0.26), skin, 0, -0.86, -0.06);
    knee.add(foot);
    legs.push({ hip, knee, sx });
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.material = o.material; } });
  return { group: g, hips, spine, neck, head, eyes, arms, legs, materials: [skin, bark] };
}

// ---------------------------------------------------------------- viewmodels

export function makeRifle() {
  const b = new GeoBuilder();
  const wood = '#6e4a30', metal = '#34373b', metal2 = '#44474c';
  // stock
  b.add(new THREE.BoxGeometry(0.05, 0.11, 0.34), wood, mat4(0, -0.03, 0.28, 0.12, 0, 0));
  b.add(new THREE.BoxGeometry(0.045, 0.07, 0.3), wood, mat4(0, 0.0, -0.02));
  b.add(new THREE.BoxGeometry(0.048, 0.06, 0.32), wood, mat4(0, -0.005, -0.32)); // forend
  // receiver + barrel
  b.add(new THREE.BoxGeometry(0.042, 0.05, 0.22), metal2, mat4(0, 0.045, -0.06));
  b.add(new THREE.CylinderGeometry(0.011, 0.014, 0.62, 8), metal, mat4(0, 0.045, -0.48, Math.PI / 2, 0, 0));
  // bolt handle
  b.add(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 5), metal, mat4(0.04, 0.05, 0.02, 0, 0, Math.PI / 2));
  b.add(new THREE.SphereGeometry(0.012, 5, 4), metal, mat4(0.075, 0.05, 0.02));
  // scope
  b.add(new THREE.CylinderGeometry(0.019, 0.019, 0.26, 10), metal, mat4(0, 0.1, -0.08, Math.PI / 2, 0, 0));
  b.add(new THREE.CylinderGeometry(0.026, 0.019, 0.06, 10), metal, mat4(0, 0.1, -0.23, Math.PI / 2, 0, 0));
  b.add(new THREE.CylinderGeometry(0.024, 0.019, 0.05, 10), metal, mat4(0, 0.1, 0.06, Math.PI / 2, 0, 0));
  b.add(new THREE.BoxGeometry(0.012, 0.04, 0.012), metal, mat4(0, 0.075, -0.15));
  b.add(new THREE.BoxGeometry(0.012, 0.04, 0.012), metal, mat4(0, 0.075, -0.02));
  // trigger guard
  b.add(new THREE.TorusGeometry(0.025, 0.004, 3, 8, Math.PI), metal, mat4(0, -0.04, 0.04, 0, Math.PI / 2, Math.PI));
  // taped flashlight under the barrel
  b.add(new THREE.CylinderGeometry(0.016, 0.016, 0.13, 8), '#222', mat4(0.03, 0.01, -0.36, Math.PI / 2, 0, 0));
  b.add(new THREE.CylinderGeometry(0.021, 0.016, 0.03, 8), '#333', mat4(0.03, 0.01, -0.44, Math.PI / 2, 0, 0));
  b.add(new THREE.BoxGeometry(0.05, 0.05, 0.02), '#6a6a5a', mat4(0.02, 0.02, -0.34));
  const rifle = new THREE.Mesh(b.build(), vcMat);
  return rifle;
}

export function makeHands() {
  // gloved hands with short cuffs, positioned for a rifle hold
  const b = new GeoBuilder();
  const cuff = '#5d6650', glove = '#4a4036';
  b.add(new THREE.BoxGeometry(0.055, 0.075, 0.095), glove, mat4(0.012, -0.04, 0.06, 0.3, 0, 0));
  b.add(new THREE.CylinderGeometry(0.036, 0.04, 0.12, 7), cuff, mat4(0.03, -0.085, 0.15, 1.25, 0, 0.15));
  b.add(new THREE.BoxGeometry(0.065, 0.045, 0.1), glove, mat4(-0.008, -0.042, -0.3, 0, 0, 0.2));
  b.add(new THREE.CylinderGeometry(0.036, 0.04, 0.12, 7), cuff, mat4(-0.04, -0.08, -0.22, 1.1, 0, -0.45));
  return new THREE.Mesh(b.build(), vcMat);
}

export function makeBinoculars() {
  const b = new GeoBuilder();
  for (const sx of [-1, 1]) {
    b.add(new THREE.CylinderGeometry(0.03, 0.034, 0.14, 10), '#1f2120', mat4(sx * 0.04, 0, 0, Math.PI / 2, 0, 0));
    b.add(new THREE.CylinderGeometry(0.036, 0.036, 0.03, 10), '#2e302d', mat4(sx * 0.04, 0, -0.07, Math.PI / 2, 0, 0));
    b.add(new THREE.BoxGeometry(0.06, 0.07, 0.1), '#2a241e', mat4(sx * 0.07, -0.05, 0.03)); // gloves
  }
  b.add(new THREE.BoxGeometry(0.03, 0.02, 0.06), '#111', mat4(0, 0.02, 0));
  return new THREE.Mesh(b.build(), vcMat);
}

export function makeHandRadio() {
  const b = new GeoBuilder();
  b.add(new THREE.BoxGeometry(0.055, 0.12, 0.03), '#4a5038', mat4(0, 0, 0));
  b.add(new THREE.BoxGeometry(0.04, 0.03, 0.004), '#9adf70', mat4(0, 0.03, -0.016));
  b.add(new THREE.BoxGeometry(0.04, 0.03, 0.004), '#2a2e24', mat4(0, -0.02, -0.016));
  b.add(new THREE.CylinderGeometry(0.004, 0.005, 0.12, 4), '#1a1a1a', mat4(0.017, 0.115, 0));
  b.add(new THREE.BoxGeometry(0.065, 0.075, 0.055), '#4a4036', mat4(0.008, -0.045, 0.02)); // glove
  b.add(new THREE.CylinderGeometry(0.04, 0.045, 0.3, 7), '#5d6650', mat4(0.05, -0.13, 0.17, 1.2, 0, 0.3));
  const m = new THREE.Mesh(b.build(), vcMat);
  return m;
}
