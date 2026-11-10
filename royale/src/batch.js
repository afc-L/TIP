// Chunked instanced rendering: thousands of boxes / trees in a handful of draw calls,
// split into spatial chunks so frustum culling and render distance still work.
import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _c = new THREE.Color();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export class ChunkedInstances {
  constructor(scene, geometry, material, { chunk = 225, half = 1000, castShadow = true, receiveShadow = true, name = '' } = {}) {
    this.scene = scene;
    this.geo = geometry;
    this.mat = material;
    this.chunk = chunk;
    this.half = half;
    this.n = Math.ceil((half * 2) / chunk);
    this.pending = new Map();     // chunk index -> [{m, color}]
    this.meshes = [];
    this.castShadow = castShadow;
    this.receiveShadow = receiveShadow;
    this.name = name;
    this.finalized = false;
  }
  _ci(x, z) {
    const ix = Math.max(0, Math.min(this.n - 1, Math.floor((x + this.half) / this.chunk)));
    const iz = Math.max(0, Math.min(this.n - 1, Math.floor((z + this.half) / this.chunk)));
    return ix * this.n + iz;
  }
  // add before finalize(); returns a handle {mesh, index} resolved after finalize
  add(matrix, color) {
    const e = matrix.elements;
    const ci = this._ci(e[12], e[14]);
    let arr = this.pending.get(ci);
    if (!arr) { arr = []; this.pending.set(ci, arr); }
    const h = { mesh: null, index: arr.length, m: matrix.clone(), color: color.clone ? color.clone() : new THREE.Color(color) };
    arr.push(h);
    return h;
  }
  finalize() {
    for (const [ci, arr] of this.pending) {
      const mesh = new THREE.InstancedMesh(this.geo, this.mat, arr.length);
      mesh.castShadow = this.castShadow;
      mesh.receiveShadow = this.receiveShadow;
      mesh.name = this.name;
      for (let i = 0; i < arr.length; i++) {
        mesh.setMatrixAt(i, arr[i].m);
        mesh.setColorAt(i, arr[i].color);
        arr[i].mesh = mesh;
        arr[i].index = i;
        arr[i].m = null;
        arr[i].color = null;
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      const ix = Math.floor(ci / this.n), iz = ci % this.n;
      mesh.userData.cx = -this.half + (ix + 0.5) * this.chunk;
      mesh.userData.cz = -this.half + (iz + 0.5) * this.chunk;
      this.scene.add(mesh);
      this.meshes.push(mesh);
    }
    this.pending.clear();
    this.finalized = true;
  }
  hide(h) {
    if (!h || !h.mesh) return;
    if (!h._orig) { h._orig = new THREE.Matrix4(); h.mesh.getMatrixAt(h.index, h._orig); }
    h.mesh.setMatrixAt(h.index, ZERO);
    h.mesh.instanceMatrix.needsUpdate = true;
  }
  show(h) {
    if (!h || !h.mesh || !h._orig) return;
    h.mesh.setMatrixAt(h.index, h._orig);
    h.mesh.instanceMatrix.needsUpdate = true;
  }
  setMatrix(h, m) {
    h.mesh.setMatrixAt(h.index, m);
    h.mesh.instanceMatrix.needsUpdate = true;
  }
  setColor(h, color) {
    h.mesh.setColorAt(h.index, _c.set(color));
    h.mesh.instanceColor.needsUpdate = true;
  }
  updateVisibility(cx, cz, dist) {
    const lim = dist + this.chunk * 0.75;
    for (const m of this.meshes) {
      const dx = m.userData.cx - cx, dz = m.userData.cz - cz;
      m.visible = dx * dx + dz * dz < lim * lim;
    }
  }
  setShadows(on) { for (const m of this.meshes) m.castShadow = on && this.castShadow; }
}

// A dynamic instanced pool (for player-built pieces etc.) with a free list.
export class DynamicInstances {
  constructor(scene, geometry, material, capacity, { castShadow = true, receiveShadow = true } = {}) {
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.castShadow = castShadow;
    this.mesh.receiveShadow = receiveShadow;
    this.mesh.frustumCulled = false;
    this.capacity = capacity;
    this.free = [];
    for (let i = capacity - 1; i >= 0; i--) { this.free.push(i); this.mesh.setMatrixAt(i, ZERO); }
    this.mesh.setColorAt(0, _c.set(0xffffff));
    this.mesh.count = capacity;
    scene.add(this.mesh);
    this.dirty = true;
  }
  alloc(matrix, color) {
    const i = this.free.pop();
    if (i === undefined) return -1;
    this.mesh.setMatrixAt(i, matrix);
    this.mesh.setColorAt(i, _c.set(color));
    this.dirty = true;
    return i;
  }
  set(i, matrix) { if (i >= 0) { this.mesh.setMatrixAt(i, matrix); this.dirty = true; } }
  color(i, color) { if (i >= 0) { this.mesh.setColorAt(i, _c.set(color)); this.dirty = true; } }
  release(i) {
    if (i < 0) return;
    this.mesh.setMatrixAt(i, ZERO);
    this.free.push(i);
    this.dirty = true;
  }
  flush() {
    if (!this.dirty) return;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.dirty = false;
  }
}

export function boxMatrix(cx, cy, cz, sx, sy, sz, rotY = 0, out = _m) {
  out.makeRotationY(rotY);
  out.scale(new THREE.Vector3(sx, sy, sz));
  out.setPosition(cx, cy, cz);
  return out;
}
