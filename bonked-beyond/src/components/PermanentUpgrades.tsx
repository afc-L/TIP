import { useState } from 'react';
import { BRANCHES, PERMANENT_UPGRADES, upgradeCost, type PermanentUpgradeDef } from '../data/permanentUpgrades';
import { audio } from '../game/effects/AudioManager';
import { useProgression } from '../store/progressionStore';
import { Btn, Confirm, PageHeader } from './ui';

const EXPENSIVE = 300;

export function PermanentUpgrades({ onBack }: { onBack: () => void }) {
  const save = useProgression((s) => s.save);
  const buy = useProgression((s) => s.buyUpgrade);
  const reset = useProgression((s) => s.resetProgress);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmBuy, setConfirmBuy] = useState<PermanentUpgradeDef | null>(null);

  const doBuy = (u: PermanentUpgradeDef) => { if (buy(u.id)) audio.play('select'); else audio.play('deny'); };
  const spent = PERMANENT_UPGRADES.reduce((a, u) => { let c = 0; for (let r = 0; r < (save.upgrades[u.id] ?? 0); r++) c += upgradeCost(u, r); return a + c; }, 0);

  return (
    <div className="screen menu-page">
      <PageHeader title="SKILL TREE" subtitle="Spend Bonk Coins on permanent upgrades. Each node unlocks the next one in its branch." onBack={onBack}
        right={<div className="wallet">🪙 <b>{save.currency.toLocaleString()}</b> <span className="dim">· invested {spent.toLocaleString()}</span></div>} />
      <div className="tree">
        {BRANCHES.map((b) => (
          <div key={b.id} className="branch" style={{ ['--b' as string]: b.color }}>
            <div className="branch-head">{b.icon} {b.name}</div>
            {PERMANENT_UPGRADES.filter((u) => u.branch === b.id).map((u) => {
              const rank = save.upgrades[u.id] ?? 0;
              const maxed = rank >= u.maxRank;
              const cost = upgradeCost(u, rank);
              const locked = !!u.requires && !(save.upgrades[u.requires] ?? 0);
              const afford = save.currency >= cost;
              const req = u.requires ? PERMANENT_UPGRADES.find((x) => x.id === u.requires) : null;
              return (
                <div key={u.id} className={`node panel ${maxed ? 'maxed' : ''} ${locked ? 'locked' : ''}`}>
                  <div className="node-top">
                    <span className="uc-icon">{locked ? '🔒' : u.icon}</span>
                    <div>
                      <div className="uc-name">{u.name}</div>
                      <div className="uc-desc">{u.description}</div>
                    </div>
                  </div>
                  <div className="pips">{Array.from({ length: u.maxRank }, (_, i) => <i key={i} className={i < rank ? 'on' : ''} />)}</div>
                  <div className="uc-effect">{rank > 0 ? `Now: ${u.effectText(rank)}` : 'Not purchased'}{!maxed && <> · <span className="next">Next: {u.effectText(rank + 1)}</span></>}</div>
                  {locked ? <div className="node-lock">Requires {req?.name}</div>
                    : maxed ? <div className="uc-max">MAXED</div>
                    : <Btn variant={afford ? 'gold' : 'ghost'} disabled={!afford} title={afford ? '' : `You need ${cost - save.currency} more coins`}
                        onClick={() => (cost >= EXPENSIVE ? setConfirmBuy(u) : doBuy(u))}>🪙 {cost.toLocaleString()}</Btn>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="danger-zone">
        <Btn variant="danger" onClick={() => setConfirmReset(true)}>Reset all progression</Btn>
      </div>
      {confirmBuy && (
        <Confirm title={`Buy ${confirmBuy.name}?`} text={`This costs ${upgradeCost(confirmBuy, save.upgrades[confirmBuy.id] ?? 0).toLocaleString()} Bonk Coins. ${confirmBuy.effectText((save.upgrades[confirmBuy.id] ?? 0) + 1)}.`}
          confirm="Buy" onCancel={() => setConfirmBuy(null)} onConfirm={() => { doBuy(confirmBuy); setConfirmBuy(null); }} />
      )}
      {confirmReset && (
        <Confirm title="Reset ALL progression?" text="This permanently deletes currency, upgrades, unlocks, achievements, challenges, cosmetics and statistics. This cannot be undone."
          confirm="Delete everything" onCancel={() => setConfirmReset(false)} onConfirm={() => { reset(); setConfirmReset(false); }} />
      )}
    </div>
  );
}
