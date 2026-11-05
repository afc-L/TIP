// Mech entity (shared by player, AI and bosses), drones and destructible structures.
import * as THREE from 'three';
import { FRAMES, ABILITIES, EQUIPMENT, WEAPONS } from './data.js';
import { computeStats } from './save.js';
import { MechModel, makePalette } from './mechModel.js';
import { WeaponInstance } from './combat.js';
import { clamp, wrapAngle, dampAngle, rand } from './util.js';

const _v = new THREE.Vector3(), _w = new THREE.Vector3();
let NEXT_ID = 1;

const MICRO = { id: 'micro', name: 'Micro Missile', dmgType: 'explosive', kind: 'missile', dmg: 16, splash: 3, speed: 78, turn: 4.5, range: 180, size: 0.3, color: 0xffbb55, spread: 0.3 };
const DRONE_GUN = { ...WEAPONS.arc, id: 'drone', dmg: 8, spread: 0.03 };

export class Mech {
  constructor(game, cfg) {
    this.game = game; this.id = NEXT_ID++;
    this.isMech = true;
    this.loadout = cfg.loadout;
    this.frame = FRAMES[cfg.loadout.frame];
    this.team = cfg.team; this.isPlayer = !!cfg.isPlayer; this.name = cfg.name || this.frame.name;
    this.role = cfg.role || null; this.enemyType = cfg.enemyType || null;
    this.mods = cfg.mods || {};
    this.scale = cfg.scale || 1;
    this.stats = computeStats(cfg.loadout, cfg.upgrades, this.mods);
    if (cfg.hpMul) { this.stats.maxHp *= cfg.hpMul; this.stats.maxShield *= cfg.hpMul; }
    if (cfg.maxHp) this.stats.maxHp = cfg.maxHp;
    if (cfg.maxShield !== undefined) this.stats.maxShield = cfg.maxShield;
    if (cfg.speedMul) this.stats.speed *= cfg.speedMul;
    this.outDmgMul = cfg.outDmgMul || 1;
    this.hp = this.stats.maxHp; this.shield = this.stats.maxShield; this.energy = this.stats.maxEnergy;
    this.overshield = 0; this.overshieldT = 0;
    this.radius = this.stats.radius * this.scale; this.height = this.stats.height * this.scale;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0; this.legYaw = 0; this.onGround = true; this.legDir = 1;
    this.weapons = cfg.loadout.weapons.map((w, i) => new WeaponInstance(w, this, i));
    this.equip = (cfg.loadout.equip || []).filter(Boolean).map((id) => ({ id, def: EQUIPMENT[id], cd: 0 }));
    this.selEquip = 0;
    this.ability = { id: this.frame.ability, def: ABILITIES[this.frame.ability], cd: 0 };
    this.buffs = {};
    this.paletteKey = cfg.palette || (this.isPlayer ? 'player' : cfg.team === 0 ? 'ally' : 'enemy');
    this.model = new MechModel(this.frame.model, makePalette(this.paletteKey, this.frame.id), cfg.loadout.weapons,
      { scale: this.scale, shadows: game.shadows, height: this.height, extras: cfg.extras });
    game.scene.add(this.model.root);
    this.intent = { move: new THREE.Vector2(), sprint: false, jump: false, jet: false, dash: false, fire: [false, false], aim: new THREE.Vector3(), lock: null, equip: -1, ability: false, reload: false };
    this.shieldDelayT = 0; this.energyDelayT = 0;
    this.dashCharges = this.stats.dashCharges; this.dashRecharge = 0; this.dashT = 0; this.dashVel = new THREE.Vector3();
    this.alive = true; this.deadT = 0; this.removed = false;
    this.kills = 0; this.deaths = 0; this.dmgDealt = 0; this.score = 0; this.assists = 0;
    this.lastHitBy = null; this.lastHitTime = -99; this.recentDamage = 0;
    this.cloaked = false; this.slamPending = false; this.jetting = 0; this.sprinting = false;
    this._spheres = [{ c: new THREE.Vector3(), r: 1 }, { c: new THREE.Vector3(), r: 1 }, { c: new THREE.Vector3(), r: 1, crit: true }];
    this._sphereFrame = -1;
    this.controller = null;
    this.invuln = false;
    this.knockRes = this.stats.knockRes + (cfg.knockRes || 0);
    this.smokeT = 0;
  }

