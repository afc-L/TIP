// Actor: a combatant (human or AI). Both drive it through the same `input` interface, so the AI obeys
// exactly the same movement, ammo, reload, building and healing rules as the player.
import * as THREE from 'three';
import { CHAR_R, CHAR_H, CROUCH_H, MOVE, GRAVITY, WATER_Y, MAX_MATS, RARITY } from './config.js';
import { clamp, dirFromYawPitch, yawTo, angleDiff } from './util.js';
import { CONSUMABLES, WEAPONS, makeConsumable } from './items.js';

let ACTOR_ID = 0;
const _v = new THREE.Vector3();

export class Actor {
  constructor(game, name, isPlayer, appearance) {
    this.game = game;
    this.id = ACTOR_ID++;
    this.name = name;
    this.isPlayer = isPlayer;
    this.ap = appearance;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.aimDir = new THREE.Vector3(0, 0, -1);
    this.radius = CHAR_R; this.height = CHAR_H;
    this.grounded = false; this.groundY = 0; this.landSpeed = 0;
    this.mode = 'bus';
    this.alive = true;
    this.health = 100; this.shield = 0;
    this.slots = [null, null, null, null, null];
    this.sel = -1;               // -1 = harvesting tool
    this.ammo = { light: 0, medium: 0, heavy: 0, shells: 0, rockets: 0 };
    this.mats = { wood: 0, stone: 0, metal: 0 };
    this.buildMat = 'wood';
    this.input = { mx: 0, mz: 0, sprint: false, jump: false, crouch: false, fire: false, ads: false, dive: 0, deploy: false };
    this.prevFire = false; this.prevJump = false; this.prevCrouch = false;
    this.crouching = false; this.sliding = false; this.swimming = false; this.sprinting = false;
    this.mantle = null;
    this.fireCd = 0; this.reloadT = 0; this.equipT = 0; this.burstLeft = 0; this.burstT = 0;
    this.bloom = 0; this.spin = 0; this.charge = 0; this.swingT = 0;
    this.useT = 0; this.useItem = null;
    this.regenPool = 0; this.regenT = 0;
    this.kills = 0; this.damageDealt = 0; this.placement = 0;
    this.lastHitBy = null; this.lastHitTime = -99; this.lastHitDir = null;
    this.phase = 0; this.flash = 0; this.speed = 0;
    this.stormTick = 0;
    this.lod = 0;                // 0 near, 1 mid, 2 far
    this.noiseT = 0;
    this.stepT = 0;
    this.chestT = 0; this.chestTarget = null;
    this.emote = false;
    this.deathTime = 0;
    this.buildCd = 0;
    this.harvested = 0;
    this.structuresBuilt = 0;
    this.chestsOpened = 0;
    this.distance = 0;
  }

  get eyeY() { return this.pos.y + (this.crouching || this.sliding ? 1.05 : 1.55); }
  get held() { return this.sel >= 0 ? this.slots[this.sel] : null; }
  get totalHp() { return this.health + this.shield; }
  get airborne() { return this.mode === 'skydive' || this.mode === 'glide'; }

  // ---------------- inventory ----------------
  freeSlot() { return this.slots.findIndex((s) => !s); }
  addMats(type, n) {
    const before = this.mats[type];
    this.mats[type] = Math.min(MAX_MATS, before + n);
    return this.mats[type] - before;
  }
  addAmmo(type, n) { this.ammo[type] = Math.min(999, this.ammo[type] + n); }
  // returns true if fully absorbed
  giveItem(item) {
    if (item.kind === 'consumable') {
      for (const s of this.slots) {
        if (s && s.kind === 'consumable' && s.type === item.type && s.count < s.def.stack) {
          const take = Math.min(item.count, s.def.stack - s.count);
          s.count += take; item.count -= take;
          if (item.count <= 0) return true;
        }
      }
    }
    const f = this.freeSlot();
    if (f < 0) return false;
    this.slots[f] = item;
    if (this.sel === -1 && item.kind === 'weapon' && !this.isPlayer) this.select(f);
    return true;
  }
  select(i) {
    if (i === this.sel) return;
    if (i >= 0 && !this.slots[i]) return;
    this.sel = i;
    this.reloadT = 0;
    this.useT = 0; this.useItem = null;
    this.burstLeft = 0; this.spin = 0; this.charge = 0;
    this.equipT = 0.28;
  }
  dropSlot(i) {
    const it = this.slots[i];
    if (!it) return null;
    this.slots[i] = null;
    if (this.sel === i) { this.sel = -1; this.reloadT = 0; this.useT = 0; }
    return it;
  }

