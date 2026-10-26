import { useEffect } from 'react';
import { flow } from '../app/flow';
import { ACHIEVEMENT_MAP } from '../data/achievements';
import { CHARACTERS } from '../data/characters';
import { WEAPON_MAP } from '../data/weapons';
import { engine } from '../game/Engine';
import { isUnlocked, useProgression } from '../store/progressionStore';
import { Bar, Btn, PageHeader, Stars } from './ui';

export function CharacterSelect() {
  const save = useProgression((s) => s.save);
  const update = useProgression((s) => s.update);
  const selected = CHARACTERS.find((c) => c.id === save.selectedCharacter) ?? CHARACTERS[0];
  const unlocked = isUnlocked(selected.unlock, save);

  useEffect(() => { engine.showcase.setCharacter(selected.id); }, [selected.id]);

  const weapon = WEAPON_MAP[selected.weapon];
  return (
    <div className="screen select-screen">
      <PageHeader title="CHOOSE YOUR BONKER" subtitle="Each hero plays very differently" onBack={() => flow.backToMenu()} />
      <div className="select-body">
        <div className="char-list">
          {CHARACTERS.map((c) => {
            const ok = isUnlocked(c.unlock, save);
            return (
              <button key={c.id} className={`char-tile ${c.id === selected.id ? 'active' : ''} ${ok ? '' : 'locked'}`}
                style={{ ['--accent' as string]: c.color }}
                onClick={() => update((s) => { s.selectedCharacter = c.id; })}>
                <span className="char-dot" />
                <span className="char-tile-name">{c.name}</span>
                {!ok && <span className="lock">🔒</span>}
              </button>
            );
          })}
        </div>
        <div className="char-detail panel slide-in" key={selected.id}>
          <div className="char-title" style={{ color: selected.color }}>{selected.name}</div>
          <div className="char-sub">{selected.title}</div>
          <p className="char-desc">{selected.description}</p>
          <div className="char-stats">
            <Bar label={`Health ${selected.baseHp}`} value={selected.baseHp} max={180} color="#ff4d6d" />
            <Bar label={`Speed ${selected.moveSpeed.toFixed(1)}`} value={selected.moveSpeed} max={8} color="#4cc9f0" />
          </div>
          <div className="char-info">
            <div><span className="k">Starting weapon</span><span className="v">{weapon.icon} {weapon.name}</span></div>
            <div><span className="k">Passive · {selected.passiveName}</span><span className="v">{selected.passiveText}</span></div>
            <div><span className="k">Difficulty</span><span className="v"><Stars n={selected.difficulty} /></span></div>
          </div>
          {unlocked ? (
            <Btn variant="primary" big onClick={() => flow.toMapSelect()}>Choose Map →</Btn>
          ) : (
            <div className="locked-box">🔒 <b>Locked.</b> Unlock: {ACHIEVEMENT_MAP[selected.unlock!]?.description}</div>
          )}
        </div>
      </div>
    </div>
  );
}
