// Every sound is synthesised with the Web Audio API — no audio files.

export class Audio {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.music = null;
    this.musicMode = null;
    this.step = 0;
    this.nextNote = 0;
    this.lastPlay = {};
  }

  // Must be called from a user gesture.
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { return; }
    const c = this.ctx;
    this.master = c.createGain();
    this.sfxGain = c.createGain();
    this.musicGain = c.createGain();
    this.sfxGain.connect(this.master);
    this.musicGain.connect(this.master);
    this.master.connect(c.destination);
    // One shared noise buffer for every noisy sound.
    const len = c.sampleRate;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    this.timer = setInterval(() => this.schedule(), 100);
  }

  applyVolumes() {
    if (!this.ctx) return;
    const s = this.settings;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : s.master, t, 0.05);
    this.sfxGain.gain.setTargetAtTime(s.sfx, t, 0.05);
    this.musicGain.gain.setTargetAtTime(s.music * 0.35, t, 0.2);
  }

  tone(freq, dur, { type = 'sine', vol = 0.3, slide = 0, delay = 0, attack = 0.005, dest } = {}) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest || this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noiseBurst(dur, { vol = 0.3, freq = 1000, q = 1, type = 'bandpass', slide = 0, delay = 0, dest } = {}) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest || this.sfxGain);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  play(name) {
    if (!this.ctx || this.settings.muted) return;
    // Avoid stacking the same sound many times in one frame.
    const now = this.ctx.currentTime;
    if (this.lastPlay[name] && now - this.lastPlay[name] < 0.04) return;
    this.lastPlay[name] = now;
    const fn = SOUNDS[name];
    if (fn) fn(this);
  }

  // --- Music: a tiny step sequencer with per-zone moods. ---
  setMusic(mode) { this.musicMode = mode; }

  schedule() {
    const c = this.ctx;
    if (!c || !this.musicMode || this.settings.muted || this.settings.music <= 0) return;
    const song = SONGS[this.musicMode];
    if (!song) return;
    const stepDur = 60 / song.bpm / 2;
    if (this.nextNote < c.currentTime) this.nextNote = c.currentTime + 0.05;
    while (this.nextNote < c.currentTime + 0.25) {
      const i = this.step % 16;
      const chord = song.chords[Math.floor(this.step / 16) % song.chords.length];
      const delay = this.nextNote - c.currentTime;
      if (i % 8 === 0) {
        for (const n of chord) this.tone(midi(n), stepDur * 7.5, { type: song.pad, vol: 0.05, attack: 0.3, delay, dest: this.musicGain });
      }
      if (song.bass[i] != null) this.tone(midi(chord[0] - 12 + song.bass[i]), stepDur * 1.6, { type: 'triangle', vol: 0.12, delay, dest: this.musicGain });
      if (song.lead && song.lead[i] != null) this.tone(midi(chord[0] + 12 + song.lead[i]), stepDur * 1.2, { type: 'square', vol: 0.025, delay, dest: this.musicGain });
      if (song.drum && song.drum[i]) {
        if (song.drum[i] === 1) this.tone(90, 0.18, { type: 'sine', vol: 0.25, slide: 0.4, delay, dest: this.musicGain });
        else this.noiseBurst(0.06, { vol: 0.06, freq: 6000, type: 'highpass', delay, dest: this.musicGain });
      }
      this.step++;
      this.nextNote += stepDur;
    }
  }
}

function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }

const SONGS = {
  menu: { bpm: 70, pad: 'triangle', chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]], bass: [0, null, null, null, null, null, null, null, 7, null, null, null, null, null, null, null] },
  grass: { bpm: 96, pad: 'triangle', chords: [[60, 64, 67], [65, 69, 72], [57, 60, 64], [67, 71, 74]], bass: [0, null, 7, null, 12, null, 7, null, 0, null, 7, null, 12, null, 7, null], lead: [null, null, null, null, 4, null, 7, null, null, null, 9, null, 7, null, null, null] },
  swamp: { bpm: 72, pad: 'sawtooth', chords: [[57, 60, 63], [55, 58, 62], [53, 56, 60], [52, 55, 58]], bass: [0, null, null, 0, null, null, 6, null, 0, null, null, 0, null, 3, null, null] },
  backyard: { bpm: 100, pad: 'triangle', chords: [[62, 66, 69], [59, 62, 66], [55, 59, 62], [57, 61, 64]], bass: [0, null, 7, null, 0, null, 7, null, 0, null, 7, null, 5, null, 4, null], lead: [7, null, null, 4, null, null, 2, null, 0, null, null, null, null, null, null, null] },
  miniboss: { bpm: 140, pad: 'sawtooth', chords: [[52, 55, 59], [53, 57, 60], [52, 55, 59], [50, 53, 57]], bass: [0, 0, null, 0, 12, null, 0, null, 0, 0, null, 0, 10, null, 7, null], drum: [1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 1, 2, 2] },
  boss: { bpm: 150, pad: 'sawtooth', chords: [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]], bass: [0, 0, 12, 0, 0, 12, 0, 10, 0, 0, 12, 0, 7, 7, 5, 3], lead: [12, null, 10, null, 7, null, 5, null, 3, null, 5, null, 7, null, null, null], drum: [1, 2, 2, 2, 1, 2, 1, 2, 1, 2, 2, 2, 1, 2, 1, 1] },
  desert: { bpm: 88, pad: 'triangle', chords: [[57, 61, 64], [58, 62, 65], [57, 61, 64], [55, 58, 62]], bass: [0, null, null, 1, null, null, 0, null, 7, null, null, 8, null, 7, null, null], lead: [12, null, 13, null, 16, null, 13, null, 12, null, null, 10, null, 8, null, null] },
  peaks: { bpm: 76, pad: 'sine', chords: [[64, 67, 71], [60, 64, 67], [62, 66, 69], [59, 62, 66]], bass: [0, null, null, null, 7, null, null, null, 0, null, null, null, 12, null, null, null], lead: [null, null, 7, null, null, null, 12, null, null, null, 11, null, null, null, 7, null] },
  beach: { bpm: 104, pad: 'triangle', chords: [[65, 69, 72], [70, 74, 77], [72, 76, 79], [65, 69, 72]], bass: [0, null, 0, 7, null, 7, 0, null, 0, null, 0, 7, null, 7, 12, null], lead: [7, null, 9, null, 12, null, 9, null, 7, null, 4, null, 2, null, 0, null], drum: [1, 0, 2, 0, 0, 1, 2, 0, 1, 0, 2, 0, 0, 1, 2, 2] },
  regionboss: { bpm: 144, pad: 'sawtooth', chords: [[52, 55, 59], [48, 52, 55], [50, 53, 57], [47, 50, 54]], bass: [0, 12, 0, 12, 0, 12, 0, 10, 0, 12, 0, 12, 7, 7, 5, 5], lead: [12, null, 11, null, 7, null, 4, null, 7, null, 11, null, 12, null, 14, null], drum: [1, 2, 2, 1, 1, 2, 1, 2, 1, 2, 2, 1, 1, 2, 1, 1] },
  victory: { bpm: 110, pad: 'triangle', chords: [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]], bass: [0, null, 7, null, 12, null, 7, null, 0, null, 7, null, 12, null, 7, null], lead: [0, null, 4, null, 7, null, 12, null, 7, null, 4, null, 7, null, 12, null] },
};