  // ---------------- damage ----------------
  takeDamage(amount, attacker, opts = {}) {
    if (!this.alive || amount <= 0) return 0;
    if (this.game.godMode && this.isPlayer) return 0;
    let dealtShield = 0, dealtHp = 0;
    let rem = amount;
    if (!opts.bypassShield && this.shield > 0) {
      dealtShield = Math.min(this.shield, rem);
      this.shield -= dealtShield; rem -= dealtShield;
    }
    dealtHp = Math.min(this.health, rem);
    this.health -= dealtHp;
    this.flash = 0.08;
    if (attacker && attacker !== this) {
      this.lastHitBy = attacker;
      this.lastHitTime = this.game.time;
      this.lastHitDir = attacker.pos.clone();
    }
    // interrupt healing when hurt badly
    if (this.useItem && amount > 20 && this.useItem.def && !this.useItem.def.throwable) { this.useT = 0; this.useItem = null; }
    this.game.onDamage(this, attacker, dealtShield + dealtHp, dealtShield > 0 && dealtHp === 0, opts);
    if (this.health <= 0) {
      this.health = 0;
      this.die(attacker, opts);
    }
    return dealtShield + dealtHp;
  }
  heal(hp, cap) { this.health = Math.min(Math.max(this.health, cap), Math.min(cap, this.health + hp)); }
  addShield(s, cap) { if (this.shield < cap) this.shield = Math.min(cap, this.shield + s); }

  die(killer, opts) {
    if (!this.alive) return;
    this.alive = false;
    this.mode = 'dead';
    this.deathTime = this.game.time;
    this.game.onEliminated(this, killer, opts);
  }

  // ---------------- per-frame update ----------------
  update(dt) {
    if (!this.alive) return;
    const g = this.game;
    this.flash -= dt;
    this.buildCd -= dt;
    switch (this.mode) {
      case 'bus': this.updateBus(); return;
      case 'skydive': this.updateSkydive(dt); break;
      case 'glide': this.updateGlide(dt); break;
      default: this.updateGround(dt); break;
    }
    this.updateWeapon(dt);
    // regen (Citrus Fizz)
    if (this.regenPool > 0) {
      this.regenT -= dt;
      if (this.regenT <= 0) {
        this.regenT = 0.5;
        const amt = Math.min(5, this.regenPool);
        this.regenPool -= amt;
        if (this.health < 100) this.health = Math.min(100, this.health + amt);
        else this.shield = Math.min(100, this.shield + amt);
      }
    }
    // animation phase
    const hs = Math.hypot(this.vel.x, this.vel.z);
    this.speed = hs;
    this.phase += dt * (this.mode === 'ground' ? hs * 1.55 + 1 : 4);
    if (this.mode === 'ground' && this.grounded && hs > 0.5) this.distance += hs * dt;
  }

  updateBus() {
    const b = this.game.bus;
    this.pos.copy(b.pos);
    this.vel.copy(b.vel);
  }

  jumpFromBus() {
    if (this.mode !== 'bus') return;
    this.mode = 'skydive';
    const b = this.game.bus;
    this.pos.copy(b.pos); this.pos.y -= 3;
    this.vel.set(b.vel.x * 0.4, -4, b.vel.z * 0.4);
    this.game.onJump(this);
  }

