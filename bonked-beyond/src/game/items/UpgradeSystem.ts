// Level-up choice generation. Only valid upgrades are ever offered.
import { PASSIVE_MAP, PASSIVES } from '../../data/passives';
import type { PassiveId, Rarity, WeaponId } from '../../data/types';
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
  | { kind: 'passiveLevel'; id: PassiveId; rarity: Rarity }
  | { kind: 'evolution'; id: WeaponId; rarity: Rarity }
  | { kind: 'heal'; rarity: Rarity }
  | { kind: 'gold'; rarity: Rarity }
  | { kind: 'frenzy'; rarity: Rarity };

export function evolutionsAvailable(run: Run): WeaponId[] {
  const out: WeaponId[] = [];
  for (const w of run.weapons.list) {
    if (w.evolved || w.level < WEAPON_MAX_LEVEL) continue;
    const req = w.def.evolution;
    if ((run.passives[req.passive] ?? 0) >= req.passiveLevel) out.push(w.id);
  }
  return out;
}

function rollRarity(luck: number): Rarity {
  const r = Math.random();
  if (r < 0.05 + luck * 0.0012) return 'epic';
  if (r < 0.22 + luck * 0.003) return 'rare';
  return 'common';
}

export function generateChoices(run: Run, count: number): Choice[] {
  const pool: { c: Choice; w: number; key: string }[] = [];
  const luck = run.stats.luck;
  const weaponsFull = run.weapons.list.length >= MAX_WEAPONS;
  const passiveCount = Object.values(run.passives).filter((l) => (l ?? 0) > 0).length;

  for (const w of run.weapons.list) {
    if (w.level < WEAPON_MAX_LEVEL) {
      let rarity = rollRarity(luck);
      const remaining = WEAPON_MAX_LEVEL - w.level;
      let levels = rarity === 'epic' ? 3 : rarity === 'rare' ? 2 : 1;
      if (levels > remaining) { levels = remaining; rarity = levels === 3 ? 'epic' : levels === 2 ? 'rare' : 'common'; }
      pool.push({ c: { kind: 'weaponLevel', id: w.id, levels, rarity }, w: 1.35, key: 'w:' + w.id });
    }
  }
  if (!weaponsFull) {
    for (const def of WEAPONS) {
      if (run.weapons.has(def.id) || !isWeaponUnlocked(def.id)) continue;
      pool.push({ c: { kind: 'newWeapon', id: def.id, rarity: 'uncommon' }, w: run.weapons.list.length < 3 ? 1.1 : 0.55, key: 'w:' + def.id });
    }
  }
  for (const def of PASSIVES) {
    const lvl = run.passives[def.id] ?? 0;
    if (lvl >= def.maxLevel) continue;
    if (lvl === 0) {
      if (passiveCount >= MAX_PASSIVES) continue;
      // prefer passives that unlock an evolution for an owned weapon
      const synergy = run.weapons.list.some((w) => w.def.evolution.passive === def.id) ? 1.6 : 1;
      pool.push({ c: { kind: 'newPassive', id: def.id, rarity: 'uncommon' }, w: 0.8 * synergy, key: 'p:' + def.id });
    } else {
      const synergy = run.weapons.list.some((w) => w.def.evolution.passive === def.id && lvl < w.def.evolution.passiveLevel) ? 1.5 : 1;
      pool.push({ c: { kind: 'passiveLevel', id: def.id, rarity: 'common' }, w: 1.0 * synergy, key: 'p:' + def.id });
    }
  }

  const out: Choice[] = [];
  const evos = evolutionsAvailable(run);
  if (evos.length) out.push({ kind: 'evolution', id: evos[0], rarity: 'evolution' });
  while (out.length < count && pool.length) {
    const i = weightedIndex(pool.map((p) => p.w));
    if (i < 0) break;
    const [picked] = pool.splice(i, 1);
    out.push(picked.c);
    for (let k = pool.length - 1; k >= 0; k--) if (pool[k].key === picked.key) pool.splice(k, 1);
  }
  // everything maxed: alternative rewards
  const fallbacks: Choice[] = [{ kind: 'heal', rarity: 'common' }, { kind: 'gold', rarity: 'uncommon' }, { kind: 'frenzy', rarity: 'rare' }];
  for (const f of fallbacks) if (out.length < count) out.push(f);
  return out;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function choiceToCard(c: Choice, run: Run, index: number): UpgradeCard {
  const key = `${index}-${c.kind}-${'id' in c ? c.id : ''}`;
  switch (c.kind) {
    case 'newWeapon': {
      const d = WEAPON_MAP[c.id];
      return { key, icon: d.icon, name: d.name, rarity: c.rarity, kindLabel: 'NEW WEAPON', description: d.description, levelText: `Lv 1 / ${WEAPON_MAX_LEVEL}`, effectText: `Evolves with ${PASSIVE_MAP[d.evolution.passive].name}`, color: d.color };
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
      return { key, icon: d.icon, name: d.name, rarity: c.rarity, kindLabel: 'ITEM UPGRADE', description: d.description, levelText: `Lv ${l} → ${l + 1} / ${d.maxLevel}`, effectText: `${d.levelText(l)} → ${d.levelText(l + 1)}`, color: d.color };
    }
    case 'evolution': {
      const d = WEAPON_MAP[c.id];
      return { key, icon: d.evolution.icon, name: d.evolution.name, rarity: 'evolution', kindLabel: 'EVOLUTION', description: d.evolution.description, levelText: `${d.name} evolves`, effectText: '+60% damage and a brand new behaviour', color: '#ffd60a' };
    }
    case 'heal':
      return { key, icon: '🍖', name: 'HEARTY MEAL', rarity: c.rarity, kindLabel: 'RECOVERY', description: 'Everything is maxed. Have a snack.', levelText: '—', effectText: `Restore ${pct(0.4)} of max HP`, color: '#ff6b6b' };
    case 'gold':
      return { key, icon: '💰', name: 'GOLD POUCH', rarity: c.rarity, kindLabel: 'TREASURE', description: 'A pouch of shiny coins.', levelText: '—', effectText: `+${goldAmount(run)} gold`, color: '#ffd60a' };
    case 'frenzy':
      return { key, icon: '🔥', name: 'ADRENALINE', rarity: c.rarity, kindLabel: 'POWER SURGE', description: 'A temporary surge of power.', levelText: '—', effectText: '+50% damage and 40% faster attacks for 30s', color: '#ff9f1c' };
  }
}

export function goldAmount(run: Run) {
  return 20 + Math.floor(run.timelineMinutes * 4);
}
