// Keyboard, mouse (pointer lock) and gamepad input.
import { useSettings } from '../settings';

export class Input {
  keys = new Set<string>();
  pressed = new Set<string>(); // pressed since last frame
  mouseDX = 0;
  mouseDY = 0;
  wheel = 0;
  locked = false;
  gp = { lx: 0, ly: 0, rx: 0, ry: 0, rt: 0, lt: 0, a: false, b: false, x: false, y: false, lb: false, rb: false };
  private gpPrev = { a: false, b: false, x: false, y: false, lb: false, rb: false, start: false, back: false };
  canvas: HTMLElement;
  enabled = true;
  onUIKey: ((code: string) => boolean) | null = null;

  constructor(canvas: HTMLElement) {
    this.canvas = canvas;
    window.addEventListener('keydown', this.down);
    window.addEventListener('keyup', this.up);
    window.addEventListener('blur', this.blur);
    document.addEventListener('mousemove', this.move);
    document.addEventListener('pointerlockchange', this.lockChange);
    canvas.addEventListener('wheel', this.onWheel, { passive: true });
  }

  dispose() {
    window.removeEventListener('keydown', this.down);
    window.removeEventListener('keyup', this.up);
    window.removeEventListener('blur', this.blur);
    document.removeEventListener('mousemove', this.move);
    document.removeEventListener('pointerlockchange', this.lockChange);
    this.canvas.removeEventListener('wheel', this.onWheel);
    if (document.pointerLockElement) document.exitPointerLock();
  }

  private down = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (e.code === 'Tab') e.preventDefault();
    if (e.code === 'Space' && this.enabled) e.preventDefault();
    if (!e.repeat && this.onUIKey && this.onUIKey(e.code)) {
      e.preventDefault();
      return;
    }
    if (!this.enabled) return;
    if (!this.keys.has(e.code)) this.pressed.add(e.code);
    this.keys.add(e.code);
  };
  private up = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  private blur = () => {
    this.keys.clear();
  };
  private move = (e: MouseEvent) => {
    if (!this.locked || !this.enabled) return;
    this.mouseDX += e.movementX;
    this.mouseDY += e.movementY;
  };
  private onWheel = (e: WheelEvent) => {
    this.wheel += Math.sign(e.deltaY);
  };
  private lockChange = () => {
    this.locked = document.pointerLockElement === this.canvas;
  };

  requestLock() {
    if (!this.locked && this.canvas.requestPointerLock) {
      try {
        const r = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
        if (r && typeof r.catch === 'function') r.catch(() => {});
      } catch {
        /* ignore */
      }
    }
  }
  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  setEnabled(v: boolean) {
    this.enabled = v;
    if (!v) {
      this.keys.clear();
      this.pressed.clear();
    }
  }

  down_(code: string) {
    return this.enabled && this.keys.has(code);
  }
  hit(code: string) {
    return this.enabled && this.pressed.has(code);
  }

  pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && pads[0];
    if (!p) {
      this.gp.lx = this.gp.ly = this.gp.rx = this.gp.ry = this.gp.rt = this.gp.lt = 0;
      return;
    }
    const dz = (v: number) => (Math.abs(v) < 0.15 ? 0 : v);
    this.gp.lx = dz(p.axes[0] ?? 0);
    this.gp.ly = dz(p.axes[1] ?? 0);
    this.gp.rx = dz(p.axes[2] ?? 0);
    this.gp.ry = dz(p.axes[3] ?? 0);
    this.gp.rt = p.buttons[7]?.value ?? 0;
    this.gp.lt = p.buttons[6]?.value ?? 0;
    const btn = (i: number) => !!p.buttons[i]?.pressed;
    const map: [keyof typeof this.gpPrev, number, string][] = [
      ['a', 0, 'KeyE'], ['b', 1, 'KeyC'], ['x', 2, 'Space'], ['y', 3, 'KeyB'], ['lb', 4, 'KeyH'], ['rb', 5, 'KeyL'], ['start', 9, 'Escape'], ['back', 8, 'Tab'],
    ];
    for (const [k, i, code] of map) {
      const now = btn(i);
      if (now && !this.gpPrev[k]) {
        if ((code === 'Escape' || code === 'Tab') && this.onUIKey) this.onUIKey(code);
        else if (this.enabled) this.pressed.add(code);
      }
      this.gpPrev[k] = now;
    }
    this.gp.a = btn(0);
    this.gp.x = btn(2);
    this.gp.lb = btn(4);
  }

  /** Movement axes: x = right, y = forward */
  axes() {
    let x = 0, y = 0;
    if (this.down_('KeyW') || this.down_('ArrowUp')) y += 1;
    if (this.down_('KeyS') || this.down_('ArrowDown')) y -= 1;
    if (this.down_('KeyD') || this.down_('ArrowRight')) x += 1;
    if (this.down_('KeyA') || this.down_('ArrowLeft')) x -= 1;
    if (this.enabled) {
      x += this.gp.lx;
      y -= this.gp.ly;
    }
    return { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
  }

  consumeMouse() {
    const s = useSettings.getState().s;
    const k = 0.0022 * s.mouseSensitivity;
    let dx = this.mouseDX * k;
    let dy = this.mouseDY * k * (s.invertY ? -1 : 1);
    if (this.enabled) {
      dx += this.gp.rx * 0.05 * s.mouseSensitivity;
      dy += this.gp.ry * 0.04 * s.mouseSensitivity;
    }
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx, dy };
  }

  endFrame() {
    this.pressed.clear();
    this.wheel = 0;
  }
}
