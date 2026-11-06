// Procedural Web Audio: synthesized SFX and a lightweight generative music sequencer.
import { profile } from './save.js';

let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null, comp = null;
const lastPlay = {};

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4;
  master = ctx.createGain();
  sfxBus = ctx.createGain();
  musicBus = ctx.createGain();
  sfxBus.connect(comp); musicBus.connect(master); comp.connect(master); master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyVolumes();
}

export function applyVolumes() {
  if (!ctx) return;
  const s = profile.settings;
  master.gain.value = s.masterVol;
  sfxBus.gain.value = s.sfxVol;
  musicBus.gain.value = s.music ? s.musicVol * 0.5 : 0;
}

function env(g, t, a, peak, dec) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
}
function osc(type, f0, f1, dur, vol, t, dest = sfxBus) {
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + dur);
  env(g, t, 0.005, vol, dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, vol, t, ftype = 'lowpass', f0 = 2000, f1 = 200, q = 1, dest = sfxBus) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = ftype; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(f1, 30), t + dur);
  const g = ctx.createGain(); env(g, t, 0.004, vol, dur);
  s.connect(f); f.connect(g); g.connect(dest);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}

/** Play a named effect. vol 0..1 (caller handles distance), pitch multiplier. */
export function sfx(name, vol = 1, pitch = 1) {
  if (!ctx || vol < 0.02) return;
  const now = ctx.currentTime;
  // rate-limit identical sounds
  const minGap = { arc: 0.045, gauss: 0.05, ion: 0.07, step: 0.05, hit: 0.03, shieldhit: 0.04 }[name] || 0.015;
  if (lastPlay[name] && now - lastPlay[name] < minGap) return;
  lastPlay[name] = now;
  const t = now + 0.001; const p = pitch * (0.95 + Math.random() * 0.1);
  switch (name) {
    case 'pulse': osc('square', 880 * p, 180 * p, 0.16, 0.18 * vol, t); osc('sine', 300 * p, 90, 0.12, 0.2 * vol, t); break;
    case 'arc': osc('sawtooth', 1400 * p, 500 * p, 0.06, 0.08 * vol, t); break;
    case 'scatter': noise(0.25, 0.4 * vol, t, 'bandpass', 3000, 500, 0.8); osc('square', 400 * p, 60, 0.2, 0.18 * vol, t); break;
    case 'gauss': noise(0.08, 0.3 * vol, t, 'highpass', 3000, 1200, 1); osc('triangle', 200 * p, 80, 0.08, 0.2 * vol, t); break;
    case 'plasma': osc('sine', 220 * p, 600 * p, 0.25, 0.25 * vol, t); osc('sawtooth', 110 * p, 300 * p, 0.25, 0.08 * vol, t); break;
    case 'rail': osc('sawtooth', 2400 * p, 120, 0.35, 0.2 * vol, t); noise(0.4, 0.3 * vol, t, 'bandpass', 6000, 300, 2); osc('sine', 80, 40, 0.4, 0.4 * vol, t); break;
    case 'missile': noise(0.35, 0.25 * vol, t, 'bandpass', 800, 2500, 1.5); break;
    case 'mortar': osc('sine', 120 * p, 40, 0.3, 0.5 * vol, t); noise(0.3, 0.3 * vol, t, 'lowpass', 1200, 200); break;
    case 'ion': osc('sawtooth', 160 * p, 170 * p, 0.09, 0.07 * vol, t); osc('sine', 1200 * p, 1100 * p, 0.09, 0.04 * vol, t); break;
    case 'explosion': noise(0.9, 0.9 * vol, t, 'lowpass', 1800 * p, 60, 0.7); osc('sine', 90 * p, 30, 0.7, 0.6 * vol, t); break;
    case 'bigexplosion': noise(1.8, 1.0 * vol, t, 'lowpass', 1200, 40, 0.6); osc('sine', 60, 22, 1.6, 0.9 * vol, t); noise(0.5, 0.5 * vol, t + 0.1, 'bandpass', 3000, 300, 1); break;
    case 'swing': noise(0.22, 0.5 * vol, t, 'bandpass', 500 * p, 2600 * p, 1.4); osc('sine', 180 * p, 90 * p, 0.18, 0.12 * vol, t); break;
    case 'slash': noise(0.18, 0.55 * vol, t, 'highpass', 5000, 1500, 1); osc('sawtooth', 900 * p, 200, 0.16, 0.18 * vol, t); osc('sine', 120, 50, 0.2, 0.35 * vol, t); break;
    case 'hit': osc('square', 1800 * p, 1200 * p, 0.04, 0.08 * vol, t); break;
    case 'crit': osc('square', 2400, 1800, 0.06, 0.12 * vol, t); osc('sine', 3200, 3000, 0.1, 0.08 * vol, t + 0.03); break;
    case 'shieldhit': osc('sine', 1600 * p, 900 * p, 0.12, 0.12 * vol, t); osc('triangle', 2400 * p, 2000 * p, 0.08, 0.05 * vol, t); break;
    case 'armorhit': noise(0.12, 0.4 * vol, t, 'bandpass', 1500 * p, 600, 2); osc('square', 140 * p, 70, 0.1, 0.15 * vol, t); break;
    case 'shieldbreak': osc('sawtooth', 900, 100, 0.5, 0.25 * vol, t); noise(0.4, 0.3 * vol, t, 'highpass', 4000, 1500); break;
    case 'step': noise(0.12, 0.3 * vol, t, 'lowpass', 400 * p, 60, 1); osc('sine', 70 * p, 40, 0.12, 0.3 * vol, t); break;
    case 'land': noise(0.25, 0.5 * vol, t, 'lowpass', 600, 50, 1); osc('sine', 60, 30, 0.25, 0.5 * vol, t); break;
    case 'jet': noise(0.18, 0.12 * vol, t, 'bandpass', 900, 700, 1); break;
    case 'dash': noise(0.35, 0.45 * vol, t, 'bandpass', 600, 3000, 1.2); osc('sine', 200, 500, 0.2, 0.12 * vol, t); break;
    case 'reload': osc('square', 300, 300, 0.05, 0.1 * vol, t); osc('square', 500, 500, 0.05, 0.1 * vol, t + 0.12); break;
    case 'overheat': osc('square', 600, 600, 0.08, 0.12 * vol, t); osc('square', 600, 600, 0.08, 0.12 * vol, t + 0.14); noise(0.5, 0.2 * vol, t, 'highpass', 6000, 3000); break;
    case 'empty': osc('square', 220, 200, 0.05, 0.08 * vol, t); break;
    case 'ability': osc('sine', 300, 1200, 0.35, 0.25 * vol, t); osc('triangle', 600, 2400, 0.3, 0.1 * vol, t + 0.05); break;
    case 'equip': osc('sine', 500, 900, 0.2, 0.2 * vol, t); break;
    case 'lock': osc('square', 1500, 1500, 0.05, 0.08 * vol, t); osc('square', 2000, 2000, 0.05, 0.08 * vol, t + 0.07); break;
    case 'lockwarn': osc('square', 1100, 1100, 0.06, 0.12 * vol, t); break;
    case 'kill': osc('triangle', 600, 1200, 0.15, 0.2 * vol, t); osc('triangle', 900, 1800, 0.2, 0.15 * vol, t + 0.08); break;
    case 'ui': osc('sine', 1200, 900, 0.06, 0.1 * vol, t); break;
    case 'uiconfirm': osc('sine', 700, 1400, 0.12, 0.15 * vol, t); break;
    case 'uideny': osc('square', 200, 150, 0.15, 0.1 * vol, t); break;
    case 'buy': osc('sine', 800, 800, 0.08, 0.15 * vol, t); osc('sine', 1200, 1200, 0.1, 0.15 * vol, t + 0.08); osc('sine', 1600, 1600, 0.15, 0.15 * vol, t + 0.16); break;
    case 'capture': osc('sine', 500, 500, 0.15, 0.2 * vol, t); osc('sine', 750, 750, 0.15, 0.2 * vol, t + 0.15); osc('sine', 1000, 1000, 0.3, 0.2 * vol, t + 0.3); break;
    case 'alarm': osc('sawtooth', 500, 900, 0.4, 0.12 * vol, t); osc('sawtooth', 500, 900, 0.4, 0.12 * vol, t + 0.45); break;
    case 'wave': osc('triangle', 300, 300, 0.2, 0.25 * vol, t); osc('triangle', 450, 450, 0.4, 0.25 * vol, t + 0.2); break;
    case 'slam': noise(1.0, 1.0 * vol, t, 'lowpass', 800, 40, 0.5); osc('sine', 50, 25, 0.8, 0.9 * vol, t); break;
    case 'warp': osc('sine', 1800, 200, 0.3, 0.2 * vol, t); noise(0.3, 0.2 * vol, t, 'bandpass', 4000, 800, 3); break;
    case 'heal': osc('sine', 600, 1000, 0.3, 0.12 * vol, t); break;
    case 'levelup': [523, 659, 784, 1046].forEach((f, i) => osc('triangle', f, f, 0.25, 0.2 * vol, t + i * 0.1)); break;
    case 'beam': osc('sawtooth', 70, 90, 1.2, 0.25 * vol, t); noise(1.2, 0.25 * vol, t, 'bandpass', 1500, 2500, 2); break;
    default: osc('sine', 440, 440, 0.1, 0.1 * vol, t);
  }
}

