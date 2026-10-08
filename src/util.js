import * as THREE from 'three';

export const UP = new THREE.Vector3(0, 1, 0);
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const rand = (a, b) => a + Math.random() * (b - a);
export const randSign = () => (Math.random() < 0.5 ? -1 : 1);

// Rapier <-> three conversions (write into targets to avoid garbage)
export const v3 = (r, out = new THREE.Vector3()) => out.set(r.x, r.y, r.z);
export const q4 = (r, out = new THREE.Quaternion()) => out.set(r.x, r.y, r.z, r.w);

export const yawQuat = (yaw, out = new THREE.Quaternion()) => out.setFromAxisAngle(UP, yaw);

/** Wrap an angle into (-PI, PI]. */
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a <= -Math.PI) a += Math.PI * 2;
  return a;
}

const _qe = new THREE.Quaternion();
/** Rotation vector (axis * angle) that takes rotation `from` to `to` (world space). */
export function rotationError(to, from, out) {
  _qe.copy(from).invert().premultiply(to); // to * from^-1
  if (_qe.w < 0) { _qe.x = -_qe.x; _qe.y = -_qe.y; _qe.z = -_qe.z; _qe.w = -_qe.w; }
  const s = Math.sqrt(_qe.x * _qe.x + _qe.y * _qe.y + _qe.z * _qe.z);
  if (s < 1e-6) return out.set(_qe.x * 2, _qe.y * 2, _qe.z * 2);
  const angle = 2 * Math.atan2(s, _qe.w);
  return out.set(_qe.x / s, _qe.y / s, _qe.z / s).multiplyScalar(angle);
}

const _m = new THREE.Matrix4();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
/**
 * Build a rotation whose local +Y points along `yDir` and whose local +Z is as close as
 * possible to `zRef`. Used for limbs and weapons.
 */
export function basisQuat(yDir, zRef, out = new THREE.Quaternion()) {
  _y.copy(yDir).normalize();
  _z.copy(zRef).addScaledVector(_y, -zRef.dot(_y));
  if (_z.lengthSq() < 1e-6) {
    _z.set(0, 0, 1).addScaledVector(_y, -_y.z);
    if (_z.lengthSq() < 1e-6) _z.set(1, 0, 0).addScaledVector(_y, -_y.x);
  }
  _z.normalize();
  _x.crossVectors(_y, _z);
  _m.makeBasis(_x, _y, _z);
  return out.setFromRotationMatrix(_m);
}

/** Same as basisQuat but specifying local +X and +Y. */
export function basisQuatXY(xDir, yDir, out = new THREE.Quaternion()) {
  _y.copy(yDir).normalize();
  _x.copy(xDir).addScaledVector(_y, -xDir.dot(_y));
  if (_x.lengthSq() < 1e-6) _x.set(1, 0, 0).addScaledVector(_y, -_y.x);
  _x.normalize();
  _z.crossVectors(_x, _y);
  _m.makeBasis(_x, _y, _z);
  return out.setFromRotationMatrix(_m);
}

export function clampLength(v, max) {
  const l = v.length();
  if (l > max) v.multiplyScalar(max / l);
  return v;
}
