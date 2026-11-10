import { Game } from './game.js';
import { Menu } from './menu.js';

const canvas = document.getElementById('game');
const game = new Game(canvas);
window.__game = game;

async function boot() {
  const fill = document.getElementById('load-fill');
  const msg = document.getElementById('load-msg');
  await game.buildWorld((m, f) => { msg.textContent = m; fill.style.width = Math.round(f * 100) + '%'; });
  const menu = new Menu(game);
  window.__menu = menu;
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('menu').classList.remove('hidden');
  game.resize();
  document.addEventListener('pointerdown', () => { game.audio.init(); if (game.state === 'menu') game.audio.startMusic(); }, { once: true });
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    try {
      if (game.state === 'menu') menu.lobby.render(dt);
      else if (game.state === 'match') game.update(dt);
    } catch (e) {
      console.error(e);
      if (window.__TEST__) window.__err = (window.__err || '') + e.stack + '\n';
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
boot().catch((e) => {
  console.error(e);
  document.getElementById('load-msg').textContent = 'Failed to start: ' + e.message;
  window.__err = e.stack;
});
