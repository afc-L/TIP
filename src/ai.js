import * as THREE from 'three';
import { UP, clamp, lerp, rand, smooth } from './util.js';

export const DIFFICULTY = {
  easy: { label: 'Easy', react: 0.48, aggression: 0.35, defense: 0.3, accuracy: 0.5, windup: 0.6, swing: 0.34, power: 0.85, parry: 0.1 },
  normal: { label: 'Normal', react: 0.3, aggression: 0.55, defense: 0.55, accuracy: 0.72, windup: 0.45, swing: 0.26, power: 1.0, parry: 0.3 },
  hard: { label: 'Hard', react: 0.17, aggression: 0.75, defense: 0.8, accuracy: 0.88, windup: 0.32, swing: 0.2, power: 1.15, parry: 0.55 },
};

// Attack patterns in the fighter's aim space: x = right, y = up (from chest), r = reach.
const ATTACKS = [
  { name: 'diagR', from: [0.55, 0.55, 0.22], to: [-0.5, -0.45, 0.5] },
  { name: 'diagL', from: [-0.45, 0.5, 0.28], to: [0.55, -0.4, 0.5] },
  { name: 'over', from: [0.12, 0.72, 0.12], to: [0.0, -0.5, 0.55] },
  { name: 'horiz', from: [0.68, 0.08, 0.22], to: [-0.62, 0.0, 0.5] },
  { name: 'low', from: [0.55, -0.1, 0.3], to: [-0.5, -0.6, 0.5] },
  { name: 'rising', from: [-0.4, -0.45, 0.3], to: [0.45, 0.55, 0.45] },
];

const _v = new THREE.Vector3(), _c = new THREE.Vector3();

/**
 * Drives a Fighter through the same input interface the player uses. It perceives its
 * opponent through a delayed memory (reaction time), so it cannot read future inputs.
 */
export class AIController {
  constructor(fighter, game, difficulty = 'normal', passive = false) {
    this.f = fighter;
    this.game = game;
    this.d = DIFFICULTY[difficulty] || DIFFICULTY.normal;
    this.passive = passive;
    this.state = 'approach';
    this.t = 0;
    this.memory = [];
    this.time = 0;
    this.strafe = Math.random() < 0.5 ? -1 : 1;
    this.aim = { x: 0.15, y: 0.0, reach: 0.4 };
    this.attack = null;
    this.defendT = 0;
    this.riseDelay = rand(0.6, 2);
    this.lastThreat = -10;
    this.prevTip = null;
  }

