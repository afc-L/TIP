// Profile, persistence (localStorage), loadout stat computation, daily ops.
import {
  FRAMES, WEAPONS, EQUIPMENT, ARMORS, MOBILITY, UPGRADE_BRANCHES, UPGRADE_TIERS, ACHIEVEMENTS,
  ARENA_ORDER, MODE_ORDER, CONDITIONS, CONTRACT_POOL, xpForLevel, MAX_LEVEL, FRAME_ORDER, WEAPON_ORDER,
  CHALLENGES, BOSS_ORDER,
} from './data.js';

const KEY = 'mechArenaZero.save.v1';

export const DEFAULT_KEYS = {
  fire1: 'Mouse0', fire2: 'Mouse2',
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
  jump: 'Space', sprint: 'ShiftLeft', dash: 'KeyC', reload: 'KeyR',
  equipUse: 'KeyQ', ability: 'KeyF', lock: 'KeyT', zoom: 'KeyV',
  slot1: 'Digit1', slot2: 'Digit2', slot3: 'Digit3', slot4: 'Digit4',
  scoreboard: 'Tab',
};
export const KEY_LABELS = {
  fire1: 'Fire Primary Weapon', fire2: 'Fire Secondary Weapon',
  forward: 'Move Forward', back: 'Move Back', left: 'Strafe Left', right: 'Strafe Right',
  jump: 'Jump / Jets (hold)', sprint: 'Sprint (hold)', dash: 'Boost Dash', reload: 'Reload / Vent Heat',
  equipUse: 'Use Selected Equipment', ability: 'Mech Ability', lock: 'Target Lock', zoom: 'Zoom (hold)',
  slot1: 'Equipment Slot 1', slot2: 'Equipment Slot 2', slot3: 'Equipment Slot 3', slot4: 'Equipment Slot 4',
  scoreboard: 'Scoreboard (hold)',
};

export const KEY_GROUPS = [
  { name: 'Movement', keys: ['forward', 'back', 'left', 'right', 'jump', 'sprint', 'dash'] },
  { name: 'Combat', keys: ['fire1', 'fire2', 'reload', 'ability', 'lock', 'zoom'] },
  { name: 'Equipment', keys: ['slot1', 'slot2', 'slot3', 'slot4', 'equipUse'] },
  { name: 'Interface', keys: ['scoreboard'] },
];

function defaultSettings() {
  return {
    quality: 'medium', // low | medium | high
    renderScale: 1, shadows: true, particles: 1, showFps: false, damageNumbers: true,
    sensitivity: 1.0, invertY: false, fov: 70, aimAssist: true, cameraShake: 1,
    masterVol: 0.8, sfxVol: 0.8, musicVol: 0.45, music: true,
    difficulty: 'normal', keys: { ...DEFAULT_KEYS },
  };
}

function defaultLoadout(frameId) {
  const f = FRAMES[frameId];
  const eq = ['aegis', 'repair'];
  return { frame: frameId, armor: 'standard', mobility: 'standard', weapons: ['pulse', 'missile'], equip: eq.slice(0, f.slots) };
}

export function defaultProfile() {
  const loadouts = {};
  for (const id of FRAME_ORDER) loadouts[id] = defaultLoadout(id);
  return {
    version: 1, pilot: 'PILOT', created: Date.now(),
    credits: 1000, rp: 0, xp: 0, level: 1,
    ownedFrames: ['striker'], ownedWeapons: ['pulse', 'missile'], ownedEquip: ['aegis', 'repair'],
    ownedArmor: ['standard'], ownedMobility: ['standard'],
    currentFrame: 'striker', loadouts,
    upgrades: { armor: 0, mobility: 0, weapons: 0, energy: 0, shields: 0, abilities: 0 },
    achievements: {},
    bosses: {}, challenges: {}, arenaWins: {},
    stats: {
      matches: 0, wins: 0, losses: 0, kills: 0, deaths: 0, bossKills: 0, damage: 0, damageTaken: 0,
      bestWave: 0, crits: 0, playTime: 0, mechUse: {}, weaponDamage: {}, shotsFired: 0, shotsHit: 0,
      modePlays: {},
    },
    daily: null,
    settings: defaultSettings(),
    lastMode: { mode: 'survival', arena: 'industrial' },
  };
}

