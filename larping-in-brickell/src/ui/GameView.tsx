import { useEffect, useRef, useState } from 'react';
import { Engine } from '../game/engine/Engine';
import { useUI } from '../game/uiStore';
import { useGame } from '../game/store';
import { audio } from '../game/engine/audio';
import { Controls, Bar } from './common';
import { Hud } from './Hud';
import { Panels } from './Panels';

const TIPS = [
  'Press B in the Maybach to activate hydraulic bounce. Press V for the full infotainment settings.',
  'Creators can say no. Check the interest meter and keep your commission fair.',
  'Bills arrive at the end of every month. The Bank app shows your projected expenses.',
  'Valets remember people who arrive slowly, stylishly, and occasionally bouncing.',
  'Sleep at home after 6 PM to skip to the next morning and collect commissions.',
  'Watches are for clout, not for telling time. Nobody here tells time.',
];

export function GameView() {
  const host = useRef<HTMLDivElement>(null);
  const bubbles = useRef<HTMLDivElement>(null);
  const screen = useUI((s) => s.screen);
  const loading = useUI((s) => s.loading);
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const e = new Engine();
    (async () => {
      try {
        await e.init(host.current!, bubbles.current!, (p, label) => useUI.getState().setLoading(p, label));
        if (cancelled) return;
        e.start();
        if (new URLSearchParams(location.search).has('debug')) (window as unknown as Record<string, unknown>).__LIB = { engine: e, useGame, useUI };
        // let the loading screen breathe for a moment
        setTimeout(() => {
          if (cancelled) return;
          useUI.getState().setScreen('game');
          useGame.getState().checkProgress();
          const g = useGame.getState().game;
          if (g.day === 1 && g.missionsDone.length === 0) useUI.getState().notify(`Welcome to Brickell, ${g.nickname}. Your Maybach is parked right outside. Press E near it.`, 'mission');
        }, 400);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
    const onVis = () => audio.suspend(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      useGame.getState().save(true);
      e.dispose();
    };
  }, []);

  return (
    <div className="game-root">
      <div className="canvas-host" ref={host} />
      <div className="bubble-layer" ref={bubbles} />
      {screen === 'game' && <Hud />}
      {screen === 'game' && <Panels />}
      {screen === 'loading' && (
        <div className="loading">
          <div className="logo-kicker">LOADING BRICKELL</div>
          <h1 className="logo" style={{ fontSize: 48 }}>LARPING <i>in</i> BRICKELL</h1>
          <Bar value={loading.progress} />
          <div className="muted small">{error ? `Could not start the 3D engine: ${error}. Try a browser with WebGL2 enabled.` : loading.label || 'Starting engine'}</div>
          <div className="glass" style={{ padding: 18, maxWidth: 620, width: '100%' }}>
            <Controls />
          </div>
          <div className="loading-tip">💡 {tip}</div>
        </div>
      )}
    </div>
  );
}