  pickTarget() {
    let best = null, bd = Infinity;
    for (const o of this.game.fighters) {
      if (o === this.f || o.team === this.f.team || !o.alive) continue;
      const d = o.parts.pelvis.p.distanceTo(this.f.parts.pelvis.p);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  perceive(dt) {
    const tgt = this.f.target;
    if (!tgt) { this.memory.length = 0; return null; }
    const tip = tgt.hasWeapon ? tgt.weaponPoint(0.9) : tgt.parts.handR.p.clone();
    const mid = tgt.hasWeapon ? tgt.weaponPoint(0.55) : tip.clone();
    const tipVel = this.prevTip ? tip.clone().sub(this.prevTip).multiplyScalar(1 / Math.max(dt, 1e-3)) : new THREE.Vector3();
    this.prevTip = tip.clone();
    this.memory.push({
      t: this.time, tip, mid, tipSpeed: tipVel.length(),
      torso: tgt.parts.torso.p.clone(), head: tgt.parts.head.p.clone(), pelvis: tgt.parts.pelvis.p.clone(),
      state: tgt.state, guard: tgt.input.guard,
    });
    while (this.memory.length > 2 && this.memory[1].t <= this.time - this.d.react) this.memory.shift();
    return this.memory[0];
  }

  update(dt) {
    const f = this.f, inp = f.input, d = this.d;
    this.time += dt;
    this.t += dt;
    f.target = this.pickTarget();
    const seen = this.perceive(dt);
    inp.moveX = 0; inp.moveZ = 0; inp.run = false; inp.guard = false; inp.brace = false;
    inp.power = 0.5;

    if (f.state === 'down') {
      this.riseDelay -= dt;
      if (this.riseDelay <= 0) { inp.getUp = true; this.riseDelay = rand(0.4, 1.5) / (0.5 + d.aggression); }
      this.state = 'recover'; this.t = 0;
      return;
    }
    if (f.state !== 'stand') return;

    if (!f.target || !seen) {
      inp.faceTarget = null;
      this.toward(0.15, -0.05, 0.4, dt, 4);
      return;
    }
    inp.faceTarget = seen.torso;
    if (this.passive) {
      inp.guard = true;
      this.toward(0.1, 0.1, 0.35, dt, 3);
      return;
    }

    const me = f.parts.pelvis.p;
    const dist = Math.hypot(seen.pelvis.x - me.x, seen.pelvis.z - me.z);
    const reach = f.hasWeapon ? f.weaponDef.reach : 0.4;
    const ideal = reach + 0.45;
    const fwd = f.fwd, right = f.right;
    const torso = f.parts.torso;
    const C = _c.copy(torso.p).addScaledVector(UP, 0.15);

    // ---------------- Threat assessment (delayed perception) ----------------
    const tipDist = seen.tip.distanceTo(torso.p);
    const threat = seen.tipSpeed > 5 && tipDist < reach + 0.9 && seen.state === 'stand';
    if (threat && this.time - this.lastThreat > 0.5) {
      this.lastThreat = this.time;
      const committed = this.state === 'strike' && this.t > d.swing * 0.3;
      if (!committed && Math.random() < d.defense) {
        this.state = 'defend'; this.t = 0;
        if (Math.random() < d.parry) inp.parry = true;
      }
    }

    // Too tired or off-balance: back off and brace
    if (f.balance < 0.3) { inp.brace = true; this.state = 'recover'; }
    if (f.stamina < 18 && this.state !== 'defend') { this.state = 'recover'; }

    switch (this.state) {
      case 'approach': {
        inp.guard = Math.random() < 0.002 ? !inp.guard : dist < ideal + 0.6;
        this.toward(0.2, 0.05, 0.35, dt, 4);
        if (dist > ideal + 0.15) { inp.moveZ = 1; inp.run = dist > ideal + 3 && f.stamina > 50; }
        else { this.state = 'circle'; this.t = 0; this.wait = rand(0.3, 1.6) * (1.3 - d.aggression); }
        break;
      }
      case 'circle': {
        inp.moveX = this.strafe * 0.6;
        if (dist > ideal + 0.35) inp.moveZ = 0.8;
        else if (dist < ideal - 0.35) inp.moveZ = -0.8;
        if (Math.random() < dt * 0.6) this.strafe *= -1;
        inp.guard = Math.random() < 0.5 * d.defense;
        this.toward(0.2 + Math.sin(this.time * 1.7) * 0.15, 0.05 + Math.sin(this.time * 2.3) * 0.12, 0.35, dt, 3);
        if (this.t > this.wait) {
          if (Math.random() < 0.25 + d.aggression * 0.6) this.startAttack(dist, ideal);
          else { this.t = 0; this.wait = rand(0.3, 1.2); }
        }
        if (dist > ideal + 1.0) { this.state = 'approach'; this.t = 0; }
        break;
      }
      case 'windup': {
        const a = this.attack;
        const k = smooth(this.t / this.windupTime);
        this.toward(a.from[0], a.from[1], a.from[2], dt, 6 + 4 * k);
        inp.power = 0.8;
        if (dist > ideal - 0.1) inp.moveZ = 1;
        if (this.t >= this.windupTime) { this.state = a.thrust ? 'thrust' : 'strike'; this.t = 0; }
        break;
      }
      case 'strike': {
        // Sweep through a point aimed at the (perceived) target; re-aimed every frame.
        const a = this.attack;
        const T = this.swingTime;
        const k = clamp(this.t / T, 0, 1);
        const aimPt = seen.head.y - seen.torso.y > 0.2 && a.name === 'over' ? seen.head : seen.torso;
        _v.copy(aimPt).sub(C);
        const hx = clamp(_v.dot(right) * 0.5, -0.4, 0.4) + this.noise.x;
        const hy = clamp(_v.dot(UP) * 0.6, -0.4, 0.4) + this.noise.y;
        let x, y, r;
        if (k < 0.5) {
          const u = k / 0.5;
          x = lerp(a.from[0], hx, u); y = lerp(a.from[1], hy, u); r = lerp(a.from[2], 0.6, u);
        } else {
          const u = (k - 0.5) / 0.5;
          x = lerp(hx, a.to[0] * this.overshoot, u); y = lerp(hy, a.to[1] * this.overshoot, u); r = lerp(0.6, a.to[2], u);
        }
        this.aim.x = x; this.aim.y = y; this.aim.reach = r;
        inp.power = d.power * this.commit;
        if (dist > ideal - 0.25) inp.moveZ = 0.7;
        if (this.t > T * 1.15) { this.state = 'recover'; this.t = 0; this.recoverTime = rand(0.35, 0.8) * (1.3 - d.aggression * 0.5) * (this.commit > 1.05 ? 1.6 : 1); }
        break;
      }
      case 'thrust': {
        if (this.t < dt * 1.5) inp.thrust = true;
        this.toward(0.0, -0.1, 0.45, dt, 5);
        inp.power = 1;
        if (this.t > 0.6) { this.state = 'recover'; this.t = 0; this.recoverTime = rand(0.3, 0.6); }
        break;
      }
      case 'defend': {
        // Put the blade between us and the incoming weapon.
        inp.guard = true;
        inp.power = 1;
        _v.copy(seen.mid).sub(C);
        const gx = clamp(_v.dot(right), -0.6, 0.6);
        const gy = clamp(_v.dot(UP), -0.5, 0.65);
        const err = (1 - d.accuracy) * 0.35;
        this.toward(gx + rand(-err, err), gy + rand(-err, err), 0.32, dt, 10 + d.defense * 8);
        if (dist < ideal - 0.2) inp.moveZ = -0.7;
        if (this.t > 0.45 + rand(0, 0.3)) {
          // counterattack quickly if aggressive
          if (Math.random() < d.aggression * 0.7 && f.stamina > 30) this.startAttack(dist, ideal);
          else { this.state = 'circle'; this.t = 0; this.wait = rand(0.2, 0.8); }
        }
        break;
      }
      case 'recover': {
        this.toward(0.2, 0.0, 0.32, dt, 3);
        inp.power = 0.35;
        inp.guard = f.stamina > 12 && Math.random() < 0.6;
        if (dist < ideal) inp.moveZ = -0.6;
        if (f.balance < 0.45) inp.brace = true;
        if (this.t > (this.recoverTime || 0.6) && f.balance > 0.45 && f.stamina > 22) { this.state = 'circle'; this.t = 0; this.wait = rand(0.2, 1.0); }
        break;
      }
      case 'grab': {
        if (this.t < dt * 1.5) inp.grab = true;
        inp.moveZ = -0.8; // pull
        if (this.t > 1.2) { if (f.grabJoint) inp.grab = true; this.state = 'recover'; this.t = 0; }
        break;
      }
    }

    // Crowding: push off or grab
    if (dist < 0.75 && this.state !== 'grab' && this.state !== 'strike') {
      if (Math.random() < dt * d.aggression * 0.8 && f.stamina > 30) { this.state = 'grab'; this.t = 0; }
      else inp.moveZ = -1;
    }
    if (!f.hasWeapon && this.state !== 'grab') {
      // disarmed: wrestle
      if (dist > 0.7) inp.moveZ = 1;
      else if (Math.random() < dt) { this.state = 'grab'; this.t = 0; }
    }

    inp.aim.x = this.aim.x; inp.aim.y = this.aim.y; inp.aim.reach = this.aim.reach;
  }

  startAttack(dist, ideal) {
    const d = this.d;
    const f = this.f;
    if (!f.hasWeapon) return;
    const thrustOk = f.weaponDef.label === 'Longsword' && Math.random() < 0.18;
    this.attack = thrustOk ? { name: 'thrust', from: [0.05, -0.05, 0.25], to: [0, 0, 0.7], thrust: true } : ATTACKS[Math.floor(Math.random() * ATTACKS.length)];
    this.state = 'windup';
    this.t = 0;
    this.windupTime = d.windup * rand(0.7, 1.3);
    this.swingTime = d.swing * rand(0.85, 1.2);
    const err = (1 - d.accuracy) * 0.5;
    this.noise = { x: rand(-err, err), y: rand(-err, err) };
    // Occasional over-commitment: big wild swings that are hard to recover from.
    this.commit = Math.random() < 0.15 + (1 - d.accuracy) * 0.3 ? 1.25 : 1;
    this.overshoot = this.commit > 1.05 ? 1.3 : 1;
  }

  toward(x, y, r, dt, rate) {
    const k = 1 - Math.exp(-rate * dt);
    this.aim.x += (x - this.aim.x) * k;
    this.aim.y += (y - this.aim.y) * k;
    this.aim.reach += (r - this.aim.reach) * k;
    const inp = this.f.input;
    inp.aim.x = this.aim.x; inp.aim.y = this.aim.y; inp.aim.reach = this.aim.reach;
  }
}
