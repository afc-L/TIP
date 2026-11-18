// Particle effects (pooled, one draw call per blend mode) and weather: rain streaks,
// drifting fog banks, dust motes, ash, dark ichor wisps used by feeding and abilities.
import * as THREE from 'three';
import { rand, clamp } from '../core/util.js';
import { smokeTexture, radialTexture } from '../core/textures.js';

const VS = `
  attribute float aSize; attribute vec4 aColor;
  varying vec4 vColor;
  uniform float uScale;
  void main(){
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(-mv.z, 0.1);
    gl_Position = projectionMatrix * mv;
  }`;
const FS = `
  uniform sampler2D uTex; varying vec4 vColor;
  void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(vColor.rgb * t.rgb, vColor.a * t.a); if (gl_FragColor.a < 0.003) discard; }`;

class Pool {
  constructor(scene, max, texture, blending) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4); this.size = new Float32Array(max);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max); this.grow = new Float32Array(max);
    this.drag = new Float32Array(max); this.grav = new Float32Array(max); this.a0 = new Float32Array(max); this.target = [];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({ uniforms: { uTex: { value: texture }, uScale: { value: 300 } }, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 3;
    scene.add(this.points); this.geo = g;
  }
  emit(x, y, z, vx, vy, vz, size, r, gg, b, a, life, { grow = 0, drag = 0.5, grav = 0, target = null } = {}) {
    let i = this.n < this.max ? this.n++ : Math.floor(Math.random() * this.max);
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 4] = r; this.col[i * 4 + 1] = gg; this.col[i * 4 + 2] = b; this.col[i * 4 + 3] = a; this.a0[i] = a;
    this.size[i] = size; this.life[i] = life; this.maxLife[i] = life; this.grow[i] = grow; this.drag[i] = drag; this.grav[i] = grav; this.target[i] = target;
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        const j = --this.n; // swap-remove
        if (i !== j) {
          for (let k = 0; k < 3; k++) { this.pos[i * 3 + k] = this.pos[j * 3 + k]; this.vel[i * 3 + k] = this.vel[j * 3 + k]; }
          for (let k = 0; k < 4; k++) this.col[i * 4 + k] = this.col[j * 4 + k];
          this.size[i] = this.size[j]; this.life[i] = this.life[j]; this.maxLife[i] = this.maxLife[j]; this.grow[i] = this.grow[j]; this.drag[i] = this.drag[j]; this.grav[i] = this.grav[j]; this.a0[i] = this.a0[j]; this.target[i] = this.target[j];
          i--;
        }
        continue;
      }
      const t = this.target[i];
      if (t) { // home toward a moving point (used for wisps flowing into the monster)
        const dx = t.x - this.pos[i * 3], dy = t.y - this.pos[i * 3 + 1], dz = t.z - this.pos[i * 3 + 2];
        this.vel[i * 3] += dx * dt * 6; this.vel[i * 3 + 1] += dy * dt * 6; this.vel[i * 3 + 2] += dz * dt * 6;
      }
      const dr = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= dr; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * dr - this.grav[i] * dt; this.vel[i * 3 + 2] *= dr;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] += this.grow[i] * dt;
      const u = this.life[i] / this.maxLife[i];
      this.col[i * 4 + 3] = this.a0[i] * Math.min(1, u * 3) * Math.min(1, (1 - u) * 8 + 0.2);
    }
    this.geo.setDrawRange(0, this.n);
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.aColor.needsUpdate = true; this.geo.attributes.aSize.needsUpdate = true;
  }
  clear() { this.n = 0; }
}

export class FX {
  constructor(game) {
    this.game = game; this.scene = null;
  }
  attach(scene, quality) {
    this.q = quality; this.scene = scene;
    this.smoke = new Pool(scene, 1600, smokeTexture(), THREE.NormalBlending);
    this.glow = new Pool(scene, 1200, radialTexture(), THREE.AdditiveBlending);
    this.blood = new Pool(scene, 2500, radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)', 64), THREE.NormalBlending);
    this.rain = null; this.fogBanks = null; this.motes = null;
  }
  setScale(h) { const s = h * 0.5 / Math.tan((this.game.camera.fov * Math.PI / 180) / 2); this.smoke.mat.uniforms.uScale.value = s; this.glow.mat.uniforms.uScale.value = s; if (this.blood) this.blood.mat.uniforms.uScale.value = s; }

