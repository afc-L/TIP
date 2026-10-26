// Central balancing constants. Tweak the run here rather than in individual systems.
import type { Difficulty, EnemyKind, RunMode } from '../data/types';

export const CONFIG = {
  player: {
    radius: 0.6,
    basePickupRadius: 3.2,
    hurtInvulnerability: 0.6,
    dodgeDuration: 0.28,
    dodgeSpeed: 19,
    dodgeCooldown: 1.6,
    dodgeInvulnerability: 0.38,
    sprintMult: 1.35,
    staminaMax: 3,
    staminaRegen: 0.8,
    superKills: 70,          // kills to fill the Super Bonk meter
    superRadius: 9,
    baseCritDamage: 1.75,
  },
  xp: {
    /** XP required to go from `level` to `level + 1`. */
    toNext: (level: number) => Math.floor(5 + (level - 1) * 9 + Math.pow(Math.max(0, level - 15), 1.6) * 6),
    gemCap: 450,
    gemMagnetSpeed: 22,
  },
  enemies: {
    spawnMinDist: 21,
    spawnMaxDist: 28,
    despawnDist: 46,
    contactPadding: 0.15,
    hpScale: (min: number) => 1 + 0.17 * min + 0.014 * min * min,
    damageScale: (min: number) => 1 + 0.075 * min,
    speedScale: (min: number) => Math.min(1.3, 1 + 0.018 * min),
    xpScale: (min: number) => 1 + 0.09 * min,
    eliteHp: 6,
    eliteDamage: 1.5,
    eliteScale: 1.4,
    exploderFuse: 0.85,
    exploderRadius: 3,
  },
  endlessBossInterval: 240,
  levelUp: { baseChoices: 3, baseRerolls: 2, skipGold: 5 },
  chest: { baseCost: 12, costGrowth: 8 },
  quality: {
    low: { pixelRatio: 0.75, shadows: false, maxEnemies: 170, particles: 500, grassMult: 0.3, propMult: 0.6 },
    medium: { pixelRatio: 1, shadows: false, maxEnemies: 260, particles: 1100, grassMult: 0.7, propMult: 0.85 },
    high: { pixelRatio: 1.5, shadows: true, maxEnemies: 340, particles: 1800, grassMult: 1, propMult: 1 },
  },
};

export const DIFFICULTY: Record<Difficulty, { label: string; hp: number; damage: number; spawn: number; reward: number }> = {
  easy: { label: 'Easy', hp: 0.75, damage: 0.6, spawn: 0.85, reward: 0.75 },
  normal: { label: 'Normal', hp: 1, damage: 1, spawn: 1, reward: 1 },
  hard: { label: 'Hard', hp: 1.3, damage: 1.4, spawn: 1.2, reward: 1.4 },
};

export const RUN_MODES: Record<RunMode, { label: string; description: string; timeline: number; reward: number }> = {
  standard: { label: 'Standard', description: 'Survive ~13 minutes and defeat both bosses to win.', timeline: 1, reward: 1 },
  practice: { label: 'Practice', description: 'A compressed ~7 minute run. Everything arrives twice as fast.', timeline: 2, reward: 0.6 },
  endless: { label: 'Endless', description: 'No victory. Bosses return stronger forever. How long can you last?', timeline: 1, reward: 1.1 },
};

export interface DirectorPhase {
  at: number;            // timeline seconds
  interval: number;      // seconds between spawn ticks
  group: [number, number];
  maxEnemies: number;
  eliteChance: number;
  weights: Partial<Record<EnemyKind, number>>;
  announce?: string;
}

