import type { BossId, EnemyKind } from './types';

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  description: string;
  hp: number;
  speed: number;
  damage: number;
  attackCooldown: number;
  radius: number;
  xp: number;
  knockbackResist: number; // 0 = full knockback, 1 = immune
  goldChance: number;
  color: string;
  height: number;          // for damage numbers / hit effects
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  slime: {
    kind: 'slime', name: 'Bonk Slime', description: 'Jiggly, hungry and always in a crowd.',
    hp: 14, speed: 2.9, damage: 6, attackCooldown: 0.9, radius: 0.55, xp: 1,
    knockbackResist: 0, goldChance: 0.02, color: '#7bd84b', height: 0.9,
  },
  bigSlime: {
    kind: 'bigSlime', name: 'Mega Slime', description: 'A slime that ate its friends. Splits apart when popped.',
    hp: 60, speed: 2.4, damage: 12, attackCooldown: 1.0, radius: 1.0, xp: 4,
    knockbackResist: 0.4, goldChance: 0.1, color: '#3fb950', height: 1.6,
  },
  goblin: {
    kind: 'goblin', name: 'Stab Goblin', description: 'Fast flankers that try to cut off your escape.',
    hp: 12, speed: 5.0, damage: 7, attackCooldown: 0.8, radius: 0.5, xp: 1,
    knockbackResist: 0, goldChance: 0.03, color: '#d4c73b', height: 1.3,
  },
  brute: {
    kind: 'brute', name: 'Armored Brute', description: 'Slow, heavy and almost impossible to push around.',
    hp: 110, speed: 2.1, damage: 22, attackCooldown: 1.4, radius: 1.05, xp: 6,
    knockbackResist: 0.8, goldChance: 0.12, color: '#6d597a', height: 2.2,
  },
  shaman: {
    kind: 'shaman', name: 'Hex Shaman', description: 'Keeps its distance and lobs cursed bolts.',
    hp: 30, speed: 3.0, damage: 12, attackCooldown: 2.8, radius: 0.6, xp: 3,
    knockbackResist: 0.1, goldChance: 0.12, color: '#9b5de5', height: 1.7,
  },
  exploder: {
    kind: 'exploder', name: 'Boom Bug', description: 'Runs at you, swells up and detonates. Watch the red ring!',
    hp: 20, speed: 4.2, damage: 28, attackCooldown: 0, radius: 0.6, xp: 2,
    knockbackResist: 0.1, goldChance: 0.06, color: '#ef476f', height: 1.0,
  },
};

export const ENEMY_KINDS = Object.keys(ENEMIES) as EnemyKind[];

export interface BossDef {
  id: BossId;
  name: string;
  title: string;
  description: string;
  hp: number;
  speed: number;
  contactDamage: number;
  radius: number;
  color: string;
  attacks: string[];
  rewardGold: number;
}

export const BOSSES: Record<BossId, BossDef> = {
  stumpKing: {
    id: 'stumpKing', name: 'THE STUMP KING', title: 'Corrupted Lord of the Old Wood',
    description: 'A colossal rotten tree that rules the forest floor with roots and fury.',
    hp: 5200, speed: 2.6, contactDamage: 20, radius: 2.4, color: '#7f5539',
    attacks: ['Ground Slam', 'Root Eruption', 'Sapling Summon', 'Trunk Charge'],
    rewardGold: 120,
  },
  scrapGolem: {
    id: 'scrapGolem', name: 'THE SCRAP GOLEM', title: 'Walking Junkyard',
    description: 'A towering heap of gears and girders, held together by spite. Enrages when damaged.',
    hp: 16000, speed: 3.0, contactDamage: 28, radius: 2.7, color: '#8d99ae',
    attacks: ['Bolt Volley', 'Piston Charge', 'Oil Fire', 'Overdrive (below 40% HP)'],
    rewardGold: 250,
  },
};
