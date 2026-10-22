import type { GameState } from '../types';

const KEY = 'lib-save-v1';
const BACKUP = 'lib-save-v1-backup';
export const SAVE_VERSION = 1;

export function hasSave(): boolean {
  try {
    return !!readRaw(KEY) || !!readRaw(BACKUP);
  } catch {
    return false;
  }
}

function readRaw(key: string): GameState | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.cash !== 'number' || typeof parsed.day !== 'number') return null;
    return parsed as GameState;
  } catch {
    return null;
  }
}

/** Loads the save, merging over defaults so missing/older fields never crash the game. */
export function loadSave(defaults: GameState): GameState | null {
  const raw = readRaw(KEY) ?? readRaw(BACKUP);
  if (!raw) return null;
  const merged: GameState = { ...defaults };
  for (const k of Object.keys(defaults) as (keyof GameState)[]) {
    const v = raw[k];
    const dv = defaults[k];
    if (v === undefined || v === null) {
      if (dv === null) (merged as unknown as Record<string, unknown>)[k] = v ?? null;
      continue;
    }
    if (dv !== null && typeof dv !== typeof v) continue;
    if (Array.isArray(dv) !== Array.isArray(v)) continue;
    if (dv && typeof dv === 'object' && !Array.isArray(dv)) {
      (merged as unknown as Record<string, unknown>)[k] = { ...(dv as object), ...(v as object) };
    } else {
      (merged as unknown as Record<string, unknown>)[k] = v;
    }
  }
  if (!Number.isFinite(merged.cash)) merged.cash = defaults.cash;
  if (!merged.vehicles.includes('maybach')) merged.vehicles = ['maybach', ...merged.vehicles];
  if (!merged.vehicles.includes(merged.activeVehicle)) merged.activeVehicle = 'maybach';
  merged.version = SAVE_VERSION;
  return merged;
}

export function writeSave(state: GameState): boolean {
  try {
    const json = JSON.stringify(state);
    const prev = localStorage.getItem(KEY);
    if (prev) localStorage.setItem(BACKUP, prev);
    localStorage.setItem(KEY, json);
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(BACKUP);
  } catch {
    /* ignore */
  }
}