export const DIRECTOR_PHASES: DirectorPhase[] = [
  { at: 0, interval: 1.2, group: [2, 3], maxEnemies: 40, eliteChance: 0, weights: { slime: 1 }, announce: 'Survive the horde!' },
  { at: 50, interval: 1.0, group: [3, 4], maxEnemies: 60, eliteChance: 0, weights: { slime: 1, goblin: 0.25, swarmBug: 0.2 } },
  { at: 120, interval: 0.9, group: [3, 5], maxEnemies: 90, eliteChance: 0.002, weights: { slime: 1, goblin: 0.8, bigSlime: 0.12, swarmBug: 0.25, phantom: 0.15 }, announce: 'The goblins are coming!' },
  { at: 180, interval: 0.85, group: [4, 6], maxEnemies: 120, eliteChance: 0.003, weights: { slime: 0.8, goblin: 0.7, exploder: 0.35, bigSlime: 0.2, archer: 0.2, burrower: 0.15, phantom: 0.15 }, announce: 'Boom Bugs and archers — watch the red rings!' },
  { at: 240, interval: 0.8, group: [4, 6], maxEnemies: 150, eliteChance: 0.004, weights: { slime: 0.6, goblin: 0.6, exploder: 0.3, shaman: 0.35, bigSlime: 0.25, healer: 0.12, stalker: 0.2, bombardier: 0.15, archer: 0.2 }, announce: 'Casters and stalkers appear. Kill the healers first!' },
  { at: 300, interval: 0.75, group: [5, 7], maxEnemies: 180, eliteChance: 0.005, weights: { slime: 0.5, goblin: 0.6, exploder: 0.35, shaman: 0.35, brute: 0.3, bigSlime: 0.3, shieldKnight: 0.25, healer: 0.12, stalker: 0.2, burrower: 0.2 }, announce: 'Brutes and Shield Knights join the fight!' },
  { at: 390, interval: 1.1, group: [3, 5], maxEnemies: 120, eliteChance: 0.0025, weights: { slime: 1, goblin: 0.6, swarmBug: 0.4 } },
  { at: 480, interval: 0.7, group: [5, 8], maxEnemies: 220, eliteChance: 0.008, weights: { slime: 0.4, goblin: 0.6, exploder: 0.45, shaman: 0.4, brute: 0.4, bigSlime: 0.4, beetle: 0.2, archer: 0.3, bombardier: 0.25, phantom: 0.25, healer: 0.15, shieldKnight: 0.3 }, announce: 'Giant Beetles! Sidestep their charges.' },
  { at: 600, interval: 0.6, group: [6, 9], maxEnemies: 260, eliteChance: 0.01, weights: { goblin: 0.7, exploder: 0.5, shaman: 0.5, brute: 0.5, bigSlime: 0.4, beetle: 0.3, archer: 0.35, bombardier: 0.3, stalker: 0.35, burrower: 0.3, healer: 0.2, shieldKnight: 0.4, swarmBug: 0.6 }, announce: 'The horde grows restless...' },
  { at: 720, interval: 0.55, group: [7, 10], maxEnemies: 300, eliteChance: 0.0125, weights: { goblin: 0.7, exploder: 0.6, shaman: 0.5, brute: 0.7, bigSlime: 0.5, beetle: 0.4, archer: 0.4, bombardier: 0.35, stalker: 0.4, phantom: 0.4, healer: 0.2, shieldKnight: 0.5 } },
  { at: 780, interval: 1.0, group: [4, 6], maxEnemies: 160, eliteChance: 0.005, weights: { goblin: 1, exploder: 0.5, brute: 0.3, swarmBug: 0.6 } },
  { at: 900, interval: 0.45, group: [8, 12], maxEnemies: 400, eliteChance: 0.0175, weights: { goblin: 0.7, exploder: 0.7, shaman: 0.6, brute: 0.9, bigSlime: 0.7, beetle: 0.5, archer: 0.5, bombardier: 0.4, stalker: 0.5, phantom: 0.5, healer: 0.25, shieldKnight: 0.6, burrower: 0.4 }, announce: 'ENDLESS ESCALATION' },
];

/** Scripted events (timeline seconds). */
export const DIRECTOR_EVENTS: { at: number; type: 'ring' | 'rush' | 'elites' | 'swarm' | 'ogre'; announce: string }[] = [
  { at: 100, type: 'swarm', announce: 'A swarm descends!' },
  { at: 150, type: 'ring', announce: 'SURROUNDED!' },
  { at: 210, type: 'rush', announce: 'Goblin stampede!' },
  { at: 270, type: 'ogre', announce: 'GRUNK THE OGRE wants a word!' },
  { at: 330, type: 'ring', announce: 'SURROUNDED!' },
  { at: 450, type: 'swarm', announce: 'A swarm descends!' },
  { at: 540, type: 'elites', announce: 'An elite squad approaches!' },
  { at: 580, type: 'ogre', announce: 'GRUNK IS BACK, AND ANGRIER!' },
  { at: 630, type: 'rush', announce: 'Goblin stampede!' },
  { at: 690, type: 'ring', announce: 'SURROUNDED!' },
  { at: 870, type: 'elites', announce: 'An elite squad approaches!' },
  { at: 960, type: 'ogre', announce: 'A pack of ogres!' },
];

/** A guaranteed elite (which drops a chest) arrives every this many timeline seconds after `start`. */
export const GUARANTEED_ELITE = { start: 120, every: 70 };
