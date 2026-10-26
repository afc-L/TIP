import { useEffect, useRef, useState } from 'react';
import { flow } from '../app/flow';
import { CHARACTER_MAP } from '../data/characters';
import { engine } from '../game/Engine';
import { input } from '../game/Input';
import { formatTime } from '../game/util';
import { useGame, type HudItem } from '../store/gameStore';
import { useSettings } from '../store/settingsStore';

function ItemIcons({ items, slots }: { items: HudItem[]; slots: number }) {
  return (
    <div className="hud-items">
      {Array.from({ length: slots }, (_, i) => {
        const it = items[i];
        return (
          <div key={i} className={`hud-item ${it ? '' : 'empty'} ${it?.evolved ? 'evolved' : ''}`} style={it ? { ['--c' as string]: it.color } : undefined}>
            {it && <><span className="hi-icon">{it.icon}</span><span className="hi-lvl">{it.evolved ? '★' : it.level}</span></>}
          </div>
        );
      })}
    </div>
  );
}

function Announcement() {
  const a = useGame((s) => s.announcement);
  const [shown, setShown] = useState<typeof a>(null);
  useEffect(() => {
    if (!a) return;
    setShown(a);
    const t = setTimeout(() => setShown((cur) => (cur?.id === a.id ? null : cur)), a.big ? 2200 : 2800);
    return () => clearTimeout(t);
  }, [a]);
  if (!shown) return null;
  return <div key={shown.id} className={`announce ${shown.big ? 'big' : ''}`}>{shown.text}</div>;
}

export function Toasts() {
  const toasts = useGame((s) => s.toasts);
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          <span className="toast-icon">{t.icon}</span>
          <div><div className="toast-title">{t.title}</div><div className="toast-text">{t.text}</div></div>
        </div>
      ))}
    </div>
  );
}

function BossBar() {
  const b = useGame((s) => s.boss);
  if (!b) return null;
  return (
    <div className={`boss-bar ${b.enraged ? 'enraged' : ''}`}>
      <div className="boss-name">{b.name}{b.enraged && <span className="enr"> — OVERDRIVE</span>}</div>
      <div className="boss-track"><div className="boss-fill" style={{ width: `${(b.hp / b.maxHp) * 100}%` }} /></div>
    </div>
  );
}

function TouchControls() {
  const [touch, setTouch] = useState(false);
  const knob = useRef<HTMLDivElement>(null);
  const origin = useRef<{ x: number; y: number; id: number } | null>(null);
  useEffect(() => {
    const on = () => setTouch(true);
    window.addEventListener('touchstart', on, { once: true });
    return () => window.removeEventListener('touchstart', on);
  }, []);
  if (!touch) return null;
  const move = (x: number, y: number) => {
    const o = origin.current!;
    let dx = x - o.x, dy = y - o.y;
    const l = Math.hypot(dx, dy), max = 55;
    if (l > max) { dx = (dx / l) * max; dy = (dy / l) * max; }
    input.touchMove.x = dx / max; input.touchMove.z = dy / max; input.touchMove.active = true;
    if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  return (
    <>
      <div className="touch-zone"
        onTouchStart={(e) => { const t = e.changedTouches[0]; origin.current = { x: t.clientX, y: t.clientY, id: t.identifier }; move(t.clientX, t.clientY); }}
        onTouchMove={(e) => { for (const t of Array.from(e.changedTouches)) if (t.identifier === origin.current?.id) move(t.clientX, t.clientY); }}
        onTouchEnd={() => { origin.current = null; input.touchMove.active = false; input.touchMove.x = input.touchMove.z = 0; if (knob.current) knob.current.style.transform = ''; }}>
        <div className="joystick"><div className="joy-knob" ref={knob} /></div>
      </div>
      <div className="touch-buttons">
        <button className="tbtn" onTouchStart={() => input.press('super')}>💥</button>
        <button className="tbtn" onTouchStart={() => input.press('dodge')}>💨</button>
        <button className="tbtn small" onTouchStart={() => input.press('interact')}>E</button>
      </div>
    </>
  );
}

export function GameHUD() {
  const hud = useGame((s) => s.hud);
  const interact = useGame((s) => s.interact);
  const showFps = useSettings((s) => s.showFps);
  if (!hud) return null;
  const run = engine.run;
  const ch = run ? CHARACTER_MAP[run.characterId] : null;
  const hpPct = (hud.hp / hud.maxHp) * 100;
  return (
    <div className="hud">
      <div className="hud-top-left">
        <div className="portrait" style={{ ['--c' as string]: ch?.color ?? '#fff' }}>
          <div className="portrait-name">{ch?.name}</div>
          <div className="portrait-lvl">LV {hud.level}</div>
        </div>
        <div className="hud-bars">
          <div className={`hp-bar ${hpPct < 30 ? 'low' : ''}`}>
            <div className="hp-fill" style={{ width: `${hpPct}%` }} />
            <span>{Math.ceil(hud.hp)} / {hud.maxHp}</span>
          </div>
          <ItemIcons items={hud.weapons} slots={6} />
          <ItemIcons items={hud.passives} slots={6} />
        </div>
      </div>
      <div className="hud-top-center">
        <div className="timer">{formatTime(hud.time)}</div>
        {hud.objective && <div className="objective">{hud.objective}</div>}
        <BossBar />
      </div>
      <div className="hud-top-right">
        <div className="counter">💀 {hud.kills.toLocaleString()}</div>
        <div className="counter gold">🪙 {hud.gold}</div>
        {showFps && <div className="counter small">{hud.fps} fps · {hud.enemies} foes</div>}
        <button className="pause-btn" onClick={() => flow.togglePause()} aria-label="Pause">⏸</button>
      </div>
      <div className="hud-buffs">
        {hud.buffs.map((b) => <div key={b.id} className="buff">{b.icon}<span>{b.left < 0 ? `x${-b.left}` : Math.ceil(b.left)}</span></div>)}
      </div>
      <div className="hud-bottom">
        <div className="abilities">
          <div className={`ability ${hud.dodgeReady >= 1 ? 'ready' : ''}`} title="Dodge (Space / Right-click)">
            <div className="ab-fill" style={{ height: `${hud.dodgeReady * 100}%` }} /><span>💨</span><kbd>SPACE</kbd>
          </div>
          <div className={`ability super ${hud.superCharge >= 1 ? 'ready' : ''}`} title="Super Bonk (Q / Left-click)">
            <div className="ab-fill" style={{ height: `${hud.superCharge * 100}%` }} /><span>💥</span><kbd>Q</kbd>
          </div>
          <div className="stamina"><div style={{ width: `${hud.stamina * 100}%` }} /></div>
        </div>
        <div className="xp-bar">
          <div className="xp-fill" style={{ width: `${(hud.xp / hud.xpNext) * 100}%` }} />
          <span>LEVEL {hud.level}</span>
        </div>
      </div>
      {interact && <div className="interact"><kbd>E</kbd> {interact}</div>}
      <Announcement />
      <TouchControls />
    </div>
  );
}
