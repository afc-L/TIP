import { clamp, rand, lerp } from './util.js';

// Fully procedural sound: every noise is synthesised with WebAudio at runtime.
// Positional one-shots use HRTF panners so you can hear *where* a branch snapped.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.vol = { master: 0.8, sfx: 1, music: 0.7, amb: 1 };
    this.tension = 0;
    this.calm = 1; // 1 = wildlife audible, 0 = dead silence
    this.silence = 0; // forced silence (events)
    this.night = 0;
    this.windAmt = 0.3;
    this.rainAmt = 0;
    this.heartRate = 0;
    this._nextBird = 0; this._nextCricket = 0; this._nextOwl = 10; this._nextBeat = 0; this._nextNote = 8; this._nextCreak = 20;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.connect(this.master);
    this.amb = ctx.createGain(); this.amb.connect(this.master);
    this.music = ctx.createGain(); this.music.connect(this.master);
    this.ui = ctx.createGain(); this.ui.connect(this.master);
    // shared reverb (forest)
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(2.8, 2.4);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.5;
    this.reverbSend.connect(this.reverb).connect(this.master);
    // long valley echo for gunshots
    this.echo = ctx.createDelay(2);
    this.echo.delayTime.value = 0.62;
    const fb = ctx.createGain(); fb.gain.value = 0.35;
    const ef = ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 900;
    this.echo.connect(ef).connect(fb).connect(this.echo);
    this.echoIn = ctx.createGain(); this.echoIn.gain.value = 0.5;
    this.echoIn.connect(this.echo);
    ef.connect(this.reverbSend);
    ef.connect(this.sfx);

    this.noiseBuf = this.makeNoise(2, 'white');
    this.brownBuf = this.makeNoise(4, 'brown');
    this.pinkBuf = this.makeNoise(3, 'pink');
    this.startAmbience();
    this.startMusic();
    this.applyVolumes();
    this.ready = true;
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.master, t, 0.05);
    this.sfx.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
    this.music.gain.setTargetAtTime(this.vol.music * 0.9, t, 0.05);
    this.ui.gain.setTargetAtTime(0.6, t, 0.05);
  }

  makeNoise(sec, kind) {
    const ctx = this.ctx;
    const n = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = b.getChannelData(0);
    let last = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else if (kind === 'pink') { b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048; d[i] = (b0 + b1 + b2 + w * 0.02) * 2.2; }
      else d[i] = w;
    }
    return b;
  }

  impulse(sec, decay) {
    const ctx = this.ctx;
    const n = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay) * (i < 200 ? i / 200 : 1);
    }
    return b;
  }

  // ------------------------------------------------------------ routing helpers

  /** Output node for a sound: positional (HRTF panner) or flat. */
  out(pos, { bus = 'sfx', ref = 4, roll = 1.1, reverb = 0.3, max = 300 } = {}) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    let head = g;
    if (pos) {
      const p = ctx.createPanner();
      p.panningModel = 'HRTF';
      p.distanceModel = 'inverse';
      p.refDistance = ref; p.rolloffFactor = roll; p.maxDistance = max;
      if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; }
      else p.setPosition(pos.x, pos.y, pos.z);
      g.connect(p);
      head = p;
    }
    head.connect(this[bus]);
    if (reverb > 0) {
      const s = ctx.createGain(); s.gain.value = reverb;
      head.connect(s).connect(this.reverbSend);
    }
    return g;
  }

  noise(buf = this.noiseBuf, loop = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    s.loop = loop;
    if (!loop) s.loopStart = 0;
    return s;
  }

  env(param, t, a, peak, d, end = 0.0001) {
    param.cancelScheduledValues(t);
    param.setValueAtTime(0.0001, t);
    param.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    param.exponentialRampToValueAtTime(end, t + a + d);
  }

  filter(type, freq, q = 1) {
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    return f;
  }

  updateListener(p, f) {
    if (!this.ctx) return;
    const L = this.ctx.listener;
    const fx = f.x, fy = f.y, fz = f.z;
    if (L.positionX) {
      const t = this.ctx.currentTime;
      L.positionX.setTargetAtTime(p.x, t, 0.02); L.positionY.setTargetAtTime(p.y, t, 0.02); L.positionZ.setTargetAtTime(p.z, t, 0.02);
      L.forwardX.setTargetAtTime(fx, t, 0.02); L.forwardY.setTargetAtTime(fy, t, 0.02); L.forwardZ.setTargetAtTime(fz, t, 0.02);
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else {
      L.setPosition(p.x, p.y, p.z);
      L.setOrientation(fx, fy, fz, 0, 1, 0);
    }
  }

  // ------------------------------------------------------------ ambience

  startAmbience() {
    const ctx = this.ctx;
    // wind: brown noise through a wandering band-pass
    const w = this.noise(this.brownBuf, true);
    const bp = this.filter('bandpass', 400, 0.6);
    const lp = this.filter('lowpass', 1200);
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0.0;
    w.connect(bp).connect(lp).connect(this.windGain).connect(this.amb);
    w.start();
    this.windBP = bp;
    // tree rustle (pink noise, high)
    const r = this.noise(this.pinkBuf, true);
    const hp = this.filter('highpass', 2200, 0.5);
    this.rustleGain = ctx.createGain(); this.rustleGain.gain.value = 0;
    r.connect(hp).connect(this.rustleGain).connect(this.amb);
    r.start();
    // rain
    const rn = this.noise(this.noiseBuf, true);
    const rbp = this.filter('bandpass', 3500, 0.3);
    this.rainGain = ctx.createGain(); this.rainGain.gain.value = 0;
    rn.connect(rbp).connect(this.rainGain).connect(this.amb);
    rn.start();
    // low room tone: the forest "breathing"
    const lo = this.noise(this.brownBuf, true);
    const lpf = this.filter('lowpass', 120);
    this.roomGain = ctx.createGain(); this.roomGain.gain.value = 0.06;
    lo.connect(lpf).connect(this.roomGain).connect(this.amb);
    lo.start();
  }

  startMusic() {
    const ctx = this.ctx;
    // drone: detuned saws in the low register, filtered, swelling with tension
    this.droneGain = ctx.createGain(); this.droneGain.gain.value = 0;
    const lp = this.filter('lowpass', 180, 2);
    this.droneLP = lp;
    lp.connect(this.droneGain).connect(this.music);
    const rs = ctx.createGain(); rs.gain.value = 0.6;
    this.droneGain.connect(rs).connect(this.reverbSend);
    for (const f of [41.2, 41.6, 61.7, 82.0]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = 0.18;
      o.connect(g).connect(lp); o.start();
    }
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lg = ctx.createGain(); lg.gain.value = 70;
    lfo.connect(lg).connect(lp.frequency); lfo.start();
    // high dissonant strings for real danger
    this.highGain = ctx.createGain(); this.highGain.gain.value = 0;
    const hlp = this.filter('bandpass', 1400, 0.8);
    hlp.connect(this.highGain).connect(this.music);
    const hs = ctx.createGain(); hs.gain.value = 0.9;
    this.highGain.connect(hs).connect(this.reverbSend);
    for (const f of [587, 622, 880, 932]) {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const vib = ctx.createOscillator(); vib.frequency.value = 4 + Math.random() * 2;
      const vg = ctx.createGain(); vg.gain.value = 4;
      vib.connect(vg).connect(o.frequency); vib.start();
      const g = ctx.createGain(); g.gain.value = 0.05;
      o.connect(g).connect(hlp); o.start();
    }
  }

  /** Called every frame with the state of the world. */
  update(dt, s) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    this.night = s.night;
    this.tension = lerp(this.tension, s.tension, 1 - Math.exp(-dt * 1.5));
    this.calm = lerp(this.calm, s.calm, 1 - Math.exp(-dt * 0.8));
    const hush = 1 - clamp(this.silence, 0, 1);
    this.silence = Math.max(0, this.silence - dt * 0.05);
    const wind = s.wind;
    this.windGain.gain.setTargetAtTime((0.05 + wind * 0.22) * hush * this.vol.amb, t, 0.4);
    this.windBP.frequency.setTargetAtTime(300 + Math.sin(t * 0.13) * 140 + Math.sin(t * 0.41) * 80 + wind * 300, t, 0.5);
    this.rustleGain.gain.setTargetAtTime((0.008 + wind * 0.03 * (0.6 + 0.4 * Math.sin(t * 0.3))) * hush, t, 0.5);
    this.rainGain.gain.setTargetAtTime(s.rain * 0.13 * (s.indoors ? 0.5 : 1), t, 0.8);
    this.roomGain.gain.setTargetAtTime(0.05 + this.tension * 0.08, t, 1);
    // music
    const drone = clamp(0.03 + s.night * 0.05 + this.tension * 0.35, 0, 0.5) * (s.menu ? 0.7 : 1);
    this.droneGain.gain.setTargetAtTime(drone * (this.silence > 0.5 ? 0.3 : 1), t, 1.2);
    this.highGain.gain.setTargetAtTime(Math.max(0, this.tension - 0.5) * 0.5, t, 0.8);

    if (s.menu) return;
    const now = performance.now() / 1000;
    const p = s.pos;
    // birds by day, crickets / owls by night; all of them stop when something is near
    const life = this.calm * hush;
    if (now > this._nextBird) {
      this._nextBird = now + 1 + rand() * 4;
      if (life > 0.4 && s.night < 0.5 && s.rain < 0.6) this.bird(this.around(p, 15, 60, 6), life * (1 - s.night * 2));
    }
    if (now > this._nextCricket) {
      this._nextCricket = now + 0.4 + rand() * 1.2;
      if (life > 0.5 && s.night > 0.4 && s.rain < 0.5) this.cricket(this.around(p, 6, 30, 0), life * s.night);
    }
    if (now > this._nextOwl) {
      this._nextOwl = now + 25 + rand() * 50;
      if (life > 0.6 && s.night > 0.6) this.owl(this.around(p, 40, 90, 10));
    }
    if (now > this._nextCreak) {
      this._nextCreak = now + 15 + rand() * 30;
      if (wind > 0.3) this.treeCreak(this.around(p, 15, 40, 8));
    }
    if (now > this._nextNote && s.night < 0.3 && this.tension < 0.2 && life > 0.5) {
      this._nextNote = now + 20 + rand() * 40;
      this.calmPhrase();
    }
    // heartbeat
    if (s.fear > 0.35 && now > this._nextBeat) {
      const bpm = 60 + s.fear * 80;
      this._nextBeat = now + 60 / bpm;
      this.heartbeat(clamp((s.fear - 0.35) * 1.5, 0, 1));
    }
  }

  around(p, rMin, rMax, yUp) {
    const a = rand() * Math.PI * 2, r = rMin + rand() * (rMax - rMin);
    return { x: p.x + Math.cos(a) * r, y: p.y + rand() * yUp, z: p.z + Math.sin(a) * r };
  }

  // ------------------------------------------------------------ wildlife

  bird(pos, vol = 1) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = this.out(pos, { bus: 'amb', ref: 6, reverb: 0.4 });
    const kind = Math.floor(rand() * 3);
    const notes = kind === 0 ? 3 + Math.floor(rand() * 4) : kind === 1 ? 2 : 6;
    const base = 2200 + rand() * 2000;
    for (let i = 0; i < notes; i++) {
      const os = ctx.createOscillator(); os.type = 'sine';
      const g = ctx.createGain();
      const st = t + i * (kind === 2 ? 0.07 : 0.16);
      const f0 = base * (kind === 1 ? (i ? 0.8 : 1.1) : 1 + rand() * 0.2);
      os.frequency.setValueAtTime(f0, st);
      os.frequency.exponentialRampToValueAtTime(f0 * (kind === 0 ? 1.4 : 0.7), st + 0.09);
      this.env(g.gain, st, 0.01, 0.08 * vol, 0.1);
      os.connect(g).connect(o);
      os.start(st); os.stop(st + 0.2);
    }
  }

  cricket(pos, vol = 1) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = this.out(pos, { bus: 'amb', ref: 3, reverb: 0.15 });
    const os = ctx.createOscillator(); os.type = 'sine'; os.frequency.value = 4200 + rand() * 600;
    const am = ctx.createOscillator(); am.frequency.value = 28 + rand() * 10;
    const amg = ctx.createGain(); amg.gain.value = 0.5;
    const g = ctx.createGain(); g.gain.value = 0;
    am.connect(amg).connect(g.gain);
    const env = ctx.createGain();
    this.env(env.gain, t, 0.02, 0.025 * vol, 0.35);
    os.connect(g).connect(env).connect(o);
    os.start(t); am.start(t); os.stop(t + 0.45); am.stop(t + 0.45);
  }

  owl(pos) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = this.out(pos, { bus: 'amb', ref: 10, reverb: 0.7 });
    [0, 0.45, 0.7].forEach((d, i) => {
      const os = ctx.createOscillator(); os.type = 'sine';
      os.frequency.setValueAtTime(380, t + d); os.frequency.linearRampToValueAtTime(i === 1 ? 340 : 360, t + d + 0.3);
      const g = ctx.createGain();
      this.env(g.gain, t + d, 0.05, 0.12, i === 2 ? 0.6 : 0.25);
      os.connect(g).connect(o); os.start(t + d); os.stop(t + d + 1);
    });
  }

  treeCreak(pos) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = this.out(pos, { bus: 'amb', ref: 8, reverb: 0.5 });
    const os = ctx.createOscillator(); os.type = 'sawtooth';
    os.frequency.setValueAtTime(90 + rand() * 40, t);
    os.frequency.linearRampToValueAtTime(70 + rand() * 60, t + 1.2);
    const bp = this.filter('bandpass', 600, 8);
    const g = ctx.createGain();
    this.env(g.gain, t, 0.4, 0.05, 1.0);
    os.connect(bp).connect(g).connect(o); os.start(t); os.stop(t + 1.6);
  }

  calmPhrase() {
    // a few sparse, sad piano-ish notes
    const ctx = this.ctx, t = ctx.currentTime;
    const scale = [220, 246.9, 261.6, 329.6, 392, 440];
    const o = this.out(null, { bus: 'music', reverb: 1.2 });
    o.gain.value = 0.5;
    const n = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const st = t + i * (0.9 + rand() * 0.8);
      const os = ctx.createOscillator(); os.type = 'triangle';
      os.frequency.value = scale[Math.floor(rand() * scale.length)] * (rand() < 0.3 ? 0.5 : 1);
      const g = ctx.createGain();
      this.env(g.gain, st, 0.01, 0.06, 2.4);
      os.connect(g).connect(o); os.start(st); os.stop(st + 2.6);
    }
  }

  // ------------------------------------------------------------ player sounds

  footstep(surface, vol = 1, pos = null) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = this.out(pos, { reverb: 0.08, ref: 2 });
    const s = this.noise();
    s.playbackRate.value = 0.8 + rand() * 0.4;
    const g = ctx.createGain();
    let f;
    switch (surface) {
      case 'gravel': f = this.filter('bandpass', 2600 + rand() * 800, 0.9); this.env(g.gain, t, 0.005, 0.3 * vol, 0.14); break;
      case 'wood': {
        f = this.filter('lowpass', 500, 2); this.env(g.gain, t, 0.003, 0.5 * vol, 0.12);
        const os = ctx.createOscillator(); os.frequency.setValueAtTime(140, t); os.frequency.exponentialRampToValueAtTime(70, t + 0.1);
        const og = ctx.createGain(); this.env(og.gain, t, 0.003, 0.25 * vol, 0.12);
        os.connect(og).connect(o); os.start(t); os.stop(t + 0.2);
        break;
      }
      case 'mud': f = this.filter('lowpass', 650, 3); this.env(g.gain, t, 0.02, 0.45 * vol, 0.2); f.frequency.exponentialRampToValueAtTime(250, t + 0.2); break;
      case 'water': f = this.filter('bandpass', 1400, 0.7); this.env(g.gain, t, 0.01, 0.4 * vol, 0.3); f.frequency.exponentialRampToValueAtTime(600, t + 0.3); break;
      default: f = this.filter('bandpass', 1100 + rand() * 500, 0.6); this.env(g.gain, t, 0.01, 0.22 * vol, 0.16); // grass / needles
    }
    s.connect(f).connect(g).connect(o);
    s.start(t, rand() * 1.5, 0.4);
  }

  land() { this.footstep('grass', 1.8); }

  gunshot() {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = this.out(null, { reverb: 1.6 });
    // crack
    const s = this.noise();
    const lp = this.filter('lowpass', 5000, 0.5);
    lp.frequency.setValueAtTime(6000, t); lp.frequency.exponentialRampToValueAtTime(300, t + 0.3);
    const g = ctx.createGain();
    this.env(g.gain, t, 0.001, 1.6, 0.45);
    s.connect(lp).connect(g).connect(o);
    g.connect(this.echoIn);
    s.start(t, 0, 1);
    // boom
    const os = ctx.createOscillator(); os.type = 'sine';
    os.frequency.setValueAtTime(110, t); os.frequency.exponentialRampToValueAtTime(35, t + 0.4);
    const og = ctx.createGain(); this.env(og.gain, t, 0.002, 1.2, 0.5);
    os.connect(og).connect(o); os.start(t); os.stop(t + 0.6);
  }

  click(freq = 3000, vol = 0.3, when = 0) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const o = this.out(null, { reverb: 0.05 });
    const s = this.noise();
    const bp = this.filter('bandpass', freq, 3);
    const g = ctx.createGain(); this.env(g.gain, t, 0.001, vol, 0.04);
    s.connect(bp).connect(g).connect(o); s.start(t, rand(), 0.08);
  }

  bolt() { this.click(1800, 0.4); this.click(2600, 0.35, 0.12); this.click(2000, 0.4, 0.28); this.click(3200, 0.3, 0.38); }
  reload() { for (let i = 0; i < 4; i++) this.click(2400 + rand() * 600, 0.3, 0.3 + i * 0.32); this.bolt(); }
  dryFire() { this.click(4000, 0.35); }
  flashlight() { this.click(5000, 0.25); this.click(3000, 0.15, 0.02); }
  pickup() { this.click(1200, 0.25); this.click(1800, 0.2, 0.06); }
  uiClick() { if (this.ready) this.click(2200, 0.15); }
  page() {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = this.out(null, { bus: 'ui', reverb: 0 });
    const s = this.noise(); const hp = this.filter('highpass', 2500); const g = ctx.createGain();
    this.env(g.gain, t, 0.05, 0.25, 0.25);
    s.connect(hp).connect(g).connect(o); s.start(t, rand(), 0.4);
  }
  eat() { for (let i = 0; i < 3; i++) this.click(600 + rand() * 300, 0.4, i * 0.25); }

  heartbeat(vol) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = this.out(null, { reverb: 0 });
    [0, 0.16].forEach((d, i) => {
      const os = ctx.createOscillator(); os.frequency.setValueAtTime(i ? 48 : 58, t + d); os.frequency.exponentialRampToValueAtTime(30, t + d + 0.12);
      const g = ctx.createGain(); this.env(g.gain, t + d, 0.01, 0.6 * vol * (i ? 0.7 : 1), 0.14);
      os.connect(g).connect(o); os.start(t + d); os.stop(t + d + 0.2);
    });
  }

  breathing(vol) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = this.out(null, { reverb: 0 });
    const s = this.noise(this.pinkBuf); const bp = this.filter('bandpass', 900, 0.8); const g = ctx.createGain();
    this.env(g.gain, t, 0.25, 0.12 * vol, 0.5);
    s.connect(bp).connect(g).connect(o); s.start(t, rand(), 1);
  }

  hurt() {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = this.out(null, { reverb: 0.2 });
    const s = this.noise(); const lp = this.filter('lowpass', 800); const g = ctx.createGain();
    this.env(g.gain, t, 0.005, 1.2, 0.4);
    s.connect(lp).connect(g).connect(o); s.start(t, 0, 0.5);
    const os = ctx.createOscillator(); os.type = 'sawtooth'; os.frequency.setValueAtTime(200, t); os.frequency.exponentialRampToValueAtTime(60, t + 0.4);
    const og = ctx.createGain(); this.env(og.gain, t, 0.005, 0.4, 0.4);
    os.connect(this.filter('lowpass', 600)).connect(og).connect(o); os.start(t); os.stop(t + 0.5);
  }

  // ------------------------------------------------------------ animals

  deerSnort(pos) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = this.out(pos, { ref: 6, reverb: 0.4 });
    const s = this.noise(); const bp = this.filter('bandpass', 700, 1.5); const g = ctx.createGain();
    this.env(g.gain, t, 0.01, 0.5, 0.35);
    s.connect(bp).connect(g).connect(o); s.start(t, rand(), 0.5);
  }

  deerBleat(pos) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = this.out(pos, { ref: 6, reverb: 0.5 });
    const os = ctx.createOscillator(); os.type = 'sawtooth';
    os.frequency.setValueAtTime(520, t); os.frequency.linearRampToValueAtTime(380, t + 0.5);
    const g = ctx.createGain(); this.env(g.gain, t, 0.04, 0.12, 0.5);
    os.connect(this.filter('bandpass', 1200, 2)).connect(g).connect(o); os.start(t); os.stop(t + 0.6);
  }

  hooves(pos, n = 6) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = this.out(pos, { ref: 5, reverb: 0.3 });
    for (let i = 0; i < n; i++) {
      const st = t + i * 0.11 + rand() * 0.03;
      const s = this.noise(); const lp = this.filter('lowpass', 500); const g = ctx.createGain();
      this.env(g.gain, st, 0.003, 0.35, 0.07);
      s.connect(lp).connect(g).connect(o); s.start(st, rand(), 0.1);
    }
  }

  wingFlaps(pos) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = this.out(pos, { ref: 6, reverb: 0.4 });
    for (let i = 0; i < 14; i++) {
      const st = t + i * 0.07 + rand() * 0.05;
      const s = this.noise(); const bp = this.filter('bandpass', 800 + rand() * 600, 1); const g = ctx.createGain();
      this.env(g.gain, st, 0.01, 0.2, 0.06);
      s.connect(bp).connect(g).connect(o); s.start(st, rand(), 0.1);
    }
    // caws
    for (let i = 0; i < 3; i++) {
      const st = t + 0.2 + i * 0.35;
      const os = ctx.createOscillator(); os.type = 'sawtooth'; os.frequency.setValueAtTime(700, st); os.frequency.linearRampToValueAtTime(500, st + 0.2);
      const g = ctx.createGain(); this.env(g.gain, st, 0.01, 0.07, 0.2);
      os.connect(this.filter('bandpass', 1500, 3)).connect(g).connect(o); os.start(st); os.stop(st + 0.3);
    }
  }

  // ------------------------------------------------------------ horror

  branchSnap(pos, vol = 1) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = this.out(pos, { ref: 5, reverb: 0.6 });
    for (let i = 0; i < 3; i++) {
      const st = t + i * 0.025 * rand();
      const s = this.noise(); const hp = this.filter('bandpass', 2000 + rand() * 1500, 1.2); const g = ctx.createGain();
      this.env(g.gain, st, 0.001, 0.9 * vol, 0.05 + rand() * 0.05);
      s.connect(hp).connect(g).connect(o); s.start(st, rand(), 0.15);
    }
  }

  knock(pos, n = 3) {
    // wood-on-wood knocks echoing through the trees
    const ctx = this.ctx, t = ctx.currentTime;
    const o = this.out(pos, { ref: 15, reverb: 1.4 });
    for (let i = 0; i < n; i++) {
      const st = t + i * (0.55 + rand() * 0.2);
      const os = ctx.createOscillator(); os.type = 'sine';
      os.frequency.setValueAtTime(420, st); os.frequency.exponentialRampToValueAtTime(180, st + 0.08);
      const g = ctx.createGain(); this.env(g.gain, st, 0.001, 0.9, 0.14);
      const s = this.noise(); const bp = this.filter('bandpass', 900, 4); const g2 = ctx.createGain();
      this.env(g2.gain, st, 0.001, 0.6, 0.06);
      os.connect(g).connect(o); s.connect(bp).connect(g2).connect(o);
      os.start(st); os.stop(st + 0.2); s.start(st, rand(), 0.1);
    }
  }

  creatureStep(pos, vol = 1) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = this.out(pos, { ref: 4, reverb: 0.4 });
    const s = this.noise(); const lp = this.filter('lowpass', 380, 1.5); const g = ctx.createGain();
    this.env(g.gain, t, 0.01, 0.7 * vol, 0.22);
    s.connect(lp).connect(g).connect(o); s.start(t, rand(), 0.3);
    if (rand() < 0.35) this.branchSnap(pos, 0.4 * vol);
  }

  growl(pos, dur = 2, vol = 1) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = this.out(pos, { ref: 5, reverb: 0.8 });
    const os = ctx.createOscillator(); os.type = 'sawtooth'; os.frequency.value = 52;
    const jit = ctx.createOscillator(); jit.type = 'square'; jit.frequency.value = 23;
    const jg = ctx.createGain(); jg.gain.value = 18;
    jit.connect(jg).connect(os.frequency);
    const s = this.noise(this.brownBuf);
    const lp = this.filter('lowpass', 420, 4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 * vol, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    os.connect(lp); s.connect(lp); lp.connect(g).connect(o);
    os.start(t); jit.start(t); s.start(t, rand());
    os.stop(t + dur); jit.stop(t + dur); s.stop(t + dur);
  }

  shriek(pos, vol = 1) {
    // detuned, pitch-falling scream: the thing you do not want to hear behind you
    const ctx = this.ctx, t = ctx.currentTime;
    const o = this.out(pos, { ref: 8, reverb: 1.2 });
    const dur = 1.6;
    for (const det of [0, 37, -52, 93]) {
      const os = ctx.createOscillator(); os.type = 'sawtooth';
      os.frequency.setValueAtTime(1100 + det, t); os.frequency.exponentialRampToValueAtTime(380 + det, t + dur);
      const vib = ctx.createOscillator(); vib.frequency.value = 11 + rand() * 6; const vg = ctx.createGain(); vg.gain.value = 40;
      vib.connect(vg).connect(os.frequency);
      const g = ctx.createGain(); this.env(g.gain, t, 0.04, 0.14 * vol, dur);
      os.connect(this.filter('bandpass', 1600, 1.5)).connect(g).connect(o);
      os.start(t); vib.start(t); os.stop(t + dur + 0.1); vib.stop(t + dur + 0.1);
    }
    const s = this.noise(); const hp = this.filter('highpass', 1500); const g = ctx.createGain();
    this.env(g.gain, t, 0.02, 0.4 * vol, dur * 0.8);
    s.connect(hp).connect(g).connect(o); s.start(t, 0, dur);
  }

  whisper(pos) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = this.out(pos, { ref: 2, reverb: 0.9 });
    for (let i = 0; i < 6; i++) {
      const st = t + i * 0.18 + rand() * 0.1;
      const s = this.noise(this.pinkBuf); const bp = this.filter('bandpass', 1800 + rand() * 1800, 4); const g = ctx.createGain();
      this.env(g.gain, st, 0.05, 0.12, 0.15);
      s.connect(bp).connect(g).connect(o); s.start(st, rand(), 0.3);
    }
  }

  /** Short dissonant swell for sightings. */
  stinger(vol = 1) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = this.out(null, { bus: 'music', reverb: 1.5 });
    for (const f of [110, 116.5, 155.6, 233, 246.9]) {
      const os = ctx.createOscillator(); os.type = 'sawtooth'; os.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09 * vol, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);
      os.connect(this.filter('lowpass', 1800)).connect(g).connect(o); os.start(t); os.stop(t + 2.6);
    }
    const s = this.noise(); const g = ctx.createGain(); this.env(g.gain, t, 0.01, 0.3 * vol, 0.6);
    s.connect(this.filter('highpass', 3000)).connect(g).connect(o); s.start(t, 0, 0.8);
  }

  /** Low impact for jump scares. */
  impact(vol = 1) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = this.out(null, { bus: 'music', reverb: 1.0 });
    const os = ctx.createOscillator(); os.frequency.setValueAtTime(70, t); os.frequency.exponentialRampToValueAtTime(25, t + 1.2);
    const g = ctx.createGain(); this.env(g.gain, t, 0.005, 1.0 * vol, 1.3);
    os.connect(g).connect(o); os.start(t); os.stop(t + 1.5);
    this.stinger(vol);
  }

  thunder() {
    const ctx = this.ctx, t = ctx.currentTime + 0.5 + rand() * 1.5;
    const o = this.out(null, { bus: 'amb', reverb: 1.5 });
    const s = this.noise(this.brownBuf); const lp = this.filter('lowpass', 300); const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + 4);
    s.connect(lp).connect(g).connect(o); s.start(t, rand(), 4.2);
  }

  // ------------------------------------------------------------ radio

  radioStatic(dur = 1, vol = 0.3) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = this.out(null, { reverb: 0.05 });
    const s = this.noise(); const bp = this.filter('bandpass', 2200, 0.4); const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
    g.gain.setValueAtTime(vol, t + dur - 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    // crackle
    const am = ctx.createOscillator(); am.type = 'square'; am.frequency.value = 7 + rand() * 9; const amg = ctx.createGain(); amg.gain.value = vol * 0.5;
    am.connect(amg).connect(g.gain);
    s.connect(bp).connect(g).connect(o); s.start(t, 0, dur + 0.1); am.start(t); am.stop(t + dur);
  }

  /** Continuous radio hiss whose clarity follows signal strength (0..1). */
  setRadioHiss(on, strength = 0) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    if (!this.hiss) {
      const s = this.noise(this.noiseBuf, true);
      this.hissBP = this.filter('bandpass', 2400, 0.5);
      this.hiss = ctx.createGain(); this.hiss.gain.value = 0;
      s.connect(this.hissBP).connect(this.hiss).connect(this.sfx); s.start();
      // beep tone that gets faster/clearer closer to the source
      this.beepOsc = ctx.createOscillator(); this.beepOsc.frequency.value = 880;
      this.beep = ctx.createGain(); this.beep.gain.value = 0;
      this.beepOsc.connect(this.beep).connect(this.sfx); this.beepOsc.start();
    }
    this.hiss.gain.setTargetAtTime(on ? 0.05 + (1 - strength) * 0.06 : 0, t, 0.1);
    this.hissBP.frequency.setTargetAtTime(1500 + strength * 2000, t, 0.2);
    if (on && strength > 0.05) {
      const now = performance.now() / 1000;
      if (!this._nextBeep || now > this._nextBeep) {
        this._nextBeep = now + lerp(1.6, 0.18, strength);
        this.beep.gain.cancelScheduledValues(t);
        this.beep.gain.setValueAtTime(0.0001, t);
        this.beep.gain.exponentialRampToValueAtTime(0.05 * strength + 0.01, t + 0.01);
        this.beep.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      }
    }
  }

  // ------------------------------------------------------------ loops at places

  /** Positional looping source (fire crackle, generator hum, helicopter). Returns a handle with stop(). */
  loop(kind, pos) {
    if (!this.ready) return { stop() {}, setPos() {}, setGain() {} };
    const ctx = this.ctx, t = ctx.currentTime;
    const o = this.out(pos, { ref: kind === 'heli' ? 40 : 3, reverb: 0.3 });
    const nodes = [];
    if (kind === 'fire') {
      const s = this.noise(this.brownBuf, true); const lp = this.filter('lowpass', 600); const g = ctx.createGain(); g.gain.value = 0.25;
      s.connect(lp).connect(g).connect(o); s.start(); nodes.push(s);
      const c = this.noise(this.noiseBuf, true); const hp = this.filter('highpass', 3000); const cg = ctx.createGain(); cg.gain.value = 0;
      const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 13; const lg = ctx.createGain(); lg.gain.value = 0.06;
      lfo.connect(lg).connect(cg.gain); c.connect(hp).connect(cg).connect(o); c.start(); lfo.start(); nodes.push(c, lfo);
    } else if (kind === 'generator') {
      const os = ctx.createOscillator(); os.type = 'sawtooth'; os.frequency.value = 58;
      const g = ctx.createGain(); g.gain.value = 0.08;
      os.connect(this.filter('lowpass', 300)).connect(g).connect(o); os.start(); nodes.push(os);
      const am = ctx.createOscillator(); am.frequency.value = 8; const ag = ctx.createGain(); ag.gain.value = 0.03;
      am.connect(ag).connect(g.gain); am.start(); nodes.push(am);
    } else if (kind === 'heli') {
      const s = this.noise(this.brownBuf, true); const lp = this.filter('lowpass', 400); const g = ctx.createGain(); g.gain.value = 0.0;
      const am = ctx.createOscillator(); am.type = 'square'; am.frequency.value = 11; const ag = ctx.createGain(); ag.gain.value = 0.5;
      am.connect(ag).connect(g.gain);
      s.connect(lp).connect(g).connect(o); s.start(); am.start(); nodes.push(s, am);
    }
    return {
      stop: () => { nodes.forEach((n) => { try { n.stop(); } catch (e) { /* already stopped */ } }); o.disconnect(); },
      setGain: (v) => o.gain.setTargetAtTime(v, ctx.currentTime, 0.3),
      node: o,
    };
  }
}
