import * as THREE from 'three';
import './style.css';
import { Sound } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { Meta } from './meta.js';
import { Game } from './game.js';

const meta = new Meta();
const settings = meta.settings;

const renderer = new THREE.WebGLRenderer({ antialias: settings.quality === 'high', powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.getElementById('app').prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, 220);

const sound = new Sound();
const input = new Input(renderer.domElement);
const ui = new UI();
const game = new Game({ scene, camera, ui, sound, input, meta });
window.rift = game.debugAPI();

function applySettings() {
  const high = settings.quality === 'high';
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, high ? 1.5 : 1));
  game.world.setShadows(high);
  game.effects.settings.shake = settings.shake;
  game.effects.settings.numbers = settings.numbers;
  sound.setVolume(settings.volume);
  sound.setMuted(settings.muted);
  ui.syncSettings(settings);
}
applySettings();
ui.bindSettings(settings, () => { applySettings(); meta.saveSettings(); });

// ------------------------------------------------------------------ navigation
let settingsReturn = 'menu';
let shopReturn = 'menu';
let confirmAction = null;

function openMenu() {
  ui.renderMenuStats(meta);
  ui.show('menu');
}

function openShop(from) {
  shopReturn = from;
  ui.renderShop(meta);
  ui.show('shop');
}

function play() {
  sound.init();
  game.startRun();
}

function askConfirm(title, text, action) {
  confirmAction = action;
  ui.confirm(title, text);
}

ui.onAction = (screen, action, btn) => {
  sound.init();
  sound.play('click');
  switch (screen) {
    case 'menu':
      if (action === 'play') play();
      else if (action === 'shop') openShop('menu');
      else if (action === 'howto') ui.show('howto');
      else if (action === 'settings') { settingsReturn = 'menu'; ui.show('settings'); }
      break;
    case 'shop':
      if (action === 'buy') { if (meta.buy(btn.dataset.id)) sound.play('levelup'); ui.renderShop(meta); }
      else if (action === 'refund') askConfirm('Refund all?', 'All purchased ranks are removed and their shards returned.', () => { meta.refund(); openShop(shopReturn); });
      else if (action === 'back') shopReturn === 'end' ? ui.show('end') : openMenu();
      break;
    case 'howto':
      if (action === 'back') openMenu();
      break;
    case 'settings':
      if (action === 'back') settingsReturn === 'pause' ? ui.show('pause') : openMenu();
      break;
    case 'pause':
      if (action === 'resume') game.resume();
      else if (action === 'restart') askConfirm('Restart run?', 'Your current run ends. Shards earned so far are kept.', () => { game.abandonRun(); play(); });
      else if (action === 'settings') { settingsReturn = 'pause'; ui.show('settings'); }
      else if (action === 'quit') askConfirm('Return to menu?', 'Your current run ends. Shards earned so far are kept.', () => { game.abandonRun(); game.goToMenu(); openMenu(); });
      break;
    case 'confirm':
      if (action === 'yes' && confirmAction) { const a = confirmAction; confirmAction = null; a(); }
      else if (action === 'no') {
        confirmAction = null;
        if (game.state === 'paused') ui.show('pause');
        else if (ui.current === 'confirm') openShop(shopReturn);
      }
      break;
    case 'end':
      if (action === 'again') play();
      else if (action === 'menu') { game.goToMenu(); openMenu(); }
      else if (action === 'shop') openShop('end');
      break;
    case 'hud':
      if (action === 'pause') game.pause();
      else if (action === 'mute') toggleMute();
      break;
  }
};

function toggleMute() {
  settings.muted = !settings.muted;
  applySettings();
  meta.saveSettings();
}

// Keyboard shortcuts for menus (game-state keys are handled inside Game.update).
function handleMenuKeys() {
  if (input.wasPressed('KeyM')) toggleMute();
  if (!input.wasPressed('Escape')) return;
  switch (ui.current) {
    case 'pause': if (game.state === 'paused') game.resume(); break;
    case 'settings': settingsReturn === 'pause' ? ui.show('pause') : openMenu(); break;
    case 'shop': shopReturn === 'end' ? ui.show('end') : openMenu(); break;
    case 'howto': openMenu(); break;
    case 'confirm': ui.onAction('confirm', 'no'); break;
  }
}

// Pause automatically when the tab is hidden.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    game.pause();
    input.clear();
    sound.suspend();
  } else sound.resume();
});
window.addEventListener('blur', () => { if (game.state === 'playing') game.pause(); });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ------------------------------------------------------------------ loop
let last = performance.now();
let fpsFrames = 0, fpsTime = 0, fps = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05; // clamp big hitches so physics stays stable
  if (dt <= 0) return;

  const stateBefore = game.state;
  const escPressed = input.wasPressed('Escape');
  game.update(dt);
  // Esc that just paused the game must not also immediately resume it.
  if (!(escPressed && stateBefore === 'playing')) handleMenuKeys();
  else if (input.wasPressed('KeyM')) toggleMute();
  game.render(dt);
  if (game.state === 'playing' || game.state === 'dying') ui.updateHud(game);
  renderer.render(scene, camera);
  input.endFrame();

  fpsFrames++; fpsTime += dt;
  if (fpsTime >= 0.5) { fps = Math.round(fpsFrames / fpsTime); fpsFrames = 0; fpsTime = 0; }
  ui.setFps(settings.showFps, fps);
}

ui.hideLoading();
openMenu();
requestAnimationFrame(frame);
