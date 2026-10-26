import { useEffect } from 'react';
import { flow } from '../app/flow';
import { ACHIEVEMENT_MAP } from '../data/achievements';
import { MAPS } from '../data/maps';
import { BOSSES } from '../data/enemies';
import { MODIFIER_MAP, MODIFIERS, rollModifiers } from '../data/modifiers';
import { audio } from '../game/effects/AudioManager';
import type { RunMode } from '../data/types';
import { DIFFICULTY, RUN_MODES } from '../game/GameConfig';
import { engine } from '../game/Engine';
import { formatTime } from '../game/util';
import { isUnlocked, useProgression } from '../store/progressionStore';
import { useSettings } from '../store/settingsStore';
import { Btn, PageHeader, Stars } from './ui';

export function MapSelect() {
  const save = useProgression((s) => s.save);
  const update = useProgression((s) => s.update);
  const difficulty = useSettings((s) => s.difficulty);
  const setSetting = useSettings((s) => s.set);
  const selected = MAPS.find((m) => m.id === save.selectedMap) ?? MAPS[0];
  const unlocked = isUnlocked(selected.unlock, save);

  useEffect(() => { engine.showcase.setMap(selected.id); }, [selected.id]);

  return (
    <div className="screen select-screen">
      <PageHeader title="CHOOSE YOUR BATTLEGROUND" onBack={() => flow.toCharacterSelect()} />
      <div className="map-grid">
        {MAPS.map((m) => {
          const ok = isUnlocked(m.unlock, save);
          return (
            <button key={m.id} className={`map-card ${m.id === selected.id ? 'active' : ''} ${ok ? '' : 'locked'}`}
              onClick={() => update((s) => { s.selectedMap = m.id; })}
              style={{ background: `linear-gradient(160deg, ${m.palette.sky}cc, ${m.palette.ground}ee 60%, ${m.palette.rock})` }}>
              <div className="map-name">{m.name}</div>
              <div className="map-sub">{m.subtitle}</div>
              <Stars n={m.difficultyStars} />
              {!ok && <div className="map-lock">🔒 {ACHIEVEMENT_MAP[m.unlock!]?.description}</div>}
              {ok && save.bestTimeByMap[m.id] ? <div className="map-best">Best: {formatTime(save.bestTimeByMap[m.id])}</div> : null}
            </button>
          );
        })}
      </div>
      <div className="map-bottom panel">
        <div className="map-info">
          <h3>{selected.name}</h3>
          <p>{selected.description}</p>
          <ul className="mods">{selected.modifiers.map((t) => <li key={t}>{t}</li>)}</ul>
          <div className="map-facts">
            <div><span className="k">Hazard</span> {selected.hazardText}</div>
            <div><span className="k">Bosses</span> {selected.bosses.map((b) => BOSSES[b].name).join(' → ')}</div>
          </div>
          <div className="mod-box">
            <label className="mod-toggle" onClick={() => { update((s) => { s.modifiersEnabled = !s.modifiersEnabled; if (!s.rolledModifiers.length) s.rolledModifiers = rollModifiers(); }); audio.play('click'); }}>
              <span className={`switch ${save.modifiersEnabled ? 'on' : ''}`}><i /></span>
              <b>Run modifiers</b> <span className="dim">{save.modifiersEnabled ? 'random twists for this run' : 'off: standard run'}</span>
            </label>
            {save.modifiersEnabled && (
              <div className="mod-chips">
                {save.rolledModifiers.map((id) => (
                  <div key={id} className="mod-chip" title={MODIFIER_MAP[id].description}>
                    <span>{MODIFIER_MAP[id].icon}</span>
                    <div><b>{MODIFIER_MAP[id].name}</b><div className="dim">{MODIFIER_MAP[id].description}</div>
                      <div className="mod-reward">{MODIFIER_MAP[id].reward > 0 ? `+${Math.round(MODIFIER_MAP[id].reward * 100)}% rewards` : MODIFIER_MAP[id].reward < 0 ? `${Math.round(MODIFIER_MAP[id].reward * 100)}% rewards` : 'no reward change'}</div></div>
                  </div>
                ))}
                <Btn onClick={() => update((s) => { s.rolledModifiers = rollModifiers(); })}>🎲 Reroll modifiers</Btn>
                <span className="dim small">{MODIFIERS.length} modifiers exist. Rewards scale with the challenge.</span>
              </div>
            )}
          </div>
        </div>
        <div className="map-options">
          <div className="opt-group">
            <span className="opt-label">Mode</span>
            <div className="seg">
              {(Object.keys(RUN_MODES) as RunMode[]).map((k) => (
                <button key={k} className={save.selectedMode === k ? 'on' : ''} onClick={() => update((s) => { s.selectedMode = k; })}>{RUN_MODES[k].label}</button>
              ))}
            </div>
            <span className="opt-desc">{RUN_MODES[save.selectedMode].description}</span>
          </div>
          <div className="opt-group">
            <span className="opt-label">Difficulty</span>
            <div className="seg">
              {(Object.keys(DIFFICULTY) as (keyof typeof DIFFICULTY)[]).map((k) => (
                <button key={k} className={difficulty === k ? 'on' : ''} onClick={() => setSetting('difficulty', k)}>{DIFFICULTY[k].label}</button>
              ))}
            </div>
            <span className="opt-desc">Rewards x{DIFFICULTY[difficulty].reward}</span>
          </div>
          {unlocked
            ? <Btn variant="primary" big onClick={() => flow.startRun()}>⚔ START RUN</Btn>
            : <div className="locked-box">🔒 Locked: {ACHIEVEMENT_MAP[selected.unlock!]?.description}</div>}
        </div>
      </div>
    </div>
  );
}