// ---------------------------------------------------------------------------
// Music: simple generative synthwave sequencer (bass, arp, pads, drums)
// ---------------------------------------------------------------------------
let musicTimer = null, step = 0, nextTime = 0, musicMode = null;
const SCALES = {
  menu: { root: 45, prog: [0, -4, 3, -2], bpm: 92, intensity: 0 },
  combat: { root: 40, prog: [0, 0, 3, 5, 0, 0, -2, -4], bpm: 128, intensity: 1 },
  boss: { root: 38, prog: [0, 1, 0, -2, 0, 1, 3, -1], bpm: 140, intensity: 2 },
};
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function playMusic(mode) {
  if (!ctx) return;
  if (musicMode === mode) return;
  musicMode = mode;
  if (musicTimer) clearInterval(musicTimer);
  if (!mode) return;
  step = 0; nextTime = ctx.currentTime + 0.1;
  musicTimer = setInterval(schedule, 50);
}

function schedule() {
  if (!ctx || !musicMode) return;
  const sc = SCALES[musicMode];
  const spb = 60 / sc.bpm / 4; // 16th notes
  while (nextTime < ctx.currentTime + 0.2) {
    const bar = Math.floor(step / 16);
    const chord = sc.prog[bar % sc.prog.length];
    const s = step % 16;
    const root = sc.root + chord;
    const t = nextTime;
    // bass
    if (sc.intensity === 0 ? s % 8 === 0 : (s % 4 === 0 || s % 4 === 3)) {
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = mtof(root - 12 + (s % 8 === 3 ? 12 : 0));
      f.type = 'lowpass'; f.frequency.value = 300 + sc.intensity * 250;
      env(g, t, 0.01, 0.22, spb * 3);
      o.connect(f); f.connect(g); g.connect(musicBus); o.start(t); o.stop(t + spb * 4);
    }
    // arp
    if (sc.intensity > 0 ? s % 2 === 0 : s % 4 === 2) {
      const notes = [0, 7, 12, 15, 19, 12, 7, 3];
      const n = root + 12 + notes[(step / 2) % notes.length | 0];
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square'; o.frequency.value = mtof(n);
      env(g, t, 0.005, 0.035, spb * 1.5);
      o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + spb * 2);
    }
    // pad
    if (s === 0) {
      [0, 3, 7].forEach((iv) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle'; o.frequency.value = mtof(root + 12 + iv);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.03, t + 0.3); g.gain.linearRampToValueAtTime(0.0001, t + spb * 16);
        o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + spb * 16 + 0.1);
      });
    }
    // drums
    if (sc.intensity > 0) {
      if (s % 4 === 0) { osc('sine', 120, 40, 0.18, 0.5, t, musicBus); }
      if (s % 8 === 4) noise(0.15, 0.22, t, 'highpass', 1800, 900, 0.7, musicBus);
      if (s % 2 === 1 && sc.intensity > 1) noise(0.04, 0.06, t, 'highpass', 8000, 7000, 1, musicBus);
      else if (s % 4 === 2) noise(0.04, 0.05, t, 'highpass', 8000, 7000, 1, musicBus);
    }
    nextTime += spb; step++;
  }
}
