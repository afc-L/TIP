import * as THREE from 'three';
import { InstancePool } from './pool.js';
import { ARENA_RADIUS, MAX_PLAYER_PROJECTILES, MAX_ENEMY_PROJECTILES } from './config.js';

const additive = (color) => new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
const near = [];
const tmpC = new THREE.Color();

export class Projectiles {
  constructor(scene) {
    this.player = [];
    this.enemy = [];
    this.free = [];

    const boltGeo = new THREE.IcosahedronGeometry(1, 0);
    this.pools = {
      bolt: new InstancePool(boltGeo, additive('#ffffff'), MAX_PLAYER_PROJECTILES),
      boltCore: new InstancePool(boltGeo, additive('#ffffff'), MAX_PLAYER_PROJECTILES),
      orb: new InstancePool(new THREE.IcosahedronGeometry(1, 1), additive('#ffffff'), 32),
      orbCore: new InstancePool(new THREE.IcosahedronGeometry(1, 1), additive('#ffffff'), 32),
      enemy: new InstancePool(new THREE.IcosahedronGeometry(1, 1), additive('#ffffff'), MAX_ENEMY_PROJECTILES),
      enemyCore: new InstancePool(new THREE.IcosahedronGeometry(1, 0), additive('#ffffff'), MAX_ENEMY_PROJECTILES),
    };
    for (const p of Object.values(this.pools)) scene.add(p.mesh);
  }

  obtain() { return this.free.pop() || { hits: [] }; }

  spawnPlayer(kind, x, z, dx, dz, speed, damage, life, radius, pierce, color) {
    if (this.player.length >= MAX_PLAYER_PROJECTILES) return null;
    const p = this.obtain();
    p.kind = kind; p.x = x; p.z = z; p.y = 1.0; p.vx = dx * speed; p.vz = dz * speed;
    p.damage = damage; p.life = life; p.radius = radius; p.pierce = pierce;
    p.hits.length = 0; p.dead = false; p.t = 0;
    const c = tmpC.set(color);
    p.r = c.r; p.g = c.g; p.b = c.b;
    this.player.push(p);
    return p;
  }

  spawnEnemy(kind, x, z, dx, dz, speed, damage, radius = 0.38, life = 4, color = '#9dff3a') {
    if (this.enemy.length >= MAX_ENEMY_PROJECTILES) return null;
    const p = this.obtain();
    p.kind = kind; p.x = x; p.z = z; p.y = 1.0; p.vx = dx * speed; p.vz = dz * speed;
    p.damage = damage; p.life = life; p.radius = radius; p.dead = false; p.t = 0;
    const c = tmpC.set(color);
    p.r = c.r; p.g = c.g; p.b = c.b;
    this.enemy.push(p);
    return p;
  }

  removeAt(list, i) {
    const p = list[i];
    list[i] = list[list.length - 1];
    list.pop();
    this.free.push(p);
  }

  clear() {
    this.epoch = (this.epoch || 0) + 1; // lets update() notice a clear that happened mid-iteration
    for (const p of this.player) this.free.push(p);
    for (const p of this.enemy) this.free.push(p);
    this.player.length = 0;
    this.enemy.length = 0;
  }

  clearEnemyNear(x, z, r) {
    for (let i = this.enemy.length - 1; i >= 0; i--) {
      const p = this.enemy[i];
      if ((p.x - x) ** 2 + (p.z - z) ** 2 < r * r) this.removeAt(this.enemy, i);
    }
  }

  update(dt, game) {
    const world = game.world;
    const lim2 = (ARENA_RADIUS + 3) ** 2;
    const epoch = this.epoch;

    for (let i = this.player.length - 1; i >= 0; i--) {
      const p = this.player[i];
      p.t += dt;
      p.life -= dt;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      if (p.life <= 0 || p.x * p.x + p.z * p.z > lim2) {
        if (p.kind === 'orb') game.combat.orbExpire(p);
        this.removeAt(this.player, i);
        continue;
      }
      if (world.insideObstacle(p.x, p.z)) {
        game.effects.burst(p.x, p.y, p.z, 4, '#c9b8ff', 4, 0.25, 0.12);
        if (p.kind === 'orb') game.combat.orbExpire(p);
        this.removeAt(this.player, i);
        continue;
      }
      game.enemies.grid.query(p.x, p.z, p.radius + 3.2, near);
      for (let k = 0; k < near.length; k++) {
        const e = near[k];
        if (e.dead || p.hits.includes(e.id)) continue;
        const r = e.radius + p.radius;
        if ((e.x - p.x) ** 2 + (e.z - p.z) ** 2 > r * r) continue;
        p.hits.push(e.id);
        game.combat.projectileHit(p, e);
        if (this.epoch !== epoch) return;
        if (p.pierce-- <= 0) { p.dead = true; break; }
      }
      if (p.dead) {
        if (p.kind === 'orb') game.combat.orbExpire(p);
        this.removeAt(this.player, i);
      }
    }

    const pl = game.player;
    for (let i = this.enemy.length - 1; i >= 0; i--) {
      const p = this.enemy[i];
      p.t += dt;
      p.life -= dt;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      if (p.life <= 0 || p.x * p.x + p.z * p.z > lim2 || world.insideObstacle(p.x, p.z)) {
        game.effects.burst(p.x, p.y, p.z, 3, '#ffffff', 3, 0.2, 0.1);
        this.removeAt(this.enemy, i);
        continue;
      }
      const r = pl.radius + p.radius;
      if (pl.alive && (pl.x - p.x) ** 2 + (pl.z - p.z) ** 2 < r * r && pl.invuln <= 0) {
        game.damagePlayer(p.damage, p.x, p.z);
        game.effects.burst(p.x, p.y, p.z, 6, '#ff6b6b', 4, 0.3, 0.14);
        if (this.epoch !== epoch) return;
        this.removeAt(this.enemy, i);
      }
    }
  }

  render(t) {
    const P = this.pools;
    for (const pool of Object.values(P)) pool.begin();
    for (const p of this.player) {
      const rot = Math.atan2(p.vx, p.vz);
      if (p.kind === 'orb') {
        const s = p.radius * (1 + Math.sin(t * 14 + p.x) * 0.08);
        P.orb.push(p.x, p.y, p.z, t * 3, s, s, s, p.r * 0.9, p.g * 0.9, p.b * 0.9);
        P.orbCore.push(p.x, p.y, p.z, -t * 4, s * 0.55, s * 0.55, s * 0.55, 1, 1, 1);
      } else {
        const s = p.radius;
        P.bolt.push(p.x, p.y, p.z, rot, s * 0.9, s * 0.9, s * 2.6, p.r, p.g, p.b);
        P.boltCore.push(p.x, p.y, p.z, rot, s * 0.45, s * 0.45, s * 1.6, 1, 1, 1);
      }
    }
    for (const p of this.enemy) {
      const pulse = 1 + Math.sin(t * 16 + p.x * 3) * 0.12;
      const s = p.radius * pulse;
      P.enemy.push(p.x, p.y, p.z, 0, s * 1.3, s * 1.3, s * 1.3, p.r * 0.7, p.g * 0.7, p.b * 0.7);
      P.enemyCore.push(p.x, p.y, p.z, t * 5, s * 0.6, s * 0.6, s * 0.6, 1, 1, 1);
    }
    for (const pool of Object.values(P)) pool.end();
  }
}