function merge(base, saved) {
  if (saved === null || saved === undefined) return base;
  if (typeof base !== 'object' || Array.isArray(base) || base === null) return saved;
  const out = { ...base };
  for (const k of Object.keys(saved)) {
    out[k] = (k in base) ? merge(base[k], saved[k]) : saved[k];
  }
  return out;
}

export const profile = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultProfile();
    const parsed = JSON.parse(raw);
    const p = merge(defaultProfile(), parsed);
    // sanitize loadouts
    for (const id of FRAME_ORDER) {
      const l = p.loadouts[id];
      if (!l || !Array.isArray(l.weapons) || l.weapons.length !== 2) p.loadouts[id] = defaultLoadout(id);
      if (!Array.isArray(p.loadouts[id].equip)) p.loadouts[id].equip = [];
    }
    // keep deliberately unbound (null) actions; only fill in actions added in newer versions
    p.settings.keys = { ...DEFAULT_KEYS, ...((parsed.settings && parsed.settings.keys) || {}) };
    return p;
  } catch (e) {
    console.warn('Save load failed, starting fresh', e);
    return defaultProfile();
  }
}

let saveTimer = null;
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch (e) { console.warn('save failed', e); }
}
export function saveSoon() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = null; save(); }, 400);
}
export function resetProfile() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  const fresh = defaultProfile();
  for (const k of Object.keys(profile)) delete profile[k];
  Object.assign(profile, fresh);
  save();
  return profile;
}

// ---------------------------------------------------------------------------
export function owns(kind, id) {
  const map = { frame: 'ownedFrames', weapon: 'ownedWeapons', equip: 'ownedEquip', armor: 'ownedArmor', mobility: 'ownedMobility' };
  return profile[map[kind]].includes(id);
}
const CATALOG = { frame: FRAMES, weapon: WEAPONS, equip: EQUIPMENT, armor: ARMORS, mobility: MOBILITY };
export function itemDef(kind, id) { return CATALOG[kind][id]; }

export function canBuy(kind, id) {
  const d = itemDef(kind, id);
  if (owns(kind, id)) return { ok: false, why: 'Owned' };
  if (profile.level < d.level) return { ok: false, why: `Requires pilot level ${d.level}` };
  if (kind === 'frame' && id === 'apex' && Object.keys(profile.bosses).length < 2) return { ok: false, why: 'Defeat 2 bosses to unlock' };
  if (profile.credits < (d.cost || 0)) return { ok: false, why: 'Not enough credits' };
  if (profile.rp < (d.rp || 0)) return { ok: false, why: 'Not enough research points' };
  return { ok: true };
}
export function buy(kind, id) {
  const c = canBuy(kind, id);
  if (!c.ok) return c;
  const d = itemDef(kind, id);
  profile.credits -= d.cost || 0;
  profile.rp -= d.rp || 0;
  const map = { frame: 'ownedFrames', weapon: 'ownedWeapons', equip: 'ownedEquip', armor: 'ownedArmor', mobility: 'ownedMobility' };
  profile[map[kind]].push(id);
  save();
  return { ok: true };
}

