// Procedural WebAudio sound effects — no asset files needed.
import { clamp, rand } from './util.js';

export class Audio {
  constructor(game) {
    this.game = game;
    this.ctx = null;
    this.enabled = true;
    this.lastPlay = new Map();
  }

  /** Must be called from a user gesture. */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6;
    this.master.connect(comp).connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.whooshes = new Map();
  }

  ok(key, gap = 0.03) {
    if (!this.ctx || !this.enabled) return false;
    const t = this.ctx.currentTime;
    const last = this.lastPlay.get(key) || 0;
    if (t - last < gap) return false;
    this.lastPlay.set(key, t);
    return true;
  }

  /** distance attenuation relative to the camera */
  vol(pos, base) {
    const cam = this.game.camera.position;
    const d = pos ? Math.hypot(pos.x - cam.x, pos.y - cam.y, pos.z - cam.z) : 2;
    return base / (1 + Math.max(0, d - 2) * 0.25);
  }

  out(gainValue, pos) {
    const g = this.ctx.createGain();
    g.gain.value = gainValue;
    if (pos && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      const cam = this.game.camera;
      const dx = pos.x - cam.position.x, dz = pos.z - cam.position.z;
      const yaw = this.game.cameraYaw || 0;
      const side = -(dx * Math.cos(yaw) - dz * Math.sin(yaw));
      p.pan.value = clamp(side * 0.3, -0.8, 0.8);
      g.connect(p).connect(this.master);
    } else g.connect(this.master);
    return g;
  }

  noiseSrc(t, dur) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.start(t, Math.random() * 1.5, dur);
    return s;
  }

  env(g, t, attack, peak, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  clang(pos, speed) {
    if (!this.ok('clang', 0.04)) return;
    const t = this.ctx.currentTime;
    const v = this.vol(pos, clamp(speed / 12, 0.08, 1));
    const out = this.out(v, pos);
    const base = rand(850, 1500);
    for (const [ratio, amp, dec] of [[1, 0.5, 1.1], [2.76, 0.32, 0.8], [5.4, 0.2, 0.5], [8.93, 0.12, 0.3], [1.5, 0.2, 0.6]]) {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = base * ratio * rand(0.99, 1.01);
      const g = this.ctx.createGain();
      this.env(g, t, 0.002, amp, dec * rand(0.7, 1.2));
      o.connect(g).connect(out);
      o.start(t); o.stop(t + 1.5);
    }
    const n = this.noiseSrc(t, 0.08);
    const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
    const ng = this.ctx.createGain(); this.env(ng, t, 0.001, 0.6, 0.06);
    n.connect(hp).connect(ng).connect(out);
  }

  armor(pos, speed, type) {
    if (!this.ok('armor', 0.04)) return;
    const t = this.ctx.currentTime;
    const out = this.out(this.vol(pos, clamp(speed / 10, 0.1, 1)), pos);
    const base = type === 'plate' ? rand(380, 620) : rand(1800, 2600);
    for (const [ratio, amp, dec] of [[1, 0.45, 0.35], [2.3, 0.25, 0.25], [4.1, 0.15, 0.15]]) {
      const o = this.ctx.createOscillator();
      o.type = type === 'plate' ? 'triangle' : 'square';
      o.frequency.value = base * ratio;
      const g = this.ctx.createGain();
      this.env(g, t, 0.002, amp * (type === 'plate' ? 1 : 0.15), dec);
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.6);
    }
    this.thud(pos, speed * 0.5, false, out);
  }

  thud(pos, intensity, ground = false, outNode) {
    if (!outNode && !this.ok('thud', 0.05)) return;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const out = outNode || this.out(this.vol(pos, clamp(intensity / 6, 0.05, 0.8)), pos);
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(ground ? 140 : 110, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.15);
    const g = this.ctx.createGain(); this.env(g, t, 0.003, 0.7, 0.18);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.3);
    const n = this.noiseSrc(t, 0.12);
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = ground ? 1800 : 700;
    const ng = this.ctx.createGain(); this.env(ng, t, 0.002, 0.5, 0.1);
    n.connect(lp).connect(ng).connect(out);
  }

  flesh(pos, dmg) {
    if (!this.ok('flesh', 0.03)) return;
    const t = this.ctx.currentTime;
    const out = this.out(this.vol(pos, clamp(0.25 + dmg / 30, 0.2, 1)), pos);
    this.thud(pos, 4, false, out);
    // wet squelch: band-passed noise with a falling centre frequency
    const n = this.noiseSrc(t, 0.35);
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 3;
    bp.frequency.setValueAtTime(rand(1400, 2200), t);
    bp.frequency.exponentialRampToValueAtTime(300, t + 0.25);
    const g = this.ctx.createGain(); this.env(g, t, 0.004, 0.9, 0.25);
    n.connect(bp).connect(g).connect(out);
  }

  sever(pos) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const out = this.out(this.vol(pos, 1), pos);
    for (let i = 0; i < 4; i++) {
      const n = this.noiseSrc(t + i * 0.03, 0.05);
      const hp = this.ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = rand(1200, 3500); hp.Q.value = 2;
      const g = this.ctx.createGain(); this.env(g, t + i * 0.03, 0.001, 0.8, 0.04);
      n.connect(hp).connect(g).connect(out);
    }
    const n = this.noiseSrc(t, 0.9);
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 4;
    bp.frequency.setValueAtTime(900, t); bp.frequency.exponentialRampToValueAtTime(180, t + 0.8);
    const g = this.ctx.createGain(); this.env(g, t, 0.01, 0.9, 0.8);
    n.connect(bp).connect(g).connect(out);
  }

  /** A short formant-filtered vocal grunt. */
  pain(fighter, dmg) {
    if (!this.ok('pain' + fighter.index, 0.5)) return;
    const t = this.ctx.currentTime;
    const pos = fighter.parts.head.p;
    const out = this.out(this.vol(pos, clamp(0.3 + dmg / 40, 0.3, 0.9)), pos);
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    const f0 = rand(95, 150) * (dmg > 25 ? 1.5 : 1);
    o.frequency.setValueAtTime(f0 * 1.3, t);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.75, t + 0.35);
    const g = this.ctx.createGain(); this.env(g, t, 0.02, 0.5, dmg > 25 ? 0.6 : 0.28);
    const mix = this.ctx.createGain(); mix.gain.value = 1;
    for (const [f, q] of [[rand(600, 800), 6], [rand(1000, 1300), 8], [2500, 10]]) {
      const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
      o.connect(bp).connect(mix);
    }
    mix.connect(g).connect(out);
    o.start(t); o.stop(t + 1);
  }

  grab(pos) {
    if (!this.ok('grab', 0.1)) return;
    this.thud(pos, 2);
  }

  /** Continuous swing whoosh per weapon, driven by blade speed. */
  updateWhoosh(fighters) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const seen = new Set();
    for (const f of fighters) {
      if (!f.weapon) continue;
      seen.add(f);
      let w = this.whooshes.get(f);
      if (!w) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noise; src.loop = true;
        const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.6;
        const g = this.ctx.createGain(); g.gain.value = 0;
        src.connect(bp).connect(g).connect(this.master);
        src.start();
        w = { src, bp, g };
        this.whooshes.set(f, w);
      }
      const s = f.weapon.dropped ? 0 : f.swingSpeed || 0;
      const amt = clamp((s - 4) / 12, 0, 1);
      w.g.gain.setTargetAtTime(this.vol(f.parts.pelvis.p, amt * amt * 0.35), t, 0.03);
      w.bp.frequency.setTargetAtTime(300 + s * 70, t, 0.03);
    }
    for (const [f, w] of this.whooshes) {
      if (!seen.has(f)) { w.src.stop(); w.g.disconnect(); this.whooshes.delete(f); }
    }
  }
}
