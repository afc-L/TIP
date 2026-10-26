// High-level game flow: the only place that changes screens and starts/stops runs.
import { CONFIG } from '../game/GameConfig';
import { engine } from '../game/Engine';
import { audio } from '../game/effects/AudioManager';
import { input } from '../game/Input';
import { choiceToCard, generateChoices, type Choice } from '../game/items/UpgradeSystem';
import type { RunOptions } from '../game/Run';
import { useGame } from '../store/gameStore';
import { getSave, useProgression } from '../store/progressionStore';
import { getSettings } from '../store/settingsStore';
import type { GameScreen } from './gameState';

let choices: Choice[] = [];
let introTimer: number | null = null;
let lastOptions: RunOptions | null = null;

const store = () => useGame.getState();

function go(to: GameScreen) {
  return store().transition(to);
}

function musicFor(screen: GameScreen) {
  const run = engine.run;
  if (screen === 'PLAYING' || screen === 'LEVEL_UP' || screen === 'PAUSED' || screen === 'BOSS_INTRO') {
    if (run?.boss) audio.music('boss');
    else audio.music(run?.map.music === 1 ? 'game1' : run?.map.music === 2 ? 'game2' : 'game0');
  } else if (screen === 'GAME_OVER' || screen === 'VICTORY') audio.music('none');
  else audio.music('menu');
}

useGame.subscribe((s, prev) => {
  if (s.screen !== prev.screen) musicFor(s.screen);
});

export const flow = {
  init() {
    input.onPause = () => flow.togglePause();
    // never let the horde keep chewing on you in a background tab
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && store().screen === 'PLAYING') go('PAUSED');
    });
    audio.music('menu');
  },

  toCharacterSelect() { go('CHARACTER_SELECT'); },
  toMapSelect() { go('MAP_SELECT'); },
  backToMenu() {
    const s = store().screen;
    if (s === 'CHARACTER_SELECT' || s === 'MAP_SELECT') go('MAIN_MENU');
  },

  startRun() {
    const save = getSave();
    const opts: RunOptions = { character: save.selectedCharacter, map: save.selectedMap, mode: save.selectedMode, difficulty: getSettings().difficulty };
    lastOptions = opts;
    flow.launch(opts);
  },

  launch(opts: RunOptions) {
    if (introTimer) { clearTimeout(introTimer); introTimer = null; }
    choices = [];
    useGame.setState({ levelUp: null, result: null, bossIntro: null, boss: null, announcement: null, toasts: [] });
    engine.startRun(opts, {
      onLevelUp: () => flow.openLevelUp(),
      onBossIntro: (name, title) => flow.bossIntro(name, title),
      onAnnounce: (text, big) => store().announce(text, big),
      onToast: (icon, title, text, kind) => store().toast({ icon, title, text, kind }),
      onEnd: (victory) => flow.endRun(victory),
    });
    if (!go('PLAYING')) {
      // e.g. restarting from GAME_OVER is valid; anything else falls back safely
      useGame.setState({ screen: 'PLAYING' });
    }
    musicFor('PLAYING');
  },

  togglePause() {
    const s = store().screen;
    if (s === 'PLAYING') { go('PAUSED'); audio.play('click'); }
    else if (s === 'PAUSED') flow.resume();
  },

  resume() {
    if (store().screen === 'PAUSED') { input.clearPresses(); go('PLAYING'); }
  },

  restart() {
    const opts = lastOptions;
    if (!opts) return;
    const s = store().screen;
    if (s === 'PAUSED') useGame.setState({ screen: 'PLAYING' }); // discard confirmed in UI
    flow.launch({ ...opts, difficulty: getSettings().difficulty });
  },

  quitToMenu() {
    if (introTimer) { clearTimeout(introTimer); introTimer = null; }
    engine.endRun();
    choices = [];
    useGame.setState({ levelUp: null, bossIntro: null, boss: null, screen: 'MAIN_MENU', menuPage: 'home', toasts: [] });
    engine.showcase.resetTheme();
  },

  openLevelUp() {
    const run = engine.run;
    if (!run || store().screen !== 'PLAYING') return;
    const count = CONFIG.levelUp.baseChoices + (run.stats.luck >= 30 ? 1 : 0);
    choices = generateChoices(run, count);
    useGame.setState({ levelUp: { cards: choices.map((c, i) => choiceToCard(c, run, i)), rerolls: run.rerolls, level: run.level - run.pendingLevels + 1, pending: run.pendingLevels } });
    go('LEVEL_UP');
    audio.play('levelup');
  },

  chooseUpgrade(i: number) {
    const run = engine.run;
    if (!run || store().screen !== 'LEVEL_UP' || !choices[i]) return;
    run.applyChoice(choices[i]);
    run.pendingLevels = Math.max(0, run.pendingLevels - 1);
    audio.play('select');
    run.vfx.ring(run.player.x, run.player.z, 0.5, 4, '#ffd60a', 0.45);
    run.particles.burst(run.player.x, 1, run.player.z, 20, '#ffd60a', 5, 0.2, 0.7);
    flow.afterChoice();
  },

  skipUpgrade() {
    const run = engine.run;
    if (!run || store().screen !== 'LEVEL_UP') return;
    run.gold += CONFIG.levelUp.skipGold;
    run.pendingLevels = Math.max(0, run.pendingLevels - 1);
    audio.play('click');
    flow.afterChoice();
  },

  afterChoice() {
    const run = engine.run!;
    if (run.pendingLevels > 0) {
      const count = CONFIG.levelUp.baseChoices + (run.stats.luck >= 30 ? 1 : 0);
      choices = generateChoices(run, count);
      useGame.setState({ levelUp: { cards: choices.map((c, i) => choiceToCard(c, run, i)), rerolls: run.rerolls, level: run.level - run.pendingLevels + 1, pending: run.pendingLevels } });
    } else {
      useGame.setState({ levelUp: null });
      input.clearPresses();
      go('PLAYING');
    }
  },

  reroll() {
    const run = engine.run;
    if (!run || store().screen !== 'LEVEL_UP' || run.rerolls <= 0) { audio.play('deny'); return; }
    run.rerolls--;
    const count = CONFIG.levelUp.baseChoices + (run.stats.luck >= 30 ? 1 : 0);
    choices = generateChoices(run, count);
    const lu = store().levelUp!;
    useGame.setState({ levelUp: { ...lu, cards: choices.map((c, i) => choiceToCard(c, run, i)), rerolls: run.rerolls } });
    audio.play('click');
  },

  bossIntro(name: string, title: string) {
    if (store().screen !== 'PLAYING') {
      // a level-up is open; show the intro once gameplay resumes
      const unsub = useGame.subscribe((s) => {
        if (s.screen === 'PLAYING') { unsub(); flow.bossIntro(name, title); }
      });
      return;
    }
    useGame.setState({ bossIntro: { name, title } });
    go('BOSS_INTRO');
    audio.music('boss');
    introTimer = window.setTimeout(() => {
      introTimer = null;
      useGame.setState({ bossIntro: null });
      if (store().screen === 'BOSS_INTRO') go('PLAYING');
    }, 2600);
  },

  endRun(victory: boolean) {
    const run = engine.run;
    if (!run) return;
    const result = run.finalize();
    useGame.setState({ result, levelUp: null, boss: null, interact: null });
    go(victory ? 'VICTORY' : 'GAME_OVER');
    useProgression.getState().persist();
  },
};

// Debug/testing handle (used by automated browser tests).
declare global { interface Window { __bonked?: unknown } }
window.__bonked = {
  engine, flow, input, store: useGame, progression: useProgression,
  get run() { return engine.run; },
};
