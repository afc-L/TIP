import { create } from 'zustand';
import type { Difficulty } from '../data/types';
import { bool, num, oneOf, readJSON, writeJSON } from './storage';

export type Quality = 'low' | 'medium' | 'high';

export interface Settings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  screenShake: boolean;
  damageNumbers: boolean;
  quality: Quality;
  cameraDistance: number;   // 0..1
  cameraSmoothing: number;  // 0..1
  mouseAim: boolean;
  difficulty: Difficulty;
  reducedEffects: boolean;
  showFps: boolean;
}

const KEY = 'bonked_beyond_settings_v1';

export const DEFAULT_SETTINGS: Settings = {
  masterVolume: 0.8, musicVolume: 0.5, sfxVolume: 0.7, muted: false,
  screenShake: true, damageNumbers: true, quality: 'medium',
  cameraDistance: 0.5, cameraSmoothing: 0.5, mouseAim: true,
  difficulty: 'normal', reducedEffects: false, showFps: false,
};

function load(): Settings {
  const r = readJSON(KEY);
  if (!r.ok || typeof r.value !== 'object' || r.value == null) return { ...DEFAULT_SETTINGS };
  const v = r.value as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  return {
    masterVolume: num(v.masterVolume, d.masterVolume, 0, 1),
    musicVolume: num(v.musicVolume, d.musicVolume, 0, 1),
    sfxVolume: num(v.sfxVolume, d.sfxVolume, 0, 1),
    muted: bool(v.muted, d.muted),
    screenShake: bool(v.screenShake, d.screenShake),
    damageNumbers: bool(v.damageNumbers, d.damageNumbers),
    quality: oneOf(v.quality, ['low', 'medium', 'high'] as const, d.quality),
    cameraDistance: num(v.cameraDistance, d.cameraDistance, 0, 1),
    cameraSmoothing: num(v.cameraSmoothing, d.cameraSmoothing, 0, 1),
    mouseAim: bool(v.mouseAim, d.mouseAim),
    difficulty: oneOf(v.difficulty, ['easy', 'normal', 'hard'] as const, d.difficulty),
    reducedEffects: bool(v.reducedEffects, d.reducedEffects),
    showFps: bool(v.showFps, d.showFps),
  };
}

interface SettingsStore extends Settings {
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  reset: () => void;
}

export const useSettings = create<SettingsStore>((set, get) => ({
  ...load(),
  set: (key, value) => {
    set({ [key]: value } as Partial<SettingsStore>);
    persist(get());
  },
  reset: () => {
    set({ ...DEFAULT_SETTINGS });
    persist(get());
  },
}));

function persist(s: SettingsStore) {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(DEFAULT_SETTINGS)) out[k] = s[k as keyof Settings];
  writeJSON(KEY, out);
}

export const getSettings = (): Settings => useSettings.getState();
