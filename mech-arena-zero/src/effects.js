// Visual effects: pooled particles, explosions, tracers, muzzle flashes, damage numbers, telegraphs.
import * as THREE from 'three';
import { rand } from './util.js';

const PVERT = `
attribute vec4 pcolor; attribute float psize; varying vec4 vColor; uniform float uScale;
void main(){ vColor = pcolor; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = psize * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`;
const PFRAG = `
varying vec4 vColor; uniform float uSoft;
void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard; float a = mix(1.0, smoothstep(0.5, 0.0, d), uSoft); gl_FragColor = vec4(vColor.rgb, vColor.a * a); }`;

class ParticlePool {
  constructor(max, additive, soft = 1) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.s0 = new Float32Array(max); this.s1 = new Float32Array(max); this.grav = new Float32Array(max); this.drag = new Float32Array(max);
    this.rgb = new Float32Array(max * 3); this.a0 = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    this.pa = new THREE.BufferAttribute(this.pos, 3); this.ca = new THREE.BufferAttribute(this.col, 4); this.sa = new THREE.BufferAttribute(this.size, 1);
    this.pa.setUsage(THREE.DynamicDrawUsage); this.ca.setUsage(THREE.DynamicDrawUsage); this.sa.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.pa); g.setAttribute('pcolor', this.ca); g.setAttribute('psize', this.sa);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: PVERT, fragmentShader: PFRAG, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uScale: { value: 600 }, uSoft: { value: soft } },
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.geo = g;
  }
  spawn(x, y, z, vx, vy, vz, life, s0, s1, r, gg, b, a = 1, grav = 0, drag = 0) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.maxLife[i] = life; this.s0[i] = s0; this.s1[i] = s1;
    this.rgb[i * 3] = r; this.rgb[i * 3 + 1] = gg; this.rgb[i * 3 + 2] = b; this.a0[i] = a;
    this.grav[i] = grav; this.drag[i] = drag;
  }
  _copy(d, s) {
    for (let k = 0; k < 3; k++) { this.pos[d * 3 + k] = this.pos[s * 3 + k]; this.vel[d * 3 + k] = this.vel[s * 3 + k]; this.rgb[d * 3 + k] = this.rgb[s * 3 + k]; }
    this.life[d] = this.life[s]; this.maxLife[d] = this.maxLife[s]; this.s0[d] = this.s0[s]; this.s1[d] = this.s1[s];
    this.grav[d] = this.grav[s]; this.drag[d] = this.drag[s]; this.a0[d] = this.a0[s];
  }
  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.n--; if (i !== this.n) this._copy(i, this.n); continue; }
      const dr = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= dr; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * dr - this.grav[i] * dt; this.vel[i * 3 + 2] *= dr;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.05) { this.pos[i * 3 + 1] = 0.05; this.vel[i * 3 + 1] *= -0.3; }
      const t = 1 - this.life[i] / this.maxLife[i];
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      const fade = t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9;
      this.col[i * 4] = this.rgb[i * 3]; this.col[i * 4 + 1] = this.rgb[i * 3 + 1]; this.col[i * 4 + 2] = this.rgb[i * 3 + 2];
      this.col[i * 4 + 3] = this.a0[i] * fade;
      i++;
    }
    this.geo.setDrawRange(0, this.n);
    this.pa.needsUpdate = true; this.ca.needsUpdate = true; this.sa.needsUpdate = true;
  }
  clear() { this.n = 0; this.geo.setDrawRange(0, 0); }
}

const _c = new THREE.Color();
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const Z = new THREE.Vector3(0, 0, 1);