  // ---- emitters ----
  footDust(p, surf, heavy) {
    if (surf === 'water') { for (let i = 0; i < 5; i++) this.glow.emit(p.x + rand(-0.2, 0.2), p.y + 0.05, p.z + rand(-0.2, 0.2), rand(-1, 1), rand(1, 2.5), rand(-1, 1), 0.06, 0.4, 0.5, 0.6, 0.5, 0.5, { grav: 9 }); return; }
    if (!['dirt', 'leaves', 'concrete', 'asphalt', 'void', 'grass'].includes(surf) || heavy < 0.9) return;
    const c = surf === 'void' ? [0.05, 0.02, 0.06] : [0.4, 0.38, 0.34];
    for (let i = 0; i < 3 * this.q.particles; i++) this.smoke.emit(p.x + rand(-0.2, 0.2), p.y + 0.05, p.z + rand(-0.2, 0.2), rand(-0.5, 0.5), rand(0.1, 0.4), rand(-0.5, 0.5), rand(0.3, 0.6), c[0], c[1], c[2], 0.15, rand(0.8, 1.5), { grow: 0.6, drag: 2 });
  }
  impact(p, dir) { // stylized dark burst, not gore
    for (let i = 0; i < 18 * this.q.particles; i++) {
      const s = rand(1, 4);
      this.smoke.emit(p.x, p.y, p.z, dir.x * s + rand(-1.5, 1.5), rand(-0.5, 2), dir.z * s + rand(-1.5, 1.5), rand(0.15, 0.35), 0.06, 0.02, 0.03, 0.9, rand(0.4, 0.9), { grow: 0.4, drag: 3, grav: 2 });
    }
    for (let i = 0; i < 8; i++) this.glow.emit(p.x, p.y, p.z, rand(-3, 3), rand(-1, 3), rand(-3, 3), 0.05, 0.6, 0.15, 0.1, 0.8, 0.3, { drag: 2, grav: 6 });
  }
  wisps(from, toTarget, n = 3) { // dark tendrils flowing from a victim into the monster
    for (let i = 0; i < n * this.q.particles + 1; i++) {
      this.smoke.emit(from.x + rand(-0.3, 0.3), from.y + rand(-0.2, 0.3), from.z + rand(-0.3, 0.3), rand(-1, 1), rand(0.5, 1.5), rand(-1, 1), rand(0.12, 0.3), 0.02, 0.0, 0.03, 0.85, rand(0.6, 1.1), { drag: 2.5, target: toTarget, grow: -0.1 });
      if (Math.random() < 0.3) this.glow.emit(from.x + rand(-0.3, 0.3), from.y, from.z + rand(-0.3, 0.3), 0, rand(0.5, 1), 0, 0.04, 0.5, 0.05, 0.08, 0.7, 0.9, { target: toTarget, drag: 2 });
    }
  }
  ash(p, h = 1.7) { // dissolving into ash
    for (let i = 0; i < 40 * this.q.particles; i++) {
      this.smoke.emit(p.x + rand(-0.4, 0.4), p.y + rand(0, h * 0.4), p.z + rand(-0.6, 0.6), rand(-0.3, 0.3), rand(0.2, 1.4), rand(-0.3, 0.3), rand(0.2, 0.6), 0.08, 0.07, 0.07, 0.7, rand(1.5, 3.5), { grow: 0.3, drag: 0.8, grav: -0.2 });
      if (Math.random() < 0.25) this.glow.emit(p.x + rand(-0.4, 0.4), p.y + rand(0, 0.3), p.z + rand(-0.6, 0.6), rand(-0.2, 0.2), rand(0.5, 1.5), rand(-0.2, 0.2), 0.03, 0.9, 0.3, 0.1, 0.9, rand(1, 2.5), { drag: 0.5, grav: -0.3 });
    }
  }
  roarWave(p) {
    for (let i = 0; i < 60 * this.q.particles; i++) { const a = rand(0, Math.PI * 2), s = rand(6, 12); this.smoke.emit(p.x, p.y + 0.2, p.z, Math.cos(a) * s, rand(0, 0.6), Math.sin(a) * s, 0.5, 0.2, 0.2, 0.22, 0.25, 0.9, { grow: 2.5, drag: 2.5 }); }
  }
  muzzle(p) { for (let i = 0; i < 6; i++) this.glow.emit(p.x, p.y, p.z, rand(-2, 2), rand(-1, 2), rand(-2, 2), 0.15, 1, 0.7, 0.3, 1, 0.12, { drag: 5 }); }
  sparks(p, col = [1, 0.5, 0.2]) { for (let i = 0; i < 14; i++) this.glow.emit(p.x, p.y, p.z, rand(-3, 3), rand(0, 4), rand(-3, 3), 0.05, col[0], col[1], col[2], 1, rand(0.3, 0.8), { grav: 9, drag: 1 }); }
  sensesPulse(p) { for (let i = 0; i < 40; i++) { const a = rand(0, Math.PI * 2), s = rand(10, 18); this.glow.emit(p.x, p.y + 1, p.z, Math.cos(a) * s, rand(-0.5, 0.5), Math.sin(a) * s, 0.25, 0.4, 0.6, 1, 0.5, 0.8, { drag: 1.5 }); } }
  voidMotes(center, n = 2) { for (let i = 0; i < n; i++) this.glow.emit(center.x + rand(-25, 25), center.y + rand(-2, 10), center.z + rand(-25, 25), rand(-0.2, 0.2), rand(0.1, 0.4), rand(-0.2, 0.2), rand(0.04, 0.12), 0.5, 0.3, 0.9, 0.6, rand(3, 7), { drag: 0.1 }); }
  embers(p, n = 1) { for (let i = 0; i < n; i++) this.glow.emit(p.x + rand(-0.3, 0.3), p.y, p.z + rand(-0.3, 0.3), rand(-0.2, 0.2), rand(0.8, 1.8), rand(-0.2, 0.2), rand(0.03, 0.06), 1, 0.45, 0.1, 1, rand(1, 2.2), { drag: 0.6 }); }
  campSmoke(p) { this.smoke.emit(p.x + rand(-0.2, 0.2), p.y + 0.4, p.z + rand(-0.2, 0.2), rand(-0.1, 0.1), rand(0.4, 0.8), rand(-0.1, 0.1), 0.5, 0.25, 0.25, 0.27, 0.25, rand(3, 5), { grow: 0.8, drag: 0.4 }); }

