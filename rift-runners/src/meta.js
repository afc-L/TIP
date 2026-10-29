// Permanent progression + settings, persisted in localStorage.
import { CLASSES, START_WEAPONS, LOADOUTS, COSMETICS, ARENAS } from './characters.js';
import { RELICS } from './relics.js';

const SAVE_KEY_V1 = 'riftRunners.save.v1';
const SAVE_KEY = 'riftRunners.save.v2';
const SETTINGS_KEY = 'riftRunners.settings.v1';

export const SHOP = [
  { id: 'vitality', name: 'Hardened Soul', icon: '❤️', desc: '+8 starting max health', max: 5, costs: [40, 80, 140, 220, 320] },
  { id: 'might', name: 'Rift Might', icon: '⚔️', desc: '+4% damage', max: 5, costs: [50, 100, 170, 260, 380] },
  { id: 'wisdom', name: 'Echoed Wisdom', icon: '📘', desc: '+6% experience gain', max: 5, costs: [40, 80, 140, 220, 320] },
  { id: 'swift', name: 'Fleet Soles', icon: '👟', desc: '+3% movement speed', max: 3, costs: [60, 130, 230] },
  { id: 'magnet', name: 'Lodestone', icon: '🧲', desc: '+12% crystal pickup radius', max: 3, costs: [35, 75, 130] },
  { id: 'greed', name: 'Shard Greed', icon: '💎', desc: '+10% Rift Shards earned', max: 3, costs: [70, 150, 260] },
];

const DEFAULT_SAVE = {
  shards: 0, upgrades: {}, runs: 0, wins: 0, bestWave: 0, bestTime: 0,
  winsByDiff: { normal: 0, hard: 0, nightmare: 0 },
  unlocks: { classes: ['runner'], weapons: ['bolt'], relics: [], arenas: ['temple'], cloaks: ['default'], trails: ['default'], loadouts: ['standard'] },
  seen: {},              // enemy type -> kills (bestiary)
  found: { relics: [], weapons: [], evolutions: [] },
  records: { endlessWave: 0, endlessTime: 0 },
  history: [],
  selected: { cls: 'runner', weapon: 'class', loadout: 'standard', diff: 'normal', arena: 'random', cloak: 'default', trail: 'default' },
};
const DEFAULT_SETTINGS = { volume: 0.6, muted: false, shake: true, numbers: true, quality: 'high', autofire: false, showFps: false, particles: 'high', reduceFlash: false };

function read(key) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

function store(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* storage may be unavailable */ }
}

// Deep-ish merge so new fields appear in old saves.
function withDefaults(def, val) {
  if (!val || typeof val !== 'object' || Array.isArray(def)) return val ?? structuredClone(def);
  const out = structuredClone(def);
  for (const k of Object.keys(val)) {
    out[k] = def[k] && typeof def[k] === 'object' && !Array.isArray(def[k]) ? withDefaults(def[k], val[k]) : val[k];
  }
  return out;
}

export class Meta {
  constructor() {
    let raw = read(SAVE_KEY);
    if (!raw) {
      // Migrate 1.0 saves: keep shards, shop ranks and stats; a past win unlocks Endless.
      const v1 = read(SAVE_KEY_V1);
      if (v1) raw = { shards: v1.shards || 0, upgrades: v1.upgrades || {}, runs: v1.runs || 0, wins: v1.wins || 0, bestWave: v1.bestWave || 0, bestTime: v1.bestTime || 0, winsByDiff: { normal: v1.wins || 0 } };
    }
    this.data = withDefaults(DEFAULT_SAVE, raw || {});
    this.settings = withDefaults(DEFAULT_SETTINGS, read(SETTINGS_KEY) || {});
    this.save();
  }

  save() { store(SAVE_KEY, this.data); }
  saveSettings() { store(SETTINGS_KEY, this.settings); }

  level(id) { return this.data.upgrades[id] || 0; }
  get endlessUnlocked() { return this.data.wins > 0; }
  get nightmareUnlocked() { return this.data.wins > 0; }

  // Flat object consumed by computeStats().
  bonuses() {
    const o = {};
    for (const s of SHOP) o[s.id] = this.level(s.id);
    return o;
  }

  cost(id) {
    const item = SHOP.find((s) => s.id === id);
    const l = this.level(id);
    return l >= item.max ? null : item.costs[l];
  }

  buy(id) {
    const c = this.cost(id);
    if (c === null || this.data.shards < c) return false;
    this.data.shards -= c;
    this.data.upgrades[id] = this.level(id) + 1;
    this.save();
    return true;
  }

  // Unlock catalog: category -> { id: cost }
  unlockCost(cat, id) {
    switch (cat) {
      case 'classes': return CLASSES[id]?.cost;
      case 'weapons': return START_WEAPONS[id] ?? null;
      case 'relics': return RELICS.find((r) => r.id === id)?.unlock;
      case 'arenas': return ARENAS[id]?.cost;
      case 'cloaks': return COSMETICS.cloaks[id]?.cost;
      case 'trails': return COSMETICS.trails[id]?.cost;
      case 'loadouts': return LOADOUTS[id]?.cost;
    }
    return null;
  }

  isUnlocked(cat, id) {
    if (cat === 'weapons' && (START_WEAPONS[id] === 0)) return true;
    return this.data.unlocks[cat].includes(id);
  }

  unlock(cat, id, free = false) {
    if (this.isUnlocked(cat, id)) return false;
    const c = this.unlockCost(cat, id);
    if (!free && (c == null || this.data.shards < c)) return false;
    if (!free) this.data.shards -= c;
    this.data.unlocks[cat].push(id);
    this.save();
    return true;
  }

  refund() {
    let total = 0;
    for (const s of SHOP) {
      const l = this.level(s.id);
      for (let i = 0; i < l; i++) total += s.costs[i];
    }
    this.data.shards += total;
    this.data.upgrades = {};
    this.save();
  }

  discover(kind, id) {
    const list = this.data.found[kind];
    if (list && !list.includes(id)) { list.push(id); return true; }
    return false;
  }

  recordKill(type) {
    this.data.seen[type] = (this.data.seen[type] || 0) + 1;
  }

  recordRun(r) {
    const d = this.data;
    d.shards += r.shards;
    d.runs += 1;
    if (r.victory) {
      d.wins += 1;
      d.winsByDiff[r.diff] = (d.winsByDiff[r.diff] || 0) + 1;
      d.bestTime = d.bestTime ? Math.min(d.bestTime, r.time) : r.time;
    }
    if (r.mode === 'campaign') d.bestWave = Math.max(d.bestWave, r.wave);
    let newRecord = false;
    if (r.mode === 'endless') {
      if (r.wave > d.records.endlessWave) { d.records.endlessWave = r.wave; newRecord = true; }
      if (r.time > d.records.endlessTime) { d.records.endlessTime = r.time; newRecord = true; }
    }
    d.history.unshift({ date: Date.now(), mode: r.mode, diff: r.diff, cls: r.cls, victory: r.victory, wave: r.wave, time: Math.round(r.time), kills: r.kills, level: r.level, shards: r.shards, arena: r.arena });
    d.history.length = Math.min(d.history.length, 12);
    this.save();
    return newRecord;
  }
}
