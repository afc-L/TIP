// Pooled, instanced particles (one draw call). Struct-of-arrays for speed.
import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();
const _e = new THREE.Euler();

export class ParticleManager {
  mesh: THREE.InstancedMesh;
  private cap: number;
  private px: Float32Array; private py: Float32Array; private pz: Float32Array;
  private vx: Float32Array; private vy: Float32Array; private vz: Float32Array;
  private life: Float32Array; private maxLife: Float32Array; private size: Float32Array;
  private grav: Float32Array; private spin: Float32Array;
  private cr: Float32Array; private cg: Float32Array; private cb: Float32Array;
  private alive = 0;
  scale = 1; // reduced-effects multiplier

  constructor(scene: THREE.Scene, cap: number) {
    this.cap = cap;
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, _c.set(1, 1, 1));
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    const f = () => new Float32Array(cap);
    this.px = f(); this.py = f(); this.pz = f(); this.vx = f(); this.vy = f(); this.vz = f();
    this.life = f(); this.maxLife = f(); this.size = f(); this.grav = f(); this.spin = f();
    this.cr = f(); this.cg = f(); this.cb = f();
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, color: THREE.ColorRepresentation, gravity = 12) {
    if (this.alive >= this.cap) return;
    const i = this.alive++;
    this.px[i] = x; this.py[i] = y; this.pz[i] = z;
    this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.life[i] = life; this.maxLife[i] = life; this.size[i] = size; this.grav[i] = gravity;
    this.spin[i] = Math.random() * 10;
    _c.set(color);
    this.cr[i] = _c.r; this.cg[i] = _c.g; this.cb[i] = _c.b;
  }

  burst(x: number, y: number, z: number, count: number, color: THREE.ColorRepresentation, speed = 5, size = 0.18, life = 0.6, up = 4, gravity = 14) {
    const n = Math.max(1, Math.round(count * this.scale));
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random() * 0.8);
      this.emit(x, y, z, Math.cos(a) * sp, up * (0.5 + Math.random()), Math.sin(a) * sp, life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.8), color, gravity);
    }
  }

  ring(x: number, z: number, radius: number, count: number, color: THREE.ColorRepresentation, speed = 3, size = 0.2) {
    const n = Math.max(3, Math.round(count * this.scale));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      this.emit(x + Math.cos(a) * radius, 0.2, z + Math.sin(a) * radius, Math.cos(a) * speed, 1.5 + Math.random() * 2, Math.sin(a) * speed, 0.5 + Math.random() * 0.3, size, color, 6);
    }
  }

  clear() { this.alive = 0; this.mesh.count = 0; }

  update(dt: number) {
    let i = 0;
    while (i < this.alive) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        // swap-remove
        const j = --this.alive;
        this.px[i] = this.px[j]; this.py[i] = this.py[j]; this.pz[i] = this.pz[j];
        this.vx[i] = this.vx[j]; this.vy[i] = this.vy[j]; this.vz[i] = this.vz[j];
        this.life[i] = this.life[j]; this.maxLife[i] = this.maxLife[j]; this.size[i] = this.size[j];
        this.grav[i] = this.grav[j]; this.spin[i] = this.spin[j];
        this.cr[i] = this.cr[j]; this.cg[i] = this.cg[j]; this.cb[i] = this.cb[j];
        continue;
      }
      this.vy[i] -= this.grav[i] * dt;
      this.px[i] += this.vx[i] * dt; this.py[i] += this.vy[i] * dt; this.pz[i] += this.vz[i] * dt;
      if (this.py[i] < 0.05) { this.py[i] = 0.05; this.vy[i] *= -0.35; this.vx[i] *= 0.7; this.vz[i] *= 0.7; }
      const t = this.life[i] / this.maxLife[i];
      const s = this.size[i] * Math.min(1, t * 2.5);
      _p.set(this.px[i], this.py[i], this.pz[i]);
      _e.set(this.spin[i] * t, this.spin[i] * 0.7 * t, 0);
      _q.setFromEuler(_e);
      _s.set(s, s, s);
      _m.compose(_p, _q, _s);
      this.mesh.setMatrixAt(i, _m);
      _c.setRGB(this.cr[i], this.cg[i], this.cb[i]);
      this.mesh.setColorAt(i, _c);
      i++;
    }
    this.mesh.count = this.alive;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
