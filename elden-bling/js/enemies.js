// Enemies, mini-boss, final boss and NPCs. Simple state-machine AI.
import * as THREE from 'three';
import { makeEnemyModel, makeFrog, makeDummy, makeChicken, makeCactus, makeCrab, makeSnowman, optimize, humanoid, blobShadow, mesh, box, cyl, sph, mat, weaponModel, holdWeapon } from './models.js';
import { groundHeight } from './collision.js';
import { ENEMIES, UNEMPLOYED, TOUCHGRASS, REGION_BOSSES } from './data.js';
import { turnTo, smoothstep } from './player.js';

let glintMat = null;
function glintSprite() {
  if (!glintMat) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,220,120,0.9)');
    grd.addColorStop(1, 'rgba(255,120,40,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#fff';
    g.fillRect(30, 0, 4, 64); g.fillRect(0, 30, 64, 4);
    glintMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true });
  }
  const s = new THREE.Sprite(glintMat);
  s.visible = false;
  s.renderOrder = 5;
  return s;
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const MELEE_KIND = { knight: 'sweep', pirate: 'sweep', frog: 'hop', crab: 'hop', cactus: 'sweep' };

export class Enemy {
  constructor(game, type, x, z) {
    this.game = game;
    this.type = type;
    this.def = { ...ENEMIES[type] };
    const simple = { frog: makeFrog, cactus: makeCactus, crab: makeCrab, snowman: makeSnowman }[type];
    this.rig = simple ? simple() : makeEnemyModel(type);
    this.root = this.rig.root;
    game.scene.add(this.root);
    if (!game.useShadows) { this.blob = blobShadow(this.def.radius); game.scene.add(this.blob); }
    this.glint = glintSprite();
    this.glint.scale.setScalar(0.9);
    if (this.rig.weapon) { this.glint.position.set(0, 0.9, 0); this.rig.weapon.add(this.glint); }
    else { this.glint.position.set(0, 0.6, 0.9); this.rig.body.add(this.glint); }
    this.home = new THREE.Vector3(x, groundHeight(x, z), z);
    this.pos = new THREE.Vector3();
    this.radius = this.def.radius;
    this.poise = this.def.poise ? 1 : 0;
    this.height = this.def.height;
    this.isBoss = false;
    this.reset();
  }

  get name() { return this.def.name; }

  reset() {
    this.pos.copy(this.home);
    this.yaw = Math.random() * Math.PI * 2;
    this.maxHp = this.def.hp;
    this.hp = this.maxHp;
    this.dead = false;
    this.hidden = false;
    this.state = 'idle';
    this.t = 0;
    this.cd = 0.5;
    this.atk = null;
    this.wander = null;
    this.wanderT = Math.random() * 3;
    this.animT = Math.random() * 10;
    this.knock = new THREE.Vector3();
    this.nextTalk = 4 + Math.random() * 6;
    this.root.visible = true;
    this.root.position.copy(this.pos);
    this.rig.body.rotation.set(0, 0, 0);
    this.rig.body.position.set(0, 0, 0);
    if (this.blob) this.blob.visible = true;
    this.glint.visible = false;
  }

  setState(s) { this.state = s; this.t = 0; }

  say(text, dur) { this.game.fx.say(this, text, dur, this.height + 0.5); }

  distTo(p) { return Math.hypot(p.x - this.pos.x, p.z - this.pos.z); }

  faceYaw(p) { return Math.atan2(p.x - this.pos.x, p.z - this.pos.z); }

  canSee(p, dist) {
    if (dist > this.def.detect) return false;
    if (dist < this.def.detect * 0.45) return true;
    let d = this.faceYaw(p) - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return Math.abs(d) < 1.2;
  }

  alert() {
    this.setState('alert');
    this.game.audio.play('alert');
    if (this.type === 'knight' || Math.random() < 0.5) this.say(pick(this.def.lines));
  }

