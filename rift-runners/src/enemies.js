import * as THREE from 'three';
import { InstancePool, SpatialGrid } from './pool.js';
import { ENEMY_TYPES, ARENA_RADIUS, ELITE_MODS, waveScaling } from './config.js';
import { buildEnemyModels } from './models.js';
import { buildExtraEnemyModels } from './models2.js';

const HEIGHT = { crawler: 1.2, dasher: 1.3, spitter: 1.8, brute: 3.0, boss: 6.5, stalker: 1.8, splitter: 1.4, priest: 2.5, bombardier: 1.5, knight: 2.5, leech: 1.4, turret: 1.3, pylon: 2.7, mine: 0.5 };
const MAX_PER_TYPE = 100;
const MINI_HP = { crawler: 60, dasher: 60, spitter: 32, brute: 6.5, knight: 9, priest: 16, bombardier: 18, stalker: 50, splitter: 22, leech: 40 };
const MOD_IDS = Object.keys(ELITE_MODS);
const near = [];
const tmpC = new THREE.Color();

export class Enemies {
  constructor(scene, game) {
    this.game = game;
    this.list = [];
    this.nextId = 1;
    this.grid = new SpatialGrid(ARENA_RADIUS + 6, 4);

    const models = { ...buildEnemyModels(), ...buildExtraEnemyModels() };
    const bodyMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const outlineMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, transparent: true, opacity: 0.85, depthWrite: false });
    this.pools = {};
    for (const type of Object.keys(ENEMY_TYPES)) {
      const body = new InstancePool(models[type].body, bodyMat, MAX_PER_TYPE, { shadow: true });
      const glow = new InstancePool(models[type].glow, glowMat, MAX_PER_TYPE);
      const outline = new InstancePool(models[type].body, outlineMat, 24);
      scene.add(body.mesh, glow.mesh, outline.mesh);
      this.pools[type] = { body, glow, outline };
    }

    // World-space health bars, pre-tilted to face the gameplay camera.
    const barGeo = new THREE.PlaneGeometry(1, 0.16).translate(0.5, 0, 0).rotateX(-0.9);
    this.barBg = new InstancePool(barGeo, new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.6, depthWrite: false }), 96);
    this.barFg = new InstancePool(barGeo, new THREE.MeshBasicMaterial({ depthWrite: false }), 128);
    this.barBg.mesh.renderOrder = 5; this.barFg.mesh.renderOrder = 6;
    // Aura rings (Void Priest auras, buffed markers)
    this.auras = new InstancePool(new THREE.RingGeometry(0.9, 1, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }), 128);
    scene.add(this.barBg.mesh, this.barFg.mesh, this.auras.mesh);
  }

  clear() {
    for (const e of this.list) if (e.tele) this.game.effects.hideTele(e.tele);
    this.list.length = 0;
    this.grid.clear();
  }

  get aliveCount() { let n = 0; for (const e of this.list) if (!e.def?.device && e.type !== 'boss') n++; return n; }

  spawn(type, x, z, opts = {}) {
    const g = this.game, def = ENEMY_TYPES[type], diff = g.diff;
    const sc = waveScaling(opts.wave || g.waves.scalingWave);
    const elite = !!opts.elite, mini = !!opts.miniboss;
    const gen = opts.gen || 0;
    let scale = mini ? 2.0 : elite ? (type === 'brute' ? 1.4 : 1.55) : 1;
    if (gen > 0) scale *= 0.6;
    let hpMult = mini ? MINI_HP[type] || 20 : elite ? (type === 'brute' ? 3.5 : type === 'knight' ? 4 : 6) : 1;
    if (gen > 0) hpMult *= 0.3;
    if (def.device) hpMult = opts.hpMult || 1;
    const hp = def.hp * (def.device ? 1 : sc.hp * diff.enemyHp) * hpMult * (opts.hpScale || 1);
    const dmgScale = (def.device ? 1 : sc.damage) * diff.enemyDmg * (elite || mini ? 1.3 : 1);
    const e = {
      id: this.nextId++, type, def, x, z, kvx: 0, kvz: 0,
      hp, maxHp: hp,
      radius: def.radius * scale, scale,
      speed: def.speed * sc.speed * diff.enemySpeed * (elite ? 1.08 : 1) * (mini ? 0.9 : 1) * (gen > 0 ? 1.45 : 1) * (0.92 + Math.random() * 0.16),
      damage: def.damage * dmgScale, dmgScale,
      rot: Math.atan2(g.player.x - x, g.player.z - z), state: 'move', stateT: 0, cd: 1 + Math.random() * 1.5,
      dirX: 0, dirZ: 0, strafe: Math.random() < 0.5 ? 1 : -1,
      spawnT: def.device ? 0.6 : 0, flash: 0, dead: false, seed: Math.random() * 100,
      burnT: 0, burnDps: 0, poisonT: 0, poisonStacks: 0, poisonDps: 0, dotTick: 0.5,
      elite, miniboss: mini, name: opts.name || null, tele: null, gen,
      waveTag: opts.waveTag ?? g.waves.wave, counts: opts.counts !== false,
      xp: opts.xp ?? def.xp * (mini ? 30 : elite ? 6 : 1) * (gen > 0 ? 0.5 : 1),
      shards: def.shards * (mini ? 30 : elite ? 8 : 1),
      height: HEIGHT[type] * scale,
      mods: [], armor: 0, armorMax: 0, buffT: 0, slowT: 0, hidden: false, guardDown: false,
      owner: opts.owner || null, minions: 0, special: !!opts.special, bossDevice: opts.bossDevice || null,
      interruptDmg: 0, drainTick: 0,
    };
    // Elite modifiers (Nightmare can also hand them to ordinary enemies)
    let mods = opts.mods;
    if (!mods && !def.device && gen === 0) {
      if (elite) mods = this.rollMods(diff.modCount === 2 ? 2 : Math.random() < 0.3 ? 2 : 1);
      else if (mini) mods = this.rollMods(1);
      else if (diff.extraMods + (g.waves.endlessBonusMods || 0) > Math.random() && !opts.summoned) mods = this.rollMods(1);
    }
    if (mods) for (const m of mods) this.applyMod(e, m);
    this.list.push(e);
    if (!def.device) g.effects.ring(x, z, 0.2, 1.8 * scale, 0.5, elite || mini ? '#ffcc4a' : '#b05cff');
    g.discover(type);
    return e;
  }

  rollMods(n) {
    const out = [];
    while (out.length < n) { const m = MOD_IDS[Math.floor(Math.random() * MOD_IDS.length)]; if (!out.includes(m)) out.push(m); }
    return out;
  }

  applyMod(e, m) {
    e.mods.push(m);
    if (m === 'swift') { e.speed *= 1.45; e.maxHp *= 0.7; e.hp = e.maxHp; }
    if (m === 'armored') { e.armorMax = e.armor = e.maxHp * 0.7; }
    if (m === 'volatile') { e.volT = 4; e.powered = false; }
    if (m === 'summoner') { e.summonT = 3; }
  }

  // Bosses register through here so projectiles, DoTs and chains treat them like enemies.
  addBoss(boss) {
    const e = {
      id: this.nextId++, type: 'boss', def: null, x: boss.x || 0, z: boss.z || 0, kvx: 0, kvz: 0,
      hp: boss.maxHp, maxHp: boss.maxHp, radius: boss.radius, scale: 1, spawnT: 1, flash: 0, dead: false,
      burnT: 0, burnDps: 0, poisonT: 0, poisonStacks: 0, poisonDps: 0, dotTick: 0.5, mods: [], armor: 0,
      boss, height: HEIGHT.boss, counts: false, invuln: true, damage: boss.contactDamage, elite: false, miniboss: false,
      dmgTakenMult: 1,
    };
    this.list.push(e);
    return e;
  }

  damage(e, amount, kind, kbX, kbZ) {
    if (e.dead || e.invuln) return;
    const g = this.game;
    if (e.buffT > 0) amount *= 0.7;
    if (e.powered) amount *= 0.5;
    else if (e.mods.includes('volatile')) amount *= 1.4;
    if (e.guardDown) amount *= 1.5;
    if (e.dmgTakenMult) amount *= e.dmgTakenMult;
    if (e.armor > 0) {
      e.armor -= amount;
      amount *= 0.3;
      if (e.armor <= 0) {
        e.armor = 0;
        g.effects.number(e.x, e.height + 0.8, e.z, 'ARMOR BROKEN', 'shock');
        g.effects.burst(e.x, e.height * 0.6, e.z, 14, '#d8e0ee', 7, 0.5, 0.18, 8);
        g.sound.play('clank');
      }
    }
    e.hp -= amount;
    e.flash = 0.09;
    if (e.type === 'leech' && (e.state === 'windup' || e.state === 'drain')) {
      e.interruptDmg += amount;
      if (e.state === 'windup' || e.interruptDmg > e.maxHp * 0.3) this.interruptLeech(e);
    }
    const res = e.type === 'boss' || e.def?.device ? 0 : e.miniboss ? 0.15 : e.type === 'brute' || e.type === 'knight' ? 0.35 : e.elite ? 0.5 : 1;
    e.kvx += kbX * res; e.kvz += kbZ * res;
    g.run.damageDealt += amount;
    g.effects.number(e.x, e.height + 0.3, e.z, Math.max(1, Math.round(amount)), kind);
    if (e.hp <= 0) this.kill(e);
  }

  interruptLeech(e) {
    e.state = 'recover'; e.stateT = 0.9; e.cd = 3;
    this.game.effects.number(e.x, e.height + 0.6, e.z, 'INTERRUPTED', 'shock');
  }

  kill(e) {
    if (e.dead) return;
    e.dead = true;
    if (e.tele) { this.game.effects.hideTele(e.tele); e.tele = null; }
    if (e.owner) e.owner.minions = Math.max(0, e.owner.minions - 1);
    this.game.onEnemyKilled(e);
  }

  update(dt, t) {
    const g = this.game, pl = g.player, fx = g.effects;

    // Priest auras: mark allies inside the aura as buffed for a moment.
    for (const p of this.list) {
      if (p.type !== 'priest' || p.dead || p.spawnT < 1) continue;
      const r = p.def.auraRadius * p.scale ** 0.5;
      this.grid.query(p.x, p.z, r + 2, near);
      for (const o of near) if (o !== p && !o.dead && o.type !== 'boss' && !o.def?.device && (o.x - p.x) ** 2 + (o.z - p.z) ** 2 < r * r) o.buffT = 0.25;
      p.mendT = (p.mendT ?? 5) - dt;
      if (p.mendT <= 0) {
        p.mendT = 5.5;
        fx.ring(p.x, p.z, 0.5, r, 0.6, '#9a7bff', 0.2);
        for (const o of near) if (!o.dead && o.type !== 'boss' && (o.x - p.x) ** 2 + (o.z - p.z) ** 2 < r * r) o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.12);
      }
    }

    for (const e of this.list) {
      if (e.dead) continue;
      // Damage over time (ticks every 0.5s)
      if (e.burnT > 0 || e.poisonT > 0) {
        e.dotTick -= dt;
        if (e.burnT > 0) {
          e.burnT -= dt;
          if (Math.random() < dt * 8 * g.particleScale) fx.particle(e.x + (Math.random() - 0.5) * e.radius, e.height * 0.6, e.z + (Math.random() - 0.5) * e.radius, 0, 2.5, 0, 0.4, 0.15, '#ff7a1a');
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
      e.buffT = Math.max(0, (e.buffT || 0) - dt);
      e.slowT = Math.max(0, (e.slowT || 0) - dt);
      if (e.type === 'boss') continue; // boss AI lives in the boss controllers

      if (e.spawnT < 1) { e.spawnT = Math.min(1, e.spawnT + dt * 2.2); continue; }

      this.updateMods(e, dt);
      this.think(e, dt, t, pl);

      e.x += e.kvx * dt; e.z += e.kvz * dt;
      const damp = Math.exp(-7 * dt);
      e.kvx *= damp; e.kvz *= damp;
    }

    // Sweep the dead
    for (let i = this.list.length - 1; i >= 0; i--) {
      if (this.list[i].dead) { this.list[i] = this.list[this.list.length - 1]; this.list.pop(); }
    }

    // Separation so enemies form a crowd instead of a single point. Hidden enemies are untargetable.
    this.grid.clear();
    for (const e of this.list) if (!e.hidden) this.grid.insert(e);
    for (const e of this.list) {
      if (e.hidden) continue;
      this.grid.query(e.x, e.z, e.radius + 3, near);
      for (const o of near) {
        if (o.id <= e.id) continue;
        const dx = o.x - e.x, dz = o.z - e.z;
        const min = e.radius + o.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const push = (min - d) * 0.5;
        const fixedE = e.type === 'boss' || e.def?.device, fixedO = o.type === 'boss' || o.def?.device;
        const me = fixedE ? 1000 : e.radius * e.radius, mo = fixedO ? 1000 : o.radius * o.radius;
        const fe = mo / (me + mo), fo = me / (me + mo);
        const nx = dx / d, nz = dz / d;
        if (!fixedE) { e.x -= nx * push * fe * 2; e.z -= nz * push * fe * 2; }
        if (!fixedO) { o.x += nx * push * fo * 2; o.z += nz * push * fo * 2; }
      }
    }

    // Obstacles, arena edge, contact damage
    for (const e of this.list) {
      if (e.type !== 'boss' && !e.def.device) g.world.resolve(e, e.radius);
      if (e.spawnT < 1 || !pl.alive || e.hidden) continue;
      const r = e.radius + pl.radius;
      const dx = e.x - pl.x, dz = e.z - pl.z;
      if (dx * dx + dz * dz < r * r) {
        const contact = e.type === 'boss' ? e.boss.contactDamageNow() : e.damage * (e.powered ? 1.4 : 1) * (e.buffT > 0 ? 1.2 : 1);
        if (contact > 0) {
          const before = pl.hp;
          g.damagePlayer(contact, e.x, e.z, { src: e });
          if (pl.hp < before) g.combat.onContactHit(e, before - pl.hp);
        }
      }
    }
  }

  updateMods(e, dt) {
    if (!e.mods.length) return;
    const g = this.game;
    if (e.volT !== undefined) {
      e.volT -= dt;
      if (e.volT <= 0) {
        e.powered = !e.powered;
        e.volT = e.powered ? 3 : 4;
        if (e.powered) { g.effects.ring(e.x, e.z, 0.5, 3, 0.4, '#ff5ff0'); g.sound.play('windup'); }
      }
    }
    if (e.summonT !== undefined) {
      e.summonT -= dt;
      if (e.summonT <= 0) {
        e.summonT = 6;
        if (e.minions < 3 && g.enemies.aliveCount < 90) {
          const a = Math.random() * Math.PI * 2;
          const m = this.spawn('crawler', e.x + Math.cos(a) * 2, e.z + Math.sin(a) * 2, { counts: false, xp: 0, owner: e, summoned: true });
          m.shards = 0;
          e.minions++;
          g.effects.ring(e.x, e.z, 0.5, 2.5, 0.4, '#7dff8a');
        }
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

  speedOf(e) {
    let s = e.speed * this.game.mods.enemySpeed;
    if (e.buffT > 0) s *= 1.25;
    if (e.powered) s *= 1.5; else if (e.volT !== undefined) s *= 0.75;
    if (e.slowT > 0) s *= 0.6;
    return s;
  }

  move(e, dx, dz, speed, dt) {
    const [sx, sz] = this.steer(e, dx, dz);
    e.x += sx * speed * dt; e.z += sz * speed * dt;
    this.face(e, sx, sz, dt, 10);
  }

  face(e, dx, dz, dt, rate = 12) {
    let diff = Math.atan2(dx, dz) - e.rot;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    e.rot += diff * Math.min(1, dt * rate);
  }

  // Attack cooldowns respect difficulty, events and priest buffs.
  cdScale(e) {
    const g = this.game;
    return g.diff.attackCd * g.mods.enemyCd * (e.buffT > 0 ? 0.75 : 1);
  }

  think(e, dt, t, pl) {
    const g = this.game, fx = g.effects, def = e.def, tm = g.diff.telegraph;
    const dx = pl.x - e.x, dz = pl.z - e.z;
    const dist = Math.hypot(dx, dz) || 0.01;
    const nx = dx / dist, nz = dz / dist;
    const speed = this.speedOf(e);
    e.cd -= dt;
    e.stateT -= dt;

    switch (e.type) {
      case 'crawler':
      case 'splitter': {
        const wob = Math.sin(t * 2.3 + e.seed) * (e.type === 'crawler' ? 0.45 : 0.25);
        this.move(e, nx - nz * wob, nz + nx * wob, speed, dt);
        break;
      }
      case 'dasher': {
        if (e.state === 'move') {
          this.move(e, nx, nz, speed, dt);
          if (dist < def.chargeRange * (e.elite ? 1.2 : 1) && e.cd <= 0 && dist > 2) {
            e.state = 'windup'; e.stateT = (e.elite ? 0.5 : 0.6) * tm;
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
          if (Math.random() < 0.6 * g.particleScale) fx.particle(e.x, 0.6, e.z, 0, 0.3, 0, 0.3, 0.2, '#ffb22e');
          if (e.stateT <= 0) { e.state = 'recover'; e.stateT = 0.7; }
        } else {
          this.move(e, nx, nz, speed * 0.3, dt);
          if (e.stateT <= 0) { e.state = 'move'; e.cd = (2 + Math.random() * 1.2) * this.cdScale(e); }
        }
        break;
      }
      case 'spitter': {
        if (e.state === 'windup') {
          this.face(e, nx, nz, dt);
          if (e.stateT <= 0) {
            this.spit(e, nx, nz);
            e.state = 'move';
            e.cd = def.fireCd * (e.miniboss ? 0.55 : e.elite ? 0.8 : 1) * (0.85 + Math.random() * 0.3) * this.cdScale(e);
          }
          break;
        }
        this.kite(e, dist, nx, nz, 8, 13, speed, dt);
        if (e.cd <= 0 && dist < 19) { e.state = 'windup'; e.stateT = 0.45 * tm; }
        break;
      }
      case 'brute': {
        const slamR = def.slamRadius * (e.miniboss ? 1.6 : e.elite ? 1.25 : 1);
        if (e.state === 'move') {
          this.move(e, nx, nz, speed, dt);
          if (dist < slamR * 0.85 && e.cd <= 0) {
            e.state = 'windup'; e.stateT = (e.miniboss ? 1.05 : 0.9) * tm;
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
        } else if (e.stateT <= 0) { e.state = 'move'; e.cd = (2.6 + Math.random()) * this.cdScale(e); }
        break;
      }
      case 'stalker': {
        if (e.state === 'move') {
          this.move(e, nx, nz, speed, dt);
          if (e.cd <= 0 && dist < 15 && dist > 3.5) {
            // Pick a landing spot beside the player and announce it.
            const base = Math.atan2(-nx, -nz) + (Math.random() - 0.5) * 2.2;
            let tx = pl.x + Math.sin(base) * 2.8, tz = pl.z + Math.cos(base) * 2.8;
            const r = Math.hypot(tx, tz);
            if (r > ARENA_RADIUS - 2) { tx *= (ARENA_RADIUS - 2) / r; tz *= (ARENA_RADIUS - 2) / r; }
            if (g.world.insideObstacle(tx, tz, 0.8)) { e.cd = 0.5; break; }
            e.state = 'blink'; e.stateT = 0.75 * tm; e.dirX = tx; e.dirZ = tz;
            e.tele = fx.teleCircle(tx, tz, 1.2, e.stateT, '#b07bff');
            fx.burst(e.x, 1, e.z, 8, '#b07bff', 4, 0.4, 0.15);
            g.sound.play('blink');
          }
        } else if (e.state === 'blink') {
          e.hidden = e.stateT < 0.75 * tm - 0.25;
          if (e.stateT <= 0) {
            if (e.tele) { fx.hideTele(e.tele); e.tele = null; }
            e.x = e.dirX; e.z = e.dirZ; e.hidden = false;
            fx.burst(e.x, 1, e.z, 12, '#d8b8ff', 6, 0.4, 0.18);
            e.state = 'strikeWind'; e.stateT = 0.3 * tm;
          }
        } else if (e.state === 'strikeWind') {
          this.face(e, nx, nz, dt, 20);
          if (e.stateT <= 0) { e.state = 'lunge'; e.stateT = 0.22; e.dirX = nx; e.dirZ = nz; }
        } else if (e.state === 'lunge') {
          e.x += e.dirX * 17 * dt; e.z += e.dirZ * 17 * dt;
          if (e.stateT <= 0) { e.state = 'recover'; e.stateT = 0.6; }
        } else {
          this.move(e, -nx, -nz, speed * 0.6, dt);
          if (e.stateT <= 0) { e.state = 'move'; e.cd = (3.4 + Math.random()) * this.cdScale(e); }
        }
        break;
      }
      case 'priest': {
        this.kite(e, dist, nx, nz, 9, 13, speed, dt);
        break;
      }
      case 'bombardier': {
        if (e.state === 'windup') {
          this.face(e, nx, nz, dt);
          if (e.stateT <= 0) { this.lob(e); e.state = 'move'; e.cd = (3.3 + Math.random() * 0.6) * this.cdScale(e); }
          break;
        }
        this.kite(e, dist, nx, nz, 10, 15, speed, dt);
        if (e.cd <= 0 && dist < 21) { e.state = 'windup'; e.stateT = 0.5 * tm; g.sound.play('windup'); }
        break;
      }
      case 'knight': {
        if (e.state === 'move') {
          // Turns slowly so the player can circle behind the shield.
          const [sx, sz] = this.steer(e, nx, nz);
          e.x += sx * speed * dt; e.z += sz * speed * dt;
          this.face(e, nx, nz, dt, e.buffT > 0 ? 2.6 : 1.8);
          if (dist < 3.2 && e.cd <= 0) {
            e.state = 'windup'; e.stateT = 0.6 * tm;
            e.dirX = Math.sin(e.rot); e.dirZ = Math.cos(e.rot);
            e.tele = fx.teleLane(e.x, e.z, e.dirX, e.dirZ, 4.2 * e.scale, 1.7 * e.scale, e.stateT, '#cfe6ff');
            g.sound.play('windup');
          }
        } else if (e.state === 'windup') {
          if (e.stateT <= 0) {
            if (e.tele) { fx.hideTele(e.tele); e.tele = null; }
            this.thrust(e);
            e.state = 'recover'; e.stateT = 1.3; e.guardDown = true;
          }
        } else if (e.state === 'recover') {
          if (e.stateT <= 0) { e.state = 'move'; e.guardDown = false; e.cd = (2.2 + Math.random()) * this.cdScale(e); }
        }
        break;
      }
      case 'leech': {
        if (e.state === 'move') {
          const want = dist > 2.6 ? 1 : -0.4;
          this.move(e, nx * want - nz * 0.7 * e.strafe, nz * want + nx * 0.7 * e.strafe, speed, dt);
          if (dist < 3.6 && e.cd <= 0) { e.state = 'windup'; e.stateT = 0.6 * tm; e.interruptDmg = 0; g.sound.play('windup'); }
        } else if (e.state === 'windup') {
          this.face(e, nx, nz, dt);
          if (Math.random() < 0.3) fx.lightning(e.x, 0.9, e.z, e.x + nx * dist * 0.4, 0.9, e.z + nz * dist * 0.4, '#ff3355');
          if (e.stateT <= 0) { e.state = 'drain'; e.stateT = 1.6; e.drainTick = 0; }
        } else if (e.state === 'drain') {
          this.move(e, nx * (dist > 2.6 ? 1 : 0), nz * (dist > 2.6 ? 1 : 0), speed * 0.7, dt);
          if (dist > 6.5 || !pl.alive) { e.state = 'recover'; e.stateT = 1; e.cd = 2.5 * this.cdScale(e); break; }
          e.drainTick -= dt;
          if (e.drainTick <= 0) {
            e.drainTick = 0.32;
            fx.lightning(e.x, 0.9, e.z, pl.x, 1, pl.z, '#ff3355');
            const before = pl.hp;
            g.damagePlayer(def.drain * e.dmgScale, e.x, e.z, { drain: true, src: e });
            e.hp = Math.min(e.maxHp, e.hp + (before - pl.hp));
          }
          if (e.stateT <= 0) { e.state = 'recover'; e.stateT = 1; e.cd = 3.5 * this.cdScale(e); }
        } else {
          this.move(e, -nx, -nz, speed * 0.6, dt);
          if (e.stateT <= 0) e.state = 'move';
        }
        break;
      }
      case 'turret': {
        this.face(e, nx, nz, dt, 4);
        if (e.cd <= 0 && dist < 26) {
          e.cd = (e.bossDevice?.tier >= 2 ? 1.3 : 1.7) * this.cdScale(e);
          const base = Math.atan2(nx, nz);
          const n = e.bossDevice?.tier >= 2 ? 3 : 1;
          for (let i = 0; i < n; i++) {
            const a = base + (i - (n - 1) / 2) * 0.25;
            g.projectiles.spawnEnemy('turret', e.x + Math.sin(a), e.z + Math.cos(a), Math.sin(a), Math.cos(a), 12, 10 * g.diff.enemyDmg, 0.32, 4, '#ffd166');
          }
          g.sound.play('enemyShot');
        }
        break;
      }
      case 'mine': {
        if (e.state === 'move' && dist < 2.0) {
          e.state = 'fuse';
          g.hazards.add({ x: e.x, z: e.z, r: 2.6, delay: 0.75, damage: 18 * g.diff.enemyDmg, color: '#ff4d6d' });
          e.stateT = 0.75 * tm;
          g.sound.play('warning');
        } else if (e.state === 'fuse' && e.stateT <= 0) {
          e.xp = 0;
          this.kill(e);
        }
        break;
      }
      // pylons are passive
    }
  }

  kite(e, dist, nx, nz, min, max, speed, dt) {
    let mx, mz;
    if (dist > max) { mx = nx; mz = nz; }
    else if (dist < min) { mx = -nx; mz = -nz; }
    else { mx = -nz * e.strafe; mz = nx * e.strafe; if (Math.random() < dt * 0.3) e.strafe *= -1; }
    const r = Math.hypot(e.x, e.z);
    if (r > ARENA_RADIUS - 4) { mx -= e.x / r; mz -= e.z / r; }
    this.move(e, mx, mz, speed, dt);
    this.face(e, nx, nz, dt, 8);
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

  lob(e) {
    const g = this.game, pl = g.player, def = e.def;
    let tx = pl.x + pl.vx * 0.35, tz = pl.z + pl.vz * 0.35;
    const targets = [[tx, tz]];
    if (e.elite || e.miniboss) {
      const a = Math.random() * Math.PI;
      targets.push([tx + Math.cos(a) * 3.6, tz + Math.sin(a) * 3.6], [tx - Math.cos(a) * 3.6, tz - Math.sin(a) * 3.6]);
    }
    for (const [x, z] of targets) {
      const r = Math.hypot(x, z);
      const k = r > ARENA_RADIUS - 1 ? (ARENA_RADIUS - 1) / r : 1;
      g.hazards.add({ x: x * k, z: z * k, r: def.shellRadius, delay: 1.3, damage: def.shellDamage * e.dmgScale, color: '#ffb02e', shell: { x: e.x, z: e.z, h: 6 } });
    }
    g.sound.play('orb');
  }

  slam(e, r) {
    const g = this.game, pl = g.player;
    g.effects.ring(e.x, e.z, 0.5, r, 0.4, '#ff8a3a', 0.2);
    g.effects.burst(e.x, 0.3, e.z, Math.round(16 * g.particleScale), '#d07a3a', 9, 0.5, 0.25, 12);
    g.effects.shake(e.miniboss ? 0.4 : 0.2);
    g.sound.play('slam');
    const d = Math.hypot(pl.x - e.x, pl.z - e.z);
    if (d < r + pl.radius) g.damagePlayer(e.def.slamDamage * e.dmgScale * (e.buffT > 0 ? 1.2 : 1), e.x, e.z, { src: e });
    if (e.miniboss) {
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + Math.random() * 0.1;
        g.projectiles.spawnEnemy('rock', e.x, e.z, Math.sin(a), Math.cos(a), 9, 12 * e.dmgScale, 0.45, 4, '#ff9a3a');
      }
    }
  }

  thrust(e) {
    const g = this.game, pl = g.player;
    const len = 4.2 * e.scale, w = 0.85 * e.scale;
    e.kvx += e.dirX * 14; e.kvz += e.dirZ * 14;
    const px = pl.x - e.x, pz = pl.z - e.z;
    const along = px * e.dirX + pz * e.dirZ;
    const side = Math.abs(px * e.dirZ - pz * e.dirX);
    g.effects.burst(e.x + e.dirX * 2, 1.2, e.z + e.dirZ * 2, 10, '#cfe6ff', 8, 0.3, 0.15);
    g.sound.play('clank');
    if (along > -0.5 && along < len && side < w + pl.radius) g.damagePlayer(e.def.thrustDamage * e.dmgScale, e.x, e.z, { src: e });
  }

  // True if a hit coming from (sx, sz) lands on the Mirror Knight's raised shield.
  blocks(e, sx, sz) {
    if (e.type !== 'knight' || e.guardDown || e.spawnT < 1) return false;
    const dx = sx - e.x, dz = sz - e.z, d = Math.hypot(dx, dz) || 1;
    return (dx / d) * Math.sin(e.rot) + (dz / d) * Math.cos(e.rot) > 0.42;
  }

  render(t) {
    const P = this.pools, g = this.game, fx = g.effects;
    for (const k in P) { P[k].body.begin(); P[k].glow.begin(); P[k].outline.begin(); }
    this.barBg.begin(); this.barFg.begin(); this.auras.begin();
    fx.beginTags();
    const noFlash = g.meta.settings.reduceFlash;

    for (const e of this.list) {
      if (e.dead || e.type === 'boss') continue;
      const pool = P[e.type];
      let em = e.spawnT < 1 ? e.spawnT * e.spawnT : 1;
      if (e.type === 'stalker' && e.state === 'blink') em = e.hidden ? 0 : Math.max(0.05, (e.stateT - (0.75 * g.diff.telegraph - 0.25)) / 0.25);
      if (em <= 0) continue;
      let sx = e.scale * em, sy = e.scale * em, sz = e.scale * em, y = 0;
      const wind = e.state === 'windup' ? 1 - Math.max(0, e.stateT) / 0.9 : 0;
      switch (e.type) {
        case 'crawler': y = Math.abs(Math.sin(t * 14 + e.seed)) * 0.08; break;
        case 'dasher': y = 0.15 + Math.sin(t * 5 + e.seed) * 0.1; if (wind) { sx *= 1 + Math.sin(t * 60) * 0.06; sz *= 0.85; } break;
        case 'spitter': sy *= 1 + wind * 0.35; sx *= 1 + Math.sin(t * 4 + e.seed) * 0.04; break;
        case 'brute': if (wind) { sy *= 1 + wind * 0.12; y = wind * 0.4; } break;
        case 'splitter': sx *= 1 + Math.sin(t * 6 + e.seed) * 0.07; sz *= 1 - Math.sin(t * 6 + e.seed) * 0.07; break;
        case 'priest': y = 0.2 + Math.sin(t * 2 + e.seed) * 0.15; break;
        case 'leech': y = 0.3 + Math.sin(t * 6 + e.seed) * 0.15; if (e.state === 'drain') sx *= 1 + Math.sin(t * 30) * 0.1; break;
        case 'bombardier': sy *= 1 + wind * 0.25; break;
        case 'stalker': if (e.state === 'strikeWind') sy *= 1.15; break;
      }
      let r = 1, gg = 1, b = 1;
      if (e.elite || e.miniboss) { r = 1.45; gg = 1.2; b = 0.65; }
      if (e.buffT > 0) { r *= 0.9; gg *= 0.8; b *= 1.5; }
      if (e.burnT > 0) { r *= 1.4; gg *= 0.85; b *= 0.6; }
      if (e.poisonT > 0) { r *= 0.8; gg *= 1.35; b *= 0.7; }
      if (e.powered) { r *= 1.6; gg *= 0.7; b *= 1.4; }
      if (e.flash > 0) { const f = noFlash ? 1.8 : 4; r = gg = b = f; }
      pool.body.push(e.x, y, e.z, e.rot, sx, sy, sz, r, gg, b);
      let gl = (e.state === 'windup' || e.state === 'strikeWind' ? 1.6 + Math.sin(t * 30) * 0.5 : 1) * (e.elite || e.miniboss ? 1.4 : 1);
      if (e.type === 'knight') gl = e.guardDown ? 0.25 : 1.3 + Math.sin(t * 4) * 0.2;
      if (e.type === 'leech' && e.state === 'drain') gl = 2;
      pool.glow.push(e.x, y, e.z, e.rot, sx, sy, sz, gl, gl, gl);

      if (e.mods.length) {
        tmpC.set(ELITE_MODS[e.mods[0]].color);
        const pulse = e.powered ? 1.4 + Math.sin(t * 12) * 0.4 : 1;
        pool.outline.push(e.x, y - 0.04 * e.scale, e.z, e.rot, sx * 1.13, sy * 1.1, sz * 1.13, tmpC.r * pulse, tmpC.g * pulse, tmpC.b * pulse);
        if (e.spawnT >= 1) fx.tag(e.x, e.height + (e.elite || e.miniboss ? 0.9 : 0.6), e.z, e.mods.map((m) => ELITE_MODS[m].icon).join(' '), ELITE_MODS[e.mods[0]].color);
      }
      if (e.type === 'priest' && e.spawnT >= 1) {
        const ar = e.def.auraRadius * e.scale ** 0.5;
        this.auras.push(e.x, 0.08, e.z, t * 0.5, ar, 1, ar, 0.45, 0.32, 1);
      } else if (e.buffT > 0) {
        this.auras.push(e.x, 0.08, e.z, 0, e.radius * 1.3, 1, e.radius * 1.3, 0.5, 0.35, 1);
      }
      if (e.type === 'leech' && e.state === 'drain') this.auras.push(g.player.x, 0.1, g.player.z, 0, 1.2, 1, 1.2, 1, 0.15, 0.25);

      const showBar = (e.elite && !e.miniboss) || ((e.type === 'brute' || e.type === 'knight' || e.type === 'priest' || e.def.device) && !e.miniboss && e.hp < e.maxHp) || (e.armor > 0 && !e.miniboss);
      if (showBar && e.spawnT >= 1) {
        const w = 1.2 * Math.max(1, e.scale);
        const bx = e.x - w / 2, by = e.height + 0.35, bz = e.z;
        this.barBg.push(bx - 0.04, by, bz + 0.01, 0, w + 0.08, 1.4, 1);
        const f = Math.max(0, e.hp / e.maxHp);
        if (e.elite) this.barFg.push(bx, by, bz + 0.02, 0, w * f, 1, 1, 1, 0.78, 0.2);
        else this.barFg.push(bx, by, bz + 0.02, 0, w * f, 1, 1, 1, 0.25, 0.25);
        if (e.armor > 0) this.barFg.push(bx, by + 0.17, bz + 0.03, 0, w * (e.armor / e.armorMax), 0.7, 1, 0.75, 0.8, 0.9);
      }
    }
    for (const k in P) { P[k].body.end(); P[k].glow.end(); P[k].outline.end(); }
    this.barBg.end(); this.barFg.end(); this.auras.end();
    fx.endTags(g.camera);
  }
}
