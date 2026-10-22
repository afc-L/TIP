// Arcade vehicle controller + visual integration (suspension, wheels, lights, infotainment).
import * as THREE from 'three';
import { VEHICLE_BY_ID, type VehicleDef } from '../data/vehicles';
import type { BounceSettings, VehicleMods } from '../types';
import { buildCar, type CarParts } from './carModel';
import { Suspension, type BounceEvent } from './bounce';
import type { CollisionWorld } from './collision';

export interface DriveInput {
  throttle: number; // 0..1
  brake: number; // 0..1 (also reverse)
  steer: number; // -1..1 (+ = right)
  handbrake: boolean;
}

const BOUNCE_LABEL: Record<string, string> = { executive: 'EXECUTIVE', brickell: 'BRICKELL', miami: 'MIAMI MODE' };

export class Vehicle {
  def: VehicleDef;
  parts: CarParts;
  mods: VehicleMods;
  x = 0;
  z = 0;
  y = 0;
  yaw = 0;
  speed = 0;
  lat = 0; // lateral slide velocity
  steer = 0;
  wheelSpin = 0;
  accel = 0;
  latAccel = 0;
  susp = new Suspension();
  bounceActive = false;
  bounceLimit = 1;
  braking = false;
  headlights = false;
  occupied = false;
  lastHit = 0;
  impact = 0;
  private prevSpeed = 0;
  private screenTimer = 0;
  private headLight: THREE.SpotLight | null = null;
  bounceEvents: BounceEvent[] = [];

  constructor(id: string, mods: VehicleMods) {
    this.def = VEHICLE_BY_ID[id] ?? VEHICLE_BY_ID.maybach;
    this.mods = { ...mods };
    this.parts = buildCar(this.def.shape, this.def, this.mods, true, this.def.id === 'maybach');
  }

  get isMaybach() {
    return this.def.id === 'maybach';
  }
  get root() {
    return this.parts.root;
  }
  forward() {
    return { x: Math.sin(this.yaw), z: Math.cos(this.yaw) };
  }
  kmh() {
    return Math.abs(this.speed) * 3.6;
  }

  enableHeadlight(scene: THREE.Scene, on: boolean) {
    if (on && !this.headLight) {
      const l = new THREE.SpotLight('#fff3dd', 60, 60, 0.55, 0.5, 1.4);
      l.position.set(0, 0.9, this.def.length / 2);
      l.target.position.set(0, 0, this.def.length / 2 + 20);
      this.parts.root.add(l);
      this.parts.root.add(l.target);
      this.headLight = l;
    }
    if (this.headLight) this.headLight.visible = on;
    void scene;
  }

  applyMods(m: VehicleMods) {
    const p = this.parts;
    const wheelsChanged = m.wheels !== this.mods.wheels;
    const accentChanged = !!m.accent !== !!this.mods.accent;
    this.mods = { ...m };
    if (wheelsChanged || accentChanged) return false; // geometry change: caller rebuilds
    p.paintMat.color.set(m.paint);
    p.accentMat.color.set(m.accent || m.paint);
    p.glassMat.opacity = [0.35, 0.55, 0.75, 0.9][m.tint] ?? 0.75;
    p.interiorMat.color.set(m.interior);
    p.interiorMat.emissive.set(m.interior);
    p.underglow.visible = !!m.underglow;
    if (m.underglow) {
      p.underglowMat.color.set(m.underglow);
      p.underglowMat.opacity = 0.9;
    }
    return true;
  }

  private yawRate = 0;