  // ---------------- queries ----------------
  get chest() { return _w.set(this.pos.x, this.pos.y + this.height * 0.65, this.pos.z); }
  center(out) { return out.set(this.pos.x, this.pos.y + this.height * 0.55, this.pos.z); }
  eye(out) { return out.set(this.pos.x, this.pos.y + this.height * 0.85, this.pos.z); }
  hitSpheres() {
    if (this._sphereFrame === this.game.frame) return this._spheres;
    this._sphereFrame = this.game.frame;
    const r = this.radius, h = this.height, p = this.pos;
    this._spheres[0].c.set(p.x, p.y + h * 0.32, p.z); this._spheres[0].r = r * 1.05;
    this._spheres[1].c.set(p.x, p.y + h * 0.64, p.z); this._spheres[1].r = r * 1.1;
    this._spheres[2].c.set(p.x + Math.sin(this.yaw) * r * 0.2, p.y + h * 0.9, p.z + Math.cos(this.yaw) * r * 0.2); this._spheres[2].r = r * 0.45;
    return this._spheres;
  }
  muzzlePos(slot, out) {
    const m = this.model.muzzles[slot] || this.model.muzzles[0];
    if (m) { m.getWorldPosition(out); return out; }
    return this.center(out);
  }
  hpFrac() { return (this.hp + this.shield) / (this.stats.maxHp + this.stats.maxShield); }
  speedMul() {
    const b = this.buffs;
    let m = 1;
    if (b.overdrive) m *= 1.4; if (b.overclock) m *= 1.25; if (b.servo) m *= 1.35; if (b.fortify) m *= 0.6;
    if (b.slow) m *= 0.6;
    return m;
  }
  fireRateMul() { let m = 1; if (this.buffs.overdrive) m *= 1.35; if (this.buffs.overclock) m *= 1.15; return m; }
  damageMul() {
    let m = this.stats.dmgMul * this.outDmgMul;
    if (this.buffs.fortify) m *= 1.4; if (this.buffs.overclock) m *= 1.25; if (this.buffs.uplink) m *= 1.2;
    return m;
  }
  dmgTakenMul() {
    let m = 1;
    if (this.buffs.fortify) m *= 0.5;
    if (this.buffs.aegisDome) m *= 0.3;
    if (this.buffs.vulnerable) m *= 1.5;
    return m;
  }
  spreadMul() {
    const sp = Math.hypot(this.vel.x, this.vel.z) / this.stats.speed;
    let m = 1 + clamp(sp, 0, 1.5) * 0.9 * (1 - this.stats.stability);
    if (!this.onGround) m += 0.5;
    if (this.buffs.uplink) m *= 0.5;
    return m;
  }

