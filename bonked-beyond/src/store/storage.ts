// Safe LocalStorage access. If storage is unavailable we never overwrite anything.

let storageBroken = false;

export function readJSON(key: string): { ok: true; value: unknown } | { ok: false; reason: 'missing' | 'corrupt' | 'unavailable' } {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    storageBroken = true;
    return { ok: false, reason: 'unavailable' };
  }
  if (raw == null) return { ok: false, reason: 'missing' };
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    // Keep the unreadable save around so nothing is lost silently.
    try { window.localStorage.setItem(key + '_corrupt_backup', raw); } catch { /* ignore */ }
    return { ok: false, reason: 'corrupt' };
  }
}

export function writeJSON(key: string, value: unknown): boolean {
  if (storageBroken) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string) {
  try { window.localStorage.removeItem(key); } catch { /* ignore */ }
}

export const num = (v: unknown, def: number, lo = -Infinity, hi = Infinity): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def;
export const bool = (v: unknown, def: boolean): boolean => (typeof v === 'boolean' ? v : def);
export const oneOf = <T extends string>(v: unknown, opts: readonly T[], def: T): T =>
  typeof v === 'string' && (opts as readonly string[]).includes(v) ? (v as T) : def;
