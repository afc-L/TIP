import { useEffect, useState } from 'react';
import { flow } from '../app/flow';
import { CONFIG } from '../game/GameConfig';
import { useGame } from '../store/gameStore';
import { Btn, RARITY_COLOR } from './ui';

export function LevelUpScreen() {
  const lu = useGame((s) => s.levelUp);
  const [picked, setPicked] = useState<number | null>(null);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    setPicked(null);
    // brief delay so a held key or click can't instantly pick a card
    setArmed(false);
    const t = setTimeout(() => setArmed(true), 350);
    return () => clearTimeout(t);
  }, [lu?.cards]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!armed || !lu) return;
      const n = Number(e.key);
      if (n >= 1 && n <= lu.cards.length) choose(n - 1);
      if (e.code === 'KeyR') flow.reroll();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!lu) return null;
  const choose = (i: number) => {
    if (!armed || picked !== null) return;
    setPicked(i);
    setTimeout(() => flow.chooseUpgrade(i), 220);
  };

  return (
    <div className="overlay levelup">
      <div className="levelup-title pop-in">LEVEL UP!</div>
      <div className="levelup-sub">Level {lu.level}{lu.pending > 1 ? ` · ${lu.pending - 1} more to choose` : ''} · Pick an upgrade (1-{lu.cards.length})</div>
      <div className="cards">
        {lu.cards.map((c, i) => (
          <div key={c.key} className="card-wrap">
          <button className={`card rarity-${c.rarity} ${picked === i ? 'picked' : ''} ${picked !== null && picked !== i ? 'faded' : ''}`}
            style={{ ['--r' as string]: RARITY_COLOR[c.rarity], ['--c' as string]: c.color, animationDelay: `${i * 70}ms` }}
            onClick={() => choose(i)}>
            <div className="card-rarity">{c.rarity.toUpperCase()}</div>
            <div className="card-icon">{c.icon}</div>
            <div className="card-kind">{c.kindLabel}</div>
            <div className="card-name">{c.name}</div>
            <div className="card-level">{c.levelText}</div>
            <div className="card-effect">{c.effectText}</div>
            <div className="card-desc">{c.description}</div>
            <div className="card-key">{i + 1}</div>
          </button>
          {lu.banishes > 0 && c.rarity !== 'evolution' && picked === null && (
            <button className="banish" title="Banish: never offer this again this run" onClick={() => flow.banish(i)}>✕ Banish</button>
          )}
          </div>
        ))}
      </div>
      <div className="row-btns">
        <Btn onClick={() => flow.reroll()} disabled={lu.rerolls <= 0}>🎲 Reroll ({lu.rerolls}) <kbd>R</kbd></Btn>
        <Btn onClick={() => flow.skipUpgrade()}>Skip (+{CONFIG.levelUp.skipGold} gold)</Btn>
        <span className="banish-count" title="Banished upgrades never appear again this run">🚫 {lu.banishes} banish{lu.banishes === 1 ? '' : 'es'} left</span>
      </div>
    </div>
  );
}
