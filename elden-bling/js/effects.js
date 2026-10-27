// Pooled effects: particles, shockwave rings, ground telegraphs, projectiles, floating text.
import * as THREE from 'three';
import { projectileModel } from './models.js';
import { groundHeight } from './collision.js';

class Particles {
  constructor(scene, max, additive, size) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.base = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.next = 0;
    this.alive = 0;
    for (let i = 0; i < max; i++) this.pos[i * 3 + 1] = -999;
    const g = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.posAttr);
    g.setAttribute('color', this.colAttr);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.points = new THREE.Points(g, new THREE.PointsMaterial({
      size, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
    this.additive = additive;
    scene.add(this.points);
  }

  emit(x, y, z, vx, vy, vz, color, life, grav) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    const k = i * 3;
    this.pos[k] = x; this.pos[k + 1] = y; this.pos[k + 2] = z;
    this.vel[k] = vx; this.vel[k + 1] = vy; this.vel[k + 2] = vz;
    this.base[k] = ((color >> 16) & 255) / 255;
    this.base[k + 1] = ((color >> 8) & 255) / 255;
    this.base[k + 2] = (color & 255) / 255;
    this.col[k] = this.base[k]; this.col[k + 1] = this.base[k + 1]; this.col[k + 2] = this.base[k + 2];
    this.life[i] = life; this.maxLife[i] = life; this.grav[i] = grav;
  }

  update(dt) {
    let any = false;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      const k = i * 3;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[k + 1] = -999; continue; }
      this.vel[k + 1] -= this.grav[i] * dt;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      if (this.additive) {
        const f = this.life[i] / this.maxLife[i];
        this.col[k] = this.base[k] * f; this.col[k + 1] = this.base[k + 1] * f; this.col[k + 2] = this.base[k + 2] * f;
      }
    }
    if (any || this.wasAny) {
      this.posAttr.needsUpdate = true;
      this.colAttr.needsUpdate = true;
    }
    this.wasAny = any;
  }
}

export class Effects {
  constructor(game) {
    this.game = game;
    const scene = game.scene;
    const n = game.preset.particles;
    this.glow = new Particles(scene, n, true, 0.32);
    this.chunks = new Particles(scene, Math.floor(n * 0.6), false, 0.2);
    this.density = n / 260;

    this.rings = [];
    const ringGeo = new THREE.RingGeometry(0.88, 1, 40).rotateX(-Math.PI / 2);
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffee88, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
      m.visible = false; m.renderOrder = 2;
      scene.add(m);
      this.rings.push({ mesh: m, active: false });
    }

