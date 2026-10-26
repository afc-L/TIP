// Stat training cards and run-changing special upgrades offered on level-up.
import type { Rarity, StatMod } from './types';

export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
/** Strength multiplier per rarity for stat cards. */
export const RARITY_POWER: Record<string, number> = { common: 1, uncommon: 1.5, rare: 2.2, epic: 3.2, legendary: 4.5 };

export interface StatCardDef { id: string; name: string; icon: string; base: StatMod; text: (k: number) => string; color: string }

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Additive increments (multiplier keys as fractions), scaled by rarity power. */
export const STAT_CARDS: StatCardDef[] = [
  { id: 'dmg', name: 'SHARPEN', icon: '🗡️', color: '#ff6b6b', base: { damageMult: 0.05 }, text: (k) => `+${pct(0.05 * k)} damage` },
  { id: 'cd', name: 'QUICK HANDS', icon: '⏱️', color: '#90e0ef', base: { cooldownMult: -0.04 }, text: (k) => `-${pct(0.04 * k)} cooldowns` },
  { id: 'hp', name: 'HEARTY', icon: '💗', color: '#e63946', base: { maxHp: 10 }, text: (k) => `+${Math.round(10 * k)} max HP` },
  { id: 'spd', name: 'NIMBLE', icon: '🦶', color: '#4cc9f0', base: { moveSpeed: 0.04 }, text: (k) => `+${pct(0.04 * k)} move speed` },
  { id: 'crit', name: 'PRECISION', icon: '🎯', color: '#ff9e00', base: { critChance: 0.025 }, text: (k) => `+${pct(0.025 * k)} crit chance` },
  { id: 'area', name: 'BIG SWINGS', icon: '📐', color: '#f4a261', base: { areaMult: 0.05 }, text: (k) => `+${pct(0.05 * k)} area` },
  { id: 'armor', name: 'TOUGH SKIN', icon: '🪖', color: '#8d99ae', base: { armor: 1.2 }, text: (k) => `+${(1.2 * k).toFixed(1)} armor` },
  { id: 'regen', name: 'SECOND WIND', icon: '🍃', color: '#70e000', base: { regen: 0.15 }, text: (k) => `+${(0.15 * k).toFixed(2)} HP/s` },
  { id: 'luck', name: 'FOUR LEAVES', icon: '🍀', color: '#ffd60a', base: { luck: 4 }, text: (k) => `+${Math.round(4 * k)} luck` },
  { id: 'xp', name: 'STUDIOUS', icon: '📚', color: '#48cae4', base: { xpGain: 0.05 }, text: (k) => `+${pct(0.05 * k)} XP` },
];

export type SpecialId = 'onePunch' | 'unstableCore' | 'lastStand' | 'treasureInstinct' | 'overcharged' | 'vampireTouch' | 'chainReaction' | 'giantSlayer';

export interface SpecialDef { id: SpecialId; name: string; icon: string; description: string; stats?: StatMod }

export const SPECIALS: SpecialDef[] = [
  { id: 'onePunch', name: 'ONE-PUNCH MODE', icon: '👊', description: '+80% damage and +60% knockback, but weapons attack 35% slower.', stats: { damageMult: 1.8, cooldownMult: 1.35, knockbackMult: 1.6 } },
  { id: 'unstableCore', name: 'UNSTABLE CORE', icon: '☢️', description: '8% of hits trigger a bonus explosion.' },
  { id: 'lastStand', name: 'LAST STAND', icon: '🩸', description: 'Gain up to +60% damage as your health drops.' },
  { id: 'treasureInstinct', name: 'TREASURE INSTINCT', icon: '🗝️', description: 'Elites drop extra loot, power-ups are twice as common, +20 luck.', stats: { luck: 20 } },
  { id: 'overcharged', name: 'OVERCHARGED', icon: '🔋', description: 'Super Bonk charges twice as fast, but weapons slow down 30% for 6s after using it.' },
  { id: 'vampireTouch', name: 'VAMPIRE TOUCH', icon: '🧛', description: 'Critical hits heal 0.4 HP (up to 4 HP per second).' },
  { id: 'chainReaction', name: 'CHAIN REACTION', icon: '💥', description: 'Enemies killed by explosions have a 30% chance to explode too.' },
  { id: 'giantSlayer', name: 'GIANT SLAYER', icon: '🏹', description: '+50% damage to elites, mini-bosses and bosses.' },
];

export const SPECIAL_MAP = Object.fromEntries(SPECIALS.map((s) => [s.id, s])) as Record<SpecialId, SpecialDef>;