  update(dt) {
    const g = this.game, p = g.player;
    this.t += dt;
    this.cd -= dt;
    if (this.slowT > 0) this.slowT -= dt;
    if (this.dead) { this.updateDead(dt); return; }
    const dist = this.distTo(p.pos);
    const distHome = this.distTo(this.home);
    let move = 0, faceTarget = null, turnRate = 8;

    switch (this.state) {
      case 'idle': {
        this.wanderT -= dt;
        if (this.wanderT <= 0) {
          this.wanderT = 3 + Math.random() * 4;
          const a = Math.random() * Math.PI * 2, r = Math.random() * 3;
          this.wander = Math.random() < 0.6 ? { x: this.home.x + Math.cos(a) * r, z: this.home.z + Math.sin(a) * r } : null;
        }
        if (this.wander) {
          if (this.distTo(this.wander) < 0.4) this.wander = null;
          else { faceTarget = this.wander; move = 1.1; turnRate = 4; }
        }
        if (p.alive && this.canSee(p.pos, dist)) this.alert();
        break;
      }
      case 'alert':
        faceTarget = p.pos;
        if (this.t > 0.45) this.setState('chase');
        break;
      case 'chase': {
        if (!p.alive) { this.setState('return'); break; }
        if (dist > this.def.lose || distHome > this.def.leash) { this.setState('return'); break; }
        faceTarget = p.pos;
        if (dist > this.def.range * 0.8) move = this.def.speed * (this.slowT > 0 ? 0.5 : 1);
        this.nextTalk -= dt;
        if (this.nextTalk <= 0) { this.nextTalk = 7 + Math.random() * 7; if (Math.random() < (this.type === 'knight' || this.type === 'pirate' ? 0.8 : 0.3)) this.say(pick(this.def.lines)); }
        if (this.def.trips && dist > 2.5 && Math.random() < dt * 0.09) {
          this.setState('trip');
          this.say(this.type === 'mummy' ? 'Oh no, I\'m unravelling—' : 'Whoops—');
          g.audio.play(this.type === 'skeleton' ? 'clatter' : 'swing');
          break;
        }
        if (this.cd <= 0) {
          if (this.def.ranged && dist > this.def.ranged.min && dist < this.def.ranged.max && Math.random() < 0.6) this.startAttack('spit');
          else if (dist < this.def.range + 0.4) this.startAttack(MELEE_KIND[this.type] || 'overhead');
        }
        break;
      }
      case 'attack':
        this.updateAttack(dt, dist);
        return this.finish(dt, 0);
      case 'hurt':
        if (this.t > 0.4) this.setState('chase');
        break;
      case 'trip':
        if (this.t > 1.8) { this.setState('chase'); this.cd = 0.3; }
        break;
      case 'return': {
        faceTarget = this.home;
        move = this.def.speed * 0.8;
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.3 * dt);
        if (distHome < 0.8) { this.setState('idle'); this.hp = this.maxHp; }
        else if (p.alive && dist < this.def.detect * 0.6 && distHome < this.def.leash * 0.6) this.setState('chase');
        break;
      }
    }
    if (faceTarget) this.yaw = turnTo(this.yaw, this.faceYaw(faceTarget), dt * turnRate);
    if (move > 0) {
      this.pos.x += Math.sin(this.yaw) * move * dt;
      this.pos.z += Math.cos(this.yaw) * move * dt;
    }
    this.finish(dt, move);
  }

  finish(dt, move) {
    const g = this.game;
    this.pos.addScaledVector(this.knock, dt);
    this.knock.multiplyScalar(Math.max(0, 1 - dt * 7));
    g.world.col.resolve(this.pos, this.radius);
    this.pos.y = groundHeight(this.pos.x, this.pos.z);
    this.animate(dt, move);
  }

  // ---------- Attacks ----------
  attackDef(kind) {
    const d = this.def;
    if (kind === 'spit') return { kind, windup: d.ranged.windup, active: 0.1, recover: 0.7 };
    if (kind === 'hop') return { kind, windup: d.windup, active: 0.25, recover: d.recover, dmg: d.dmg, range: d.range + 0.6, arc: 1.4, lunge: 7 };
    return { kind, windup: d.windup, active: d.active, recover: d.recover, dmg: d.dmg, range: d.range + 0.3, arc: kind === 'sweep' ? 1.5 : 1.0, lunge: 2.5 };
  }

  startAttack(kind) {
    this.atk = this.attackDef(kind);
    this.atk.t = 0;
    this.atk.hit = false;
    this.atk.fired = false;
    this.setState('attack');
  }

  atkPhase() {
    const a = this.atk;
    if (a.t < a.windup) return ['windup', a.t / a.windup];
    if (a.t < a.windup + a.active) return ['active', (a.t - a.windup) / a.active];
    return ['recover', Math.min(1, (a.t - a.windup - a.active) / a.recover)];
  }

  updateAttack(dt, dist) {
    const g = this.game, p = g.player, a = this.atk;
    a.t += dt;
    const [ph, f] = this.atkPhase();
    if (ph === 'windup') {
      // Keep tracking the player during windup, but slower near the end so dodging sideways works.
      this.yaw = turnTo(this.yaw, this.faceYaw(p.pos), dt * (f < 0.7 ? 5 : 1.5));
      this.glint.visible = f > 0.45;
      if (f > 0.45 && !a.glinted) { a.glinted = true; if (this.isBoss) g.audio.play('windup'); }
    } else this.glint.visible = false;
    if (ph === 'active') {
      if (a.lunge) { this.pos.x += Math.sin(this.yaw) * a.lunge * dt; this.pos.z += Math.cos(this.yaw) * a.lunge * dt; }
      if (a.kind === 'spit' && !a.fired) { a.fired = true; this.spit(); }
      else if (a.dmg && !a.hit) this.meleeCheck(a);
    }
    if (a.t >= a.windup + a.active + a.recover) {
      this.cd = this.def.cooldown * (0.7 + Math.random() * 0.6);
      this.setState('chase');
      this.atk = null;
    }
    void dist;
  }

  meleeCheck(a) {
    const p = this.game.player;
    const dist = this.distTo(p.pos);
    if (dist > a.range + p.radius) return;
    let d = this.faceYaw(p.pos) - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    if (Math.abs(d) > a.arc) return;
    a.hit = true;
    this.game.damagePlayer(a.dmg, this.pos.x, this.pos.z, { knock: a.knock ?? 5, source: this });
    if (this.type === 'goblin') this.game.audio.play('bonk');
  }

  spit() {
    const g = this.game, p = g.player, r = this.def.ranged;
    const from = new THREE.Vector3(this.pos.x + Math.sin(this.yaw) * 0.9, this.pos.y + (r.proj === 'needle' ? 1.3 : 0.9), this.pos.z + Math.cos(this.yaw) * 0.9);
    if (r.fan) {
      // Flat spread of needles.
      const base = this.faceYaw(p.pos);
      for (let i = 0; i < r.fan; i++) {
        const yaw = base + (i - (r.fan - 1) / 2) * 0.25;
        g.fx.spawnProjectile(r.proj, from, new THREE.Vector3(Math.sin(yaw) * 14, 0.6, Math.cos(yaw) * 14), { dmg: r.dmg, grav: 1.5, radius: 0.3, life: 1.5 });
      }
    } else {
      const T = 0.85;
      const tx = p.pos.x + p.vel.x * 0.35, tz = p.pos.z + p.vel.z * 0.35, ty = p.pos.y + 0.8;
      const vel = new THREE.Vector3((tx - from.x) / T, (ty - from.y + 0.5 * 9.8 * T * T) / T, (tz - from.z) / T);
      g.fx.spawnProjectile(r.proj || 'slime', from, vel, { dmg: r.dmg ?? 12, poison: r.poison || 0, chill: r.chill || 0, radius: 0.35 });
    }
    g.audio.play('spit');
  }

  // ---------- Damage ----------
  takeDamage(amount, fromX, fromZ, heavy, stagger) {
    if (this.dead) return;
    const g = this.game;
    this.hp -= amount;
    const dx = this.pos.x - fromX, dz = this.pos.z - fromZ, d = Math.hypot(dx, dz) || 1;
    const top = new THREE.Vector3(this.pos.x, this.pos.y + this.height, this.pos.z);
    g.fx.number(top, Math.round(amount), heavy ? 'big' : '');
    g.fx.burst(this.pos.x, this.pos.y + this.height * 0.6, this.pos.z, 0xffdd88, heavy ? 12 : 7, { speed: 4 });
    if (this.hp <= 0) { this.die(); return; }
    this.onHurt(dx / d, dz / d, heavy, stagger);
  }

  onHurt(nx, nz, heavy, stagger) {
    const breaks = heavy || stagger || !this.poise || this.state !== 'attack';
    if (this.state === 'idle' || this.state === 'return' || this.state === 'alert') { this.setState('chase'); this.cd = 0.4; }
    if (breaks && this.state !== 'trip') {
      this.knock.set(nx * (heavy ? 6 : 3.5), 0, nz * (heavy ? 6 : 3.5));
      this.glint.visible = false;
      this.atk = null;
      this.setState('hurt');
    }
  }

  die() {
    this.dead = true;
    this.hp = 0;
    this.deadT = 0;
    this.state = 'dead';
    this.glint.visible = false;
    this.game.audio.play(this.type === 'skeleton' ? 'clatter' : 'enemyDie');
    this.game.onEnemyKilled(this);
  }

  updateDead(dt) {
    this.deadT += dt;
    const f = Math.min(1, this.deadT * 3);
    if (this.rig.isFrog) { this.rig.body.rotation.z = f * Math.PI * 0.9; this.rig.body.position.y = f * 0.6; }
    else this.rig.body.rotation.x = -f * 1.5;
    if (this.deadT > 1.3) this.root.position.y = this.pos.y - (this.deadT - 1.3) * 1.2;
    if (this.deadT > 2.4 && !this.hidden) {
      this.hidden = true;
      this.root.visible = false;
      if (this.blob) this.blob.visible = false;
      this.game.fx.rise(this.pos.x, this.pos.y, this.pos.z, 0xffee88, 6);
    }
  }

  // ---------- Animation ----------
  animate(dt, move) {
    const r = this.rig;
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
    if (this.blob) this.blob.position.set(this.pos.x, this.pos.y + 0.04, this.pos.z);
    this.animT += dt * (move > 0 ? move * 2.2 : 2);
    const t = this.animT;
    if (r.isFrog) return this.animateFrog(dt, move, t);
    if (r.isSimple) return this.animateSimple(dt, move, t);

    let legSwing = 0, lean = 0, twist = 0, armRX = -0.5, armRZ = 0, armLX = 0, bodyY = 0, bodyRX = 0, bodyRZ = 0;
    if (move > 0) { legSwing = Math.sin(t) * 0.6; armLX = -legSwing * 0.7; bodyY = Math.abs(Math.cos(t)) * 0.05; lean = 0.1; }
    if (this.state === 'attack' && this.atk) [legSwing, lean, twist, armRX, armRZ, armLX, bodyY] = this.attackPose(legSwing, lean);
    else if (this.state === 'hurt') { lean = -0.4 * (1 - this.t / 0.4); armRX = 0.2; }
    else if (this.state === 'alert') { bodyY = Math.sin(this.t * Math.PI / 0.45) * 0.15; }
    else if (this.state === 'trip') {
      const f = Math.min(1, this.t * 4), up = smoothstep(1.3, 1.8, this.t);
      bodyRX = (f - up) * 1.45; bodyY = (f - up) * 0.15;
      legSwing = -0.6 * (f - up); armRX = -2.8 * (f - up);
    }
    r.body.position.y = bodyY;
    r.body.rotation.set(bodyRX, 0, bodyRZ);
    r.torso.rotation.set(lean, twist, 0);
    r.legL.rotation.x = legSwing;
    r.legR.rotation.x = -legSwing;
    r.armR.rotation.set(armRX, 0, armRZ);
    r.armL.rotation.set(armLX, 0, 0.1);
  }

  attackPose(legSwing, lean) {
    const [ph, f] = this.atkPhase();
    const kind = this.atk.kind;
    let twist = 0, armRX = -0.5, armRZ = 0, armLX = 0, bodyY = 0;
    const w = ph === 'windup' ? smoothstep(0, 1, f) : 1;
    const s = ph === 'windup' ? 0 : ph === 'active' ? smoothstep(0, 1, f) : 1;
    const back = ph === 'recover' ? smoothstep(0.3, 1, f) : 0;
    if (kind === 'sweep') {
      twist = (-1.1 * w + 2.3 * s) * (1 - back);
      armRX = -1.4 * (1 - back) - 0.5 * back;
      armRZ = (-1.0 + s * 0.6) * (1 - back);
      lean = 0.15 * s;
    } else if (kind === 'throw') {
      armRX = (-0.5 - 2.3 * w + 1.6 * s) * (1 - back) - 0.5 * back;
      lean = -0.15 * w + 0.3 * s;
    } else if (kind === 'stomp') {
      bodyY = this.jumpY || 0;
      armRX = -2.6 * w * (1 - s) - 0.4;
      armLX = armRX;
      lean = 0.4 * s * (1 - back);
    } else if (kind === 'charge') {
      lean = 0.45; legSwing = Math.sin(this.animT * 3) * 0.9; armRX = -1.2;
    } else {
      armRX = (-0.5 - 2.4 * w + 2.7 * s) * (1 - back) - 0.5 * back;
      lean = -0.2 * w + 0.5 * s * (1 - back);
      armLX = armRX * 0.4;
    }
    return [legSwing, lean, twist, armRX, armRZ, armLX, bodyY];
  }

  // Cacti, crabs and snowmen: bobbing bodies with two "arms".
  animateSimple(dt, move, t) {
    const r = this.rig;
    let y = 0, pitch = 0, roll = 0, armA = 0, sq = 1;
    const k = r.kind;
    if (move > 0) {
      if (k === 'crab') { roll = Math.sin(t * 2) * 0.12; y = Math.abs(Math.sin(t * 2)) * 0.05; }
      else if (k === 'snowman') { pitch = Math.sin(t) * 0.08; y = Math.abs(Math.sin(t)) * 0.1; }
      else { y = Math.abs(Math.sin(t * 0.8)) * 0.15; roll = Math.sin(t * 0.8) * 0.1; }
    } else sq = 1 + Math.sin(t * 2) * 0.02;
    if (this.state === 'attack' && this.atk) {
      const [ph, f] = this.atkPhase();
      if (ph === 'windup') { armA = f; pitch = -0.15 * f; sq = 1 + 0.1 * f; }
      else if (ph === 'active') { armA = 1 - f * 2; pitch = 0.3; }
      else armA = -1 + f;
    } else if (this.state === 'hurt') pitch = -0.35;
    else if (this.state === 'trip') { roll = Math.min(1, this.t * 4) * 1.3 * (1 - smoothstep(1.3, 1.8, this.t)); }
    r.body.position.y = y;
    r.body.rotation.set(pitch, 0, roll);
    r.body.scale.set(2 - sq, sq, 2 - sq);
    if (r.arms) r.arms.forEach((a, i) => {
      const s = i ? 1 : -1;
      if (k === 'crab') { a.rotation.x = -armA * 0.9; a.rotation.y = s * -armA * 0.4; }
      else a.rotation.z = s * armA * 0.9;
    });
  }

  animateFrog(dt, move, t) {
    const r = this.rig;
    let y = 0, sx = 1, throat = 1, pitch = 0;
    if (move > 0) { y = Math.abs(Math.sin(t * 0.8)) * 0.35; pitch = -Math.cos(t * 0.8) * 0.15; }
    else throat = 1 + Math.sin(t * 2) * 0.08;
    if (this.state === 'attack' && this.atk) {
      const [ph, f] = this.atkPhase();
      if (this.atk.kind === 'spit') {
        throat = ph === 'windup' ? 1 + f * 0.9 : ph === 'active' ? 0.6 : 1;
        pitch = ph === 'windup' ? -0.2 * f : 0.15;
      } else {
        sx = ph === 'windup' ? 1 + f * 0.15 : 1;
        y = ph === 'active' ? Math.sin(f * Math.PI) * 0.8 : 0;
        pitch = ph === 'windup' ? 0.2 * f : -0.2;
      }
    } else if (this.state === 'hurt') pitch = -0.4;
    r.body.position.y = y;
    r.body.rotation.set(pitch, 0, 0);
    r.body.scale.set(sx, 2 - sx, sx);
    r.throat.scale.set(throat, 0.6 * throat, 0.6 * throat);
  }
}

