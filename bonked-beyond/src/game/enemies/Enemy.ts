import type { EnemyDef } from '../../data/enemies';
import type { EliteMod, EnemyKind } from '../../data/types';
import type { Telegraph } from '../effects/Vfx';

export type EnemyState = 'chase' | 'windup' | 'dash' | 'fuse' | 'cast' | 'burrow' | 'emerge' | 'blink' | 'slam';

export interface Enemy {
  id: number;
  active: boolean;   // occupies a pool slot (alive or playing its death animation)
  alive: boolean;    // can be targeted / collides
  hidden: boolean;   // underground or blinking: not targetable
  kind: EnemyKind | 'boss';
  def: EnemyDef | null;
  x: number; z: number;
  vx: number; vz: number;      // knockback velocity
  facing: number;
  hp: number; maxHp: number;
  speed: number; damage: number; radius: number; xp: number;
  kbResist: number;
  elite: boolean;
  mods: EliteMod[];
  flash: number;
  attackT: number;
  state: EnemyState;
  stateT: number;
  specialT: number;
  dirX: number; dirZ: number;
  slowT: number;
  slowFactor: number;
  burnT: number;
  burnDps: number;
  burnTick: number;
  shockT: number;
  anim: number;
  flank: number;
  dyingT: number;
  scale: number;
  bladeHitT: number;
  bladeHitT2: number;
  chargeHitId: number;
  poisonT: number;
  telegraph: Telegraph | null;
  goldChance: number;
  summoned: boolean;
  dropsChest: boolean;
  dormant: boolean;
  lastElement: string;
}

let nextId = 1;

export function createEnemy(): Enemy {
  return {
    id: 0, active: false, alive: false, hidden: false, kind: 'slime', def: null, x: 0, z: 0, vx: 0, vz: 0, facing: 0,
    hp: 1, maxHp: 1, speed: 1, damage: 1, radius: 0.5, xp: 1, kbResist: 0, elite: false, mods: [], flash: 0,
    attackT: 0, state: 'chase', stateT: 0, specialT: 0, dirX: 0, dirZ: 0, slowT: 0, slowFactor: 0.5, burnT: 0, burnDps: 0, burnTick: 0,
    shockT: 0, anim: 0, flank: 0, dyingT: 0, scale: 1, bladeHitT: -1, bladeHitT2: -1, chargeHitId: -1, poisonT: 0,
    telegraph: null, goldChance: 0, summoned: false, dropsChest: false, dormant: false, lastElement: 'physical',
  };
}

export function newEnemyId() { return nextId++; }
