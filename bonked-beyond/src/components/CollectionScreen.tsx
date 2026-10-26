import { useState } from 'react';
import { ACHIEVEMENT_MAP, ACHIEVEMENTS } from '../data/achievements';
import { CHARACTERS } from '../data/characters';
import { BOSSES, ELITE_MODS, ENEMIES } from '../data/enemies';
import { MAPS } from '../data/maps';
import { MODIFIERS } from '../data/modifiers';
import { PASSIVE_MAP, PASSIVES } from '../data/passives';
import { SYNERGIES } from '../data/synergies';
import { SPECIALS } from '../data/upgrades';
import { WEAPON_MAP, WEAPONS, weaponStatsAt } from '../data/weapons';
import { isUnlocked, useProgression } from '../store/progressionStore';
import { PageHeader } from './ui';

const ENEMY_ICON: Record<string, string> = {
  slime: '🟢', bigSlime: '👑', goblin: '👺', brute: '🦏', shaman: '🧙', exploder: '💣', swarmBug: '🪲', bombardier: '🎯', stalker: '👤',
  shieldKnight: '🛡️', healer: '🌿', phantom: '👻', burrower: '🪱', beetle: '🪳', archer: '🏹', ogre: '👹',
};
const BOSS_ICON: Record<string, string> = { stumpKing: '🌳', scrapGolem: '🤖', voidDevourer: '🌌', goldenExecutioner: '🪓', crystalColossus: '💎' };

type Tab = 'characters' | 'weapons' | 'items' | 'enemies' | 'bosses' | 'maps' | 'modifiers' | 'synergies' | 'achievements';
const TABS: Tab[] = ['characters', 'weapons', 'items', 'enemies', 'bosses', 'maps', 'modifiers', 'synergies', 'achievements'];

