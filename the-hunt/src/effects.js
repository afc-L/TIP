import * as THREE from 'three';
import { glowTexture } from './textures.js';
import { rand } from './util.js';

// Fires, impact puffs and a small pool of point lights shared by every light source,
// so the number of lights (and therefore shader programs) never changes.

const flameTex = glowTexture('rgba(255,220,140,1)', 'rgba(255,90,10,0)');
const smokeTex = glowTexture('rgba(120,120,120,0.6)', 'rgba(60,60,60,0)');

export class Fire {
  constructor(scene, pos, size = 1) {
    this.group = new THREE.Group();
    this.group.position.copy(pos);
    scene.add(this.group);
    this.size = size;
    this.flames = [];
    const n = Math.round(10 * size);
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: true }));
      s.userData = { ph: rand(), sp: 0.8 + rand() * 0.8, ox: (rand() - 0.5) * 0.5 * size, oz: (rand() - 0.5) * 0.5 * size };
      this.group.add(s);
      this.flames.push(s);
    }
    this.smoke = [];
    for (let i = 0; i < Math.round(6 * size); i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, depthWrite: false, transparent: true, opacity: 0.3 }));
      s.userData = { ph: rand(), ox: (rand() - 0.5) * 0.4 };
      this.group.add(s);
      this.smoke.push(s);
    }
    this.lit = false;
    this.group.visible = false;
    this.light = { pos: pos.clone().add(new THREE.Vector3(0, 0.8 * size, 0)), color: new THREE.Color(0xff8a3a), intensity: 0, range: 18 * size, flicker: true, active: false };
  }

  setLit(on) {
    this.lit = on;
    this.group.visible = on;
    this.light.active = on;
  }

  update(dt, t) {
    if (!this.lit) return;
    const s = this.size;
    for (const f of this.flames) {
      const u = f.userData;
      u.ph += dt * u.sp;
      const k = u.ph % 1;
      f.position.set(u.ox * (1 - k), k * 1.3 * s, u.oz * (1 - k));
      const sc = (1 - k) * 0.9 * s + 0.15;
      f.scale.set(sc * 0.8, sc * 1.3, 1);
      f.material.opacity = Math.sin(k * Math.PI) * 0.9;
    }
    for (const m of this.smoke) {
      const u = m.userData;
      u.ph += dt * 0.15;
      const k = u.ph % 1;
      m.position.set(u.ox + k * 0.8, 1.2 * s + k * 5 * s, k * 0.3);
      m.scale.setScalar((0.6 + k * 2.5) * s);
      m.material.opacity = Math.sin(k * Math.PI) * 0.18;
    }
    this.light.intensity = (14 + Math.sin(t * 13) * 2 + Math.sin(t * 7.3) * 2 + rand() * 1.5) * s;
  }
}

export class LightPool {
  constructor(scene, n = 2) {
    this.lights = [];
    for (let i = 0; i < n; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 20, 1.6);
      scene.add(l);
      this.lights.push(l);
    }
    this.sources = [];
  }
  add(src) { this.sources.push(src); return src; }
  update(px, pz) {
    const act = this.sources.filter((s) => s.active && s.intensity > 0)
      .map((s) => ({ s, d: Math.hypot(s.pos.x - px, s.pos.z - pz) }))
      .filter((o) => o.d < o.s.range + 60)
      .sort((a, b) => a.d - b.d);
    this.lights.forEach((l, i) => {
      const o = act[i];
      if (!o) { l.intensity = 0; return; }
      l.position.copy(o.s.pos);
      l.color.copy(o.s.color);
      l.intensity = o.s.intensity;
      l.distance = o.s.range;
    });
  }
}

export class Puffs {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.mat = new THREE.SpriteMaterial({ map: smokeTex, depthWrite: false, transparent: true, opacity: 0.6, color: 0x9a8a70 });
  }
  spawn(pos, color = 0x9a8a70, scale = 0.6) {
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Sprite(this.mat.clone());
      s.material.color.set(color);
      s.position.copy(pos);
      s.userData = { v: new THREE.Vector3((rand() - 0.5) * 1.5, rand() * 1.5, (rand() - 0.5) * 1.5), t: 0, sc: scale };
      this.scene.add(s);
      this.list.push(s);
    }
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const s = this.list[i];
      const u = s.userData;
      u.t += dt;
      s.position.addScaledVector(u.v, dt);
      s.scale.setScalar(u.sc * (1 + u.t * 2));
      s.material.opacity = Math.max(0, 0.6 - u.t * 0.6);
      if (u.t > 1) { this.scene.remove(s); s.material.dispose(); this.list.splice(i, 1); }
    }
  }
}