// ------------------------------------------------------------------
// Training dummy: takes hits, never dies, shows numbers.
export class Dummy extends Enemy {
  constructor(game, x, z) {
    super(game, 'goblin', x, z);
    game.scene.remove(this.root);
    this.rig = makeDummy();
    this.root = this.rig.root;
    game.scene.add(this.root);
    this.def = { ...this.def, name: 'Dummy Dave', hp: 9999, radius: 0.45, height: 2.1, rare: null };
    this.radius = 0.45;
    this.height = 2.1;
    this.isDummy = true;
    this.reset();
    this.yaw = 0;
  }
  update(dt) {
    this.wob = (this.wob || 0) * Math.max(0, 1 - dt * 4);
    this.wobT = (this.wobT || 0) + dt * 14;
    this.rig.body.rotation.x = Math.sin(this.wobT) * this.wob;
    if (this.blob) this.blob.position.set(this.pos.x, this.pos.y + 0.04, this.pos.z);
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
  }
  takeDamage(amount, fromX, fromZ, heavy) {
    this.hp = this.maxHp;
    this.wob = heavy ? 0.5 : 0.3;
    this.game.fx.number(new THREE.Vector3(this.pos.x, this.pos.y + 2.3, this.pos.z), Math.round(amount), heavy ? 'big' : '');
    this.game.fx.burst(this.pos.x, this.pos.y + 1.4, this.pos.z, 0xe8d8a0, 6, { glow: false });
    this.game.onDummyHit();
    if (Math.random() < 0.25) this.say(pick(['Ow. Emotionally.', 'Is that all?', 'I felt that. Barely.', 'Again! Harder!', 'My straw!']), 1.8);
  }
}

// ------------------------------------------------------------------
// Mini-boss: The Unemployed Knight.
export class UnemployedKnight extends Enemy {
  constructor(game, x, z) {
    super(game, 'knight', x, z);
    game.scene.remove(this.root);
    if (this.blob) { game.scene.remove(this.blob); this.blob = blobShadow(0.9); game.scene.add(this.blob); }
    this.rig = makeEnemyModel('unemployed');
    this.root = this.rig.root;
    game.scene.add(this.root);
    this.glint = glintSprite();
    this.glint.position.set(0, 1.6, 0);
    this.rig.weapon.add(this.glint);
    this.def = { ...this.def, ...UNEMPLOYED, detect: 13, lose: 30, leash: 19, range: 2.8, cooldown: 0.9, rare: null };
    this.radius = UNEMPLOYED.radius;
    this.height = UNEMPLOYED.height;
    this.isBoss = true;
    this.poise = 1;
    this.reset();
  }

  reset() {
    super.reset();
    this.yaw = 0;
    this.poiseHp = 70;
    this.engaged = false;
    this.talkT = 6;
  }