  heightAboveGround() {
    const gy = this.game.phys.groundAt(this.pos.x, this.pos.z, this.pos.y, 0.3);
    return this.pos.y - Math.max(gy, WATER_Y);
  }

  updateSkydive(dt) {
    const inp = this.input;
    const dive = clamp(inp.dive, 0, 1);
    const hMax = MOVE.skydiveH * (1 - dive * 0.65);
    const tx = inp.mx * hMax, tz = inp.mz * hMax;
    this.vel.x += (tx - this.vel.x) * Math.min(1, dt * 1.4);
    this.vel.z += (tz - this.vel.z) * Math.min(1, dt * 1.4);
    const vy = -(MOVE.skydiveV + (MOVE.diveV - MOVE.skydiveV) * dive);
    this.vel.y += (vy - this.vel.y) * Math.min(1, dt * 1.5);
    this.pos.addScaledVector(this.vel, dt);
    const agl = this.heightAboveGround();
    if (agl < MOVE.glideAuto || (inp.deploy && agl < 150)) {
      this.mode = 'glide';
      this.game.onGlide(this);
    }
    if (!this.isPlayer && (inp.mx || inp.mz)) this.yaw += angleDiff(this.yaw, yawTo(inp.mx, inp.mz)) * Math.min(1, dt * 3);
  }

  updateGlide(dt) {
    const inp = this.input;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    // glide: steer, base forward drift
    let tx = inp.mx * MOVE.glideH, tz = inp.mz * MOVE.glideH;
    if (!inp.mx && !inp.mz) { tx = fx * 6; tz = fz * 6; }
    this.vel.x += (tx - this.vel.x) * Math.min(1, dt * 1.6);
    this.vel.z += (tz - this.vel.z) * Math.min(1, dt * 1.6);
    const vy = -(MOVE.glideV + clamp(inp.dive, 0, 1) * 7);
    this.vel.y += (vy - this.vel.y) * Math.min(1, dt * 3);
    this.bank = clamp(angleDiff(this.yaw, yawTo(this.vel.x, this.vel.z)) * 0.6, -0.5, 0.5);
    if (!this.isPlayer && Math.abs(this.vel.x) + Math.abs(this.vel.z) > 1) this.yaw += angleDiff(this.yaw, yawTo(this.vel.x, this.vel.z)) * Math.min(1, dt * 3);
    this.grounded = false;
    this.game.phys.moveBody(this, dt);
    if (this.grounded || this.pos.y < WATER_Y - 1) {
      this.mode = 'ground';
      this.vel.y = 0;
      this.game.onLand(this);
    }
  }

