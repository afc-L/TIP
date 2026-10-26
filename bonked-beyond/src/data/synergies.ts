// Data-driven build synergies. Add a new one here; the run evaluates them after every upgrade.
import type { Element, PassiveId, StatMod, WeaponId, WeaponTag } from './types';

export interface SynergyContext {
  tags: Partial<Record<WeaponTag, number>>;   // how many owned weapons carry each tag
  weapons: WeaponId[];
  passives: Partial<Record<PassiveId, number>>;
}

export type SynergyFlag = 'chainRange' | 'burnSpread' | 'treasure' | 'survivor' | 'extraDrone' | 'blastRadius';

export interface SynergyDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  hint: string;                         // how to activate it
  check: (c: SynergyContext) => boolean;
  stats?: StatMod;                      // factor semantics, like character mods
  elementMult?: Partial<Record<Element, number>>;
  flags?: SynergyFlag[];
}

const ELEMENTS: Element[] = ['fire', 'lightning', 'poison', 'arcane', 'frost'];
const t = (c: SynergyContext, tag: WeaponTag) => c.tags[tag] ?? 0;
const p = (c: SynergyContext, id: PassiveId) => c.passives[id] ?? 0;

export const SYNERGIES: SynergyDef[] = [
  {
    id: 'twoElements', name: 'TWO ELEMENTS', icon: '☯️', hint: 'Own weapons of two different elements.',
    description: 'Fire, lightning, poison, arcane and frost damage +12%.',
    check: (c) => ELEMENTS.filter((e) => t(c, e) > 0).length >= 2,
    elementMult: { fire: 1.12, lightning: 1.12, poison: 1.12, arcane: 1.12, frost: 1.12 },
  },
  {
    id: 'storm', name: 'STORM BUILD', icon: '⛈️', hint: 'Two lightning weapons, or one plus Critical Lens Lv 2.',
    description: 'Lightning chains jump 40% further and deal +15% damage.',
    check: (c) => t(c, 'lightning') >= 2 || (t(c, 'lightning') >= 1 && p(c, 'critLens') >= 2),
    elementMult: { lightning: 1.15 }, flags: ['chainRange'],
  },
  {
    id: 'fullMetal', name: 'FULL METAL', icon: '⚙️', hint: 'Own two heavy weapons.',
    description: 'Heavy weapons knock enemies 40% further; physical damage +10%.',
    check: (c) => t(c, 'heavy') >= 2, stats: { knockbackMult: 1.4 }, elementMult: { physical: 1.1 },
  },
  {
    id: 'glassCannon', name: 'GLASS CANNON', icon: '🥂', hint: 'Power Core Lv 3 without Iron Heart or Iron Shell.',
    description: '+22% damage, but -15% max HP.',
    check: (c) => p(c, 'powerCore') >= 3 && !p(c, 'ironHeart') && !p(c, 'ironShell'), stats: { damageMult: 1.22, maxHp: -15 },
  },
  {
    id: 'treasureHunter', name: 'TREASURE HUNTER', icon: '🏴‍☠️', hint: 'Lucky Coin Lv 2 plus a treasure weapon or Magnet.',
    description: 'Elites always drop a golden chest; bosses drop an extra one. +15% gold.',
    check: (c) => p(c, 'luckyCoin') >= 2 && (t(c, 'treasure') > 0 || p(c, 'magnet') > 0), stats: { goldGain: 1.15 }, flags: ['treasure'],
  },
  {
    id: 'survivor', name: 'SURVIVOR', icon: '🛡️', hint: 'Regeneration Seed and Iron Shell.',
    description: 'Below 40% HP: triple regeneration and +6 armor.',
    check: (c) => p(c, 'regenSeed') >= 1 && p(c, 'ironShell') >= 1, flags: ['survivor'],
  },
  {
    id: 'plagueDoctor', name: 'PLAGUE DOCTOR', icon: '🩺', hint: 'A poison weapon plus Arcane Focus.',
    description: 'Poison and burn +30% damage; status effects last 40% longer.',
    check: (c) => t(c, 'poison') >= 1 && p(c, 'arcaneFocus') >= 1, stats: { dotMult: 1.3, statusDuration: 1.4 },
  },
  {
    id: 'pyromaniac', name: 'PYROMANIAC', icon: '🔥', hint: 'Own two fire weapons.',
    description: 'Burns deal +50% damage and spread to nearby enemies on death.',
    check: (c) => t(c, 'fire') >= 2, stats: { dotMult: 1.5 }, flags: ['burnSpread'],
  },
  {
    id: 'artillery', name: 'ARTILLERY', icon: '💣', hint: 'Own two explosive weapons, or one plus Blast Powder Lv 2.',
    description: 'Explosions are 25% bigger.',
    check: (c) => t(c, 'explosive') >= 2 || (t(c, 'explosive') >= 1 && p(c, 'blastPowder') >= 2), flags: ['blastRadius'],
  },
  {
    id: 'swarmLord', name: 'SWARM LORD', icon: '🐝', hint: 'A summon weapon plus Cooling Fan.',
    description: '+1 drone, summons deal +20% damage.',
    check: (c) => t(c, 'summon') >= 1 && p(c, 'coolingFan') >= 1, stats: { summonMult: 1.2 }, flags: ['extraDrone'],
  },
  {
    id: 'bladeDancer', name: 'BLADE DANCER', icon: '💃', hint: 'Two melee weapons plus Running Shoes.',
    description: 'Attacks 12% faster, +8% move speed.',
    check: (c) => t(c, 'melee') >= 2 && p(c, 'runningShoes') >= 1, stats: { cooldownMult: 0.88, moveSpeed: 1.08 },
  },
  {
    id: 'arcanist', name: 'ARCANIST', icon: '🔯', hint: 'Own two arcane weapons.',
    description: '+1 projectile and +15% arcane damage.',
    check: (c) => t(c, 'arcane') >= 2, stats: { extraProjectiles: 1 }, elementMult: { arcane: 1.15 },
  },
];

export const SYNERGY_MAP = Object.fromEntries(SYNERGIES.map((s) => [s.id, s])) as Record<string, SynergyDef>;
