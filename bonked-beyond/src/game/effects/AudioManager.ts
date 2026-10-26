// Procedural Web Audio sound effects and a tiny step sequencer for music.
// Everything fails silently: the game never depends on audio being available.
import { getSettings, useSettings } from '../../store/settingsStore';

export type Sfx =
  | 'hover' | 'click' | 'hit' | 'crit' | 'kill' | 'xp' | 'gold' | 'levelup' | 'hurt' | 'dodge'
  | 'swing' | 'shoot' | 'knife' | 'zap' | 'explode' | 'quake' | 'poison' | 'boomerang'
  | 'bossWarn' | 'bossSlam' | 'bossDie' | 'victory' | 'gameover' | 'pickup' | 'chest'
  | 'enemyShot' | 'fuse' | 'super' | 'select' | 'achievement' | 'heal' | 'deny'
  | 'blink' | 'rumble' | 'arrow' | 'enemyHeal' | 'meteor' | 'tesla' | 'drone' | 'tornado' | 'cannon' | 'shard'
  | 'rift' | 'reaper' | 'boulder' | 'bossRoar' | 'phase' | 'evolve' | 'rare' | 'whoosh' | 'evoReady' | 'synergy' | 'burn' | 'block' | 'altar';

/** Sounds that must cut through a busy mix. */
const PRIORITY: ReadonlySet<Sfx> = new Set(['levelup', 'hurt', 'bossWarn', 'bossDie', 'victory', 'gameover', 'achievement', 'evolve', 'phase', 'bossRoar', 'evoReady', 'chest', 'super']);

type MusicTrack = 'menu' | 'game0' | 'game1' | 'game2' | 'boss' | 'none';

class AudioManager {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noise!: AudioBuffer;
  private last = new Map<string, number>();
  private track: MusicTrack = 'none';
  private wanted: MusicTrack = 'none';
  private step = 0;
  private nextStepTime = 0;
  private voices = 0;
  private pitch = 1;

  constructor() {
    useSettings.subscribe(() => this.applyVolumes());
  }

