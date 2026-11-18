// Procedural audio engine. Every sound in THE HOLLOW is synthesised with WebAudio at
// runtime (no samples): footsteps per surface, formant-synthesised voices, whispers,
// screams, weather beds, machinery, the monster's breathing and roar. Sounds are placed
// in 3D with HRTF panners so the player can localise them — and so fake sounds placed by
// the hallucination system are indistinguishable from real ones.
import { rand, pick, clamp } from '../core/util.js';

const VOWELS = {
  a: [800, 1150, 2900], e: [400, 2000, 2550], i: [300, 2300, 3000], o: [450, 800, 2830], u: [325, 700, 2530],
  ae: [660, 1700, 2400], uh: [600, 1200, 2500], er: [500, 1350, 1700],
};
const VK = Object.keys(VOWELS);

export class AudioEngine {
  constructor() {
    this.ctx = null; this.ready = false;
    this.volumes = { master: 0.9, sfx: 1, amb: 0.8, voice: 1, music: 0.6 };
    this.loops = new Map();
    this.activeVoices = 0;
    this.duckValue = 1;
  }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = this.volumes.master;
    this.comp = ctx.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 4;
    this.master.connect(this.comp).connect(ctx.destination);
    this.bus = {};
    for (const k of ['sfx', 'amb', 'voice', 'music']) { const g = ctx.createGain(); g.gain.value = this.volumes[k]; g.connect(this.master); this.bus[k] = g; }
    // global ducking for "unnatural silence" moments (affects ambience + music)
    this.duck = ctx.createGain(); this.duck.connect(this.bus.amb);
    // reverb send
    this.reverb = ctx.createConvolver(); this.reverbGain = ctx.createGain(); this.reverbGain.gain.value = 0.35;
    this.reverb.connect(this.reverbGain).connect(this.master);
    this.setReverb(2.2, 2.5);
    // noise buffers
    const sr = ctx.sampleRate, len = sr * 3;
    this.white = ctx.createBuffer(1, len, sr); this.pink = ctx.createBuffer(1, len, sr); this.brown = ctx.createBuffer(1, len, sr);
    const w = this.white.getChannelData(0), p = this.pink.getChannelData(0), b = this.brown.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const x = Math.random() * 2 - 1; w[i] = x;
      b0 = 0.99886 * b0 + x * 0.0555179; b1 = 0.99332 * b1 + x * 0.0750759; b2 = 0.969 * b2 + x * 0.153852; b3 = 0.8665 * b3 + x * 0.3104856; b4 = 0.55 * b4 + x * 0.5329522; b5 = -0.7616 * b5 - x * 0.016898;
      p[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362) * 0.11; b6 = x * 0.115926;
      last = (last + 0.02 * x) / 1.02; b[i] = last * 3.5;
    }
    // distortion curve
    this.curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; this.curve[i] = Math.tanh(x * 4); }
    this.ready = true;
  }
  setVolume(k, v) { this.volumes[k] = v; if (!this.ready) return; if (k === 'master') this.master.gain.value = v; else this.bus[k].gain.value = v; }
  setReverb(seconds, decay, dark = false) {
    if (!this.ctx) return;
    const sr = this.ctx.sampleRate, len = Math.floor(sr * seconds);
    const buf = this.ctx.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c); let lp = 0;
      for (let i = 0; i < len; i++) { const x = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); lp = dark ? lp * 0.7 + x * 0.3 : x; d[i] = lp; }
    }
    this.reverb.buffer = buf;
  }
  setReverbMix(v) { if (this.reverbGain) this.reverbGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.5); }

  setListener(pos, fwd, up) {
    if (!this.ready) return;
    const L = this.ctx.listener, t = this.ctx.currentTime;
    if (L.positionX) {
      L.positionX.setTargetAtTime(pos.x, t, 0.02); L.positionY.setTargetAtTime(pos.y, t, 0.02); L.positionZ.setTargetAtTime(pos.z, t, 0.02);
      L.forwardX.setTargetAtTime(fwd.x, t, 0.02); L.forwardY.setTargetAtTime(fwd.y, t, 0.02); L.forwardZ.setTargetAtTime(fwd.z, t, 0.02);
      L.upX.value = up.x; L.upY.value = up.y; L.upZ.value = up.z;
    } else { L.setPosition(pos.x, pos.y, pos.z); L.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z); }
    this.listenerPos = pos;
  }

  // Output chain for a sound: optional 3D panner -> bus (+ reverb send)
  out(pos, bus = 'sfx', { vol = 1, ref = 3, rolloff = 1.2, max = 120, reverb = 0.3, muffle = 0 } = {}) {
    const ctx = this.ctx;
    const g = ctx.createGain(); g.gain.value = vol;
    let tail = g;
    if (muffle > 0) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 18000 * Math.pow(1 - muffle, 3) + 300; g.connect(lp); tail = lp; }
    if (pos) {
      const p = ctx.createPanner();
      p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = ref; p.rolloffFactor = rolloff; p.maxDistance = max;
      if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y, pos.z);
      tail.connect(p); tail = p;
    }
    tail.connect(this.bus[bus]);
    if (reverb > 0) { const s = ctx.createGain(); s.gain.value = reverb; tail.connect(s); s.connect(this.reverb); }
    return g;
  }

  noiseSrc(type = 'white', loop = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = type === 'pink' ? this.pink : type === 'brown' ? this.brown : this.white;
    s.loop = loop; if (!loop) s.loopStart = 0;
    return s;
  }
  filt(type, f, q = 1) { const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
  env(g, t0, a, peak, d, end = 0.0001) { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(end, t0 + a + d); }
  osc(type, f) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; }
  shaper() { const s = this.ctx.createWaveShaper(); s.curve = this.curve; return s; }

  // Public: one-shot by name.
  play(name, pos = null, opts = {}) {
    if (!this.ready) return 0;
    const fn = this['s_' + name];
    if (!fn) { console.warn('no sound', name); return 0; }
    try { return fn.call(this, pos, opts) || 0; } catch (e) { console.warn('sound error', name, e); return 0; }
  }

  // ---------------- one-shots ----------------
  s_step(pos, { surface = 'concrete', heavy = 1, vol = 1, bus = 'sfx' } = {}) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = this.out(pos, bus, { vol: vol * (0.6 + rand(0, 0.3)), ref: heavy > 1 ? 5 : 2.5, reverb: 0.2 });
    const presets = {
      grass: { f: 2600, q: 0.6, d: 0.14, type: 'highpass', thump: 0.25 },
      leaves: { f: 3000, q: 0.5, d: 0.22, type: 'highpass', thump: 0.25 },
      dirt: { f: 900, q: 0.8, d: 0.1, type: 'bandpass', thump: 0.4 },
      concrete: { f: 1800, q: 1.5, d: 0.05, type: 'bandpass', thump: 0.5 },
      asphalt: { f: 1500, q: 1.2, d: 0.06, type: 'bandpass', thump: 0.5 },
      wood: { f: 500, q: 3, d: 0.1, type: 'bandpass', thump: 0.8 },
      tile: { f: 3200, q: 3, d: 0.04, type: 'bandpass', thump: 0.4 },
      metal: { f: 1200, q: 18, d: 0.35, type: 'bandpass', thump: 0.6 },
      water: { f: 1400, q: 0.7, d: 0.3, type: 'bandpass', thump: 0.2 },
      carpet: { f: 400, q: 0.7, d: 0.06, type: 'lowpass', thump: 0.3 },
      void: { f: 200, q: 6, d: 0.6, type: 'bandpass', thump: 0.9 },
      flesh: { f: 300, q: 2, d: 0.2, type: 'lowpass', thump: 0.7 },
    };
    const P = presets[surface] || presets.concrete;
    const n = this.noiseSrc(); const f = this.filt(P.type, P.f * rand(0.85, 1.15), P.q); const g = ctx.createGain();
    n.connect(f).connect(g).connect(o); this.env(g, t, 0.005, 0.7, P.d * (0.8 + heavy * 0.3));
    n.start(t, rand(0, 2)); n.stop(t + 0.6);
    if (heavy > 0.5) {
      const s = this.osc('sine', 55 * rand(0.9, 1.1) + (heavy > 1 ? 0 : 30)); const sg = ctx.createGain();
      s.frequency.exponentialRampToValueAtTime(30, t + 0.15);
      s.connect(sg).connect(o); this.env(sg, t, 0.004, P.thump * heavy * 0.9, 0.18); s.start(t); s.stop(t + 0.3);
    }
    if (surface === 'water') { const s = this.osc('sine', rand(600, 1100)); const sg = ctx.createGain(); s.frequency.exponentialRampToValueAtTime(rand(1500, 2200), t + 0.08); s.connect(sg).connect(o); this.env(sg, t + 0.03, 0.005, 0.12, 0.06); s.start(t); s.stop(t + 0.2); }
    return 0.4;
  }

  s_breath(pos, { vol = 0.5, inhale = true, intensity = 1 } = {}) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = this.out(pos, 'sfx', { vol, ref: 2, reverb: 0.15 });
    const n = this.noiseSrc('pink'); const f = this.filt('bandpass', inhale ? 1200 : 700, 1.2); const g = ctx.createGain();
    f.frequency.setValueAtTime(inhale ? 900 : 1100, t); f.frequency.linearRampToValueAtTime(inhale ? 1600 : 500, t + 1);
    n.connect(f).connect(g).connect(o);
    const dur = (inhale ? 0.9 : 1.3) / Math.sqrt(intensity);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.35 * intensity, t + dur * 0.4); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    n.start(t, rand(0, 2)); n.stop(t + dur + 0.1);
    if (!inhale) { // a low, wet rattle under the exhale
      const s = this.osc('sawtooth', rand(42, 55)); const lp = this.filt('lowpass', 260, 4); const sg = ctx.createGain();
      const am = this.osc('sine', rand(18, 26)); const amg = ctx.createGain(); amg.gain.value = 0.5; am.connect(amg).connect(sg.gain);
      s.connect(lp).connect(sg).connect(o); sg.gain.setValueAtTime(0.0001, t); sg.gain.linearRampToValueAtTime(0.25 * intensity, t + dur * 0.3); sg.gain.linearRampToValueAtTime(0.0001, t + dur);
      s.start(t); am.start(t); s.stop(t + dur + 0.1); am.stop(t + dur + 0.1);
    }
    return dur;
  }

  s_growl(pos, { vol = 0.7, dur = 1.4, pitch = 1 } = {}) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = this.out(pos, 'sfx', { vol, ref: 4, reverb: 0.35 });
    const s = this.osc('sawtooth', 48 * pitch); const s2 = this.osc('sawtooth', 73 * pitch);
    const lp = this.filt('lowpass', 500, 3); const bp = this.filt('bandpass', 700, 2); const g = ctx.createGain(); const sh = this.shaper();
    const am = this.osc('square', rand(22, 32)); const amg = ctx.createGain(); amg.gain.value = 0.4; am.connect(amg).connect(g.gain);
    s.connect(lp); s2.connect(lp); lp.connect(sh).connect(bp).connect(g).connect(o);
    lp.frequency.setValueAtTime(300, t); lp.frequency.linearRampToValueAtTime(900, t + dur * 0.4); lp.frequency.linearRampToValueAtTime(250, t + dur);
    s.frequency.linearRampToValueAtTime(40 * pitch, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.6, t + 0.2); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    [s, s2, am].forEach((x) => { x.start(t); x.stop(t + dur + 0.1); });
    const n = this.noiseSrc(); const nf = this.filt('bandpass', 400, 1); const ng = ctx.createGain(); n.connect(nf).connect(ng).connect(o);
    ng.gain.setValueAtTime(0.0001, t); ng.gain.linearRampToValueAtTime(0.3, t + 0.2); ng.gain.linearRampToValueAtTime(0.0001, t + dur); n.start(t, rand(0, 2)); n.stop(t + dur);
    return dur;
  }

  s_roar(pos, { vol = 1.2 } = {}) {
    const ctx = this.ctx, t = ctx.currentTime, dur = 2.8;
    const o = this.out(pos, 'sfx', { vol, ref: 8, reverb: 0.8, rolloff: 0.6 });
    const sh = this.shaper(); const formants = [[420, 4], [1100, 5], [2400, 6]].map(([f, q]) => { const b = this.filt('bandpass', f, q); b.connect(o); return b; });
    const mix = ctx.createGain(); mix.connect(sh); formants.forEach((b) => sh.connect(b));
    const g = ctx.createGain(); g.connect(o); sh.connect(g); g.gain.value = 0.3;
    const oscs = [55, 82, 110, 164].map((f) => { const x = this.osc('sawtooth', f * rand(0.97, 1.03)); x.frequency.setValueAtTime(f * 0.8, t); x.frequency.linearRampToValueAtTime(f * 1.15, t + 0.5); x.frequency.linearRampToValueAtTime(f * 0.7, t + dur); x.connect(mix); return x; });
    mix.gain.setValueAtTime(0.0001, t); mix.gain.linearRampToValueAtTime(0.7, t + 0.25); mix.gain.setValueAtTime(0.7, t + 1.6); mix.gain.linearRampToValueAtTime(0.0001, t + dur);
    const n = this.noiseSrc(); const nf = this.filt('bandpass', 900, 0.8); const ng = ctx.createGain(); n.connect(nf).connect(ng).connect(sh);
    ng.gain.setValueAtTime(0.0001, t); ng.gain.linearRampToValueAtTime(0.8, t + 0.2); ng.gain.linearRampToValueAtTime(0.0001, t + dur);
    const vib = this.osc('sine', 7); const vg = ctx.createGain(); vg.gain.value = 6; vib.connect(vg); oscs.forEach((x) => vg.connect(x.frequency));
    [...oscs, vib].forEach((x) => { x.start(t); x.stop(t + dur + 0.1); }); n.start(t); n.stop(t + dur);
    // sub drop
    const sub = this.osc('sine', 45); const sg = ctx.createGain(); sub.frequency.exponentialRampToValueAtTime(25, t + dur); sub.connect(sg).connect(o); this.env(sg, t, 0.1, 0.8, dur); sub.start(t); sub.stop(t + dur + 0.1);
    return dur;
  }

  s_swipe(pos, { vol = 0.8, pitch = 1 } = {}) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = this.out(pos, 'sfx', { vol, ref: 3, reverb: 0.15 });
    const n = this.noiseSrc(); const f = this.filt('bandpass', 600, 1.5); const g = ctx.createGain();
    f.frequency.setValueAtTime(400 * pitch, t); f.frequency.exponentialRampToValueAtTime(2500 * pitch, t + 0.12); f.frequency.exponentialRampToValueAtTime(500, t + 0.28);
    n.connect(f).connect(g).connect(o); this.env(g, t, 0.06, 0.9, 0.22); n.start(t, rand(0, 2)); n.stop(t + 0.4);
    return 0.3;
  }
  s_impact(pos, { vol = 1, heavy = 1 } = {}) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = this.out(pos, 'sfx', { vol, ref: 4, reverb: 0.3 });
    const s = this.osc('sine', 120); const g = ctx.createGain(); s.frequency.exponentialRampToValueAtTime(40, t + 0.2);
    s.connect(g).connect(o); this.env(g, t, 0.003, 1 * heavy, 0.3); s.start(t); s.stop(t + 0.4);
    const n = this.noiseSrc(); const f = this.filt('lowpass', 1800, 0.8); const ng = ctx.createGain(); n.connect(f).connect(ng).connect(o);
    this.env(ng, t, 0.002, 0.8, 0.12); n.start(t, rand(0, 2)); n.stop(t + 0.3);
    const c = this.noiseSrc(); const cf = this.filt('bandpass', 3500, 3); const cg = ctx.createGain(); c.connect(cf).connect(cg).connect(o);
    this.env(cg, t + 0.01, 0.001, 0.4, 0.04); c.start(t, rand(0, 2)); c.stop(t + 0.1);
    return 0.4;
  }
  s_thud(pos, { vol = 0.8 } = {}) { // body falling / object drop
    const ctx = this.ctx, t = ctx.currentTime; const o = this.out(pos, 'sfx', { vol, ref: 3 });
    const s = this.osc('sine', 80); const g = ctx.createGain(); s.frequency.exponentialRampToValueAtTime(35, t + 0.25); s.connect(g).connect(o); this.env(g, t, 0.005, 0.9, 0.35); s.start(t); s.stop(t + 0.5);
    const n = this.noiseSrc('brown'); const ng = ctx.createGain(); n.connect(ng).connect(o); this.env(ng, t, 0.005, 0.6, 0.25); n.start(t, rand(0, 2)); n.stop(t + 0.4);
    return 0.5;
  }
  s_feed(pos, { vol = 0.8, dur = 3 } = {}) {
    // Non-graphic: a dark, droning "draining" sound with crackles and the monster's low rumble.
    const ctx = this.ctx, t = ctx.currentTime;
    const o = this.out(pos, 'sfx', { vol, ref: 3, reverb: 0.5 });
    const d = this.osc('sawtooth', 38); const d2 = this.osc('sawtooth', 38.7); const lp = this.filt('lowpass', 200, 6); const g = ctx.createGain();
    lp.frequency.linearRampToValueAtTime(700, t + dur); d.connect(lp); d2.connect(lp); lp.connect(g).connect(o);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5, t + 0.4); g.gain.setValueAtTime(0.5, t + dur - 0.4); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    d.start(t); d2.start(t); d.stop(t + dur); d2.stop(t + dur);
    const n = this.noiseSrc(); const nf = this.filt('bandpass', 250, 1.5); const ng = ctx.createGain(); const lfo = this.osc('sine', 1.3); const lg = ctx.createGain(); lg.gain.value = 0.2; lfo.connect(lg).connect(ng.gain);
    n.connect(nf).connect(ng).connect(o); ng.gain.value = 0.25; n.start(t); n.stop(t + dur); lfo.start(t); lfo.stop(t + dur);
    // reversed-feeling swell at end
    const r = this.osc('sine', 200); const rg = ctx.createGain(); r.frequency.linearRampToValueAtTime(60, t + dur); r.connect(rg).connect(o);
    rg.gain.setValueAtTime(0.0001, t); rg.gain.exponentialRampToValueAtTime(0.3, t + dur * 0.9); rg.gain.exponentialRampToValueAtTime(0.0001, t + dur); r.start(t); r.stop(t + dur);
    for (let i = 0; i < 10; i++) this.s_crackle(pos, { when: t + rand(0, dur), vol: vol * 0.5 });
    return dur;
  }
  s_crackle(pos, { when, vol = 0.4 } = {}) {
    const ctx = this.ctx, t = when || ctx.currentTime; const o = this.out(pos, 'sfx', { vol, ref: 2, reverb: 0.1 });
    const n = this.noiseSrc(); const f = this.filt('bandpass', rand(800, 3000), 4); const g = ctx.createGain(); n.connect(f).connect(g).connect(o);
    this.env(g, t, 0.002, 0.6, rand(0.02, 0.07)); n.start(t, rand(0, 2)); n.stop(t + 0.15);
  }
  s_dissolve(pos, { vol = 0.7 } = {}) { // NPC turning to ash
    const ctx = this.ctx, t = ctx.currentTime, dur = 2.5; const o = this.out(pos, 'sfx', { vol, ref: 3, reverb: 0.6 });
    const n = this.noiseSrc('pink'); const f = this.filt('highpass', 300, 0.5); const g = ctx.createGain();
    f.frequency.exponentialRampToValueAtTime(6000, t + dur); n.connect(f).connect(g).connect(o); this.env(g, t, 0.3, 0.4, dur - 0.3); n.start(t); n.stop(t + dur);
    const s = this.osc('triangle', 880); const sg = ctx.createGain(); s.frequency.exponentialRampToValueAtTime(110, t + dur); s.connect(sg).connect(o); this.env(sg, t, 0.5, 0.08, dur - 0.5); s.start(t); s.stop(t + dur);
    return dur;
  }

  // ---------- formant voice synthesis ----------
  // Builds a voiced source + 3 formant filters; returns controllers.
  voiceRig(o, f0, breath = 0.1) {
    const ctx = this.ctx;
    const src = this.osc('sawtooth', f0); const nz = this.noiseSrc(); const nzg = ctx.createGain(); nzg.gain.value = breath;
    const pre = ctx.createGain(); src.connect(pre); nz.connect(nzg).connect(pre);
    const fs = [0, 1, 2].map((i) => { const b = this.filt('bandpass', VOWELS.a[i], [8, 10, 12][i]); const bg = ctx.createGain(); bg.gain.value = [1, 0.6, 0.3][i]; pre.connect(b).connect(bg).connect(o); return b; });
    const vib = this.osc('sine', rand(4.5, 6)); const vg = ctx.createGain(); vg.gain.value = f0 * 0.02; vib.connect(vg).connect(src.frequency);
    return { src, nz, nzg, pre, fs, vib, vg };
  }
  s_babble(pos, { pitch = 140, dur = 2, vol = 0.5, rate = 6, bus = 'voice', muffle = 0, radio = false } = {}) {
    // A sentence of unintelligible speech — syllables, intonation, pauses.
    const ctx = this.ctx, t = ctx.currentTime;
    let o = this.out(pos, bus, { vol, ref: 2.5, reverb: 0.25, muffle });
    if (radio) { const hp = this.filt('bandpass', 1500, 0.8); const sh = this.shaper(); hp.connect(sh).connect(o); o = hp; }
    const V = this.voiceRig(o, pitch, 0.08);
    const amp = ctx.createGain(); amp.gain.value = 0; V.pre.disconnect(); V.pre.connect(amp); V.fs.forEach((b) => amp.connect(b));
    let tt = t; const end = t + dur;
    while (tt < end - 0.1) {
      const syl = 1 / rate * rand(0.6, 1.5);
      const v = VOWELS[pick(VK)];
      V.fs.forEach((b, i) => b.frequency.setTargetAtTime(v[i] * (pitch > 180 ? 1.15 : 1), tt, 0.02));
      V.src.frequency.setTargetAtTime(pitch * rand(0.85, 1.2) * (1 - (tt - t) / dur * 0.15), tt, 0.05);
      amp.gain.setTargetAtTime(rand(0.5, 1), tt, 0.015); amp.gain.setTargetAtTime(0.05, tt + syl * 0.7, 0.02);
      V.nzg.gain.setValueAtTime(Math.random() < 0.3 ? 0.6 : 0.06, tt);
      tt += syl; if (Math.random() < 0.12) tt += rand(0.15, 0.4);
    }
    amp.gain.setTargetAtTime(0, end, 0.03);
    [V.src, V.nz, V.vib].forEach((x) => { x.start(t); x.stop(end + 0.3); });
    return dur;
  }
  s_scream(pos, { pitch = 1, vol = 1, dur = 1.6, far = false } = {}) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = this.out(pos, 'voice', { vol, ref: far ? 30 : 5, rolloff: far ? 0.5 : 1, reverb: far ? 0.9 : 0.4, muffle: far ? 0.4 : 0 });
    const f0 = 420 * pitch;
    const V = this.voiceRig(o, f0, 0.35);
    V.vg.gain.value = f0 * 0.05; V.vib.frequency.value = rand(5, 8);
    const v = Math.random() < 0.5 ? VOWELS.a : VOWELS.ae;
    V.fs.forEach((b, i) => { b.frequency.value = v[i] * 1.2; b.Q.value = 5; });
    const amp = ctx.createGain(); V.pre.disconnect(); V.pre.connect(amp); V.fs.forEach((b) => amp.connect(b));
    V.src.frequency.setValueAtTime(f0 * 0.8, t); V.src.frequency.linearRampToValueAtTime(f0 * 1.25, t + 0.25); V.src.frequency.linearRampToValueAtTime(f0 * 0.85, t + dur);
    amp.gain.setValueAtTime(0.0001, t); amp.gain.exponentialRampToValueAtTime(1, t + 0.08); amp.gain.setValueAtTime(1, t + dur * 0.7); amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const sh = this.shaper(); // a little rasp
    [V.src, V.nz, V.vib].forEach((x) => { x.start(t); x.stop(t + dur + 0.1); });
    return dur;
  }
  s_gasp(pos, { pitch = 1, vol = 0.7 } = {}) {
    const ctx = this.ctx, t = ctx.currentTime; const o = this.out(pos, 'voice', { vol, ref: 2.5 });
    const n = this.noiseSrc(); const g = ctx.createGain();
    const fs = VOWELS.uh.map((f, i) => { const b = this.filt('bandpass', f * pitch, 6); n.connect(b).connect(g); return b; });
    g.connect(o); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1.2, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    n.start(t, rand(0, 2)); n.stop(t + 0.4);
    return 0.4;
  }
  s_help(pos, { pitch = 1, vol = 1 } = {}) {
    // "HELP!" approximated: breathy h -> 'e' vowel -> lip close
    const ctx = this.ctx, t = ctx.currentTime; const o = this.out(pos, 'voice', { vol, ref: 6, reverb: 0.5 });
    const f0 = 260 * pitch;
    const V = this.voiceRig(o, f0, 0.2);
    const amp = ctx.createGain(); V.pre.disconnect(); V.pre.connect(amp); V.fs.forEach((b) => amp.connect(b));
    V.fs.forEach((b, i) => { b.frequency.setValueAtTime(VOWELS.e[i], t); });
    V.nzg.gain.setValueAtTime(1.2, t); V.nzg.gain.setValueAtTime(0.1, t + 0.08);
    V.src.frequency.setValueAtTime(f0 * 1.1, t); V.src.frequency.linearRampToValueAtTime(f0 * 1.3, t + 0.2); V.src.frequency.linearRampToValueAtTime(f0, t + 0.45);
    V.fs[1].frequency.linearRampToValueAtTime(1200, t + 0.4);
    amp.gain.setValueAtTime(0.0001, t); amp.gain.exponentialRampToValueAtTime(1, t + 0.06); amp.gain.setValueAtTime(1, t + 0.35); amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    [V.src, V.nz, V.vib].forEach((x) => { x.start(t); x.stop(t + 0.6); });
    return 0.6;
  }
  s_whisper(pos, { dur = 2.2, vol = 0.5, close = true } = {}) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = this.out(pos, 'voice', { vol, ref: close ? 1.2 : 3, reverb: 0.45 });
    const n = this.noiseSrc('white', true); const amp = ctx.createGain(); amp.gain.value = 0; n.connect(amp);
    const fs = [0, 1, 2].map((i) => { const b = this.filt('bandpass', VOWELS.i[i], 14); const bg = ctx.createGain(); bg.gain.value = [1.6, 1.2, 0.8][i]; amp.connect(b).connect(bg).connect(o); return b; });
    const hiss = this.filt('highpass', 4500, 1); const hg = ctx.createGain(); hg.gain.value = 0.15; amp.connect(hiss).connect(hg).connect(o);
    let tt = t; const end = t + dur;
    while (tt < end - 0.1) {
      const syl = rand(0.1, 0.25); const v = VOWELS[pick(VK)];
      fs.forEach((b, i) => b.frequency.setTargetAtTime(v[i], tt, 0.02));
      amp.gain.setTargetAtTime(rand(0.4, 1), tt, 0.02); amp.gain.setTargetAtTime(0.03, tt + syl * 0.75, 0.02);
      tt += syl; if (Math.random() < 0.15) tt += rand(0.1, 0.3);
    }
    amp.gain.setTargetAtTime(0, end, 0.05);
    n.start(t, rand(0, 2)); n.stop(end + 0.3);
    return dur;
  }
  s_laugh(pos, { vol = 0.4, child = true } = {}) {
    const ctx = this.ctx, t = ctx.currentTime; const o = this.out(pos, 'voice', { vol, ref: 3, reverb: 0.7 });
    const f0 = child ? 380 : 180; const V = this.voiceRig(o, f0, 0.4);
    const amp = ctx.createGain(); V.pre.disconnect(); V.pre.connect(amp); V.fs.forEach((b, i) => { amp.connect(b); b.frequency.value = VOWELS.a[i] * 1.2; });
    const n = 4 + Math.floor(rand(0, 3));
    amp.gain.setValueAtTime(0, t);
    for (let i = 0; i < n; i++) { const tt = t + i * 0.17; amp.gain.setTargetAtTime(0.9, tt, 0.01); amp.gain.setTargetAtTime(0.02, tt + 0.09, 0.02); V.src.frequency.setValueAtTime(f0 * (1.1 - i * 0.05), tt); }
    [V.src, V.nz, V.vib].forEach((x) => { x.start(t); x.stop(t + n * 0.17 + 0.3); });
    return n * 0.17;
  }
  s_cry(pos, { vol = 0.35 } = {}) { // muffled sobbing
    const ctx = this.ctx, t = ctx.currentTime; const o = this.out(pos, 'voice', { vol, ref: 2, reverb: 0.5, muffle: 0.3 });
    const V = this.voiceRig(o, 300, 0.5); const amp = ctx.createGain(); V.pre.disconnect(); V.pre.connect(amp); V.fs.forEach((b, i) => { amp.connect(b); b.frequency.value = VOWELS.u[i]; });
    amp.gain.value = 0;
    for (let i = 0; i < 5; i++) { const tt = t + i * 0.5 + rand(0, 0.15); amp.gain.setTargetAtTime(0.8, tt, 0.03); amp.gain.setTargetAtTime(0.01, tt + 0.25, 0.08); V.src.frequency.setValueAtTime(rand(280, 340), tt); V.src.frequency.linearRampToValueAtTime(220, tt + 0.3); }
    [V.src, V.nz, V.vib].forEach((x) => { x.start(t); x.stop(t + 3); });
    return 2.8;
  }
  s_voiceName(pos, opts = {}) { return this.s_whisper(pos, { dur: 0.9, vol: 0.6, ...opts }); }

  // ---------- world ----------
  s_doorOpen(pos, { vol = 0.8 } = {}) {
    const ctx = this.ctx, t = ctx.currentTime, dur = rand(0.6, 1.2); const o = this.out(pos, 'sfx', { vol, ref: 3, reverb: 0.4 });
    const s = this.osc('sawtooth', rand(140, 220)); const b = this.filt('bandpass', 900, 8); const g = ctx.createGain();
    const lfo = this.osc('square', rand(18, 35)); const lg = ctx.createGain(); lg.gain.value = 0.5; lfo.connect(lg).connect(g.gain);
    s.frequency.linearRampToValueAtTime(s.frequency.value * rand(0.6, 1.5), t + dur);
    s.connect(b).connect(g).connect(o); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.4, t + 0.1); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    s.start(t); lfo.start(t); s.stop(t + dur); lfo.stop(t + dur);
    this.s_click(pos, { vol: vol * 0.6 });
    return dur;
  }
  s_doorClose(pos, { vol = 0.8 } = {}) { this.s_thud(pos, { vol: vol * 0.8 }); this.s_click(pos, { vol: vol * 0.7, when: 0.05 }); return 0.4; }
  s_click(pos, { vol = 0.5, when = 0 } = {}) {
    const ctx = this.ctx, t = ctx.currentTime + when; const o = this.out(pos, 'sfx', { vol, ref: 2 });
    const n = this.noiseSrc(); const f = this.filt('bandpass', 3000, 5); const g = ctx.createGain(); n.connect(f).connect(g).connect(o); this.env(g, t, 0.001, 0.8, 0.03); n.start(t, rand(0, 2)); n.stop(t + 0.08);
  }
  s_locked(pos, { vol = 0.6 } = {}) { for (let i = 0; i < 3; i++) this.s_click(pos, { vol, when: i * 0.09 }); this.s_thud(pos, { vol: 0.3 }); return 0.3; }
  s_knock(pos, { vol = 0.7, n = 3 } = {}) {
    const ctx = this.ctx; const o = this.out(pos, 'sfx', { vol, ref: 3, reverb: 0.4 });
    for (let i = 0; i < n; i++) {
      const t = ctx.currentTime + i * rand(0.18, 0.3);
      const s = this.osc('sine', rand(150, 190)); const g = ctx.createGain(); s.connect(g).connect(o); this.env(g, t, 0.002, 0.8, 0.12); s.start(t); s.stop(t + 0.2);
      const nn = this.noiseSrc(); const f = this.filt('bandpass', 800, 2); const ng = ctx.createGain(); nn.connect(f).connect(ng).connect(o); this.env(ng, t, 0.001, 0.5, 0.05); nn.start(t, rand(0, 2)); nn.stop(t + 0.1);
    }
    return n * 0.3;
  }
  s_scratch(pos, { vol = 0.5, dur = 2 } = {}) {
    const ctx = this.ctx, t = ctx.currentTime; const o = this.out(pos, 'sfx', { vol, ref: 2, reverb: 0.4, muffle: 0.2 });
    let tt = t;
    while (tt < t + dur) {
      const l = rand(0.12, 0.4); const n = this.noiseSrc(); const f = this.filt('bandpass', rand(2000, 5000), 3); const g = ctx.createGain();
      f.frequency.linearRampToValueAtTime(rand(1500, 6000), tt + l);
      n.connect(f).connect(g).connect(o); g.gain.setValueAtTime(0.0001, tt); g.gain.linearRampToValueAtTime(0.5, tt + l * 0.3); g.gain.linearRampToValueAtTime(0.0001, tt + l);
      n.start(tt, rand(0, 2)); n.stop(tt + l + 0.05); tt += l + rand(0.05, 0.3);
    }
    return dur;
  }
  s_clang(pos, { vol = 0.7, far = true } = {}) {
    const ctx = this.ctx, t = ctx.currentTime; const o = this.out(pos, 'sfx', { vol, ref: 6, reverb: 0.9, rolloff: 0.6 });
    const base = rand(180, 320);
    for (const r of [1, 2.76, 5.4, 8.93]) { const s = this.osc('sine', base * r); const g = ctx.createGain(); s.connect(g).connect(o); this.env(g, t, 0.002, 0.3 / r, 2.5 / Math.sqrt(r)); s.start(t); s.stop(t + 3); }
    this.s_impact(pos, { vol: vol * 0.4 });
    return 3;
  }
  s_bark(pos, { vol = 0.6 } = {}) {
    const ctx = this.ctx; const o = this.out(pos, 'sfx', { vol, ref: 8, reverb: 0.7, rolloff: 0.7 });
    const n = 1 + Math.floor(rand(0, 3));
    for (let i = 0; i < n; i++) {
      const t = ctx.currentTime + i * rand(0.3, 0.5);
      const V = this.voiceRig(o, rand(350, 480), 0.4); const amp = ctx.createGain(); V.pre.disconnect(); V.pre.connect(amp); V.fs.forEach((b, j) => { amp.connect(b); b.frequency.value = VOWELS.a[j] * 0.9; });
      V.src.frequency.setValueAtTime(V.src.frequency.value * 1.2, t); V.src.frequency.exponentialRampToValueAtTime(V.src.frequency.value * 0.7, t + 0.15);
      amp.gain.setValueAtTime(0.0001, t); amp.gain.exponentialRampToValueAtTime(1, t + 0.02); amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      [V.src, V.nz, V.vib].forEach((x) => { x.start(t); x.stop(t + 0.25); });
    }
    return n * 0.5;
  }
  s_howl(pos, { vol = 0.5 } = {}) {
    const ctx = this.ctx, t = ctx.currentTime, dur = 3.5; const o = this.out(pos, 'sfx', { vol, ref: 20, reverb: 1, rolloff: 0.5 });
    const V = this.voiceRig(o, 380, 0.15); const amp = ctx.createGain(); V.pre.disconnect(); V.pre.connect(amp); V.fs.forEach((b, j) => { amp.connect(b); b.frequency.value = VOWELS.u[j]; b.frequency.linearRampToValueAtTime(VOWELS.o[j], t + dur); });
    V.src.frequency.setValueAtTime(300, t); V.src.frequency.linearRampToValueAtTime(560, t + 1); V.src.frequency.linearRampToValueAtTime(420, t + dur);
    amp.gain.setValueAtTime(0.0001, t); amp.gain.exponentialRampToValueAtTime(0.8, t + 0.6); amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    [V.src, V.nz, V.vib].forEach((x) => { x.start(t); x.stop(t + dur + 0.1); });
    return dur;
  }
  s_owl(pos, { vol = 0.4 } = {}) {
    const ctx = this.ctx; const o = this.out(pos, 'sfx', { vol, ref: 12, reverb: 0.8, rolloff: 0.6 });
    const seq = [0, 0.5, 0.75, 1.3];
    for (const d of seq) { const t = ctx.currentTime + d; const s = this.osc('sine', rand(360, 400)); const g = ctx.createGain(); s.frequency.linearRampToValueAtTime(330, t + 0.3); s.connect(g).connect(o); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); s.start(t); s.stop(t + 0.4); }
    return 1.8;
  }
  s_crow(pos, { vol = 0.5 } = {}) {
    const ctx = this.ctx; const o = this.out(pos, 'sfx', { vol, ref: 10, reverb: 0.7 });
    for (let i = 0; i < 2 + Math.floor(rand(0, 2)); i++) {
      const t = ctx.currentTime + i * 0.45; const V = this.voiceRig(o, rand(500, 650), 0.8); const amp = ctx.createGain(); V.pre.disconnect(); V.pre.connect(amp); V.fs.forEach((b, j) => { amp.connect(b); b.frequency.value = VOWELS.ae[j]; });
      const sh = this.shaper(); amp.gain.setValueAtTime(0.0001, t); amp.gain.exponentialRampToValueAtTime(1, t + 0.03); amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      [V.src, V.nz, V.vib].forEach((x) => { x.start(t); x.stop(t + 0.35); });
    }
    return 1.2;
  }
  s_branch(pos, { vol = 0.7 } = {}) { // a twig snapping
    const ctx = this.ctx, t = ctx.currentTime; const o = this.out(pos, 'sfx', { vol, ref: 4, reverb: 0.5 });
    for (let i = 0; i < 3; i++) { const n = this.noiseSrc(); const f = this.filt('bandpass', rand(1500, 4000), 6); const g = ctx.createGain(); n.connect(f).connect(g).connect(o); this.env(g, t + i * rand(0.01, 0.04), 0.001, 1, 0.03); n.start(t, rand(0, 2)); n.stop(t + 0.2); }
    return 0.2;
  }
  s_siren(pos, { vol = 0.25, dur = 6 } = {}) {
    const ctx = this.ctx, t = ctx.currentTime; const o = this.out(pos, 'amb', { vol, ref: 60, reverb: 1, rolloff: 0.3, muffle: 0.4 });
    const s = this.osc('square', 700); const lp = this.filt('lowpass', 1800, 1); const g = ctx.createGain();
    for (let i = 0; i < dur; i += 1) { s.frequency.setValueAtTime(650, t + i); s.frequency.linearRampToValueAtTime(1300, t + i + 0.5); s.frequency.linearRampToValueAtTime(650, t + i + 1); }
    s.connect(lp).connect(g).connect(o); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.3, t + 1.5); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    s.start(t); s.stop(t + dur); return dur;
  }
  s_carPass(pos, { vol = 0.5, dur = 4 } = {}) {
    const ctx = this.ctx, t = ctx.currentTime; const o = this.out(pos, 'amb', { vol, ref: 10, reverb: 0.4 });
    const n = this.noiseSrc('brown'); const f = this.filt('lowpass', 400, 1); const g = ctx.createGain();
    f.frequency.setValueAtTime(300, t); f.frequency.linearRampToValueAtTime(1200, t + dur / 2); f.frequency.linearRampToValueAtTime(250, t + dur);
    n.connect(f).connect(g).connect(o); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.9, t + dur / 2); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    n.start(t); n.stop(t + dur); return dur;
  }
  s_horn(pos, { vol = 0.4 } = {}) {
    const ctx = this.ctx, t = ctx.currentTime, d = rand(0.3, 0.9); const o = this.out(pos, 'amb', { vol, ref: 15, reverb: 0.6 });
    for (const f of [400, 500]) { const s = this.osc('sawtooth', f); const lp = this.filt('lowpass', 1500); const g = ctx.createGain(); s.connect(lp).connect(g).connect(o); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.25, t + 0.02); g.gain.setValueAtTime(0.25, t + d); g.gain.linearRampToValueAtTime(0.0001, t + d + 0.05); s.start(t); s.stop(t + d + 0.1); }
    return d;
  }
  s_thunder(pos, { vol = 1, delay = 0 } = {}) {
    const ctx = this.ctx, t = ctx.currentTime + delay, dur = rand(3, 6); const o = this.out(null, 'amb', { vol, reverb: 0.6 });
    const n = this.noiseSrc('brown'); const f = this.filt('lowpass', 900, 0.5); const g = ctx.createGain(); f.frequency.exponentialRampToValueAtTime(120, t + dur);
    n.connect(f).connect(g).connect(o); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1.4, t + 0.08); g.gain.exponentialRampToValueAtTime(0.4, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.start(t, rand(0, 1)); n.stop(t + dur); return dur;
  }
  s_announce(pos, { vol = 0.5, dur = 4 } = {}) { // distorted PA announcement
    this.s_chime(pos, { vol: vol * 0.6 });
    setTimeout(() => this.ready && this.s_babble(pos, { pitch: rand(110, 170), dur, vol, rate: 4.5, radio: true, bus: 'voice' }), 900);
    return dur + 1;
  }
  s_chime(pos, { vol = 0.4 } = {}) {
    const ctx = this.ctx; const o = this.out(pos, 'sfx', { vol, ref: 10, reverb: 0.9 });
    [[659, 0], [523, 0.35], [392, 0.7]].forEach(([f, d]) => { const t = ctx.currentTime + d; const s = this.osc('sine', f * rand(0.97, 1.0)); const g = ctx.createGain(); s.connect(g).connect(o); this.env(g, t, 0.01, 0.4, 1.4); s.start(t); s.stop(t + 1.5); });
    return 1.5;
  }
  s_ding(pos, { vol = 0.5 } = {}) { const ctx = this.ctx, t = ctx.currentTime; const o = this.out(pos, 'sfx', { vol, ref: 4, reverb: 0.5 }); const s = this.osc('sine', 880); const g = ctx.createGain(); s.connect(g).connect(o); this.env(g, t, 0.005, 0.5, 1.5); s.start(t); s.stop(t + 1.6); return 1.5; }
  s_heartbeat(pos, { vol = 0.6 } = {}) {
    const ctx = this.ctx; const o = this.out(null, 'sfx', { vol, reverb: 0 });
    for (const d of [0, 0.22]) { const t = ctx.currentTime + d; const s = this.osc('sine', 55); const g = ctx.createGain(); s.frequency.exponentialRampToValueAtTime(35, t + 0.12); s.connect(g).connect(o); this.env(g, t, 0.005, d ? 0.6 : 0.9, 0.15); s.start(t); s.stop(t + 0.2); }
    return 0.5;
  }
  s_stinger(pos, { vol = 0.6, dur = 3 } = {}) { // the Presence's signature: a dissonant swell that cuts off
    const ctx = this.ctx, t = ctx.currentTime; const o = this.out(pos, 'music', { vol, ref: 6, reverb: 0.9 });
    for (const f of [92.5, 98, 138.6, 196, 277.2, 293.7]) {
      const s = this.osc(Math.random() < 0.5 ? 'sawtooth' : 'triangle', f * rand(0.995, 1.005)); const lp = this.filt('lowpass', 600); const g = ctx.createGain();
      lp.frequency.exponentialRampToValueAtTime(3000, t + dur); s.connect(lp).connect(g).connect(o);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + dur * 0.95); g.gain.linearRampToValueAtTime(0.0001, t + dur);
      s.start(t); s.stop(t + dur + 0.05);
    }
    return dur;
  }
  s_hit(pos, { vol = 0.6 } = {}) { // sudden orchestral-ish hit for big scares
    const ctx = this.ctx, t = ctx.currentTime; const o = this.out(null, 'music', { vol, reverb: 1 });
    for (const f of [55, 58.3, 110, 116.5, 233]) { const s = this.osc('sawtooth', f); const lp = this.filt('lowpass', 2000); const g = ctx.createGain(); lp.frequency.exponentialRampToValueAtTime(200, t + 1.5); s.connect(lp).connect(g).connect(o); this.env(g, t, 0.01, 0.2, 1.8); s.start(t); s.stop(t + 2); }
    this.s_impact(null, { vol: vol, heavy: 1.5 });
    return 2;
  }
  s_tone(pos, { f = 440, vol = 0.3, dur = 2, type = 'sine' } = {}) { // detuned music-box / piano-ish note
    const ctx = this.ctx, t = ctx.currentTime; const o = this.out(pos, 'music', { vol, ref: 5, reverb: 1 });
    for (const m of [1, 2.01, 3.02]) { const s = this.osc(type, f * m); const g = ctx.createGain(); s.connect(g).connect(o); this.env(g, t, 0.005, 0.3 / m, dur); s.start(t); s.stop(t + dur + 0.1); }
    return dur;
  }
  s_paper(pos, { vol = 0.6 } = {}) {
    const ctx = this.ctx, t = ctx.currentTime; const o = this.out(null, 'sfx', { vol });
    for (let i = 0; i < 5; i++) { const n = this.noiseSrc(); const f = this.filt('highpass', rand(2000, 5000)); const g = ctx.createGain(); n.connect(f).connect(g).connect(o); this.env(g, t + i * rand(0.04, 0.09), 0.01, 0.4, rand(0.05, 0.12)); n.start(t, rand(0, 2)); n.stop(t + 0.6); }
    return 0.5;
  }
  s_tape(pos, { vol = 0.5 } = {}) { this.s_click(null, { vol }); this.s_click(null, { vol: vol * 0.7, when: 0.12 }); return 0.3; }
  s_ui(pos, { vol = 0.25, f = 220 } = {}) { const ctx = this.ctx, t = ctx.currentTime; const o = this.out(null, 'sfx', { vol, reverb: 0.4 }); const s = this.osc('sine', f); const g = ctx.createGain(); s.connect(g).connect(o); this.env(g, t, 0.005, 0.4, 0.4); s.start(t); s.stop(t + 0.5); return 0.4; }
  s_sniff(pos, { vol = 0.6 } = {}) { for (let i = 0; i < 3; i++) setTimeout(() => { if (!this.ready) return; const ctx = this.ctx, t = ctx.currentTime; const o = this.out(null, 'sfx', { vol }); const n = this.noiseSrc(); const f = this.filt('bandpass', 2200, 2); const g = ctx.createGain(); n.connect(f).connect(g).connect(o); this.env(g, t, 0.03, 0.6, 0.12); n.start(t, rand(0, 2)); n.stop(t + 0.2); }, i * 180); return 0.6; }
  s_shimmer(pos, { vol = 0.3, up = true } = {}) {
    const ctx = this.ctx, t = ctx.currentTime; const o = this.out(null, 'sfx', { vol, reverb: 0.8 });
    for (let i = 0; i < 6; i++) { const s = this.osc('sine', (up ? 300 : 1200) * (1 + i * 0.5)); const g = ctx.createGain(); s.frequency.exponentialRampToValueAtTime((up ? 1200 : 200) * (1 + i * 0.5), t + 1); s.connect(g).connect(o); this.env(g, t + i * 0.04, 0.05, 0.12, 1); s.start(t); s.stop(t + 1.3); }
    return 1.2;
  }
  s_whine(pos, { vol = 0.25, up = true } = {}) { const ctx = this.ctx, t = ctx.currentTime; const o = this.out(null, 'sfx', { vol }); const s = this.osc('sine', up ? 2000 : 9000); const g = ctx.createGain(); s.frequency.exponentialRampToValueAtTime(up ? 9000 : 2000, t + 0.6); s.connect(g).connect(o); this.env(g, t, 0.02, 0.2, 0.6); s.start(t); s.stop(t + 0.7); this.s_click(null, { vol: vol * 2 }); return 0.7; }
  s_subSwell(pos, { vol = 0.8 } = {}) { const ctx = this.ctx, t = ctx.currentTime; const o = this.out(pos, 'sfx', { vol, ref: 6, reverb: 0.6 }); const s = this.osc('sine', 30); const g = ctx.createGain(); s.frequency.linearRampToValueAtTime(48, t + 1.5); s.connect(g).connect(o); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + 1); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4); s.start(t); s.stop(t + 2.5); this.s_whisper(pos, { dur: 1.6, vol: vol * 0.4 }); return 2.4; }
  s_glass(pos, { vol = 0.7 } = {}) { const ctx = this.ctx, t = ctx.currentTime; const o = this.out(pos, 'sfx', { vol, ref: 4, reverb: 0.5 }); for (let i = 0; i < 12; i++) { const s = this.osc('sine', rand(2500, 7000)); const g = ctx.createGain(); s.connect(g).connect(o); this.env(g, t + rand(0, 0.3), 0.001, 0.15, rand(0.1, 0.5)); s.start(t); s.stop(t + 1); } this.s_impact(pos, { vol: vol * 0.5 }); return 1; }
  s_static(pos, { vol = 0.3, dur = 1 } = {}) { const ctx = this.ctx, t = ctx.currentTime; const o = this.out(pos, 'sfx', { vol, ref: 2, reverb: 0.2 }); const n = this.noiseSrc(); const f = this.filt('bandpass', 2500, 0.6); const g = ctx.createGain(); n.connect(f).connect(g).connect(o); g.gain.setValueAtTime(0.5, t); g.gain.setValueAtTime(0.0001, t + dur); n.start(t, rand(0, 2)); n.stop(t + dur); return dur; }
  s_splash(pos, { vol = 0.6 } = {}) { this.s_step(pos, { surface: 'water', heavy: 1.5, vol }); return 0.4; }
  s_breathNPC(pos, { vol = 0.4 } = {}) { return this.s_breath(pos, { vol, inhale: Math.random() < 0.5, intensity: 1.6 }); }
  s_drip(pos, { vol = 0.4 } = {}) { const ctx = this.ctx, t = ctx.currentTime; const o = this.out(pos, 'sfx', { vol, ref: 2, reverb: 0.8 }); const s = this.osc('sine', rand(900, 1500)); const g = ctx.createGain(); s.frequency.exponentialRampToValueAtTime(rand(2000, 2800), t + 0.05); s.connect(g).connect(o); this.env(g, t, 0.002, 0.4, 0.08); s.start(t); s.stop(t + 0.15); return 0.1; }
  s_phone(pos, { vol = 0.4 } = {}) { const ctx = this.ctx; const o = this.out(pos, 'sfx', { vol, ref: 3, reverb: 0.4 }); for (let r = 0; r < 2; r++) for (let i = 0; i < 10; i++) { const t = ctx.currentTime + r * 0.9 + i * 0.04; const s = this.osc('square', i % 2 ? 1300 : 1600); const lp = this.filt('lowpass', 3000); const g = ctx.createGain(); s.connect(lp).connect(g).connect(o); this.env(g, t, 0.002, 0.08, 0.035); s.start(t); s.stop(t + 0.05); } return 2; }
  s_swing(pos, { vol = 0.4 } = {}) { // rusty playground swing chain
    const ctx = this.ctx, t = ctx.currentTime; const o = this.out(pos, 'sfx', { vol, ref: 4, reverb: 0.5 });
    for (let i = 0; i < 2; i++) { const tt = t + i * 1.1; const s = this.osc('sawtooth', rand(500, 700)); const b = this.filt('bandpass', 1800, 10); const g = ctx.createGain(); s.frequency.linearRampToValueAtTime(rand(800, 1000), tt + 0.4); s.connect(b).connect(g).connect(o); g.gain.setValueAtTime(0.0001, tt); g.gain.linearRampToValueAtTime(0.3, tt + 0.15); g.gain.linearRampToValueAtTime(0.0001, tt + 0.5); s.start(tt); s.stop(tt + 0.55); }
    return 2.2;
  }
  s_flare(pos, { vol = 0.8 } = {}) { this.s_impact(pos, { vol, heavy: 1.3 }); const ctx = this.ctx, t = ctx.currentTime; const o = this.out(pos, 'sfx', { vol: vol * 0.5, ref: 5, reverb: 0.8 }); const n = this.noiseSrc(); const f = this.filt('highpass', 1500); const g = ctx.createGain(); n.connect(f).connect(g).connect(o); this.env(g, t, 0.01, 0.6, 1.5); n.start(t); n.stop(t + 1.6); return 1.5; }
  s_gun(pos, { vol = 1 } = {}) { const ctx = this.ctx, t = ctx.currentTime; const o = this.out(pos, 'sfx', { vol, ref: 10, reverb: 1, rolloff: 0.6 }); const n = this.noiseSrc(); const f = this.filt('lowpass', 3000); const g = ctx.createGain(); f.frequency.exponentialRampToValueAtTime(300, t + 0.3); n.connect(f).connect(g).connect(o); this.env(g, t, 0.001, 1.5, 0.35); n.start(t); n.stop(t + 0.5); this.s_impact(pos, { vol, heavy: 2 }); return 0.5; }

  // ---------------- loops ----------------
  // Persistent beds. setLoop(name, gain) fades a loop in/out; positional loops supported.
  loop(name, gain, pos = null) {
    if (!this.ready) return null;
    let L = this.loops.get(name);
    if (!L) {
      const fn = this['l_' + name.split('#')[0]]; if (!fn) return null;
      const g = this.ctx.createGain(); g.gain.value = 0.0001;
      let dest;
      if (pos) {
        const p = this.ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 3; p.rolloffFactor = 1.3;
        p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z;
        g.connect(p); p.connect(this.duck); const s = this.ctx.createGain(); s.gain.value = 0.3; p.connect(s); s.connect(this.reverb); dest = g; L = { g, panner: p };
      } else { g.connect(this.duck); dest = g; L = { g }; }
      L.nodes = fn.call(this, dest) || [];
      this.loops.set(name, L);
    }
    L.g.gain.setTargetAtTime(Math.max(0.0001, gain), this.ctx.currentTime, 0.8);
    return L;
  }
  stopAllLoops() {
    if (!this.ready) return;
    for (const [, L] of this.loops) { L.g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.3); const nodes = L.nodes; setTimeout(() => nodes.forEach((n) => { try { n.stop(); } catch (e) { /* */ } }), 1500); }
    this.loops.clear();
  }
  // "Unnatural quiet": ambience and music drop away, then slowly return.
  silence(depth = 0.05, hold = 4, release = 3) {
    if (!this.ready) return;
    const t = this.ctx.currentTime, g = this.duck.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(depth, t + 1.2); g.setValueAtTime(depth, t + 1.2 + hold); g.linearRampToValueAtTime(1, t + 1.2 + hold + release);
    const mg = this.bus.music.gain; mg.cancelScheduledValues(t); mg.setValueAtTime(mg.value, t); mg.linearRampToValueAtTime(this.volumes.music * depth, t + 1); mg.setValueAtTime(this.volumes.music * depth, t + 1 + hold); mg.linearRampToValueAtTime(this.volumes.music, t + 1 + hold + release);
  }

  l_wind(dest) {
    const n = this.noiseSrc('pink', true); const f = this.filt('bandpass', 500, 0.7); const g = this.ctx.createGain(); g.gain.value = 0.6;
    const lfo = this.osc('sine', 0.08); const lg = this.ctx.createGain(); lg.gain.value = 350; lfo.connect(lg).connect(f.frequency);
    const lfo2 = this.osc('sine', 0.13); const lg2 = this.ctx.createGain(); lg2.gain.value = 0.35; lfo2.connect(lg2).connect(g.gain);
    n.connect(f).connect(g).connect(dest); n.start(); lfo.start(); lfo2.start(); return [n, lfo, lfo2];
  }
  l_rain(dest) {
    const n = this.noiseSrc('white', true); const f = this.filt('highpass', 1200, 0.5); const f2 = this.filt('lowpass', 9000, 0.5); const g = this.ctx.createGain(); g.gain.value = 0.35;
    const n2 = this.noiseSrc('pink', true); const f3 = this.filt('lowpass', 600); const g2 = this.ctx.createGain(); g2.gain.value = 0.5;
    n.connect(f).connect(f2).connect(g).connect(dest); n2.connect(f3).connect(g2).connect(dest); n.start(); n2.start(0, 1.3); return [n, n2];
  }
  l_cityHum(dest) {
    const n = this.noiseSrc('brown', true); const f = this.filt('lowpass', 300); const g = this.ctx.createGain(); g.gain.value = 0.8;
    const o = this.osc('sawtooth', 60); const of = this.filt('lowpass', 120); const og = this.ctx.createGain(); og.gain.value = 0.04;
    n.connect(f).connect(g).connect(dest); o.connect(of).connect(og).connect(dest); n.start(); o.start(); return [n, o];
  }
  l_buzz(dest) { // fluorescent tube buzz
    const o = this.osc('sawtooth', 120); const o2 = this.osc('square', 240); const b = this.filt('bandpass', 2400, 3); const g = this.ctx.createGain(); g.gain.value = 0.05;
    o.connect(b); o2.connect(b); b.connect(g).connect(dest); o.start(); o2.start(); return [o, o2];
  }
  l_crickets(dest) {
    const o = this.osc('sine', 4300); const g = this.ctx.createGain(); g.gain.value = 0;
    const am = this.osc('square', 24); const amg = this.ctx.createGain(); amg.gain.value = 0.03; am.connect(amg).connect(g.gain);
    const am2 = this.osc('sine', 0.7); const am2g = this.ctx.createGain(); am2g.gain.value = 0.03; am2.connect(am2g).connect(g.gain);
    const o2 = this.osc('sine', 5100); const g2 = this.ctx.createGain(); g2.gain.value = 0; const am3 = this.osc('square', 31); const am3g = this.ctx.createGain(); am3g.gain.value = 0.02; am3.connect(am3g).connect(g2.gain);
    o.connect(g).connect(dest); o2.connect(g2).connect(dest); [o, am, am2, o2, am3].forEach((x) => x.start()); return [o, am, am2, o2, am3];
  }
  l_drone(dest) { // low dread bed
    const nodes = [];
    for (const f of [36.7, 55, 55.4, 82.4]) { const o = this.osc('sawtooth', f); const lp = this.filt('lowpass', 180, 2); const g = this.ctx.createGain(); g.gain.value = 0.08; const l = this.osc('sine', Math.random() * 0.1 + 0.03); const lg = this.ctx.createGain(); lg.gain.value = 80; l.connect(lg).connect(lp.frequency); o.connect(lp).connect(g).connect(dest); o.start(); l.start(); nodes.push(o, l); }
    return nodes;
  }
  l_tension(dest) { // high dissonant strings, faded in by tension
    const nodes = [];
    for (const f of [587, 622, 880, 932]) { const o = this.osc('sawtooth', f); const bp = this.filt('bandpass', f, 6); const g = this.ctx.createGain(); g.gain.value = 0.03; const v = this.osc('sine', 5 + Math.random()); const vg = this.ctx.createGain(); vg.gain.value = 3; v.connect(vg).connect(o.frequency); o.connect(bp).connect(g).connect(dest); o.start(); v.start(); nodes.push(o, v); }
    return nodes;
  }
  l_water(dest) {
    const n = this.noiseSrc('pink', true); const f = this.filt('bandpass', 700, 1.5); const g = this.ctx.createGain(); g.gain.value = 0.4;
    const l = this.osc('sine', 0.4); const lg = this.ctx.createGain(); lg.gain.value = 0.25; l.connect(lg).connect(g.gain);
    n.connect(f).connect(g).connect(dest); n.start(); l.start(); return [n, l];
  }
  l_static(dest) { const n = this.noiseSrc('white', true); const f = this.filt('bandpass', 3000, 0.7); const g = this.ctx.createGain(); g.gain.value = 0.15; n.connect(f).connect(g).connect(dest); n.start(); return [n]; }
  l_crowd(dest) { // distant indistinct crowd murmur
    const n = this.noiseSrc('pink', true); const nodes = [n];
    for (const v of ['a', 'o', 'e']) { const b = this.filt('bandpass', VOWELS[v][0], 3); const b2 = this.filt('bandpass', VOWELS[v][1], 5); const g = this.ctx.createGain(); g.gain.value = 0.25; const l = this.osc('sine', 2 + Math.random() * 3); const lg = this.ctx.createGain(); lg.gain.value = 0.2; l.connect(lg).connect(g.gain); n.connect(b).connect(g); n.connect(b2).connect(g); g.connect(dest); l.start(); nodes.push(l); }
    n.start(); return nodes;
  }
  l_hum(dest) { const o = this.osc('sine', 50); const o2 = this.osc('sine', 100); const g = this.ctx.createGain(); g.gain.value = 0.15; o.connect(g); o2.connect(g); g.connect(dest); o.start(); o2.start(); return [o, o2]; }
  l_void(dest) { // the Other Side: breathing, reversed-sounding bed
    const nodes = [];
    const n = this.noiseSrc('brown', true); const f = this.filt('lowpass', 200, 3); const g = this.ctx.createGain(); g.gain.value = 0.7; const l = this.osc('sine', 0.12); const lg = this.ctx.createGain(); lg.gain.value = 0.6; l.connect(lg).connect(g.gain);
    n.connect(f).connect(g).connect(dest); n.start(); l.start(); nodes.push(n, l);
    for (const fr of [41.2, 43.65, 61.7, 123.5, 246.9]) { const o = this.osc('triangle', fr); const og = this.ctx.createGain(); og.gain.value = 0.05; const lv = this.osc('sine', 0.05 + Math.random() * 0.1); const lvg = this.ctx.createGain(); lvg.gain.value = 0.05; lv.connect(lvg).connect(og.gain); o.connect(og).connect(dest); o.start(); lv.start(); nodes.push(o, lv); }
    return nodes;
  }
  l_fire(dest) { const n = this.noiseSrc('brown', true); const f = this.filt('lowpass', 500); const g = this.ctx.createGain(); g.gain.value = 0.5; n.connect(f).connect(g).connect(dest); n.start(); return [n]; }
}
