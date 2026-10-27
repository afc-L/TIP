// The player: movement, stamina, attacks, dodge roll, healing and equipment visuals.
import * as THREE from 'three';
import { makeHero, weaponModel, holdWeapon, blobShadow } from './models.js';
import { groundHeight } from './collision.js';
import { WEAPONS, ARMOR } from './data.js';

const RADIUS = 0.45;
const WALK = 4.6, SPRINT = 8.6, ROLL_SPEED = 9.5;
const COST = { light: 13, heavy: 26, roll: 18, sprint: 13 };

export class Player {
  constructor(game) {
    this.game = game;
    this.rig = makeHero();
    this.root = this.rig.root;
    game.scene.add(this.root);
    if (!game.useShadows) { this.blob = blobShadow(0.45); game.scene.add(this.blob); }
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.knock = new THREE.Vector3();
    this.radius = RADIUS;
    this.yaw = Math.PI; // facing -Z (north)
    this.stats = { level: 1, xp: 0, points: 0, vig: 0, end: 0, str: 0 };
    this.coins = 0;
    this.inv = { weapons: ['stick'], armor: [], items: { garlic: 1 } };
    this.equip = { weapon: 'stick', head: null, body: null };
    this.maxFlasks = 3;
    this.flasks = 3;
    this.buffs = { dignity: 0, pepper: 0 };
    this.poison = 0;
    this.reset();
    this.refreshEquip();
  }

  get maxHp() { return 100 + this.stats.vig * 14; }
  get maxSta() { return 100 + this.stats.end * 10; }
  get weapon() { return WEAPONS[this.equip.weapon]; }
  get defense() {
    let d = this.weapon.def || 0;
    for (const s of ['head', 'body']) if (this.equip[s]) d += ARMOR[this.equip[s]].def;
    return Math.min(0.6, d);
  }
  armorStat(key) {
    let v = 0;
    for (const s of ['head', 'body']) if (this.equip[s]) v += ARMOR[this.equip[s]][key] || 0;
    return v;
  }
  get dmgBonus() { return this.armorStat('dmgBonus'); }
  get coinBonus() { return this.armorStat('coinBonus'); }
  get poisonResist() { return this.armorStat('poisonResist') > 0; }
  get burnResist() { return this.armorStat('burnResist') > 0; }
  get chillResist() { return this.armorStat('chillResist') > 0; }
  get healMult() { return 1 + this.armorStat('healBonus'); }
  get armorLifesteal() { return this.armorStat('lifesteal'); }
  get xpNeed() { return 60 + (this.stats.level - 1) * 40; }
  get xpBonus() { return this.equip.head ? ARMOR[this.equip.head].xpBonus || 0 : 0; }
  get rolling() { return this.state === 'roll' && this.stateT > 0.04 && this.stateT < 0.42; }

  reset() {
    this.hp = this.maxHp;
    this.sta = this.maxSta;
    this.state = 'move';
    this.stateT = 0;
    this.alive = true;
    this.staDelay = 0;
    this.poison = 0;
    this.chill = 0;
    this.burn = 0;
    this.hurtFlash = 0;
    this.knock.set(0, 0, 0);
    this.root.rotation.set(0, this.yaw, 0);
    this.rig.body.position.set(0, 0, 0);
    this.rig.body.rotation.set(0, 0, 0);
  }

  place(x, z, yaw) {
    this.pos.set(x, groundHeight(x, z), z);
    if (yaw !== undefined) this.yaw = yaw;
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
  }

  refreshEquip() {
    holdWeapon(this.rig, weaponModel(this.equip.weapon));
    for (const k in this.rig.cos) this.rig.cos[k].visible = this.equip.head === k || this.equip.body === k;
    this.hp = Math.min(this.hp, this.maxHp);
  }

  // Attack definition for the current combo step.
  attackData(kind) {
    const w = this.weapon;
    const sp = w.speed;
    if (kind === 'heavy') return { kind, dur: 1.0 / sp, hitStart: 0.48, hitEnd: 0.68, mult: 2.0, cost: COST.heavy, lunge: 3.2, stagger: true };
    return { kind, dur: 0.62 / sp, hitStart: 0.32, hitEnd: 0.6, mult: this.combo === 2 ? 1.35 : 1, cost: COST.light, lunge: 2.2, stagger: !!w.stagger };
  }