  /** Call from a user gesture (respects autoplay rules). */
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -16;
        comp.ratio.value = 5;
        this.master = this.ctx.createGain();
        this.sfxBus = this.ctx.createGain();
        this.musicBus = this.ctx.createGain();
        this.sfxBus.connect(this.master);
        this.musicBus.connect(this.master);
        this.master.connect(comp).connect(this.ctx.destination);
        const len = this.ctx.sampleRate;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.applyVolumes();
        window.setInterval(() => this.schedule(), 50);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      if (this.wanted !== this.track) this.music(this.wanted);
    } catch {
      this.ctx = null;
    }
  }

  private applyVolumes() {
    if (!this.ctx) return;
    const s = getSettings();
    const m = s.muted ? 0 : s.masterVolume;
    this.master.gain.setTargetAtTime(m * 0.9, this.ctx.currentTime, 0.05);
    this.sfxBus.gain.setTargetAtTime(s.sfxVolume, this.ctx.currentTime, 0.05);
    this.musicBus.gain.setTargetAtTime(s.musicVolume * 0.55, this.ctx.currentTime, 0.05);
  }

  private gate(key: string, gap: number): boolean {
    if (!this.ctx || this.ctx.state !== 'running') return false;
    const t = this.ctx.currentTime;
    if (t - (this.last.get(key) ?? -1) < gap) return false;
    this.last.set(key, t);
    return true;
  }

  private env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0, bus?: GainNode) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    this.env(g, t, vol, 0.005, dur);
    o.connect(g).connect(bus ?? this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
    if (!bus) { this.voices++; o.onended = () => { this.voices--; }; }
  }

  private noiseBurst(dur: number, vol: number, freq: number, q = 1, type: BiquadFilterType = 'lowpass', delay = 0, bus?: GainNode) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.7 + Math.random() * 0.6;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    this.env(g, t, vol, 0.004, dur);
    src.connect(f).connect(g).connect(bus ?? this.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
    if (!bus) { this.voices++; src.onended = () => { this.voices--; }; }
  }

  /** `pitch` scales boss / variant sounds. Low-priority sounds are dropped when the mix is saturated. */
  play(s: Sfx, pitch = 1) {
    if (!this.ctx) return;
    if (this.voices > 36 && !PRIORITY.has(s)) return;
    this.pitch = pitch * (0.94 + Math.random() * 0.12); // natural variation on every repeat
    try { this.playInner(s); } catch { /* audio is optional */ }
  }

  private playInner(s: Sfx) {
    const r = Math.random();
    switch (s) {
      case 'hover': if (this.gate(s, 0.04)) this.tone('sine', 880, 1100, 0.05, 0.05); break;
      case 'click': if (this.gate(s, 0.03)) { this.tone('square', 520, 260, 0.08, 0.06); } break;
      case 'select': if (this.gate(s, 0.05)) { this.tone('triangle', 520, 1040, 0.12, 0.12); this.tone('triangle', 780, 1560, 0.15, 0.08, 0.06); } break;
      case 'deny': if (this.gate(s, 0.1)) this.tone('square', 200, 120, 0.15, 0.08); break;
      case 'hit': if (this.gate(s, 0.035)) { this.noiseBurst(0.06, 0.16, 1400 + r * 600); this.tone('sine', 180 + r * 40, 70, 0.08, 0.14); } break;
      case 'crit': if (this.gate(s, 0.06)) { this.noiseBurst(0.1, 0.22, 3000, 2, 'bandpass'); this.tone('square', 900, 300, 0.1, 0.07); } break;
      case 'kill': if (this.gate(s, 0.04)) { this.tone('sine', 300 + r * 120, 90, 0.12, 0.12); this.noiseBurst(0.08, 0.08, 900); } break;
      case 'xp': if (this.gate(s, 0.03)) this.tone('sine', 1200 + r * 500, 1900 + r * 400, 0.06, 0.05); break;
      case 'gold': if (this.gate(s, 0.05)) { this.tone('square', 1300, 1300, 0.05, 0.04); this.tone('square', 1700, 1700, 0.08, 0.04, 0.05); } break;
      case 'pickup': if (this.gate(s, 0.08)) { this.tone('triangle', 600, 1200, 0.15, 0.12); } break;
      case 'heal': if (this.gate(s, 0.1)) { this.tone('sine', 500, 900, 0.25, 0.12); this.tone('sine', 750, 1350, 0.25, 0.08, 0.08); } break;
      case 'levelup':
        if (this.gate(s, 0.2)) [523, 659, 784, 1046].forEach((f, i) => this.tone('triangle', f, f * 1.01, 0.22, 0.13, i * 0.07));
        break;
      case 'achievement':
        if (this.gate(s, 0.3)) [784, 988, 1175, 1568].forEach((f, i) => this.tone('square', f, f, 0.16, 0.06, i * 0.09));
        break;
      case 'hurt': if (this.gate(s, 0.12)) { this.tone('sawtooth', 220, 80, 0.2, 0.14); this.noiseBurst(0.15, 0.15, 600); } break;
      case 'dodge': if (this.gate(s, 0.1)) this.noiseBurst(0.18, 0.12, 2500, 1, 'bandpass'); break;
      case 'swing': if (this.gate(s, 0.06)) { this.noiseBurst(0.16, 0.12, 900 + r * 400, 1.5, 'bandpass'); this.tone('sine', 140, 60, 0.18, 0.16); } break;
      case 'shoot': if (this.gate(s, 0.06)) this.tone('sine', 700 + r * 200, 1400, 0.1, 0.06); break;
      case 'knife': if (this.gate(s, 0.05)) this.noiseBurst(0.06, 0.08, 4000, 3, 'bandpass'); break;
      case 'boomerang': if (this.gate(s, 0.1)) this.tone('triangle', 300, 500, 0.2, 0.05); break;
      case 'zap': if (this.gate(s, 0.07)) { this.noiseBurst(0.18, 0.14, 5000, 0.8, 'highpass'); this.tone('sawtooth', 1600, 200, 0.12, 0.05); } break;
      case 'explode': if (this.gate(s, 0.07)) { this.noiseBurst(0.45, 0.32, 500); this.tone('sine', 120, 35, 0.4, 0.25); } break;
      case 'quake': if (this.gate(s, 0.15)) { this.noiseBurst(0.6, 0.3, 250); this.tone('sine', 70, 30, 0.6, 0.3); } break;
      case 'poison': if (this.gate(s, 0.15)) this.noiseBurst(0.4, 0.07, 700, 4, 'bandpass'); break;
      case 'super':
        if (this.gate(s, 0.3)) { this.tone('sawtooth', 100, 600, 0.3, 0.12); this.noiseBurst(0.8, 0.35, 600, 1, 'lowpass', 0.25); this.tone('sine', 90, 30, 0.8, 0.3, 0.25); }
        break;
      case 'enemyShot': if (this.gate(s, 0.12)) this.tone('square', 400, 200, 0.15, 0.04); break;
      case 'fuse': if (this.gate(s, 0.25)) this.tone('square', 900, 1800, 0.3, 0.04); break;
      case 'chest': if (this.gate(s, 0.3)) [392, 523, 659, 784, 1046].forEach((f, i) => this.tone('triangle', f, f, 0.25, 0.1, i * 0.06)); break;
      case 'bossWarn':
        if (this.gate(s, 1)) { for (let i = 0; i < 3; i++) this.tone('sawtooth', 110, 104, 0.5, 0.16, i * 0.6); this.noiseBurst(1.6, 0.12, 200); }
        break;
      case 'bossSlam': if (this.gate(s, 0.2)) { this.noiseBurst(0.7, 0.35, 300); this.tone('sine', 60, 25, 0.7, 0.35); } break;
      case 'bossDie':
        if (this.gate(s, 1)) { this.noiseBurst(1.5, 0.35, 400); for (let i = 0; i < 4; i++) this.tone('sine', 200 - i * 30, 40, 0.6, 0.2, i * 0.25); }
        break;
      case 'victory':
        if (this.gate(s, 1)) {
          // a short fanfare with a bass line underneath
          [523, 659, 784, 1046, 784, 1046, 1318, 1568].forEach((f, i) => this.tone('square', f, f, i === 7 ? 0.9 : 0.28, 0.07, i * 0.14));
          [131, 165, 196, 262].forEach((f, i) => this.tone('triangle', f, f, 0.5, 0.12, i * 0.28));
        }
        break;
      case 'blink': if (this.gate(s, 0.15)) { this.tone('sine', 1400, 300, 0.2, 0.06); this.noiseBurst(0.15, 0.05, 3000, 2, 'bandpass'); } break;
      case 'rumble': if (this.gate(s, 0.3)) { this.noiseBurst(0.8, 0.18, 160); this.tone('sine', 55, 40, 0.8, 0.12); } break;
      case 'arrow': if (this.gate(s, 0.15)) this.noiseBurst(0.12, 0.08, 2500 * this.pitch, 6, 'bandpass'); break;
      case 'enemyHeal': if (this.gate(s, 0.3)) { this.tone('sine', 400, 800, 0.3, 0.06); this.tone('sine', 600, 1200, 0.3, 0.04, 0.1); } break;
      case 'meteor': if (this.gate(s, 0.12)) { this.noiseBurst(0.5, 0.25, 400); this.tone('sine', 90 * this.pitch, 30, 0.5, 0.25); } break;
      case 'tesla': if (this.gate(s, 0.08)) { this.tone('sawtooth', 2200 * this.pitch, 700, 0.07, 0.035); this.noiseBurst(0.08, 0.05, 6000, 1, 'highpass'); } break;
      case 'drone': if (this.gate(s, 0.06)) this.tone('square', 1800 * this.pitch, 900, 0.05, 0.025); break;
      case 'tornado': if (this.gate(s, 0.4)) this.noiseBurst(0.9, 0.12, 500, 3, 'bandpass'); break;
      case 'cannon': if (this.gate(s, 0.15)) { this.noiseBurst(0.3, 0.3, 700); this.tone('sine', 110 * this.pitch, 40, 0.35, 0.3); } break;
      case 'shard': if (this.gate(s, 0.05)) this.tone('triangle', 2600 * this.pitch, 3200, 0.06, 0.04); break;
      case 'rift': if (this.gate(s, 0.2)) { this.tone('sawtooth', 70, 140, 0.5, 0.08); this.noiseBurst(0.5, 0.08, 1200, 4, 'bandpass'); } break;
      case 'reaper': if (this.gate(s, 0.1)) this.noiseBurst(0.22, 0.09, 1800 * this.pitch, 5, 'bandpass'); break;
      case 'boulder': if (this.gate(s, 0.2)) { this.noiseBurst(0.6, 0.18, 220); this.tone('sine', 60, 45, 0.6, 0.15); } break;
      case 'bossRoar': if (this.gate(s, 0.8)) { const f = 80 * this.pitch; this.tone('sawtooth', f, f * 0.6, 0.9, 0.15); this.tone('square', f * 1.5, f * 0.7, 0.8, 0.06, 0.05); this.noiseBurst(0.9, 0.15, 400); } break;
      case 'phase': if (this.gate(s, 1)) { [220, 277, 330, 440].forEach((f, i) => this.tone('sawtooth', f * this.pitch, f * this.pitch * 1.02, 0.25, 0.08, i * 0.08)); this.noiseBurst(0.8, 0.2, 300); } break;
      case 'evolve': if (this.gate(s, 1)) { [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => this.tone('triangle', f, f, 0.35, 0.11, i * 0.07)); this.noiseBurst(1, 0.12, 4000, 1, 'highpass', 0.3); } break;
      case 'evoReady': if (this.gate(s, 1)) [880, 1175, 1568].forEach((f, i) => this.tone('sine', f, f * 1.01, 0.3, 0.1, i * 0.1)); break;
      case 'synergy': if (this.gate(s, 0.5)) [659, 880, 1109].forEach((f, i) => this.tone('square', f, f, 0.18, 0.05, i * 0.06)); break;
      case 'rare': if (this.gate(s, 0.3)) [988, 1319, 1976].forEach((f, i) => this.tone('triangle', f, f, 0.2, 0.08, i * 0.05)); break;
      case 'whoosh': if (this.gate(s, 0.08)) this.noiseBurst(0.18, 0.05, 1500, 0.7, 'bandpass'); break;
      case 'burn': if (this.gate(s, 0.25)) this.noiseBurst(0.3, 0.05, 900, 1, 'bandpass'); break;
      case 'block': if (this.gate(s, 0.1)) { this.tone('square', 1200, 900, 0.08, 0.06); this.noiseBurst(0.06, 0.1, 5000, 3, 'bandpass'); } break;
      case 'altar': if (this.gate(s, 1)) { this.tone('sawtooth', 55, 50, 1.2, 0.12); [330, 311, 294].forEach((f, i) => this.tone('triangle', f, f, 0.4, 0.08, 0.2 + i * 0.25)); } break;
      case 'gameover':
        if (this.gate(s, 1)) {
          [392, 349, 311, 262, 247].forEach((f, i) => this.tone('triangle', f, f * 0.98, i === 4 ? 1.2 : 0.45, 0.14, i * 0.3));
          [98, 87, 78, 65].forEach((f, i) => this.tone('sine', f, f, 0.6, 0.1, i * 0.3));
        }
        break;
    }
  }

  // ---------- Music ----------
  music(t: MusicTrack) {
    this.wanted = t;
    if (!this.ctx || this.track === t) return;
    this.track = t;
    this.step = 0;
    this.nextStepTime = this.ctx.currentTime + 0.1;
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this.track === 'none') return;
    const def = TRACKS[this.track];
    const stepDur = 60 / def.bpm / 4;
    while (this.nextStepTime < ctx.currentTime + 0.15) {
      try { this.playStep(def, this.step, this.nextStepTime, stepDur); } catch { /* ignore */ }
      this.step = (this.step + 1) % (def.bass.length * 4);
      this.nextStepTime += stepDur;
    }
  }

  private playStep(def: TrackDef, step: number, t: number, sd: number) {
    const ctx = this.ctx!;
    const bar = Math.floor(step / 16) % def.bass.length;
    const s16 = step % 16;
    const root = def.bass[bar];
    const note = (semi: number) => 55 * Math.pow(2, (root + semi) / 12);
    const voice = (type: OscillatorType, f: number, dur: number, vol: number, cutoff = 3000) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const fl = ctx.createBiquadFilter();
      fl.type = 'lowpass';
      fl.frequency.value = cutoff;
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(fl).connect(g).connect(this.musicBus);
      o.start(t);
      o.stop(t + dur + 0.02);
    };
    // bass
    if (def.bassPattern[s16]) voice('sawtooth', note(0) * (def.bassPattern[s16] === 2 ? 2 : 1), sd * 1.8, 0.12, 500);
    // arpeggio
    if (def.arp && s16 % def.arpEvery === 0) {
      const chord = def.minor ? [0, 3, 7, 12, 15] : [0, 4, 7, 12, 16];
      const n = chord[(step / def.arpEvery) % chord.length | 0];
      voice(def.lead, note(n) * 4, sd * 1.5, 0.045, 2600);
    }
    // pad on bar start
    if (s16 === 0 && def.pad) {
      const third = def.minor ? 3 : 4;
      [0, third, 7].forEach((n) => voice('triangle', note(n) * 2, sd * 15, 0.03, 1200));
    }
    // drums
    if (def.kick[s16]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.35, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g).connect(this.musicBus);
      o.start(t); o.stop(t + 0.2);
    }
    if (def.hat[s16] || def.snare[s16]) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      const snare = def.snare[s16];
      f.type = snare ? 'bandpass' : 'highpass';
      f.frequency.value = snare ? 1800 : 7000;
      g.gain.setValueAtTime(snare ? 0.16 : 0.035, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (snare ? 0.15 : 0.04));
      src.connect(f).connect(g).connect(this.musicBus);
      src.start(t, Math.random() * 0.5); src.stop(t + 0.2);
    }
  }
}