  updateGround(dt) {
    const g = this.game, phys = g.phys, inp = this.input;
    // mantle in progress
    if (this.mantle) {
      const m = this.mantle;
      m.t += dt / m.dur;
      const k = Math.min(1, m.t);
      const up = Math.min(1, k * 1.6);
      this.pos.x = m.sx + (m.tx - m.sx) * k;
      this.pos.z = m.sz + (m.tz - m.sz) * k;
      this.pos.y = m.sy + (m.ty - m.sy) * up;
      this.vel.set(0, 0, 0);
      if (k >= 1) { this.mantle = null; this.grounded = true; }
      return;
    }
    // water
    const deep = phys.isDeepWater(this.pos.x, this.pos.z);
    const floatY = WATER_Y - 1.25;
    this.swimming = deep && this.pos.y <= floatY + 0.3;
    // crouch / slide
    const crouchPressed = inp.crouch && !this.prevCrouch;
    this.prevCrouch = inp.crouch;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (!this.swimming && inp.crouch) {
      if (!this.crouching && !this.sliding && crouchPressed && this.grounded && hs > 5.2) {
        this.sliding = true;
        const k = MOVE.slideBoost / Math.max(hs, 0.1);
        this.vel.x *= k; this.vel.z *= k;
        g.audio.playAt('slide', this.pos, 0.5);
      }
      if (!this.sliding) this.crouching = true;
    } else if (!this.sliding) {
      if (this.crouching) {
        // stand up only if there's head room
        if (phys.fits(this.pos.x, this.pos.y + 0.05, this.pos.z, this.radius * 0.9, CHAR_H)) this.crouching = false;
      }
    }
    this.height = this.crouching || this.sliding ? CROUCH_H : CHAR_H;

    const held = this.held;
    const ads = inp.ads && !this.swimming && held && held.kind === 'weapon';
    this.ads = !!ads;
    const wantSprint = inp.sprint && !ads && !this.crouching && !this.useItem;
    this.sprinting = wantSprint && (inp.mx || inp.mz);
    let speed = this.swimming ? MOVE.swim : this.crouching ? MOVE.crouch : ads ? MOVE.ads : wantSprint ? MOVE.sprint : MOVE.walk;
    if (this.useItem && this.useItem.kind === 'consumable') speed = Math.min(speed, MOVE.crouch);
    const tx = inp.mx * speed, tz = inp.mz * speed;
    if (this.sliding) {
      // slide: keep momentum, slow friction; faster down hills
      const slope = (this.groundY - (this._lastGround ?? this.groundY));
      let fr = 3.2;
      if (slope < -0.02) fr = -2;
      const k = Math.max(0, hs - fr * dt) / Math.max(hs, 0.001);
      this.vel.x *= k; this.vel.z *= k;
      this.vel.x += tx * dt * 0.6; this.vel.z += tz * dt * 0.6;
      const nhs = Math.hypot(this.vel.x, this.vel.z);
      if (nhs > 13) { this.vel.x *= 13 / nhs; this.vel.z *= 13 / nhs; }
      if (nhs < 3.2 || (!this.grounded && this.vel.y < -6) || this.swimming) {
        this.sliding = false;
        this.crouching = inp.crouch || !phys.fits(this.pos.x, this.pos.y + 0.05, this.pos.z, this.radius * 0.9, CHAR_H);
      }
    } else {
      const acc = this.grounded || this.swimming ? 42 : 9;
      let dx = tx - this.vel.x, dz = tz - this.vel.z;
      const dl = Math.hypot(dx, dz), mx = acc * dt;
      if (dl > mx) { dx *= mx / dl; dz *= mx / dl; }
      this.vel.x += dx; this.vel.z += dz;
    }
    this._lastGround = this.groundY;
    // jump
    const jumpPressed = inp.jump && !this.prevJump;
    this.prevJump = inp.jump;
    let wantMantle = false;
    if (jumpPressed) {
      if (this.grounded && !this.swimming) {
        this.vel.y = MOVE.jump * (this.crouching ? 0.8 : 1);
        this.grounded = false;
        if (this.sliding) { this.sliding = false; this.vel.y *= 1.05; }
        wantMantle = true;
      } else if (this.swimming) {
        this.vel.y = 4.5;
      } else wantMantle = true;
    }
    // gravity / buoyancy
    if (this.swimming) {
      if (this.pos.y < floatY) { this.pos.y = Math.min(floatY, this.pos.y + dt * 4); this.vel.y = Math.max(this.vel.y, 0); }
      this.vel.y -= GRAVITY * 0.3 * dt;
    } else {
      this.vel.y -= GRAVITY * dt;
    }
    if (this.vel.y < -60) this.vel.y = -60;
    const wasGrounded = this.grounded;
    const wall = phys.moveBody(this, dt);
    this.wallHit = wall;
    if (this.swimming) { this.grounded = this.pos.y <= floatY + 0.05 || this.grounded; if (this.pos.y < floatY) this.pos.y = floatY; }
    // fall damage
    if (this.landSpeed > 20 && !this.swimming) {
      this.takeDamage((this.landSpeed - 20) * 7, null, { bypassShield: true, type: 'fall' });
    }
    if (this.landSpeed > 6) g.audio.playAt('land', this.pos, 0.4);
    // mantling / ledge climbing
    if (wall && (wantMantle || (this.sprinting && inp.jump))) this.tryMantle(wall);
    else if (wall && !this.grounded && inp.jump && this.vel.y < 2) this.tryMantle(wall);
    // footsteps -> sound event for AI hearing and audio
    if (this.grounded && hs > 2.5 && !this.crouching) {
      this.stepT -= dt * hs;
      if (this.stepT <= 0) {
        this.stepT = 2.1;
        g.soundEvent(this, this.pos, this.sprinting ? 22 : 12, 'step');
        if (this.lod === 0) g.audio.footstep(this, this.swimming);
      }
    }
    // face movement when not aiming (AI and player set yaw explicitly when aiming)
  }