  update(dt) {
    const g = this.game, p = g.player;
    if (this.dead) { this.updateDead(dt); return; }
    const dist = this.distTo(p.pos);
    const playerFromHome = this.distTo.call({ pos: this.home }, p.pos);
    if (!this.engaged) {
      this.t += dt;
      // Idle: stare sadly at the gate, sigh occasionally.
      if (p.alive && playerFromHome < 13) {
        this.engaged = true;
        g.startBossFight(this);
        this.say(this.def.intro, 4.5);
        g.ui.subtitle(this.def.name, this.def.intro, 4.5);
        this.setState('alert');
        this.cd = 1.4;
      }
      this.animate(dt, 0);
      return;
    }
    if (!p.alive || playerFromHome > 24) { this.disengage(); return; }
    this.talkT -= dt;
    if (this.talkT <= 0 && this.state !== 'attack') {
      this.talkT = 7 + Math.random() * 4;
      const line = pick(this.def.lines);
      this.say(line, 3.5);
      g.ui.subtitle(this.def.name, line, 3.5);
    }
    this.t += dt;
    this.cd -= dt;
    let move = 0;
    if (this.state === 'attack') { this.updateBossAttack(dt); return this.finish(dt, 0); }
    if (this.state === 'hurt') { if (this.t > 1.1) this.setState('chase'); }
    else if (this.state === 'alert') { this.yaw = turnTo(this.yaw, this.faceYaw(p.pos), dt * 3); if (this.t > 1.2) this.setState('chase'); }
    else {
      this.state = 'chase';
      this.yaw = turnTo(this.yaw, this.faceYaw(p.pos), dt * 4);
      if (dist > 2.4) move = this.def.speed;
      if (this.cd <= 0) {
        const r = Math.random();
        if (dist < 3.6) this.startAttack(r < 0.65 ? 'combo' : 'sweep1');
        else if (dist < 11 && r < 0.45) this.startAttack('leap');
        else if (dist > 6 && r < 0.75) this.startAttack('resume');
      }
    }
    if (move) { this.pos.x += Math.sin(this.yaw) * move * dt; this.pos.z += Math.cos(this.yaw) * move * dt; }
    this.finish(dt, move);
  }

  disengage() {
    this.engaged = false;
    this.game.endBossFight(this, false);
    this.reset();
  }

  attackDef(kind) {
    const dmg = this.def.dmg;
    if (kind === 'combo') return { kind, steps: [{ k: 'sweep', w: 0.6, a: 0.16, r: 0.12 }, { k: 'sweepR', w: 0.38, a: 0.16, r: 0.12 }, { k: 'overhead', w: 0.5, a: 0.18, r: 1.1 }], dmg, range: 3.4, arc: 1.4, lunge: 3 };
    if (kind === 'sweep1') return { kind, steps: [{ k: 'sweep', w: 0.8, a: 0.2, r: 0.9 }], dmg: dmg * 1.2, range: 3.6, arc: 1.7, lunge: 2 };
    if (kind === 'leap') return { kind, steps: [{ k: 'leap', w: 0.6, a: 0.8, r: 1.2 }], dmg: 26 };
    return { kind, steps: [{ k: 'throw', w: 0.55, a: 0.12, r: 0.7 }], dmg: 10 };
  }

  startAttack(kind) {
    this.atk = this.attackDef(kind);
    this.atk.step = 0;
    this.beginStep();
    this.setState('attack');
  }

  beginStep() {
    const a = this.atk, s = a.steps[a.step];
    a.t = 0; a.windup = s.w; a.active = s.a; a.recover = s.r; a.hit = false; a.fired = false; a.glinted = false;
    a.kindStep = s.k;
    this.atk.kind = s.k === 'sweepR' ? 'sweep' : s.k === 'leap' ? 'stomp' : s.k;
    a.reverse = s.k === 'sweepR';
    if (s.k === 'leap') {
      const p = this.game.player;
      a.from = this.pos.clone();
      a.to = new THREE.Vector3(p.pos.x, 0, p.pos.z);
      a.tele = this.game.fx.telegraph(a.to.x, a.to.z, 3.2, s.w + s.a);
    }
  }

  updateBossAttack(dt) {
    const g = this.game, p = g.player, a = this.atk;
    a.t += dt;
    const [ph, f] = this.atkPhase();
    if (ph === 'windup') {
      if (a.kindStep !== 'leap') this.yaw = turnTo(this.yaw, this.faceYaw(p.pos), dt * (f < 0.6 ? 6 : 1.2));
      this.glint.visible = f > 0.4;
      if (f > 0.4 && !a.glinted) { a.glinted = true; g.audio.play('windup'); }
    } else this.glint.visible = false;
    this.jumpY = 0;
    if (ph === 'active') {
      if (a.kindStep === 'leap') {
        const k = smoothstep(0, 1, f);
        this.pos.x = a.from.x + (a.to.x - a.from.x) * k;
        this.pos.z = a.from.z + (a.to.z - a.from.z) * k;
        this.jumpY = Math.sin(f * Math.PI) * 3.5;
        this.yaw = this.faceYaw(a.to) || this.yaw;
      } else if (a.kindStep === 'throw') {
        if (!a.fired) {
          a.fired = true;
          for (const off of [-0.28, 0, 0.28]) {
            const yaw = this.faceYaw(p.pos) + off;
            const from = new THREE.Vector3(this.pos.x, this.pos.y + 2.6, this.pos.z);
            g.fx.spawnProjectile('resume', from, new THREE.Vector3(Math.sin(yaw) * 13, 1.5, Math.cos(yaw) * 13), { dmg: a.dmg, grav: 2.5, radius: 0.5 });
          }
          if (Math.random() < 0.6) this.say('Please accept my résumé!', 2);
        }
      } else {
        this.pos.x += Math.sin(this.yaw) * a.lunge * dt;
        this.pos.z += Math.cos(this.yaw) * a.lunge * dt;
        if (!a.hit) this.meleeCheck(a);
      }
    }
    if (ph === 'recover' && a.kindStep === 'leap' && !a.fired) {
      a.fired = true;
      g.audio.play('stomp');
      g.shake(0.4);
      g.fx.burst(this.pos.x, this.pos.y + 0.2, this.pos.z, 0xb8a888, 18, { glow: false, speed: 7 });
      if (this.distTo(p.pos) < 3.4) g.damagePlayer(a.dmg, this.pos.x, this.pos.z, { knock: 8, source: this });
    }
    if (a.t >= a.windup + a.active + a.recover) {
      a.step++;
      if (a.step < a.steps.length) this.beginStep();
      else { this.cd = 0.6 + Math.random() * 0.8; this.setState('chase'); this.atk = null; }
    }
  }

  attackPose(legSwing, lean) {
    const out = super.attackPose(legSwing, lean);
    if (this.atk && this.atk.reverse) { out[2] = -out[2]; out[4] = -out[4]; }
    return out;
  }

  onHurt(nx, nz, heavy) {
    this.poiseHp -= heavy ? 24 : 8;
    if (this.poiseHp <= 0) {
      this.poiseHp = 70;
      this.knock.set(nx * 3, 0, nz * 3);
      if (this.atk && this.atk.tele) { this.atk.tele.active = false; this.atk.tele.group.visible = false; }
      this.atk = null;
      this.glint.visible = false;
      this.setState('hurt');
      this.say('Ow! My back! I don\'t have dental either!', 2);
    }
  }

  die() {
    super.die();
    this.say(this.def.death, 4);
    this.game.ui.subtitle(this.def.name, this.def.death, 4);
    this.game.endBossFight(this, true);
  }
}

// ------------------------------------------------------------------
// Final boss: Lord Touchgrass.
export class LordTouchgrass extends Enemy {
  constructor(game, x, z) {
    super(game, 'knight', x, z);
    game.scene.remove(this.root);
    if (this.blob) { game.scene.remove(this.blob); this.blob = blobShadow(1.8); game.scene.add(this.blob); }
    this.rig = makeEnemyModel('king');
    this.root = this.rig.root;
    game.scene.add(this.root);
    this.glint = glintSprite();
    this.glint.scale.setScalar(1.2);
    this.glint.position.set(0, 2.2, 0);
    this.rig.weapon.add(this.glint);
    this.def = { ...this.def, ...TOUCHGRASS, rare: null };
    this.radius = TOUCHGRASS.radius;
    this.height = TOUCHGRASS.height;
    this.isBoss = true;
    this.reset();
  }

  reset() {
    super.reset();
    this.yaw = 0;
    this.phase = 1;
    this.engaged = false;
    this.poiseHp = 140;
    this.talkT = 9;
    this.rage = false;
    this.history = [];
    this.sitting = true;
  }

