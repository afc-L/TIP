// Procedural spatial audio (WebAudio): gunfire with distance delay & air absorption, explosions,
// artillery whistles, engines, rotors, jets, weather ambience, radio squelch and voice chatter.
(function (G) {
  'use strict';
  const IF = G.IF, U = IF.U;
  const A = (IF.Audio = { on: false });
  const SFX = IF.SFX;

  A.init = function () {
    if (A.ctx) return;
    const AC = G.AudioContext || G.webkitAudioContext;
    if (!AC) return;
    const ctx = (A.ctx = new AC());
    A.master = ctx.createGain(); A.master.gain.value = IF.Profile.settings.volume;
    A.muffle = ctx.createBiquadFilter(); A.muffle.type = 'lowpass'; A.muffle.frequency.value = 20000;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.25;
    A.muffle.connect(comp); comp.connect(A.master); A.master.connect(ctx.destination);
    A.bus = A.muffle;
    // noise buffers
    const len = ctx.sampleRate * 2;
    A.white = ctx.createBuffer(1, len, ctx.sampleRate);
    A.brown = ctx.createBuffer(1, len, ctx.sampleRate);
    const w = A.white.getChannelData(0), b = A.brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { w[i] = Math.random() * 2 - 1; last = (last + 0.02 * w[i]) / 1.02; b[i] = last * 3.5; }
    A.voices = 0; A.shotBudget = 0; A.lastT = {};
    A.loops = {};
    A.loop('wind', A.white, 'bandpass', 400, 0.0);
    A.loop('rain', A.white, 'highpass', 2500, 0.0);
    A.loop('rumble', A.brown, 'lowpass', 180, 0.0);
    A.loop('crackle', A.white, 'bandpass', 900, 0.0);
    A.engines = []; for (let k = 0; k < 3; k++) A.engines.push(A.engineVoice());
    A.rotors = []; for (let k = 0; k < 2; k++) A.rotors.push(A.rotorVoice());
    A.jetV = []; for (let k = 0; k < 2; k++) A.jetV.push(A.jetVoice());
    A.on = true;
  };
  A.resume = function () { if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume(); };
  A.setVolume = function (v) { if (A.master) A.master.gain.value = v; };

  A.loop = function (name, buf, type, freq, gain) {
    const ctx = A.ctx;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = 0.7;
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(A.bus); src.start(0, Math.random());
    A.loops[name] = { src, f, g };
  };
  function panner(x, y, z) {
    const p = A.ctx.createPanner();
    p.panningModel = 'equalpower'; p.distanceModel = 'linear'; p.rolloffFactor = 0; p.refDistance = 1; p.maxDistance = 1e5;
    if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z);
    return p;
  }
  function setPos(p, x, y, z) { if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z); }

  A.engineVoice = function () {
    const ctx = A.ctx;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 45;
    const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 23;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 280;
    const g = ctx.createGain(); g.gain.value = 0;
    const p = panner(0, 0, 0);
    const g2 = ctx.createGain(); g2.gain.value = 0.4;
    o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(p); p.connect(A.bus); o.start(); o2.start();
    return { o, o2, f, g, p };
  };
  A.rotorVoice = function () {
    const ctx = A.ctx;
    const src = ctx.createBufferSource(); src.buffer = A.brown; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    const am = ctx.createGain(); am.gain.value = 0.5;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 11; const lg = ctx.createGain(); lg.gain.value = 0.5; lfo.connect(lg); lg.connect(am.gain);
    const g = ctx.createGain(); g.gain.value = 0;
    const p = panner(0, 0, 0);
    src.connect(f); f.connect(am); am.connect(g); g.connect(p); p.connect(A.bus); src.start(); lfo.start();
    return { src, f, g, p, lfo };
  };
  A.jetVoice = function () {
    const ctx = A.ctx;
    const src = ctx.createBufferSource(); src.buffer = A.white; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.5;
    const g = ctx.createGain(); g.gain.value = 0;
    const p = panner(0, 0, 0);
    src.connect(f); f.connect(g); g.connect(p); p.connect(A.bus); src.start();
    return { src, f, g, p };
  };

  // generic one-shot noise burst
  function burst(x, y, z, opt) {
    const ctx = A.ctx;
    if (A.voices > 48) return;
    const L = A.listener;
    const d = Math.sqrt((x - L.x) ** 2 + (y - L.y) ** 2 + (z - L.z) ** 2);
    const delay = opt.nodelay ? 0 : d / 343;
    const t = ctx.currentTime + delay + (opt.at || 0);
    let vol = opt.vol / (1 + d / (opt.ref || 25));
    if (vol < 0.003) return;
    const src = ctx.createBufferSource(); src.buffer = opt.buf || A.white;
    src.playbackRate.value = opt.rate || 1;
    const f = ctx.createBiquadFilter(); f.type = opt.type || 'bandpass'; f.frequency.value = opt.freq * Math.max(0.12, 1 / (1 + d / (opt.abs || 250))); f.Q.value = opt.q || 0.8;
    const g = ctx.createGain();
    const atk = opt.atk || 0.002, dec = opt.dec || 0.15;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + atk); g.gain.exponentialRampToValueAtTime(0.0001, t + atk + dec * (1 + d / 600));
    const p = panner(x, y, z);
    src.connect(f); f.connect(g); g.connect(p); p.connect(A.bus);
    src.start(t, Math.random() * 1.5, atk + dec * (1 + d / 600) + 0.1);
    A.voices++;
    src.onended = () => { A.voices--; };
    if (opt.thump) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(opt.thump, t); o.frequency.exponentialRampToValueAtTime(opt.thump * 0.4, t + 0.3);
      const og = ctx.createGain(); og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(vol * (opt.thumpVol || 0.8), t + 0.01); og.gain.exponentialRampToValueAtTime(0.0001, t + (opt.thumpDec || 0.35));
      const p2 = panner(x, y, z);
      o.connect(og); og.connect(p2); p2.connect(A.bus); o.start(t); o.stop(t + (opt.thumpDec || 0.35) + 0.1);
    }
    return d;
  }

  const SHOT = {
    rifle: { freq: 1700, q: 0.7, dec: 0.09, vol: 0.55, thump: 120, thumpVol: 0.4, thumpDec: 0.08 },
    smg: { freq: 2100, q: 0.8, dec: 0.07, vol: 0.45, thump: 150, thumpVol: 0.3, thumpDec: 0.06 },
    mg: { freq: 1400, q: 0.7, dec: 0.1, vol: 0.6, thump: 100, thumpVol: 0.5, thumpDec: 0.09 },
    hmg: { freq: 900, q: 0.6, dec: 0.13, vol: 0.75, thump: 80, thumpVol: 0.7, thumpDec: 0.12 },
    sniper: { freq: 1200, q: 0.6, dec: 0.25, vol: 0.85, thump: 70, thumpVol: 0.8, thumpDec: 0.2 },
    shotgun: { freq: 900, q: 0.5, dec: 0.18, vol: 0.8, thump: 70, thumpVol: 0.8, thumpDec: 0.16 },
    pistol: { freq: 2300, q: 0.9, dec: 0.07, vol: 0.4, thump: 180, thumpVol: 0.3, thumpDec: 0.05 },
    rocket: { freq: 600, q: 0.4, dec: 0.6, vol: 0.9, thump: 60, thumpVol: 0.6, thumpDec: 0.4, type: 'lowpass' },
    autocannon: { freq: 700, q: 0.5, dec: 0.16, vol: 0.9, thump: 60, thumpVol: 0.9, thumpDec: 0.15 },
  };
  SFX.shot = function (x, y, z, type, team, distant) {
    if (!A.on) return;
    const L = A.listener; if (!L) return;
    const d2 = (x - L.x) ** 2 + (z - L.z) ** 2;
    // limit far gunfire to a budget so thousands of shots stay a rolling crackle
    if (d2 > 140 * 140) {
      A.farShots++;
      if (A.shotBudget <= 0 || d2 > 1500 * 1500) return;
      A.shotBudget--;
    }
    const s = SHOT[type] || SHOT.rifle;
    burst(x, y, z, Object.assign({ ref: 18, abs: 180 }, s, { vol: s.vol * (A.suppressed && type === 'player' ? 0.3 : 1) }));
  };
  SFX.playerShot = function (type, suppressed) {
    if (!A.on) return;
    const L = A.listener;
    const s = SHOT[type] || SHOT.rifle;
    burst(L.x, L.y, L.z, Object.assign({}, s, { vol: s.vol * (suppressed ? 0.35 : 1.1), freq: suppressed ? s.freq * 0.5 : s.freq, nodelay: true, ref: 1e6 }));
  };
  SFX.explosion = function (x, y, z, kind, r) {
    if (!A.on || !A.listener) return;
    const big = kind === 'bomb' || kind === 'arty' || kind === 'vehicle' || kind === 'collapse' ? 1.6 : kind === 'grenade' ? 0.9 : 1.2;
    const d = burst(x, y, z, { buf: A.brown, type: 'lowpass', freq: 900 * big, q: 0.5, atk: 0.005, dec: 1.4 * big, vol: 2.2 * big, ref: 30, abs: 600, thump: 55, thumpVol: 1.2, thumpDec: 0.9 });
    burst(x, y, z, { type: 'highpass', freq: 2000, q: 0.5, atk: 0.001, dec: 0.12, vol: 0.9 * big, ref: 15, abs: 120 });
    if (d !== undefined && d < 25 + (r || 5) * 2) { IF.emit('deafen', U.clamp(1 - d / (25 + (r || 5) * 2), 0, 1)); }
  };
  SFX.cannon = function (x, y, z, howitzer) {
    if (!A.on || !A.listener) return;
    burst(x, y, z, { buf: A.brown, type: 'lowpass', freq: 1100, q: 0.5, atk: 0.002, dec: howitzer ? 1.6 : 1.0, vol: 2.4, ref: 30, abs: 700, thump: 45, thumpVol: 1.4, thumpDec: 0.6 });
    burst(x, y, z, { type: 'bandpass', freq: 1500, q: 0.4, atk: 0.001, dec: 0.15, vol: 1.2, ref: 20, abs: 250 });
  };
  SFX.whistle = function (x, y, z) {
    if (!A.on || !A.listener) return;
    const L = A.listener, d = Math.sqrt((x - L.x) ** 2 + (z - L.z) ** 2);
    if (d > 260) return;
    const ctx = A.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(1500, t); o.frequency.exponentialRampToValueAtTime(380, t + 2.3);
    const g = ctx.createGain(); const v = 0.25 / (1 + d / 40);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    const p = panner(x, y + 40, z);
    o.connect(g); g.connect(p); p.connect(A.bus); o.start(t); o.stop(t + 2.5);
  };
  SFX.crack = function (x, z, k) {
    if (!A.on || !A.listener) return;
    const L = A.listener;
    burst(L.x + U.rr(-2, 2), L.y + 0.5, L.z + U.rr(-2, 2), { type: 'highpass', freq: 3500, q: 0.6, atk: 0.0008, dec: 0.04, vol: 0.5 * (k || 1) * 6, nodelay: true, ref: 1e6 });
  };
  SFX.hit = function (kind) {
    if (!A.on) return;
    const ctx = A.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = kind === 'kill' ? 1300 : kind === 'head' ? 1800 : 1000;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(g); g.connect(A.master); o.start(t); o.stop(t + 0.08);
  };
  SFX.ui = function (kind) {
    if (!A.on) return;
    const ctx = A.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = kind === 'back' ? 420 : kind === 'alert' ? 880 : 660;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g); g.connect(A.master); o.start(t); o.stop(t + 0.13);
  };
  SFX.reload = function (stage) {
    if (!A.on) return;
    const L = A.listener;
    burst(L.x, L.y, L.z, { type: 'bandpass', freq: stage === 1 ? 2500 : 1600, q: 3, atk: 0.001, dec: 0.05, vol: 0.25, nodelay: true, ref: 1e6 });
  };
  SFX.empty = function () { if (A.on) { const L = A.listener; burst(L.x, L.y, L.z, { type: 'bandpass', freq: 3000, q: 4, atk: 0.001, dec: 0.03, vol: 0.2, nodelay: true, ref: 1e6 }); } };
  SFX.thump = function (x, y, z) { if (A.on) burst(x, y, z, { buf: A.brown, type: 'lowpass', freq: 400, dec: 0.3, vol: 0.5, ref: 15 }); };
  SFX.impact = function (x, y, z) { if (A.on) burst(x, y, z, { type: 'bandpass', freq: 2500, q: 2, dec: 0.03, vol: 0.25, ref: 8 }); };

  // ---- voices ----
  const SHOUTS = {
    medic: ['Medic!', "I'm hit! Medic!", 'Man down!'], grenade: ['Grenade!', 'Frag out!'], rpg: ['RPG!', 'Rocket out!'],
    wounded: ["I'm hit!", 'Argh!'], coming: ['Hang on, I got you!', "I'm coming!"],
  };
  A.speakQ = [];
  function speak(text, opts) {
    if (!IF.Profile.settings.voice || !G.speechSynthesis || !G.SpeechSynthesisUtterance) return;
    try {
      const u = new G.SpeechSynthesisUtterance(text);
      u.rate = opts.rate || 1.15; u.pitch = opts.pitch || 1; u.volume = U.clamp((opts.vol || 0.6) * IF.Profile.settings.volume, 0, 1);
      if (A.voiceList && A.voiceList.length) { const en = A.voiceList.filter((v) => /^en/i.test(v.lang)); if (en.length) u.voice = en[(opts.voiceIdx || 0) % en.length]; }
      G.speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  }
  if (G.speechSynthesis) { const lv = () => { A.voiceList = G.speechSynthesis.getVoices(); }; lv(); G.speechSynthesis.onvoiceschanged = lv; }
  SFX.shout = function (x, y, z, kind, team) {
    if (!A.on || !A.listener) return;
    const L = A.listener, d = Math.sqrt((x - L.x) ** 2 + (z - L.z) ** 2);
    if (d > 70) return;
    const now = A.ctx.currentTime;
    if (now - (A.lastShout || 0) < 2.2) return;
    if (G.speechSynthesis && G.speechSynthesis.speaking) return;
    A.lastShout = now;
    const lib = SHOUTS[kind]; if (!lib) return;
    speak(U.pick(lib), { vol: 0.9 / (1 + d / 15), pitch: team === IF.B.playerTeam ? 1 : 0.7, rate: 1.25, voiceIdx: team * 3 + ((x * 7) | 0) });
    IF.emit('shoutText', x, y, z, U.pick(lib), team);
  };
  SFX.radio = function (text, important) {
    if (!A.on) return;
    const ctx = A.ctx, t = ctx.currentTime;
    // squelch
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 1250;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.025, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g); g.connect(A.master); o.start(t); o.stop(t + 0.1);
    burst(A.listener.x, A.listener.y, A.listener.z, { type: 'bandpass', freq: 2000, q: 1, atk: 0.001, dec: 0.12, vol: 0.12, nodelay: true, ref: 1e6, at: 0.08 });
    if (now() - (A.lastRadioVoice || 0) > (important ? 2.5 : 5) && !(G.speechSynthesis && G.speechSynthesis.speaking)) { A.lastRadioVoice = now(); speak(text, { vol: 0.55, rate: 1.2, pitch: 0.85, voiceIdx: 1 }); }
  };
  const now = () => (A.ctx ? A.ctx.currentTime : 0);

  // ---- per-frame update: listener, loops, engines ----
  A.update = function (B, dt, cam) {
    if (!A.on) return;
    const ctx = A.ctx, L = ctx.listener;
    const p = cam.position;
    A.listener = { x: p.x, y: p.y, z: p.z };
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion), up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    if (L.positionX) { L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z; L.forwardX.value = f.x; L.forwardY.value = f.y; L.forwardZ.value = f.z; L.upX.value = up.x; L.upY.value = up.y; L.upZ.value = up.z; }
    else { L.setPosition(p.x, p.y, p.z); L.setOrientation(f.x, f.y, f.z, up.x, up.y, up.z); }
    A.shotBudget = Math.min(6, A.shotBudget + dt * 22);
    // ambient
    const env = B.env;
    const lp = A.loops;
    lp.wind.g.gain.value = 0.03 + env.cloud * 0.04 + (env.weather === 'storm' ? 0.08 : 0);
    lp.rain.g.gain.value = env.rain * 0.12;
    // distant battle intensity = how many far shots happened recently
    A.farShots = (A.farShots || 0);
    A.intensity = U.lerp(A.intensity || 0, Math.min(1, A.farShots / 40), dt * 1.5);
    A.farShots = 0;
    lp.rumble.g.gain.value = 0.05 + A.intensity * 0.25;
    lp.crackle.g.gain.value = A.intensity * 0.012;
    // nearest ground engines
    const cands = [];
    for (const v of B.activeVeh) {
      if (v.T.air || v.state !== 'active' || (!v.crew.length && !v.playerIn)) continue;
      const d2 = U.dist2(v.x, v.z, p.x, p.z);
      if (d2 < 220 * 220) cands.push([d2, v]);
    }
    cands.sort((a, b) => a[0] - b[0]);
    for (let k = 0; k < A.engines.length; k++) {
      const e = A.engines[k], c = cands[k];
      if (!c) { e.g.gain.value = 0; continue; }
      const v = c[1], d = Math.sqrt(c[0]);
      const heavy = v.T.armor >= 1 ? 1 : 0.6;
      e.o.frequency.value = (v.type === 'mbt' ? 32 : 48) + Math.abs(v.spd) * 2.4;
      e.o2.frequency.value = e.o.frequency.value * 0.5;
      e.f.frequency.value = 200 + Math.abs(v.spd) * 25;
      e.g.gain.value = (v.playerIn ? 0.16 : 0.12 * heavy) / (1 + d / 18) * (0.6 + Math.min(1, Math.abs(v.spd) / 8));
      setPos(e.p, v.x, v.y + 1, v.z);
    }
    // helicopters
    const helis = [];
    for (const v of B.activeVeh) if (v.T.air && (v.crew.length || v.playerIn) && v.state === 'active') { const d2 = U.dist2(v.x, v.z, p.x, p.z) + (v.y - p.y) ** 2; if (d2 < 900 * 900) helis.push([d2, v]); }
    helis.sort((a, b) => a[0] - b[0]);
    for (let k = 0; k < A.rotors.length; k++) {
      const r = A.rotors[k], c = helis[k];
      if (!c) { r.g.gain.value = 0; continue; }
      const v = c[1], d = Math.sqrt(c[0]);
      r.g.gain.value = (v.playerIn ? 0.5 : 0.9) / (1 + d / 30);
      r.f.frequency.value = 300 + 900 / (1 + d / 60);
      r.lfo.frequency.value = v.type === 'theli' ? 9 : 12;
      setPos(r.p, v.x, v.y, v.z);
    }
    // jets
    for (let k = 0; k < A.jetV.length; k++) {
      const jv = A.jetV[k], j = B.jets[k];
      if (!j) { jv.g.gain.value = 0; continue; }
      const d = Math.sqrt(U.dist2(j.x, j.z, p.x, p.z) + (j.y - p.y) ** 2);
      // approaching -> higher pitch
      const vr = ((p.x - j.x) * j.vx + (p.z - j.z) * j.vz) / Math.max(1, d);
      jv.f.frequency.value = 500 + vr * 4;
      jv.g.gain.value = 1.4 / (1 + d / 70);
      setPos(jv.p, j.x, j.y, j.z);
    }
    // deafness recovery
    A.deaf = Math.max(0, (A.deaf || 0) - dt * 0.35);
    A.muffle.frequency.value = 20000 * Math.pow(1 - Math.min(0.97, A.deaf), 2) + 250;
  };
  IF.on('deafen', (k) => { A.deaf = Math.max(A.deaf || 0, k); if (k > 0.4 && A.on) { const ctx = A.ctx, t = ctx.currentTime; const o = ctx.createOscillator(); o.frequency.value = 3800; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.02 * k, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.5 * k); o.connect(g); g.connect(A.master); o.start(t); o.stop(t + 2.6); } });
  A.stopAll = function () {
    if (!A.on) return;
    for (const e of A.engines) e.g.gain.value = 0;
    for (const r of A.rotors) r.g.gain.value = 0;
    for (const j of A.jetV) j.g.gain.value = 0;
    for (const k in A.loops) A.loops[k].g.gain.value = 0;
    if (G.speechSynthesis) G.speechSynthesis.cancel();
  };
})(typeof window !== 'undefined' ? window : globalThis);
