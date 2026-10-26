import { flow } from '../app/flow';
import { useGame } from '../store/gameStore';
import { useProgression } from '../store/progressionStore';
import { CollectionScreen } from './CollectionScreen';
import { Credits } from './Credits';
import { PermanentUpgrades } from './PermanentUpgrades';
import { SettingsMenu } from './SettingsMenu';
import { StatisticsScreen } from './StatisticsScreen';
import { Btn } from './ui';

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className={`logo ${small ? 'logo-small' : ''}`}>
      <div className="logo-bonked">BONKED</div>
      <div className="logo-beyond">BEYOND</div>
    </div>
  );
}

export function MainMenu() {
  const page = useGame((s) => s.menuPage);
  const setPage = useGame((s) => s.setMenuPage);
  const currency = useProgression((s) => s.save.currency);
  const back = () => setPage('home');

  if (page === 'upgrades') return <PermanentUpgrades onBack={back} />;
  if (page === 'collection') return <CollectionScreen onBack={back} />;
  if (page === 'stats') return <StatisticsScreen onBack={back} />;
  if (page === 'settings') return <div className="screen menu-page"><SettingsMenu onBack={back} /></div>;
  if (page === 'credits') return <Credits onBack={back} />;

  return (
    <div className="screen main-menu">
      <div className="menu-left fade-in">
        <Logo />
        <p className="tagline">A chaotic survival roguelike. Bonk everything. Survive the horde.</p>
        <div className="menu-buttons">
          <Btn variant="primary" big onClick={() => flow.toCharacterSelect()}>▶ PLAY</Btn>
          <Btn onClick={() => setPage('upgrades')}>⬆ Permanent Upgrades</Btn>
          <Btn onClick={() => setPage('collection')}>📖 Collection</Btn>
          <Btn onClick={() => setPage('stats')}>📊 Statistics</Btn>
          <Btn onClick={() => setPage('settings')}>⚙ Settings</Btn>
          <Btn onClick={() => setPage('credits')}>★ Credits</Btn>
        </div>
        <div className="wallet">🪙 <b>{currency.toLocaleString()}</b> Bonk Coins</div>
      </div>
      <div className="menu-hint">WASD to move · Weapons fire automatically · Space to dodge</div>
    </div>
  );
}
