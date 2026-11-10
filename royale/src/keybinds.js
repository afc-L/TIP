// Rebindable controls. Each action has up to two bindings: keyboard codes (KeyboardEvent.code)
// or mouse buttons written as "Mouse0" (left), "Mouse1" (middle), "Mouse2" (right), "Mouse3"/"Mouse4" (side).

export const ACTIONS = [
  { group: 'Movement', id: 'forward', label: 'Move forward', def: ['KeyW', 'ArrowUp'] },
  { group: 'Movement', id: 'back', label: 'Move back', def: ['KeyS', 'ArrowDown'] },
  { group: 'Movement', id: 'left', label: 'Move left', def: ['KeyA', 'ArrowLeft'] },
  { group: 'Movement', id: 'right', label: 'Move right', def: ['KeyD', 'ArrowRight'] },
  { group: 'Movement', id: 'sprint', label: 'Sprint', def: ['ShiftLeft', ''] },
  { group: 'Movement', id: 'jump', label: 'Jump / mantle / glider', def: ['Space', ''] },
  { group: 'Movement', id: 'crouch', label: 'Crouch / slide', def: ['KeyQ', 'ControlLeft'] },
  { group: 'Combat', id: 'fire', label: 'Fire / place / use', def: ['Mouse0', ''] },
  { group: 'Combat', id: 'aim', label: 'Aim down sights', def: ['Mouse2', ''] },
  { group: 'Combat', id: 'reload', label: 'Reload', def: ['KeyR', ''] },
  { group: 'Combat', id: 'pickaxe', label: 'Harvesting tool', def: ['KeyF', ''] },
  { group: 'Combat', id: 'slot1', label: 'Slot 1', def: ['Digit1', ''] },
  { group: 'Combat', id: 'slot2', label: 'Slot 2', def: ['Digit2', ''] },
  { group: 'Combat', id: 'slot3', label: 'Slot 3', def: ['Digit3', ''] },
  { group: 'Combat', id: 'slot4', label: 'Slot 4', def: ['Digit4', ''] },
  { group: 'Combat', id: 'slot5', label: 'Slot 5', def: ['Digit5', ''] },
  { group: 'Building', id: 'wall', label: 'Build wall', def: ['KeyZ', ''] },
  { group: 'Building', id: 'floor', label: 'Build floor', def: ['KeyX', ''] },
  { group: 'Building', id: 'ramp', label: 'Build ramp', def: ['KeyC', ''] },
  { group: 'Building', id: 'roof', label: 'Build roof', def: ['KeyV', ''] },
  { group: 'Building', id: 'buildMode', label: 'Toggle build mode', def: ['KeyB', ''] },
  { group: 'Building', id: 'material', label: 'Switch material (build mode)', def: ['KeyR', ''] },
  { group: 'Building', id: 'edit', label: 'Edit / confirm edit', def: ['KeyG', ''] },
  { group: 'Other', id: 'interact', label: 'Pick up / open / repair', def: ['KeyE', ''] },
  { group: 'Other', id: 'drop', label: 'Drop held item', def: ['KeyK', ''] },
  { group: 'Other', id: 'emote', label: 'Emote', def: ['KeyT', ''] },
  { group: 'Other', id: 'map', label: 'Map', def: ['KeyM', 'Tab'] },
];

// Pairs that may share a key because they never apply at the same time
const SHAREABLE = [['reload', 'material']];
export const canShare = (a, b) => SHAREABLE.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

export function defaultBinds() {
  const o = {};
  for (const a of ACTIONS) o[a.id] = a.def.slice();
  return o;
}

export function normalizeBinds(saved) {
  const d = defaultBinds();
  if (!saved || typeof saved !== 'object') return d;
  for (const a of ACTIONS) {
    const v = saved[a.id];
    if (Array.isArray(v)) d[a.id] = [v[0] || '', v[1] || ''];
  }
  return d;
}

const NAMES = {
  Mouse0: 'LMB', Mouse1: 'MMB', Mouse2: 'RMB', Mouse3: 'Mouse 4', Mouse4: 'Mouse 5',
  Space: 'Space', ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl',
  AltLeft: 'L-Alt', AltRight: 'R-Alt', MetaLeft: 'L-Cmd', MetaRight: 'R-Cmd', CapsLock: 'Caps', Tab: 'Tab',
  Enter: 'Enter', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\',
  Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
};
export function codeName(code) {
  if (!code) return '—';
  if (NAMES[code]) return NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  return code;
}
// "Z" or "Q / L-Ctrl" for prompts
export function actionLabel(binds, id, both = false) {
  const b = (binds && binds[id]) || [];
  const names = b.filter(Boolean).map(codeName);
  if (!names.length) return 'unbound';
  return both ? names.join(' / ') : names[0];
}