  begin() {
    this.engaged = true;
    if (this.sitting) this.pos.z = this.home.z + 3;
    this.sitting = false;
    this.setState('chase');
    this.cd = 1.0;
  }

  onPlayerHeal() {
    if (!this.engaged || this.dead) return;
    const line = pick(this.def.healRage);
    this.say(line, 3);
    this.game.ui.subtitle(this.def.name, line, 3);
    this.rage = true;
    this.cd = Math.min(this.cd, 0.2);
  }

  update(dt) {
    const g = this.game, p = g.player;
    if (this.dead) { this.updateDead(dt); return; }
    this.t += dt;
    if (!this.engaged) { this.animate(dt, 0); return; }
    if (!p.alive) { this.animate(dt, 0); return; }
    this.cd -= dt;
    this.talkT -= dt;
    if (this.talkT <= 0 && this.state !== 'attack') {
      this.talkT = 10 + Math.random() * 5;
      const line = pick(this.def.taunts);
      this.say(line, 3);
      g.ui.subtitle(this.def.name, line, 3);
    }
    if (this.phase === 1 && this.hp < this.maxHp * 0.4 && this.state !== 'attack') {
      this.phase = 2;
      this.setState('phase');
      this.say(this.def.phase2, 4);
      g.ui.subtitle(this.def.name, this.def.phase2, 4);
      g.audio.play('bossIntro');
      g.shake(0.6);
    }
    const dist = this.distTo(p.pos);
    let move = 0;
    if (this.state === 'phase') {
      // Rage transformation: roar, shockwave, green aura.
      g.fx.rise(this.pos.x, this.pos.y + 1, this.pos.z, 0x66ff44, 2, 2.5);
      if (this.t > 0.6 && !this.roared) { this.roared = true; g.fx.ring(this.pos.x, this.pos.z, { speed: 14, maxR: 18, dmg: 8, color: 0x88ff66 }); g.audio.play('stomp'); }
      if (this.t > 2.2) { this.setState('chase'); this.cd = 0.3; }
      return this.finish(dt, 0);
    }
    if (this.phase === 2 && Math.random() < dt * 4) g.fx.rise(this.pos.x, this.pos.y + 2, this.pos.z, 0x66ff44, 1, 1.5);
    if (this.state === 'attack') { this.updateBossAttack(dt, dist); return this.finish(dt, 0); }
    if (this.state === 'hurt') { if (this.t > 1.4) this.setState('chase'); return this.finish(dt, 0); }
    const turn = this.phase === 2 ? 2.4 : 1.7;
    this.yaw = turnTo(this.yaw, this.faceYaw(p.pos), dt * turn);
    if (dist > 4.5) move = this.def.speed * (this.phase === 2 ? 1.35 : 1);
    if (this.cd <= 0) this.chooseAttack(dist);
    if (move) { this.pos.x += Math.sin(this.yaw) * move * dt; this.pos.z += Math.cos(this.yaw) * move * dt; }
    this.finish(dt, move);
  }

  chooseAttack(dist) {
    let kind;
    if (this.rage) { kind = this.phase === 2 ? 'charge' : 'gnomes'; this.rage = false; }
    else {
      const opts = [];
      if (dist < 7.5) opts.push('rake', 'rake');
      if (dist < 12) opts.push('stomp');
      if (dist > 6 && (dist < 13 || Math.random() < 0.4)) opts.push('gnomes');
      if (this.phase === 2 && dist > 5) opts.push('charge', 'charge');
      // Far away with nothing picked: keep walking towards the player.
      if (!opts.length && dist > 12) { this.cd = 0.8; return; }
      if (!opts.length) opts.push('stomp');
      // Avoid repeating the same attack three times in a row.
      const last2 = this.history.slice(-2);
      let pool = opts.filter((o) => !(last2.length === 2 && last2[0] === o && last2[1] === o));
      if (!pool.length) pool = opts;
      kind = pick(pool);
    }
    this.history.push(kind);
    if (this.history.length > 4) this.history.shift();
    this.startAttack(kind);
  }

  attackDef(kind) {
    const p2 = this.phase === 2;
    const k = p2 ? 0.75 : 1;
    if (kind === 'rake') return { kind: 'sweep', name: kind, windup: 1.0 * k, active: 0.3, recover: 1.0 * k, dmg: 26, range: 7.5, arc: 1.9, lunge: 3, knock: 9 };
    if (kind === 'stomp') return { kind: 'stomp', name: kind, windup: 1.0 * k, active: 0.25, recover: 1.2 * k, dmg: 20 };
    if (kind === 'charge') return { kind: 'charge', name: kind, windup: 0.9, active: 1.3, recover: 1.5, dmg: 32 };
    return { kind: 'throw', name: 'gnomes', windup: 0.8 * k, active: p2 ? 1.6 : 1.2, recover: 0.9 * k, dmg: 22, count: p2 ? 5 : 3 };
  }

  startAttack(kind) {
    this.atk = this.attackDef(kind);
    this.atk.t = 0; this.atk.hit = false; this.atk.fired = 0; this.atk.glinted = false;
    this.setState('attack');
    if (kind === 'charge') this.say(pick(['VROOOM!', 'MOWING TIME!', 'BEEP BEEP!']), 1.5);
  }

  updateBossAttack(dt) {
    const g = this.game, p = g.player, a = this.atk;
    a.t += dt;
    const [ph, f] = this.atkPhase();
    this.jumpY = 0;
    if (ph === 'windup') {
      this.yaw = turnTo(this.yaw, this.faceYaw(p.pos), dt * (f < 0.6 ? 3 : 0.8));
      this.glint.visible = f > 0.4;
      if (f > 0.4 && !a.glinted) { a.glinted = true; g.audio.play('windup'); }
      if (a.name === 'stomp') this.jumpY = smoothstep(0.3, 1, f) * 2.2;
      if (a.name === 'charge' && Math.random() < 0.5) g.fx.burst(this.pos.x, this.pos.y + 0.2, this.pos.z, 0x88aa55, 1, { glow: false, speed: 2 });
    } else this.glint.visible = false;

    if (ph === 'active') {
      if (a.name === 'rake') {
        this.pos.x += Math.sin(this.yaw) * a.lunge * dt;
        this.pos.z += Math.cos(this.yaw) * a.lunge * dt;
        if (!a.hit) this.meleeCheck(a);
      } else if (a.name === 'stomp') {
        this.jumpY = 2.2 * (1 - f);
      } else if (a.name === 'charge') {
        const sp = 15;
        const ox = this.pos.x, oz = this.pos.z;
        this.pos.x += Math.sin(this.yaw) * sp * dt;
        this.pos.z += Math.cos(this.yaw) * sp * dt;
        g.world.col.resolve(this.pos, this.radius);
        if (Math.random() < 0.6) g.fx.burst(this.pos.x, this.pos.y + 0.2, this.pos.z, 0x77cc44, 2, { glow: false, speed: 3 });
        if (!a.hit && this.distTo(p.pos) < this.radius + 1.0) { a.hit = true; g.damagePlayer(a.dmg, this.pos.x, this.pos.z, { knock: 12, source: this }); }
        // Hit a wall: stop early, dizzy.
        const moved = Math.hypot(this.pos.x - ox, this.pos.z - oz);
        if (moved < sp * dt * 0.4) { a.t = a.windup + a.active; g.shake(0.4); g.audio.play('stomp'); this.say('Ow. Hedge.', 1.5); }
      } else if (a.name === 'gnomes') {
        const n = a.count;
        const due = Math.floor(f * n + 0.0001) + (f >= 1 ? 0 : 1);
        while (a.fired < Math.min(n, due)) { this.throwGnome(a.fired, n); a.fired++; }
      }
    }
    if (ph === 'recover' && a.name === 'stomp' && !a.landed) {
      a.landed = true;
      g.audio.play('stomp');
      g.shake(0.7);
      g.fx.burst(this.pos.x, this.pos.y + 0.2, this.pos.z, 0x88aa55, 24, { glow: false, speed: 8 });
      g.fx.ring(this.pos.x, this.pos.z, { speed: 10, maxR: 17, dmg: a.dmg, color: 0xffee88 });
      if (this.distTo(p.pos) < 3.6) g.damagePlayer(a.dmg, this.pos.x, this.pos.z, { knock: 9, source: this });
    }
    if (a.landed && this.phase === 2 && !a.ring2 && a.t > a.windup + a.active + 0.45) {
      a.ring2 = true;
      g.fx.ring(this.pos.x, this.pos.z, { speed: 10, maxR: 17, dmg: a.dmg, color: 0x88ff66 });
      g.audio.play('stomp');
    }
    if (a.t >= a.windup + a.active + a.recover) {
      this.cd = (this.phase === 2 ? 0.4 : 0.9) + Math.random() * 0.6;
      this.setState('chase');
      this.atk = null;
    }
  }

