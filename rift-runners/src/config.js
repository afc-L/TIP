// Central tuning tables. Most balance changes only need edits here.

export const ARENA_RADIUS = 38;
export const MAX_ALIVE = 95;          // hard cap on simultaneously active enemies
export const MAX_PLAYER_PROJECTILES = 260;
export const MAX_ENEMY_PROJECTILES = 260;

export const PLAYER_BASE = {
  maxHp: 100,
  speed: 8.6,
  radius: 0.55,
  dashCooldown: 1.5,
  dashDuration: 0.17,
  dashSpeed: 34,
  pulseCooldown: 10,
  pickupRadius: 3.2,
  invulnTime: 0.7,
  critChance: 0.05,
  critMult: 2,
};

export const WEAPONS = {
  bolt: { name: 'Rift Bolt', icon: '✦', damage: 10, cooldown: 0.3, speed: 30, life: 0.85, radius: 0.35 },
  arc:  { name: 'Arc Burst', icon: 'ϟ', damage: 15, cooldown: 1.35, radius: 4.6 },
  orb:  { name: 'Void Orb',  icon: '◉', damage: 42, cooldown: 1.9, speed: 12.5, life: 2.4, radius: 0.85 },
};

// Enemy archetypes. hp/damage are scaled per wave by waveScaling().
export const ENEMY_TYPES = {
  crawler: { name: 'Crawler', hp: 16, speed: 4.3, radius: 0.62, damage: 8, xp: 1, shards: 0.2 },
  dasher:  { name: 'Dasher',  hp: 14, speed: 3.7, radius: 0.58, damage: 12, xp: 2, shards: 0.25, chargeSpeed: 23, chargeRange: 11 },
  spitter: { name: 'Spitter', hp: 24, speed: 3.0, radius: 0.7, damage: 6, xp: 2, shards: 0.25, shotDamage: 9, shotSpeed: 11, fireCd: 2.6 },
  brute:   { name: 'Brute',   hp: 120, speed: 2.1, radius: 1.3, damage: 18, xp: 7, shards: 0.8, slamDamage: 24, slamRadius: 3.8 },
};

export function waveScaling(wave) {
  const w = wave - 1;
  return {
    hp: 1 + 0.2 * w + 0.016 * w * w,
    damage: 1 + 0.075 * w,
    speed: 1 + 0.025 * w,
  };
}

// 10 wave run. Wave 10 is the Rift Guardian.
export const WAVES = [
  { duration: 34, quota: 26, mix: { crawler: 1 } },
  { duration: 38, quota: 38, mix: { crawler: 0.72, dasher: 0.28 } },
  { duration: 42, quota: 48, mix: { crawler: 0.6, dasher: 0.4 }, elites: [{ type: 'crawler', at: 0.45 }] },
  { duration: 45, quota: 56, mix: { crawler: 0.5, dasher: 0.25, spitter: 0.25 } },
  { duration: 48, quota: 64, mix: { crawler: 0.45, dasher: 0.22, spitter: 0.2, brute: 0.13 }, elites: [{ type: 'dasher', at: 0.5 }] },
  { duration: 50, quota: 70, mix: { crawler: 0.42, dasher: 0.22, spitter: 0.22, brute: 0.14 }, elites: [{ type: 'brute', at: 0.35, miniboss: true, name: 'Brute Warlord' }] },
  { duration: 52, quota: 82, mix: { crawler: 0.36, dasher: 0.26, spitter: 0.24, brute: 0.14 }, elites: [{ type: 'spitter', at: 0.4 }, { type: 'dasher', at: 0.7 }] },
  { duration: 55, quota: 92, mix: { crawler: 0.4, dasher: 0.2, spitter: 0.22, brute: 0.18 }, elites: [{ type: 'spitter', at: 0.3, miniboss: true, name: 'Plague Matriarch' }, { type: 'brute', at: 0.75 }] },
  { duration: 58, quota: 108, mix: { crawler: 0.38, dasher: 0.24, spitter: 0.2, brute: 0.18 }, elites: [{ type: 'dasher', at: 0.25 }, { type: 'crawler', at: 0.5 }, { type: 'brute', at: 0.8 }] },
  { boss: true },
];

export const WAVE_BREAK = 5;

export const BOSS = {
  name: 'The Rift Guardian',
  hp: 12000,
  radius: 2.6,
  contactDamage: 20,
  speed: 3.4,
  shotDamage: 13,
  slamDamage: 24,
  chargeDamage: 28,
};

// XP needed to go from `level` to level+1.
export function xpForLevel(level) {
  return 6 + 3 * (level - 1);
}

export const RARITY = {
  common:    { label: 'Common',    weight: 62, color: '#9fb4d8' },
  rare:      { label: 'Rare',      weight: 29, color: '#5fb8ff' },
  legendary: { label: 'Legendary', weight: 9,  color: '#ffb547' },
};
