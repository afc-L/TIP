// Level-up choice generation. Only valid upgrades are ever offered.
import { PASSIVE_MAP, PASSIVES } from '../../data/passives';
import type { PassiveId, Rarity, WeaponId } from '../../data/types';
import { RARITY_POWER, SPECIAL_MAP, SPECIALS, STAT_CARDS, type SpecialId } from '../../data/upgrades';
import { WEAPON_MAP, WEAPON_MAX_LEVEL, WEAPONS } from '../../data/weapons';
import { isWeaponUnlocked } from '../../store/progressionStore';
import type { UpgradeCard } from '../../store/gameStore';
import type { Run } from '../Run';
import { MAX_WEAPONS } from '../weapons/WeaponManager';
import { weightedIndex } from '../util';

export const MAX_PASSIVES = 6;

export type Choice =
  | { kind: 'newWeapon'; id: WeaponId; rarity: Rarity }
  | { kind: 'weaponLevel'; id: WeaponId; levels: number; rarity: Rarity }
  | { kind: 'newPassive'; id: PassiveId; rarity: Rarity }
  | { kind: 'passiveLevel'; id: PassiveId; levels: number; rarity: Rarity }
  | { kind: 'evolution'; id: WeaponId; rarity: Rarity }
  | { kind: 'stat'; id: string; rarity: Rarity }
  | { kind: 'special'; id: SpecialId; rarity: Rarity }
  | { kind: 'heal'; rarity: Rarity }
  | { kind: 'gold'; rarity: Rarity }
  | { kind: 'frenzy'; rarity: Rarity };

/** Key used for dedupe and banishing. */
export function choiceKey(c: Choice): string {
  switch (c.kind) {
    case 'newWeapon': case 'weaponLevel': case 'evolution': return 'w:' + c.id;
    case 'newPassive': case 'passiveLevel': return 'p:' + c.id;
    case 'stat': return 's:' + c.id;
    case 'special': return 'x:' + c.id;
    default: return c.kind;
  }
}

export function evolutionRequirement(run: Run, id: WeaponId): number {
  return Math.max(1, WEAPON_MAP[id].evolution.passiveLevel - ((run.permanent.evolution ?? 0) > 0 ? 1 : 0));
}

export function evolutionsAvailable(run: Run): WeaponId[] {
  const out: WeaponId[] = [];
  for (const w of run.weapons.list) {
    if (w.evolved || w.level < WEAPON_MAX_LEVEL) continue;
    if ((run.passives[w.def.evolution.passive] ?? 0) >= evolutionRequirement(run, w.id)) out.push(w.id);
  }
  return out;
}

export function rollRarity(run: Run): Rarity {
  const luck = run.stats.luck + (run.permanent.rarity ?? 0) * 12;
  const r = Math.random();
  if (r < 0.02 + luck * 0.0005) return 'legendary';
  if (r < 0.07 + luck * 0.0012) return 'epic';
  if (r < 0.22 + luck * 0.0025) return 'rare';
  if (r < 0.48 + luck * 0.002) return 'uncommon';
  return 'common';
}

export function generateChoices(run: Run, count: number): Choice[] {
  const pool: { c: Choice; w: number; key: string }[] = [];
  const weaponsFull = run.weapons.list.length >= MAX_WEAPONS;
  const passiveCount = Object.values(run.passives).filter((l) => (l ?? 0) > 0).length;
  const push = (c: Choice, w: number) => { const key = choiceKey(c); if (!run.banished.has(key)) pool.push({ c, w, key }); };

  for (const w of run.weapons.list) {
    if (w.level >= WEAPON_MAX_LEVEL) continue;
    const roll = rollRarity(run);
    const remaining = WEAPON_MAX_LEVEL - w.level;
    let levels = roll === 'legendary' || roll === 'epic' ? 3 : roll === 'rare' ? 2 : 1;
    levels = Math.min(levels, remaining);
    const rarity: Rarity = levels === 3 ? (roll === 'legendary' ? 'legendary' : 'epic') : levels === 2 ? 'rare' : 'common';
    push({ kind: 'weaponLevel', id: w.id, levels, rarity }, 1.35);
  }
  if (!weaponsFull) {
    for (const def of WEAPONS) {
      if (run.weapons.has(def.id) || !isWeaponUnlocked(def.id)) continue;
      push({ kind: 'newWeapon', id: def.id, rarity: 'uncommon' }, run.weapons.list.length < 3 ? 1.0 : 0.5);
    }
  }
  for (const def of PASSIVES) {
    const lvl = run.passives[def.id] ?? 0;
    if (lvl >= def.maxLevel) continue;
    const synergy = run.weapons.list.some((w) => w.def.evolution.passive === def.id && !w.evolved) ? 1.6 : 1;
    if (lvl === 0) {
      if (passiveCount >= MAX_PASSIVES) continue;
      push({ kind: 'newPassive', id: def.id, rarity: 'uncommon' }, 0.75 * synergy);
    } else {
      const roll = rollRarity(run);
      const levels = (roll === 'rare' || roll === 'epic' || roll === 'legendary') && def.maxLevel - lvl >= 2 ? 2 : 1;
      push({ kind: 'passiveLevel', id: def.id, levels, rarity: levels === 2 ? 'rare' : 'common' }, 1.0 * synergy);
    }
  }
  // one stat card and (rarely) one special per offer
  const card = STAT_CARDS[Math.floor(Math.random() * STAT_CARDS.length)];
  push({ kind: 'stat', id: card.id, rarity: rollRarity(run) }, 0.55);
  const specials = SPECIALS.filter((s) => !run.specials.has(s.id));
  if (run.level >= 5 && specials.length) {
    const sp = specials[Math.floor(Math.random() * specials.length)];
    push({ kind: 'special', id: sp.id, rarity: 'legendary' }, 0.1 + run.stats.luck * 0.002 + (run.permanent.rarity ?? 0) * 0.04);
  }

  const out: Choice[] = [];
  const evos = evolutionsAvailable(run).filter((id) => !run.banished.has('w:' + id));
  if (evos.length) out.push({ kind: 'evolution', id: evos[0], rarity: 'evolution' });
  const taken = new Set(out.map(choiceKey));
  while (out.length < count && pool.length) {
    const i = weightedIndex(pool.map((p) => p.w));
    if (i < 0) break;
    const [picked] = pool.splice(i, 1);
    if (taken.has(picked.key)) continue;
    taken.add(picked.key);
    out.push(picked.c);
  }
  // everything maxed: alternative rewards
  const fallbacks: Choice[] = [{ kind: 'heal', rarity: 'common' }, { kind: 'gold', rarity: 'uncommon' }, { kind: 'frenzy', rarity: 'rare' }];
  for (const f of fallbacks) if (out.length < count && !taken.has(choiceKey(f))) out.push(f);
  return out;
}