  throwGnome(i, n) {
    const g = this.game, p = g.player;
    let tx = p.pos.x + p.vel.x * 0.6, tz = p.pos.z + p.vel.z * 0.6;
    if (i > 0) { const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 4; tx += Math.cos(a) * r; tz += Math.sin(a) * r; }
    tx = Math.max(-20, Math.min(20, tx)); tz = Math.max(-106, Math.min(-70, tz));
    const from = new THREE.Vector3(this.pos.x + Math.sin(this.yaw) * 1.5, this.pos.y + 5, this.pos.z + Math.cos(this.yaw) * 1.5);
    const T = 1.15;
    const ty = groundHeight(tx, tz);
    const vel = new THREE.Vector3((tx - from.x) / T, (ty - from.y + 0.5 * 9.8 * T * T) / T, (tz - from.z) / T);
    const tele = g.fx.telegraph(tx, tz, 2.3, T);
    g.fx.spawnProjectile('gnome', from, vel, { dmg: this.atk.dmg, splash: 2.3, tele, life: 3 });
    g.audio.play('swing');
    void n;
  }

  onHurt(nx, nz, heavy) {
    this.poiseHp -= heavy ? 22 : 7;
    if (this.poiseHp <= 0 && this.state !== 'phase') {
      this.poiseHp = 140;
      this.atk = null;
      this.glint.visible = false;
      this.setState('hurt');
      this.say(pick(['My knees!', 'Oof! Five hundred years of no stretching!', 'Not the crown!']), 2);
    }
    void nx; void nz;
  }

  takeDamage(amount, fx, fz, heavy, stagger) {
    if (this.state === 'phase') amount *= 0.3;
    super.takeDamage(amount, fx, fz, heavy, stagger);
  }

  die() {
    super.die();
    this.say(this.def.death, 5);
    this.game.ui.subtitle(this.def.name, this.def.death, 5);
    this.game.endBossFight(this, true);
  }

  updateDead(dt) {
    this.deadT += dt;
    const f = smoothstep(0, 2.5, this.deadT);
    this.rig.body.rotation.x = -f * 1.5;
    if (Math.random() < dt * 8) this.game.fx.rise(this.pos.x, this.pos.y + 1, this.pos.z, 0xffcc44, 2, 2);
    if (this.deadT > 4 && !this.hidden) {
      this.hidden = true;
      this.root.visible = false;
      if (this.blob) this.blob.visible = false;
      this.game.fx.burst(this.pos.x, this.pos.y + 2, this.pos.z, 0xffee88, 40, { speed: 8, up: 5 });
    }
  }

  animate(dt, move) {
    if (this.sitting) {
      const r = this.rig;
      this.root.position.copy(this.pos);
      this.root.rotation.y = this.yaw;
      r.legL.rotation.x = r.legR.rotation.x = -1.5;
      r.torso.rotation.set(-0.1, 0, 0);
      r.armR.rotation.set(-0.3, 0, -0.2);
      r.armL.rotation.set(-0.3, 0, 0.2);
      r.body.position.y = Math.sin(this.t * 1.5) * 0.01;
      if (this.blob) this.blob.position.set(this.pos.x, this.pos.y + 0.04, this.pos.z);
      return;
    }
    super.animate(dt, move);
  }
}

// ------------------------------------------------------------------
// Open-world region bosses, built from shared attack types (see REGION_BOSSES in data.js).
export class RegionBoss extends Enemy {
  constructor(game, id, x, z) {
    super(game, 'knight', x, z);
    const cfg = REGION_BOSSES[id];
    game.scene.remove(this.root);
    if (this.blob) { game.scene.remove(this.blob); this.blob = blobShadow(cfg.radius); game.scene.add(this.blob); }
    this.rig = makeEnemyModel(cfg.model);
    this.root = this.rig.root;
    game.scene.add(this.root);
    this.glint = glintSprite();
    this.glint.scale.setScalar(1.2);
    if (this.rig.weapon) { this.glint.position.set(0, 1.0, 0); this.rig.weapon.add(this.glint); }
    else { this.glint.position.set(0, 1.2, 0.6); this.rig.torso.add(this.glint); }
    this.bossId = id;
    this.def = { ...this.def, ...cfg, rare: null, detect: cfg.arena, lose: cfg.arena + 10, leash: cfg.arena + 8 };
    this.radius = cfg.radius;
    this.height = cfg.height;
    this.isBoss = true;
    this.poise = 1;
    this.reset();
  }

  reset() {
    super.reset();
    this.yaw = 0;
    this.phase = 1;
    this.engaged = false;
    this.poiseHp = 110;
    this.talkT = 8;
    this.history = [];
    this.rage = false;
    this.roared = false;
  }

  onPlayerHeal() {
    if (!this.engaged || this.dead || !this.def.healRage) return;
    const line = pick(this.def.healRage);
    this.say(line, 3);
    this.game.ui.subtitle(this.def.name, line, 3);
    this.rage = true;
    this.cd = Math.min(this.cd, 0.3);
  }

  update(dt) {
    const g = this.game, p = g.player;
    if (this.dead) { this.updateDead(dt); return; }
    this.t += dt;
    const fromHome = Math.hypot(p.pos.x - this.home.x, p.pos.z - this.home.z);
    if (!this.engaged) {
      if (p.alive && fromHome < this.def.arena) {
        this.engaged = true;
        g.startBossFight(this);
        this.say(this.def.intro, 5);
        g.ui.subtitle(this.def.name, this.def.intro, 5);
        g.ui.bossTitle(this.def.name, this.def.title);
        this.setState('alert');
        this.cd = 1.6;
      }
      this.animate(dt, 0);
      return;
    }
    if (!p.alive || fromHome > this.def.arena + 12) {
      this.engaged = false;
      g.endBossFight(this, false);
      if (p.alive) g.ui.toast(`${this.def.name} lost interest and went home to heal.`);
      this.reset();
      return;
    }
    this.cd -= dt;
    if (this.slowT > 0) this.slowT -= dt;
    this.talkT -= dt;
    if (this.talkT <= 0 && this.state !== 'attack') {
      this.talkT = 9 + Math.random() * 5;
      const line = pick(this.def.taunts);
      this.say(line, 3);
      g.ui.subtitle(this.def.name, line, 3);
    }
    if (this.phase === 1 && this.hp < this.maxHp * 0.45 && this.state !== 'attack') {
      this.phase = 2;
      this.setState('phase');
      this.say(this.def.phase2Line, 4);
      g.ui.subtitle(this.def.name, this.def.phase2Line, 4);
      g.audio.play('bossIntro');
      g.shake(0.5);
    }
    const dist = this.distTo(p.pos);
    let move = 0;
    if (this.state === 'phase') {
      g.fx.rise(this.pos.x, this.pos.y + 1, this.pos.z, 0xff8844, 2, 2);
      if (this.t > 0.6 && !this.roared) { this.roared = true; g.fx.ring(this.pos.x, this.pos.z, { speed: 13, maxR: 15, dmg: 8, color: 0xff9966 }); g.audio.play('stomp'); }
      if (this.t > 1.8) { this.setState('chase'); this.cd = 0.3; }
      return this.finish(dt, 0);
    }
    if (this.state === 'attack') { this.updateBossAttack(dt); return this.finish(dt, 0); }
    if (this.state === 'hurt') { if (this.t > 1.2) this.setState('chase'); return this.finish(dt, 0); }
    if (this.state === 'alert') { this.yaw = turnTo(this.yaw, this.faceYaw(p.pos), dt * 3); if (this.t > 1.5) this.setState('chase'); return this.finish(dt, 0); }
    this.state = 'chase';
    this.yaw = turnTo(this.yaw, this.faceYaw(p.pos), dt * (this.phase === 2 ? 3.2 : 2.4));
    if (dist > this.radius + 2.2) move = this.def.speed * (this.phase === 2 ? 1.25 : 1) * (this.slowT > 0 ? 0.6 : 1);
    if (this.cd <= 0) this.chooseAttack(dist);
    if (move) { this.pos.x += Math.sin(this.yaw) * move * dt; this.pos.z += Math.cos(this.yaw) * move * dt; }
    this.finish(dt, move);
  }

