// Central tuning tables. Most balance changes only need edits here.

export const ARENA_RADIUS = 38;
export const MAX_ALIVE = 80;          // hard cap on simultaneously active enemies (keeps crowds readable)
export const MAX_PLAYER_PROJECTILES = 260;
export const MAX_ENEMY_PROJECTILES = 280;

export const PLAYER_BASE = {
  maxHp: 100,
  speed: 8.6,
  radius: 0.55,
  dashCooldown: 1.5,
  dashDuration: 0.17,
  dashSpeed: 34,
  pulseCooldown: 10,
  pickupRadius: 3.0,
  invulnTime: 0.7,
  critChance: 0.05,
  critMult: 2,
};

export const MAX_WEAPONS = 4;
export const MAX_RELICS = 4;

export const WEAPONS = {
  bolt:   { name: 'Rift Bolt',       icon: '✦', damage: 10, cooldown: 0.3, speed: 30, life: 0.85, radius: 0.35,
            desc: 'Fast projectile toward the cursor.' },
  slash:  { name: 'Rift Slash',      icon: '⚔', damage: 20, cooldown: 0.5, range: 3.4, arc: 1.9,
            desc: 'Short-range sweeping slash in front of you.' },
  arc:    { name: 'Arc Burst',       icon: 'ϟ', damage: 15, cooldown: 1.35, radius: 4.6,
            desc: 'Crackling burst that hits everything around you.' },
  orb:    { name: 'Void Orb',        icon: '◉', damage: 42, cooldown: 1.9, speed: 12.5, life: 2.4, radius: 0.85,
            desc: 'Slow, heavy orb of void energy.' },
  zap:    { name: 'Chain Lightning', icon: '⚡', damage: 15, cooldown: 1.15, range: 12,
            desc: 'Lightning that jumps between nearby enemies.' },
  blades: { name: 'Shadow Blades',   icon: '🗡', damage: 9, cooldown: 0, radius: 2.6,
            desc: 'Blades orbit you and cut anything they touch. Always active.' },
  meteor: { name: 'Meteor Call',     icon: '☄', damage: 70, cooldown: 3.2, radius: 3.2, delay: 0.9,
            desc: 'Marks the ground at the cursor, then drops a meteor.' },
};

// Enemy archetypes. hp/damage are scaled per wave by waveScaling() and by difficulty.
export const ENEMY_TYPES = {
  crawler:    { name: 'Crawler',     color: '#c47bff', hp: 16, speed: 4.3, radius: 0.62, damage: 8, xp: 1, shards: 0.1,
                desc: 'Swarms and chases you down. Weak alone, dangerous in packs.' },
  dasher:     { name: 'Dasher',      color: '#38d6d0', hp: 14, speed: 3.7, radius: 0.58, damage: 12, xp: 2, shards: 0.15, chargeSpeed: 23, chargeRange: 11,
                desc: 'Flashes a yellow lane, then charges straight along it. Sidestep the lane.' },
  spitter:    { name: 'Spitter',     color: '#9dff3a', hp: 24, speed: 3.0, radius: 0.7, damage: 6, xp: 2, shards: 0.15, shotDamage: 9, shotSpeed: 11, fireCd: 2.6,
                desc: 'Keeps its distance and spits acid globs at you.' },
  brute:      { name: 'Brute',       color: '#ff8a3a', hp: 120, speed: 2.1, radius: 1.3, damage: 18, xp: 7, shards: 0.5, slamDamage: 24, slamRadius: 3.8,
                desc: 'Slow and tanky. Raises its fists and slams the ground in an orange circle.' },
  stalker:    { name: 'Rift Stalker', color: '#b07bff', hp: 13, speed: 3.4, radius: 0.55, damage: 13, xp: 2, shards: 0.15,
                desc: 'Marks a purple circle, then teleports there and lunges. Low health.' },
  splitter:   { name: 'Splitter',    color: '#ff5fa2', hp: 34, speed: 3.0, radius: 0.85, damage: 10, xp: 2, shards: 0.15,
                desc: 'Splits into two small, fragile blobs when destroyed.' },
  priest:     { name: 'Void Priest', color: '#7d5cff', hp: 46, speed: 2.4, radius: 0.75, damage: 6, xp: 5, shards: 0.4, auraRadius: 7,
                desc: 'Its aura makes nearby enemies faster and tougher. Kill it first.' },
  bombardier: { name: 'Bombardier',  color: '#ffb02e', hp: 36, speed: 2.5, radius: 0.8, damage: 8, xp: 4, shards: 0.3, shellDamage: 16, shellRadius: 2.3,
                desc: 'Lobs slow shells. The landing spot is marked on the ground.' },
  knight:     { name: 'Mirror Knight', color: '#cfe6ff', hp: 80, speed: 2.7, radius: 0.9, damage: 12, xp: 6, shards: 0.5, thrustDamage: 20,
                desc: 'Its mirror shield blocks attacks from the front. Hit it from behind or after it thrusts.' },
  leech:      { name: 'Soul Leech',  color: '#ff3355', hp: 16, speed: 5.0, radius: 0.5, damage: 5, xp: 2, shards: 0.15, drain: 4,
                desc: 'Latches on and drains your health. Dash away or hit it to break the tether.' },
  // Devices deployed by the Rift Engineer
  turret:     { name: 'Turret',      color: '#ffd166', hp: 140, speed: 0, radius: 0.8, damage: 0, xp: 2, shards: 0, device: true },
  pylon:      { name: 'Shield Pylon', color: '#5ad1ff', hp: 150, speed: 0, radius: 0.7, damage: 0, xp: 2, shards: 0, device: true },
  mine:       { name: 'Rift Mine',   color: '#ff4d6d', hp: 20, speed: 0, radius: 0.45, damage: 0, xp: 0, shards: 0, device: true },
};

