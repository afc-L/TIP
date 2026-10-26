import type { StatMod } from './types';

export interface PermanentUpgradeDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  maxRank: number;
  baseCost: number;
  costGrowth: number;
  /** Stat mod for the given rank (multiplier keys as factors). */
  effect: (rank: number) => StatMod;
  effectText: (rank: number) => string;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

export const PERMANENT_UPGRADES: PermanentUpgradeDef[] = [
  { id: 'maxHp', name: 'Thick Skin', icon: '❤️', description: 'Increases maximum health.', maxRank: 5, baseCost: 40, costGrowth: 1.6,
    effect: (r) => ({ maxHp: 10 * r }), effectText: (r) => `+${10 * r} max HP` },
  { id: 'moveSpeed', name: 'Light Feet', icon: '👟', description: 'Increases movement speed.', maxRank: 5, baseCost: 50, costGrowth: 1.6,
    effect: (r) => ({ moveSpeed: 1 + 0.03 * r }), effectText: (r) => `+${pct(0.03 * r)} move speed` },
  { id: 'damage', name: 'Bonk Training', icon: '💪', description: 'Increases starting damage.', maxRank: 5, baseCost: 60, costGrowth: 1.7,
    effect: (r) => ({ damageMult: 1 + 0.05 * r }), effectText: (r) => `+${pct(0.05 * r)} damage` },
  { id: 'xp', name: 'Fast Learner', icon: '📘', description: 'Increases experience gained.', maxRank: 5, baseCost: 50, costGrowth: 1.6,
    effect: (r) => ({ xpGain: 1 + 0.05 * r }), effectText: (r) => `+${pct(0.05 * r)} XP` },
  { id: 'pickup', name: 'Sticky Fingers', icon: '🧲', description: 'Increases pickup radius.', maxRank: 4, baseCost: 35, costGrowth: 1.6,
    effect: (r) => ({ pickupRadius: 1 + 0.1 * r }), effectText: (r) => `+${pct(0.1 * r)} pickup radius` },
  { id: 'startGold', name: 'Piggy Bank', icon: '🐷', description: 'Start each run with gold for chests.', maxRank: 5, baseCost: 30, costGrowth: 1.5,
    effect: () => ({}), effectText: (r) => `Start with ${15 * r} gold` },
  { id: 'reroll', name: 'Second Opinion', icon: '🎲', description: 'Extra level-up rerolls per run.', maxRank: 3, baseCost: 80, costGrowth: 2,
    effect: () => ({}), effectText: (r) => `+${r} rerolls` },
  { id: 'crit', name: 'Keen Eye', icon: '🎯', description: 'Increases critical hit chance.', maxRank: 5, baseCost: 60, costGrowth: 1.6,
    effect: (r) => ({ critChance: 0.02 * r }), effectText: (r) => `+${pct(0.02 * r)} crit chance` },
  { id: 'armor', name: 'Padded Vest', icon: '🦺', description: 'Increases armor.', maxRank: 5, baseCost: 55, costGrowth: 1.6,
    effect: (r) => ({ armor: 1 * r }), effectText: (r) => `+${r} armor` },
  { id: 'regen', name: 'Herbal Tea', icon: '🍵', description: 'Slowly regenerate health.', maxRank: 3, baseCost: 90, costGrowth: 1.8,
    effect: (r) => ({ regen: 0.15 * r }), effectText: (r) => `+${(0.15 * r).toFixed(2)} HP/s` },
  { id: 'luck', name: 'Four-Leaf Clover', icon: '🍀', description: 'Increases luck.', maxRank: 5, baseCost: 45, costGrowth: 1.6,
    effect: (r) => ({ luck: 5 * r }), effectText: (r) => `+${5 * r} luck` },
];

export function upgradeCost(def: PermanentUpgradeDef, rank: number): number {
  return Math.round(def.baseCost * Math.pow(def.costGrowth, rank));
}