export function CollectionScreen({ onBack }: { onBack: () => void }) {
  const save = useProgression((s) => s.save);
  const [tab, setTab] = useState<Tab>('weapons');
  const seen = new Set(save.discovered);

  const progress: Record<Tab, [number, number]> = {
    characters: [CHARACTERS.filter((c) => isUnlocked(c.unlock, save)).length, CHARACTERS.length],
    weapons: [WEAPONS.filter((w) => seen.has(w.id)).length + WEAPONS.filter((w) => seen.has('evo:' + w.id)).length, WEAPONS.length * 2],
    items: [PASSIVES.filter((p) => seen.has(p.id)).length, PASSIVES.length],
    enemies: [Object.keys(ENEMIES).filter((k) => seen.has('enemy:' + k)).length, Object.keys(ENEMIES).length],
    bosses: [Object.keys(BOSSES).filter((k) => seen.has('boss:' + k)).length, Object.keys(BOSSES).length],
    maps: [MAPS.filter((m) => seen.has('map:' + m.id)).length, MAPS.length],
    modifiers: [MODIFIERS.filter((m) => seen.has('mod:' + m.id)).length, MODIFIERS.length],
    synergies: [SYNERGIES.filter((s) => seen.has('syn:' + s.id)).length, SYNERGIES.length],
    achievements: [ACHIEVEMENTS.filter((a) => save.achievements[a.id]).length, ACHIEVEMENTS.length],
  };
  const total = Object.values(progress).reduce((a, [n]) => a + n, 0), max = Object.values(progress).reduce((a, [, m]) => a + m, 0);

  const Card = ({ known, icon, name, sub, children, cls = '' }: { known: boolean; icon: string; name: string; sub: string; children?: React.ReactNode; cls?: string }) => (
    <div className={`codex-card panel ${known ? '' : 'locked'} ${cls}`}>
      <div className="cx-head"><span className={`cx-icon ${known ? '' : 'silhouette'}`}>{icon}</span><div><div className="cx-name">{known ? name : '???'}</div><div className="cx-sub">{sub}</div></div></div>
      {children}
    </div>
  );

  return (
    <div className="screen menu-page">
      <PageHeader title="CODEX" subtitle={`Everything in Bonked Beyond · ${total}/${max} discovered (${Math.round((total / max) * 100)}%)`} onBack={onBack} />
      <div className="tabs center">
        {TABS.map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)} <span className="tab-count">{progress[t][0]}/{progress[t][1]}</span></button>)}
      </div>
      <div className="codex">
        {tab === 'characters' && CHARACTERS.map((c) => {
          const ok = isUnlocked(c.unlock, save);
          return (
            <Card key={c.id} known={ok} icon={ok ? '🧍' : '🔒'} name={c.name} sub={ok ? c.description : `Unlock: ${ACHIEVEMENT_MAP[c.unlock!]?.description}`}>
              {ok && <div className="cx-sub">HP {c.baseHp} · Speed {c.moveSpeed} · Starts with {WEAPON_MAP[c.weapon].icon} {WEAPON_MAP[c.weapon].name}<br /><b>{c.passiveName}:</b> {c.passiveText}<br />Runs played: {save.characterRuns[c.id] ?? 0}</div>}
            </Card>
          );
        })}
        {tab === 'weapons' && WEAPONS.map((w) => {
          const unlocked = isUnlocked(w.unlock, save);
          const found = seen.has(w.id);
          const evoSeen = seen.has('evo:' + w.id);
          const b = w.base, mx = weaponStatsAt(w, 8);
          return (
            <Card key={w.id} known={found} icon={unlocked ? w.icon : '🔒'} name={w.name}
              sub={!unlocked ? `Unlock: ${ACHIEVEMENT_MAP[w.unlock!]?.description}` : found ? w.description : 'Unlocked — pick it up on a level-up to learn more.'}>
              {found && <div className="cx-stats">DMG {b.damage}→{Math.round(mx.damage)} · CD {b.cooldown}s→{mx.cooldown.toFixed(2)}s · {w.tags.join(' · ')}</div>}
              <div className="cx-evo">
                <span className="cx-evo-icon">{evoSeen ? w.evolution.icon : '❔'}</span>
                <div><div className="cx-evo-name">{evoSeen ? w.evolution.name : 'Evolution'}{!evoSeen && <span className="dim"> (not yet discovered)</span>}</div>
                  <div className="cx-sub">Requires: {w.name} Lv 8 + {PASSIVE_MAP[w.evolution.passive].icon} {PASSIVE_MAP[w.evolution.passive].name} Lv {w.evolution.passiveLevel}</div>
                  {evoSeen && <div className="cx-sub">{w.evolution.description}</div>}</div>
              </div>
            </Card>
          );
        })}
        {tab === 'items' && <>
          {PASSIVES.map((p) => (
            <Card key={p.id} known={seen.has(p.id)} icon={p.icon} name={`${p.name}`} sub={seen.has(p.id) ? `${p.description} At Lv ${p.maxLevel}: ${p.levelText(p.maxLevel)}` : 'Pick this item up in a run to reveal it.'} />
          ))}
          {SPECIALS.map((s) => <Card key={s.id} known icon={s.icon} name={s.name} sub={`Legendary trait: ${s.description}`} cls="legend" />)}
        </>}
        {tab === 'enemies' && <>
          {Object.values(ENEMIES).map((e) => {
            const known = seen.has('enemy:' + e.kind);
            return (
              <Card key={e.kind} known={known} icon={ENEMY_ICON[e.kind]} name={e.name} sub={known ? e.description : 'Encounter it in a run to learn more.'}>
                {known && <div className="cx-stats">{e.role} · HP {e.hp} · DMG {e.damage} · SPD {e.speed}{e.armor ? ` · Armor ${Math.round(e.armor * 100)}%` : ''}{e.resist ? ` · Resist: ${Object.entries(e.resist).map(([k, v]) => `${k} x${v}`).join(', ')}` : ''}</div>}
              </Card>
            );
          })}
          <div className="codex-card panel"><div className="cx-name">Elite modifiers</div>{Object.values(ELITE_MODS).map((m) => <div key={m.id} className="cx-sub"><b style={{ color: m.color }}>{m.name}</b> — {m.description}</div>)}</div>
        </>}
        {tab === 'bosses' && Object.values(BOSSES).map((b) => {
          const met = seen.has('boss:' + b.id);
          const kills = save.bossKills[b.id] ?? 0;
          return (
            <Card key={b.id} known={met} icon={BOSS_ICON[b.id]} name={b.name} sub={met ? `${b.title}. ${b.description}` : `Appears on: ${MAPS.filter((m) => m.bosses.includes(b.id)).map((m) => m.name).join(', ')}`} cls="boss">
              {met && <div className="cx-stats">HP {b.hp.toLocaleString()} · Attacks: {b.attacks.join(' · ')} · Defeated {kills}×</div>}
            </Card>
          );
        })}
        {tab === 'maps' && MAPS.map((m) => {
          const ok = isUnlocked(m.unlock, save);
          return (
            <Card key={m.id} known={ok} icon={ok ? '🗺️' : '🔒'} name={m.name} sub={ok ? m.description : `Unlock: ${ACHIEVEMENT_MAP[m.unlock!]?.description}`}>
              {ok && <div className="cx-stats">{m.modifiers.join(' · ')}<br />Hazard: {m.hazardText}<br />Best: {Math.floor((save.bestTimeByMap[m.id] ?? 0) / 60)}m{Math.floor((save.bestTimeByMap[m.id] ?? 0) % 60)}s</div>}
            </Card>
          );
        })}
        {tab === 'modifiers' && MODIFIERS.map((m) => <Card key={m.id} known={seen.has('mod:' + m.id)} icon={m.icon} name={m.name} sub={seen.has('mod:' + m.id) ? `${m.description} (${m.reward >= 0 ? '+' : ''}${Math.round(m.reward * 100)}% rewards)` : 'Play a run with modifiers enabled to discover it.'} />)}
        {tab === 'synergies' && SYNERGIES.map((s) => <Card key={s.id} known={seen.has('syn:' + s.id)} icon={s.icon} name={s.name} sub={seen.has('syn:' + s.id) ? s.description : `Hint: ${s.hint}`} />)}
        {tab === 'achievements' && ACHIEVEMENTS.map((a) => <Card key={a.id} known={!!save.achievements[a.id]} icon={a.icon} name={a.name} sub={`${a.description} (+${a.reward} 🪙)${a.unlocks ? ` · Unlocks ${a.unlocks}` : ''}`} />)}
      </div>
    </div>
  );
}