export class Effects {
  constructor(scene, camera, settings) {
    this.scene = scene; this.camera = camera;
    const q = settings.quality;
    this.pmul = (q === 'low' ? 0.45 : q === 'high' ? 1.25 : 0.8) * (settings.particles ?? 1);
    const max = Math.round(2400 * this.pmul) + 200;
    this.glow = new ParticlePool(max, true, 1);
    this.smoke = new ParticlePool(Math.round(max * 0.5), false, 1);
    scene.add(this.glow.points, this.smoke.points);
    this.shake = 0;
    // flash spheres
    this.flashes = [];
    this.flashGeo = new THREE.SphereGeometry(1, 12, 8);
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(this.flashGeo, new THREE.MeshBasicMaterial({ color: 0xffaa55, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.visible = false; scene.add(m); this.flashes.push({ m, t: 0, life: 0, r: 1 });
    }
    // shock rings
    this.rings = [];
    this.ringGeo = new THREE.RingGeometry(0.85, 1, 32); this.ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: 0xffcc88, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.visible = false; scene.add(m); this.rings.push({ m, t: 0, life: 0, r: 1 });
    }
    // tracers / beams
    this.tracers = [];
    this.tracerGeo = new THREE.BoxGeometry(1, 1, 1); this.tracerGeo.translate(0, 0, 0.5);
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(this.tracerGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.visible = false; m.frustumCulled = false; scene.add(m); this.tracers.push({ m, t: 0, life: 0, w: 0.2 });
    }
    // dynamic lights (fixed count to avoid shader recompiles)
    this.lights = [];
    const nl = q === 'low' ? 0 : q === 'high' ? 4 : 2;
    for (let i = 0; i < nl; i++) { const l = new THREE.PointLight(0xffaa66, 0, 30, 2); scene.add(l); this.lights.push({ l, t: 0, life: 0, i0: 0 }); }
    this.li = 0;
    // ground telegraphs
    this.telegraphs = [];
    this.telGeo = new THREE.CircleGeometry(1, 32); this.telGeo.rotateX(-Math.PI / 2);
    this.telRingGeo = new THREE.RingGeometry(0.94, 1, 40); this.telRingGeo.rotateX(-Math.PI / 2);
    // damage numbers
    this.numLayer = document.getElementById('dmg-layer');
    this.nums = [];
    this.showNumbers = settings.damageNumbers;
    this.fi = 0; this.ri = 0; this.ti = 0;
  }

  setScale(px) { this.glow.mat.uniforms.uScale.value = px; this.smoke.mat.uniforms.uScale.value = px; }

  // ---------------- primitives ----------------
  flash(pos, radius, color, life = 0.25) {
    const f = this.flashes[this.fi++ % this.flashes.length];
    f.m.position.copy(pos); f.m.material.color.set(color); f.t = 0; f.life = life; f.r = radius; f.m.visible = true;
  }
  ring(pos, radius, color, life = 0.45) {
    const r = this.rings[this.ri++ % this.rings.length];
    r.m.position.set(pos.x, Math.max(0.15, pos.y - 0.5), pos.z); r.m.material.color.set(color); r.t = 0; r.life = life; r.r = radius; r.m.visible = true;
  }
  light(pos, color, intensity, life = 0.2) {
    if (!this.lights.length) return;
    const L = this.lights[this.li++ % this.lights.length];
    L.l.position.copy(pos); L.l.color.set(color); L.l.intensity = intensity; L.i0 = intensity; L.t = 0; L.life = life;
  }
  tracer(p0, p1, color, width = 0.2, life = 0.08) {
    const tr = this.tracers[this.ti++ % this.tracers.length];
    const len = p0.distanceTo(p1);
    tr.m.position.copy(p0);
    _v.subVectors(p1, p0).normalize();
    tr.m.quaternion.setFromUnitVectors(Z, _v);
    tr.m.scale.set(width, width, len);
    tr.m.material.color.set(color); tr.m.material.opacity = 1;
    tr.t = 0; tr.life = life; tr.w = width; tr.m.visible = true;
  }

  sparks(pos, count, color, speed = 10, size = 0.35, life = 0.4) {
    _c.set(color);
    const n = Math.max(1, Math.round(count * this.pmul));
    for (let i = 0; i < n; i++) {
      this.glow.spawn(pos.x, pos.y, pos.z, rand(-1, 1) * speed, rand(-0.2, 1.2) * speed, rand(-1, 1) * speed, life * rand(0.5, 1.2), size, 0.05, _c.r, _c.g, _c.b, 1, 18, 2);
    }
  }
  muzzle(pos, color, size = 1) {
    _c.set(color);
    this.glow.spawn(pos.x, pos.y, pos.z, 0, 0, 0, 0.06, 2.2 * size, 1.0 * size, _c.r, _c.g, _c.b, 1);
    this.glow.spawn(pos.x, pos.y, pos.z, 0, 0, 0, 0.05, 1.2 * size, 0.6 * size, 1, 1, 1, 0.8);
  }
  impact(pos, color, kind = 'energy', big = 1) {
    _c.set(color);
    this.glow.spawn(pos.x, pos.y, pos.z, 0, 0, 0, 0.12, 2.5 * big, 0.5, _c.r, _c.g, _c.b, 1);
    this.sparks(pos, 5 * big, color, 9 * big, 0.3, 0.35);
    if (kind === 'impact') this.sparks(pos, 4, 0xffe0a0, 14, 0.2, 0.3);
  }
  smokePuff(pos, size = 2, life = 1.2, dark = 0.25, vy = 2) {
    this.smoke.spawn(pos.x + rand(-0.3, 0.3), pos.y, pos.z + rand(-0.3, 0.3), rand(-0.5, 0.5), vy, rand(-0.5, 0.5), life, size * 0.5, size * 1.6, dark, dark, dark * 1.05, 0.55, -0.5, 0.6);
  }
  trail(pos, color, size = 0.6, life = 0.25) {
    _c.set(color);
    this.glow.spawn(pos.x, pos.y, pos.z, 0, 0, 0, life, size, 0.05, _c.r, _c.g, _c.b, 0.9);
  }

  explosion(pos, radius = 4, color = 0xff8a3d, shake = 0.4) {
    const r = radius;
    this.flash(pos, r * 1.1, color, 0.3);
    this.flash(pos, r * 0.6, 0xffffff, 0.15);
    this.ring(pos, r * 1.6, color, 0.5);
    this.light(pos, color, 6 + r, 0.35);
    _c.set(color);
    const n = Math.round((10 + r * 4) * this.pmul);
    for (let i = 0; i < n; i++) {
      const sp = r * rand(1.5, 4);
      _v.randomDirection();
      this.glow.spawn(pos.x, pos.y, pos.z, _v.x * sp, Math.abs(_v.y) * sp + 2, _v.z * sp, rand(0.3, 0.8), r * rand(0.4, 0.9), 0.1, _c.r, _c.g * rand(0.8, 1.1), _c.b, 1, 4, 2.5);
    }
    this.sparks(pos, 6 + r * 2, 0xffd28a, r * 4, 0.3, 0.8);
    const sm = Math.round((3 + r) * this.pmul);
    for (let i = 0; i < sm; i++) this.smokePuff(_v.copy(pos).add(new THREE.Vector3(rand(-r, r) * 0.5, rand(0, r * 0.5), rand(-r, r) * 0.5)), r * 0.8, rand(1.2, 2.2), 0.18, rand(1, 4));
    this.addShake(shake);
  }

  addShake(a) { this.shake = Math.min(1.5, this.shake + a); }

  // ---------------- telegraph (ground warning) ----------------
  telegraph(x, z, radius, color = 0xff3030, life = 1.5) {
    const fill = new THREE.Mesh(this.telGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending }));
    const ring = new THREE.Mesh(this.telRingGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    fill.position.set(x, 0.12, z); ring.position.set(x, 0.14, z);
    fill.scale.setScalar(0.01); ring.scale.setScalar(radius);
    this.scene.add(fill, ring);
    const t = { fill, ring, t: 0, life, radius };
    this.telegraphs.push(t);
    return t;
  }

