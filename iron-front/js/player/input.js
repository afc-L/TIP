// Keyboard / mouse input with pointer lock.
(function (G) {
  'use strict';
  const IF = G.IF;
  const I = (IF.Input = { keys: {}, pressed: {}, mx: 0, my: 0, lmb: false, rmb: false, lmbPressed: false, rmbPressed: false, wheel: 0, locked: false, enabled: false });

  I.init = function (canvas) {
    I.canvas = canvas;
    G.addEventListener('keydown', (e) => {
      if (!I.enabled) return;
      const k = e.code;
      if (!I.keys[k]) I.pressed[k] = true;
      I.keys[k] = true;
      if (['Tab', 'Space', 'ControlLeft', 'KeyF', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'KeyB', 'KeyM'].includes(k) || (e.ctrlKey && k === 'KeyW')) e.preventDefault();
    });
    G.addEventListener('keyup', (e) => { I.keys[e.code] = false; });
    G.addEventListener('blur', () => { I.keys = {}; I.lmb = I.rmb = false; });
    canvas.addEventListener('mousedown', (e) => {
      if (!I.enabled) return;
      if (!I.locked) { I.lock(); return; }
      if (e.button === 0) { I.lmb = true; I.lmbPressed = true; }
      if (e.button === 2) { I.rmb = true; I.rmbPressed = true; }
    });
    G.addEventListener('mouseup', (e) => { if (e.button === 0) I.lmb = false; if (e.button === 2) I.rmb = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    G.addEventListener('mousemove', (e) => { if (I.locked) { I.mx += e.movementX || 0; I.my += e.movementY || 0; } });
    G.addEventListener('wheel', (e) => { if (I.locked) I.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      I.locked = document.pointerLockElement === canvas;
      if (!I.locked) { I.lmb = I.rmb = false; IF.emit('pointerUnlocked'); }
      else IF.emit('pointerLocked');
    });
  };
  I.lock = function () { try { const p = I.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ } };
  I.unlock = function () { if (document.pointerLockElement) document.exitPointerLock(); };
  I.down = (k) => !!I.keys[k];
  I.hit = (k) => { if (I.pressed[k]) { I.pressed[k] = false; return true; } return false; };
  I.endFrame = function () { I.pressed = {}; I.mx = 0; I.my = 0; I.lmbPressed = false; I.rmbPressed = false; I.wheel = 0; };
})(typeof window !== 'undefined' ? window : globalThis);