export const BESTIARY_ORDER = ['crawler', 'dasher', 'spitter', 'brute', 'stalker', 'splitter', 'bombardier', 'leech', 'priest', 'knight'];

export const DIFFICULTIES = {
  normal: {
    name: 'Normal', color: '#8fd8ff', desc: 'The intended experience. Learn the patterns, build smart.',
    enemyHp: 1, enemyDmg: 1, enemySpeed: 1, attackCd: 1, telegraph: 1, eliteChance: 0.05, extraMods: 0,
    healDrop: 1, waveHeal: 0.08, spawnRate: 1, shardMult: 1, bossHp: 1, bossExtra: false, modCount: 1,
  },
  hard: {
    name: 'Hard', color: '#ffb547', desc: 'Faster attacks, more elites, fewer heals.',
    enemyHp: 1.12, enemyDmg: 1.2, enemySpeed: 1.07, attackCd: 0.8, telegraph: 0.9, eliteChance: 0.11, extraMods: 0,
    healDrop: 0.6, waveHeal: 0.04, spawnRate: 1.12, shardMult: 1.4, bossHp: 1.15, bossExtra: false, modCount: 1,
  },
  nightmare: {
    name: 'Nightmare', color: '#ff4d6d', desc: 'For masters. Ordinary enemies gain modifiers; bosses learn new tricks.',
    enemyHp: 1.25, enemyDmg: 1.45, enemySpeed: 1.13, attackCd: 0.68, telegraph: 0.8, eliteChance: 0.16, extraMods: 0.12,
    healDrop: 0.4, waveHeal: 0, spawnRate: 1.22, shardMult: 2, bossHp: 1.3, bossExtra: true, modCount: 2,
  },
};

export function waveScaling(wave) {
  // Health grows slowly; later difficulty comes from compositions, modifiers and events instead.
  const w = Math.min(wave, 14) - 1;
  const extra = Math.max(0, wave - 14);
  return {
    hp: 1 + 0.15 * w + 0.01 * w * w + 0.08 * extra,
    damage: 1 + 0.06 * (wave - 1) * (wave > 14 ? 0.8 : 1),
    speed: 1 + Math.min(0.3, 0.02 * (wave - 1)),
  };
}

// Campaign: 10 waves. Wave 5 is a randomly chosen mid-boss, wave 10 the Rift Guardian.
export const WAVES = [
  { duration: 32, quota: 22, mix: { crawler: 0.85, dasher: 0.15 } },
  { duration: 36, quota: 32, mix: { crawler: 0.55, dasher: 0.25, splitter: 0.2 } },
  { duration: 42, quota: 42, mix: { crawler: 0.35, dasher: 0.18, splitter: 0.15, stalker: 0.17, spitter: 0.15 }, elites: [{ type: 'splitter', at: 0.5 }] },
  { duration: 45, quota: 50, mix: { crawler: 0.28, spitter: 0.17, stalker: 0.15, bombardier: 0.15, leech: 0.12, dasher: 0.13 }, elites: [{ type: 'stalker', at: 0.45 }] },
  { boss: 'mid' },
  { duration: 50, quota: 58, mix: { crawler: 0.25, dasher: 0.12, spitter: 0.12, brute: 0.1, knight: 0.1, priest: 0.07, bombardier: 0.12, leech: 0.12 }, elites: [{ type: 'brute', at: 0.35, miniboss: true, name: 'Brute Warlord' }] },
  { duration: 52, quota: 64, mix: { crawler: 0.22, dasher: 0.1, stalker: 0.12, splitter: 0.1, knight: 0.12, priest: 0.08, bombardier: 0.12, leech: 0.14 }, elites: [{ type: 'knight', at: 0.3 }, { type: 'bombardier', at: 0.7 }] },
  { duration: 55, quota: 70, mix: { crawler: 0.24, spitter: 0.12, brute: 0.12, stalker: 0.12, priest: 0.1, knight: 0.1, leech: 0.1, splitter: 0.1 }, elites: [{ type: 'spitter', at: 0.3, miniboss: true, name: 'Plague Matriarch' }, { type: 'leech', at: 0.75 }] },
  { duration: 58, quota: 78, mix: { crawler: 0.2, dasher: 0.1, stalker: 0.12, brute: 0.1, knight: 0.12, priest: 0.1, bombardier: 0.13, leech: 0.13 }, elites: [{ type: 'priest', at: 0.25 }, { type: 'knight', at: 0.5 }, { type: 'brute', at: 0.8 }] },
  { boss: 'guardian' },
];