  /** One fixed physics sub-step (keeps handling identical at any frame rate). */
  private physics(dt: number, inp: DriveInput, world: CollisionWorld, groundAt: (x: number, z: number) => number) {
    const d = this.def;
    const engine = 1 + this.mods.engine * 0.18;
    const grip = d.handling + this.mods.handling * 0.06;
    const top = d.topSpeed * (1 + this.mods.engine * 0.06);
    // --- longitudinal
    this.braking = false;
    if (inp.throttle > 0) {
      if (this.speed < -0.5) {
        this.speed += 22 * inp.throttle * dt;
        this.braking = true;
      } else {
        const f = 1 - Math.max(0, this.speed) / top;
        this.speed += d.accel * engine * inp.throttle * Math.max(0.05, f) * dt;
      }
    }
    if (inp.brake > 0) {
      if (this.speed > 0.5) {
        this.speed -= 24 * inp.brake * dt;
        this.braking = true;
      } else {
        this.speed -= 7 * inp.brake * dt;
        if (this.speed < -11) this.speed = -11;
      }
    }
    // drag / rolling resistance
    const drag = (0.9 + 0.0009 * this.speed * this.speed) * dt * (inp.throttle > 0 || inp.brake > 0 ? 0.4 : 1.6);
    if (Math.abs(this.speed) <= drag) this.speed = 0;
    else this.speed -= Math.sign(this.speed) * drag;
    if (inp.handbrake) {
      this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 9 * dt);
      this.braking = true;
    }
    // --- steering
    const maxSteer = 0.62 / (1 + Math.abs(this.speed) * 0.045);
    const target = inp.steer * maxSteer;
    this.steer += (target - this.steer) * Math.min(1, dt * (5 + grip * 4));
    const wb = Math.abs(this.parts.wheelPos[0].z - this.parts.wheelPos[2].z);
    let yawRate = (this.speed * Math.tan(this.steer)) / wb;
    yawRate *= 0.75 + grip * 0.5;
    if (inp.handbrake && Math.abs(this.speed) > 6) {
      yawRate *= 1.6;
      this.lat += -yawRate * Math.abs(this.speed) * 0.05 * dt * 10;
    }
    this.yawRate = yawRate;
    // right is -x when facing +z; positive steer input = right turn -> yaw decreases
    this.yaw -= yawRate * dt;
    this.lat *= Math.exp(-dt * (inp.handbrake ? 1.2 : 4 + grip * 4));
    // --- integrate position
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const rx = -fz, rz = fx; // right vector
    this.x += (fx * this.speed + rx * this.lat) * dt;
    this.z += (fz * this.speed + rz * this.lat) * dt;
    // --- collisions (three circles along the body)
    const r = d.width / 2;
    const off = d.length / 2 - r;
    let hit = false;
    let nx = 0, nz = 0;
    for (const o of [off, 0, -off]) {
      const p = { x: this.x + fx * o, z: this.z + fz * o };
      const res = world.resolveCircle(p, r, this.y + 0.3, 1.4);
      if (res.hit) {
        this.x += p.x - (this.x + fx * o);
        this.z += p.z - (this.z + fz * o);
        hit = true;
        nx += res.nx;
        nz += res.nz;
      }
    }
    if (hit) {
      const n = Math.hypot(nx, nz) || 1;
      nx /= n;
      nz /= n;
      const into = fx * this.speed * nx + fz * this.speed * nz; // negative = moving into wall
      if (into < 0) {
        this.impact = Math.max(this.impact, -into);
        const head = Math.abs(fx * nx + fz * nz);
        this.speed *= head > 0.7 ? 0.15 : 0.7;
        this.lat *= 0.3;
        if (head < 0.7) this.yaw += Math.sign(fx * nz - fz * nx) * 0.02;
      }
    }
    // --- ground follow
    const gy = groundAt(this.x, this.z);
    this.y += (gy - this.y) * Math.min(1, dt * 12);
  }

  update(dt: number, inp: DriveInput, bounce: BounceSettings, world: CollisionWorld, groundAt: (x: number, z: number) => number) {
    this.impact = 0;
    const steps = Math.max(1, Math.ceil(dt / 0.02));
    for (let i = 0; i < steps; i++) this.physics(dt / steps, inp, world, groundAt);
    const yawRate = this.yawRate;
    const wb = Math.abs(this.parts.wheelPos[0].z - this.parts.wheelPos[2].z);
    // --- dynamics for suspension
    const acc = (this.speed - this.prevSpeed) / Math.max(dt, 1e-3);
    this.prevSpeed = this.speed;
    this.accel += (acc - this.accel) * Math.min(1, dt * 6);
    this.latAccel += (this.speed * yawRate * -1 - this.latAccel) * Math.min(1, dt * 5);
    // Bounce speed limiting: full effect when parked/slow, reduced while cruising
    const sp = Math.abs(this.speed);
    this.bounceLimit = sp < 3 ? 1 : sp < 14 ? 1 - ((sp - 3) / 11) * 0.65 : 0.2;
    const active = this.isMaybach && bounce.enabled && this.bounceActive;
    const tw = Math.abs(this.parts.wheelPos[0].x - this.parts.wheelPos[1].x);
    const so = this.susp.update(dt, bounce, active, this.bounceLimit, this.accel, this.latAccel, wb, tw);
    this.bounceEvents = this.susp.events.slice();
    // --- visuals
    const p = this.parts;
    p.root.position.set(this.x, this.y, this.z);
    p.root.rotation.y = this.yaw;
    p.chassis.position.y = so.heave;
    p.chassis.rotation.set(so.pitch, 0, so.roll);
    this.wheelSpin += (this.speed / p.wheelR) * dt;
    for (let i = 0; i < 4; i++) {
      const m = p.wheelMounts[i];
      m.position.y = p.wheelR + so.wheelLift[i];
      if (i < 2) m.rotation.y = -this.steer;
      p.wheels[i].rotation.x = this.wheelSpin;
      // strut spans from hub to the (moving) body
      p.struts[i].scale.y = Math.max(0.05, 0.22 + so.corner[i] - so.wheelLift[i]);
    }
    if (p.steering) p.steering.rotation.z = -this.steer * 4;
    p.brakeMat.emissiveIntensity = this.braking ? 3 : this.headlights ? 1.1 : 0.4;
    p.headMat.emissiveIntensity = this.headlights ? 3 : 0.8;
    // infotainment screen
    this.screenTimer -= dt;
    if (p.screen && this.occupied && this.screenTimer <= 0) {
      this.screenTimer = 0.25;
      this.drawScreen(bounce, active);
    }
  }

  drawScreen(b: BounceSettings, active: boolean) {
    const s = this.parts.screen!;
    const c = s.ctx;
    const W = s.canvas.width, H = s.canvas.height;
    c.fillStyle = '#05080c';
    c.fillRect(0, 0, W, H);
    // left: speed
    c.fillStyle = '#d4af6a';
    c.font = '600 22px Arial';
    c.fillText(this.def.make.toUpperCase(), 24, 36);
    c.fillStyle = '#fff';
    c.font = '700 84px Arial';
    c.fillText(`${Math.round(this.kmh())}`, 24, 130);
    c.font = '500 22px Arial';
    c.fillStyle = '#9ab';
    c.fillText('km/h', 24, 162);
    // right: bounce panel
    const x0 = W * 0.42;
    c.fillStyle = '#0d141c';
    c.fillRect(x0, 14, W - x0 - 14, H - 28);
    c.fillStyle = '#d4af6a';
    c.font = '600 20px Arial';
    c.fillText('HYDRAULIC SUSPENSION', x0 + 18, 44);
    c.fillStyle = active ? '#3dffb0' : '#777';
    c.font = '700 40px Arial';
    c.fillText(this.isMaybach ? (active ? `BOUNCE: ${BOUNCE_LABEL[b.style]}` : 'BOUNCE: OFF') : 'COMFORT', x0 + 18, 96);
    c.fillStyle = '#334';
    c.fillRect(x0 + 18, 120, W - x0 - 60, 14);
    c.fillStyle = '#d4af6a';
    c.fillRect(x0 + 18, 120, (W - x0 - 60) * b.intensity * (active ? this.bounceLimit : 1), 14);
    c.fillStyle = '#9ab';
    c.font = '500 18px Arial';
    c.fillText(`Intensity ${Math.round(b.intensity * 100)}%${active && this.bounceLimit < 0.99 ? '  (limited at speed)' : ''}   ·   B toggle · V settings`, x0 + 18, 162);
    s.update();
  }

  dispose() {
    this.parts.root.removeFromParent();
    this.parts.dispose();
  }
}
