// Keyboard/mouse input with remappable actions and pointer lock.
import { profile } from './save.js';

const down = new Set();
const pressed = new Set();
const mouse = { dx: 0, dy: 0, buttons: [false, false, false], clicked: [false, false, false], wheel: 0 };
let canvas = null;
let captureCb = null; // key-remap capture callback

export const Input = {
  init(c) {
    canvas = c;
    window.addEventListener('keydown', (e) => {
      if (captureCb) { e.preventDefault(); const cb = captureCb; captureCb = null; cb(e.code); return; }
      if (e.code === 'Tab' || e.code === 'Space' || (e.code.startsWith('Arrow') && Input.locked())) e.preventDefault();
      if (!down.has(e.code)) pressed.add(e.code);
      down.add(e.code);
    });
    window.addEventListener('keyup', (e) => { down.delete(e.code); });
    window.addEventListener('blur', () => { down.clear(); mouse.buttons = [false, false, false]; });
    window.addEventListener('mousemove', (e) => {
      if (Input.locked() || (Input.freeLook && e.target === canvas)) { mouse.dx += e.movementX; mouse.dy += e.movementY; }
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button < 3) { mouse.buttons[e.button] = true; mouse.clicked[e.button] = true; }
    });
    window.addEventListener('mouseup', (e) => { if (e.button < 3) mouse.buttons[e.button] = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('wheel', (e) => { mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
  },
  locked() { return document.pointerLockElement === canvas; },
  freeLook: false,
  lock() {
    if (!canvas || Input.locked()) return;
    const fail = () => {
      // Mouse capture refused (embedded frame, browser policy): aim with normal mouse movement instead.
      if (!Input.freeLook) { Input.freeLook = true; document.dispatchEvent(new Event('maz-freelook')); }
    };
    try {
      const p = canvas.requestPointerLock();
      if (p && p.catch) p.catch(fail);
    } catch (e) { fail(); }
  },
  unlock() { if (Input.locked()) document.exitPointerLock(); },
  key(code) { return down.has(code); },
  /** action is held */
  held(action) { const c = profile.settings.keys[action]; return c ? down.has(c) || (action === 'sprint' && down.has('ShiftRight')) : false; },
  /** action pressed this frame */
  hit(action) { const c = profile.settings.keys[action]; return c ? pressed.has(c) : false; },
  codeHit(code) { return pressed.has(code); },
  mouseDown(b) { return mouse.buttons[b]; },
  mouseClicked(b) { return mouse.clicked[b]; },
  consumeMouse() { const r = { dx: mouse.dx, dy: mouse.dy, wheel: mouse.wheel }; mouse.dx = 0; mouse.dy = 0; mouse.wheel = 0; return r; },
  endFrame() { pressed.clear(); mouse.clicked = [false, false, false]; },
  clearAll() { down.clear(); pressed.clear(); mouse.buttons = [false, false, false]; mouse.dx = mouse.dy = 0; },
  captureNextKey(cb) { captureCb = cb; },
};

export function keyName(code) {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map = { Space: 'Space', ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl', AltLeft: 'L-Alt', AltRight: 'R-Alt', Tab: 'Tab', CapsLock: 'Caps', Backquote: '`', Escape: 'Esc' };
  return map[code] || code;
}
