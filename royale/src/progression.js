// Local save: XP, levels, statistics, cosmetics loadout, challenges, daily objectives and settings.
const KEY = 'dropzone100.save.v1';

export const SEASON_CHALLENGES = [
  { id: 'elim10', text: 'Eliminate 10 opponents', stat: 'kills', goal: 10, xp: 2000 },
  { id: 'elim50', text: 'Eliminate 50 opponents', stat: 'kills', goal: 50, xp: 5000 },
  { id: 'win1', text: 'Win a match', stat: 'wins', goal: 1, xp: 4000 },
  { id: 'top10x5', text: 'Place top 10 in 5 matches', stat: 'top10', goal: 5, xp: 2500 },
  { id: 'chest25', text: 'Open 25 chests', stat: 'chests', goal: 25, xp: 1500 },
  { id: 'build250', text: 'Build 250 structures', stat: 'built', goal: 250, xp: 1500 },
  { id: 'harvest3000', text: 'Harvest 3,000 materials', stat: 'harvested', goal: 3000, xp: 1500 },
  { id: 'dmg5000', text: 'Deal 5,000 damage to opponents', stat: 'damage', goal: 5000, xp: 2500 },
  { id: 'travel20k', text: 'Travel 20 km on foot', stat: 'distance', goal: 20000, xp: 1500 },
  { id: 'survive60', text: 'Survive a total of 60 minutes', stat: 'timeAlive', goal: 3600, xp: 2000 },
  { id: 'play10', text: 'Play 10 matches', stat: 'matches', goal: 10, xp: 1500 },
];

const DAILY_POOL = [
  { id: 'd_elim3', text: 'Eliminate 3 opponents', key: 'kills', goal: 3, xp: 700 },
  { id: 'd_elim1', text: 'Eliminate an opponent', key: 'kills', goal: 1, xp: 400 },
  { id: 'd_chest7', text: 'Open 7 chests', key: 'chests', goal: 7, xp: 500 },
  { id: 'd_build60', text: 'Build 60 structures', key: 'built', goal: 60, xp: 500 },
  { id: 'd_harvest500', text: 'Harvest 500 materials', key: 'harvested', goal: 500, xp: 500 },
  { id: 'd_top25', text: 'Place top 25', key: 'top25', goal: 1, xp: 600 },
  { id: 'd_dmg800', text: 'Deal 800 damage to opponents', key: 'damage', goal: 800, xp: 600 },
  { id: 'd_travel3k', text: 'Travel 3,000 m on foot', key: 'distance', goal: 3000, xp: 500 },
  { id: 'd_heal', text: 'Use 6 healing or shield items', key: 'heals', goal: 6, xp: 500 },
  { id: 'd_survive', text: 'Survive 10 minutes in total', key: 'timeAlive', goal: 600, xp: 500 },
  { id: 'd_head', text: 'Land 5 headshots', key: 'headshots', goal: 5, xp: 600 },
];

export const DEFAULT_SETTINGS = {
  quality: 'medium', renderDist: 450, shadows: true, resScale: 1, weather: true, showFps: true,
  fov: 75, sensitivity: 1, adsSens: 0.75, invertY: false,
  master: 0.8, sfx: 1, music: 0.5,
  autoPickup: true, toggleSprint: false, editOnRelease: false, keepSlot: false, autoRun: false,
};

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

