// Keyboard + mouse state with short input buffering for responsive combat.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Map(); // action -> time pressed (buffer)
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.locked = false;
    this.enabled = false;
    this.onKey = null; // callback(code, event) for menu-level keys

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (this.onKey && this.onKey(e.code, e)) return;
      if (e.repeat) return;
      this.keys.add(e.code);
      const act = KEYMAP[e.code];
      if (act && this.enabled) this.press(act);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (e.button === 0) this.press('light');
      else if (e.button === 2) this.press('heavy');
      else if (e.button === 1) { e.preventDefault(); this.press('lock'); }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      // Without pointer lock we still rotate when the mouse moves over the canvas.
      if (this.locked || e.target === canvas) {
        this.mouseDX += e.movementX || 0;
        this.mouseDY += e.movementY || 0;
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
  }

  press(action) { this.pressed.set(action, performance.now()); }

  // Returns true if the action was pressed within the buffer window, and consumes it.
  consume(action, windowMs = 260) {
    const t = this.pressed.get(action);
    if (t === undefined) return false;
    if (performance.now() - t > windowMs) { this.pressed.delete(action); return false; }
    this.pressed.delete(action);
    return true;
  }

  peek(action, windowMs = 260) {
    const t = this.pressed.get(action);
    return t !== undefined && performance.now() - t <= windowMs;
  }

  down(code) { return this.keys.has(code); }

  clearActions() { this.pressed.clear(); }

  takeMouse() {
    const dx = this.mouseDX, dy = this.mouseDY;
    this.mouseDX = 0; this.mouseDY = 0;
    return [dx, dy];
  }

  requestLock() {
    if (document.pointerLockElement === this.canvas) return;
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* pointer lock not available: mouse-over fallback still works */ }
  }

  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }
}

const KEYMAP = {
  Space: 'roll',
  KeyE: 'interact',
  KeyQ: 'heal',
  KeyF: 'lock',
  Digit1: 'item1',
  Digit2: 'item2',
  Digit3: 'item3',
};
