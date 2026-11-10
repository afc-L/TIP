// Procedural Web Audio: every sound is synthesised (no asset downloads), with distance attenuation and stereo panning.
const SHOT = {
  ar: { f: 1400, q: 0.8, dur: 0.18, thump: 120, vol: 0.55 },
  burst: { f: 1600, q: 0.9, dur: 0.14, thump: 130, vol: 0.5 },
  heavy: { f: 900, q: 0.7, dur: 0.25, thump: 90, vol: 0.65 },
  pump: { f: 700, q: 0.5, dur: 0.35, thump: 70, vol: 0.8 },
  tac: { f: 800, q: 0.6, dur: 0.28, thump: 80, vol: 0.7 },
  smg: { f: 2200, q: 1.0, dur: 0.09, thump: 160, vol: 0.38 },
  sniper: { f: 600, q: 0.5, dur: 0.7, thump: 60, vol: 0.9 },
  dmr: { f: 1000, q: 0.6, dur: 0.35, thump: 90, vol: 0.7 },
  pistol: { f: 1800, q: 1.0, dur: 0.12, thump: 150, vol: 0.42 },
  revolver: { f: 900, q: 0.6, dur: 0.3, thump: 80, vol: 0.7 },
  rocket: { f: 400, q: 0.4, dur: 0.6, thump: 50, vol: 0.7 },
  gl: { f: 500, q: 0.4, dur: 0.25, thump: 70, vol: 0.5 },
  minigun: { f: 2000, q: 1.0, dur: 0.07, thump: 140, vol: 0.32 },
  rail: { f: 3000, q: 4, dur: 0.5, thump: 200, vol: 0.6, zap: true },
};

