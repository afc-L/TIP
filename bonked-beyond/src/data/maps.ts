import type { EnemyKind, MapId } from './types';

export interface MapPalette {
  sky: string;
  fog: string;
  ground: string;
  groundAlt: string;
  path: string;
  grass: string;
  foliage: string[];
  trunk: string;
  rock: string;
  ruin: string;
  accent: string;
  sun: string;
  ambient: string;
}

export interface MapDef {
  id: MapId;
  name: string;
  subtitle: string;
  description: string;
  modifiers: string[];
  palette: MapPalette;
  radius: number;
  seed: number;
  props: { trees: number; rocks: number; ruins: number; crystals: number; mesas: number; pillars: number; grass: number; flowers: number };
  enemyWeights: Partial<Record<EnemyKind, number>>; // multipliers on director weights
  spawnRateMult: number;
  enemyDamageMult: number;
  enemySpeedMult: number;
  eliteChanceMult: number;
  xpMult: number;
  goldMult: number;
  difficultyStars: number;
  unlock?: string; // achievement id
  music: number;   // music variant
}

export const MAPS: MapDef[] = [
  {
    id: 'forest', name: 'BONK FOREST', subtitle: 'Where it all begins',
    description: 'Sunlit glades, crumbling ruins and far too many slimes.',
    modifiers: ['Balanced difficulty', 'Ruins provide cover'],
    palette: {
      sky: '#8ecae6', fog: '#b7e4c7', ground: '#5a9e4b', groundAlt: '#6fb35a', path: '#c2a878',
      grass: '#7cc95e', foliage: ['#2d6a4f', '#40916c', '#52b788', '#74c69d'], trunk: '#7f5539',
      rock: '#8d99ae', ruin: '#b0a99f', accent: '#ffd166', sun: '#fff1d0', ambient: '#a8c5ff',
    },
    radius: 62, seed: 1337,
    props: { trees: 150, rocks: 70, ruins: 10, crystals: 0, mesas: 0, pillars: 14, grass: 1, flowers: 1 },
    enemyWeights: {}, spawnRateMult: 1, enemyDamageMult: 1, enemySpeedMult: 1, eliteChanceMult: 1,
    xpMult: 1, goldMult: 1, difficultyStars: 1, music: 0,
  },
  {
    id: 'canyon', name: 'CRYSTAL CANYON', subtitle: 'Shiny. Dangerous.',
    description: 'Sun-baked mesas studded with humming crystals. The horde moves faster here.',
    modifiers: ['Enemies +12% speed', 'More Shamans and Boom Bugs', '+15% XP from crystals'],
    palette: {
      sky: '#f6bd60', fog: '#f7d1a6', ground: '#c8794a', groundAlt: '#d98c5f', path: '#e9c39b',
      grass: '#d4a373', foliage: ['#bc6c25', '#dda15e'], trunk: '#6f4518',
      rock: '#a0522d', ruin: '#c08552', accent: '#ff4ecd', sun: '#ffe5c4', ambient: '#ffb4a2',
    },
    radius: 60, seed: 4242,
    props: { trees: 20, rocks: 90, ruins: 4, crystals: 60, mesas: 16, pillars: 0, grass: 0.5, flowers: 0 },
    enemyWeights: { shaman: 1.6, exploder: 1.6, goblin: 1.2 },
    spawnRateMult: 1.1, enemyDamageMult: 1.1, enemySpeedMult: 1.12, eliteChanceMult: 1.2,
    xpMult: 1.15, goldMult: 1.25, difficultyStars: 2, unlock: 'survive_8', music: 1,
  },
  {
    id: 'arena', name: 'THE FORGOTTEN ARENA', subtitle: 'The crowd wants blood',
    description: 'An ancient colosseum. No cover, aggressive hordes, double gold.',
    modifiers: ['Spawn rate +35%', 'Enemies deal +20% damage', 'Elites twice as common', 'Gold x2'],
    palette: {
      sky: '#3d1a4a', fog: '#5e2a5a', ground: '#9c8c7a', groundAlt: '#b5a48e', path: '#7d6e5d',
      grass: '#8a7a68', foliage: ['#6a994e'], trunk: '#5c4033',
      rock: '#6b6158', ruin: '#d6c7b0', accent: '#ff6b35', sun: '#ffe2b8', ambient: '#d6ccf5',
    },
    radius: 44, seed: 999,
    props: { trees: 0, rocks: 14, ruins: 6, crystals: 0, mesas: 0, pillars: 28, grass: 0.15, flowers: 0 },
    enemyWeights: { brute: 1.6, goblin: 1.3 },
    spawnRateMult: 1.35, enemyDamageMult: 1.2, enemySpeedMult: 1.05, eliteChanceMult: 2,
    xpMult: 1.1, goldMult: 2, difficultyStars: 3, unlock: 'golem', music: 2,
  },
];

export const MAP_MAP = Object.fromEntries(MAPS.map((m) => [m.id, m])) as Record<MapId, MapDef>;