// Which enemies endless mode may use from a given wave onward.
const ENDLESS_POOL = [
  ['crawler', 1], ['dasher', 1], ['splitter', 2], ['stalker', 3], ['spitter', 3], ['bombardier', 4],
  ['leech', 4], ['brute', 5], ['priest', 6], ['knight', 6],
];

function seeded(n) {
  let a = n * 2654435761 >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Endless waves: a new enemy combination every 3 waves, an elite/miniboss every 5, a boss every 10.
export function endlessWave(n) {
  if (n % 10 === 0) return { boss: 'random', tier: n / 10 };
  const pool = ENDLESS_POOL.filter(([, w]) => n >= w).map(([t]) => t);
  const rnd = seeded(Math.floor(n / 3) + 17);
  const picks = new Set(['crawler']);
  const want = Math.min(pool.length, 3 + Math.floor(rnd() * 3));
  while (picks.size < want) picks.add(pool[Math.floor(rnd() * pool.length)]);
  const mix = {};
  let total = 0;
  for (const t of picks) { const w = t === 'crawler' ? 1.6 : 0.6 + rnd(); mix[t] = w; total += w; }
  for (const t in mix) mix[t] /= total;
  const elites = [];
  if (n % 5 === 0) {
    const types = ['brute', 'spitter', 'knight', 'priest'].filter((t) => pool.includes(t));
    const t = types[Math.floor(rnd() * types.length)] || 'brute';
    elites.push({ type: t, at: 0.35, miniboss: true, name: { brute: 'Brute Warlord', spitter: 'Plague Matriarch', knight: 'Mirror Paragon', priest: 'Void Hierophant' }[t] });
  }
  for (let i = 0; i < Math.min(4, Math.floor(n / 4)); i++) elites.push({ type: [...picks][i % picks.size], at: 0.2 + i * 0.18 });
  return { duration: Math.min(60, 32 + n * 1.6), quota: Math.min(140, Math.round(24 + n * 6.5)), mix, elites, endless: true };
}

export const WAVE_BREAK = 6;

export const BOSSES = {
  guardian: { name: 'The Rift Guardian', hp: 13000, radius: 2.6, contactDamage: 20, speed: 3.4, shotDamage: 13, slamDamage: 24, chargeDamage: 28 },
  devourer: { name: 'The Devourer', hp: 3600, radius: 2.0, contactDamage: 22, speed: 3.8, chargeDamage: 30, acidDps: 14 },
  engineer: { name: 'The Rift Engineer', hp: 3000, radius: 1.4, contactDamage: 14, speed: 3.6, shotDamage: 11 },
};
// Kept for older imports
export const BOSS = BOSSES.guardian;

// XP needed to go from `level` to level+1.
export function xpForLevel(level) {
  const l = level - 1;
  return Math.round(10 + 7 * l + 0.15 * l * l);
}

export const RARITY = {
  common:    { label: 'Common',    weight: 62, color: '#9fb4d8' },
  rare:      { label: 'Rare',      weight: 29, color: '#5fb8ff' },
  legendary: { label: 'Legendary', weight: 9,  color: '#ffb547' },
};

export const ELITE_MODS = {
  swift:     { name: 'Swift',     icon: '»',  color: '#ffe94a', desc: 'Moves much faster but has less health.' },
  armored:   { name: 'Armored',   icon: '🛡', color: '#b8c4d6', desc: 'Armor absorbs most damage until it breaks.' },
  explosive: { name: 'Explosive', icon: '💥', color: '#ff8a2a', desc: 'Explodes in a marked circle when killed.' },
  vampiric:  { name: 'Vampiric',  icon: '🩸', color: '#ff3355', desc: 'Heals when it damages you.' },
  summoner:  { name: 'Summoner',  icon: '👁', color: '#7dff8a', desc: 'Periodically summons weak minions.' },
  volatile:  { name: 'Volatile',  icon: '☢', color: '#ff5ff0', desc: 'Alternates between vulnerable and powered-up states.' },
};
