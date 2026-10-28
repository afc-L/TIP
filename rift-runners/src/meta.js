// Permanent progression + settings, persisted in localStorage.

const SAVE_KEY = 'riftRunners.save.v1';
const SETTINGS_KEY = 'riftRunners.settings.v1';

export const SHOP = [
  { id: 'vitality', name: 'Hardened Soul', icon: '❤️', desc: '+10 starting max health', max: 5, costs: [40, 80, 140, 220, 320] },
  { id: 'might', name: 'Rift Might', icon: '⚔️', desc: '+5% damage', max: 5, costs: [50, 100, 170, 260, 380] },
  { id: 'wisdom', name: 'Echoed Wisdom', icon: '📘', desc: '+8% experience gain', max: 5, costs: [40, 80, 140, 220, 320] },
  { id: 'swift', name: 'Fleet Soles', icon: '👟', desc: '+4% movement speed', max: 3, costs: [60, 130, 230] },
  { id: 'magnet', name: 'Lodestone', icon: '🧲', desc: '+12% crystal pickup radius', max: 3, costs: [35, 75, 130] },
  { id: 'greed', name: 'Shard Greed', icon: '💎', desc: '+10% Rift Shards earned', max: 3, costs: [70, 150, 260] },
];

const DEFAULT_SAVE = { shards: 0, upgrades: {}, runs: 0, wins: 0, bestWave: 0, bestTime: 0 };
const DEFAULT_SETTINGS = { volume: 0.6, muted: false, shake: true, numbers: true, quality: 'high', autofire: false, showFps: false };

function load(key, def) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return structuredClone(def);
    return { ...structuredClone(def), ...JSON.parse(raw) };
  } catch {
    return structuredClone(def);
  }
}

function store(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* storage may be unavailable */ }
}

export class Meta {
  constructor() {
    this.data = load(SAVE_KEY, DEFAULT_SAVE);
    this.settings = load(SETTINGS_KEY, DEFAULT_SETTINGS);
  }

  save() { store(SAVE_KEY, this.data); }
  saveSettings() { store(SETTINGS_KEY, this.settings); }

  level(id) { return this.data.upgrades[id] || 0; }

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

  recordRun({ shards, wave, time, victory }) {
    this.data.shards += shards;
    this.data.runs += 1;
    if (victory) this.data.wins += 1;
    this.data.bestWave = Math.max(this.data.bestWave, wave);
    if (victory) this.data.bestTime = this.data.bestTime ? Math.min(this.data.bestTime, time) : time;
    this.save();
  }
}
