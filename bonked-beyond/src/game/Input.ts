// Unified keyboard / mouse / gamepad / touch input. Listeners are attached exactly once.

export interface InputState {
  moveX: number;
  moveZ: number;
  sprint: boolean;
  mouseX: number;     // NDC
  mouseY: number;
  mouseActiveAt: number;
}

type Action = 'dodge' | 'super' | 'interact' | 'pause';

class InputManager {
  state: InputState = { moveX: 0, moveZ: 0, sprint: false, mouseX: 0, mouseY: 0, mouseActiveAt: -1e9 };
  private keys = new Set<string>();
  private pressed = new Set<Action>();
  private attached = false;
  touchMove = { x: 0, z: 0, active: false };
  private padPrev: boolean[] = [];
  usingGamepad = false;
  onPause: (() => void) | null = null;
  onZoom: ((dir: number) => void) | null = null;

  attach(canvasHost: HTMLElement) {
    if (this.attached) return;
    this.attached = true;
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
      if (!e.repeat) {
        if (k === 'Space') this.pressed.add('dodge');
        if (k === 'KeyQ') this.pressed.add('super');
        if (k === 'KeyE') this.pressed.add('interact');
        if (k === 'Escape' || k === 'KeyP') this.onPause?.();
      }
      this.keys.add(k);
      this.usingGamepad = false;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.state.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      this.state.mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
      this.state.mouseActiveAt = performance.now();
    });
    canvasHost.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button === 0) this.pressed.add('super');
      if (e.pointerType === 'mouse' && e.button === 2) this.pressed.add('dodge');
    });
    canvasHost.addEventListener('contextmenu', (e) => e.preventDefault());
    canvasHost.addEventListener('wheel', (e) => { this.onZoom?.(Math.sign(e.deltaY)); }, { passive: true });
  }

  press(a: Action) { this.pressed.add(a); }

  consume(a: Action): boolean {
    const had = this.pressed.has(a);
    this.pressed.delete(a);
    return had;
  }

  clearPresses() { this.pressed.clear(); }

  update() {
    let x = 0, z = 0;
    const k = this.keys;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) z -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) z += 1;
    let sprint = k.has('ShiftLeft') || k.has('ShiftRight');

    if (this.touchMove.active) { x = this.touchMove.x; z = this.touchMove.z; }

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad) continue;
      const ax = pad.axes[0] ?? 0, az = pad.axes[1] ?? 0;
      if (Math.hypot(ax, az) > 0.2) { x = ax; z = az; this.usingGamepad = true; }
      const b = pad.buttons.map((bt) => bt.pressed);
      const edge = (i: number) => b[i] && !this.padPrev[i];
      if (edge(0)) this.pressed.add('dodge');
      if (edge(2) || edge(7)) this.pressed.add('super');
      if (edge(1) || edge(3)) this.pressed.add('interact');
      if (edge(9)) this.onPause?.();
      if (b[6] || b[10]) sprint = true;
      if (b.some(Boolean)) this.usingGamepad = true;
      this.padPrev = b;
      break;
    }

    const len = Math.hypot(x, z);
    if (len > 1) { x /= len; z /= len; }
    this.state.moveX = x;
    this.state.moveZ = z;
    this.state.sprint = sprint;
  }

  mouseRecentlyActive(): boolean {
    return performance.now() - this.state.mouseActiveAt < 2500 && !this.usingGamepad && !this.touchMove.active;
  }
}

export const input = new InputManager();