const SOUNDS = {
  swing: (a) => a.noiseBurst(0.16, { vol: 0.25, freq: 900, slide: 3, q: 2 }),
  heavy: (a) => { a.noiseBurst(0.3, { vol: 0.3, freq: 400, slide: 4, q: 2 }); },
  hit: (a) => { a.tone(160, 0.12, { type: 'square', vol: 0.18, slide: 0.5 }); a.noiseBurst(0.1, { vol: 0.3, freq: 2500 }); },
  heavyhit: (a) => { a.tone(110, 0.25, { type: 'square', vol: 0.25, slide: 0.4 }); a.noiseBurst(0.18, { vol: 0.35, freq: 1500 }); },
  bonk: (a) => { a.tone(520, 0.5, { vol: 0.2 }); a.tone(1310, 0.35, { vol: 0.1 }); a.tone(2090, 0.2, { vol: 0.06 }); },
  squeak: (a) => { a.tone(900, 0.15, { type: 'square', vol: 0.12, slide: 1.8 }); a.tone(1500, 0.12, { type: 'square', vol: 0.08, slide: 0.7, delay: 0.1 }); },
  dodge: (a) => a.noiseBurst(0.25, { vol: 0.2, freq: 300, slide: 5, q: 1 }),
  hurt: (a) => { a.tone(220, 0.2, { type: 'sawtooth', vol: 0.18, slide: 0.6 }); a.noiseBurst(0.12, { vol: 0.25, freq: 800 }); },
  block: (a) => a.tone(1800, 0.1, { type: 'square', vol: 0.08 }),
  enemyDie: (a) => { a.tone(300, 0.4, { type: 'sawtooth', vol: 0.12, slide: 0.3 }); },
  clatter: (a) => { for (let i = 0; i < 5; i++) a.tone(700 + Math.random() * 900, 0.06, { type: 'square', vol: 0.06, delay: i * 0.06 }); },
  pickup: (a) => { a.tone(880, 0.1, { type: 'square', vol: 0.08 }); a.tone(1320, 0.15, { type: 'square', vol: 0.08, delay: 0.08 }); },
  coins: (a) => { for (let i = 0; i < 3; i++) a.tone(1800 + i * 300, 0.08, { type: 'square', vol: 0.05, delay: i * 0.05 }); },
  chest: (a) => { a.tone(120, 0.3, { type: 'sawtooth', vol: 0.08, slide: 1.5 }); [0, 4, 7, 12].forEach((n, i) => a.tone(midi(72 + n), 0.3, { type: 'triangle', vol: 0.12, delay: 0.25 + i * 0.07 })); },
  shrine: (a) => { [60, 64, 67, 72, 76].forEach((n, i) => a.tone(midi(n), 1.6, { type: 'sine', vol: 0.09, delay: i * 0.08, attack: 0.05 })); },
  levelup: (a) => { [60, 64, 67, 72].forEach((n, i) => a.tone(midi(n), 0.25, { type: 'square', vol: 0.07, delay: i * 0.1 })); a.tone(midi(79), 0.6, { type: 'square', vol: 0.07, delay: 0.4 }); },
  drink: (a) => { for (let i = 0; i < 4; i++) a.tone(300 + i * 60, 0.08, { vol: 0.12, slide: 1.5, delay: i * 0.12 }); },
  spit: (a) => { a.tone(400, 0.15, { type: 'square', vol: 0.08, slide: 0.4 }); a.noiseBurst(0.12, { vol: 0.15, freq: 1200 }); },
  splat: (a) => a.noiseBurst(0.2, { vol: 0.2, freq: 500, slide: 0.3 }),
  alert: (a) => { a.tone(700, 0.08, { type: 'square', vol: 0.06 }); a.tone(1050, 0.12, { type: 'square', vol: 0.06, delay: 0.07 }); },
  windup: (a) => a.tone(1200, 0.15, { type: 'sine', vol: 0.05, slide: 1.6 }),
  stomp: (a) => { a.tone(60, 0.6, { type: 'sine', vol: 0.5, slide: 0.5 }); a.noiseBurst(0.5, { vol: 0.4, freq: 200, type: 'lowpass' }); },
  bossIntro: (a) => { a.tone(55, 2.5, { type: 'sawtooth', vol: 0.18, attack: 0.3 }); a.tone(82.4, 2.5, { type: 'sawtooth', vol: 0.12, attack: 0.3 }); a.tone(65.4, 2.5, { type: 'sawtooth', vol: 0.1, attack: 0.3, delay: 0.2 }); a.noiseBurst(1.5, { vol: 0.3, freq: 150, type: 'lowpass' }); },
  gate: (a) => { a.tone(90, 0.8, { type: 'sawtooth', vol: 0.1, slide: 1.3 }); a.noiseBurst(0.6, { vol: 0.15, freq: 300 }); },
  wallbreak: (a) => { a.noiseBurst(0.6, { vol: 0.4, freq: 600, slide: 0.3 }); a.tone(80, 0.4, { type: 'square', vol: 0.15, slide: 0.5 }); },
  death: (a) => { [67, 63, 60, 55].forEach((n, i) => a.tone(midi(n), 0.45, { type: 'sawtooth', vol: 0.08, delay: i * 0.22 })); },
  victory: (a) => { [60, 64, 67, 72, 67, 72, 76, 79].forEach((n, i) => a.tone(midi(n), 0.3, { type: 'square', vol: 0.07, delay: i * 0.12 })); },
  ui: (a) => a.tone(660, 0.05, { type: 'square', vol: 0.05 }),
  slap: (a) => { a.noiseBurst(0.08, { vol: 0.45, freq: 2200, q: 0.8 }); a.tone(300, 0.06, { type: 'square', vol: 0.1, slide: 0.5 }); },
  chicken: (a) => { a.tone(700, 0.1, { type: 'sawtooth', vol: 0.08, slide: 1.4 }); a.tone(900, 0.18, { type: 'sawtooth', vol: 0.08, slide: 0.8, delay: 0.12 }); },
  perfect: (a) => { a.tone(1567, 0.2, { type: 'triangle', vol: 0.1 }); a.tone(2093, 0.3, { type: 'triangle', vol: 0.08, delay: 0.06 }); },
};
