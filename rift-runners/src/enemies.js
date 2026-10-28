import * as THREE from 'three';
import { InstancePool, SpatialGrid } from './pool.js';
import { ENEMY_TYPES, ARENA_RADIUS, waveScaling } from './config.js';
import { buildEnemyModels } from './models.js';

const HEIGHT = { crawler: 1.2, dasher: 1.3, spitter: 1.8, brute: 3.0, boss: 6.5 };
const MAX_PER_TYPE = 110;
const MINI_HP = { crawler: 60, dasher: 60, spitter: 32, brute: 6.5 };
const near = [];

export class Enemies {
  constructor(scene, game) {
    this.game = game;
    this.list = [];
    this.nextId = 1;
    this.grid = new SpatialGrid(ARENA_RADIUS + 6, 4);

    const models = buildEnemyModels();
    const bodyMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.pools = {};
    for (const type of Object.keys(ENEMY_TYPES)) {
      const body = new InstancePool(models[type].body, bodyMat, MAX_PER_TYPE, { shadow: true });
      const glow = new InstancePool(models[type].glow, glowMat, MAX_PER_TYPE);
      scene.add(body.mesh, glow.mesh);
      this.pools[type] = { body, glow };
    }

    // World-space health bars, pre-tilted to face the gameplay camera.
    const barGeo = new THREE.PlaneGeometry(1, 0.16).translate(0.5, 0, 0).rotateX(-0.9);
    this.barBg = new InstancePool(barGeo, new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.6, depthWrite: false }), 64);
    this.barFg = new InstancePool(barGeo, new THREE.MeshBasicMaterial({ depthWrite: false }), 64);
    this.barBg.mesh.renderOrder = 5; this.barFg.mesh.renderOrder = 6;
    scene.add(this.barBg.mesh, this.barFg.mesh);
  }

  clear() {
    for (const e of this.list) if (e.tele) this.game.effects.hideTele(e.tele);
    this.list.length = 0;
    this.grid.clear();
  }

  get aliveCount() { return this.list.length; }

  spawn(type, x, z, opts = {}) {
    const def = ENEMY_TYPES[type];
    const sc = waveScaling(opts.wave || this.game.waves.wave);
    const elite = !!opts.elite, mini = !!opts.miniboss;
    const scale = mini ? 2.1 : elite ? (type === 'brute' ? 1.45 : 1.65) : 1;
    const hpMult = mini ? MINI_HP[type] : elite ? (type === 'brute' ? 3.5 : 7) : 1;
    const e = {
      id: this.nextId++, type, def, x, z, kvx: 0, kvz: 0,
      hp: def.hp * sc.hp * hpMult, maxHp: def.hp * sc.hp * hpMult,
      radius: def.radius * scale, scale,
      speed: def.speed * sc.speed * (elite ? 1.1 : 1) * (mini ? 0.9 : 1) * (0.92 + Math.random() * 0.16),
      damage: def.damage * sc.damage * (elite || mini ? 1.35 : 1),
      dmgScale: sc.damage * (elite || mini ? 1.35 : 1),
      rot: 0, state: 'move', stateT: 0, cd: 1 + Math.random() * 1.5,
      dirX: 0, dirZ: 0, strafe: Math.random() < 0.5 ? 1 : -1,
      spawnT: 0, flash: 0, dead: false, seed: Math.random() * 100,
      burnT: 0, burnDps: 0, poisonT: 0, poisonStacks: 0, poisonDps: 0, dotTick: 0.5,
      elite, miniboss: mini, name: opts.name || null, tele: null,
      waveTag: opts.waveTag ?? this.game.waves.wave, counts: opts.counts !== false,
      xp: def.xp * (mini ? 40 : elite ? 12 : 1), shards: def.shards * (mini ? 30 : elite ? 10 : 1),
      height: HEIGHT[type] * scale,
    };
    this.list.push(e);
    this.game.effects.ring(x, z, 0.2, 1.8 * scale, 0.5, elite || mini ? '#ffcc4a' : '#b05cff');
    return e;
  }

  // Bosses register through here so projectiles, DoTs and chains treat them like enemies.
  addBoss(boss) {
    const e = {
      id: this.nextId++, type: 'boss', def: null, x: boss.x, z: boss.z, kvx: 0, kvz: 0,
      hp: boss.maxHp, maxHp: boss.maxHp, radius: boss.radius, scale: 1, spawnT: 1, flash: 0, dead: false,
      burnT: 0, burnDps: 0, poisonT: 0, poisonStacks: 0, poisonDps: 0, dotTick: 0.5,
      boss, height: HEIGHT.boss, counts: false, invuln: true, damage: boss.contactDamage,
    };
    this.list.push(e);
    return e;
  }

  damage(e, amount, kind, kbX, kbZ) {
    if (e.dead || e.invuln) return;
    const g = this.game;
    e.hp -= amount;
    e.flash = 0.09;
    const res = e.type === 'boss' ? 0 : e.miniboss ? 0.15 : e.type === 'brute' ? 0.35 : e.elite ? 0.5 : 1;
    e.kvx += kbX * res; e.kvz += kbZ * res;
    g.run.damageDealt += amount;
    g.effects.number(e.x, e.height + 0.3, e.z, Math.max(1, Math.round(amount)), kind);
    if (e.hp <= 0) this.kill(e);
  }

  kill(e) {
    if (e.dead) return;
    e.dead = true;
    if (e.tele) { this.game.effects.hideTele(e.tele); e.tele = null; }
    this.game.onEnemyKilled(e);
  }

  update(dt, t) {
    const g = this.game, pl = g.player, fx = g.effects;

    for (const e of this.list) {
      if (e.dead) continue;
      // Damage over time (ticks every 0.5s)
      if (e.burnT > 0 || e.poisonT > 0) {
        e.dotTick -= dt;
        if (e.burnT > 0) {
          e.burnT -= dt;
          if (Math.random() < dt * 8) fx.particle(e.x + (Math.random() - 0.5) * e.radius, e.height * 0.6, e.z + (Math.random() - 0.5) * e.radius, 0, 2.5, 0, 0.4, 0.15, '#ff7a1a');
        }
        if (e.poisonT > 0) { e.poisonT -= dt; if (e.poisonT <= 0) e.poisonStacks = 0; }
        if (e.dotTick <= 0) {
          e.dotTick = 0.5;
          const both = e.burnT > 0 && e.poisonT > 0 && g.stats.syn.toxicblaze ? 2 : 1;
          if (e.burnT > 0) this.damage(e, e.burnDps * 0.5 * both, 'burn', 0, 0);
          if (!e.dead && e.poisonT > 0) this.damage(e, e.poisonDps * e.poisonStacks * 0.5 * both, 'poison', 0, 0);
          if (e.dead) continue;
        }
      } else e.dotTick = 0.5;

      e.flash = Math.max(0, e.flash - dt);
      if (e.type === 'boss') continue; // boss AI lives in boss.js

      if (e.spawnT < 1) { e.spawnT = Math.min(1, e.spawnT + dt * 2.2); continue; }

      this.think(e, dt, t, pl);

      // knockback impulse
      e.x += e.kvx * dt; e.z += e.kvz * dt;
      const damp = Math.exp(-7 * dt);
      e.kvx *= damp; e.kvz *= damp;
    }

    // Sweep the dead
    for (let i = this.list.length - 1; i >= 0; i--) {
      if (this.list[i].dead) { this.list[i] = this.list[this.list.length - 1]; this.list.pop(); }
    }

    // Separation so enemies form a crowd instead of a single point.
    this.grid.clear();
    for (const e of this.list) this.grid.insert(e);
    for (const e of this.list) {
      this.grid.query(e.x, e.z, e.radius + 3, near);
      for (const o of near) {
        if (o.id <= e.id) continue;
        const dx = o.x - e.x, dz = o.z - e.z;
        const min = e.radius + o.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const push = (min - d) * 0.5;
        const me = e.type === 'boss' ? 1000 : e.radius * e.radius, mo = o.type === 'boss' ? 1000 : o.radius * o.radius;
        const fe = mo / (me + mo), fo = me / (me + mo);
        const nx = dx / d, nz = dz / d;
        e.x -= nx * push * fe * 2; e.z -= nz * push * fe * 2;
        o.x += nx * push * fo * 2; o.z += nz * push * fo * 2;
      }
    }

    // Obstacles, arena edge, contact damage
    for (const e of this.list) {
      if (e.type !== 'boss') g.world.resolve(e, e.radius);
      if (e.spawnT < 1 || !pl.alive) continue;
      const r = e.radius + pl.radius;
      const dx = e.x - pl.x, dz = e.z - pl.z;
      if (dx * dx + dz * dz < r * r) {
        const contact = e.type === 'boss' ? e.boss.contactDamageNow() : e.damage;
        if (contact > 0) g.damagePlayer(contact, e.x, e.z);
      }
    }
  }

  // Steering: desired direction bent around obstacles that lie ahead.
  steer(e, dx, dz) {
    for (const ob of this.game.world.obstacles) {
      const ox = e.x - ob.x, oz = e.z - ob.z;
      const d = Math.hypot(ox, oz) || 0.01;
      const gap = d - ob.r - e.radius;
      if (gap > 2.4 || ox * dx + oz * dz > 0) continue;
      let tx = -oz / d, tz = ox / d;
      if (tx * dx + tz * dz < 0) { tx = -tx; tz = -tz; }
      const w = Math.min(1, Math.max(0, 1 - gap / 2.4)) * 1.6;
      dx += tx * w; dz += tz * w;
    }
    const l = Math.hypot(dx, dz) || 1;
    return [dx / l, dz / l];
  }

  move(e, dx, dz, speed, dt) {
    const [sx, sz] = this.steer(e, dx, dz);
    e.x += sx * speed * dt; e.z += sz * speed * dt;
    const target = Math.atan2(sx, sz);
    let diff = target - e.rot;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    e.rot += diff * Math.min(1, dt * 10);
  }

  face(e, dx, dz, dt) {
    let diff = Math.atan2(dx, dz) - e.rot;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    e.rot += diff * Math.min(1, dt * 12);
  }

  think(e, dt, t, pl) {
    const g = this.game, fx = g.effects, def = e.def;
    const dx = pl.x - e.x, dz = pl.z - e.z;
    const dist = Math.hypot(dx, dz) || 0.01;
    const nx = dx / dist, nz = dz / dist;
    e.cd -= dt;
    e.stateT -= dt;

    switch (e.type) {
      case 'crawler': {
        const wob = Math.sin(t * 2.3 + e.seed) * 0.45;
        this.move(e, nx - nz * wob, nz + nx * wob, e.speed, dt);
        break;
      }
      case 'dasher': {
        if (e.state === 'move') {
          this.move(e, nx, nz, e.speed, dt);
          if (dist < def.chargeRange * (e.elite ? 1.2 : 1) && e.cd <= 0 && dist > 2) {
            e.state = 'windup'; e.stateT = e.elite ? 0.5 : 0.6;
            e.dirX = nx; e.dirZ = nz;
            e.tele = fx.teleLane(e.x, e.z, nx, nz, def.chargeSpeed * 0.48, 1.3 * e.scale, e.stateT, '#ffc23a');
            g.sound.play('windup');
          }
        } else if (e.state === 'windup') {
          this.face(e, e.dirX, e.dirZ, dt);
          if (e.stateT <= 0) {
            if (e.tele) { fx.hideTele(e.tele); e.tele = null; }
            e.state = 'charge'; e.stateT = 0.45;
          }
        } else if (e.state === 'charge') {
          e.x += e.dirX * def.chargeSpeed * dt; e.z += e.dirZ * def.chargeSpeed * dt;
          if (Math.random() < 0.6) fx.particle(e.x, 0.6, e.z, 0, 0.3, 0, 0.3, 0.2, '#ffb22e');
          if (e.stateT <= 0) { e.state = 'recover'; e.stateT = 0.7; }
        } else {
          this.move(e, nx, nz, e.speed * 0.3, dt);
          if (e.stateT <= 0) { e.state = 'move'; e.cd = 2 + Math.random() * 1.2; }
        }
        break;
      }
      case 'spitter': {
        if (e.state === 'windup') {
          this.face(e, nx, nz, dt);
          if (e.stateT <= 0) {
            this.spit(e, nx, nz);
            e.state = 'move';
            e.cd = def.fireCd * (e.miniboss ? 0.55 : e.elite ? 0.8 : 1) * (0.85 + Math.random() * 0.3);
          }
          break;
        }
        let mx, mz;
        if (dist > 13) { mx = nx; mz = nz; }
        else if (dist < 8) { mx = -nx; mz = -nz; }
        else { mx = -nz * e.strafe; mz = nx * e.strafe; if (Math.random() < dt * 0.3) e.strafe *= -1; }
        // keep away from the arena wall while backing off
        const r = Math.hypot(e.x, e.z);
        if (r > ARENA_RADIUS - 4) { mx -= e.x / r; mz -= e.z / r; }
        this.move(e, mx, mz, e.speed, dt);
        if (e.cd <= 0 && dist < 19) { e.state = 'windup'; e.stateT = 0.45; }
        break;
      }
      case 'brute': {
        const slamR = def.slamRadius * (e.miniboss ? 1.6 : e.elite ? 1.25 : 1);
        if (e.state === 'move') {
          this.move(e, nx, nz, e.speed, dt);
          if (dist < slamR * 0.85 && e.cd <= 0) {
            e.state = 'windup'; e.stateT = e.miniboss ? 1.05 : 0.9;
            e.tele = fx.teleCircle(e.x, e.z, slamR, e.stateT, '#ff6a2a');
            g.sound.play('windup');
          }
        } else if (e.state === 'windup') {
          this.face(e, nx, nz, dt);
          if (e.stateT <= 0) {
            if (e.tele) { fx.hideTele(e.tele); e.tele = null; }
            this.slam(e, slamR);
            e.state = 'recover'; e.stateT = 0.7;
          }
        } else {
          if (e.stateT <= 0) { e.state = 'move'; e.cd = 2.6 + Math.random(); }
        }
        break;
      }
    }
  }

  spit(e, nx, nz) {
    const g = this.game, def = e.def;
    const dmg = def.shotDamage * e.dmgScale;
    const shoot = (a, speed = def.shotSpeed) => g.projectiles.spawnEnemy('spit', e.x + Math.sin(a) * e.radius, e.z + Math.cos(a) * e.radius, Math.sin(a), Math.cos(a), speed, dmg, 0.38 * Math.sqrt(e.scale), 4, '#9dff3a');
    const base = Math.atan2(nx, nz);
    if (e.miniboss) {
      for (let i = 0; i < 10; i++) shoot(base + (i / 10) * Math.PI * 2, def.shotSpeed * 0.8);
      for (let i = -1; i <= 1; i++) shoot(base + i * 0.2);
    } else if (e.elite) {
      for (let i = -1; i <= 1; i++) shoot(base + i * 0.22);
    } else shoot(base);
    g.sound.play('enemyShot');
  }

  slam(e, r) {
    const g = this.game, pl = g.player;
    g.effects.ring(e.x, e.z, 0.5, r, 0.4, '#ff8a3a', 0.2);
    g.effects.burst(e.x, 0.3, e.z, 16, '#d07a3a', 9, 0.5, 0.25, 12);
    g.effects.shake(e.miniboss ? 0.4 : 0.2);
    g.sound.play('slam');
    const d = Math.hypot(pl.x - e.x, pl.z - e.z);
    if (d < r + pl.radius) g.damagePlayer(e.def.slamDamage * e.dmgScale, e.x, e.z);
    if (e.miniboss) {
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + Math.random() * 0.1;
        g.projectiles.spawnEnemy('rock', e.x, e.z, Math.sin(a), Math.cos(a), 9, 12 * e.dmgScale, 0.45, 4, '#ff9a3a');
      }
    }
  }

  render(t) {
    const P = this.pools;
    for (const k in P) { P[k].body.begin(); P[k].glow.begin(); }
    this.barBg.begin(); this.barFg.begin();

    for (const e of this.list) {
      if (e.dead || e.type === 'boss') continue;
      const pool = P[e.type];
      const em = e.spawnT < 1 ? e.spawnT * e.spawnT : 1;
      let sx = e.scale * em, sy = e.scale * em, sz = e.scale * em, y = 0;
      let wind = e.state === 'windup' ? 1 - Math.max(0, e.stateT) / 0.9 : 0;
      switch (e.type) {
        case 'crawler': y = Math.abs(Math.sin(t * 14 + e.seed)) * 0.08; break;
        case 'dasher': y = 0.15 + Math.sin(t * 5 + e.seed) * 0.1; if (wind) { sx *= 1 + Math.sin(t * 60) * 0.06; sz *= 0.85; } break;
        case 'spitter': sy *= 1 + wind * 0.35; sx *= 1 + Math.sin(t * 4 + e.seed) * 0.04; break;
        case 'brute': if (wind) { sy *= 1 + wind * 0.12; y = wind * 0.4; } break;
      }
      let r = 1, gg = 1, b = 1;
      if (e.elite || e.miniboss) { r = 1.55; gg = 1.25; b = 0.6; }
      if (e.burnT > 0) { r *= 1.4; gg *= 0.85; b *= 0.6; }
      if (e.poisonT > 0) { r *= 0.8; gg *= 1.35; b *= 0.7; }
      if (e.flash > 0) { r = gg = b = 4; }
      pool.body.push(e.x, y, e.z, e.rot, sx, sy, sz, r, gg, b);
      const gl = (e.state === 'windup' ? 1.6 + Math.sin(t * 30) * 0.5 : 1) * (e.elite || e.miniboss ? 1.4 : 1);
      pool.glow.push(e.x, y, e.z, e.rot, sx, sy, sz, gl, gl, gl);

      const showBar = (e.elite && !e.miniboss) || (e.type === 'brute' && !e.miniboss && e.hp < e.maxHp);
      if (showBar && e.spawnT >= 1) {
        const w = 1.2 * e.scale;
        const bx = e.x - w / 2, by = e.height + 0.35, bz = e.z;
        this.barBg.push(bx - 0.04, by, bz + 0.01, 0, w + 0.08, 1.4, 1);
        const f = Math.max(0, e.hp / e.maxHp);
        if (e.elite) this.barFg.push(bx, by, bz + 0.02, 0, w * f, 1, 1, 1, 0.78, 0.2);
        else this.barFg.push(bx, by, bz + 0.02, 0, w * f, 1, 1, 1, 0.25, 0.25);
      }
    }
    for (const k in P) { P[k].body.end(); P[k].glow.end(); }
    this.barBg.end(); this.barFg.end();
  }
}
