// MAYBACH HYDRAULIC BOUNCE SYSTEM
// Four independent hydraulic corners (spring-damper), each chasing a target height.
// Bounce styles generate distinct target patterns; driving dynamics add pitch/roll.
// Output drives the chassis transform (heave / pitch / roll) and wheel/strut offsets.
// The vehicle's physics root never moves vertically, so the effect can never destabilise driving.
import type { BounceSettings, BounceStyle } from '../types';

export interface SuspensionOut {
  heave: number;
  pitch: number;
  roll: number;
  corner: number[]; // per-corner displacement
  wheelLift: number[]; // per-wheel lift (wheel hop) when the body exceeds travel
  level: number; // 0..1 visual intensity for HUD
}

export interface BounceEvent {
  kind: 'up' | 'down' | 'hop';
  strength: number;
}

const TRAVEL = 0.34;

export class Suspension {
  d = [0, 0, 0, 0];
  v = [0, 0, 0, 0];
  t = 0;
  prevTarget = [0, 0, 0, 0];
  prevDir = [0, 0, 0, 0];
  hopT = 0;
  nextHop = 2.5;
  jitter = [0, 0, 0, 0];
  blend = 0; // smooth enable/disable
  out: SuspensionOut = { heave: 0, pitch: 0, roll: 0, corner: [0, 0, 0, 0], wheelLift: [0, 0, 0, 0], level: 0 };
  events: BounceEvent[] = [];

  /**
   * @param wheelbase distance between axles
   * @param track distance between left/right wheels
   * @param accel longitudinal acceleration (m/s^2, + forward)
   * @param lat lateral acceleration (m/s^2, + toward +x / left)
   * @param limit 0..1 speed-based limit (1 = full effect)
   */
  update(dt: number, s: BounceSettings, active: boolean, limit: number, accel: number, lat: number, wheelbase: number, track: number) {
    this.events.length = 0;
    this.blend += ((active ? 1 : 0) - this.blend) * Math.min(1, dt * 3);
    if (this.blend < 0.001 && !active) this.blend = 0;
    this.t += dt;
    const I = Math.max(0, Math.min(1, s.intensity)) * limit;
    let style: BounceStyle = s.style;
    // the most extreme mode is downgraded at speed
    if (style === 'miami' && limit < 0.5) style = 'brickell';
    const tgt = [0, 0, 0, 0];
    const ride = s.rideHeight * 0.07;
    let amp = 0;
    if (this.blend > 0) {
      const t = this.t;
      if (style === 'executive') {
        // slow, smooth, synchronized "breathing" with a slight front lead
        amp = 0.05 + 0.14 * I;
        const f = 0.5;
        const front = 0.5 - 0.5 * Math.cos(2 * Math.PI * f * t);
        const rear = 0.5 - 0.5 * Math.cos(2 * Math.PI * f * t - 0.5);
        tgt[0] = tgt[1] = front * amp;
        tgt[2] = tgt[3] = rear * amp;
      } else if (style === 'brickell') {
        // punchy hops; front and rear alternate so the SUV rocks nose-to-tail
        amp = 0.08 + 0.34 * I;
        const f = 1.35;
        const front = Math.pow(Math.abs(Math.sin(Math.PI * f * t)), 0.7);
        const rear = Math.pow(Math.abs(Math.sin(Math.PI * f * t + Math.PI / 2)), 0.7);
        tgt[0] = tgt[1] = front * amp;
        tgt[2] = tgt[3] = rear * amp * 0.75;
      } else {
        // MIAMI MODE: fast heave + side-to-side "three-wheel" roll + periodic big front hops
        amp = 0.12 + 0.52 * I;
        const f = 2.1;
        const heave = Math.pow(Math.abs(Math.sin(Math.PI * f * t)), 0.6);
        const rollW = Math.sin(Math.PI * f * 0.5 * t);
        const pitchW = Math.sin(Math.PI * f * 0.75 * t + 1);
        for (let i = 0; i < 4; i++) {
          const side = i % 2 === 0 ? 1 : -1;
          const fr = i < 2 ? 1 : -1;
          tgt[i] = amp * (0.55 * heave + 0.3 * side * rollW + 0.2 * fr * pitchW + 0.25) + this.jitter[i];
        }
        this.hopT -= dt;
        this.nextHop -= dt;
        if (this.nextHop <= 0) {
          this.nextHop = 2.2 + Math.random() * 1.8;
          this.hopT = 0.32;
          this.events.push({ kind: 'hop', strength: I });
        }
        if (this.hopT > 0) {
          tgt[0] += amp * 1.4 * I;
          tgt[1] += amp * 1.4 * I;
        }
        if (Math.random() < dt * 6) for (let i = 0; i < 4; i++) this.jitter[i] = (Math.random() - 0.5) * 0.05 * I;
      }
      for (let i = 0; i < 4; i++) tgt[i] *= this.blend;
    }
    // driving dynamics: dive/squat and body roll
    const dive = Math.max(-0.08, Math.min(0.08, accel * 0.0065));
    const roll = Math.max(-0.07, Math.min(0.07, lat * 0.0075));
    tgt[0] += -dive + roll;
    tgt[1] += -dive - roll;
    tgt[2] += dive + roll;
    tgt[3] += dive - roll;
    for (let i = 0; i < 4; i++) tgt[i] += ride;

    // detect pattern peaks for hydraulic sound effects
    if (this.blend > 0.3) {
      for (let i = 0; i < 4; i += 2) {
        const dir = Math.sign(tgt[i] - this.prevTarget[i]);
        if (dir !== 0 && dir !== this.prevDir[i] && this.prevDir[i] !== 0) {
          this.events.push({ kind: dir < 0 ? 'up' : 'down', strength: Math.min(1, amp * 2.2) });
        }
        if (dir !== 0) this.prevDir[i] = dir;
      }
    }
    for (let i = 0; i < 4; i++) this.prevTarget[i] = tgt[i];

    // spring-damper integration (sub-stepped for stability)
    const k = 140 + s.stiffness * 260;
    const c = 2 * Math.sqrt(k) * (0.32 + (1 - s.stiffness) * 0.15);
    const steps = Math.max(4, Math.ceil(Math.min(dt, 0.1) / 0.0125));
    const h = Math.min(dt, 0.1) / steps;
    for (let n = 0; n < steps; n++) {
      for (let i = 0; i < 4; i++) {
        const a = -k * (this.d[i] - tgt[i]) - c * this.v[i];
        this.v[i] += a * h;
        this.d[i] += this.v[i] * h;
        if (this.d[i] < -0.12) {
          this.d[i] = -0.12;
          if (this.v[i] < 0) this.v[i] *= -0.2;
        }
        if (this.d[i] > 1.0) {
          this.d[i] = 1.0;
          this.v[i] = Math.min(0, this.v[i]);
        }
      }
    }
    const o = this.out;
    const d = this.d;
    o.heave = (d[0] + d[1] + d[2] + d[3]) / 4;
    o.pitch = -Math.atan(((d[0] + d[1]) / 2 - (d[2] + d[3]) / 2) / wheelbase);
    o.roll = Math.atan(((d[0] + d[2]) / 2 - (d[1] + d[3]) / 2) / track);
    for (let i = 0; i < 4; i++) {
      o.corner[i] = d[i];
      o.wheelLift[i] = Math.max(0, d[i] - TRAVEL) * 0.55;
    }
    o.level = amp > 0 ? Math.min(1, Math.max(0, o.heave / (amp * 0.8))) * this.blend : 0;
    return o;
  }
}