  // ---------------- damage numbers ----------------
  number(pos, amount, color = '#fff', crit = false) {
    if (!this.showNumbers || !this.numLayer) return;
    let el = this.nums.find((n) => !n.active);
    if (!el) {
      if (this.nums.length > 40) return;
      const d = document.createElement('div'); d.className = 'dmgnum'; this.numLayer.appendChild(d);
      el = { d, active: false }; this.nums.push(el);
    }
    el.active = true; el.t = 0; el.pos = pos.clone(); el.pos.x += rand(-0.6, 0.6);
    el.d.textContent = Math.round(amount);
    el.d.style.color = color;
    el.d.style.fontSize = crit ? '22px' : '15px';
    el.d.style.display = 'block';
    el.crit = crit;
  }

  update(dt) {
    this.glow.update(dt); this.smoke.update(dt);
    for (const f of this.flashes) {
      if (!f.m.visible) continue;
      f.t += dt; const k = f.t / f.life;
      if (k >= 1) { f.m.visible = false; continue; }
      f.m.scale.setScalar(f.r * (0.4 + k * 0.8)); f.m.material.opacity = (1 - k) * 0.9;
    }
    for (const r of this.rings) {
      if (!r.m.visible) continue;
      r.t += dt; const k = r.t / r.life;
      if (k >= 1) { r.m.visible = false; continue; }
      r.m.scale.setScalar(r.r * (0.2 + k)); r.m.material.opacity = (1 - k) * 0.8;
    }
    for (const t of this.tracers) {
      if (!t.m.visible) continue;
      t.t += dt; const k = t.t / t.life;
      if (k >= 1) { t.m.visible = false; continue; }
      t.m.material.opacity = 1 - k; const w = t.w * (1 - k * 0.6); t.m.scale.x = w; t.m.scale.y = w;
    }
    for (const L of this.lights) {
      if (L.l.intensity <= 0) continue;
      L.t += dt; L.l.intensity = Math.max(0, L.i0 * (1 - L.t / L.life));
    }
    for (let i = this.telegraphs.length - 1; i >= 0; i--) {
      const t = this.telegraphs[i];
      t.t += dt; const k = Math.min(1, t.t / t.life);
      t.fill.scale.setScalar(Math.max(0.01, t.radius * k));
      t.fill.material.opacity = 0.1 + 0.2 * k;
      t.ring.material.opacity = 0.5 + 0.5 * Math.sin(t.t * 20);
      if (t.t >= t.life) {
        this.scene.remove(t.fill, t.ring); t.fill.material.dispose(); t.ring.material.dispose();
        this.telegraphs.splice(i, 1);
      }
    }
    this.shake = Math.max(0, this.shake - dt * 2.2);
    // numbers
    if (this.nums.length) {
      const w = window.innerWidth, h = window.innerHeight;
      for (const n of this.nums) {
        if (!n.active) continue;
        n.t += dt;
        if (n.t > 0.9) { n.active = false; n.d.style.display = 'none'; continue; }
        _v.copy(n.pos); _v.y += n.t * 3;
        _v.project(this.camera);
        if (_v.z > 1) { n.d.style.display = 'none'; continue; }
        n.d.style.display = 'block';
        n.d.style.transform = `translate(${(_v.x * 0.5 + 0.5) * w}px, ${(-_v.y * 0.5 + 0.5) * h}px) translate(-50%,-50%) scale(${n.crit ? 1.2 - n.t * 0.3 : 1})`;
        n.d.style.opacity = String(1 - Math.max(0, n.t - 0.5) / 0.4);
      }
    }
  }

  dispose() {
    for (const n of this.nums) n.d.remove();
    this.nums = [];
    for (const t of this.telegraphs) { this.scene.remove(t.fill, t.ring); }
    this.glow.geo.dispose(); this.smoke.geo.dispose(); this.glow.mat.dispose(); this.smoke.mat.dispose();
  }
}
