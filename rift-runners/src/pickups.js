import * as THREE from 'three';
import { InstancePool } from './pool.js';
import { PLAYER_BASE } from './config.js';

const MAX_PICKUPS = 450;

function xpColor(v) {
  if (v >= 20) return [1.0, 0.75, 0.25];
  if (v >= 6) return [0.8, 0.4, 1.0];
  if (v >= 2) return [0.35, 1.0, 0.6];
  return [0.3, 0.75, 1.0];
}

// Experience crystals and healing hearts.
export class Pickups {
  constructor(scene) {
    this.list = [];
    this.pool = new InstancePool(
      new THREE.OctahedronGeometry(0.25, 0),
      new THREE.MeshBasicMaterial({ color: '#ffffff' }),
      MAX_PICKUPS
    );
    this.glow = new InstancePool(
      new THREE.OctahedronGeometry(0.42, 0),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }),
      MAX_PICKUPS
    );
    scene.add(this.pool.mesh, this.glow.mesh);
  }

  clear() { this.list.length = 0; }

  drop(x, z, value, kind = 'xp', extra = null) {
    if (this.list.length >= MAX_PICKUPS && kind === 'xp') {
      // Merge into an existing crystal instead of dropping XP.
      const o = this.list[Math.floor(Math.random() * this.list.length)];
      if (o.kind === 'xp' && kind === 'xp') { o.value += value; return; }
      return;
    }
    const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 2;
    this.list.push({ x, z, y: 0.5, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: 3, value, kind, extra, magnet: false, t: Math.random() * 6 });
  }

  vacuum() { for (const p of this.list) p.magnet = true; }

  update(dt, game) {
    const pl = game.player;
    const radius = PLAYER_BASE.pickupRadius * game.stats.pickupMult;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.t += dt;
      // pop-out arc
      if (p.vy !== 0 || p.y > 0.5) {
        p.vy -= 14 * dt; p.y += p.vy * dt;
        if (p.y <= 0.5) { p.y = 0.5; p.vy = 0; }
      }
      const dx = pl.x - p.x, dz = pl.z - p.z;
      const d = Math.hypot(dx, dz);
      if (!p.magnet && (d < radius || (p.kind === 'gold' && game.stats.relic.voidmagnet)) && p.kind !== 'chest') p.magnet = true;
      if (p.magnet) {
        const sp = 10 + Math.max(0, 22 - d) * 0.8 + p.t * 2;
        p.vx = (dx / (d || 1)) * sp; p.vz = (dz / (d || 1)) * sp;
      } else {
        const damp = Math.exp(-4 * dt);
        p.vx *= damp; p.vz *= damp;
      }
      p.x += p.vx * dt; p.z += p.vz * dt;
      if (d < (p.kind === 'chest' ? 1.4 : 0.75) && pl.alive) {
        if (p.kind === 'xp') { game.gainXp(p.value); game.objectives.onCrystal(); }
        else if (p.kind === 'gold') game.addGold(p.value);
        else if (p.kind === 'chest') game.openRelicChest(p.extra || {});
        else game.heal(p.value);
        this.list[i] = this.list[this.list.length - 1];
        this.list.pop();
      }
    }
  }

  render(t) {
    this.pool.begin(); this.glow.begin();
    for (const p of this.list) {
      const bob = Math.sin(t * 4 + p.t) * 0.12;
      if (p.kind === 'xp') {
        const [r, g, b] = xpColor(p.value);
        const s = 0.85 + Math.min(1.4, Math.sqrt(p.value) * 0.28);
        this.pool.push(p.x, p.y + bob, p.z, t * 2 + p.t, s, s * 1.4, s, r, g, b);
        this.glow.push(p.x, p.y + bob, p.z, -t * 2, s, s * 1.2, s, r, g, b);
      } else if (p.kind === 'gold') {
        const s = 0.9 + Math.min(0.8, p.value * 0.03);
        this.pool.push(p.x, p.y + bob, p.z, t * 4 + p.t, s * 1.2, s * 0.5, s * 1.2, 1, 0.8, 0.2);
        this.glow.push(p.x, p.y + bob, p.z, 0, s, s * 0.6, s, 1, 0.7, 0.1);
      } else if (p.kind === 'chest') {
        const s = 2.6 + Math.sin(t * 4) * 0.2;
        this.pool.push(p.x, p.y + 0.5 + bob, p.z, t * 1.5, s, s * 1.3, s, 0.8, 0.45, 1);
        this.glow.push(p.x, p.y + 0.5 + bob, p.z, -t, s * 1.4, s * 1.6, s * 1.4, 1, 0.75, 0.3);
      } else {
        const s = 1.6 + Math.sin(t * 6) * 0.15;
        this.pool.push(p.x, p.y + 0.3 + bob, p.z, t * 2, s, s, s, 1, 0.3, 0.45);
        this.glow.push(p.x, p.y + 0.3 + bob, p.z, t, s * 1.3, s * 1.3, s * 1.3, 1, 0.3, 0.45);
      }
    }
    this.pool.end(); this.glow.end();
  }
}
