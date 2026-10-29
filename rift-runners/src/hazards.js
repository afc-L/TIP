import * as THREE from 'three';
import { InstancePool } from './pool.js';

const near = [];

// Delayed, telegraphed area attacks (enemy or player owned), lobbed shells, falling meteors and
// lingering damage pools. Everything that "hits a marked spot later" goes through here so all
// warnings look and behave the same.
export class Hazards {
  constructor(scene, game) {
    this.game = game;
    this.list = [];
    this.pools = [];
    const add = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.shellPool = new InstancePool(new THREE.IcosahedronGeometry(0.45, 1), add('#ffffff'), 64);
    this.rockPool = new InstancePool(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: '#5a3a2a', flatShading: true, emissive: '#ff5a1a', emissiveIntensity: 0.6 }), 24);
    this.zonePool = new InstancePool(new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2), add('#ffffff'), 48);
    this.zonePool.mesh.renderOrder = 1;
    scene.add(this.shellPool.mesh, this.rockPool.mesh, this.zonePool.mesh);
  }

  clear() {
    for (const h of this.list) if (h.tele) this.game.effects.hideTele(h.tele);
    this.list.length = 0;
    this.pools.length = 0;
  }

  // o: { x, z, r, delay, damage, owner: 'enemy'|'player', color, shell: {x, z, h}, meteor, onDone, scaleTele }
  add(o) {
    const g = this.game;
    const delay = o.owner === 'player' ? o.delay : o.delay * (o.noScale ? 1 : g.diff.telegraph);
    const color = o.color || (o.owner === 'player' ? '#5ad1ff' : '#ff3355');
    const h = { ...o, owner: o.owner || 'enemy', t: delay, dur: delay, color };
    h.tele = g.effects.teleCircle(o.x, o.z, o.r, delay, color);
    this.list.push(h);
    return h;
  }

  addPool(x, z, r, dur, dps, color = '#7dff3a', owner = 'enemy') {
    if (this.pools.length >= 40) this.pools.shift();
    this.pools.push({ x, z, r, t: dur, dur, dps, color: new THREE.Color(color), owner, tick: 0 });
  }

  inPool(x, z) {
    for (const p of this.pools) if (p.owner === 'enemy' && (p.x - x) ** 2 + (p.z - z) ** 2 < p.r * p.r) return true;
    return false;
  }

  update(dt) {
    const g = this.game, pl = g.player;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const h = this.list[i];
      h.t -= dt;
      if (h.t > 0) continue;
      this.list.splice(i, 1);
      if (h.tele) g.effects.hideTele(h.tele);
      this.detonate(h);
    }
    for (let i = this.pools.length - 1; i >= 0; i--) {
      const p = this.pools[i];
      p.t -= dt;
      if (p.t <= 0) { this.pools.splice(i, 1); continue; }
      p.tick -= dt;
      if (p.tick > 0) continue;
      p.tick = 0.5;
      if (p.owner === 'enemy') {
        if (pl.alive && (pl.x - p.x) ** 2 + (pl.z - p.z) ** 2 < p.r * p.r) g.damagePlayer(p.dps * 0.5, undefined, undefined, { noKnock: true });
      } else {
        g.enemies.grid.query(p.x, p.z, p.r + 3, near);
        for (const e of near) if (!e.dead && (e.x - p.x) ** 2 + (e.z - p.z) ** 2 < (p.r + e.radius) ** 2) g.enemies.damage(e, p.dps * 0.5, 'burn', 0, 0);
      }
    }
  }

  detonate(h) {
    const g = this.game, fx = g.effects, pl = g.player;
    fx.ring(h.x, h.z, 0.3, h.r, 0.35, h.color, 0.25);
    fx.burst(h.x, 0.4, h.z, Math.round(10 * g.particleScale), h.color, 9, 0.5, 0.24, 10);
    if (h.r > 2.4) fx.shake(0.15);
    g.sound.play(h.meteor ? 'explode' : 'slam');
    if (h.owner === 'enemy') {
      if (pl.alive && Math.hypot(pl.x - h.x, pl.z - h.z) < h.r + pl.radius * 0.5) g.damagePlayer(h.damage, h.x, h.z);
    } else {
      g.enemies.grid.query(h.x, h.z, h.r + 3, near);
      const list = near.slice();
      for (const e of list) {
        if (e.dead) continue;
        if ((e.x - h.x) ** 2 + (e.z - h.z) ** 2 > (h.r + e.radius) ** 2) continue;
        g.combat.hit(e, h.damage, { procs: false, status: true, kbX: e.x - h.x, kbZ: e.z - h.z, kb: 2 });
      }
    }
    if (h.onDone) h.onDone(h);
  }

  render(t) {
    this.shellPool.begin(); this.rockPool.begin(); this.zonePool.begin();
    const c = new THREE.Color();
    for (const h of this.list) {
      const f = 1 - h.t / h.dur;
      if (h.shell) {
        const x = h.shell.x + (h.x - h.shell.x) * f, z = h.shell.z + (h.z - h.shell.z) * f;
        const y = 1 + Math.sin(f * Math.PI) * h.shell.h;
        c.set(h.color);
        this.shellPool.push(x, y, z, t * 6, 1, 1, 1, c.r, c.g, c.b);
      }
      if (h.meteor && h.t < 0.55) {
        const k = h.t / 0.55;
        const s = h.r * 0.38;
        this.rockPool.push(h.x + k * 4, 0.6 + k * 16, h.z - k * 3, t * 4, s, s, s);
      }
    }
    for (const p of this.pools) {
      const fade = Math.min(1, p.t / 0.6, (p.dur - p.t) / 0.3 + 0.2);
      const pulse = 0.75 + Math.sin(t * 5 + p.x) * 0.15;
      this.zonePool.push(p.x, 0.06, p.z, 0, p.r, 1, p.r, p.color.r * 0.5 * fade * pulse, p.color.g * 0.5 * fade * pulse, p.color.b * 0.5 * fade * pulse);
    }
    this.shellPool.end(); this.rockPool.end(); this.zonePool.end();
  }
}
