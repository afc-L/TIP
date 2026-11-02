import { binds } from './keybinds.js';

// Keyboard + mouse with pointer lock. Mouse buttons are tracked as codes 'Mouse0'..'Mouse4'
// alongside keyboard codes, so any action can be bound to either.
// `pressed` holds codes that went down this frame.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { dx: 0, dy: 0, wheel: 0 };
    this.locked = false;
    this.onKey = null;
    this.onLockChange = null;
    this.capture = null; // when set, the next key / mouse button is handed to it (rebinding)

    window.addEventListener('keydown', (e) => {
      if (this.capture) {
        e.preventDefault();
        e.stopPropagation();
        const cb = this.capture;
        this.capture = null;
        cb(e.code);
        return;
      }
      if (this.locked && (['Tab', 'Space', 'Backquote', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) || binds.isBound(e.code))) e.preventDefault();
      if (e.code === 'Tab') e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (!e.repeat) this.onKey?.(e.code, e);
    }, true);
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); });
    window.addEventListener('mousedown', (e) => {
      const code = 'Mouse' + e.button;
      if (this.capture) {
        e.preventDefault();
        e.stopPropagation();
        const cb = this.capture;
        this.capture = null;
        this.swallowClick = e.button === 0 ? performance.now() : 0;
        cb(code);
        return;
      }
      if (!this.locked) return;
      this.pressed.add(code);
      this.keys.add(code);
      this.onKey?.(code, e);
    }, true);
    // the click that follows a captured left-button press must not trigger the button under it
    window.addEventListener('click', (e) => { if (this.swallowClick && performance.now() - this.swallowClick < 600) { e.preventDefault(); e.stopPropagation(); } this.swallowClick = 0; }, true);
    window.addEventListener('mouseup', (e) => this.keys.delete('Mouse' + e.button));
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      // guard against the occasional giant jump some browsers report on lock
      if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
      this.mouse.dx += e.movementX;
      this.mouse.dy += e.movementY;
    });
    window.addEventListener('wheel', (e) => { if (this.locked) this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) for (const k of [...this.keys]) if (k.startsWith('Mouse')) this.keys.delete(k);
      this.onLockChange?.(this.locked);
    });
  }

  lock() {
    if (this.locked) return;
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: false });
      if (p && p.catch) p.catch(() => { try { this.canvas.requestPointerLock(); } catch (e) { /* refused */ } });
    } catch (e) { try { this.canvas.requestPointerLock(); } catch (e2) { /* refused */ } }
  }

  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }

  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }
  /** Is a bound action held / was it pressed this frame? */
  act(action) { return binds.codes(action).some((c) => this.keys.has(c)); }
  actHit(action) { return binds.codes(action).some((c) => this.pressed.has(c)); }

  endFrame() {
    this.pressed.clear();
    this.mouse.dx = this.mouse.dy = 0;
    this.mouse.wheel = 0;
  }
}
