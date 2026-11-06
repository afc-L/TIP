'use strict';
// Procedural chiptune engine (WebAudio). All music is composed at runtime from seeded
// generators, so every track is original and nothing needs to be downloaded.
MB.audio = (function () {
  let ctx = null, master, musicGain, sfxGain, noiseBuf;
  let musicVol = 0.5, sfxVol = 0.7, enabled = true;
  let current = null, currentName = null, timer = null;
  const cache = {};

  const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
    mixo: [0, 2, 4, 5, 7, 9, 10], harm: [0, 2, 3, 5, 7, 8, 11], phryg: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11],
    penta: [0, 2, 4, 7, 9, 12, 14],
  };
  // mood presets: tempo, scale, root midi, progression (scale degrees), drum style, lead wave
  const MOODS = {
    title: { bpm: 112, scale: 'lydian', root: 62, prog: [0, 4, 5, 3], drums: 'march', lead: 'square', bass: 'triangle', swing: 0 },
    town: { bpm: 100, scale: 'major', root: 60, prog: [0, 3, 4, 0], drums: 'soft', lead: 'square', bass: 'triangle' },
    village: { bpm: 88, scale: 'major', root: 65, prog: [0, 5, 3, 4], drums: 'soft', lead: 'triangle', bass: 'triangle' },
    city: { bpm: 118, scale: 'mixo', root: 62, prog: [0, 6, 3, 4], drums: 'pop', lead: 'square', bass: 'square' },
    route: { bpm: 128, scale: 'major', root: 64, prog: [0, 4, 5, 3], drums: 'pop', lead: 'square', bass: 'triangle' },
    forest: { bpm: 96, scale: 'dorian', root: 62, prog: [0, 6, 3, 4], drums: 'soft', lead: 'triangle', bass: 'triangle' },
    cave: { bpm: 80, scale: 'phryg', root: 57, prog: [0, 1, 0, 6], drums: 'sparse', lead: 'triangle', bass: 'triangle' },
    desert: { bpm: 104, scale: 'harm', root: 62, prog: [0, 1, 0, 6], drums: 'tribal', lead: 'square', bass: 'triangle' },
    snow: { bpm: 84, scale: 'minor', root: 66, prog: [0, 5, 2, 6], drums: 'sparse', lead: 'triangle', bass: 'triangle' },
    sea: { bpm: 110, scale: 'mixo', root: 60, prog: [0, 3, 6, 4], drums: 'pop', lead: 'square', bass: 'triangle' },
    marsh: { bpm: 78, scale: 'harm', root: 55, prog: [0, 5, 1, 4], drums: 'sparse', lead: 'triangle', bass: 'square' },
    volcano: { bpm: 132, scale: 'phryg', root: 52, prog: [0, 1, 6, 0], drums: 'rock', lead: 'square', bass: 'square' },
    ruins: { bpm: 72, scale: 'harm', root: 57, prog: [0, 5, 4, 0], drums: 'sparse', lead: 'triangle', bass: 'triangle' },
    sky: { bpm: 108, scale: 'lydian', root: 67, prog: [0, 1, 4, 3], drums: 'soft', lead: 'square', bass: 'triangle' },
    lab: { bpm: 96, scale: 'major', root: 60, prog: [0, 4, 3, 4], drums: 'soft', lead: 'square', bass: 'triangle' },
    center: { bpm: 92, scale: 'major', root: 67, prog: [0, 3, 0, 4], drums: 'soft', lead: 'triangle', bass: 'triangle' },
    gym: { bpm: 124, scale: 'mixo', root: 62, prog: [0, 6, 0, 4], drums: 'march', lead: 'square', bass: 'square' },
    syndicate: { bpm: 120, scale: 'harm', root: 57, prog: [0, 5, 6, 4], drums: 'rock', lead: 'square', bass: 'square' },
    rift: { bpm: 90, scale: 'lydian', root: 58, prog: [0, 1, 5, 4], drums: 'sparse', lead: 'triangle', bass: 'square' },
    wild: { bpm: 150, scale: 'minor', root: 60, prog: [0, 6, 5, 4], drums: 'battle', lead: 'square', bass: 'square' },
    trainer: { bpm: 158, scale: 'harm', root: 62, prog: [0, 5, 6, 4], drums: 'battle', lead: 'square', bass: 'square' },
    gymbattle: { bpm: 164, scale: 'minor', root: 57, prog: [0, 3, 6, 4], drums: 'battle', lead: 'square', bass: 'square' },
    rival: { bpm: 168, scale: 'dorian', root: 59, prog: [0, 6, 3, 4], drums: 'battle', lead: 'square', bass: 'square' },
    evil: { bpm: 156, scale: 'phryg', root: 55, prog: [0, 1, 0, 6], drums: 'battle', lead: 'square', bass: 'square' },
    legend: { bpm: 140, scale: 'harm', root: 52, prog: [0, 5, 1, 4], drums: 'epic', lead: 'square', bass: 'square' },
    champion: { bpm: 172, scale: 'minor', root: 58, prog: [0, 5, 3, 4], drums: 'epic', lead: 'square', bass: 'square' },
    final: { bpm: 176, scale: 'phryg', root: 50, prog: [0, 1, 5, 4], drums: 'epic', lead: 'square', bass: 'square' },
    victory: { bpm: 132, scale: 'major', root: 64, prog: [0, 3, 4, 0], drums: 'pop', lead: 'square', bass: 'triangle' },
    evolve: { bpm: 100, scale: 'lydian', root: 64, prog: [0, 1, 4, 0], drums: 'soft', lead: 'triangle', bass: 'triangle' },
    festival: { bpm: 136, scale: 'major', root: 62, prog: [0, 4, 5, 3], drums: 'tribal', lead: 'square', bass: 'triangle' },
  };

  function init() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { enabled = false; return; }
    master = ctx.createGain(); master.gain.value = 0.6; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = musicVol * 0.5; musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value = sfxVol; sfxGain.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function tone(dest, t, freq, dur, wave, vol, opts = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = wave; o.frequency.setValueAtTime(freq, t);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slide), t + dur);
    if (opts.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 6; lg.gain.value = freq * 0.012; l.connect(lg); lg.connect(o.frequency); l.start(t + 0.08); l.stop(t + dur + 0.05); }
    const a = opts.attack || 0.005, r = opts.release || Math.min(0.08, dur * 0.4);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.setValueAtTime(vol * (opts.sustain || 0.8), t + Math.max(a, dur - r));
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dest, t, dur, vol, hp) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 1000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t); s.stop(t + dur + 0.02);
  }

  // ---------- composition ----------
  function compose(name) {
    if (cache[name]) return cache[name];
    const base = name.split(':')[0];
    const mood = Object.assign({}, MOODS[base] || MOODS.route);
    const rng = new MB.RNG('music:' + name);
    if (name.includes(':')) { mood.root += rng.int(-3, 3); mood.bpm += rng.int(-8, 8); if (rng.chance(0.4)) mood.prog = rng.shuffle(mood.prog.slice()); }
    const sc = SCALES[mood.scale];
    const deg = (d, oct) => { const n = sc.length; const o = Math.floor(d / n); const i = ((d % n) + n) % n; return mood.root + sc[i] + 12 * (o + (oct || 0)); };
    const bars = 16, steps = bars * 16;
    const lead = [], harm = [], bass = [], drums = [];
    // rhythm motifs (16 steps, 1=note start)
    const motifs = [
      [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0], [1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0], [1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 0, 0],
      [1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0], [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0], [1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0],
    ];
    const fast = mood.drums === 'battle' || mood.drums === 'epic' || mood.drums === 'rock';
    const mA = rng.pick(motifs), mB = rng.pick(motifs);
    // melodic phrase generator: produce phrase for 2 bars, reused with variation (AABA form)
    function phrase(chordA, chordB, motif, seedOff) {
      const r = new MB.RNG('phr:' + name + seedOff);
      const notes = [];
      let cur = chordA + r.pick([0, 2, 4]);
      for (let b = 0; b < 2; b++) {
        const ch = b === 0 ? chordA : chordB;
        for (let s = 0; s < 16; s++) {
          if (!motif[s]) continue;
          const strong = s % 4 === 0;
          if (strong) { const tgt = ch + r.pick([0, 2, 4, 7]); cur = Math.abs(tgt - cur) > 4 ? tgt : tgt; }
          else cur += r.pick([-1, 1, 1, -2, 2, 0]);
          cur = MB.clamp(cur, ch - 3, ch + 9);
          let len = 1; while (s + len < 16 && !motif[s + len]) len++;
          notes.push({ s: b * 16 + s, d: deg(cur, 1), len });
        }
      }
      return notes;
    }
    const prog = mood.prog;
    const phrases = [];
    for (let p = 0; p < 4; p++) phrases.push(phrase(prog[p % 4], prog[(p + 1) % 4], p % 2 ? mB : mA, p));
    const form = [0, 1, 0, 2, 0, 1, 3, 1];
    for (let sec = 0; sec < 8; sec++) {
      const ph = phrases[form[sec]];
      for (const n of ph) lead.push({ s: sec * 32 + n.s, m: n.d + (sec >= 4 && rng.chance(0.15) ? 12 : 0), len: n.len });
    }
    for (let b = 0; b < bars; b++) {
      const ch = prog[Math.floor(b / 1) % 4];
      const root = deg(ch, -2);
      const pat = fast ? [0, 2, 4, 6, 8, 10, 12, 14] : [0, 6, 8, 12];
      for (const s of pat) bass.push({ s: b * 16 + s, m: root + (s % 8 === 4 && fast ? 7 : 0) + (s === 12 && !fast ? 7 : 0), len: fast ? 2 : 3 });
      // arpeggio harmony
      const arp = [deg(ch, 0), deg(ch + 2, 0), deg(ch + 4, 0), deg(ch + 2, 0)];
      const harmStep = fast ? 2 : 4;
      for (let s = 0; s < 16; s += harmStep) harm.push({ s: b * 16 + s, m: arp[(s / harmStep) % 4], len: harmStep });
      // drums
      for (let s = 0; s < 16; s++) {
        let k = 0, sn = 0, h = 0;
        switch (mood.drums) {
          case 'battle': case 'epic': k = s % 4 === 0 || s === 10; sn = s % 8 === 4; h = s % 2 === 0; break;
          case 'rock': k = s === 0 || s === 8 || s === 10; sn = s % 8 === 4; h = s % 2 === 0; break;
          case 'pop': k = s === 0 || s === 8 || s === 11; sn = s % 8 === 4; h = s % 4 === 2; break;
          case 'march': k = s % 4 === 0; sn = s === 12 || s === 14 || s === 4; h = 0; break;
          case 'tribal': k = s === 0 || s === 3 || s === 8 || s === 11; sn = s === 6 || s === 14; h = s % 4 === 2; break;
          case 'soft': k = s === 0 || s === 8; sn = s === 12; h = s % 4 === 2; break;
          case 'sparse': k = s === 0 && b % 2 === 0; sn = 0; h = s === 8; break;
        }
        if (k) drums.push({ s: b * 16 + s, t: 'k' });
        if (sn) drums.push({ s: b * 16 + s, t: 's' });
        if (h) drums.push({ s: b * 16 + s, t: 'h' });
      }
    }
    const tr = { mood, steps, lead, harm, bass, drums, stepDur: 60 / mood.bpm / 4 };
    // index by step
    tr.byStep = Array.from({ length: steps }, () => []);
    for (const n of lead) tr.byStep[n.s % steps].push(['lead', n]);
    for (const n of harm) tr.byStep[n.s % steps].push(['harm', n]);
    for (const n of bass) tr.byStep[n.s % steps].push(['bass', n]);
    for (const n of drums) tr.byStep[n.s % steps].push(['drum', n]);
    cache[name] = tr;
    return tr;
  }

  function scheduleStep(tr, step, t) {
    for (const [part, n] of tr.byStep[step]) {
      const dur = n.len * tr.stepDur;
      if (part === 'lead') tone(musicGain, t, mtof(n.m), dur * 0.92, tr.mood.lead, 0.13, { vib: dur > 0.3 });
      else if (part === 'harm') tone(musicGain, t, mtof(n.m), dur * 0.8, 'square', 0.035);
      else if (part === 'bass') tone(musicGain, t, mtof(n.m), dur * 0.85, tr.mood.bass, tr.mood.bass === 'square' ? 0.06 : 0.16);
      else if (part === 'drum') {
        if (n.t === 'k') tone(musicGain, t, 120, 0.12, 'sine', 0.35, { slide: 40 });
        else if (n.t === 's') noise(musicGain, t, 0.12, 0.18, 1500);
        else noise(musicGain, t, 0.03, 0.06, 7000);
      }
    }
  }

  function play(name, opts = {}) {
    if (!enabled) { currentName = name; return; }
    if (name === currentName && current) return;
    currentName = name;
    if (!ctx || ctx.state !== 'running') return; // will start on unlock
    stopMusic(true);
    if (!name) return;
    const tr = compose(name);
    const st = { tr, step: 0, next: ctx.currentTime + 0.08, once: !!opts.once };
    current = st;
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setValueAtTime(musicVol * 0.5, ctx.currentTime);
    timer = setInterval(() => {
      if (current !== st) return;
      while (st.next < ctx.currentTime + 0.15) {
        scheduleStep(tr, st.step, st.next);
        st.next += tr.stepDur * (tr.mood.swing && st.step % 2 === 0 ? 1.1 : 1);
        st.step++;
        if (st.step >= tr.steps) { if (st.once) { stopMusic(); return; } st.step = 0; }
      }
    }, 30);
  }
  function stopMusic(quick) {
    if (timer) clearInterval(timer);
    timer = null; current = null;
    if (ctx && musicGain && !quick) { /* notes already scheduled tail off */ }
  }

  // ---------- SFX ----------
  const SFX = {
    select: (t) => tone(sfxGain, t, 880, 0.05, 'square', 0.12),
    move: (t) => tone(sfxGain, t, 660, 0.03, 'square', 0.06),
    back: (t) => tone(sfxGain, t, 440, 0.06, 'square', 0.1, { slide: 300 }),
    bump: (t) => tone(sfxGain, t, 90, 0.08, 'square', 0.12),
    door: (t) => { noise(sfxGain, t, 0.15, 0.2, 600); tone(sfxGain, t, 200, 0.12, 'triangle', 0.2, { slide: 120 }); },
    hit: (t) => { noise(sfxGain, t, 0.14, 0.35, 400); tone(sfxGain, t, 160, 0.1, 'square', 0.15, { slide: 60 }); },
    super: (t) => { noise(sfxGain, t, 0.2, 0.4, 300); tone(sfxGain, t, 300, 0.18, 'square', 0.2, { slide: 50 }); tone(sfxGain, t + 0.05, 900, 0.1, 'square', 0.1, { slide: 200 }); },
    weak: (t) => { noise(sfxGain, t, 0.08, 0.2, 2000); },
    faint: (t) => tone(sfxGain, t, 600, 0.6, 'square', 0.15, { slide: 60 }),
    throw: (t) => tone(sfxGain, t, 300, 0.25, 'triangle', 0.2, { slide: 1200 }),
    shake: (t) => { tone(sfxGain, t, 220, 0.06, 'square', 0.15); tone(sfxGain, t + 0.08, 180, 0.06, 'square', 0.15); },
    catch: (t) => { [72, 76, 79, 84].forEach((m, i) => tone(sfxGain, t + i * 0.09, mtof(m), 0.12, 'square', 0.15)); },
    escape: (t) => tone(sfxGain, t, 400, 0.3, 'square', 0.15, { slide: 900 }),
    levelup: (t) => { [67, 71, 74, 79, 83].forEach((m, i) => tone(sfxGain, t + i * 0.07, mtof(m), 0.1, 'square', 0.13)); },
    heal: (t) => { [72, 76, 79, 76, 84].forEach((m, i) => tone(sfxGain, t + i * 0.12, mtof(m), 0.14, 'triangle', 0.22)); },
    item: (t) => { [67, 72, 76, 79].forEach((m, i) => tone(sfxGain, t + i * 0.1, mtof(m), 0.16, 'square', 0.12)); tone(sfxGain, t + 0.4, mtof(84), 0.4, 'square', 0.12, { vib: true }); },
    badge: (t) => { [60, 64, 67, 72, 67, 72, 76, 79].forEach((m, i) => tone(sfxGain, t + i * 0.11, mtof(m + 4), 0.18, 'square', 0.13)); },
    encounter: (t) => { for (let i = 0; i < 8; i++) tone(sfxGain, t + i * 0.05, mtof(60 + ((i * 5) % 12)), 0.05, 'square', 0.1); },
    status: (t) => tone(sfxGain, t, 500, 0.2, 'sine', 0.2, { slide: 250 }),
    statup: (t) => tone(sfxGain, t, 300, 0.25, 'square', 0.12, { slide: 900 }),
    statdown: (t) => tone(sfxGain, t, 900, 0.25, 'square', 0.12, { slide: 250 }),
    mega: (t) => {
      tone(sfxGain, t, 110, 1.4, 'sawtooth', 0.12, { slide: 880 });
      noise(sfxGain, t + 0.2, 1.0, 0.12, 3000);
      [57, 64, 69, 73, 76, 81].forEach((m, i) => tone(sfxGain, t + 1.2 + i * 0.05, mtof(m), 0.9, 'square', 0.09, { vib: true }));
      tone(sfxGain, t + 1.2, 55, 0.8, 'triangle', 0.4);
      noise(sfxGain, t + 1.2, 0.6, 0.3, 200);
    },
    evolve: (t) => { for (let i = 0; i < 16; i++) tone(sfxGain, t + i * 0.12, mtof(60 + (i % 8) * 2), 0.1, 'triangle', 0.15); },
    save: (t) => { [72, 79, 84].forEach((m, i) => tone(sfxGain, t + i * 0.1, mtof(m), 0.12, 'triangle', 0.2)); },
    ledge: (t) => tone(sfxGain, t, 300, 0.12, 'square', 0.1, { slide: 150 }),
    rift: (t) => { tone(sfxGain, t, 200, 0.5, 'sine', 0.25, { slide: 1600 }); noise(sfxGain, t, 0.4, 0.1, 4000); },
    error: (t) => { tone(sfxGain, t, 150, 0.12, 'square', 0.15); tone(sfxGain, t + 0.14, 120, 0.15, 'square', 0.15); },
    hatch: (t) => { noise(sfxGain, t, 0.1, 0.3, 2000); [72, 76, 79, 84, 88].forEach((m, i) => tone(sfxGain, t + 0.15 + i * 0.08, mtof(m), 0.12, 'square', 0.12)); },
  };
  function sfx(name) {
    if (!enabled || !ctx || ctx.state !== 'running') return;
    const f = SFX[name]; if (f) f(ctx.currentTime + 0.01);
  }
  // little cry per species: derived from species id
  function cry(spId, mega) {
    if (!enabled || !ctx || ctx.state !== 'running') return;
    const r = new MB.RNG('cry' + spId);
    const t = ctx.currentTime + 0.01;
    const b = r.range(220, 900) * (mega ? 0.7 : 1);
    const w = r.pick(['square', 'sawtooth', 'triangle']);
    tone(sfxGain, t, b, 0.18, w, 0.12, { slide: b * r.range(0.5, 1.8) });
    tone(sfxGain, t + 0.16, b * r.range(0.8, 1.5), 0.22, w, 0.1, { slide: b * r.range(0.4, 1.2), vib: true });
    if (mega) noise(sfxGain, t, 0.3, 0.12, 800);
  }

  return {
    unlock() {
      init();
      if (ctx && ctx.state === 'suspended') ctx.resume().then(() => { const n = currentName; currentName = null; if (n) play(n); });
      else if (ctx && !current && currentName) { const n = currentName; currentName = null; play(n); }
    },
    play, stop: () => { stopMusic(); currentName = null; }, sfx, cry,
    get current() { return currentName; },
    setMusicVol(v) { musicVol = v; if (musicGain) musicGain.gain.value = v * 0.5; },
    setSfxVol(v) { sfxVol = v; if (sfxGain) sfxGain.gain.value = v; },
    get musicVol() { return musicVol; }, get sfxVol() { return sfxVol; },
    MOODS,
  };
})();
