// Persisted settings and graphics presets.

export const PRESETS = {
  medium: { label: 'Medium', pixelCap: 1.5, scale: 1.0, shadows: true, viewDist: 95, deco: 1.0, particles: 260, grass: true },
  low: { label: 'Low', pixelCap: 1.0, scale: 1.0, shadows: false, viewDist: 70, deco: 0.6, particles: 160, grass: true },
  verylow: { label: 'Very Low', pixelCap: 1.0, scale: 0.6, shadows: false, viewDist: 50, deco: 0.3, particles: 80, grass: false },
};

const DEFAULTS = {
  preset: 'low',
  renderScale: 1.0,
  shadows: false,
  autoAdjust: true,
  master: 0.8,
  music: 0.5,
  sfx: 0.8,
  muted: false,
  sensitivity: 1.0,
  invertY: false,
  showFps: false,
  showControls: true,
};

const KEY = 'eldenbling.settings.v1';

export function loadSettings() {
  let s = { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) s = { ...s, ...JSON.parse(raw) };
  } catch (e) { /* storage unavailable: use defaults */ }
  if (!PRESETS[s.preset]) s.preset = 'low';
  return s;
}

export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
}

export function applyPreset(s, name) {
  const p = PRESETS[name];
  s.preset = name;
  s.renderScale = p.scale;
  s.shadows = p.shadows;
}

const SAVE_KEY = 'eldenbling.save.v1';

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function saveGame(data) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch (e) { return false; }
}

export function clearGame() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}
