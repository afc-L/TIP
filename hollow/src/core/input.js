// Keyboard + mouse with pointer lock. Holds raw state only; the monster controller
// reads it every frame (the player is always the sole source of the monster's actions).
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.mouseDX = 0; this.mouseDY = 0; this.wheel = 0;
    this.buttons = new Set(); this.bPressed = new Set(); this.bReleased = new Set();
    this.locked = false;
    this.sensitivity = 1; this.invertY = false;
    this.enabled = false;
    addEventListener('keydown', (e) => {
      if (e.code === 'Tab' || e.code === 'Space' || (e.code.startsWith('Arrow'))) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => { this.keys.delete(e.code); this.released.add(e.code); });
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      // clamp absurd spikes some browsers produce on lock
      const dx = Math.max(-300, Math.min(300, e.movementX)), dy = Math.max(-300, Math.min(300, e.movementY));
      this.mouseDX += dx; this.mouseDY += dy;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked && this.enabled) { this.lock(); return; }
      if (!this.buttons.has(e.button)) this.bPressed.add(e.button);
      this.buttons.add(e.button);
    });
    addEventListener('mouseup', (e) => { this.buttons.delete(e.button); this.bReleased.add(e.button); });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) { this.keys.clear(); this.buttons.clear(); }
      this.onLockChange && this.onLockChange(this.locked);
    });
    addEventListener('blur', () => { this.keys.clear(); this.buttons.clear(); });
  }
  lock() { try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ } }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }
  btn(b) { return this.buttons.has(b); }
  btnHit(b) { return this.bPressed.has(b); }
  btnUp(b) { return this.bReleased.has(b); }
  consumeMouse() { const r = [this.mouseDX * this.sensitivity, this.mouseDY * this.sensitivity * (this.invertY ? -1 : 1)]; this.mouseDX = this.mouseDY = 0; return r; }
  endFrame() { this.pressed.clear(); this.released.clear(); this.bPressed.clear(); this.bReleased.clear(); this.wheel = 0; }
}