export class Audio {
  constructor(game) {
    this.game = game;
    this.ctx = null;
    this.vol = { master: 0.8, sfx: 1, music: 0.5 };
    this.loops = {};
    this.lastStep = 0;
    this.count = 0;
  }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return; }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.connect(this.master);
    this.musicBus = c.createGain(); this.musicBus.connect(this.master);
    this.applyVolume();
    const len = c.sampleRate * 1.5;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // loops
    this.loops.storm = this._noiseLoop(180, 0.0);
    this.loops.wind = this._noiseLoop(700, 0.0);
    this.loops.engine = this._toneLoop(55, 'sawtooth', 0);
    this.loops.hum = this._toneLoop(440, 'sine', 0);
  }
  applyVolume() {
    if (!this.ctx) return;
    this.master.gain.value = this.vol.master;
    this.sfx.gain.value = this.vol.sfx;
    this.musicBus.gain.value = this.vol.music * 0.35;
  }
  _noiseLoop(freq, gain) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise; src.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = c.createGain(); g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(this.sfx);
    src.start();
    return { g, f };
  }
  _toneLoop(freq, type, gain) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
    const g = c.createGain(); g.gain.value = gain;
    const lfo = c.createOscillator(); lfo.frequency.value = 6;
    const lg = c.createGain(); lg.gain.value = 0;
    lfo.connect(lg); lg.connect(g.gain);
    o.connect(f); f.connect(g); g.connect(this.sfx);
    o.start(); lfo.start();
    return { g, o, f, lg };
  }
  setLoop(name, gain, freq) {
    const l = this.loops[name];
    if (!l) return;
    const t = this.ctx.currentTime;
    l.g.gain.setTargetAtTime(gain, t, 0.15);
    if (freq && l.f) l.f.frequency.setTargetAtTime(freq, t, 0.2);
  }

  // spatial helper -> {gain, pan} or null
  _spatial(pos, range = 140) {
    const cam = this.game.camera;
    if (!pos) return { gain: 1, pan: 0 };
    const dx = pos.x - cam.position.x, dy = (pos.y || 0) - cam.position.y, dz = pos.z - cam.position.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d > range) return null;
    const gain = 1 / (1 + d * d / 220);
    const yaw = this.game.playerCtl ? this.game.playerCtl.yaw : 0;
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const pan = d > 0.5 ? Math.max(-1, Math.min(1, (dx * rx + dz * rz) / d)) : 0;
    return { gain, pan, d };
  }
  _out(gain, pan) {
    const c = this.ctx;
    const g = c.createGain(); g.gain.value = gain;
    if (c.createStereoPanner) {
      const p = c.createStereoPanner(); p.pan.value = pan;
      g.connect(p); p.connect(this.sfx);
    } else g.connect(this.sfx);
    return g;
  }
  _env(node, t0, a, peak, dur) {
    node.gain.setValueAtTime(0.0001, t0);
    node.gain.exponentialRampToValueAtTime(peak, t0 + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  }
  _noiseHit(out, t, dur, type, freq, q, peak) {
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noise;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    s.connect(f); f.connect(g); g.connect(out);
    this._env(g, t, 0.003, peak, dur);
    s.start(t, Math.random() * 0.5, dur + 0.05);
  }
  _tone(out, t, dur, type, f0, f1, peak) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    o.connect(g); g.connect(out);
    this._env(g, t, 0.005, peak, dur);
    o.start(t); o.stop(t + dur + 0.05);
  }
  _budget() {
    // cap concurrent one-shots for performance
    const now = this.ctx.currentTime;
    if (now - (this._bt || 0) > 0.1) { this._bt = now; this._bc = 0; }
    return ++this._bc < 14;
  }

  shot(type, pos, isPlayer) {
    if (!this.ctx || !this._budget()) return;
    const s = SHOT[type] || SHOT.ar;
    const sp = this._spatial(pos, 320);
    if (!sp) return;
    const far = sp.d > 40;
    const out = this._out(s.vol * (isPlayer ? 0.9 : Math.max(0.12, sp.gain * 1.6)), sp.pan);
    const t = this.ctx.currentTime;
    this._noiseHit(out, t, s.dur * (far ? 1.5 : 1), far ? 'lowpass' : 'bandpass', far ? 700 : s.f, s.q, 0.9);
    this._tone(out, t, s.dur * 0.8, 'sine', s.thump * 1.6, s.thump * 0.5, far ? 0.3 : 0.8);
    if (s.zap) this._tone(out, t, 0.4, 'sawtooth', 2400, 300, 0.25);
  }

  footstep(actor, swim) {
    if (!this.ctx) return;
    const sp = this._spatial(actor.pos, 40);
    if (!sp) return;
    const out = this._out(sp.gain * (actor === this.game.player ? 0.25 : 0.6), sp.pan);
    const t = this.ctx.currentTime;
    if (swim) this._noiseHit(out, t, 0.25, 'lowpass', 600, 0.5, 0.5);
    else this._noiseHit(out, t, 0.06, 'bandpass', 900 + Math.random() * 400, 1.2, 0.6);
  }

  playAt(name, pos, vol = 0.6) {
    if (!this.ctx || !this._budget()) return;
    const sp = this._spatial(pos, name === 'explosion' ? 350 : 90);
    if (!sp) return;
    this._play(name, this._out(vol * sp.gain * 1.4, sp.pan));
  }
  ui(name, vol = 0.6) {
    if (!this.ctx) return;
    this._play(name, this._out(vol, 0));
  }
  _play(name, out) {
    const t = this.ctx.currentTime;
    switch (name) {
      case 'reload': this._noiseHit(out, t, 0.04, 'highpass', 2000, 1, 0.5); this._noiseHit(out, t + 0.25, 0.05, 'highpass', 1600, 1, 0.6); break;
      case 'empty': this._tone(out, t, 0.04, 'square', 1800, 0, 0.2); break;
      case 'build': this._tone(out, t, 0.09, 'triangle', 220, 120, 0.7); this._noiseHit(out, t, 0.05, 'bandpass', 1200, 2, 0.4); break;
      case 'edit': this._tone(out, t, 0.06, 'square', 600, 900, 0.25); break;
      case 'break_wood': this._noiseHit(out, t, 0.35, 'lowpass', 900, 0.7, 0.9); this._tone(out, t, 0.2, 'triangle', 140, 60, 0.5); break;
      case 'break_stone': this._noiseHit(out, t, 0.45, 'lowpass', 500, 0.7, 1); break;
      case 'break_metal': this._noiseHit(out, t, 0.3, 'bandpass', 1800, 3, 0.7); this._tone(out, t, 0.5, 'square', 420, 300, 0.2); break;
      case 'glass': this._noiseHit(out, t, 0.3, 'highpass', 4000, 1, 0.7); this._tone(out, t, 0.2, 'sine', 3200, 2000, 0.2); break;
      case 'harvest_wood': this._tone(out, t, 0.08, 'triangle', 320, 180, 0.6); this._noiseHit(out, t, 0.05, 'bandpass', 1500, 2, 0.4); break;
      case 'harvest_stone': this._noiseHit(out, t, 0.08, 'bandpass', 2500, 3, 0.7); this._tone(out, t, 0.06, 'square', 800, 600, 0.15); break;
      case 'harvest_metal': this._tone(out, t, 0.25, 'square', 900, 850, 0.2); this._noiseHit(out, t, 0.05, 'highpass', 3000, 1, 0.4); break;
      case 'harvest_glass': this._noiseHit(out, t, 0.2, 'highpass', 4000, 1, 0.5); break;
      case 'chestOpen': [523, 659, 784, 1046].forEach((f, i) => this._tone(out, t + i * 0.07, 0.25, 'sine', f, 0, 0.35)); break;
      case 'pickup': this._tone(out, t, 0.08, 'sine', 600, 1200, 0.35); break;
      case 'heal': [440, 554, 659].forEach((f, i) => this._tone(out, t + i * 0.06, 0.2, 'sine', f, 0, 0.3)); break;
      case 'shield': [660, 880, 1320].forEach((f, i) => this._tone(out, t + i * 0.05, 0.25, 'triangle', f, f * 1.05, 0.25)); break;
      case 'useStart': this._tone(out, t, 0.1, 'sine', 300, 500, 0.2); break;
      case 'explosion': this._noiseHit(out, t, 1.3, 'lowpass', 400, 0.5, 1); this._tone(out, t, 0.8, 'sine', 90, 30, 0.9); break;
      case 'land': this._noiseHit(out, t, 0.12, 'lowpass', 400, 0.7, 0.6); break;
      case 'mantle': this._noiseHit(out, t, 0.1, 'bandpass', 700, 1, 0.4); break;
      case 'slide': this._noiseHit(out, t, 0.4, 'bandpass', 500, 0.5, 0.4); break;
      case 'swing': this._noiseHit(out, t, 0.12, 'bandpass', 1200, 0.6, 0.25); break;
      case 'throw': this._noiseHit(out, t, 0.15, 'bandpass', 900, 0.6, 0.3); break;
      case 'bounce': this._tone(out, t, 0.05, 'square', 500, 300, 0.2); break;
      case 'glider': this._noiseHit(out, t, 0.6, 'bandpass', 600, 0.4, 0.6); break;
      case 'hit': this._tone(out, t, 0.05, 'square', 1800, 1400, 0.2); break;
      case 'headshot': this._tone(out, t, 0.25, 'sine', 1500, 1400, 0.45); this._tone(out, t, 0.05, 'square', 2200, 0, 0.15); break;
      case 'shieldhit': this._tone(out, t, 0.06, 'triangle', 2400, 1800, 0.3); break;
      case 'shieldbreak': this._noiseHit(out, t, 0.3, 'highpass', 3000, 1, 0.6); this._tone(out, t, 0.3, 'sine', 1600, 400, 0.3); break;
      case 'hurt': this._tone(out, t, 0.15, 'sawtooth', 160, 90, 0.4); break;
      case 'elim': [523, 784, 1046].forEach((f, i) => this._tone(out, t + i * 0.08, 0.3, 'triangle', f, 0, 0.4)); break;
      case 'death': [400, 300, 200, 120].forEach((f, i) => this._tone(out, t + i * 0.15, 0.3, 'sawtooth', f, f * 0.9, 0.3)); break;
      case 'victory': [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this._tone(out, t + i * 0.14, 0.35, i % 2 ? 'triangle' : 'square', f, 0, 0.25)); break;
      case 'click': this._tone(out, t, 0.04, 'square', 900, 600, 0.12); break;
      case 'hover': this._tone(out, t, 0.03, 'sine', 1200, 0, 0.06); break;
      case 'levelup': [392, 523, 659, 784, 1046].forEach((f, i) => this._tone(out, t + i * 0.09, 0.3, 'triangle', f, 0, 0.3)); break;
      case 'alert': this._tone(out, t, 0.3, 'sine', 880, 660, 0.3); this._tone(out, t + 0.35, 0.3, 'sine', 880, 660, 0.3); break;
      case 'jump': this._noiseHit(out, t, 0.5, 'bandpass', 500, 0.4, 0.4); break;
      default: break;
    }
  }

  // simple looping lobby music
  startMusic() {
    if (!this.ctx || this.musicT) return;
    const notes = [261.6, 329.6, 392, 523.3, 392, 329.6, 293.7, 349.2, 440, 587.3, 440, 349.2];
    const bass = [130.8, 130.8, 146.8, 146.8];
    let i = 0;
    const step = () => {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const out = this.musicBus;
      this._tone(out, t, 0.32, 'triangle', notes[i % notes.length], 0, 0.25);
      if (i % 3 === 0) this._tone(out, t, 0.9, 'sine', bass[Math.floor(i / 3) % bass.length], 0, 0.35);
      i++;
    };
    this.musicT = setInterval(step, 300);
  }
  stopMusic() { clearInterval(this.musicT); this.musicT = null; }
}
