// Keyboard + mouse with pointer lock. `pressed` holds keys that went down this frame.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { dx: 0, dy: 0, lmb: false, rmb: false, lmbPressed: false, wheel: 0 };
    this.locked = false;
    this.onKey = null;
    this.onLockChange = null;

    window.addEventListener('keydown', (e) => {
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'Backquote'].includes(e.code)) e.preventDefault();
      if (e.code === 'KeyF' && e.ctrlKey) return;
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
      this.onKey?.(e.code, e);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.lmb = this.mouse.rmb = false; });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) { this.mouse.lmb = true; this.mouse.lmbPressed = true; }
      if (e.button === 2) this.mouse.rmb = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.lmb = false;
      if (e.button === 2) this.mouse.rmb = false;
    });
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
      if (!this.locked) { this.mouse.lmb = this.mouse.rmb = false; }
      this.onLockChange?.(this.locked);
    });
  }

  lock() {
    if (this.locked) return;
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: false });
      if (p && p.catch) p.catch(() => this.canvas.requestPointerLock());
    } catch (e) { this.canvas.requestPointerLock(); }
  }

  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }

  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }

  endFrame() {
    this.pressed.clear();
    this.mouse.dx = this.mouse.dy = 0;
    this.mouse.lmbPressed = false;
    this.mouse.wheel = 0;
  }
}
