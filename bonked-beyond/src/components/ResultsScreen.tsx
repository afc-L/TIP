import { flow } from '../app/flow';
import { formatNumber, formatTime } from '../game/util';
import { useGame } from '../store/gameStore';
import { useProgression } from '../store/progressionStore';
import { Btn } from './ui';

export function ResultsScreen() {
  const r = useGame((s) => s.result);
  const currency = useProgression((s) => s.save.currency);
  if (!r) return null;
  const stats: [string, string][] = [
    ['Survival time', formatTime(r.time)], ['Enemies defeated', formatNumber(r.kills)], ['Final level', String(r.level)],
    ['Bosses defeated', String(r.bosses)], ['Elites defeated', String(r.elites)], ['Gold collected', formatNumber(r.gold)],
    ['Damage dealt', formatNumber(r.damageDealt)], ['Damage taken', formatNumber(r.damageTaken)], ['Biggest hit', formatNumber(r.highestHit)],
  ];
  return (
    <div className={`overlay results ${r.victory ? 'victory' : 'defeat'}`}>
      <div className="panel results-panel pop-in">
        <div className="results-title">{r.victory ? 'VICTORY!' : 'BONKED!'}</div>
        <div className="results-sub">{r.character} · {r.map} · {r.mode} · {r.difficulty}</div>
        <div className="record">
          {r.newRecord ? <span className="new-record">★ NEW PERSONAL BEST on this map! ★</span>
            : <span>Personal best: {formatTime(r.previousBest)} ({r.time >= r.previousBest ? '+' : '−'}{formatTime(Math.abs(r.previousBest - r.time))})</span>}
        </div>
        <div className="results-grid">
          {stats.map(([k, v]) => <div key={k} className="rg-cell"><span>{k}</span><b>{v}</b></div>)}
        </div>
        <div className="results-loadout">
          <div><h4>Weapons</h4>{r.weapons.map((w) => <span key={w.name} className={`chip ${w.evolved ? 'evo' : ''}`}>{w.icon} {w.name} {w.evolved ? '★' : `Lv${w.level}`}</span>)}</div>
          <div><h4>Items</h4>{r.passives.length ? r.passives.map((p) => <span key={p.name} className="chip">{p.icon} {p.name} Lv{p.level}</span>) : <span className="dim">None</span>}</div>
        </div>
        {r.achievements.length > 0 && (
          <div className="results-ach"><h4>Achievements unlocked</h4>{r.achievements.map((a) => <span key={a.name} className="chip ach">{a.icon} {a.name}</span>)}</div>
        )}
        <div className="currency-earned">+{r.currency.toLocaleString()} 🪙 Bonk Coins <span className="dim">(total {currency.toLocaleString()})</span></div>
        <div className="row-btns">
          <Btn variant="primary" big onClick={() => flow.restart()}>↻ Retry</Btn>
          <Btn big onClick={() => flow.quitToMenu()}>Main Menu</Btn>
        </div>
      </div>
    </div>
  );
}