interface TrackDef {
  bpm: number; bass: number[]; bassPattern: number[]; kick: number[]; snare: number[]; hat: number[];
  arp: boolean; arpEvery: number; lead: OscillatorType; pad: boolean; minor: boolean;
}

const P = (s: string) => s.split('').map((c) => (c === 'x' ? 1 : c === 'o' ? 2 : 0));

const TRACKS: Record<Exclude<MusicTrack, 'none'>, TrackDef> = {
  menu: { bpm: 92, bass: [0, 5, 3, 7], bassPattern: P('x.......x.......'), kick: P('x.......x.......'), snare: P('................'),
    hat: P('....x.......x...'), arp: true, arpEvery: 2, lead: 'triangle', pad: true, minor: false },
  game0: { bpm: 128, bass: [0, 0, 5, 7], bassPattern: P('x.xox.x.x.xox.x.'), kick: P('x...x...x...x...'), snare: P('....x.......x...'),
    hat: P('..x...x...x...xx'), arp: true, arpEvery: 2, lead: 'square', pad: false, minor: false },
  game1: { bpm: 134, bass: [0, 3, 5, 3], bassPattern: P('x..xx..xx..xx.x.'), kick: P('x..x..x...x..x..'), snare: P('....x.......x...'),
    hat: P('x.x.x.x.x.x.x.x.'), arp: true, arpEvery: 2, lead: 'square', pad: false, minor: true },
  game2: { bpm: 140, bass: [0, 1, 0, -2], bassPattern: P('xoxoxoxoxoxoxoxo'), kick: P('x...x...x...x.x.'), snare: P('....x.......x..x'),
    hat: P('xxxxxxxxxxxxxxxx'), arp: false, arpEvery: 4, lead: 'sawtooth', pad: true, minor: true },
  boss: { bpm: 150, bass: [0, 1, 3, 1], bassPattern: P('xxoxxxoxxxoxxoxo'), kick: P('x.x.x.x.x.x.x.x.'), snare: P('....x.......x.x.'),
    hat: P('.x.x.x.x.x.x.x.x'), arp: true, arpEvery: 1, lead: 'sawtooth', pad: false, minor: true },
};

export const audio = new AudioManager();
