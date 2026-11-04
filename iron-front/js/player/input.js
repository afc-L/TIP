// Keyboard / mouse input with pointer lock.
(function (G) {
  'use strict';
  const IF = G.IF;
  const I = (IF.Input = { keys: {}, pressed: {}, mx: 0, my: 0, wheel: 0, locked: false, enabled: false });
  // Shoot and aim are ordinary rebindable actions; the old names stay as read-only views
  Object.defineProperty(I, 'lmb', { get: () => I.downA('fire') });
  Object.defineProperty(I, 'rmb', { get: () => I.downA('aim') });
  Object.defineProperty(I, 'lmbPressed', { get: () => !!I.pressed[I.code('fire')] });
  Object.defineProperty(I, 'rmbPressed', { get: () => !!I.pressed[I.code('aim')] });

  // Rebindable actions: [id, label, default key code, group]
  IF.KEY_ACTIONS = [
    ['fire', 'Shoot', 'Mouse0', 'Combat'], ['aim', 'Aim down sights / zoom', 'Mouse2', 'Combat'],
    ['forward', 'Move forward', 'KeyW', 'Movement'], ['back', 'Move back', 'KeyS', 'Movement'], ['left', 'Move left', 'KeyA', 'Movement'], ['right', 'Move right', 'KeyD', 'Movement'],
    ['sprint', 'Sprint', 'ShiftLeft', 'Movement'], ['jump', 'Jump / brake / climb', 'Space', 'Movement'], ['crouch', 'Crouch', 'KeyC', 'Movement'], ['prone', 'Prone', 'KeyZ', 'Movement'],
    ['leanL', 'Lean left / strafe left', 'KeyQ', 'Movement'], ['leanR', 'Lean right / strafe right', 'KeyE', 'Movement'], ['descend', 'Helicopter descend', 'ControlLeft', 'Movement'],
    ['reload', 'Reload', 'KeyR', 'Combat'], ['weapon1', 'Primary weapon', 'Digit1', 'Combat'], ['weapon2', 'Sidearm / coax', 'Digit2', 'Combat'], ['weapon3', 'Launcher', 'Digit3', 'Combat'],
    ['gadget', 'Class gadget', 'Digit4', 'Combat'], ['grenade', 'Frag grenade', 'KeyG', 'Combat'], ['secondary', 'Smoke / AT mine', 'KeyX', 'Combat'], ['spot', 'Spot enemy', 'KeyT', 'Combat'],
    ['interact', 'Interact / vehicle / revive', 'KeyF', 'Battlefield'], ['commands', 'Squad commands', 'KeyB', 'Battlefield'], ['map', 'Tactical map', 'KeyM', 'Battlefield'], ['status', 'Battle status (hold)', 'Tab', 'Battlefield'],
    ['spawner', 'Vehicle spawner (at HQ)', 'KeyK', 'Battlefield'], ['takeover', 'Take the wheel (passenger)', 'KeyY', 'Battlefield'], ['camera', '1st / 3rd person', 'KeyV', 'Battlefield'], ['nvg', 'Night vision', 'KeyN', 'Battlefield'], ['help', 'Help overlay', 'KeyH', 'Battlefield'], ['perf', 'Performance stats', 'F3', 'Battlefield'],
  ];
  const DEF = {}; for (const a of IF.KEY_ACTIONS) DEF[a[0]] = a[2];
  I.code = (id) => { const k = IF.Profile.settings.keys; return (k && k[id]) || DEF[id]; };
  I.downA = (id) => I.down(I.code(id));
  I.hitA = (id) => I.hit(I.code(id));
  I.label = (id) => I.keyName(I.code(id));
  I.keyName = function (c) {
    if (!c) return '—';
    if (c.startsWith('Key')) return c.slice(3);
    if (c.startsWith('Digit')) return c.slice(5);
    if (c.startsWith('Numpad')) return 'Num ' + c.slice(6);
    if (c.startsWith('Mouse')) return ['Left click', 'Middle click', 'Right click', 'Mouse 4', 'Mouse 5'][+c.slice(5)] || 'Mouse ' + c.slice(5);
    const map = { ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl', AltLeft: 'L-Alt', AltRight: 'R-Alt', Space: 'Space', Tab: 'Tab', CapsLock: 'Caps',
      Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', Enter: 'Enter',
      ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backspace: 'Backspace', MetaLeft: 'Cmd', MetaRight: 'Cmd' };
    return map[c] || c;
  };
  // assign a key to an action; a key already used elsewhere is swapped onto that action
  I.rebind = function (id, code) {
    const s = IF.Profile.settings;
    s.keys = s.keys || {};
    const old = I.code(id);
    for (const a of IF.KEY_ACTIONS) if (a[0] !== id && I.code(a[0]) === code) s.keys[a[0]] = old;
    s.keys[id] = code;
    IF.saveProfile();
  };
  I.resetBinds = function () { IF.Profile.settings.keys = {}; IF.saveProfile(); };
  I.capture = null; // function(code) while the controls menu waits for a key

  I.init = function (canvas) {
    I.canvas = canvas;
    G.addEventListener('keydown', (e) => {
      if (I.capture) { e.preventDefault(); const f = I.capture; I.capture = null; f(e.code); return; }
      if (!I.enabled) return;
      const k = e.code;
      if (!I.keys[k]) I.pressed[k] = true;
      I.keys[k] = true;
      const bound = IF.KEY_ACTIONS.some((a) => I.code(a[0]) === k);
      if (bound || /^Digit[1-7]$/.test(k) || k === 'Tab' || k === 'Space' || (e.ctrlKey && k === 'KeyW')) e.preventDefault();
    });
    G.addEventListener('keyup', (e) => { I.keys[e.code] = false; });
    G.addEventListener('blur', () => { I.keys = {}; });
    // mouse buttons become key codes Mouse0 / Mouse1 / Mouse2 so they can be bound like keys.
    // Mac trackpads: Ctrl + click counts as a right click.
    const downCode = {};
    const mcode = (e) => 'Mouse' + (e.button === 0 && e.ctrlKey ? 2 : e.button);
    G.addEventListener('mousedown', (e) => {
      if (I.capture) { e.preventDefault(); e.stopPropagation(); const f = I.capture; I.capture = null; f(mcode(e)); return; }
    }, true);
    canvas.addEventListener('mousedown', (e) => {
      if (!I.enabled) return;
      if (!I.locked) { I.lock(); return; }
      const c = mcode(e);
      downCode[e.button] = c;
      if (!I.keys[c]) I.pressed[c] = true;
      I.keys[c] = true;
    });
    G.addEventListener('mouseup', (e) => { const c = downCode[e.button] || 'Mouse' + e.button; I.keys[c] = false; delete downCode[e.button]; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    G.addEventListener('contextmenu', (e) => { if (I.capture || I.locked) e.preventDefault(); });
    G.addEventListener('mousemove', (e) => { if (I.locked) { I.mx += e.movementX || 0; I.my += e.movementY || 0; } });
    G.addEventListener('wheel', (e) => { if (I.locked) I.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      I.locked = document.pointerLockElement === canvas;
      if (!I.locked) { for (const k in I.keys) if (k.startsWith('Mouse')) I.keys[k] = false; IF.emit('pointerUnlocked'); }
      else IF.emit('pointerLocked');
    });
  };
  I.lock = function () { try { const p = I.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ } };
  I.unlock = function () { if (document.pointerLockElement) document.exitPointerLock(); };
  I.down = (k) => !!I.keys[k];
  I.hit = (k) => { if (I.pressed[k]) { I.pressed[k] = false; return true; } return false; };
  I.endFrame = function () { I.pressed = {}; I.mx = 0; I.my = 0; I.wheel = 0; };
})(typeof window !== 'undefined' ? window : globalThis);
