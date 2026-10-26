import type { BossId, EnemyKind, MapId } from './types';

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
  crystals: string[];
}

export type MapHazard = 'fruit' | 'crystals' | 'firejets' | 'blizzard' | 'lava';

export interface MapDef {
  id: MapId;
  name: string;
  subtitle: string;
  description: string;
  modifiers: string[];
  palette: MapPalette;
  radius: number;
  seed: number;
  props: { trees: number; rocks: number; ruins: number; crystals: number; mesas: number; pillars: number; grass: number; flowers: number; lavaPools: number; spikes: number };
  enemyWeights: Partial<Record<EnemyKind, number>>; // multipliers on director weights
  spawnRateMult: number;
  enemyDamageMult: number;
  enemySpeedMult: number;
  eliteChanceMult: number;
  xpMult: number;
  goldMult: number;
  bossHpMult: number;
  difficultyStars: number;
  unlock?: string; // achievement id
  music: number;   // music variant
  bosses: [BossId, BossId];
  bossTimes: [number, number]; // timeline seconds
  hazard: MapHazard;
  hazardText: string;
  friction: number; // 1 = normal grip, lower = icy
  snow?: boolean;
}

export const MAPS: MapDef[] = [
  {
    id: 'forest', name: 'BONK FOREST', subtitle: 'Where it all begins',
    description: 'Sunlit glades, crumbling ruins and far too many slimes.',
    modifiers: ['Balanced, beginner-friendly', 'Ruins provide cover'],
    palette: {
      sky: '#8ecae6', fog: '#b7e4c7', ground: '#5a9e4b', groundAlt: '#6fb35a', path: '#c2a878',
      grass: '#7cc95e', foliage: ['#2d6a4f', '#40916c', '#52b788', '#74c69d'], trunk: '#7f5539',
      rock: '#8d99ae', ruin: '#b0a99f', accent: '#ffd166', sun: '#fff1d0', ambient: '#a8c5ff', crystals: ['#80ff72'],
    },
    radius: 62, seed: 1337,
    props: { trees: 150, rocks: 70, ruins: 10, crystals: 0, mesas: 0, pillars: 14, grass: 1, flowers: 1, lavaPools: 0, spikes: 0 },
    enemyWeights: {}, spawnRateMult: 1, enemyDamageMult: 1, enemySpeedMult: 1, eliteChanceMult: 1,
    xpMult: 1, goldMult: 1, bossHpMult: 1, difficultyStars: 1, music: 0,
    bosses: ['stumpKing', 'scrapGolem'], bossTimes: [390, 780],
    hazard: 'fruit', hazardText: 'Healing fruit grows near you every 45s', friction: 1,
  },
  {
    id: 'canyon', name: 'CRYSTAL CANYON', subtitle: 'Shiny. Dangerous.',
    description: 'Sun-baked mesas studded with humming crystals. The horde moves faster here.',
    modifiers: ['Enemies +12% speed', 'More casters, bombers and elites', '+15% XP'],
    palette: {
      sky: '#f6bd60', fog: '#f7d1a6', ground: '#c8794a', groundAlt: '#d98c5f', path: '#e9c39b',
      grass: '#d4a373', foliage: ['#bc6c25', '#dda15e'], trunk: '#6f4518',
      rock: '#a0522d', ruin: '#c08552', accent: '#ff4ecd', sun: '#ffe5c4', ambient: '#ffb4a2', crystals: ['#ff4ecd', '#4cc9f0', '#b388ff', '#72efdd'],
    },
    radius: 60, seed: 4242,
    props: { trees: 20, rocks: 90, ruins: 4, crystals: 60, mesas: 16, pillars: 0, grass: 0.5, flowers: 0, lavaPools: 0, spikes: 0 },
    enemyWeights: { shaman: 1.6, exploder: 1.6, goblin: 1.2, bombardier: 1.6, archer: 1.4, burrower: 1.5 },
    spawnRateMult: 1.1, enemyDamageMult: 1.1, enemySpeedMult: 1.12, eliteChanceMult: 1.6,
    xpMult: 1.15, goldMult: 1.25, bossHpMult: 1.05, difficultyStars: 2, unlock: 'survive_8', music: 1,
    bosses: ['crystalColossus', 'scrapGolem'], bossTimes: [390, 780],
    hazard: 'crystals', hazardText: 'Crystals erupt around you (watch the markers) and hurt enemies too', friction: 1,
  },
  {
    id: 'arena', name: 'THE FORGOTTEN ARENA', subtitle: 'The crowd wants blood',
    description: 'An ancient colosseum. Little cover, aggressive waves and bosses that arrive early.',
    modifiers: ['Spawn rate +35%', 'Enemies deal +20% damage', 'Bosses arrive earlier', 'Gold x2'],
    palette: {
      sky: '#3d1a4a', fog: '#5e2a5a', ground: '#9c8c7a', groundAlt: '#b5a48e', path: '#7d6e5d',
      grass: '#8a7a68', foliage: ['#6a994e'], trunk: '#5c4033',
      rock: '#6b6158', ruin: '#d6c7b0', accent: '#ff6b35', sun: '#ffe2b8', ambient: '#d6ccf5', crystals: ['#ffb703'],
    },
    radius: 44, seed: 999,
    props: { trees: 0, rocks: 14, ruins: 6, crystals: 0, mesas: 0, pillars: 28, grass: 0.15, flowers: 0, lavaPools: 0, spikes: 0 },
    enemyWeights: { brute: 1.6, goblin: 1.3, shieldKnight: 1.8, beetle: 1.4 },
    spawnRateMult: 1.35, enemyDamageMult: 1.2, enemySpeedMult: 1.05, eliteChanceMult: 2,
    xpMult: 1.1, goldMult: 2, bossHpMult: 1, difficultyStars: 3, unlock: 'golem', music: 2,
    bosses: ['goldenExecutioner', 'scrapGolem'], bossTimes: [300, 630],
    hazard: 'firejets', hazardText: 'Fire jets sweep the arena floor', friction: 1,
  },
  {
    id: 'frozen', name: 'FROZEN WASTELAND', subtitle: 'Mind your footing',
    description: 'A blizzard-swept tundra of ice spikes and frozen pines. The ground is slippery.',
    modifiers: ['Slippery ice: you slide', 'Blizzards slow everything', 'More phantoms and stalkers'],
    palette: {
      sky: '#bde0fe', fog: '#e2ecf7', ground: '#dbe7f2', groundAlt: '#c6d8ea', path: '#a9c4dd',
      grass: '#e9f2fa', foliage: ['#e0f2ff', '#cfe6f7', '#2d6a4f'], trunk: '#6c584c',
      rock: '#8fa9c2', ruin: '#cfd8e3', accent: '#90e0ef', sun: '#ffffff', ambient: '#b8d8ff', crystals: ['#90e0ef', '#caf0f8', '#a0c4ff'],
    },
    radius: 60, seed: 777,
    props: { trees: 110, rocks: 50, ruins: 4, crystals: 40, mesas: 0, pillars: 0, grass: 0.35, flowers: 0, lavaPools: 0, spikes: 30 },
    enemyWeights: { phantom: 1.8, stalker: 1.6, beetle: 1.2 },
    spawnRateMult: 1.1, enemyDamageMult: 1.1, enemySpeedMult: 1, eliteChanceMult: 1.3,
    xpMult: 1.15, goldMult: 1.4, bossHpMult: 1.1, difficultyStars: 2, unlock: 'colossus', music: 1, snow: true,
    bosses: ['crystalColossus', 'voidDevourer'], bossTimes: [390, 780],
    hazard: 'blizzard', hazardText: 'Periodic blizzards slow you and the horde', friction: 0.3,
  },
  {
    id: 'lava', name: 'LAVA FIELDS', subtitle: 'The floor is literally lava',
    description: 'Black obsidian plains split by rivers of magma. Lure enemies into the lava pools.',
    modifiers: ['Lava pools burn anything inside', 'Eruptions rain down', 'Bosses have +15% health', 'Gold x1.6'],
    palette: {
      sky: '#2b0f0e', fog: '#4a1a10', ground: '#3d2c2a', groundAlt: '#52392f', path: '#6b3e26',
      grass: '#5c3d2e', foliage: ['#3a2618'], trunk: '#241512',
      rock: '#2f2522', ruin: '#5e4b45', accent: '#ff5400', sun: '#ffb38a', ambient: '#ff8f66', crystals: ['#ff5400', '#ffb703'],
    },
    radius: 60, seed: 3131,
    props: { trees: 30, rocks: 80, ruins: 6, crystals: 24, mesas: 6, pillars: 0, grass: 0.2, flowers: 0, lavaPools: 14, spikes: 40 },
    enemyWeights: { exploder: 1.5, bombardier: 1.8, brute: 1.3, burrower: 1.4 },
    spawnRateMult: 1.2, enemyDamageMult: 1.2, enemySpeedMult: 1.05, eliteChanceMult: 1.5,
    xpMult: 1.2, goldMult: 1.6, bossHpMult: 1.15, difficultyStars: 3, unlock: 'executioner', music: 2,
    bosses: ['goldenExecutioner', 'voidDevourer'], bossTimes: [390, 780],
    hazard: 'lava', hazardText: 'Lava pools burn you and enemies; eruptions every 25s', friction: 1,
  },
];

export const MAP_MAP = Object.fromEntries(MAPS.map((m) => [m.id, m])) as Record<MapId, MapDef>;
