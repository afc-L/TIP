// In-world vehicle challenges: Brickell Bounce-Off and Miami Showoff.
import type { BounceStyle } from '../types';
import type { MinigameHud } from '../uiStore';

export interface MinigameCtx {
  dt: number;
  inZone: boolean;
  speed: number;
  isMaybach: boolean;
  bounceOn: boolean;
  style: BounceStyle;
  intensity: number;
  pressed: (code: string) => boolean;
  handbrake: boolean;
  yawDelta: number;
  prestige: number;
  distCenter: number;
}

export interface Minigame {
  id: 'bounceoff' | 'showoff';
  time: number;
  score: number;
  done: boolean;
  update(c: MinigameCtx): void;
  hud(): MinigameHud;
  hype(): number; // 0..1 crowd excitement
}

const STYLE_NAME: Record<BounceStyle, string> = { executive: 'EXECUTIVE', brickell: 'BRICKELL', miami: 'MIAMI MODE' };

export class BounceOff implements Minigame {
  id = 'bounceoff' as const;
  time = 45;
  score = 0;
  done = false;
  call: { style: BounceStyle; min: number; max: number } = { style: 'executive', min: 0.2, max: 0.6 };
  private callT = 0;
  private combo = 0;
  private matching = false;
  private raw = 0;
  private hypeV = 0;

  constructor() {
    this.newCall();
  }

  private newCall() {
    const styles: BounceStyle[] = ['executive', 'brickell', 'miami'];
    let s = styles[Math.floor(Math.random() * 3)];
    if (s === this.call.style) s = styles[(styles.indexOf(s) + 1) % 3];
    const min = s === 'executive' ? 0.2 : s === 'brickell' ? 0.4 + Math.random() * 0.2 : 0.6 + Math.random() * 0.25;
    this.call = { style: s, min: Math.round(min * 10) / 10, max: s === 'executive' ? 0.6 : 1 };
    this.callT = 5 + Math.random() * 2.5;
  }

  update(c: MinigameCtx) {
    if (this.done) return;
    this.time -= c.dt;
    this.callT -= c.dt;
    if (this.callT <= 0) this.newCall();
    this.matching = c.inZone && c.speed < 3 && c.bounceOn && c.style === this.call.style && c.intensity >= this.call.min - 0.001 && c.intensity <= this.call.max + 0.001;
    if (this.matching) {
      this.combo = Math.min(3, this.combo + c.dt * 0.25);
      this.raw += c.dt * (1 + this.combo) * (1 + c.intensity * 0.5);
    } else this.combo = Math.max(0, this.combo - c.dt);
    this.hypeV += ((this.matching ? 1 : c.bounceOn ? 0.4 : 0.1) - this.hypeV) * Math.min(1, c.dt * 2);
    // ~45s of perfect play with combos -> ~140 raw; map to 0..100
    this.score = Math.min(100, Math.round((this.raw / 120) * 100));
    if (this.time <= 0) {
      this.time = 0;
      this.done = true;
    }
  }

  hud(): MinigameHud {
    return {
      title: 'BRICKELL BOUNCE-OFF',
      timeLeft: this.time,
      score: this.score,
      call: `JUDGE CALLS: ${STYLE_NAME[this.call.style]} · ${Math.round(this.call.min * 100)}%${this.call.max < 1 ? `–${Math.round(this.call.max * 100)}%` : '+'}`,
      hint: this.matching ? `MATCHED! Combo x${(1 + this.combo).toFixed(1)}` : 'Stay in the ring, stop, B = bounce · 1/2/3 = style · Z/X = intensity',
      lines: [
        { text: 'Inside the ring & stopped', done: this.matching || undefined },
      ],
    };
  }

  hype() {
    return this.hypeV;
  }
}

interface Step {
  text: string;
  done: boolean;
  check: (c: MinigameCtx, st: ShowoffState) => boolean;
}
interface ShowoffState {
  bounceHold: number;
  burnout: number;
  spin: number;
  park: number;
}

export class Showoff implements Minigame {
  id = 'showoff' as const;
  time = 75;
  score = 0;
  done = false;
  private st: ShowoffState = { bounceHold: 0, burnout: 0, spin: 0, park: 0 };
  private steps: Step[];
  private idx = 0;
  private hypeV = 0;
  private prestige = 0;

  constructor(isMaybach: boolean) {
    this.steps = [
      { text: 'Roll onto the gold star', done: false, check: (c) => c.distCenter < 9 },
      { text: 'Flash the headlights (L)', done: false, check: (c) => c.pressed('KeyL') },
      { text: 'Hit the horn (H)', done: false, check: (c) => c.pressed('KeyH') },
      isMaybach
        ? { text: 'Bounce in MIAMI MODE at 70%+ for 5s', done: false, check: (c, s) => ((s.bounceHold = c.bounceOn && c.style === 'miami' && c.intensity >= 0.7 && c.speed < 4 ? s.bounceHold + c.dt : 0), s.bounceHold >= 5) }
        : { text: 'Burnout: hold W + S for 3s', done: false, check: (c, s) => ((s.burnout = c.pressed('__burn') ? s.burnout + c.dt : Math.max(0, s.burnout - c.dt)), s.burnout >= 3) },
      { text: 'Handbrake donut: spin 360° (Space)', done: false, check: (c, s) => ((s.spin += c.handbrake && c.speed > 2 ? Math.abs(c.yawDelta) : 0), s.spin >= Math.PI * 2) },
      { text: 'Park on the star and hold still for 3s', done: false, check: (c, s) => ((s.park = c.distCenter < 7 && c.speed < 0.5 ? s.park + c.dt : 0), s.park >= 3) },
    ];
  }

  update(c: MinigameCtx) {
    if (this.done) return;
    this.prestige = c.prestige;
    this.time -= c.dt;
    if (this.idx < this.steps.length) {
      const step = this.steps[this.idx];
      if (step.check(c, this.st)) {
        step.done = true;
        this.idx++;
        this.hypeV = 1;
      }
    }
    this.hypeV = Math.max(0.15, this.hypeV - c.dt * 0.3);
    const completed = this.steps.filter((s) => s.done).length;
    this.score = Math.min(100, Math.round(completed * 13 + (completed === this.steps.length ? Math.max(0, this.time) * 0.4 : 0) + this.prestige * 1.2));
    if (this.idx >= this.steps.length || this.time <= 0) {
      this.done = true;
      this.time = Math.max(0, this.time);
    }
  }

  hud(): MinigameHud {
    return {
      title: 'MIAMI SHOWOFF',
      timeLeft: this.time,
      score: this.score,
      lines: this.steps.map((s, i) => ({ text: s.text, done: s.done, active: i === this.idx })),
    };
  }

  hype() {
    return this.hypeV;
  }
}