  tryMantle(wall) {
    const top = wall.top;
    const rise = top - this.pos.y;
    if (rise < 0.4 || rise > 2.6) return false;
    const fx = -wall.nx, fz = -wall.nz;      // into the wall
    const tx = this.pos.x + fx * (this.radius + 0.55), tz = this.pos.z + fz * (this.radius + 0.55);
    if (!this.game.phys.fits(tx, top + 0.02, tz, this.radius * 0.9, CROUCH_H)) return false;
    this.mantle = { t: 0, dur: 0.18 + rise * 0.1, sx: this.pos.x, sy: this.pos.y, sz: this.pos.z, tx, ty: top + 0.02, tz };
    this.game.audio.playAt('mantle', this.pos, 0.4);
    return true;
  }

  // ---------------- weapons & items ----------------
  updateWeapon(dt) {
    const inp = this.input;
    this.fireCd -= dt;
    this.swingT -= dt;
    this.equipT -= dt;
    this.bloom = Math.max(0, this.bloom - dt * 0.12);
    const firePressed = inp.fire && !this.prevFire;
    this.prevFire = inp.fire;
    if (this.mode !== 'ground' || this.swimming || this.mantle) { this.reloadT = 0; this.spin = 0; return; }
    if (this.game.build && this.game.build.isBuilding(this)) return;
    const it = this.held;
    if (!it) {
      // harvesting tool
      if (inp.fire && this.swingT <= 0 && this.equipT <= 0) {
        this.swingT = this.isPlayer ? 0.5 : 0.55;
        this.game.combat.swingPickaxe(this);
      }
      return;
    }
    if (it.kind === 'consumable') {
      const def = it.def;
      if (def.throwable) {
        if (firePressed && this.fireCd <= 0 && this.equipT <= 0) {
          this.fireCd = 0.9;
          this.game.combat.throwGrenade(this, it);
          it.count--;
          if (it.count <= 0) { this.slots[this.sel] = null; this.sel = -1; }
        }
        return;
      }
      if (this.useItem) {
        this.useT -= dt;
        if (this.useT <= 0) this.finishUse();
      } else if (inp.fire && this.equipT <= 0 && this.canUse(it)) {
        this.useItem = it;
        this.useT = def.use;
        this.game.audio.playAt('useStart', this.pos, 0.4);
      }
      return;
    }
    // weapon
    const def = it.def;
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        const need = it.mag - it.ammoIn;
        const take = Math.min(need, this.ammo[def.ammo]);
        // shotguns reload shell by shell — we simulate with a scaled timer, full reload at end
        it.ammoIn += take; this.ammo[def.ammo] -= take;
        this.reloadT = 0;
      }
      if (!(def.cat === 'shotgun' && inp.fire && it.ammoIn > 0)) return;
      this.reloadT = 0;     // shotguns can cancel reload to fire
    }
    if (inp.reload && it.ammoIn < it.mag && this.ammo[def.ammo] > 0 && def.reload > 0) { this.startReload(); return; }
    // minigun spin-up
    if (def.spinup) {
      if (inp.fire) this.spin = Math.min(def.spinup, this.spin + dt); else this.spin = Math.max(0, this.spin - dt * 2);
    }
    // burst continuation
    if (this.burstLeft > 0) {
      this.burstT -= dt;
      if (this.burstT <= 0 && it.ammoIn > 0) {
        this.burstLeft--; this.burstT = 0.075;
        this._shoot(it);
      }
      return;
    }
    if (this.equipT > 0 || this.fireCd > 0) return;
    const wants = def.auto ? inp.fire : firePressed;
    if (!wants) return;
    if (it.ammoIn <= 0) {
      if (this.ammo[def.ammo] > 0) this.startReload();
      else if (firePressed) this.game.audio.playAt('empty', this.pos, 0.4);
      return;
    }
    if (def.spinup && this.spin < def.spinup) return;
    this.fireCd = 1 / def.rof;
    if (def.burst) { this.burstLeft = def.burst - 1; this.burstT = 0.075; }
    this._shoot(it);
  }
  _shoot(it) {
    if (it.def.mag < 999) it.ammoIn--;
    else { if (this.ammo[it.def.ammo] <= 0) { this.spin = 0; return; } this.ammo[it.def.ammo]--; }
    this.game.combat.fireWeapon(this, it);
    this.bloom = Math.min(0.08, this.bloom + it.def.bloom);
  }
  startReload() {
    const it = this.held;
    if (!it || it.kind !== 'weapon' || this.reloadT > 0) return;
    if (it.ammoIn >= it.mag || this.ammo[it.def.ammo] <= 0 || it.def.reload <= 0) return;
    let t = it.reload;
    if (it.def.cat === 'shotgun') t = it.reload * (0.35 + 0.65 * (1 - it.ammoIn / it.mag));
    this.reloadT = t;
    this.burstLeft = 0;
    this.game.audio.playAt('reload', this.pos, 0.35);
  }
  canUse(it) {
    const d = it.def;
    if (d.regen) return this.health < 100 || this.shield < 100;
    if (d.heal && d.shield) return this.health < 100 || this.shield < 100;
    if (d.heal) return this.health < d.healCap;
    if (d.shield) return this.shield < d.shieldCap;
    return false;
  }
  finishUse() {
    const it = this.useItem;
    this.useItem = null; this.useT = 0;
    if (!it || it.count <= 0) return;
    const d = it.def;
    if (d.regen) { this.regenPool += d.regen; this.regenT = 0; }
    if (d.heal) this.heal(d.heal, d.healCap);
    if (d.shield) this.addShield(d.shield, d.shieldCap);
    it.count--;
    this.game.audio.playAt(d.shield && !d.heal ? 'shield' : 'heal', this.pos, 0.5);
    this.game.onItemUsed(this, it);
    if (it.count <= 0) {
      const i = this.slots.indexOf(it);
      if (i >= 0) this.slots[i] = null;
      if (this.sel === i) this.sel = -1;
    }
  }

  // helpers for AI / HUD
  bestHealItem() {
    let best = -1, bestScore = 0;
    this.slots.forEach((s, i) => {
      if (!s || s.kind !== 'consumable' || s.def.throwable || !this.canUse(s)) return;
      const d = s.def;
      let score = 0;
      const missH = 100 - this.health, missS = 100 - this.shield;
      if (d.heal) score += Math.min(d.heal, Math.max(0, d.healCap - this.health)) * 1.2;
      if (d.shield) score += Math.min(d.shield, Math.max(0, d.shieldCap - this.shield));
      if (d.regen) score += Math.min(d.regen, missH + missS) * 0.9;
      score /= Math.max(1, d.use * 0.4);
      if (score > bestScore) { bestScore = score; best = i; }
    });
    return best;
  }
  hasHealing() { return this.bestHealItem() >= 0; }
}

export { RARITY, WEAPONS, CONSUMABLES, makeConsumable };