  // ---- weather ----
  setupWeather(opts) {
    this.clearWeather();
    const q = this.q.particles;
    if (opts.rain) {
      const n = Math.floor(opts.rain * 5000 * q);
      const g = new THREE.BufferGeometry(); const pos = new Float32Array(n * 6);
      for (let i = 0; i < n; i++) { const x = rand(-25, 25), y = rand(0, 22), z = rand(-25, 25); pos.set([x, y, z, x + 0.02, y - 0.5, z + 0.02], i * 6); }
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const m = new THREE.LineBasicMaterial({ color: 0x9aa4b4, transparent: true, opacity: 0.35, depthWrite: false });
      this.rain = new THREE.LineSegments(g, m); this.rain.frustumCulled = false; this.scene.add(this.rain);
      this.rainSpeed = 18; this.rainN = n;
    }
    if (opts.fogBanks) {
      // large soft sprites drifting at ground level
      const n = Math.floor(opts.fogBanks * 60 * q + 10);
      const g = new THREE.BufferGeometry(); const pos = new Float32Array(n * 3); const size = new Float32Array(n); const col = new Float32Array(n * 4);
      const c = new THREE.Color(opts.fogColor || 0x8890a0);
      for (let i = 0; i < n; i++) { pos.set([rand(-60, 60), rand(0.5, 3), rand(-60, 60)], i * 3); size[i] = rand(9, 18); col.set([c.r, c.g, c.b, rand(0.06, 0.13) * (opts.fogBankAlpha || 1)], i * 4); }
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(size, 1)); g.setAttribute('aColor', new THREE.BufferAttribute(col, 4));
      const m = new THREE.ShaderMaterial({ uniforms: { uTex: { value: smokeTexture() }, uScale: { value: this.smoke.mat.uniforms.uScale.value } }, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false });
      this.fogBanks = new THREE.Points(g, m); this.fogBanks.frustumCulled = false; this.fogBanks.renderOrder = 1; this.scene.add(this.fogBanks);
    }
    if (opts.motes) {
      const n = Math.floor(400 * q);
      const g = new THREE.BufferGeometry(); const pos = new Float32Array(n * 3); const size = new Float32Array(n); const col = new Float32Array(n * 4);
      const c = new THREE.Color(opts.moteColor || 0xb0b0a0);
      for (let i = 0; i < n; i++) { pos.set([rand(-15, 15), rand(0, 6), rand(-15, 15)], i * 3); size[i] = rand(0.02, 0.05); col.set([c.r, c.g, c.b, rand(0.2, 0.5)], i * 4); }
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(size, 1)); g.setAttribute('aColor', new THREE.BufferAttribute(col, 4));
      const m = new THREE.ShaderMaterial({ uniforms: { uTex: { value: radialTexture() }, uScale: { value: this.smoke.mat.uniforms.uScale.value } }, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      this.motes = new THREE.Points(g, m); this.motes.frustumCulled = false; this.scene.add(this.motes);
    }
  }
  clearWeather() {
    for (const k of ['rain', 'fogBanks', 'motes']) if (this[k]) { this.scene.remove(this[k]); this[k].geometry.dispose(); this[k] = null; }
  }
  update(dt, camPos, wind = 1, indoor = false) {
    this.smoke.update(dt); this.glow.update(dt); this.blood && this.blood.update(dt);
    const t = performance.now() / 1000;
    if (this.rain) {
      this.rain.visible = !indoor;
      const p = this.rain.geometry.attributes.position.array;
      const ox = camPos.x, oz = camPos.z;
      for (let i = 0; i < this.rainN; i++) {
        const k = i * 6;
        let y = p[k + 1] - this.rainSpeed * dt; let x = p[k] + wind * 2 * dt;
        if (y < camPos.y - 6) { y = camPos.y + rand(8, 18); x = ox + rand(-25, 25); p[k + 2] = oz + rand(-25, 25); }
        // keep near camera
        if (x - ox > 25) x -= 50; if (x - ox < -25) x += 50;
        if (p[k + 2] - oz > 25) p[k + 2] -= 50; if (p[k + 2] - oz < -25) p[k + 2] += 50;
        p[k] = x; p[k + 1] = y; p[k + 3] = x + 0.03 * wind; p[k + 4] = y - 0.55; p[k + 5] = p[k + 2];
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }
    if (this.fogBanks) {
      const p = this.fogBanks.geometry.attributes.position.array;
      for (let i = 0; i < p.length; i += 3) {
        p[i] += wind * 0.4 * dt; p[i + 2] += Math.sin(t * 0.1 + i) * 0.1 * dt;
        if (p[i] - camPos.x > 60) p[i] -= 120; if (p[i] - camPos.x < -60) p[i] += 120;
        if (p[i + 2] - camPos.z > 60) p[i + 2] -= 120; if (p[i + 2] - camPos.z < -60) p[i + 2] += 120;
      }
      this.fogBanks.geometry.attributes.position.needsUpdate = true;
      this.fogBanks.material.uniforms.uScale.value = this.smoke.mat.uniforms.uScale.value;
      this.fogBanks.position.y = 0; this.fogBanks.visible = !indoor;
    }
    if (this.motes) {
      const p = this.motes.geometry.attributes.position.array;
      for (let i = 0; i < p.length; i += 3) {
        p[i] += Math.sin(t * 0.3 + i) * 0.05 * dt; p[i + 1] += Math.cos(t * 0.2 + i * 0.7) * 0.04 * dt;
        if (p[i] - camPos.x > 15) p[i] -= 30; if (p[i] - camPos.x < -15) p[i] += 30;
        if (p[i + 2] - camPos.z > 15) p[i + 2] -= 30; if (p[i + 2] - camPos.z < -15) p[i + 2] += 30;
        if (p[i + 1] - camPos.y > 5) p[i + 1] -= 8; if (p[i + 1] - camPos.y < -3) p[i + 1] += 8;
      }
      this.motes.geometry.attributes.position.needsUpdate = true;
      this.motes.material.uniforms.uScale.value = this.smoke.mat.uniforms.uScale.value;
    }
  }
  clearAll() { this.smoke && this.smoke.clear(); this.glow && this.glow.clear(); this.blood && this.blood.clear(); }
  // ---- gore ----
  bloodSpray(p, dir, amount = 1) {
    const n = Math.floor(80 * amount * (0.5 + this.q.particles * 0.5));
    for (let i = 0; i < n; i++) {
      const s = rand(1.2, 5.5) * (0.6 + amount * 0.4);
      this.blood.emit(p.x, p.y, p.z, dir.x * s + rand(-1.4, 1.4), dir.y * s + rand(0, 2.5), dir.z * s + rand(-1.4, 1.4), rand(0.015, 0.05), rand(0.16, 0.26), 0.0, 0.0, 0.95, rand(0.5, 1.1), { grav: 9.8, drag: 0.5 });
      if (i % 16 === 0) this.blood.emit(p.x, p.y, p.z, dir.x * 1.2 + rand(-0.5, 0.5), rand(0, 0.6), dir.z * 1.2 + rand(-0.5, 0.5), rand(0.12, 0.25), 0.14, 0.0, 0.0, 0.3, rand(0.3, 0.6), { grow: 0.5, drag: 4, grav: 2 });
    }
  }
  bloodDrip(p, n = 2) { for (let i = 0; i < n; i++) this.blood.emit(p.x + rand(-0.05, 0.05), p.y, p.z + rand(-0.05, 0.05), rand(-0.2, 0.2), rand(-0.5, 0), rand(-0.2, 0.2), rand(0.012, 0.03), 0.2, 0.0, 0.0, 0.95, rand(0.5, 1.0), { grav: 9.8, drag: 0.2 }); }
}
