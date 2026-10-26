// The permanent skill tree: four branches, each node needs the previous node in its branch.
import type { StatMod } from './types';

export type Branch = 'offense' | 'survival' | 'utility' | 'luck';

export interface PermanentUpgradeDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  branch: Branch;
  requires?: string;         // previous node (needs rank >= 1)
  maxRank: number;
  baseCost: number;
  costGrowth: number;
  /** Stat mod for the given rank (multiplier keys as factors). */
  effect: (rank: number) => StatMod;
  effectText: (rank: number) => string;
}

export const BRANCHES: { id: Branch; name: string; icon: string; color: string }[] = [
  { id: 'offense', name: 'Offense', icon: '⚔️', color: '#ff6b6b' },
  { id: 'survival', name: 'Survival', icon: '🛡️', color: '#52b788' },
  { id: 'utility', name: 'Utility', icon: '🧰', color: '#4cc9f0' },
  { id: 'luck', name: 'Luck', icon: '🍀', color: '#ffd60a' },
];

const pct = (n: number) => `${Math.round(n * 100)}%`;

export const PERMANENT_UPGRADES: PermanentUpgradeDef[] = [
  // offense
  { id: 'damage', branch: 'offense', name: 'Bonk Training', icon: '💪', description: 'Increases all damage.', maxRank: 5, baseCost: 60, costGrowth: 1.7,
    effect: (r) => ({ damageMult: 1 + 0.05 * r }), effectText: (r) => `+${pct(0.05 * r)} damage` },
  { id: 'crit', branch: 'offense', requires: 'damage', name: 'Keen Eye', icon: '🎯', description: 'Increases critical hit chance.', maxRank: 5, baseCost: 60, costGrowth: 1.6,
    effect: (r) => ({ critChance: 0.02 * r }), effectText: (r) => `+${pct(0.02 * r)} crit chance` },
  { id: 'attackSpeed', branch: 'offense', requires: 'crit', name: 'Quick Draw', icon: '⏱️', description: 'Reduces weapon cooldowns.', maxRank: 4, baseCost: 90, costGrowth: 1.7,
    effect: (r) => ({ cooldownMult: 1 - 0.03 * r }), effectText: (r) => `-${pct(0.03 * r)} cooldowns` },
  { id: 'critDamage', branch: 'offense', requires: 'attackSpeed', name: 'Brutality', icon: '🩸', description: 'Critical hits deal more damage.', maxRank: 3, baseCost: 120, costGrowth: 1.8,
    effect: (r) => ({ critDamage: 0.15 * r }), effectText: (r) => `+${pct(0.15 * r)} crit damage` },
  { id: 'projectile', branch: 'offense', requires: 'critDamage', name: 'Extra Ammo', icon: '🎇', description: 'One extra projectile for projectile weapons.', maxRank: 1, baseCost: 900, costGrowth: 1,
    effect: (r) => ({ extraProjectiles: r }), effectText: (r) => `+${r} projectile` },
  // survival
  { id: 'maxHp', branch: 'survival', name: 'Thick Skin', icon: '❤️', description: 'Increases maximum health.', maxRank: 5, baseCost: 40, costGrowth: 1.6,
    effect: (r) => ({ maxHp: 10 * r }), effectText: (r) => `+${10 * r} max HP` },
  { id: 'armor', branch: 'survival', requires: 'maxHp', name: 'Padded Vest', icon: '🦺', description: 'Increases armor.', maxRank: 5, baseCost: 55, costGrowth: 1.6,
    effect: (r) => ({ armor: 1 * r }), effectText: (r) => `+${r} armor` },
  { id: 'regen', branch: 'survival', requires: 'armor', name: 'Herbal Tea', icon: '🍵', description: 'Slowly regenerate health.', maxRank: 3, baseCost: 90, costGrowth: 1.8,
    effect: (r) => ({ regen: 0.15 * r }), effectText: (r) => `+${(0.15 * r).toFixed(2)} HP/s` },
  { id: 'dodge', branch: 'survival', requires: 'regen', name: 'Footwork', icon: '💨', description: 'Dodge recharges faster.', maxRank: 3, baseCost: 100, costGrowth: 1.7,
    effect: (r) => ({ dodgeCooldown: 1 - 0.1 * r }), effectText: (r) => `-${pct(0.1 * r)} dodge cooldown` },
  { id: 'revive', branch: 'survival', requires: 'dodge', name: 'Second Life', icon: '👼', description: 'Once per run, survive a fatal blow with 40% HP.', maxRank: 1, baseCost: 1000, costGrowth: 1,
    effect: () => ({}), effectText: () => '1 revive per run' },
  // utility
  { id: 'xp', branch: 'utility', name: 'Fast Learner', icon: '📘', description: 'Increases experience gained.', maxRank: 5, baseCost: 50, costGrowth: 1.6,
    effect: (r) => ({ xpGain: 1 + 0.05 * r }), effectText: (r) => `+${pct(0.05 * r)} XP` },
  { id: 'pickup', branch: 'utility', requires: 'xp', name: 'Sticky Fingers', icon: '🧲', description: 'Increases pickup radius.', maxRank: 4, baseCost: 35, costGrowth: 1.6,
    effect: (r) => ({ pickupRadius: 1 + 0.1 * r }), effectText: (r) => `+${pct(0.1 * r)} pickup radius` },
  { id: 'moveSpeed', branch: 'utility', requires: 'pickup', name: 'Light Feet', icon: '👟', description: 'Increases movement speed.', maxRank: 5, baseCost: 50, costGrowth: 1.6,
    effect: (r) => ({ moveSpeed: 1 + 0.03 * r }), effectText: (r) => `+${pct(0.03 * r)} move speed` },
  { id: 'startGold', branch: 'utility', requires: 'pickup', name: 'Piggy Bank', icon: '🐷', description: 'Start each run with gold for chests.', maxRank: 5, baseCost: 30, costGrowth: 1.5,
    effect: () => ({}), effectText: (r) => `Start with ${15 * r} gold` },
  { id: 'reroll', branch: 'utility', requires: 'moveSpeed', name: 'Second Opinion', icon: '🎲', description: 'Extra level-up rerolls per run.', maxRank: 3, baseCost: 80, costGrowth: 2,
    effect: () => ({}), effectText: (r) => `+${r} rerolls` },
  { id: 'banish', branch: 'utility', requires: 'reroll', name: 'Not Today', icon: '🚫', description: 'Extra banishes per run.', maxRank: 3, baseCost: 90, costGrowth: 1.8,
    effect: () => ({}), effectText: (r) => `+${r} banishes` },
  // luck
  { id: 'luck', branch: 'luck', name: 'Four-Leaf Clover', icon: '🍀', description: 'Increases luck.', maxRank: 5, baseCost: 45, costGrowth: 1.6,
    effect: (r) => ({ luck: 5 * r }), effectText: (r) => `+${5 * r} luck` },
  { id: 'rarity', branch: 'luck', requires: 'luck', name: 'Rare Finds', icon: '💎', description: 'Rare, epic and legendary upgrades appear more often.', maxRank: 3, baseCost: 110, costGrowth: 1.7,
    effect: () => ({}), effectText: (r) => `+${r * 4}% higher rarity rolls` },
  { id: 'eliteDrops', branch: 'luck', requires: 'rarity', name: 'Bounty Hunter', icon: '🏴', description: 'Elites more often drop golden chests.', maxRank: 3, baseCost: 100, costGrowth: 1.7,
    effect: () => ({}), effectText: (r) => `+${r * 10}% elite chest chance` },
  { id: 'evolution', branch: 'luck', requires: 'eliteDrops', name: 'Natural Selection', icon: '🧬', description: 'Evolutions need one fewer item level, and chests favour evolutions.', maxRank: 1, baseCost: 800, costGrowth: 1,
    effect: () => ({}), effectText: () => 'Evolution item requirement -1' },
];

export function upgradeCost(def: PermanentUpgradeDef, rank: number): number {
  return Math.round(def.baseCost * Math.pow(def.costGrowth, rank));
}
