import { create } from 'zustand';
import { canTransition, type GameScreen, type MenuPage } from '../app/gameState';
import type { Rarity } from '../data/types';

export interface HudItem { id: string; icon: string; level: number; max: number; color: string; evolved?: boolean }

export interface HudSnapshot {
  hp: number;
  maxHp: number;
  shield: number;
  xp: number;
  xpNext: number;
  level: number;
  time: number;
  kills: number;
  gold: number;
  weapons: HudItem[];
  passives: HudItem[];
  dodgeReady: number;   // 0..1
  superCharge: number;  // 0..1
  stamina: number;      // 0..1
  buffs: { id: string; icon: string; left: number }[];
  fps: number;
  enemies: number;
}

export interface BossBar { name: string; title: string; hp: number; maxHp: number; enraged: boolean }

export interface UpgradeCard {
  key: string;
  icon: string;
  name: string;
  rarity: Rarity;
  kindLabel: string;
  description: string;
  levelText: string;
  effectText: string;
  color: string;
}

export interface RunResult {
  victory: boolean;
  character: string;
  characterId: string;
  map: string;
  mode: string;
  difficulty: string;
  time: number;
  kills: number;
  elites: number;
  level: number;
  bosses: number;
  gold: number;
  currency: number;
  damageDealt: number;
  damageTaken: number;
  highestHit: number;
  weapons: { icon: string; name: string; level: number; evolved: boolean }[];
  passives: { icon: string; name: string; level: number }[];
  bestTime: number;
  previousBest: number;
  newRecord: boolean;
  achievements: { icon: string; name: string }[];
}

export interface Toast { id: number; icon: string; title: string; text: string; kind: 'achievement' | 'info' | 'evolution' }

interface GameStore {
  screen: GameScreen;
  menuPage: MenuPage;
  hud: HudSnapshot | null;
  boss: BossBar | null;
  announcement: { id: number; text: string; big: boolean } | null;
  levelUp: { cards: UpgradeCard[]; rerolls: number; level: number; pending: number } | null;
  bossIntro: { name: string; title: string } | null;
  result: RunResult | null;
  interact: string | null;
  toasts: Toast[];
  transition: (to: GameScreen) => boolean;
  setMenuPage: (p: MenuPage) => void;
  announce: (text: string, big?: boolean) => void;
  toast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
}

let nextId = 1;

export const useGame = create<GameStore>((set, get) => ({
  screen: 'MAIN_MENU',
  menuPage: 'home',
  hud: null,
  boss: null,
  announcement: null,
  levelUp: null,
  bossIntro: null,
  result: null,
  interact: null,
  toasts: [],
  transition: (to) => {
    const from = get().screen;
    if (from === to) return true;
    if (!canTransition(from, to)) {
      console.warn(`[state] rejected transition ${from} -> ${to}`);
      return false;
    }
    set({ screen: to });
    return true;
  },
  setMenuPage: (p) => set({ menuPage: p }),
  announce: (text, big = false) => set({ announcement: { id: nextId++, text, big } }),
  toast: (t) => {
    const id = nextId++;
    set({ toasts: [...get().toasts.slice(-3), { ...t, id }] });
    setTimeout(() => get().dismissToast(id), 4200);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const gameStore = () => useGame.getState();
