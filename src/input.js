import { clamp } from './util.js';

/** Keyboard + mouse → fighter input. The mouse moves the sword hand, not the camera. */
export class PlayerInput {
  constructor(game, canvas) {
    this.game = game;
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.lmb = false;
    this.aim = { x: 0.2, y: 0.0, reach: 0.42 };
    this.sens = 0.0021;
    this.lockOn = true;
    this.mouseDX = 0; this.mouseDY = 0;
    this.locked = false;

    window.addEventListener('keydown', (e) => {
      if (['Tab', 'Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      game.onKey?.(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.lmb = false; });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) { game.requestLock(); return; }
      if (e.button === 0) this.lmb = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.lmb = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX; this.mouseDY += e.movementY;
    });
    window.addEventListener('wheel', (e) => {
      if (!this.locked) return;
      this.aim.reach = clamp(this.aim.reach - Math.sign(e.deltaY) * 0.05, 0.12, 0.7);
    }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) { this.lmb = false; game.onUnlock?.(); }
    });
  }

  /** Test hook: inject mouse motion without pointer lock. */
  inject(dx, dy) { this.mouseDX += dx; this.mouseDY += dy; }

  update(fighter, dt) {
    const k = this.keys, inp = fighter.input;
    const turning = k.has('KeyC');
    if (turning) {
      inp.turn = -this.mouseDX * 0.05;
      this.lockOn = false;
    } else {
      inp.turn = 0;
      this.aim.x = clamp(this.aim.x + this.mouseDX * this.sens, -0.8, 0.8);
      this.aim.y = clamp(this.aim.y - this.mouseDY * this.sens, -0.7, 0.8);
    }
    this.mouseDX = 0; this.mouseDY = 0;
    if (k.has('ArrowLeft')) inp.turn += 1;
    if (k.has('ArrowRight')) inp.turn -= 1;
    if (k.has('ArrowUp')) this.aim.reach = clamp(this.aim.reach + dt * 0.8, 0.12, 0.7);
    if (k.has('ArrowDown')) this.aim.reach = clamp(this.aim.reach - dt * 0.8, 0.12, 0.7);

    inp.moveZ = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    inp.moveX = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    inp.run = k.has('ShiftLeft') || k.has('ShiftRight');
    inp.power = this.lmb ? 1.0 : 0.4;
    inp.guard = k.has('KeyV');
    inp.brace = k.has('Space') && !(inp.moveX || inp.moveZ);
    inp.aim.x = this.aim.x; inp.aim.y = this.aim.y; inp.aim.reach = this.aim.reach;

    const p = this.pressed;
    if (p.has('KeyQ')) inp.parry = true;
    if (p.has('KeyF')) inp.thrust = true;
    if (p.has('KeyE')) inp.grab = true;
    if (p.has('KeyX')) inp.twoHand = true;
    if (p.has('Space')) {
      if (fighter.state === 'down') inp.getUp = true;
      else if (inp.moveX || inp.moveZ) inp.dodge = true;
    }
    if (p.has('Tab')) this.lockOn = !this.lockOn;
    p.clear();

    const tgt = fighter.target;
    inp.faceTarget = this.lockOn && tgt && tgt.alive ? tgt.parts.torso.p : null;
  }
}