export class Progression {
  constructor() {
    this.data = this.load();
    this.ensureDaily();
  }
  defaults() {
    return {
      name: 'Player',
      xp: 0, level: 1,
      stats: { matches: 0, wins: 0, top10: 0, top25: 0, kills: 0, deaths: 0, damage: 0, timeAlive: 0, chests: 0, built: 0, harvested: 0, bestPlace: 0, distance: 0, headshots: 0, heals: 0 },
      loadout: { outfit: 'rookie', backpack: 'daypack', glider: 'basic', contrail: 'white' },
      settings: { ...DEFAULT_SETTINGS },
      claimed: {},
      daily: null,
      mode: 'solo', difficulty: 'normal',
      history: [],
    };
  }
  load() {
    const d = this.defaults();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        return { ...d, ...s, stats: { ...d.stats, ...(s.stats || {}) }, loadout: { ...d.loadout, ...(s.loadout || {}) }, settings: { ...d.settings, ...(s.settings || {}) }, claimed: s.claimed || {} };
      }
    } catch (e) { /* storage unavailable */ }
    return d;
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* ignore */ } }
  reset() { this.data = this.defaults(); this.ensureDaily(); this.save(); }

  static xpForLevel(l) { return 1000 + (l - 1) * 250; }
  get level() { return this.data.level; }
  get xpInto() { return this.data.xp; }
  get xpNeeded() { return Progression.xpForLevel(this.data.level); }
  addXp(n) {
    const ups = [];
    this.data.xp += Math.round(n);
    while (this.data.xp >= Progression.xpForLevel(this.data.level) && this.data.level < 100) {
      this.data.xp -= Progression.xpForLevel(this.data.level);
      this.data.level++;
      ups.push(this.data.level);
    }
    return ups;
  }

  ensureDaily() {
    const t = today();
    if (this.data.daily && this.data.daily.date === t) return;
    const h = hash(t);
    const pool = DAILY_POOL.slice();
    const list = [];
    let x = h;
    while (list.length < 3 && pool.length) {
      x = (Math.imul(x, 1103515245) + 12345) >>> 0;
      const i = x % pool.length;
      const c = pool.splice(i, 1)[0];
      list.push({ id: c.id, progress: 0, done: false });
    }
    this.data.daily = { date: t, list };
  }
  dailyDefs() {
    this.ensureDaily();
    return this.data.daily.list.map((d) => ({ ...DAILY_POOL.find((p) => p.id === d.id), progress: d.progress, done: d.done }));
  }
  seasonDefs() {
    return SEASON_CHALLENGES.map((c) => ({ ...c, progress: Math.min(c.goal, this.data.stats[c.stat] || 0), claimed: !!this.data.claimed[c.id] }));
  }

  // Apply a finished match's numbers. Returns a summary for the results screen.
  recordMatch(m) {
    const s = this.data.stats;
    s.matches++;
    s.kills += m.kills; s.damage += Math.round(m.damage); s.timeAlive += Math.round(m.timeAlive);
    s.chests += m.chests; s.built += m.built; s.harvested += m.harvested; s.distance += Math.round(m.distance);
    s.headshots += m.headshots; s.heals += m.heals;
    if (m.place === 1) s.wins++;
    if (m.place <= 10) s.top10++;
    if (m.place <= 25) s.top25++;
    if (m.place > 1) s.deaths++;
    if (!s.bestPlace || m.place < s.bestPlace) s.bestPlace = m.place;
    const breakdown = [];
    const placeXp = Math.round(Math.max(0, (101 - m.place)) * 5 * (m.total / 100) + (m.place === 1 ? 1200 : m.place <= 10 ? 300 : 0));
    breakdown.push(['Placement #' + m.place, placeXp]);
    breakdown.push(['Eliminations x' + m.kills, m.kills * 120]);
    breakdown.push(['Survival ' + Math.floor(m.timeAlive / 60) + 'm', Math.round(m.timeAlive * 1.2)]);
    breakdown.push(['Chests opened x' + m.chests, m.chests * 25]);
    // daily progress
    const daily = this.dailyDefs();
    const dKeys = { kills: m.kills, chests: m.chests, built: m.built, harvested: m.harvested, top25: m.place <= 25 ? 1 : 0, damage: m.damage, distance: m.distance, heals: m.heals, timeAlive: m.timeAlive, headshots: m.headshots };
    const completed = [];
    this.data.daily.list.forEach((d, i) => {
      if (d.done) return;
      const def = daily[i];
      d.progress = Math.min(def.goal, d.progress + (dKeys[def.key] || 0));
      if (d.progress >= def.goal) { d.done = true; completed.push(def.text); breakdown.push(['Daily: ' + def.text, def.xp]); }
    });
    for (const c of this.seasonDefs()) {
      if (c.progress >= c.goal && !c.claimed) {
        this.data.claimed[c.id] = true;
        completed.push(c.text);
        breakdown.push(['Challenge: ' + c.text, c.xp]);
      }
    }
    const total = breakdown.reduce((a, b) => a + b[1], 0);
    const before = this.data.level;
    const ups = this.addXp(total);
    this.data.history.unshift({ place: m.place, kills: m.kills, date: Date.now(), mode: m.mode });
    this.data.history = this.data.history.slice(0, 20);
    this.save();
    return { breakdown, total, ups, levelBefore: before, completed };
  }
}