  // ---------------- abilities ----------------
  useAbility() {
    const a = this.ability, g = this.game;
    if (this.mods.noAbility || a.cd > 0 || !this.alive) return false;
    a.cd = a.def.cd * this.stats.cdMul;
    g.sound('ability', this.pos, 1);
    g.onAbility(this);
    switch (a.id) {
      case 'barrage': {
        const tgt = this.intent.lock && this.intent.lock.alive ? this.intent.lock : null;
        for (let i = 0; i < 12; i++) {
          g.schedule(i * 0.07, () => {
            if (!this.alive || g.ended) return;
            const from = this.center(new THREE.Vector3()); from.y += this.height * 0.35;
            const dir = new THREE.Vector3(rand(-0.4, 0.4), 1, rand(-0.4, 0.4)).normalize();
            g.projectiles.spawn(this, from, dir, MICRO, MICRO.dmg * this.damageMul(), tgt, this.intent.aim);
            g.sound('missile', from, 0.5);
          });
        }
        break;
      }
      case 'overdrive': this.buffs.overdrive = a.def.dur; break;
      case 'aegis': this.buffs.aegisDome = a.def.dur; g.spawnDome(this, a.def.dur); break;
      case 'slam':
        this.vel.y = 17 * Math.sqrt(g.gravityMul); this.onGround = false; this.slamPending = true;
        _v.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)).multiplyScalar(10);
        this.vel.x += _v.x; this.vel.z += _v.z;
        break;
      case 'cloak': this.buffs.cloak = a.def.dur; break;
      case 'fortify': this.buffs.fortify = a.def.dur; g.effects.ring(this.pos, 8, 0xffcc44, 0.6); break;
      case 'blink': this.blink(28); break;
      case 'overclock':
        this.buffs.overclock = a.def.dur;
        for (const e of this.equip) e.cd = 0;
        for (const w of this.weapons) { w.heat = 0; w.overheated = false; }
        g.effects.ring(this.pos, 10, 0xff3df2, 0.6);
        break;
    }
    return true;
  }

  blink(dist) {
    const g = this.game;
    const dir = new THREE.Vector3(this.intent.move.x, 0, this.intent.move.y);
    if (dir.lengthSq() < 0.01) dir.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    dir.normalize();
    g.effects.flash(this.center(_v), 3, 0xb388ff, 0.3);
    g.effects.sparks(this.center(_v), 20, 0xb388ff, 12);
    let best = this.pos.clone();
    for (let d = 2; d <= dist; d += 2) {
      const p = this.pos.clone().addScaledVector(dir, d);
      if (Math.abs(p.x) > g.arena.half - 3 || Math.abs(p.z) > g.arena.half - 3) break;
      if (g.arena.nav.walkable(p.x, p.z)) best = p;
    }
    this.pos.copy(best);
    this.pos.y = g.arena.groundAt(this.pos.x, this.pos.z, this.radius, this.pos.y + 3);
    this.shield = Math.min(this.stats.maxShield, this.shield + this.stats.maxShield * 0.25);
    g.effects.flash(this.center(_v), 3, 0xb388ff, 0.3);
    g.sound('warp', this.pos, 1);
  }

  useEquip(i) {
    const e = this.equip[i], g = this.game;
    if (!e || this.mods.noEquip || e.cd > 0 || !this.alive) return false;
    e.cd = e.def.cd * this.stats.cdMul;
    g.sound('equip', this.pos, 0.9);
    switch (e.id) {
      case 'aegis': this.overshield = 300; this.overshieldT = e.def.dur; this.model.hitShield(true); break;
      case 'repair': this.buffs.repair = e.def.dur; g.sound('heal', this.pos, 1); break;
      case 'boost': {
        const dir = new THREE.Vector3(this.intent.move.x, 0, this.intent.move.y);
        if (dir.lengthSq() < 0.01) dir.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
        dir.normalize();
        this.dashT = 0.32; this.dashVel.copy(dir).multiplyScalar(48);
        g.sound('dash', this.pos, 1);
        break;
      }
      case 'servo': this.buffs.servo = e.def.dur; break;
      case 'target': this.buffs.uplink = e.def.dur; break;
      case 'ecm':
        this.buffs.ecm = e.def.dur;
        g.projectiles.destroyMissilesNear(this.pos, 35, this.team);
        g.effects.ring(this.pos, 30, 0x88ccff, 0.6);
        break;
      case 'capacitor': this.shield = this.stats.maxShield; this.model.hitShield(); g.effects.ring(this.pos, 6, 0x66ddff, 0.5); break;
      case 'drone': g.spawnDrone(this, e.def.dur); break;
    }
    return true;
  }

  applyKnock(v) {
    const k = 1 - this.knockRes;
    this.vel.addScaledVector(v, k);
    if (v.y > 0.5 * k) this.onGround = false;
  }

  // ---------------- update ----------------
  update(dt) {
    const g = this.game, I = this.intent, st = this.stats;
    if (!this.alive) {
      this.deadT += dt;
      this.smokeT -= dt;
      if (this.smokeT <= 0 && this.deadT < 6) { this.smokeT = 0.15; g.effects.smokePuff(this.center(_v), 2.5, 2, 0.12, 3); }
      if (this.deadT > 0.5 && this.deadT < 0.55 && !this._boom2) { this._boom2 = true; g.effects.explosion(this.center(_v), 4 * this.scale, 0xffaa44, 0.3); }
      this.model.update(dt, { fwdSpeed: 0, sideSpeed: 0, maxSpeed: 1, onGround: true, vy: 0, aimPitch: 0, torsoYaw: 0, jet: 0 });
      return;
    }
    // buffs
    for (const k in this.buffs) {
      this.buffs[k] -= dt;
      if (this.buffs[k] <= 0) delete this.buffs[k];
    }
    if (this.buffs.repair) { this.hp = Math.min(st.maxHp, this.hp + st.maxHp * 0.07 * dt); }
    if (this.overshieldT > 0) { this.overshieldT -= dt; if (this.overshieldT <= 0) this.overshield = 0; }
    this.model.overshield = this.overshield;
    const cloakNow = !!this.buffs.cloak;
    if (cloakNow !== this.cloaked) { this.cloaked = cloakNow; this.model.setCloak(cloakNow ? (this.isPlayer ? 0.3 : 0.07) : 1); }

    if (this.controller) this.controller.update(dt);
    if (this.ability.cd > 0) this.ability.cd -= dt;
    for (const e of this.equip) if (e.cd > 0) e.cd -= dt;
    if (I.ability) { this.useAbility(); I.ability = false; }
    if (I.equip >= 0) { this.useEquip(I.equip); I.equip = -1; }
    if (I.reload) { let r = false; for (const w of this.weapons) r = w.reload() || r; if (r && this.isPlayer) g.sound('reload', this.pos, 0.8); I.reload = false; }

    // ---------------- movement ----------------
    const sm = this.speedMul();
    const moveLen = Math.min(1, I.move.length());
    let sprint = I.sprint && moveLen > 0.2 && this.energy > 2;
    if (sprint) { this.energy -= st.sprintCost * dt; this.energyDelayT = 0.4; }
    this.sprinting = sprint;
    const maxSp = st.speed * sm * (sprint ? 1.45 : 1);
    const ctrl = this.onGround ? st.accel : st.accel * 0.35;
    const tx = moveLen > 0.01 ? I.move.x / Math.max(1, I.move.length()) * maxSp : 0;
    const tz = moveLen > 0.01 ? I.move.y / Math.max(1, I.move.length()) * maxSp : 0;
    // dash
    if (this.dashRecharge > 0) { this.dashRecharge -= dt; if (this.dashRecharge <= 0 && this.dashCharges < st.dashCharges) { this.dashCharges++; if (this.dashCharges < st.dashCharges) this.dashRecharge = 1.1; } }
    if (I.dash) {
      I.dash = false;
      if (this.dashCharges > 0 && this.energy >= st.dashCost && this.dashT <= 0) {
        const dir = new THREE.Vector3(I.move.x, 0, I.move.y);
        if (dir.lengthSq() < 0.01) dir.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
        dir.normalize();
        this.dashT = 0.22; this.dashVel.copy(dir).multiplyScalar(30 + maxSp * 0.6);
        this.energy -= st.dashCost; this.energyDelayT = 0.6; this.dashCharges--; if (this.dashRecharge <= 0) this.dashRecharge = 1.1;
        g.sound('dash', this.pos, this.isPlayer ? 0.9 : 0.6);
        g.effects.smokePuff(this.pos, 2.5, 0.6, 0.5, 0.5);
      }
    }
    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vel.x = this.dashVel.x; this.vel.z = this.dashVel.z;
      if (Math.random() < 0.6) g.effects.trail(this.center(_v), this.model.P.glowColor, 1.5, 0.25);
    } else {
      const k = Math.min(1, ctrl * dt);
      this.vel.x += (tx - this.vel.x) * k; this.vel.z += (tz - this.vel.z) * k;
    }
    // vertical
    const grav = 30 * g.gravityMul;
    if (I.jump && this.onGround) {
      this.vel.y = st.jump * (this.buffs.servo ? 1.4 : 1) * Math.sqrt(g.gravityMul);
      this.onGround = false;
      g.effects.smokePuff(this.pos, 2, 0.6, 0.5, 0.5);
    }
    I.jump = false;
    this.jetting = 0;
    if (!this.onGround && I.jet && this.energy > 1 && this.vel.y < 9) {
      const thrust = 36 * st.jet;
      this.vel.y += thrust * dt;
      this.energy -= 26 / Math.sqrt(st.jet) * dt; this.energyDelayT = 0.5;
      this.jetting = 1;
      if (this.isPlayer && Math.random() < 0.3) g.sound('jet', this.pos, 0.5);
    }
    if (this.frame.hover && !this.onGround && this.vel.y < -6) this.vel.y = -6; // hover frames glide
    this.vel.y -= grav * dt;
    this.pos.addScaledVector(this.vel, dt);
    // collisions
    const wasGround = this.onGround;
    if (g.arena.resolve(this.pos, this.radius, this.height)) {
      if (this.dashT > 0) this.dashT = Math.min(this.dashT, 0.05);
    }
    const gy = g.arena.groundAt(this.pos.x, this.pos.z, this.radius, this.pos.y);
    if (this.pos.y <= gy + 0.001) {
      if (!wasGround) {
        const impact = -this.vel.y;
        if (impact > 7) {
          this.model.land(impact / 25);
          g.sound('land', this.pos, clamp(impact / 25, 0.3, 1));
          g.effects.smokePuff(this.pos, 3, 0.8, 0.45, 1);
          if (this.isPlayer) g.effects.addShake(clamp(impact / 60, 0, 0.35));
        }
        if (this.slamPending) this._slam();
      }
      this.pos.y = gy; this.vel.y = Math.max(0, this.vel.y); this.onGround = true;
    } else if (this.pos.y > gy + 0.25) this.onGround = false;
    else if (wasGround) { this.pos.y = gy; this.vel.y = 0; } // snap when walking down small steps

    // ---------------- aim ----------------
    const eye = this.eye(_v);
    const dx = I.aim.x - eye.x, dy = I.aim.y - eye.y, dz = I.aim.z - eye.z;
    const hd = Math.hypot(dx, dz);
    if (hd > 0.5) {
      const ty = Math.atan2(dx, dz);
      if (this.turnRate) { const df = wrapAngle(ty - this.yaw); this.yaw = wrapAngle(this.yaw + clamp(df, -this.turnRate * dt, this.turnRate * dt)); }
      else this.yaw = dampAngle(this.yaw, ty, this.isPlayer ? 40 : 10, dt);
    }
    this.pitch = clamp(Math.atan2(dy, Math.max(hd, 0.1)), -0.9, 0.9);
    // legs follow movement
    const hsp = Math.hypot(this.vel.x, this.vel.z);
    if (hsp > 1.0) {
      const mv = Math.atan2(this.vel.x, this.vel.z);
      let rel = wrapAngle(mv - this.yaw);
      let target = mv; this.legDir = 1;
      if (Math.abs(rel) > Math.PI * 0.6) { target = mv + Math.PI; this.legDir = -1; }
      this.legYaw = dampAngle(this.legYaw, target, 7 * (st.accel / 6), dt);
    } else if (Math.abs(wrapAngle(this.yaw - this.legYaw)) > 1.2) {
      this.legYaw = dampAngle(this.legYaw, this.yaw, 3, dt);
    }

    // ---------------- weapons ----------------
    for (let s = 0; s < this.weapons.length; s++) {
      const w = this.weapons[s];
      if (I.fire[s] && !(s === 1 && this.mods.noSecondary)) {
        if (w.tryFire(g, I.aim, I.lock)) {
          if (this.buffs.cloak) this.buffs.cloak = Math.min(this.buffs.cloak, 1.0);
        }
      }
      w.update(dt, g);
    }

    // ---------------- regen ----------------
    this.shieldDelayT -= dt;
    if (this.shieldDelayT <= 0 && this.shield < st.maxShield) this.shield = Math.min(st.maxShield, this.shield + st.shieldRegen * g.shieldRegenMul * dt);
    this.energyDelayT -= dt;
    if (this.energyDelayT <= 0) this.energy = Math.min(st.maxEnergy, this.energy + st.energyRegen * g.energyRegenMul * (this.buffs.servo ? 2 : 1) * dt);
    this.recentDamage = Math.max(0, this.recentDamage - dt * 40);

    // hazard
    const hz = g.arena.hazardAt(this.pos.x, this.pos.z, this.pos.y);
    if (hz) {
      g.applyDamage(this, hz.dps * dt, 'hazard', null, this.pos, { silent: true });
      if (Math.random() < 0.3) g.effects.sparks(this.pos, 2, 0xff7a20, 6, 0.4, 0.5);
    }

    // ---------------- model ----------------
    const root = this.model.root;
    root.position.copy(this.pos);
    root.rotation.y = this.legYaw;
    const cosL = Math.cos(this.legYaw), sinL = Math.sin(this.legYaw);
    const fwd = this.vel.x * sinL + this.vel.z * cosL;
    const side = this.vel.x * cosL - this.vel.z * sinL;
    const step = this.model.update(dt, {
      fwdSpeed: fwd, sideSpeed: side, maxSpeed: st.speed, onGround: this.onGround, vy: this.vel.y,
      aimPitch: this.pitch, torsoYaw: wrapAngle(this.yaw - this.legYaw), jet: this.jetting || (this.dashT > 0 ? 0.8 : 0),
      stepLen: this.frame.stepLen * this.scale, sprint: this.sprinting,
    });
    if (step) {
      const heavy = clamp(this.stats.maxHp / 900, 0.6, 1.8) * this.scale;
      g.sound('step', this.pos, (this.isPlayer ? 0.45 : 0.35) * heavy, 1 / Math.sqrt(heavy));
      if (this.isPlayer && heavy > 1.2) g.effects.addShake(0.04 * heavy);
      if (this.scale > 1.5) { g.effects.addShake(0.12); g.effects.smokePuff(this.pos, 3 * this.scale, 0.8, 0.4, 0.5); }
    }
    // damaged smoke
    if (this.hp / st.maxHp < 0.35) {
      this.smokeT -= dt;
      if (this.smokeT <= 0) { this.smokeT = 0.25; g.effects.smokePuff(this.chest, 1.4 * this.scale, 1.3, 0.15, 3); if (Math.random() < 0.3) g.effects.sparks(this.chest, 3, 0xffcc66, 6); }
    }
  }

  _slam() {
    this.slamPending = false;
    const g = this.game;
    g.effects.explosion(this.pos.clone().setY(this.pos.y + 0.5), 7, 0xffcc66, 0.8);
    g.effects.ring(this.pos, 16, 0xffcc66, 0.6);
    g.sound('slam', this.pos, 1);
    for (const t of g.targets) {
      if (!t.alive || t.team === this.team) continue;
      const d = t.pos.distanceTo(this.pos);
      if (d < 15) {
        g.applyDamage(t, 140 * (1 - d / 22) * this.damageMul(), 'impact', this, t.pos.clone().setY(t.pos.y + 2), { weapon: 'slam' });
        if (t.applyKnock) { _v.subVectors(t.pos, this.pos).setY(0).normalize().multiplyScalar(22).setY(9); t.applyKnock(_v); }
      }
    }
  }

  die() {
    if (!this.alive) return;
    this.alive = false; this.deadT = 0;
    this.model.kill();
    if (this.cloaked) this.model.setCloak(1);
    const c = this.center(new THREE.Vector3());
    this.game.effects.explosion(c, 5 * this.scale, 0xff9a40, this.isPlayer ? 1 : 0.5);
    this.game.effects.sparks(c, 30, 0xffd080, 18, 0.5, 1);
    this.game.sound(this.scale > 1.5 ? 'bigexplosion' : 'explosion', this.pos, 1);
  }

  dispose() {
    this.game.scene.remove(this.model.root);
    this.model.dispose();
  }
}

