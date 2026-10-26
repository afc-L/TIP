import { useState } from 'react';
import { PERMANENT_UPGRADES, upgradeCost } from '../data/permanentUpgrades';
import { audio } from '../game/effects/AudioManager';
import { useProgression } from '../store/progressionStore';
import { Btn, Confirm, PageHeader } from './ui';

export function PermanentUpgrades({ onBack }: { onBack: () => void }) {
  const save = useProgression((s) => s.save);
  const buy = useProgression((s) => s.buyUpgrade);
  const reset = useProgression((s) => s.resetProgress);
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="screen menu-page">
      <PageHeader title="PERMANENT UPGRADES" subtitle="Spend Bonk Coins earned from runs. Bonuses apply to every run." onBack={onBack}
        right={<div className="wallet">🪙 <b>{save.currency.toLocaleString()}</b></div>} />
      <div className="upgrade-grid">
        {PERMANENT_UPGRADES.map((u) => {
          const rank = save.upgrades[u.id] ?? 0;
          const maxed = rank >= u.maxRank;
          const cost = upgradeCost(u, rank);
          const afford = save.currency >= cost;
          return (
            <div key={u.id} className={`upgrade-card panel ${maxed ? 'maxed' : ''}`}>
              <div className="uc-icon">{u.icon}</div>
              <div className="uc-name">{u.name}</div>
              <div className="uc-desc">{u.description}</div>
              <div className="pips">{Array.from({ length: u.maxRank }, (_, i) => <i key={i} className={i < rank ? 'on' : ''} />)}</div>
              <div className="uc-effect">{rank > 0 ? `Now: ${u.effectText(rank)}` : 'Not purchased'}{!maxed && <><br /><span className="next">Next: {u.effectText(rank + 1)}</span></>}</div>
              {maxed ? <div className="uc-max">MAXED</div> : (
                <Btn variant={afford ? 'gold' : 'ghost'} disabled={!afford} onClick={() => { if (buy(u.id)) audio.play('select'); }}>🪙 {cost}</Btn>
              )}
            </div>
          );
        })}
      </div>
      <div className="danger-zone">
        <Btn variant="danger" onClick={() => setConfirm(true)}>Reset all progression</Btn>
      </div>
      {confirm && (
        <Confirm title="Reset ALL progression?" text="This permanently deletes currency, upgrades, unlocks, achievements and statistics. This cannot be undone."
          confirm="Delete everything" onCancel={() => setConfirm(false)} onConfirm={() => { reset(); setConfirm(false); }} />
      )}
    </div>
  );
}