    this.teles = [];
    const discGeo = new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2);
    const edgeGeo = new THREE.RingGeometry(0.93, 1, 28).rotateX(-Math.PI / 2);
    for (let i = 0; i < 10; i++) {
      const g = new THREE.Group();
      const fill = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: 0xff3322, transparent: true, opacity: 0.3, depthWrite: false }));
      const edge = new THREE.Mesh(edgeGeo, new THREE.MeshBasicMaterial({ color: 0xff5533, transparent: true, opacity: 0.8, depthWrite: false }));
      g.add(fill, edge); g.visible = false; g.renderOrder = 2;
      scene.add(g);
      this.teles.push({ group: g, fill, active: false });
    }

    // Projectiles are pooled per kind and created on first use (max 10 of each kind).
    this.projectiles = [];

    // DOM floating text pools.
    this.layer = document.getElementById('float-layer');
    this.nums = [];
    for (let i = 0; i < 20; i++) {
      const el = document.createElement('div');
      el.className = 'dmg';
      el.style.display = 'none';
      this.layer.appendChild(el);
      this.nums.push({ el, active: false, pos: new THREE.Vector3(), t: 0 });
    }
    this.bubbles = [];
    for (let i = 0; i < 5; i++) {
      const el = document.createElement('div');
      el.className = 'bubble';
      el.style.display = 'none';
      this.layer.appendChild(el);
      this.bubbles.push({ el, active: false, target: null, t: 0, offset: 2 });
    }
    this.tmp = new THREE.Vector3();
  }

  addProjectile(kind, obj) {
    obj.visible = false;
    this.game.scene.add(obj);
    this.projectiles.push({ kind, obj, active: false, pos: new THREE.Vector3(), vel: new THREE.Vector3() });
  }

  burst(x, y, z, color, count, { speed = 4, life = 0.6, grav = 6, up = 2, glow = true } = {}) {
    const sys = glow ? this.glow : this.chunks;
    count = Math.max(1, Math.round(count * this.density));
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      sys.emit(x, y, z, Math.cos(a) * s, up * (0.5 + Math.random()), Math.sin(a) * s, color, life * (0.6 + Math.random() * 0.6), grav);
    }
  }

  rise(x, y, z, color, count, radius = 0.6) {
    count = Math.max(1, Math.round(count * this.density));
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * radius;
      this.glow.emit(x + Math.cos(a) * r, y + Math.random() * 0.5, z + Math.sin(a) * r, 0, 1.5 + Math.random() * 1.5, 0, color, 0.8 + Math.random() * 0.6, -0.5);
    }
  }

  // Expanding shockwave: damages the player as the ring passes unless they roll through it.
  ring(x, z, { speed = 9, maxR = 14, dmg = 20, color = 0xffee88, width = 0.9 } = {}) {
    const r = this.rings.find((o) => !o.active);
    if (!r) return;
    r.active = true; r.x = x; r.z = z; r.r = 0.5; r.speed = speed; r.maxR = maxR; r.dmg = dmg; r.hit = false; r.width = width;
    r.mesh.material.color.setHex(color);
    r.mesh.visible = true;
    r.mesh.position.set(x, groundHeight(x, z) + 0.08, z);
  }

  // Red ground warning that fills up until something lands.
  telegraph(x, z, radius, time) {
    const t = this.teles.find((o) => !o.active);
    if (!t) return null;
    t.active = true; t.t = 0; t.time = time;
    t.group.visible = true;
    t.group.position.set(x, groundHeight(x, z) + 0.06, z);
    t.group.scale.setScalar(radius);
    t.fill.scale.setScalar(0.01);
    return t;
  }

  spawnProjectile(kind, from, vel, opts) {
    let p = this.projectiles.find((o) => o.kind === kind && !o.active);
    if (!p) {
      if (this.projectiles.filter((o) => o.kind === kind).length >= 10) return null;
      this.addProjectile(kind, projectileModel(kind));
      p = this.projectiles[this.projectiles.length - 1];
    }
    p.active = true;
    p.pos.copy(from); p.vel.copy(vel);
    p.dmg = opts.dmg; p.grav = opts.grav ?? 9.8; p.radius = opts.radius ?? 0.5; p.poison = opts.poison || 0;
    p.splash = opts.splash || 0; p.life = opts.life ?? 4; p.tele = opts.tele || null; p.spin = Math.random() * 6;
    p.chill = opts.chill || 0; p.friendly = !!opts.friendly;
    p.obj.visible = true;
    p.obj.position.copy(from);
    return p;
  }

  clearHostile() {
    for (const p of this.projectiles) { p.active = false; p.obj.visible = false; }
    for (const r of this.rings) { r.active = false; r.mesh.visible = false; }
    for (const t of this.teles) { t.active = false; t.group.visible = false; }
  }

  number(pos, text, cls = '') {
    const n = this.nums.find((o) => !o.active) || this.nums[0];
    n.active = true; n.t = 0;
    n.pos.copy(pos);
    n.pos.x += (Math.random() - 0.5) * 0.5;
    n.el.textContent = text;
    n.el.className = 'dmg ' + cls;
    n.el.style.display = 'block';
  }

  say(target, text, dur = 2.6, offset = 2.2) {
    let b = this.bubbles.find((o) => o.target === target && o.active) || this.bubbles.find((o) => !o.active);
    if (!b) b = this.bubbles.reduce((a, c) => (a.t > c.t ? a : c));
    b.active = true; b.t = 0; b.dur = dur; b.target = target; b.offset = offset;
    b.el.textContent = text;
    b.el.style.display = 'block';
  }

  clearBubbles() { for (const b of this.bubbles) { b.active = false; b.el.style.display = 'none'; } }

  project(v) {
    const g = this.game;
    this.tmp.copy(v).project(g.camera);
    if (this.tmp.z > 1) return null;
    return [(this.tmp.x * 0.5 + 0.5) * g.viewW, (-this.tmp.y * 0.5 + 0.5) * g.viewH];
  }

  update(dt) {
    const g = this.game;
    const player = g.player;
    this.glow.update(dt);
    this.chunks.update(dt);

    for (const r of this.rings) {
      if (!r.active) continue;
      r.r += r.speed * dt;
      r.mesh.scale.set(r.r, 1, r.r);
      r.mesh.material.opacity = 0.85 * (1 - r.r / r.maxR);
      if (!r.hit && player.alive) {
        const d = Math.hypot(player.pos.x - r.x, player.pos.z - r.z);
        if (Math.abs(d - r.r) < r.width && player.pos.y - groundHeight(player.pos.x, player.pos.z) < 0.5) {
          r.hit = true;
          g.damagePlayer(r.dmg, r.x, r.z, { knock: 7 });
        }
      }
      if (r.r >= r.maxR) { r.active = false; r.mesh.visible = false; }
    }

    for (const t of this.teles) {
      if (!t.active) continue;
      t.t += dt;
      const f = Math.min(1, t.t / t.time);
      t.fill.scale.setScalar(Math.max(0.01, f));
      if (t.t >= t.time + 0.15) { t.active = false; t.group.visible = false; }
    }

    for (const p of this.projectiles) {
      if (!p.active) continue;
      p.life -= dt;
      p.vel.y -= p.grav * dt;
      p.pos.addScaledVector(p.vel, dt);
      p.obj.position.copy(p.pos);
      p.spin += dt * 8;
      if (p.kind === 'resume' || p.kind === 'coin' || p.kind === 'pan') { p.obj.rotation.y = p.spin; p.obj.rotation.x = Math.sin(p.spin) * 0.4; }
      else if (p.kind === 'needle') p.obj.rotation.y = Math.atan2(p.vel.x, p.vel.z);
      else if (p.kind !== 'slime' && p.kind !== 'snowball') p.obj.rotation.x = p.spin;
      if (p.friendly) {
        // The player's soda bomb: explodes on landing.
        if (p.pos.y <= groundHeight(p.pos.x, p.pos.z) || p.life <= 0) { g.explodeAt(p.pos.x, p.pos.z, p.splash, p.dmg); this.kill(p); }
        continue;
      }
      if (p.kind === 'slime' && Math.random() < 0.3) this.chunks.emit(p.pos.x, p.pos.y, p.pos.z, 0, 0, 0, 0x66ee44, 0.3, 1);
      const gy = groundHeight(p.pos.x, p.pos.z);
      // Direct hit (not for splash projectiles: they hurt where they land).
      if (!p.splash && player.alive) {
        const dx = player.pos.x - p.pos.x, dy = player.pos.y + 1 - p.pos.y, dz = player.pos.z - p.pos.z;
        if (dx * dx + dy * dy + dz * dz < (p.radius + 0.45) ** 2) {
          g.damagePlayer(p.dmg, p.pos.x - p.vel.x, p.pos.z - p.vel.z, { poison: p.poison, chill: p.chill, knock: 3 });
          this.burst(p.pos.x, p.pos.y, p.pos.z, p.kind === 'slime' ? 0x66ff44 : p.kind === 'coin' ? 0xffcc22 : 0xffffff, 8, { glow: false });
          g.audio.play('splat');
          this.kill(p);
          continue;
        }
      }
      if (p.pos.y <= gy || p.life <= 0) {
        if (p.splash) {
          g.audio.play('stomp');
          this.burst(p.pos.x, gy + 0.2, p.pos.z, 0xaa8855, 14, { glow: false, speed: 5 });
          this.burst(p.pos.x, gy + 0.2, p.pos.z, 0xffcc66, 8, { speed: 4 });
          const d = Math.hypot(player.pos.x - p.pos.x, player.pos.z - p.pos.z);
          if (d < p.splash + 0.4) g.damagePlayer(p.dmg, p.pos.x, p.pos.z, { knock: 6 });
        } else {
          this.burst(p.pos.x, gy + 0.1, p.pos.z, p.kind === 'slime' ? 0x55dd33 : 0xffffff, 6, { glow: false, speed: 2 });
          if (p.kind === 'slime') g.world.addSlimePuddle(p.pos.x, p.pos.z);
        }
        this.kill(p);
      }
    }

    for (const n of this.nums) {
      if (!n.active) continue;
      n.t += dt;
      n.pos.y += dt * 1.2;
      const s = this.project(n.pos);
      if (!s || n.t > 0.9) { n.active = false; n.el.style.display = 'none'; continue; }
      n.el.style.transform = `translate(${s[0]}px, ${s[1]}px) translate(-50%, -50%)`;
      n.el.style.opacity = String(Math.min(1, 2 - n.t * 2.2));
    }
    for (const b of this.bubbles) {
      if (!b.active) continue;
      b.t += dt;
      const tg = b.target;
      if (b.t > b.dur || !tg || tg.hidden) { b.active = false; b.el.style.display = 'none'; continue; }
      this.tmp.set(tg.pos.x, tg.pos.y + b.offset, tg.pos.z);
      const dist = this.tmp.distanceTo(g.camera.position);
      const s = dist < 40 ? this.project(this.tmp) : null;
      if (!s) { b.el.style.display = 'none'; continue; }
      b.el.style.display = 'block';
      b.el.style.transform = `translate(${s[0]}px, ${s[1]}px) translate(-50%, -100%)`;
    }
  }

  kill(p) {
    p.active = false;
    p.obj.visible = false;
    if (p.tele) { p.tele.active = false; p.tele.group.visible = false; }
  }
}
