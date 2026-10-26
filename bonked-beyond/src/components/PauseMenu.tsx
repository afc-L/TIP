import { useState } from 'react';
import { flow } from '../app/flow';
import { ControlsGuide } from './ControlsGuide';
import { Inventory } from './Inventory';
import { SettingsMenu } from './SettingsMenu';
import { Btn, Confirm } from './ui';

export function PauseMenu() {
  const [tab, setTab] = useState<'main' | 'settings' | 'controls' | 'inventory'>('main');
  const [confirm, setConfirm] = useState<'restart' | 'quit' | null>(null);
  return (
    <div className="overlay pause">
      <div className="panel pause-panel pop-in">
        <h2>PAUSED</h2>
        <div className="tabs">
          {(['main', 'inventory', 'controls', 'settings'] as const).map((t) => (
            <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t === 'main' ? 'Menu' : t[0].toUpperCase() + t.slice(1)}</button>
          ))}
        </div>
        {tab === 'main' && (
          <div className="menu-buttons">
            <Btn variant="primary" big onClick={() => flow.resume()}>▶ Resume</Btn>
            <Btn onClick={() => setConfirm('restart')}>↻ Restart Run</Btn>
            <Btn onClick={() => setTab('settings')}>⚙ Settings</Btn>
            <Btn variant="danger" onClick={() => setConfirm('quit')}>✕ Quit to Main Menu</Btn>
          </div>
        )}
        {tab === 'inventory' && <Inventory />}
        {tab === 'controls' && <ControlsGuide />}
        {tab === 'settings' && <SettingsMenu embedded />}
      </div>
      {confirm && (
        <Confirm
          title={confirm === 'restart' ? 'Restart run?' : 'Quit to menu?'}
          text="Your current run will be discarded. No rewards are earned for an abandoned run."
          confirm={confirm === 'restart' ? 'Restart' : 'Quit'}
          onCancel={() => setConfirm(null)}
          onConfirm={() => { setConfirm(null); if (confirm === 'restart') flow.restart(); else flow.quitToMenu(); }}
        />
      )}
    </div>
  );
}
