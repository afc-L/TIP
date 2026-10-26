// Content-definition types. Content lives in src/data; combat logic lives in src/game.

export type WeaponId =
  | 'hammer' | 'blades' | 'orb' | 'boomerang' | 'lightning'
  | 'rocket' | 'poison' | 'quake' | 'knives' | 'charge';

export type PassiveId =
  | 'powerCore' | 'runningShoes' | 'ironHeart' | 'magnet' | 'luckyCoin'
  | 'critLens' | 'coolingFan' | 'thorns' | 'regenSeed' | 'xpCrystal'
  | 'arcaneFocus' | 'longArm' | 'blastPowder' | 'ironShell';

export type CharacterId = 'bonker' | 'runner' | 'scrapRat' | 'wizard' | 'moose';
export type MapId = 'forest' | 'canyon' | 'arena';
export type EnemyKind = 'slime' | 'bigSlime' | 'goblin' | 'brute' | 'shaman' | 'exploder';
export type BossId = 'stumpKing' | 'scrapGolem';
export type RunMode = 'standard' | 'practice' | 'endless';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'evolution';

/**
 * Numeric player stats. Everything that modifies the player funnels into one of these.
 * Multiplier keys (see MULT_KEYS in PlayerStats) are factors around 1; the rest are additive.
 * Character and permanent mods give multiplier keys as factors (1.05 = +5%);
 * passive items give them as per-level increments (0.1 = +10% per level).
 */
export interface StatBlock {
  maxHp: number;
  moveSpeed: number;
  armor: number;
  damageMult: number;
  critChance: number;
  critDamage: number;
  cooldownMult: number;   // < 1 means faster attacks
  xpGain: number;
  pickupRadius: number;
  luck: number;
  regen: number;          // hp per second
  knockbackMult: number;  // knockback we deal
  knockbackResist: number;
  areaMult: number;
  durationMult: number;
  projectileSpeedMult: number;
  extraProjectiles: number;
  goldGain: number;
  thorns: number;         // fraction reflected
  explosiveMult: number;
}

export type StatMod = Partial<StatBlock>;

export interface WeaponStats {
  damage: number;
  cooldown: number;
  area: number;       // radius / range / size depending on weapon
  count: number;      // projectiles, blades, chains...
  pierce: number;
  speed: number;
  duration: number;
  knockback: number;
  crit: number;       // extra crit chance
}

export interface WeaponDef {
  id: WeaponId;
  name: string;
  icon: string;
  color: string;
  description: string;
  base: WeaponStats;
  /** Increments applied when reaching level index+2 (level 1 is base). */
  levels: { mod: Partial<WeaponStats>; text: string }[];
  explosive?: boolean;
  evolution: { name: string; passive: PassiveId; passiveLevel: number; description: string; icon: string };
  unlock?: string; // achievement id
}

export interface PassiveDef {
  id: PassiveId;
  name: string;
  icon: string;
  color: string;
  description: string;
  maxLevel: number;
  perLevel: StatMod;
  /** Extra text for special per-level effects. */
  levelText: (lvl: number) => string;
}

export interface CharacterDef {
  id: CharacterId;
  name: string;
  title: string;
  description: string;
  color: string;
  baseHp: number;
  moveSpeed: number;
  weapon: WeaponId;
  passiveName: string;
  passiveText: string;
  stats: StatMod;
  difficulty: 1 | 2 | 3;
  unlock?: string; // achievement id
}