  update(dt, input, camYaw) {
    const g = this.game;
    this.stateT += dt;
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
    for (const k in this.buffs) if (this.buffs[k] > 0) this.buffs[k] -= dt;

    if (!this.alive) { this.animate(dt, 0); return; }

    // Movement intent relative to the camera.
    let ix = 0, iz = 0;
    if (input.down('KeyW')) iz -= 1;
    if (input.down('KeyS')) iz += 1;
    if (input.down('KeyA')) ix -= 1;
    if (input.down('KeyD')) ix += 1;
    const len = Math.hypot(ix, iz);
    let mx = 0, mz = 0;
    if (len > 0) {
      ix /= len; iz /= len;
      const s = Math.sin(camYaw), c = Math.cos(camYaw);
      mx = ix * c + iz * s;
      mz = -ix * s + iz * c;
    }
    const moving = len > 0;
    const hazard = g.world.hazardAt(this.pos.x, this.pos.z);
    const inPoison = hazard === 'poison';
    if (inPoison && !this.poisonResist) this.poison = Math.max(this.poison, 1.5);
    if (hazard === 'lava' && !this.burnResist) this.burn = Math.max(this.burn, 2);
    if (this.chill > 0) { this.chill -= dt; if (this.chillResist) this.chill = 0; }
    if (this.poison > 0) {
      this.poison -= dt;
      this.hp -= 5 * dt;
      if (this.hp <= 0) { g.killPlayer(); return; }
    }
    if (this.burn > 0) {
      this.burn -= dt;
      this.hp -= (hazard === 'lava' ? 14 : 7) * dt;
      if (Math.random() < dt * 10) g.fx.burst(this.pos.x, this.pos.y + 0.8, this.pos.z, 0xff6622, 1, { speed: 1, up: 2 });
      if (this.hp <= 0) { g.killPlayer(); return; }
    }
    const regen = this.armorStat('regen');
    if (regen && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + regen * dt);

    let speed = 0;
    let sprinting = false;
    const st = this.state;

    if (st === 'move') {
      // Actions (buffered input).
      if (input.consume('roll') && this.sta > 1) this.startRoll(moving ? Math.atan2(mx, mz) : this.yaw);
      else if (input.peek('light') && this.sta > 1) { input.consume('light'); this.combo = 0; this.startAttack('light', mx, mz, moving); }
      else if (input.peek('heavy') && this.sta > 1) { input.consume('heavy'); this.combo = 0; this.startAttack('heavy', mx, mz, moving); }
      else if (input.consume('heal')) this.startHeal();
      if (this.state === 'move') {
        sprinting = moving && input.down('ShiftLeft') || moving && input.down('ShiftRight');
        if (sprinting && this.sta <= 0.5) sprinting = false;
        speed = moving ? (sprinting ? SPRINT : WALK) * (1 + this.armorStat('speedBonus')) : 0;
        if (inPoison) speed *= 0.7;
        if (this.chill > 0) speed *= 0.6;
        if (sprinting) { this.sta -= COST.sprint * dt; this.staDelay = 0.5; }
        if (moving) {
          const target = g.lockTarget && !sprinting ? Math.atan2(g.lockTarget.pos.x - this.pos.x, g.lockTarget.pos.z - this.pos.z) : Math.atan2(mx, mz);
          this.yaw = turnTo(this.yaw, target, dt * 14);
        } else if (g.lockTarget) {
          this.yaw = turnTo(this.yaw, Math.atan2(g.lockTarget.pos.x - this.pos.x, g.lockTarget.pos.z - this.pos.z), dt * 10);
        }
        this.vel.set(mx * speed, 0, mz * speed);
      }
    } else if (st === 'attack') {
      const a = this.atk;
      const p = this.stateT / a.dur;
      // Lunge forward during the swing.
      const lungeF = p > 0.2 && p < 0.6 ? a.lunge : 0;
      this.vel.set(Math.sin(this.yaw) * lungeF, 0, Math.cos(this.yaw) * lungeF);
      if (p >= a.hitStart && p <= a.hitEnd) g.playerHitCheck(this, a);
      if (!a.swung && p >= a.hitStart - 0.08) { a.swung = true; g.audio.play(a.kind === 'heavy' ? 'heavy' : 'swing'); }
      // Chain: a buffered light attack continues the combo; rolling cancels the recovery.
      if (p > a.hitEnd) {
        if (input.peek('roll') && this.sta > 1) { input.consume('roll'); this.startRoll(moving ? Math.atan2(mx, mz) : this.yaw); }
        else if (p > 0.72 && input.peek('light', 400) && this.sta > 1 && a.kind === 'light' && this.combo < 2) { input.consume('light', 400); this.combo++; this.startAttack('light', mx, mz, moving); }
        else if (p > 0.72 && input.peek('heavy', 400) && this.sta > 1) { input.consume('heavy', 400); this.combo = 0; this.startAttack('heavy', mx, mz, moving); }
      }
      if (this.state === 'attack' && p >= 1) this.toMove();
    } else if (st === 'roll') {
      const t = this.stateT;
      const sp = t < 0.45 ? ROLL_SPEED * (1 - t / 0.6) : 1.5;
      this.vel.set(Math.sin(this.rollYaw) * sp, 0, Math.cos(this.rollYaw) * sp);
      if (t > 0.55) this.toMove();
    } else if (st === 'heal') {
      this.vel.set(mx * 1.6, 0, mz * 1.6);
      if (!this.healed && this.stateT > 0.45) {
        this.healed = true;
        const amt = Math.round(this.maxHp * 0.45 * this.healMult);
        this.hp = Math.min(this.maxHp, this.hp + amt);
        this.poison = 0;
        g.fx.rise(this.pos.x, this.pos.y + 0.3, this.pos.z, 0x77ff88, 18);
        g.fx.number(new THREE.Vector3(this.pos.x, this.pos.y + 2.2, this.pos.z), '+' + amt, 'heal');
        g.onPlayerHeal();
      }
      if (this.stateT > 0.95) this.toMove();
    } else if (st === 'hurt') {
      this.vel.set(0, 0, 0);
      if (this.stateT > 0.32) this.toMove();
    } else if (st === 'busy') {
      this.vel.set(0, 0, 0);
    }

    // Knockback decays.
    this.vel.add(this.knock);
    this.knock.multiplyScalar(Math.max(0, 1 - dt * 8));

    // Stamina regen.
    if (this.staDelay > 0) this.staDelay -= dt;
    else if (this.state !== 'attack' && this.state !== 'roll' && !sprinting) {
      let regen = 42 * (1 + this.armorStat('stamRegen'));
      if (this.buffs.dignity > 0) regen *= 2;
      if (this.state === 'heal') regen *= 0.5;
      this.sta = Math.min(this.maxSta, this.sta + regen * dt);
    }
    if (this.sta < 0) this.sta = 0;

    // Integrate and collide.
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    g.world.col.resolve(this.pos, RADIUS);
    for (const e of g.activeEnemies) {
      if (e.dead) continue;
      const dx = this.pos.x - e.pos.x, dz = this.pos.z - e.pos.z;
      const rr = RADIUS + e.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        this.pos.x = e.pos.x + (dx / d) * rr;
        this.pos.z = e.pos.z + (dz / d) * rr;
      }
    }
    this.pos.y = groundHeight(this.pos.x, this.pos.z);
    this.animate(dt, speed, sprinting);
  }

  toMove() { this.state = 'move'; this.stateT = 0; }

  startAttack(kind, mx, mz, moving) {
    const g = this.game;
    this.atk = this.attackData(kind);
    this.atk.hits = new Set();
    this.atk.swung = false;
    this.sta -= this.atk.cost;
    this.staDelay = 0.6;
    this.state = 'attack';
    this.stateT = 0;
    // Face the lock target, else soft-aim at the nearest enemy in front, else the input direction.
    let yaw = moving ? Math.atan2(mx, mz) : this.yaw;
    const t = g.lockTarget || g.softTarget(this.pos, yaw, 4.5);
    if (t) yaw = Math.atan2(t.pos.x - this.pos.x, t.pos.z - this.pos.z);
    this.yaw = yaw;
  }

  startRoll(yaw) {
    this.sta -= COST.roll;
    this.staDelay = 0.6;
    this.state = 'roll';
    this.stateT = 0;
    this.rollYaw = yaw;
    this.yaw = yaw;
    this.dodgedThisRoll = false;
    this.game.audio.play('dodge');
    this.game.fx.burst(this.pos.x, this.pos.y + 0.1, this.pos.z, 0xc8b88a, 6, { glow: false, speed: 2, up: 1 });
  }

  startHeal() {
    const g = this.game;
    if (this.flasks <= 0) { g.ui.toast('Out of Questionable Juice. Rest at a shrine to refill.'); return; }
    this.flasks--;
    this.state = 'heal';
    this.stateT = 0;
    this.healed = false;
    g.audio.play('drink');
  }

  hurt(knockX, knockZ, power) {
    this.state = 'hurt';
    this.stateT = 0;
    this.hurtFlash = 0.3;
    this.knock.set(knockX * power, 0, knockZ * power);
  }

  // ---------- Procedural animation ----------
  animate(dt, speed, sprinting) {
    const r = this.rig;
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
    if (this.blob) { this.blob.position.set(this.pos.x, this.pos.y + 0.04, this.pos.z); }
    this.animT = (this.animT || 0) + dt * (speed > 0 ? speed * 1.9 : 2);
    const t = this.animT;
    const st = this.state;
    // Defaults.
    let legSwing = 0, armSwing = 0, bob = 0, lean = 0, twist = 0;
    let armRX = -0.4, armRZ = 0, armLX = 0, armLZ = 0.1;
    r.body.rotation.set(0, 0, 0);
    r.body.position.set(0, 0, 0);
    if (!this.alive) {
      const f = Math.min(1, this.stateT * 3);
      r.body.rotation.x = -f * 1.45;
      r.body.position.y = f * 0.15;
      setLimbs(r, 0, 0, -0.4, -0.3, 0.6, 0.5);
      return;
    }
    if (st === 'move' || st === 'busy') {
      if (speed > 0) {
        legSwing = Math.sin(t) * (sprinting ? 0.9 : 0.6);
        armSwing = -legSwing * 0.8;
        bob = Math.abs(Math.cos(t)) * 0.06;
        lean = sprinting ? 0.25 : 0.08;
      } else {
        bob = Math.sin(t * 1.5) * 0.015;
      }
      armRX = -0.4 + armSwing * 0.5;
      armLX = -armSwing;
    } else if (st === 'attack') {
      const a = this.atk;
      const p = Math.min(1, this.stateT / a.dur);
      if (a.kind === 'heavy') {
        // Overhead chop.
        const wind = smoothstep(0, a.hitStart, p), strike = smoothstep(a.hitStart - 0.05, a.hitEnd, p);
        armRX = -0.4 - wind * 2.6 + strike * 2.9;
        lean = -wind * 0.25 + strike * 0.45;
        armLX = armRX * 0.6;
      } else {
        // Horizontal slash, alternating direction per combo step.
        const dir = this.combo === 1 ? -1 : 1;
        const wind = smoothstep(0, a.hitStart, p), strike = smoothstep(a.hitStart - 0.05, a.hitEnd, p);
        twist = dir * (-1.0 * wind + 2.1 * strike);
        armRX = -1.45;
        armRZ = -dir * (0.9 - strike * 0.6);
        lean = 0.12 * strike;
        armLX = -0.5;
      }
      legSwing = 0.3;
    } else if (st === 'roll') {
      const p = Math.min(1, this.stateT / 0.5);
      // Somersault around the hips (pivot at y=0.7) instead of the feet.
      const th = smoothstep(0, 1, p) * Math.PI * 2;
      r.body.rotation.x = th;
      r.body.position.set(0, 0.7 - 0.7 * Math.cos(th) - 0.25 * Math.sin(p * Math.PI), -0.7 * Math.sin(th));
      legSwing = 0.8;
      armRX = -1.2; armLX = -1.2;
    } else if (st === 'heal') {
      armLX = -2.2; armLZ = -0.6;
      r.head.rotation.x = -0.4;
    } else if (st === 'hurt') {
      lean = -0.35 * (1 - this.stateT / 0.32);
      armRX = 0.3; armLX = 0.3;
    }
    if (st !== 'heal') r.head.rotation.x = 0;
    r.body.position.y += bob;
    r.torso.rotation.set(lean, twist, 0);
    r.legL.rotation.x = legSwing;
    r.legR.rotation.x = st === 'attack' ? -0.3 : -legSwing;
    r.armR.rotation.set(armRX, 0, armRZ);
    r.armL.rotation.set(armLX, 0, armLZ);
  }
}

function setLimbs(r, ll, lr, ar, al, az, azl) {
  r.legL.rotation.x = ll; r.legR.rotation.x = lr;
  r.armR.rotation.set(ar, 0, -az); r.armL.rotation.set(al, 0, azl);
}

export function turnTo(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const step = Math.max(-k, Math.min(k, d * Math.min(1, k)));
  return a + (Math.abs(d) < 0.001 ? d : step);
}

export function smoothstep(e0, e1, x) {
  let t = (x - e0) / (e1 - e0);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return t * t * (3 - 2 * t);
}
