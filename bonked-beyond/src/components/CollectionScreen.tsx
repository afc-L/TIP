import { useState } from 'react';
import { ACHIEVEMENT_MAP } from '../data/achievements';
import { BOSSES, ENEMIES } from '../data/enemies';
import { PASSIVE_MAP, PASSIVES } from '../data/passives';
import { WEAPONS } from '../data/weapons';
import { isUnlocked, useProgression } from '../store/progressionStore';
import { PageHeader } from './ui';

const ENEMY_ICON: Record<string, string> = { slime: '🟢', bigSlime: '👑', goblin: '👺', brute: '🦏', shaman: '🧙', exploder: '💣' };

export function CollectionScreen({ onBack }: { onBack: () => void }) {
  const save = useProgression((s) => s.save);
  const [tab, setTab] = useState<'weapons' | 'items' | 'enemies'>('weapons');
  const seen = new Set(save.discovered);
  return (
    <div className="screen menu-page">
      <PageHeader title="COLLECTION" subtitle="Weapons, evolutions, items and foes" onBack={onBack} />
      <div className="tabs center">
        {(['weapons', 'items', 'enemies'] as const).map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}
      </div>
      <div className="codex">
        {tab === 'weapons' && WEAPONS.map((w) => {
          const unlocked = isUnlocked(w.unlock, save);
          const evoSeen = seen.has('evo:' + w.id);
          return (
            <div key={w.id} className={`codex-card panel ${unlocked ? '' : 'locked'}`}>
              <div className="cx-head"><span className="cx-icon">{unlocked ? w.icon : '🔒'}</span><div><div className="cx-name">{w.name}</div><div className="cx-sub">{unlocked ? w.description : `Unlock: ${ACHIEVEMENT_MAP[w.unlock!]?.description}`}</div></div></div>
              <div className="cx-evo">
                <span className="cx-evo-icon">{evoSeen ? w.evolution.icon : '❔'}</span>
                <div><div className="cx-evo-name">{evoSeen ? w.evolution.name : 'Evolution'}{!evoSeen && <span className="dim"> (not yet discovered)</span>}</div>
                  <div className="cx-sub">Requires: {w.name} Lv 8 + {PASSIVE_MAP[w.evolution.passive].icon} {PASSIVE_MAP[w.evolution.passive].name} Lv {w.evolution.passiveLevel}</div>
                  {evoSeen && <div className="cx-sub">{w.evolution.description}</div>}</div>
              </div>
            </div>
          );
        })}
        {tab === 'items' && PASSIVES.map((p) => (
          <div key={p.id} className="codex-card panel">
            <div className="cx-head"><span className="cx-icon">{p.icon}</span><div><div className="cx-name">{p.name} <span className="dim">max Lv {p.maxLevel}</span></div><div className="cx-sub">{p.description}</div><div className="cx-sub">At max: {p.levelText(p.maxLevel)}</div></div></div>
          </div>
        ))}
        {tab === 'enemies' && <>
          {Object.values(ENEMIES).map((e) => (
            <div key={e.kind} className="codex-card panel">
              <div className="cx-head"><span className="cx-icon">{ENEMY_ICON[e.kind]}</span><div><div className="cx-name">{e.name}</div><div className="cx-sub">{e.description}</div><div className="cx-sub">HP {e.hp} · Damage {e.damage} · Speed {e.speed}</div></div></div>
            </div>
          ))}
          {Object.values(BOSSES).map((b) => {
            const met = seen.has('boss:' + b.id);
            return (
              <div key={b.id} className="codex-card panel boss">
                <div className="cx-head"><span className="cx-icon">{met ? (b.id === 'stumpKing' ? '🌳' : '🤖') : '❔'}</span><div><div className="cx-name">{met ? b.name : '??? (BOSS)'}</div><div className="cx-sub">{met ? b.description : 'Survive long enough to meet this boss.'}</div>{met && <div className="cx-sub">Attacks: {b.attacks.join(' · ')}</div>}</div></div>
              </div>
            );
          })}
        </>}
      </div>
    </div>
  );
}
