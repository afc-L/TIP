import { useEffect, useRef } from 'react';
import { BossIntro } from '../components/BossIntro';
import { CharacterSelect } from '../components/CharacterSelect';
import { GameHUD, Toasts } from '../components/GameHUD';
import { LevelUpScreen } from '../components/LevelUpScreen';
import { MainMenu } from '../components/MainMenu';
import { MapSelect } from '../components/MapSelect';
import { PauseMenu } from '../components/PauseMenu';
import { ResultsScreen } from '../components/ResultsScreen';
import { audio } from '../game/effects/AudioManager';
import { engine } from '../game/Engine';
import { useGame } from '../store/gameStore';
import { flow } from './flow';
import { IN_RUN } from './gameState';

export function App() {
  const host = useRef<HTMLDivElement>(null);
  const screen = useGame((s) => s.screen);

  useEffect(() => {
    if (!host.current) return;
    engine.init(host.current);
    flow.init();
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const inRun = IN_RUN.has(screen);
  const menuSide = screen === 'MAIN_MENU' || screen === 'CHARACTER_SELECT' || screen === 'MAP_SELECT';
  return (
    <div className="app">
      <div className="canvas-host" ref={host} />
      <div className={`ui-layer ${menuSide ? 'menu-bg' : ''}`}>
        {screen === 'MAIN_MENU' && <MainMenu />}
        {screen === 'CHARACTER_SELECT' && <CharacterSelect />}
        {screen === 'MAP_SELECT' && <MapSelect />}
        {inRun && <GameHUD />}
        {screen === 'LEVEL_UP' && <LevelUpScreen />}
        {screen === 'PAUSED' && <PauseMenu />}
        {screen === 'BOSS_INTRO' && <BossIntro />}
        {(screen === 'GAME_OVER' || screen === 'VICTORY') && <ResultsScreen />}
        <Toasts />
      </div>
    </div>
  );
}
