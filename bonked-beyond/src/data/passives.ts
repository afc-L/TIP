import type { PassiveDef, PassiveId } from './types';

const pct = (n: number) => `${Math.round(n * 100)}%`;

export const PASSIVE_MAX_LEVEL = 5;

export const PASSIVES: PassiveDef[] = [
  { id: 'powerCore', name: 'POWER CORE', icon: '🔋', color: '#ff6b6b', maxLevel: 5,
    description: 'Increases all weapon damage.', perLevel: { damageMult: 0.1 },
    levelText: (l) => `+${pct(0.1 * l)} damage` },
  { id: 'runningShoes', name: 'RUNNING SHOES', icon: '👟', color: '#4cc9f0', maxLevel: 5,
    description: 'Increases movement speed.', perLevel: { moveSpeed: 0.08 },
    levelText: (l) => `+${pct(0.08 * l)} move speed` },
  { id: 'ironHeart', name: 'IRON HEART', icon: '❤️', color: '#e63946', maxLevel: 5,
    description: 'Increases maximum health.', perLevel: { maxHp: 20 },
    levelText: (l) => `+${20 * l} max HP` },
  { id: 'magnet', name: 'MAGNET', icon: '🧲', color: '#f72585', maxLevel: 5,
    description: 'Increases pickup radius.', perLevel: { pickupRadius: 0.3 },
    levelText: (l) => `+${pct(0.3 * l)} pickup radius` },
  { id: 'luckyCoin', name: 'LUCKY COIN', icon: '🪙', color: '#ffd60a', maxLevel: 5,
    description: 'Better upgrade rarity, more drops, more gold.', perLevel: { luck: 10, goldGain: 0.1 },
    levelText: (l) => `+${10 * l} luck, +${pct(0.1 * l)} gold` },
  { id: 'critLens', name: 'CRITICAL LENS', icon: '🎯', color: '#ff9e00', maxLevel: 5,
    description: 'Increases critical hit chance and damage.', perLevel: { critChance: 0.05, critDamage: 0.1 },
    levelText: (l) => `+${pct(0.05 * l)} crit chance, +${pct(0.1 * l)} crit damage` },
  { id: 'coolingFan', name: 'COOLING FAN', icon: '🌬️', color: '#90e0ef', maxLevel: 5,
    description: 'Reduces weapon cooldowns.', perLevel: { cooldownMult: -0.07 },
    levelText: (l) => `-${pct(0.07 * l)} cooldowns` },
  { id: 'thorns', name: 'THORNS', icon: '🌵', color: '#52b788', maxLevel: 5,
    description: 'Reflects damage back at attackers.', perLevel: { thorns: 0.25 },
    levelText: (l) => `Reflect ${pct(0.25 * l)} of damage taken (+${4 * l} flat)` },
  { id: 'regenSeed', name: 'REGENERATION SEED', icon: '🌱', color: '#70e000', maxLevel: 5,
    description: 'Slowly restores health.', perLevel: { regen: 0.4 },
    levelText: (l) => `+${(0.4 * l).toFixed(1)} HP per second` },
  { id: 'xpCrystal', name: 'XP CRYSTAL', icon: '💎', color: '#48cae4', maxLevel: 5,
    description: 'Increases experience gained.', perLevel: { xpGain: 0.1 },
    levelText: (l) => `+${pct(0.1 * l)} XP` },
  { id: 'arcaneFocus', name: 'ARCANE FOCUS', icon: '📿', color: '#9d4edd', maxLevel: 5,
    description: 'Longer effects and faster projectiles. Extra projectiles at levels 3 and 5.',
    perLevel: { durationMult: 0.1, projectileSpeedMult: 0.08 },
    levelText: (l) => `+${pct(0.1 * l)} duration, +${pct(0.08 * l)} projectile speed${l >= 5 ? ', +2 projectiles' : l >= 3 ? ', +1 projectile' : ''}` },
  { id: 'longArm', name: 'LONG ARM', icon: '📏', color: '#f4a261', maxLevel: 5,
    description: 'Increases weapon area and range.', perLevel: { areaMult: 0.1 },
    levelText: (l) => `+${pct(0.1 * l)} area` },
  { id: 'blastPowder', name: 'BLAST POWDER', icon: '🧨', color: '#e76f51', maxLevel: 5,
    description: 'Explosions, quakes and clouds hit harder.', perLevel: { explosiveMult: 0.15 },
    levelText: (l) => `+${pct(0.15 * l)} explosive damage` },
  { id: 'ironShell', name: 'IRON SHELL', icon: '🐢', color: '#6c757d', maxLevel: 5,
    description: 'Adds armor, reducing damage taken.', perLevel: { armor: 2.5, knockbackResist: 0.05 },
    levelText: (l) => `+${(2.5 * l).toFixed(1)} armor` },
];

export const PASSIVE_MAP = Object.fromEntries(PASSIVES.map((p) => [p.id, p])) as Record<PassiveId, PassiveDef>;