export function choiceToCard(c: Choice, run: Run, index: number): UpgradeCard {
  const key = `${index}-${choiceKey(c)}-${c.rarity}`;
  switch (c.kind) {
    case 'newWeapon': {
      const d = WEAPON_MAP[c.id];
      return { key, icon: d.icon, name: d.name, rarity: c.rarity, kindLabel: 'NEW WEAPON', description: d.description, levelText: `Lv 1 / ${WEAPON_MAX_LEVEL}`, effectText: `${d.tags.join(' · ')} — evolves with ${PASSIVE_MAP[d.evolution.passive].name}`, color: d.color };
    }
    case 'weaponLevel': {
      const d = WEAPON_MAP[c.id];
      const w = run.weapons.get(c.id)!;
      const texts = d.levels.slice(w.level - 1, w.level - 1 + c.levels).map((l) => l.text);
      return { key, icon: d.icon, name: d.name, rarity: c.rarity, kindLabel: c.levels > 1 ? `WEAPON +${c.levels} LEVELS` : 'WEAPON UPGRADE', description: d.description, levelText: `Lv ${w.level} → ${w.level + c.levels} / ${WEAPON_MAX_LEVEL}`, effectText: texts.join(' · '), color: d.color };
    }
    case 'newPassive': {
      const d = PASSIVE_MAP[c.id];
      return { key, icon: d.icon, name: d.name, rarity: c.rarity, kindLabel: 'NEW ITEM', description: d.description, levelText: `Lv 1 / ${d.maxLevel}`, effectText: d.levelText(1), color: d.color };
    }
    case 'passiveLevel': {
      const d = PASSIVE_MAP[c.id];
      const l = run.passives[c.id] ?? 0;
      return { key, icon: d.icon, name: d.name, rarity: c.rarity, kindLabel: c.levels > 1 ? 'ITEM +2 LEVELS' : 'ITEM UPGRADE', description: d.description, levelText: `Lv ${l} → ${l + c.levels} / ${d.maxLevel}`, effectText: `${d.levelText(l)} → ${d.levelText(l + c.levels)}`, color: d.color };
    }
    case 'evolution': {
      const d = WEAPON_MAP[c.id];
      return { key, icon: d.evolution.icon, name: d.evolution.name, rarity: 'evolution', kindLabel: 'EVOLUTION', description: d.evolution.description, levelText: `${d.name} evolves`, effectText: '+60% damage and a brand new behaviour', color: '#ffd60a' };
    }
    case 'stat': {
      const d = STAT_CARDS.find((s) => s.id === c.id)!;
      const k = RARITY_POWER[c.rarity] ?? 1;
      return { key, icon: d.icon, name: d.name, rarity: c.rarity, kindLabel: 'TRAINING', description: 'A permanent stat boost for this run. Rarity makes it stronger.', levelText: `${c.rarity} ×${k}`, effectText: d.text(k), color: d.color };
    }
    case 'special': {
      const d = SPECIAL_MAP[c.id];
      return { key, icon: d.icon, name: d.name, rarity: 'legendary', kindLabel: 'LEGENDARY TRAIT', description: 'Changes how this run plays. One of each per run.', levelText: 'Unique', effectText: d.description, color: '#ff9f1c' };
    }
    case 'heal':
      return { key, icon: '🍖', name: 'HEARTY MEAL', rarity: c.rarity, kindLabel: 'RECOVERY', description: 'Everything is maxed. Have a snack.', levelText: '—', effectText: 'Restore 40% of max HP', color: '#ff6b6b' };
    case 'gold':
      return { key, icon: '💰', name: 'GOLD POUCH', rarity: c.rarity, kindLabel: 'TREASURE', description: 'A pouch of shiny coins.', levelText: '—', effectText: `+${goldAmount(run)} gold`, color: '#ffd60a' };
    case 'frenzy':
      return { key, icon: '🔥', name: 'ADRENALINE', rarity: c.rarity, kindLabel: 'POWER SURGE', description: 'A temporary surge of power.', levelText: '—', effectText: '+50% damage and 40% faster attacks for 30s', color: '#ff9f1c' };
  }
}

export function goldAmount(run: Run) {
  return 20 + Math.floor(run.timelineMinutes * 4);
}
