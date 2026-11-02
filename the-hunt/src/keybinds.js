// Rebindable controls. Each action has a main and a backup binding; a binding is a
// KeyboardEvent.code ('KeyW', 'ShiftLeft', ...) or a mouse button ('Mouse0'..'Mouse4').

const STORE = 'thehunt_keybinds_v1';

export const ACTIONS = [
  { id: 'forward', label: 'Move forward', def: ['KeyW', 'ArrowUp'], group: 'Movement' },
  { id: 'back', label: 'Move back', def: ['KeyS', 'ArrowDown'], group: 'Movement' },
  { id: 'left', label: 'Move left', def: ['KeyA', 'ArrowLeft'], group: 'Movement' },
  { id: 'right', label: 'Move right', def: ['KeyD', 'ArrowRight'], group: 'Movement' },
  { id: 'sprint', label: 'Sprint · steady aim', def: ['ShiftLeft', null], group: 'Movement' },
  { id: 'crouch', label: 'Crouch', def: ['KeyC', 'ControlLeft'], group: 'Movement' },
  { id: 'jump', label: 'Jump', def: ['Space', null], group: 'Movement' },
  { id: 'fire', label: 'Fire', def: ['Mouse0', null], group: 'Hunting' },
  { id: 'aim', label: 'Aim / zoom', def: ['Mouse2', null], group: 'Hunting' },
  { id: 'reload', label: 'Reload', def: ['KeyR', null], group: 'Hunting' },
  { id: 'flashlight', label: 'Flashlight', def: ['KeyF', null], group: 'Hunting' },
  { id: 'rifle', label: 'Rifle', def: ['Digit1', null], group: 'Hunting' },
  { id: 'binoculars', label: 'Binoculars', def: ['Digit2', 'KeyB'], group: 'Hunting' },
  { id: 'radio', label: 'Radio', def: ['Digit3', null], group: 'Hunting' },
  { id: 'interact', label: 'Interact', def: ['KeyE', null], group: 'Survival' },
  { id: 'eat', label: 'Eat', def: ['KeyQ', null], group: 'Survival' },
  { id: 'medkit', label: 'First aid', def: ['KeyH', null], group: 'Survival' },
  { id: 'inventory', label: 'Backpack', def: ['Tab', 'KeyI'], group: 'Survival' },
  { id: 'map', label: 'Map', def: ['KeyM', null], group: 'Survival' },
];

const NAMES = {
  Mouse0: 'LMB', Mouse1: 'MMB', Mouse2: 'RMB', Mouse3: 'Mouse 4', Mouse4: 'Mouse 5',
  ShiftLeft: 'Shift', ShiftRight: 'R-Shift', ControlLeft: 'Ctrl', ControlRight: 'R-Ctrl', AltLeft: 'Alt', AltRight: 'R-Alt',
  MetaLeft: 'Cmd', MetaRight: 'R-Cmd', Space: 'Space', Tab: 'Tab', Enter: 'Enter', CapsLock: 'Caps',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backquote: '`', Minus: '-', Equal: '=',
  BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\',
};

export function keyName(code) {
  if (!code) return '—';
  if (NAMES[code]) return NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  return code;
}

class Keybinds {
  constructor() {
    this.map = {};
    this.reset(false);
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (saved) for (const a of ACTIONS) if (Array.isArray(saved[a.id])) this.map[a.id] = [saved[a.id][0] ?? null, saved[a.id][1] ?? null];
    } catch (e) { /* storage blocked: defaults */ }
  }

  reset(save = true) {
    for (const a of ACTIONS) this.map[a.id] = [...a.def];
    if (save) this.save();
  }

  save() { try { localStorage.setItem(STORE, JSON.stringify(this.map)); } catch (e) { /* ignore */ } }

  /** Assign code to action slot; the same code is removed from any other action. */
  set(action, slot, code) {
    if (code) for (const id in this.map) this.map[id] = this.map[id].map((c) => (c === code ? null : c));
    this.map[action][slot] = code;
    this.save();
  }

  matches(action, code) { const b = this.map[action]; return !!code && !!b && (b[0] === code || b[1] === code); }
  codes(action) { return (this.map[action] || []).filter(Boolean); }
  isBound(code) { for (const id in this.map) if (this.map[id].includes(code)) return true; return false; }

  /** Display name for HUD hints: the main binding, or the backup if the main is empty. */
  name(action) {
    const b = this.map[action] || [];
    return keyName(b[0] || b[1]);
  }
}

export const binds = new Keybinds();
export const K = (action) => binds.name(action);