// ---------------------------------------------------------------------------
// Sentry drone
// ---------------------------------------------------------------------------
export class Drone {
  constructor(game, owner, life) {
    this.game = game; this.owner = owner; this.life = life; this.cd = 0; this.team = owner.team;
    this.pos = owner.pos.clone().setY(owner.pos.y + owner.height + 2);
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), new THREE.MeshStandardMaterial({ color: 0xcfd6de, metalness: 0.6, roughness: 0.4, flatShading: true }));
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ color: owner.model.P.glowColor }));
    eye.position.z = 0.5;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.08, 4, 14), new THREE.MeshBasicMaterial({ color: owner.model.P.glowColor }));
    ring.rotation.x = Math.PI / 2;
    g.add(body, eye, ring); this.mesh = g; this.ring = ring;
    game.scene.add(g);
    this.t = 0; this.side = Math.random() < 0.5 ? -1 : 1;
  }
  update(dt) {
    const g = this.game, o = this.owner;
    this.life -= dt; this.t += dt; this.cd -= dt;
    const goal = _v.set(o.pos.x + Math.cos(this.t * 0.8) * 5 * this.side, o.pos.y + o.height + 2.5 + Math.sin(this.t * 2) * 0.5, o.pos.z + Math.sin(this.t * 0.8) * 5);
    this.pos.lerp(goal, Math.min(1, dt * 3));
    this.mesh.position.copy(this.pos);
    this.ring.rotation.z += dt * 4;
    // target
    let best = null, bd = 70;
    for (const t of g.targets) {
      if (!t.alive || t.team === this.team || t.cloaked || t.intangible) continue;
      const d = t.pos.distanceTo(this.pos);
      if (d < bd && g.arena.lineOfSight(this.pos, t.center ? t.center(_w) : t.pos)) { bd = d; best = t; }
    }
    if (best) {
      const c = best.center ? best.center(new THREE.Vector3()) : best.pos.clone();
      this.mesh.lookAt(c);
      if (this.cd <= 0) {
        this.cd = 0.14;
        const dir = c.clone().sub(this.pos).normalize();
        dir.x += rand(-0.03, 0.03); dir.y += rand(-0.02, 0.02); dir.normalize();
        g.projectiles.spawn(o, this.pos, dir, DRONE_GUN, DRONE_GUN.dmg * o.damageMul(), null, null);
        g.sound('arc', this.pos, 0.35);
      }
    }
    return this.life > 0 && o.alive;
  }
  dispose() {
    this.game.scene.remove(this.mesh);
    this.mesh.traverse((x) => { if (x.geometry) x.geometry.dispose(); if (x.material) x.material.dispose(); });
  }
}

