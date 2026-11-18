// Save data + progression: essence currency, unlocks, upgrades, skins, records.
const KEY = 'the_hollow_save_v1';

export const SHOP = [
  { id: 'ability_presence', type: 'ability', name: 'Terrifying Presence', cost: 120, desc: 'Lights fail around you; people feel watched and panic sooner.' },
  { id: 'ability_roar', type: 'ability', name: 'Roar', cost: 150, desc: 'A sound that makes people freeze and cower.' },
  { id: 'ability_mimic', type: 'ability', name: 'Mimic', cost: 220, desc: 'Throw a human voice. The curious come to look.' },
  { id: 'ability_stalk', type: 'ability', name: 'Stalk', cost: 260, desc: 'Move almost silently; crouched movement is far faster.' },
  { id: 'up_senses', type: 'upgrade', key: 'senses', name: 'Keener Senses', cost: [90, 180], desc: 'Shorter cooldown, longer duration, wider range.' },
  { id: 'up_predator', type: 'upgrade', key: 'predator', name: 'Burning Sight', cost: [90, 180], desc: 'Predator Vision lasts longer and recovers sooner.' },
  { id: 'up_presence', type: 'upgrade', key: 'presence', name: 'Deeper Dread', cost: [120, 220], desc: 'Terrifying Presence reaches further.', requires: 'ability_presence' },
  { id: 'up_roar', type: 'upgrade', key: 'roar', name: 'Thunderous Roar', cost: [120, 220], desc: 'Roar reaches further and people cower longer.', requires: 'ability_roar' },
  { id: 'up_night', type: 'upgrade', key: 'night', name: 'Eyes of the Deep', cost: [80, 160], desc: 'Night Vision drains slower.' },
  { id: 'up_feed', type: 'upgrade', key: 'feed', name: 'Ravenous', cost: [120], desc: 'Feeding is faster.' },
  { id: 'up_speed', type: 'upgrade', key: 'speed', name: 'Long Stride', cost: [150, 260], desc: 'Move faster.' },
  { id: 'up_jump', type: 'upgrade', key: 'jump', name: 'Coiled Legs', cost: [100], desc: 'Jump higher.' },
  { id: 'up_attack', type: 'upgrade', key: 'attack', name: 'Feral Strikes', cost: [180], desc: 'Attack faster and harder.' },
  { id: 'skin_charred', type: 'skin', key: 'charred', name: 'Skin: Charred', cost: 200, desc: 'Burned, but it did not stop.' },
  { id: 'skin_abyssal', type: 'skin', key: 'abyssal', name: 'Skin: Abyssal', cost: 300, desc: 'Something from deep water.' },
  { id: 'skin_ossuary', type: 'skin', key: 'ossuary', name: 'Skin: Ossuary', cost: 300, desc: 'More bone than skin.' },
];

const DEFAULT = () => ({
  essence: 0, totalEssence: 0, unlocked: [], upgrades: {}, chapter: 1, storyComplete: false,
  notes: [], symbols: [], skin: 'pale', bestSurvival: {}, challenges: [], stats: { fed: 0, seen: 0, deaths: 0, playtime: 0 },
  settings: {}, unlockAll: false,
});

export class Progress {
  constructor() { this.d = this.load(); }
  load() { try { const raw = localStorage.getItem(KEY); if (raw) return Object.assign(DEFAULT(), JSON.parse(raw)); } catch (e) { /* private mode */ } return DEFAULT(); }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.d)); } catch (e) { /* ignore */ } }
  reset() { const s = this.d.settings; this.d = DEFAULT(); this.d.settings = s; this.save(); }
  addEssence(n) { this.d.essence += n; this.d.totalEssence += n; this.save(); }
  spend(n) { if (this.d.essence < n) return false; this.d.essence -= n; this.save(); return true; }
  isUnlocked(id) { return this.d.unlockAll || this.d.unlocked.includes(id); }
  unlock(id) { if (!this.d.unlocked.includes(id)) this.d.unlocked.push(id); this.save(); }
  upgradeLevel(k) { return this.d.upgrades[k] || 0; }
  buy(item) {
    if (item.type === 'upgrade') {
      const lvl = this.upgradeLevel(item.key); const costs = item.cost; if (lvl >= costs.length) return false;
      if (item.requires && !this.isUnlocked(item.requires)) return false;
      if (!this.spend(costs[lvl])) return false;
      this.d.upgrades[item.key] = lvl + 1; this.save(); return true;
    }
    if (this.isUnlocked(item.id)) return false;
    if (!this.spend(item.cost)) return false;
    this.unlock(item.id); return true;
  }
  mapUnlocked(key, order) { return this.d.unlockAll || order <= this.d.chapter; }
  modeUnlocked(mode) {
    if (this.d.unlockAll) return true;
    if (mode === 'survival') return this.d.chapter >= 3;
    if (mode === 'nightmare') return this.d.chapter >= 5 || this.d.storyComplete;
    return true;
  }
  skinOwned(k) { return k === 'pale' || this.d.unlockAll || this.isUnlocked('skin_' + k) || (k === 'hollow' && this.d.symbols.length >= 5); }
  addNote(id) { if (!this.d.notes.includes(id)) { this.d.notes.push(id); this.save(); return true; } return false; }
  addSymbol(id) { if (!this.d.symbols.includes(id)) { this.d.symbols.push(id); this.save(); return true; } return false; }
  completeChallenge(id) { if (!this.d.challenges.includes(id)) { this.d.challenges.push(id); this.save(); return true; } return false; }
}
