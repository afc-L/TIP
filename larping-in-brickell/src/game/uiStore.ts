import { create } from 'zustand';

// Transient UI + runtime state (never saved).

export type Screen = 'menu' | 'loading' | 'game';
export type Panel =
  | null
  | 'pause'
  | 'settings'
  | 'phone'
  | 'map'
  | 'maybach'
  | 'dealer'
  | 'watch'
  | 'clothes'
  | 'garage'
  | 'home'
  | 'dialogue'
  | 'event'
  | 'report'
  | 'club'
  | 'marina'
  | 'inspect'
  | 'property'
  | 'finale'
  | 'venue';

export interface Toast {
  id: number;
  text: string;
  kind: 'cash' | 'clout' | 'info' | 'warn' | 'achievement' | 'mission' | 'bad';
  t: number;
}

export interface DialogueState {
  kind: 'creator' | 'rival' | 'contact' | 'npc';
  id: string;
}

export interface EventSession {
  eventId: string;
}

export interface EventResultView {
  title: string;
  score: number;
  cash: number;
  clout: number;
  win: boolean;
  text: string;
}

export interface Runtime {
  mode: 'foot' | 'car' | 'boat';
  speed: number; // km/h
  gear: string;
  x: number;
  z: number;
  heading: number; // radians, yaw
  camHeading: number;
  interior: string | null;
  prompt: string | null;
  bounceActive: boolean;
  bounceLimited: boolean;
  bounceLevel: number; // live displacement 0..1 for HUD meter
  vehicleId: string;
  fps: number;
  zone: string | null;
  minigame: MinigameHud | null;
  drunk: number;
}

export interface MinigameHud {
  title: string;
  timeLeft: number;
  score: number;
  lines: { text: string; done?: boolean; active?: boolean }[];
  call?: string;
  hint?: string;
}

interface UIState {
  screen: Screen;
  panel: Panel;
  panelArg: string | null;
  phoneApp: string | null;
  toasts: Toast[];
  dialogue: DialogueState | null;
  event: EventSession | null;
  eventResult: EventResultView | null;
  rt: Runtime;
  waypoint: { x: number; z: number; label: string } | null;
  loading: { progress: number; label: string };
  bubbles: { id: number; text: string; x: number; y: number; visible: boolean }[];
  setScreen: (s: Screen) => void;
  open: (p: Panel, arg?: string | null) => void;
  close: () => void;
  setPhoneApp: (a: string | null) => void;
  notify: (text: string, kind?: Toast['kind']) => void;
  dismissToast: (id: number) => void;
  setRt: (r: Partial<Runtime>) => void;
  setWaypoint: (w: UIState['waypoint']) => void;
  setLoading: (progress: number, label: string) => void;
  startDialogue: (d: DialogueState) => void;
  startEvent: (eventId: string) => void;
}

let toastId = 1;

export const useUI = create<UIState>()((set, get) => ({
  screen: 'menu',
  panel: null,
  panelArg: null,
  phoneApp: null,
  toasts: [],
  dialogue: null,
  event: null,
  eventResult: null,
  waypoint: null,
  loading: { progress: 0, label: '' },
  bubbles: [],
  rt: {
    mode: 'foot', speed: 0, gear: 'P', x: 0, z: 0, heading: 0, camHeading: 0, interior: null, prompt: null,
    bounceActive: false, bounceLimited: false, bounceLevel: 0, vehicleId: 'maybach', fps: 0, zone: null, minigame: null, drunk: 0,
  },
  setScreen: (screen) => set({ screen }),
  open: (panel, arg = null) => set({ panel, panelArg: arg }),
  close: () => set({ panel: null, panelArg: null, dialogue: null, event: null, eventResult: null }),
  setPhoneApp: (phoneApp) => set({ phoneApp }),
  notify: (text, kind = 'info') => {
    const t: Toast = { id: toastId++, text, kind, t: performance.now() };
    const toasts = [...get().toasts, t].slice(-6);
    set({ toasts });
    setTimeout(() => get().dismissToast(t.id), kind === 'achievement' || kind === 'mission' ? 6000 : 4200);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  setRt: (r) => set({ rt: { ...get().rt, ...r } }),
  setWaypoint: (waypoint) => set({ waypoint }),
  setLoading: (progress, label) => set({ loading: { progress, label } }),
  startDialogue: (d) => set({ dialogue: d, panel: 'dialogue' }),
  startEvent: (eventId) => set({ event: { eventId }, eventResult: null, panel: 'event' }),
}));

export const notify = (text: string, kind?: Toast['kind']) => useUI.getState().notify(text, kind);
