// Pure stat computation: stats are always rebuilt from sources, never incrementally mutated,
// so picking the same upgrade repeatedly can never double-apply anything.
import { CHARACTER_MAP } from '../../data/characters';
import { PASSIVE_MAP } from '../../data/passives';
import { PERMANENT_UPGRADES } from '../../data/permanentUpgrades';
import type { CharacterId, PassiveId, StatBlock, StatMod } from '../../data/types';
import { CONFIG } from '../GameConfig';

export const MULT_KEYS: ReadonlySet<keyof StatBlock> = new Set([
  'moveSpeed', 'damageMult', 'cooldownMult', 'xpGain', 'pickupRadius', 'knockbackMult',
  'areaMult', 'durationMult', 'projectileSpeedMult', 'goldGain', 'explosiveMult',
  'dotMult', 'statusDuration', 'summonMult', 'healMult', 'dodgeCooldown',
]);

export interface StatSources {
  character: CharacterId;
  permanent: Record<string, number>;
  passives: Partial<Record<PassiveId, number>>;
  /** Accumulated level-up stat cards: multiplier keys as fractions, others additive. */
  cards: StatMod;
  /** Factor-style mods: synergies, specials, run modifiers, temporary buffs. */
  factors: StatMod[];
}

export function baseStats(): StatBlock {
  return {
    maxHp: 100, moveSpeed: 6, armor: 0, damageMult: 1, critChance: 0.05, critDamage: CONFIG.player.baseCritDamage,
    cooldownMult: 1, xpGain: 1, pickupRadius: CONFIG.player.basePickupRadius, luck: 0, regen: 0,
    knockbackMult: 1, knockbackResist: 0, areaMult: 1, durationMult: 1, projectileSpeedMult: 1,
    extraProjectiles: 0, goldGain: 1, thorns: 0, explosiveMult: 1,
    dotMult: 1, statusDuration: 1, summonMult: 1, healMult: 1, dodgeCooldown: 1,
  };
}

export function applyFactorMod(s: StatBlock, mod: StatMod) {
  for (const k in mod) {
    const key = k as keyof StatBlock;
    const v = mod[key] as number;
    if (MULT_KEYS.has(key)) s[key] *= v;
    else s[key] += v;
  }
}

export function computeStats(src: StatSources): StatBlock {
  const ch = CHARACTER_MAP[src.character];
  const s = baseStats();
  s.maxHp = ch.baseHp;
  s.moveSpeed = ch.moveSpeed;
  applyFactorMod(s, ch.stats);
  for (const up of PERMANENT_UPGRADES) {
    const r = src.permanent[up.id] ?? 0;
    if (r > 0) applyFactorMod(s, up.effect(Math.min(r, up.maxRank)));
  }
  // passives and stat cards: multiplier keys stack additively, then multiply in
  const multSum: Partial<Record<keyof StatBlock, number>> = {};
  const addInc = (key: keyof StatBlock, v: number) => {
    if (MULT_KEYS.has(key)) multSum[key] = (multSum[key] ?? 0) + v;
    else s[key] += v;
  };
  for (const [id, lvl] of Object.entries(src.passives) as [PassiveId, number][]) {
    if (!lvl) continue;
    const def = PASSIVE_MAP[id];
    for (const k in def.perLevel) addInc(k as keyof StatBlock, (def.perLevel[k as keyof StatBlock] as number) * lvl);
    if (id === 'arcaneFocus') s.extraProjectiles += lvl >= 5 ? 2 : lvl >= 3 ? 1 : 0;
  }
  for (const k in src.cards) addInc(k as keyof StatBlock, src.cards[k as keyof StatBlock] as number);
  for (const [k, v] of Object.entries(multSum) as [keyof StatBlock, number][]) s[k] *= Math.max(0.35, 1 + v);
  for (const f of src.factors) applyFactorMod(s, f);
  s.cooldownMult = Math.max(0.28, s.cooldownMult);
  s.dodgeCooldown = Math.max(0.4, s.dodgeCooldown);
  s.critChance = Math.min(1, s.critChance + s.luck * 0.0008);
  s.knockbackResist = Math.min(0.9, s.knockbackResist);
  s.maxHp = Math.max(20, Math.round(s.maxHp));
  return s;
}

/** Damage after armor. Diminishing returns; never below 1. */
export function armorReduce(dmg: number, armor: number): number {
  return Math.max(1, dmg * (20 / (20 + Math.max(0, armor))));
}
