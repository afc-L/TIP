// Procedural sound effects built on the Web Audio API. No audio files.

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.6;
    this.muted = false;
    this.last = Object.create(null);
  }

  // Must be called from a user gesture (browser autoplay rules).
  init() {
    if (this.ctx) { this.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    this.master.connect(comp);
    comp.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolume();
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }

  setVolume(v) { this.volume = v; this.applyVolume(); }
  setMuted(m) { this.muted = m; this.applyVolume(); }
  applyVolume() {
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume * 0.55;
  }

  throttle(name, ms) {
    const t = performance.now();
    if (this.last[name] !== undefined && t - this.last[name] < ms) return false;
    this.last[name] = t;
    return true;
  }

  tone(type, f0, f1, dur, vol, delay = 0, attack = 0.004) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur, vol, type, f0, f1, delay = 0, q = 1) {
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  play(name) {
    if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
    const r = 1 + (Math.random() - 0.5) * 0.12;
    switch (name) {
      case 'shoot':
        if (!this.throttle(name, 55)) return;
        this.tone('square', 880 * r, 330 * r, 0.08, 0.05);
        this.tone('sine', 1500 * r, 700, 0.05, 0.03);
        break;
      case 'orb':
        if (!this.throttle(name, 100)) return;
        this.tone('sine', 180, 90, 0.35, 0.16);
        this.tone('triangle', 420 * r, 140, 0.3, 0.06);
        break;
      case 'arc':
        if (!this.throttle(name, 100)) return;
        this.noise(0.25, 0.22, 'bandpass', 3200, 900, 0, 2);
        this.tone('sawtooth', 220 * r, 70, 0.2, 0.07);
        break;
      case 'hit':
        if (!this.throttle(name, 40)) return;
        this.noise(0.06, 0.14, 'highpass', 2400 * r, 1200, 0, 0.7);
        break;
      case 'crit':
        if (!this.throttle(name, 70)) return;
        this.tone('square', 1300 * r, 2000, 0.06, 0.05);
        this.noise(0.08, 0.15, 'highpass', 3000, 1600);
        break;
      case 'death':
        if (!this.throttle(name, 45)) return;
        this.noise(0.18, 0.18, 'lowpass', 1800 * r, 200);
        this.tone('triangle', 300 * r, 80, 0.15, 0.07);
        break;
      case 'xp':
        if (!this.throttle(name, 45)) return;
        this.tone('sine', 1200 + Math.random() * 500, 1900, 0.07, 0.045);
        break;
      case 'heal':
        this.tone('sine', 520, 1040, 0.3, 0.1);
        this.tone('sine', 780, 1560, 0.3, 0.07, 0.08);
        break;
      case 'levelup':
        [523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, 0.22, 0.11, i * 0.07));
        this.tone('sine', 2093, 2093, 0.4, 0.04, 0.28);
        break;
      case 'select':
        this.tone('triangle', 660, 990, 0.12, 0.1);
        break;
      case 'click':
        if (!this.throttle(name, 40)) return;
        this.tone('triangle', 500, 640, 0.05, 0.06);
        break;
      case 'dash':
        this.noise(0.2, 0.2, 'bandpass', 600, 2600, 0, 1.5);
        break;
      case 'pulse':
        this.tone('sine', 120, 40, 0.5, 0.25);
        this.noise(0.4, 0.2, 'lowpass', 2400, 300);
        break;
      case 'hurt':
        if (!this.throttle(name, 120)) return;
        this.tone('sawtooth', 160, 60, 0.22, 0.16);
        this.noise(0.15, 0.2, 'lowpass', 900, 200);
        break;
      case 'shield':
        if (!this.throttle(name, 120)) return;
        this.tone('sine', 900, 500, 0.15, 0.1);
        break;
      case 'explode':
        if (!this.throttle(name, 70)) return;
        this.noise(0.35, 0.28, 'lowpass', 1400 * r, 90);
        this.tone('sine', 110, 40, 0.3, 0.16);
        break;
      case 'zap':
        if (!this.throttle(name, 80)) return;
        this.noise(0.12, 0.16, 'bandpass', 4000 * r, 1500, 0, 4);
        this.tone('square', 1800 * r, 600, 0.08, 0.035);
        break;
      case 'enemyShot':
        if (!this.throttle(name, 90)) return;
        this.tone('sine', 420 * r, 220, 0.12, 0.05);
        break;
      case 'windup':
        if (!this.throttle(name, 150)) return;
        this.tone('sawtooth', 90, 180, 0.35, 0.04);
        break;
      case 'slam':
        if (!this.throttle(name, 100)) return;
        this.noise(0.4, 0.3, 'lowpass', 700, 60);
        this.tone('sine', 80, 30, 0.4, 0.25);
        break;
      case 'spawnElite':
        this.tone('sawtooth', 110, 220, 0.6, 0.08);
        this.tone('sawtooth', 165, 330, 0.6, 0.06, 0.05);
        break;
      case 'bossRoar':
        this.tone('sawtooth', 70, 40, 1.4, 0.2);
        this.tone('square', 105, 52, 1.2, 0.08, 0.05);
        this.noise(1.3, 0.25, 'lowpass', 600, 120);
        break;
      case 'bossShot':
        if (!this.throttle(name, 120)) return;
        this.tone('triangle', 300, 120, 0.3, 0.12);
        this.noise(0.2, 0.1, 'bandpass', 1200, 400, 0, 2);
        break;
      case 'warning':
        if (!this.throttle(name, 200)) return;
        this.tone('square', 440, 440, 0.12, 0.04);
        this.tone('square', 440, 440, 0.12, 0.04, 0.16);
        break;
      case 'synergy':
        [392, 523, 659, 784, 1047].forEach((f, i) => this.tone('sine', f, f * 1.01, 0.3, 0.08, i * 0.05));
        break;
      case 'waveStart':
        this.tone('triangle', 220, 440, 0.4, 0.1);
        this.tone('triangle', 330, 660, 0.4, 0.07, 0.1);
        break;
      case 'waveClear':
        [659, 784, 988].forEach((f, i) => this.tone('triangle', f, f, 0.25, 0.1, i * 0.09));
        break;
      case 'victory':
        [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone('triangle', f, f, 0.35, 0.12, i * 0.13));
        break;
      case 'clank':
        if (!this.throttle(name, 90)) return;
        this.tone('square', 1900 * r, 1200, 0.06, 0.05);
        this.noise(0.1, 0.12, 'highpass', 4000, 3000, 0, 1);
        break;
      case 'blink':
        if (!this.throttle(name, 120)) return;
        this.tone('sine', 300, 1200, 0.18, 0.06);
        break;
      case 'slash':
        if (!this.throttle(name, 70)) return;
        this.noise(0.12, 0.18, 'bandpass', 1800 * r, 5000, 0, 1.2);
        break;
      case 'coin':
        if (!this.throttle(name, 60)) return;
        this.tone('square', 1320, 1320, 0.05, 0.03);
        this.tone('square', 1760, 1760, 0.08, 0.03, 0.05);
        break;
      case 'gameover':
        [392, 330, 262, 196].forEach((f, i) => this.tone('triangle', f, f * 0.98, 0.45, 0.12, i * 0.2));
        break;
    }
  }
}