  chooseAttack(dist) {
    let kind;
    const reach = this.radius + 2.8;
    if (this.rage) { this.rage = false; kind = 'charge'; }
    else {
      const list = this.phase === 2 ? this.def.attacks.concat(this.def.phase2) : this.def.attacks;
      const ok = list.filter((k) => {
        if (k === 'sweep' || k === 'overhead') return dist < reach + 0.5;
        if (k === 'stomp') return dist < 9;
        if (k === 'leap') return dist > 4 && dist < 13;
        if (k === 'barrage') return dist > 5;
        if (k === 'fan') return dist > 3.5;
        if (k === 'charge') return dist > 5;
        return true;
      });
      if (!ok.length) { if (dist > reach) { this.cd = 0.4; return; } ok.push('sweep'); }
      const last2 = this.history.slice(-2);
      let pool = ok.filter((o) => !(last2.length === 2 && last2[0] === o && last2[1] === o));
      if (!pool.length) pool = ok;
      kind = pick(pool);
    }
    this.history.push(kind);
    if (this.history.length > 4) this.history.shift();
    this.startAttack(kind);
  }

  attackDef(kind) {
    const k = this.phase === 2 ? 0.8 : 1, d = this.def.dmg;
    const reach = this.radius + 2.8;
    switch (kind) {
      case 'sweep': return { kind: 'sweep', name: kind, windup: 0.85 * k, active: 0.25, recover: 0.9 * k, dmg: d, range: reach, arc: 1.7, lunge: 3, knock: 8 };
      case 'overhead': return { kind: 'overhead', name: kind, windup: 0.95 * k, active: 0.2, recover: 1.0 * k, dmg: d * 1.25, range: reach + 0.3, arc: 0.9, lunge: 2.5, knock: 9 };
      case 'stomp': return { kind: 'stomp', name: kind, windup: 0.95 * k, active: 0.25, recover: 1.0 * k, dmg: d * 0.8 };
      case 'leap': return { kind: 'stomp', name: kind, windup: 0.6, active: 0.85, recover: 1.1 * k, dmg: d * 1.05 };
      case 'barrage': return { kind: 'throw', name: kind, windup: 0.75 * k, active: this.phase === 2 ? 1.4 : 1.0, recover: 0.85 * k, dmg: d * 0.85, count: this.phase === 2 ? 5 : 3 };
      case 'fan': return { kind: 'throw', name: kind, windup: 0.65 * k, active: 0.1, recover: 0.75 * k, dmg: d * 0.5, count: this.phase === 2 ? 7 : 5 };
      default: return { kind: 'charge', name: 'charge', windup: 0.85, active: 1.1, recover: 1.3, dmg: d * 1.25 };
    }
  }

  startAttack(kind) {
    this.atk = this.attackDef(kind);
    const a = this.atk;
    a.t = 0; a.hit = false; a.fired = 0; a.glinted = false; a.landed = false;
    if (kind === 'leap') {
      const p = this.game.player;
      a.from = this.pos.clone();
      a.to = new THREE.Vector3(p.pos.x, 0, p.pos.z);
      a.tele = this.game.fx.telegraph(a.to.x, a.to.z, 3.4, a.windup + a.active);
    }
    this.setState('attack');
  }

  updateBossAttack(dt) {
    const g = this.game, p = g.player, a = this.atk;
    a.t += dt;
    const [ph, f] = this.atkPhase();
    this.jumpY = 0;
    if (ph === 'windup') {
      if (a.name !== 'leap') this.yaw = turnTo(this.yaw, this.faceYaw(p.pos), dt * (f < 0.6 ? 3.5 : 0.8));
      this.glint.visible = f > 0.4;
      if (f > 0.4 && !a.glinted) { a.glinted = true; g.audio.play('windup'); }
      if (a.name === 'stomp') this.jumpY = smoothstep(0.3, 1, f) * 1.6;
    } else this.glint.visible = false;
    if (ph === 'active') {
      if (a.name === 'sweep' || a.name === 'overhead') {
        this.pos.x += Math.sin(this.yaw) * a.lunge * dt;
        this.pos.z += Math.cos(this.yaw) * a.lunge * dt;
        if (!a.hit) this.meleeCheck(a);
      } else if (a.name === 'stomp') this.jumpY = 1.6 * (1 - f);
      else if (a.name === 'leap') {
        const k = smoothstep(0, 1, f);
        this.pos.x = a.from.x + (a.to.x - a.from.x) * k;
        this.pos.z = a.from.z + (a.to.z - a.from.z) * k;
        this.jumpY = Math.sin(f * Math.PI) * 4;
      } else if (a.name === 'charge') {
        const sp = 14, ox = this.pos.x, oz = this.pos.z;
        this.pos.x += Math.sin(this.yaw) * sp * dt;
        this.pos.z += Math.cos(this.yaw) * sp * dt;
        g.world.col.resolve(this.pos, this.radius);
        if (Math.random() < 0.6) g.fx.burst(this.pos.x, this.pos.y + 0.2, this.pos.z, 0xc8b890, 2, { glow: false, speed: 3 });
        if (!a.hit && this.distTo(p.pos) < this.radius + 1.0) { a.hit = true; g.damagePlayer(a.dmg, this.pos.x, this.pos.z, { knock: 12, source: this }); }
        if (Math.hypot(this.pos.x - ox, this.pos.z - oz) < sp * dt * 0.4) { a.t = a.windup + a.active; g.shake(0.4); g.audio.play('stomp'); }
      } else if (a.name === 'barrage') {
        const due = Math.min(a.count, Math.floor(f * a.count) + 1);
        while (a.fired < due) { this.lob(a.fired); a.fired++; }
      } else if (a.name === 'fan' && !a.fired) {
        a.fired = 1;
        const base = this.faceYaw(p.pos);
        const kind = this.def.proj === 'pan' ? 'pan' : this.def.proj === 'cannon' ? 'cannon' : this.def.proj;
        for (let i = 0; i < a.count; i++) {
          const yaw = base + (i - (a.count - 1) / 2) * 0.22;
          const from = new THREE.Vector3(this.pos.x, this.pos.y + this.height * 0.5, this.pos.z);
          g.fx.spawnProjectile(kind, from, new THREE.Vector3(Math.sin(yaw) * 13, 2, Math.cos(yaw) * 13), { dmg: a.dmg, grav: 4, radius: 0.45, chill: kind === 'snowball' ? 2.5 : 0, life: 2 });
        }
        g.audio.play('swing');
      }
    }
    if (ph === 'recover' && (a.name === 'stomp' || a.name === 'leap') && !a.landed) {
      a.landed = true;
      g.audio.play('stomp');
      g.shake(0.6);
      g.fx.burst(this.pos.x, this.pos.y + 0.2, this.pos.z, 0xb8a888, 20, { glow: false, speed: 7 });
      if (a.name === 'stomp') g.fx.ring(this.pos.x, this.pos.z, { speed: 10, maxR: 14, dmg: a.dmg, color: 0xffcc88 });
      if (this.distTo(p.pos) < (a.name === 'leap' ? 3.6 : 3.2)) g.damagePlayer(a.dmg, this.pos.x, this.pos.z, { knock: 9, source: this });
    }
    if (a.t >= a.windup + a.active + a.recover) {
      this.cd = (this.phase === 2 ? 0.45 : 0.85) + Math.random() * 0.6;
      this.setState('chase');
      this.atk = null;
    }
  }

