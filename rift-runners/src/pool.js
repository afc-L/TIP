import * as THREE from 'three';

// Wraps an InstancedMesh: call begin(), push() once per visible object, then end().
// Lets hundreds of identical objects render in a single draw call.
export class InstancePool {
  constructor(geometry, material, capacity, { shadow = false, color = true } = {}) {
    this.capacity = capacity;
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (color) {
      this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3);
      this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    }
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = shadow;
    this.mesh.count = 0;
    this.count = 0;
    this.m = this.mesh.instanceMatrix.array;
    this.c = color ? this.mesh.instanceColor.array : null;
  }

  begin() { this.count = 0; }

  // Translation + rotation around Y + per-axis scale, written straight into the buffer.
  push(x, y, z, rotY, sx, sy, sz, r = 1, g = 1, b = 1) {
    if (this.count >= this.capacity) return;
    const i = this.count++;
    const o = i * 16, cs = Math.cos(rotY), sn = Math.sin(rotY), m = this.m;
    m[o] = cs * sx; m[o + 1] = 0; m[o + 2] = -sn * sx; m[o + 3] = 0;
    m[o + 4] = 0; m[o + 5] = sy; m[o + 6] = 0; m[o + 7] = 0;
    m[o + 8] = sn * sz; m[o + 9] = 0; m[o + 10] = cs * sz; m[o + 11] = 0;
    m[o + 12] = x; m[o + 13] = y; m[o + 14] = z; m[o + 15] = 1;
    if (this.c) { const c = i * 3; this.c[c] = r; this.c[c + 1] = g; this.c[c + 2] = b; }
  }

  end() {
    this.mesh.count = this.count;
    this.mesh.visible = this.count > 0; // skip empty pools entirely (incl. shadow pass)
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.c) this.mesh.instanceColor.needsUpdate = true;
  }
}

// Fixed-size uniform grid for fast neighbour queries on the XZ plane.
export class SpatialGrid {
  constructor(halfSize, cellSize) {
    this.half = halfSize;
    this.cell = cellSize;
    this.n = Math.ceil((halfSize * 2) / cellSize);
    this.cells = Array.from({ length: this.n * this.n }, () => []);
  }
  clear() { for (const c of this.cells) c.length = 0; }
  idx(v) { return Math.max(0, Math.min(this.n - 1, Math.floor((v + this.half) / this.cell))); }
  insert(o) { this.cells[this.idx(o.z) * this.n + this.idx(o.x)].push(o); }
  // Calls fn(o) for objects whose cells overlap the query circle (caller does exact test).
  query(x, z, r, out) {
    out.length = 0;
    const x0 = this.idx(x - r), x1 = this.idx(x + r), z0 = this.idx(z - r), z1 = this.idx(z + r);
    for (let iz = z0; iz <= z1; iz++) {
      for (let ix = x0; ix <= x1; ix++) {
        const c = this.cells[iz * this.n + ix];
        for (let k = 0; k < c.length; k++) out.push(c[k]);
      }
    }
    return out;
  }
}
