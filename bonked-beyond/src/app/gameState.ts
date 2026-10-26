// The explicit game state machine. Every screen change goes through `canTransition`.

export type GameScreen =
  | 'MAIN_MENU'
  | 'CHARACTER_SELECT'
  | 'MAP_SELECT'
  | 'PLAYING'
  | 'LEVEL_UP'
  | 'PAUSED'
  | 'BOSS_INTRO'
  | 'GAME_OVER'
  | 'VICTORY';

export type MenuPage = 'home' | 'upgrades' | 'collection' | 'stats' | 'settings' | 'credits';

const TRANSITIONS: Record<GameScreen, GameScreen[]> = {
  MAIN_MENU: ['CHARACTER_SELECT'],
  CHARACTER_SELECT: ['MAP_SELECT', 'MAIN_MENU'],
  MAP_SELECT: ['PLAYING', 'CHARACTER_SELECT', 'MAIN_MENU'],
  PLAYING: ['LEVEL_UP', 'PAUSED', 'BOSS_INTRO', 'GAME_OVER', 'VICTORY'],
  LEVEL_UP: ['PLAYING', 'LEVEL_UP'],
  PAUSED: ['PLAYING', 'MAIN_MENU'],
  BOSS_INTRO: ['PLAYING'],
  GAME_OVER: ['PLAYING', 'MAIN_MENU'],
  VICTORY: ['PLAYING', 'MAIN_MENU'],
};

export function canTransition(from: GameScreen, to: GameScreen): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Screens during which the simulation is advancing. */
export const SIMULATING: ReadonlySet<GameScreen> = new Set(['PLAYING']);
/** Screens during which a run exists (possibly frozen). */
export const IN_RUN: ReadonlySet<GameScreen> = new Set(['PLAYING', 'LEVEL_UP', 'PAUSED', 'BOSS_INTRO']);
