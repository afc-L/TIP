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
        {(r.synergies.length > 0 || r.modifiers.length > 0) && (
          <div className="results-ach">
            {r.synergies.length > 0 && <><h4>Synergies</h4>{r.synergies.map((s) => <span key={s.name} className="chip evo">{s.icon} {s.name}</span>)}</>}
            {r.modifiers.length > 0 && <><h4>Run modifiers</h4>{r.modifiers.map((m) => <span key={m.name} className="chip">{m.icon} {m.name}</span>)}</>}
          </div>
        )}
        {r.achievements.length > 0 && (
          <div className="results-ach"><h4>Achievements unlocked</h4>{r.achievements.map((a) => <span key={a.name} className="chip ach">{a.icon} {a.name}</span>)}</div>
        )}
        {r.unlocks.length > 0 && (
          <div className="results-unlocks"><h4>🔓 New content unlocked</h4>{r.unlocks.map((u) => <span key={u} className="chip unlock">{u}</span>)}</div>
        )}
        {r.challenges.length > 0 && (
          <div className="results-ach"><h4>Challenges completed — claim them in the Challenges menu</h4>{r.challenges.map((c) => <span key={c.name} className="chip evo">{c.icon} {c.name}</span>)}</div>
        )}
        <div className="currency-earned">+{r.currency.toLocaleString()} 🪙 Bonk Coins <span className="dim">(reward x{r.rewardMult} · total {currency.toLocaleString()})</span></div>
        <div className="row-btns">
          <Btn variant="primary" big onClick={() => flow.restart()}>{r.victory ? '↻ Play Again' : '↻ Retry'}</Btn>
          <Btn big onClick={() => flow.quitToMenu()}>Main Menu</Btn>
        </div>
      </div>
    </div>
  );
}
