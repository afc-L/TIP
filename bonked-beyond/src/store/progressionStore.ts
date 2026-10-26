import { create } from 'zustand';
import { ACHIEVEMENT_MAP } from '../data/achievements';
import { CHARACTERS } from '../data/characters';
import { MAPS } from '../data/maps';
import { PERMANENT_UPGRADES, upgradeCost } from '../data/permanentUpgrades';
import type { CharacterId, MapId, RunMode, WeaponId } from '../data/types';
import { WEAPON_MAP } from '../data/weapons';
import { bool, num, oneOf, readJSON, removeKey, writeJSON } from './storage';

export const SAVE_KEY = 'bonked_beyond_save';
export const SAVE_VERSION = 1;

export interface LifetimeStats {
  totalRuns: number;
  wins: number;
  totalTime: number;
  totalKills: number;
  totalElites: number;
  highestLevel: number;
  bestTime: number;
  totalBosses: number;
  totalCurrency: number;
  highestHit: number;
  totalDamage: number;
  mostKills: number;
}

export interface SaveData {
  version: number;
  currency: number;
  upgrades: Record<string, number>;
  purchasedAnyUpgrade: boolean;
  achievements: Record<string, number>;
  stats: LifetimeStats;
  characterRuns: Record<string, number>;
  bestTimeByMap: Record<string, number>;
  discovered: string[];
  selectedCharacter: CharacterId;
  selectedMap: MapId;
  selectedMode: RunMode;
}

const DEFAULT_STATS: LifetimeStats = {
  totalRuns: 0, wins: 0, totalTime: 0, totalKills: 0, totalElites: 0, highestLevel: 0, bestTime: 0,
  totalBosses: 0, totalCurrency: 0, highestHit: 0, totalDamage: 0, mostKills: 0,
};

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION, currency: 0, upgrades: {}, purchasedAnyUpgrade: false, achievements: {},
    stats: { ...DEFAULT_STATS }, characterRuns: {}, bestTimeByMap: {}, discovered: [],
    selectedCharacter: 'bonker', selectedMap: 'forest', selectedMode: 'standard',
  };
}

const numRecord = (v: unknown, keys: string[] | null, lo: number, hi: number): Record<string, number> => {
  const out: Record<string, number> = {};
  if (typeof v !== 'object' || v == null) return out;
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (keys && !keys.includes(k)) continue;
    if (typeof val === 'number' && Number.isFinite(val)) out[k] = Math.min(hi, Math.max(lo, val));
  }
  return out;
};

/** Validates every field; anything malformed falls back to a safe default. */
export function validateSave(raw: unknown): SaveData {
  const d = defaultSave();
  if (typeof raw !== 'object' || raw == null) return d;
  const v = raw as Record<string, unknown>;
  if (v.version !== SAVE_VERSION) return d; // future migrations go here
  const upgrades = numRecord(v.upgrades, PERMANENT_UPGRADES.map((u) => u.id), 0, 99);
  for (const u of PERMANENT_UPGRADES) if (upgrades[u.id] != null) upgrades[u.id] = Math.floor(Math.min(u.maxRank, upgrades[u.id]));
  const s = (typeof v.stats === 'object' && v.stats) ? (v.stats as Record<string, unknown>) : {};
  const stats = { ...DEFAULT_STATS };
  for (const k of Object.keys(DEFAULT_STATS) as (keyof LifetimeStats)[]) stats[k] = num(s[k], 0, 0, 1e12);
  return {
    version: SAVE_VERSION,
    currency: Math.floor(num(v.currency, 0, 0, 1e9)),
    upgrades,
    purchasedAnyUpgrade: bool(v.purchasedAnyUpgrade, false),
    achievements: numRecord(v.achievements, Object.keys(ACHIEVEMENT_MAP), 0, 1e15),
    stats,
    characterRuns: numRecord(v.characterRuns, CHARACTERS.map((c) => c.id), 0, 1e9),
    bestTimeByMap: numRecord(v.bestTimeByMap, MAPS.map((m) => m.id), 0, 1e9),
    discovered: Array.isArray(v.discovered) ? v.discovered.filter((x): x is string => typeof x === 'string').slice(0, 500) : [],
    selectedCharacter: oneOf(v.selectedCharacter, CHARACTERS.map((c) => c.id), 'bonker'),
    selectedMap: oneOf(v.selectedMap, MAPS.map((m) => m.id), 'forest'),
    selectedMode: oneOf(v.selectedMode, ['standard', 'practice', 'endless'] as const, 'standard'),
  };
}

let saveWritable = true;

function loadSave(): SaveData {
  const r = readJSON(SAVE_KEY);
  if (r.ok) return validateSave(r.value);
  // Storage temporarily unavailable: play with defaults but never overwrite the real save.
  if (r.reason === 'unavailable') saveWritable = false;
  return defaultSave();
}

interface ProgressionStore {
  save: SaveData;
  persist: () => void;
  update: (fn: (s: SaveData) => void) => void;
  buyUpgrade: (id: string) => boolean;
  resetProgress: () => void;
  unlockAchievement: (id: string) => boolean;
  markDiscovered: (ids: string[]) => void;
}

export const useProgression = create<ProgressionStore>((set, get) => ({
  save: loadSave(),
  persist: () => {
    if (saveWritable) writeJSON(SAVE_KEY, get().save);
  },
  update: (fn) => {
    const next = structuredClone(get().save);
    fn(next);
    set({ save: next });
    get().persist();
  },
  buyUpgrade: (id) => {
    const def = PERMANENT_UPGRADES.find((u) => u.id === id);
    if (!def) return false;
    const rank = get().save.upgrades[id] ?? 0;
    if (rank >= def.maxRank) return false;
    const cost = upgradeCost(def, rank);
    if (get().save.currency < cost) return false;
    get().update((s) => {
      s.currency -= cost;
      s.upgrades[id] = rank + 1;
      s.purchasedAnyUpgrade = true;
    });
    return true;
  },
  resetProgress: () => {
    removeKey(SAVE_KEY);
    saveWritable = true;
    set({ save: defaultSave() });
    get().persist();
  },
  unlockAchievement: (id) => {
    if (!ACHIEVEMENT_MAP[id] || get().save.achievements[id]) return false;
    get().update((s) => {
      s.achievements[id] = Date.now();
      s.currency += ACHIEVEMENT_MAP[id].reward;
      s.stats.totalCurrency += ACHIEVEMENT_MAP[id].reward;
    });
    return true;
  },
  markDiscovered: (ids) => {
    const cur = new Set(get().save.discovered);
    const fresh = ids.filter((i) => !cur.has(i));
    if (fresh.length) get().update((s) => { s.discovered.push(...fresh); });
  },
}));

export const getSave = () => useProgression.getState().save;

export function isUnlocked(unlock: string | undefined, save: SaveData = getSave()): boolean {
  return !unlock || !!save.achievements[unlock];
}

export function isWeaponUnlocked(id: WeaponId, save: SaveData = getSave()): boolean {
  return isUnlocked(WEAPON_MAP[id].unlock, save);
}

export function favoriteCharacter(save: SaveData): string {
  let best = '';
  let bestN = 0;
  for (const [id, n] of Object.entries(save.characterRuns)) if (n > bestN) { best = id; bestN = n; }
  return best ? CHARACTERS.find((c) => c.id === best)?.name ?? '—' : '—';
}
