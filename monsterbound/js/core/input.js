'use strict';
// Keyboard input with action mapping, edge detection and key-repeat for menus.
MB.input = (function () {
  const map = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    KeyZ: 'a', Enter: 'a', Space: 'a', KeyX: 'b', Escape: 'b', Backspace: 'b',
    KeyI: 'inv', KeyM: 'map', KeyC: 'party', ShiftLeft: 'run', ShiftRight: 'run', KeyR: 'rift', KeyP: 'dex', KeyQ: 'quests', KeyJ: 'quests',
  };
  const held = {}, pressed = {}, repeatT = {};
  let anyPressed = false;
  const listeners = [];
  window.addEventListener('keydown', (e) => {
    let act = map[e.code];
    if (MB.input && MB.input.textMode && e.key.length === 1) act = null;
    if (MB.input && MB.input.textMode && e.code === 'Backspace') act = null;
    if (act) {
      e.preventDefault();
      if (!held[act]) { pressed[act] = true; repeatT[act] = 0; }
      held[act] = true;
    }
    anyPressed = true;
    if (MB.input && MB.input.textMode && (e.key.length === 1 || e.code === 'Backspace')) e.preventDefault();
    for (const l of listeners) l(e);
    MB.audio && MB.audio.unlock();
  });
  window.addEventListener('keyup', (e) => { const act = map[e.code]; if (act) { held[act] = false; } });
  window.addEventListener('blur', () => { for (const k in held) held[k] = false; });
  window.addEventListener('mousedown', () => MB.audio && MB.audio.unlock());

  return {
    held: (a) => !!held[a],
    // pressed this frame (or auto-repeat for directional keys when `rep` true)
    pressed: (a) => !!pressed[a],
    repeat: (a) => !!pressed[a] || (held[a] && repeatT[a] > 0.32 && Math.floor(repeatT[a] * 14) !== Math.floor((repeatT[a] - MB.input._dt) * 14)),
    consume: (a) => { pressed[a] = false; },
    any: () => anyPressed,
    onKey: (fn) => { listeners.push(fn); return () => listeners.splice(listeners.indexOf(fn), 1); },
    _dt: 0.016,
    endFrame(dt) {
      this._dt = dt;
      for (const k in pressed) pressed[k] = false;
      for (const k in held) if (held[k]) repeatT[k] = (repeatT[k] || 0) + dt;
      anyPressed = false;
    },
    clear() { for (const k in pressed) pressed[k] = false; },
    // test hook
    _press(a) { pressed[a] = true; },
    _hold(a, v) { held[a] = v; if (v) { pressed[a] = true; repeatT[a] = 0; } },
  };
})();
