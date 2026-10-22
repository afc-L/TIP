import { create } from 'zustand';
import type { Settings } from './types';

const KEY = 'lib-settings-v1';

export const DEFAULT_SETTINGS: Settings = {
  quality: 'medium',
  shadows: true,
  renderScale: 1,
  fov: 65,
  masterVolume: 0.8,
  musicVolume: 0.5,
  sfxVolume: 0.8,
  vehicleFxVolume: 0.7,
  mouseSensitivity: 1,
  invertY: false,
  showMinimap: true,
  rotateMinimap: true,
  dayLengthMinutes: 12,
  showFps: false,
  trafficDensity: 1,
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_SETTINGS };
    const out = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
    for (const k of Object.keys(DEFAULT_SETTINGS)) {
      const dv = (DEFAULT_SETTINGS as unknown as Record<string, unknown>)[k];
      if (typeof parsed[k] === typeof dv) out[k] = parsed[k];
    }
    return out as unknown as Settings;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

interface SettingsStore {
  s: Settings;
  set: (patch: Partial<Settings>) => void;
  reset: () => void;
}

export const useSettings = create<SettingsStore>()((set, get) => ({
  s: load(),
  set: (patch) => {
    const s = { ...get().s, ...patch };
    set({ s });
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* storage unavailable */
    }
  },
  reset: () => get().set({ ...DEFAULT_SETTINGS }),
}));