export function upgradeCost(branch) {
  const tier = profile.upgrades[branch];
  return tier >= UPGRADE_TIERS.length ? null : UPGRADE_TIERS[tier];
}
export function canUpgrade(branch) {
  const t = upgradeCost(branch);
  if (!t) return { ok: false, why: 'Maxed' };
  if (profile.level < t.level) return { ok: false, why: `Requires level ${t.level}` };
  if (profile.credits < t.cost) return { ok: false, why: 'Not enough credits' };
  if (profile.rp < t.rp) return { ok: false, why: 'Not enough research points' };
  return { ok: true };
}
export function doUpgrade(branch) {
  const c = canUpgrade(branch);
  if (!c.ok) return c;
  const t = upgradeCost(branch);
  profile.credits -= t.cost; profile.rp -= t.rp;
  profile.upgrades[branch]++;
  save();
  return { ok: true };
}
export function upgradeTotal() { return Object.values(profile.upgrades).reduce((a, b) => a + b, 0); }

// ---------------------------------------------------------------------------
// Loadout helpers
// ---------------------------------------------------------------------------
export function loadoutWeight(l) {
  let w = WEAPONS[l.weapons[0]].weight + WEAPONS[l.weapons[1]].weight;
  w += ARMORS[l.armor].weight + MOBILITY[l.mobility].weight;
  for (const e of l.equip) if (e) w += EQUIPMENT[e].weight;
  return w;
}

/** Computes effective combat stats for a loadout. upgrades: tier map (enemies pass zeros). */
export function computeStats(l, upgrades = null, mods = {}) {
  const f = FRAMES[l.frame];
  const a = ARMORS[l.armor];
  const m = MOBILITY[l.mobility];
  const u = upgrades || { armor: 0, mobility: 0, weapons: 0, energy: 0, shields: 0, abilities: 0 };
  const s = {
    maxHp: f.hp * a.hpMul * (m.hpMul || 1) * (1 + 0.05 * u.armor),
    maxShield: f.shield * (1 + 0.07 * u.shields),
    shieldDelay: 3.2 * (1 - 0.08 * u.shields),
    shieldRegen: f.shield * 0.22 * (1 + 0.04 * u.shields),
    speed: f.speed * a.speedMul * (m.speedMul || 1) * (1 + 0.03 * u.mobility),
    accel: f.accel,
    jump: f.jump * (m.jumpMul || 1),
    jet: 1 * (m.jetMul || 1),
    maxEnergy: f.energy * (1 + 0.08 * u.energy),
    energyRegen: f.energyRegen * (a.energyRegenMul || 1) * (1 + 0.08 * u.energy),
    dashCost: 28 * (m.dashCost || 1) * (1 - 0.06 * u.mobility),
    dashCharges: m.dashCharges || 1,
    sprintCost: 9 * (m.sprintCost || 1),
    knockRes: m.knockRes || 0,
    stability: m.stability || 0,
    dmgMul: 1 + 0.04 * u.weapons,
    heatMul: 1 - 0.05 * u.weapons,
    reloadMul: 1 - 0.05 * u.weapons,
    cdMul: 1 - 0.06 * u.abilities,
    resist: { ...a.resist },
    radius: f.radius, height: f.height,
  };
  if (mods.armorMul) s.maxHp *= mods.armorMul;
  if (mods.dmgMul) s.dmgMul *= mods.dmgMul;
  if (mods.noShield) s.maxShield = 0;
  if (mods.energyRegen) s.energyRegen *= mods.energyRegen;
  return s;
}

// ---------------------------------------------------------------------------
// Unlock checks
// ---------------------------------------------------------------------------
export function arenaUnlocked(id) { return profile.level >= ({ industrial: 1, desert: 2, frozen: 4, neon: 6, volcanic: 9, orbital: 12 })[id]; }
export function bossUnlocked(id, BOSSES) {
  const b = BOSSES[id];
  if (profile.level < b.level) return false;
  if (b.requires && !profile.bosses[b.requires]) return false;
  return true;
}

// ---------------------------------------------------------------------------
// XP / rewards
// ---------------------------------------------------------------------------
export function addXp(amount) {
  const ups = [];
  profile.xp += Math.round(amount);
  while (profile.level < MAX_LEVEL && profile.xp >= xpForLevel(profile.level)) {
    profile.xp -= xpForLevel(profile.level);
    profile.level++;
    ups.push(profile.level);
  }
  if (profile.level >= MAX_LEVEL) profile.xp = Math.min(profile.xp, xpForLevel(MAX_LEVEL));
  return ups;
}

