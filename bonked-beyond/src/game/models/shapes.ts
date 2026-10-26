// Geometry helpers for building chunky low-poly models out of primitives.
import * as THREE from 'three';

export type V3 = [number, number, number];

export interface Xform { p?: V3; r?: V3; s?: V3 | number }

export function xf<T extends THREE.BufferGeometry>(g: T, t: Xform): T {
  const m = new THREE.Matrix4();
  const s = typeof t.s === 'number' ? [t.s, t.s, t.s] : t.s ?? [1, 1, 1];
  m.compose(
    new THREE.Vector3(...(t.p ?? [0, 0, 0])),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...(t.r ?? [0, 0, 0]))),
    new THREE.Vector3(...(s as V3)),
  );
  g.applyMatrix4(m);
  return g;
}

export const sphere = (r: number, t: Xform = {}, detail = 1) => xf(new THREE.IcosahedronGeometry(r, detail), t);
export const box = (w: number, h: number, d: number, t: Xform = {}) => xf(new THREE.BoxGeometry(w, h, d), t);
export const cyl = (rt: number, rb: number, h: number, t: Xform = {}, seg = 8) => xf(new THREE.CylinderGeometry(rt, rb, h, seg), t);
export const cone = (r: number, h: number, t: Xform = {}, seg = 8) => xf(new THREE.ConeGeometry(r, h, seg), t);
export const capsule = (r: number, len: number, t: Xform = {}) => xf(new THREE.CapsuleGeometry(r, len, 3, 8), t);
export const torus = (r: number, tube: number, t: Xform = {}) => xf(new THREE.TorusGeometry(r, tube, 6, 16), t);
export const dodeca = (r: number, t: Xform = {}) => xf(new THREE.DodecahedronGeometry(r, 0), t);
export const octa = (r: number, t: Xform = {}) => xf(new THREE.OctahedronGeometry(r, 0), t);

/** Merge geometries that share a material into one (drops index, keeps position/normal). */
export function merge(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let total = 0;
  for (const p of parts) total += p.getAttribute('position').count;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  let off = 0;
  for (const p of parts) {
    pos.set(p.getAttribute('position').array as Float32Array, off);
    const n = p.getAttribute('normal');
    if (n) nor.set(n.array as Float32Array, off);
    off += p.getAttribute('position').count * 3;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.computeBoundingSphere();
  return out;
}
