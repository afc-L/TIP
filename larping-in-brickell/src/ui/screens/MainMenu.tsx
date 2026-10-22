import { useMemo, useState } from 'react';
import { useGame } from '../../game/store';
import { useUI } from '../../game/uiStore';
import { hasSave } from '../../game/systems/save';
import { Btn, Confirm, Controls, Panel } from '../common';
import { SettingsPanel } from '../panels/Settings';
import { audio } from '../../game/engine/audio';

function Skyline() {
  const towers = useMemo(() => {
    let s = 11;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const out: { x: number; w: number; h: number; c: string; lit: number }[] = [];
    let x = 0;
    while (x < 1600) {
      const w = 30 + r() * 60;
      out.push({ x, w, h: 80 + r() * 320, c: ['#1a1d28', '#151822', '#1e2230', '#12141c'][Math.floor(r() * 4)], lit: r() });
      x += w + 4 + r() * 10;
    }
    return out;
  }, []);
  return (
    <svg className="menu-skyline" viewBox="0 0 1600 420" preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id="water" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#1b1530" />
          <stop offset="1" stopColor="#050507" />
        </linearGradient>
        <pattern id="win" width="10" height="14" patternUnits="userSpaceOnUse">
          <rect x="2" y="3" width="5" height="7" fill="#ffd27a" opacity="0.55" />
        </pattern>
      </defs>
      {towers.map((t, i) => (
        <g key={i}>
          <rect x={t.x} y={380 - t.h} width={t.w} height={t.h} fill={t.c} />
          {t.lit > 0.35 && <rect x={t.x + 3} y={384 - t.h} width={t.w - 6} height={t.h - 10} fill="url(#win)" opacity={0.25 + t.lit * 0.5} />}
          {t.lit > 0.75 && <rect x={t.x} y={380 - t.h} width={t.w} height="3" fill={i % 2 ? '#ff4fd8' : '#5cc8ff'} />}
        </g>
      ))}
      <rect x="0" y="380" width="1600" height="40" fill="url(#water)" />
    </svg>
  );
}

export function MainMenu() {
  const [view, setView] = useState<'main' | 'new' | 'settings' | 'credits' | 'controls'>('main');
  const [nick, setNick] = useState('');
  const [confirm, setConfirm] = useState<null | 'reset' | 'overwrite'>(null);
  const [saveExists, setSaveExists] = useState(hasSave());
  const { newGame, continueGame, resetSave } = useGame();
  const setScreen = useUI((s) => s.setScreen);

  const start = (fresh: boolean) => {
    audio.init();
    if (fresh) newGame(nick || 'Boss');
    else if (!continueGame()) {
      useUI.getState().notify('Save file could not be loaded. Starting fresh.', 'warn');
      newGame(nick || 'Boss');
    }
    useUI.setState({ panel: null, waypoint: null });
    setScreen('loading');
  };

  return (
    <div className="menu-screen">
      <Skyline />
      <div className="menu-inner">
        <div className="logo-kicker">A MIAMI LUXURY LIFESTYLE SIMULATOR</div>
        <h1 className="logo">LARPING<br /><i>in</i> BRICKELL</h1>
        <p className="tagline">One Maybach. Zero chill. Build an empire, collect the flex, become the King of Brickell.</p>
        {view === 'main' && (
          <div className="menu-buttons">
            {saveExists && <Btn kind="gold" big onClick={() => start(false)}>Continue</Btn>}
            <Btn kind={saveExists ? undefined : 'gold'} big onClick={() => setView('new')}>{saveExists ? 'New Game' : 'Play'}</Btn>
            <Btn onClick={() => setView('controls')}>Controls</Btn>
            <Btn onClick={() => setView('settings')}>Settings</Btn>
            <Btn onClick={() => setView('credits')}>Credits</Btn>
            {saveExists && <Btn kind="danger" small onClick={() => setConfirm('reset')}>Reset Save</Btn>}
          </div>
        )}
        {view === 'new' && (
          <div className="menu-buttons">
            <input className="name-input" placeholder="Your nickname (e.g. Big Bounce)" maxLength={20} value={nick} onChange={(e) => setNick(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && (saveExists ? setConfirm('overwrite') : start(true))} />
            <Btn kind="gold" big onClick={() => (saveExists ? setConfirm('overwrite') : start(true))}>Start the Hustle</Btn>
            <Btn kind="ghost" onClick={() => setView('main')}>Back</Btn>
          </div>
        )}
      </div>
      {view === 'settings' && <SettingsPanel onClose={() => setView('main')} />}
      {view === 'controls' && (
        <Panel title="Controls" size="narrow" onClose={() => setView('main')}>
          <Controls />
        </Panel>
      )}
      {view === 'credits' && (
        <Panel title="Credits" size="narrow" onClose={() => setView('main')}>
          <div className="col" style={{ gap: 12, fontSize: 14, lineHeight: 1.5 }}>
            <p><b>LARPING IN BRICKELL</b> — a satirical browser game about fake wealth, real hustle and one extremely bouncy SUV.</p>
            <p className="muted">Built with React, TypeScript, Vite and Three.js. All 3D models, textures, music and sound effects are generated procedurally in code — no external assets.</p>
            <p className="muted">All characters, agencies, creators, brands, watches and most vehicles are fictional. AlwaysFans is an original fictional platform; every creator in the game is an adult (18+). Any resemblance to real Brickell influencers is, frankly, inevitable.</p>
            <p className="muted">Fonts: Inter & Playfair Display (Google Fonts, OFL).</p>
          </div>
        </Panel>
      )}
      {confirm === 'reset' && (
        <Confirm text="Delete your save permanently? Your Maybach, empire and clout will be gone." yes="Delete save" onNo={() => setConfirm(null)} onYes={() => { resetSave(); setSaveExists(false); setConfirm(null); }} />
      )}
      {confirm === 'overwrite' && (
        <Confirm text="Starting a new game will overwrite your current save. Continue?" yes="Start over" onNo={() => setConfirm(null)} onYes={() => { setConfirm(null); start(true); }} />
      )}
      <div className="menu-foot">v1.0 · Best with keyboard & mouse · Progress saves automatically in this browser</div>
    </div>
  );
}