  lob(i) {
    const g = this.game, p = g.player;
    let tx = p.pos.x + p.vel.x * 0.6, tz = p.pos.z + p.vel.z * 0.6;
    if (i > 0) { const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 4; tx += Math.cos(a) * r; tz += Math.sin(a) * r; }
    const from = new THREE.Vector3(this.pos.x, this.pos.y + this.height, this.pos.z);
    const T = 1.1, ty = groundHeight(tx, tz);
    const vel = new THREE.Vector3((tx - from.x) / T, (ty - from.y + 0.5 * 9.8 * T * T) / T, (tz - from.z) / T);
    const tele = g.fx.telegraph(tx, tz, 2.2, T);
    g.fx.spawnProjectile(this.def.proj, from, vel, { dmg: this.atk.dmg, splash: 2.2, tele, life: 3, chill: this.def.proj === 'snowball' ? 2 : 0 });
    g.audio.play(this.def.proj === 'cannon' ? 'stomp' : 'swing');
  }

  onHurt(nx, nz, heavy) {
    this.poiseHp -= heavy ? 24 : 8;
    if (this.poiseHp <= 0 && this.state !== 'phase') {
      this.poiseHp = 110;
      if (this.atk && this.atk.tele) { this.atk.tele.active = false; this.atk.tele.group.visible = false; }
      this.atk = null;
      this.glint.visible = false;
      this.setState('hurt');
    }
    void nx; void nz;
  }

  takeDamage(amount, fx, fz, heavy, stagger) {
    if (this.state === 'phase') amount *= 0.3;
    super.takeDamage(amount, fx, fz, heavy, stagger);
  }

  die() {
    super.die();
    this.say(this.def.death, 5);
    this.game.ui.subtitle(this.def.name, this.def.death, 5);
    this.game.endBossFight(this, true);
  }

  updateDead(dt) {
    this.deadT += dt;
    const f = smoothstep(0, 2, this.deadT);
    this.rig.body.rotation.x = -f * 1.5;
    if (Math.random() < dt * 6) this.game.fx.rise(this.pos.x, this.pos.y + 1, this.pos.z, 0xffcc44, 2, 1.5);
    if (this.deadT > 3 && !this.hidden) {
      this.hidden = true;
      this.root.visible = false;
      if (this.blob) this.blob.visible = false;
      this.game.fx.burst(this.pos.x, this.pos.y + 2, this.pos.z, 0xffee88, 30, { speed: 7, up: 5 });
    }
  }
}

// ------------------------------------------------------------------
// NPCs: just stand around, face the player, and say things.
export class NPC {
  constructor(game, kind, x, z, yaw = 0) {
    this.game = game;
    this.kind = kind;
    if (kind === 'dennis') {
      this.rig = humanoid({ skin: 0xf0c090, body: 0x3a5a9a, arms: 0xcc4433, legs: 0x3a5a9a, head: 'farmer', boots: 0x3a2a1a });
      this.name = 'Farmer Dennis';
    } else if (kind === 'sockrates') {
      this.rig = humanoid({ skin: 0xe0b890, body: 0xf4f4ee, arms: 0xe0b890, legs: 0xf4f4ee, head: 'philosopher', boots: 0x8a5a2a });
      mesh(box(0.56, 0.08, 0.34), mat(0xcc3333), 0, 0.5, 0, this.rig.torso).rotation.z = 0.5;
      holdWeapon(this.rig, weaponModel('sockpuppet', 0.8));
      this.name = 'Sockrates';
    } else if (kind === 'coupon') {
      this.rig = humanoid({ skin: 0xd8a880, body: 0x3a6a3a, arms: 0x3a6a3a, legs: 0x2a3a6a, head: 'pirate', bandana: 0x22aa55, boots: 0x2a1a10, belly: true });
      mesh(box(0.6, 0.8, 0.4), mat(0x8a5a2a), 0, 0.4, -0.45, this.rig.torso);
      this.name = 'Captain Coupon';
    } else {
      this.rig = humanoid({ skin: 0xc89070, body: 0x8a6a3a, arms: 0x8a6a3a, legs: 0x4a3a2a, hair: 0x222222, boots: 0x2a1a10, belly: true });
      mesh(box(0.6, 0.8, 0.4), mat(0x6a4a2a), 0, 0.4, -0.45, this.rig.torso);
      holdWeapon(this.rig, weaponModel('pan', 0.7));
      this.name = 'Bargain Barry';
    }
    this.root = this.rig.root;
    this.root.traverse((o) => { if (o.isMesh) o.castShadow = game.useShadows; });
    optimize(this.root);
    this.pos = new THREE.Vector3(x, groundHeight(x, z), z);
    this.root.position.copy(this.pos);
    this.yaw = yaw;
    this.baseYaw = yaw;
    this.t = Math.random() * 5;
    this.height = 2.0;
    game.scene.add(this.root);
    if (!game.useShadows) { const b = blobShadow(0.45); b.position.set(x, this.pos.y + 0.04, z); game.scene.add(b); }
    game.world.col.addCircle(x, z, 0.45);
  }

  update(dt) {
    const p = this.game.player;
    this.t += dt;
    const d = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
    const target = d < 8 ? Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z) : this.baseYaw;
    this.yaw = turnTo(this.yaw, target, dt * 4);
    this.root.rotation.y = this.yaw;
    const r = this.rig;
    r.body.position.y = Math.sin(this.t * 2) * 0.02;
    r.armR.rotation.x = -0.3 + Math.sin(this.t * 1.3) * 0.1;
    if (this.kind === 'dennis' && !this.game.flags.chickenReturned) {
      // Anxious pacing hands.
      r.armL.rotation.x = -1.2 + Math.sin(this.t * 6) * 0.3;
      r.head.rotation.y = Math.sin(this.t * 0.8) * 0.5;
    } else {
      r.armL.rotation.x = Math.sin(this.t * 1.1) * 0.1;
      r.head.rotation.y = 0;
    }
  }
}

export class Chicken {
  constructor(game, x, z) {
    this.game = game;
    this.rig = makeChicken();
    this.root = this.rig.root;
    this.home = new THREE.Vector3(x, 0, z);
    this.pos = new THREE.Vector3(x, groundHeight(x, z), z);
    this.yaw = 0;
    this.t = 0;
    this.target = null;
    this.carried = false;
    this.height = 0.8;
    game.scene.add(this.root);
  }

  update(dt) {
    this.t += dt;
    const r = this.rig;
    if (this.carried) {
      // Riding on the player's head, judging everyone.
      const p = this.game.player;
      this.root.position.set(p.pos.x, p.pos.y + 1.85 + p.rig.body.position.y, p.pos.z);
      this.root.rotation.y = p.yaw;
      r.body.rotation.x = Math.sin(this.t * 3) * 0.05;
      return;
    }
    if (!this.target || Math.random() < dt * 0.3) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * 1.8;
      this.target = { x: this.home.x + Math.cos(a) * d, z: this.home.z + Math.sin(a) * d };
    }
    const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.1) {
      this.yaw = turnTo(this.yaw, Math.atan2(dx, dz), dt * 6);
      this.pos.x += Math.sin(this.yaw) * 1.2 * dt;
      this.pos.z += Math.cos(this.yaw) * 1.2 * dt;
      r.body.position.y = Math.abs(Math.sin(this.t * 14)) * 0.05;
    }
    r.body.rotation.x = Math.sin(this.t * 7) > 0.8 ? 0.6 : 0; // pecking
    this.pos.y = groundHeight(this.pos.x, this.pos.z);
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
  }
}