// ---------------------------------------------------------------------------
// Destructible structure (pylons, cores, barrels, decoys)
// ---------------------------------------------------------------------------
export class Structure {
  constructor(game, o) {
    this.game = game; this.isStructure = true;
    this.kind = o.kind; this.team = o.team ?? 1; this.name = o.name || o.kind;
    this.pos = o.pos.clone(); this.radius = o.radius; this.height = o.height;
    this.hp = o.hp; this.stats = { maxHp: o.hp, maxShield: 0 }; this.shield = 0; this.overshield = 0;
    this.resist = o.resist || {};
    this.alive = true; this.mesh = o.mesh; this.onDeath = o.onDeath; this.invuln = !!o.invuln;
    this.buffs = {}; this.intangible = !!o.intangible;
    this.vel = new THREE.Vector3();
    if (this.mesh) { this.mesh.position.copy(this.pos); game.scene.add(this.mesh); }
    this._spheres = [];
    const n = Math.max(1, Math.round(this.height / (this.radius * 1.6)));
    for (let i = 0; i < n; i++) this._spheres.push({ c: new THREE.Vector3(this.pos.x, this.pos.y + (i + 0.5) * this.height / n, this.pos.z), r: this.radius * 1.05 });
    this.box = null;
    if (o.solid) this.box = game.arena.addDynamicBox({ minX: this.pos.x - this.radius * 0.8, maxX: this.pos.x + this.radius * 0.8, minY: this.pos.y, maxY: this.pos.y + this.height, minZ: this.pos.z - this.radius * 0.8, maxZ: this.pos.z + this.radius * 0.8, cover: this.height > 3.5 });
    this.update = o.update || null;
  }
  center(out) { return out.set(this.pos.x, this.pos.y + this.height * 0.5, this.pos.z); }
  hitSpheres() { return this._spheres; }
  dmgTakenMul() { return 1; }
  hpFrac() { return this.hp / this.stats.maxHp; }
  setPos(p) {
    const dx = p.x - this.pos.x, dy = p.y - this.pos.y, dz = p.z - this.pos.z;
    this.pos.copy(p);
    for (const s of this._spheres) { s.c.x += dx; s.c.y += dy; s.c.z += dz; }
    if (this.mesh) this.mesh.position.copy(p);
  }
  die() {
    if (!this.alive) return;
    this.alive = false;
    if (this.box) this.box.dead = true;
    if (this.mesh) { this.game.scene.remove(this.mesh); }
    if (this.onDeath) this.onDeath(this);
  }
  dispose() {
    if (this.mesh) {
      this.game.scene.remove(this.mesh);
      this.mesh.traverse((x) => { if (x.geometry && !x.geometry.userData.shared) x.geometry.dispose(); if (x.material && !x.material.userData.shared) x.material.dispose(); });
    }
  }
}