/** Checks achievement conditions; returns newly unlocked ids. */
export function checkAchievements(extra = {}) {
  const s = profile.stats;
  const got = [];
  const award = (id, cond) => {
    if (cond && !profile.achievements[id]) {
      profile.achievements[id] = Date.now();
      profile.credits += ACHIEVEMENTS[id].reward;
      got.push(id);
    }
  };
  award('first_blood', s.kills >= 1);
  award('first_win', s.wins >= 1);
  award('centurion', s.kills >= 100);
  award('annihilator', s.kills >= 500);
  award('boss_hunter', Object.keys(profile.bosses).length >= 1);
  award('boss_slayer', BOSS_ORDER.every((b) => profile.bosses[b]));
  award('arena_champion', ARENA_ORDER.every((a) => profile.arenaWins[a]));
  award('survivor10', s.bestWave >= 10);
  award('survivor20', s.bestWave >= 20);
  award('dominator', !!extra.dominationWin || (profile.stats.modePlays.dominationWins || 0) > 0);
  award('elite_pilot', profile.level >= 15);
  award('ace', profile.level >= 30);
  award('master_engineer', Object.values(profile.upgrades).some((t) => t >= UPGRADE_TIERS.length));
  award('ultimate_mech', profile.ownedFrames.includes('apex'));
  award('collector', FRAME_ORDER.every((f) => profile.ownedFrames.includes(f)));
  award('arsenal', WEAPON_ORDER.every((w) => profile.ownedWeapons.includes(w)));
  award('untouchable', !!extra.untouchable);
  award('expert_win', !!extra.expertWin);
  award('sharpshooter', s.crits >= 100);
  award('challenger', Object.keys(profile.challenges).length >= 5);
  award('challenge_master', CHALLENGES.every((c) => profile.challenges[c.id]));
  award('daily_op', !!extra.dailyDone);
  award('demolisher', s.damage >= 250000);
  return got;
}

// ---------------------------------------------------------------------------
// Daily operations & contracts (locally generated from the date)
// ---------------------------------------------------------------------------
export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function seeded(seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
}
export function ensureDaily() {
  const key = todayKey();
  if (profile.daily && profile.daily.date === key) return profile.daily;
  const rnd = seeded('MAZ' + key);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const unlockedArenas = ARENA_ORDER.filter(arenaUnlocked);
  const modes = ['survival', 'elimination', 'domination'].filter((m) => MODE_ORDER.includes(m));
  const conds = Object.keys(CONDITIONS).filter((c) => c !== 'clear');
  const pool = CONTRACT_POOL.slice();
  const contracts = [];
  for (let i = 0; i < 3; i++) {
    const idx = Math.floor(rnd() * pool.length);
    const c = pool.splice(idx, 1)[0];
    const n = c.n[Math.floor(rnd() * c.n.length)];
    contracts.push({ id: c.id, text: c.text.replace('{n}', n.toLocaleString()), n, stat: c.stat, progress: 0, reward: c.reward, done: false });
  }
  profile.daily = {
    date: key,
    op: {
      mode: pick(modes), arena: pick(unlockedArenas.length ? unlockedArenas : ['industrial']),
      condition: pick(conds), difficulty: pick(['normal', 'hard']), done: false,
      size: pick(['skirmish', 'squad', 'outnumbered']),
    },
    contracts,
  };
  save();
  return profile.daily;
}

/** Adds progress to daily contracts; returns contracts completed now. */
export function contractProgress(stat, amount) {
  const d = ensureDaily();
  const done = [];
  for (const c of d.contracts) {
    if (c.done || c.stat !== stat) continue;
    c.progress = Math.min(c.n, c.progress + amount);
    if (c.progress >= c.n) { c.done = true; profile.credits += c.reward; done.push(c); }
  }
  return done;
}
