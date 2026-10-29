// Procedural sound effects and ambient music using the Web Audio API (no audio files needed).
(function () {
  const RW = window.RW;
  let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
  const last = {};
  let musicTimer = null, musicMode = null, dinGain = null, dinSrc = null;

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applySettings();
  }

  function applySettings() {
    if (!ctx) return;
    const s = RW.settings;
    master.gain.value = s.volume;
    sfxBus.gain.value = s.sfx ? 1 : 0;
    musicBus.gain.value = s.music ? 0.35 : 0;
  }

  // Avoid stacking dozens of identical sounds in one frame.
  function throttle(key, ms) {
    const now = performance.now();
    if (last[key] && now - last[key] < ms) return false;
    last[key] = now;
    return true;
  }

  function noise(dur, filterType, freq, q, vol, attack = 0.005, freqEnd) {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = filterType; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(sfxBus);
    src.start(t, Math.random() * 1.5, dur + 0.05);
  }

  function tone(type, f0, f1, dur, vol, bus = sfxBus, delay = 0) {
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.03, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  const sounds = {
    click() { tone('triangle', 660, 520, 0.08, 0.15); },
    hover() { tone('sine', 900, 900, 0.03, 0.03); },
    select() { tone('triangle', 520, 780, 0.1, 0.12); },
    order() { tone('square', 220, 180, 0.08, 0.05); noise(0.12, 'bandpass', 900, 2, 0.05); },
    error() { tone('sawtooth', 160, 110, 0.18, 0.08); },
    coin() { tone('sine', 1320, 1320, 0.08, 0.1); tone('sine', 1760, 1760, 0.15, 0.08, sfxBus, 0.07); },
    build() { noise(0.25, 'lowpass', 600, 1, 0.25); tone('square', 140, 90, 0.2, 0.05); },
    turn() { tone('triangle', 196, 196, 0.6, 0.12); tone('triangle', 294, 294, 0.6, 0.08, sfxBus, 0.15); },
    clash() { noise(0.12, 'bandpass', 2600 + Math.random() * 1800, 6, 0.18); tone('triangle', 900 + Math.random() * 600, 700, 0.12, 0.04); },
    thud() { noise(0.18, 'lowpass', 420, 1, 0.3); },
    arrows() { noise(0.4, 'highpass', 3000, 0.7, 0.07, 0.05, 6000); },
    boom() { noise(0.9, 'lowpass', 900, 0.8, 0.6, 0.005, 60); tone('sine', 90, 30, 0.8, 0.4); },
    magic() { tone('sine', 400, 1600, 0.5, 0.12); tone('triangle', 800, 2400, 0.4, 0.05, sfxBus, 0.05); noise(0.5, 'bandpass', 5000, 3, 0.04); },
    heal() { [523, 659, 784, 1046].forEach((f, i) => tone('sine', f, f, 0.5, 0.07, sfxBus, i * 0.08)); },
    horn() {
      const t = ctx.currentTime;
      [110, 165, 220].forEach((f, i) => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 0.97, t); o.frequency.linearRampToValueAtTime(f, t + 0.3);
        const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 900;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12 / (i + 1), t + 0.25); g.gain.setValueAtTime(0.12 / (i + 1), t + 1.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
        o.connect(fl); fl.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 2);
      });
    },
    charge() { noise(0.9, 'lowpass', 300, 1, 0.35, 0.1); tone('sawtooth', 130, 170, 0.5, 0.04); },
    rout() { tone('sawtooth', 300, 120, 0.6, 0.05); },
    victory() { [392, 494, 587, 784].forEach((f, i) => tone('triangle', f, f, 0.9, 0.12, sfxBus, i * 0.18)); },
    defeat() { [392, 349, 311, 262].forEach((f, i) => tone('triangle', f, f * 0.98, 1.0, 0.12, sfxBus, i * 0.3)); },
  };

  // Ambient generative music: slow minor-key pads (campaign) or tenser pads with drums (battle).
  const CHORDS = [[220, 261.6, 329.6], [196, 246.9, 293.7], [174.6, 220, 261.6], [164.8, 196, 246.9]];
  function musicStep(i) {
    if (!ctx || !musicMode) return;
    const ch = CHORDS[i % CHORDS.length];
    const dur = musicMode === 'battle' ? 3.2 : 5;
    const t = ctx.currentTime;
    ch.forEach((f, k) => {
      const o = ctx.createOscillator(); o.type = k === 0 ? 'triangle' : 'sine';
      o.frequency.value = (musicMode === 'battle' ? f * 0.5 : f) * (k === 0 ? 0.5 : 1);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + dur * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.6);
      o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + 0.7);
    });
    if (musicMode === 'battle') {
      for (let b = 0; b < 4; b++) {
        const tt = t + b * (dur / 4);
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(110, tt); o.frequency.exponentialRampToValueAtTime(40, tt + 0.25);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.25, tt); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.3);
        o.connect(g); g.connect(musicBus); o.start(tt); o.stop(tt + 0.35);
      }
    } else if (Math.random() < 0.6) {
      const f = ch[Math.floor(Math.random() * 3)] * 2;
      tone('sine', f, f, 1.6, 0.03, musicBus, 1 + Math.random() * 2);
    }
    musicTimer = setTimeout(() => musicStep(i + 1), dur * 1000);
  }

  RW.audio = {
    init,
    applySettings,
    play(name, throttleMs = 40) {
      if (!ctx || !RW.settings.sfx || !sounds[name]) return;
      if (ctx.state !== 'running') return;
      if (!throttle(name, throttleMs)) return;
      try { sounds[name](); } catch (e) { /* ignore audio errors */ }
    },
    music(mode) {
      if (!ctx) return;
      if (musicMode === mode) return;
      musicMode = mode;
      clearTimeout(musicTimer);
      if (mode) musicStep(0);
    },
    // Continuous battle noise; level 0..1 follows how much fighting is happening.
    din(level) {
      if (!ctx) return;
      if (!dinSrc) {
        dinSrc = ctx.createBufferSource(); dinSrc.buffer = noiseBuf; dinSrc.loop = true;
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.6;
        dinGain = ctx.createGain(); dinGain.gain.value = 0;
        dinSrc.connect(f); f.connect(dinGain); dinGain.connect(sfxBus); dinSrc.start();
      }
      dinGain.gain.setTargetAtTime(Math.min(1, level) * 0.12, ctx.currentTime, 0.3);
    },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx && ctx.state !== 'running') ctx.resume(); },
  };
})();
