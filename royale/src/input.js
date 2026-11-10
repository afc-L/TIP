// Keyboard / mouse state with pointer lock.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();     // keys pressed this frame
    this.mouse = { dx: 0, dy: 0, left: false, right: false, leftPressed: false, rightPressed: false, wheel: 0 };
    this.locked = false;
    this.enabled = true;
    window.addEventListener('keydown', (e) => {
      if (this.onCapture) { e.preventDefault(); this.onCapture(e.code, e); return; }
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'Backspace'].includes(e.code) || (e.code.startsWith('F') && e.code.length <= 3 && this.locked)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.left = this.mouse.right = false; });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouse.left = true; this.mouse.leftPressed = true; }
      if (e.button === 2) { this.mouse.right = true; this.mouse.rightPressed = true; }
      const c = 'Mouse' + e.button;
      if (!this.keys.has(c)) this.pressed.add(c);
      this.keys.add(c);
    });
    // while rebinding a control, the next key or mouse button is captured
    window.addEventListener('mousedown', (e) => {
      if (!this.onCapture) return;
      // clicking another binding button just moves the capture to that row
      if (e.target.closest && e.target.closest('.kb-btn') && e.button === 0) return;
      e.preventDefault(); e.stopPropagation();
      this.onCapture('Mouse' + e.button, e);
    }, true);
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
      this.keys.delete('Mouse' + e.button);
    });
    canvas.addEventListener('auxclick', (e) => e.preventDefault());
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouse.dx += e.movementX || 0;
      this.mouse.dy += e.movementY || 0;
    });
    window.addEventListener('wheel', (e) => { if (this.locked) this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (this.onLockChange) this.onLockChange(this.locked);
    });
  }
  lock() { if (!this.locked && this.canvas.requestPointerLock) { try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ } } }
  unlock() { if (document.exitPointerLock) document.exitPointerLock(); }
  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }
  // action helpers: an action is down/hit if any of its bindings is
  actDown(binds, id) { const b = binds[id]; return !!b && ((b[0] && this.keys.has(b[0])) || (b[1] && this.keys.has(b[1]))); }
  actHit(binds, id) { const b = binds[id]; return !!b && ((b[0] && this.pressed.has(b[0])) || (b[1] && this.pressed.has(b[1]))); }
  endFrame() {
    this.pressed.clear();
    this.mouse.dx = this.mouse.dy = 0;
    this.mouse.leftPressed = this.mouse.rightPressed = false;
    this.mouse.wheel = 0;
  }
}
