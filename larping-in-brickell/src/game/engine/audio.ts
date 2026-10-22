// Fully procedural Web Audio: engine, tires, hydraulics, ambience, club & lounge music, UI blips.
// No external or copyrighted audio is used.
import { useSettings } from '../settings';

type Ctx = AudioContext;

export class AudioSystem {
  ctx: Ctx | null = null;
  master!: GainNode;
  music!: GainNode;
  sfx!: GainNode;
  vfx!: GainNode;
  private engOsc: OscillatorNode[] = [];
  private engGain!: GainNode;
  private engFilter!: BiquadFilterNode;
  private tireGain!: GainNode;
  private ambGain!: GainNode;
  private ambFilter!: BiquadFilterNode;
  private waveGain!: GainNode;
  private noiseBuf!: AudioBuffer;
  private musicMode: 'none' | 'lounge' | 'club' | 'party' = 'none';
  private seqTimer: number | null = null;
  private nextNote = 0;
  private step = 0;
  private musicBus!: GainNode;
  private clubFilter!: BiquadFilterNode;
  private boatGain!: GainNode;

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.music = ctx.createGain();
    this.sfx = ctx.createGain();
    this.vfx = ctx.createGain();
    this.music.connect(this.master);
    this.sfx.connect(this.master);
    this.vfx.connect(this.master);
    this.musicBus = ctx.createGain();
    this.clubFilter = ctx.createBiquadFilter();
    this.clubFilter.type = 'lowpass';
    this.clubFilter.frequency.value = 20000;
    this.musicBus.connect(this.clubFilter);
    this.clubFilter.connect(this.music);
    // noise buffer
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b = (b + 0.02 * w) / 1.02;
      d[i] = b * 3.5 * 0.5 + w * 0.5;
    }
    // engine: two detuned saws + sub square through a lowpass
    this.engFilter = ctx.createBiquadFilter();
    this.engFilter.type = 'lowpass';
    this.engFilter.frequency.value = 400;
    this.engFilter.Q.value = 3;
    this.engGain = ctx.createGain();
    this.engGain.gain.value = 0;
    this.engFilter.connect(this.engGain);
    this.engGain.connect(this.sfx);
    for (const [type, det] of [['sawtooth', 0], ['sawtooth', 7], ['square', -1200]] as [OscillatorType, number][]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = 40;
      o.detune.value = det;
      const g = ctx.createGain();
      g.gain.value = type === 'square' ? 0.35 : 0.25;
      o.connect(g);
      g.connect(this.engFilter);
      o.start();
      this.engOsc.push(o);
    }
    // tire screech
    const tn = ctx.createBufferSource();
    tn.buffer = this.noiseBuf;
    tn.loop = true;
    const tf = ctx.createBiquadFilter();
    tf.type = 'bandpass';
    tf.frequency.value = 2200;
    tf.Q.value = 6;
    this.tireGain = ctx.createGain();
    this.tireGain.gain.value = 0;
    tn.connect(tf);
    tf.connect(this.tireGain);
    this.tireGain.connect(this.sfx);
    tn.start();
    // city ambience (filtered noise rumble)
    const an = ctx.createBufferSource();
    an.buffer = this.noiseBuf;
    an.loop = true;
    this.ambFilter = ctx.createBiquadFilter();
    this.ambFilter.type = 'lowpass';
    this.ambFilter.frequency.value = 500;
    this.ambGain = ctx.createGain();
    this.ambGain.gain.value = 0.05;
    an.connect(this.ambFilter);
    this.ambFilter.connect(this.ambGain);
    this.ambGain.connect(this.sfx);
    an.start();
    // waves (marina) — LFO-modulated noise
    const wn = ctx.createBufferSource();
    wn.buffer = this.noiseBuf;
    wn.loop = true;
    const wf = ctx.createBiquadFilter();
    wf.type = 'lowpass';
    wf.frequency.value = 900;
    this.waveGain = ctx.createGain();
    this.waveGain.gain.value = 0;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.18;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.5;
    const waveMod = ctx.createGain();
    waveMod.gain.value = 0.5;
    lfo.connect(lfoG);
    lfoG.connect(waveMod.gain);
    wn.connect(wf);
    wf.connect(waveMod);
    waveMod.connect(this.waveGain);
    this.waveGain.connect(this.sfx);
    wn.start();
    lfo.start();
    // boat motor
    const bo = ctx.createOscillator();
    bo.type = 'sawtooth';
    bo.frequency.value = 55;
    const bf = ctx.createBiquadFilter();
    bf.type = 'lowpass';
    bf.frequency.value = 260;
    this.boatGain = ctx.createGain();
    this.boatGain.gain.value = 0;
    bo.connect(bf);
    bf.connect(this.boatGain);
    this.boatGain.connect(this.sfx);
    bo.start();
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const s = useSettings.getState().s;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.masterVolume, t, 0.05);
    this.music.gain.setTargetAtTime(s.musicVolume * 0.6, t, 0.05);
    this.sfx.gain.setTargetAtTime(s.sfxVolume, t, 0.05);
    this.vfx.gain.setTargetAtTime(s.vehicleFxVolume, t, 0.05);
  }

  suspend(v: boolean) {
    if (!this.ctx) return;
    if (v) this.ctx.suspend();
    else this.ctx.resume();
  }

  /** Called every frame */
  private lastUpdate = 0;

  update(p: { driving: boolean; rpm: number; throttle: number; skid: number; night: number; nearWater: number; boat: number; interior: string | null; prestige: number }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // ~30 Hz is plenty for parameter automation and keeps the event timeline small
    if (t - this.lastUpdate < 0.033) return;
    this.lastUpdate = t;
    const base = 32 + p.prestige * 2;
    const f = base + p.rpm * 95;
    for (let i = 0; i < this.engOsc.length; i++) this.engOsc[i].frequency.setTargetAtTime(i === 2 ? f * 2 : f, t, 0.05);
    this.engFilter.frequency.setTargetAtTime(220 + p.rpm * 900 + p.throttle * 600, t, 0.06);
    this.engGain.gain.setTargetAtTime(p.driving ? 0.05 + p.throttle * 0.07 + p.rpm * 0.04 : 0, t, 0.1);
    this.tireGain.gain.setTargetAtTime(p.driving ? Math.min(0.12, p.skid * 0.12) : 0, t, 0.05);
    const inside = p.interior === 'club';
    this.ambGain.gain.setTargetAtTime(inside ? 0.0 : 0.035 + (1 - p.night) * 0.02, t, 0.3);
    this.waveGain.gain.setTargetAtTime(inside ? 0 : p.nearWater * 0.14, t, 0.3);
    this.boatGain.gain.setTargetAtTime(p.boat * 0.09, t, 0.1);
  }

  // --- one shots
  private env(g: GainNode, t: number, a: number, peak: number, d: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  /** Hydraulic "pssht" (release) and "clunk" (pump / bottom out). Routed to vehicle FX bus. */
  hydraulic(kind: 'up' | 'down' | 'hop', strength: number, vol: number) {
    if (!this.ctx || vol <= 0) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = vol;
    out.connect(this.vfx);
    if (kind === 'up' || kind === 'hop') {
      const n = ctx.createBufferSource();
      n.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.setValueAtTime(3000, t);
      f.frequency.exponentialRampToValueAtTime(800, t + 0.35);
      const g = ctx.createGain();
      this.env(g, t, 0.01, 0.12 * (0.4 + strength), 0.32);
      n.connect(f);
      f.connect(g);
      g.connect(out);
      n.start(t, Math.random());
      n.stop(t + 0.45);
    }
    if (kind === 'down' || kind === 'hop') {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(kind === 'hop' ? 120 : 90, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
      const g = ctx.createGain();
      this.env(g, t, 0.005, (kind === 'hop' ? 0.5 : 0.28) * (0.4 + strength), 0.2);
      o.connect(g);
      g.connect(out);
      o.start(t);
      o.stop(t + 0.3);
      // pump whine
      const w = ctx.createOscillator();
      w.type = 'square';
      w.frequency.setValueAtTime(220, t);
      w.frequency.linearRampToValueAtTime(330, t + 0.12);
      const wg = ctx.createGain();
      this.env(wg, t, 0.01, 0.025 * strength, 0.12);
      const wf = ctx.createBiquadFilter();
      wf.type = 'lowpass';
      wf.frequency.value = 1200;
      w.connect(wf);
      wf.connect(wg);
      wg.connect(out);
      w.start(t);
      w.stop(t + 0.18);
    }
    if (kind === 'hop') this.rev(0.6 * strength);
  }

  rev(amount: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engGain.gain.cancelScheduledValues(t);
    this.engGain.gain.setValueAtTime(this.engGain.gain.value, t);
    this.engGain.gain.linearRampToValueAtTime(0.12 * amount + 0.04, t + 0.08);
    this.engGain.gain.setTargetAtTime(0.04, t + 0.2, 0.2);
  }

  horn() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    for (const fr of [392, 494]) {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = fr;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 1500;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.06, t + 0.02);
      g.gain.setValueAtTime(0.06, t + 0.35);
      g.gain.linearRampToValueAtTime(0.0001, t + 0.45);
      o.connect(f);
      f.connect(g);
      g.connect(this.sfx);
      o.start(t);
      o.stop(t + 0.5);
    }
  }

  door() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(50, t + 0.12);
    const g = ctx.createGain();
    this.env(g, t, 0.003, 0.35, 0.15);
    o.connect(g);
    g.connect(this.sfx);
    o.start(t);
    o.stop(t + 0.2);
  }

  crash(strength: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const n = ctx.createBufferSource();
    n.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    const g = ctx.createGain();
    this.env(g, t, 0.005, Math.min(0.6, 0.15 + strength * 0.03), 0.4);
    n.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    n.start(t, Math.random());
    n.stop(t + 0.5);
  }

  ui(kind: 'click' | 'cash' | 'error' | 'achieve' | 'open') {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const notes: Record<string, number[]> = { click: [880], open: [660, 990], cash: [1046, 1318, 1568], error: [220, 180], achieve: [784, 988, 1175, 1568] };
    notes[kind].forEach((fr, i) => {
      const o = ctx.createOscillator();
      o.type = kind === 'error' ? 'sawtooth' : 'triangle';
      o.frequency.value = fr;
      const g = ctx.createGain();
      const st = t + i * 0.07;
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(kind === 'click' ? 0.04 : 0.07, st + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.18);
      o.connect(g);
      g.connect(this.sfx);
      o.start(st);
      o.stop(st + 0.2);
    });
  }

  crowdCheer(strength = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const n = ctx.createBufferSource();
    n.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1400;
    f.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.09 * strength, t + 0.25);
    g.gain.linearRampToValueAtTime(0.0001, t + 1.6);
    n.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    n.start(t, Math.random());
    n.stop(t + 1.7);
  }

  // --- music sequencer (original procedural loops)
  private muffled = false;

  setMusic(mode: 'none' | 'lounge' | 'club' | 'party', muffled = false) {
    if (!this.ctx) return;
    if (muffled !== this.muffled) {
      this.muffled = muffled;
      this.clubFilter.frequency.setTargetAtTime(muffled ? 380 : 20000, this.ctx.currentTime, 0.2);
    }
    if (mode === this.musicMode) return;
    this.musicMode = mode;
    if (this.seqTimer) {
      clearInterval(this.seqTimer);
      this.seqTimer = null;
    }
    if (mode === 'none') return;
    this.nextNote = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.seqTimer = window.setInterval(() => this.schedule(), 50);
  }

  private schedule() {
    if (!this.ctx) return;
    const bpm = this.musicMode === 'lounge' ? 96 : this.musicMode === 'party' ? 118 : 124;
    const spb = 60 / bpm / 4; // 16th notes
    while (this.nextNote < this.ctx.currentTime + 0.15) {
      this.playStep(this.step, this.nextNote, spb);
      this.nextNote += spb;
      this.step = (this.step + 1) % 64;
    }
  }

  private playStep(s: number, t: number, spb: number) {
    const ctx = this.ctx!;
    const bus = this.musicBus;
    const lounge = this.musicMode === 'lounge';
    const bar = Math.floor(s / 16);
    // chord progression: Am - F - C - G (original)
    const roots = [57, 53, 48, 55];
    const root = roots[bar % 4];
    const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
    const beat = s % 16;
    if (!lounge && beat % 4 === 0) {
      // kick
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.connect(g);
      g.connect(bus);
      o.start(t);
      o.stop(t + 0.3);
    }
    if (lounge && (beat === 0 || beat === 10)) {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(110, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.15);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.25, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(g);
      g.connect(bus);
      o.start(t);
      o.stop(t + 0.35);
    }
    // hats
    if (beat % 4 === 2 || (!lounge && beat % 2 === 1 && Math.random() < 0.3)) {
      const n = ctx.createBufferSource();
      n.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 7000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(lounge ? 0.03 : 0.06, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      n.connect(f);
      f.connect(g);
      g.connect(bus);
      n.start(t, Math.random());
      n.stop(t + 0.06);
    }
    // clap
    if (!lounge && (beat === 4 || beat === 12)) {
      const n = ctx.createBufferSource();
      n.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1500;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      n.connect(f);
      f.connect(g);
      g.connect(bus);
      n.start(t, Math.random());
      n.stop(t + 0.16);
    }
    // bass
    if (lounge ? beat % 8 === 0 : beat % 2 === 0 && beat % 4 !== 0) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = mtof(root - 24);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(lounge ? 300 : 700, t);
      f.frequency.exponentialRampToValueAtTime(120, t + spb * 1.8);
      const g = ctx.createGain();
      g.gain.setValueAtTime(lounge ? 0.12 : 0.16, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + spb * (lounge ? 7 : 1.9));
      o.connect(f);
      f.connect(g);
      g.connect(bus);
      o.start(t);
      o.stop(t + spb * 8);
    }
    // pad chord at bar start
    if (beat === 0) {
      for (const iv of [0, 3, 7, 10]) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = mtof(root + iv + (iv === 3 && (root === 53 || root === 48) ? 1 : 0));
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(lounge ? 0.03 : 0.022, t + spb * 4);
        g.gain.linearRampToValueAtTime(0.0001, t + spb * 16);
        o.connect(g);
        g.connect(bus);
        o.start(t);
        o.stop(t + spb * 16.2);
      }
    }
    // arp
    if (beat % (lounge ? 4 : 2) === 1 && Math.random() < 0.8) {
      const scale = [0, 3, 7, 10, 12, 15];
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = mtof(root + 12 + scale[Math.floor(Math.random() * scale.length)]);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.05, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.connect(g);
      g.connect(bus);
      o.start(t);
      o.stop(t + 0.3);
    }
  }

  dispose() {
    this.setMusic('none');
    this.ctx?.close();
    this.ctx = null;
  }
}

export const audio = new AudioSystem();
