import { useEffect, useRef } from 'react';
import { useGame, currentMission } from '../game/store';
import { useUI } from '../game/uiStore';
import { useSettings } from '../game/settings';
import { CLOUT_LEVELS, MONTH_DAYS, levelFor } from '../game/data/catalog';
import { POI_BY_ID } from '../game/data/world';
import { VEHICLE_BY_ID } from '../game/data/vehicles';
import { clock, dateLabel, money } from '../game/systems/format';
import { engine, drunkLevel } from '../game/engine/Engine';
import { BASE_SCALE, MAP_BOUNDS, baseMap, drawPlayer } from './mapdraw';

const STYLE_LABEL: Record<string, string> = { executive: 'Executive Bounce', brickell: 'Brickell Bounce', miami: 'MIAMI MODE' };

function CashClout() {
  const cash = useGame((s) => s.game.cash);
  const clout = useGame((s) => s.game.clout);
  const lvl = levelFor(clout);
  const cur = CLOUT_LEVELS[lvl];
  const next = CLOUT_LEVELS[lvl + 1];
  const prog = next ? (clout - cur.min) / (next.min - cur.min) : 1;
  return (
    <div className="hud-tl">
      <div className="glass cash">
        <small>CASH</small>
        <span className={cash < 0 ? 'neg' : ''}>{money(cash)}</span>
      </div>
      <div className="glass clout">
        <div className="row between small"><span className="muted" style={{ letterSpacing: 1.5, fontSize: 10 }}>BRICKELL CLOUT</span><span>{Math.round(clout)}</span></div>
        <div className="lvl">Lv {lvl + 1} · {cur.name}</div>
        <div className="bar"><div style={{ width: `${prog * 100}%` }} /></div>
      </div>
      <Objective />
    </div>
  );
}

function Objective() {
  const g = useGame((s) => s.game);
  const m = currentMission(g);
  const wp = useUI((s) => s.waypoint);
  if (!m) return null;
  return (
    <div className="glass objective">
      <div className="k">{m.stage === 'Side' ? 'SIDE JOB' : 'OBJECTIVE'}</div>
      <div className="t">{m.title}</div>
      <div className="d">{m.desc}{m.progress ? ` (${m.progress(g)})` : ''}</div>
      {m.target && !wp && <div className="d" style={{ color: 'var(--green)' }}>Follow the green beacon · {POI_BY_ID[m.target].name}</div>}
    </div>
  );
}

function Clock() {
  const minute = useGame((s) => s.game.minute);
  const day = useGame((s) => s.game.day);
  return (
    <div className="glass clock">
      {clock(minute)}
      <small>{dateLabel(day, MONTH_DAYS).toUpperCase()}</small>
    </div>
  );
}

function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const show = useSettings((s) => s.s.showMinimap);
  useEffect(() => {
    if (!show) return;
    let raf = 0;
    let last = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 50) return;
      last = t;
      const c = ref.current;
      const e = engine;
      if (!c || !e) return;
      const size = c.clientWidth * Math.min(2, window.devicePixelRatio);
      if (c.width !== size) {
        c.width = size;
        c.height = size;
      }
      const ctx = c.getContext('2d')!;
      const rt = useUI.getState().rt;
      const rotate = useSettings.getState().s.rotateMinimap;
      const scale = (size / 210) * (rt.mode === 'car' ? 1.1 + Math.max(0, 1 - rt.speed / 140) * 0.7 : 2.2);
      ctx.fillStyle = '#0e1116';
      ctx.fillRect(0, 0, size, size);
      ctx.save();
      ctx.translate(size / 2, size / 2);
      if (rotate) ctx.rotate(rt.camHeading - Math.PI);
      ctx.scale(scale, scale);
      ctx.translate(-rt.x, -rt.z);
      const bm = baseMap(e.world);
      ctx.drawImage(bm, MAP_BOUNDS.minX, MAP_BOUNDS.minZ, bm.width / BASE_SCALE, bm.height / BASE_SCALE);
      // waypoint
      const wp = useUI.getState().waypoint;
      if (wp) {
        ctx.beginPath();
        ctx.arc(wp.x, wp.z, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#ffd36a';
        ctx.fill();
      }
      // current objective (when no manual waypoint)
      const cm = currentMission(useGame.getState().game);
      if (!wp && cm?.target) {
        const tp = POI_BY_ID[cm.target];
        ctx.beginPath();
        ctx.arc(tp.x, tp.z, 6, 0, Math.PI * 2);
        ctx.strokeStyle = '#3dffb0';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      // yacht
      if (e.yacht) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(e.yacht.x - 3, e.yacht.z - 3, 6, 6);
      }
      // car when on foot
      if (rt.mode === 'foot' && e.car && !rt.interior) {
        ctx.fillStyle = '#3dffb0';
        ctx.beginPath();
        ctx.arc(e.car.x, e.car.z, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      // POIs (screen-space so icons stay upright)
      const toScreen = (x: number, z: number) => {
        let dx = (x - rt.x) * scale, dz = (z - rt.z) * scale;
        if (rotate) {
          const a = rt.camHeading - Math.PI;
          const cs = Math.cos(a), sn = Math.sin(a);
          [dx, dz] = [dx * cs - dz * sn, dx * sn + dz * cs];
        }
        return [size / 2 + dx, size / 2 + dz];
      };
      for (const p of Object.values(POI_BY_ID)) {
        const [sx, sy] = toScreen(p.x, p.z);
        const r = size / 2;
        const dx = sx - r, dy = sy - r;
        const d = Math.hypot(dx, dy);
        const k = d > r - 12 ? (r - 12) / d : 1;
        const x = r + dx * k, y = r + dy * k;
        const s = 8 * (size / 210) * (k < 1 ? 0.65 : 1);
        ctx.globalAlpha = k < 1 ? 0.45 : 1;
        ctx.beginPath();
        ctx.arc(x, y, s, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(10,10,14,0.9)';
        ctx.fill();
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = p.color;
        ctx.font = `${Math.round(s * 1.05)}px Inter, "Segoe UI Emoji", Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.icon, x, y + 1);
        ctx.globalAlpha = 1;
      }
      // waypoint edge indicator
      const wp2 = useUI.getState().waypoint;
      if (wp2) {
        const [sx, sy] = toScreen(wp2.x, wp2.z);
        const r = size / 2;
        const dx = sx - r, dy = sy - r;
        const d = Math.hypot(dx, dy);
        if (d > r - 10) {
          const k = (r - 10) / d;
          ctx.beginPath();
          ctx.arc(r + dx * k, r + dy * k, 6 * (size / 210), 0, Math.PI * 2);
          ctx.fillStyle = '#ffd36a';
          ctx.fill();
        }
      }
      drawPlayer(ctx, size / 2, size / 2, rotate ? Math.PI + (rt.heading - rt.camHeading) : rt.heading, 9 * (size / 210));
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = `700 ${11 * (size / 210)}px Inter`;
      ctx.textAlign = 'center';
      if (rotate) {
        const a = rt.camHeading - Math.PI;
        // north marker
        const nx = size / 2 + Math.sin(a) * (size / 2 - 14);
        const ny = size / 2 - Math.cos(a) * (size / 2 - 14);
        ctx.fillText('N', nx, ny + 4);
      } else ctx.fillText('N', size / 2, 16);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [show]);
  if (!show) return null;
  return (
    <div className="minimap">
      <canvas ref={ref} />
    </div>
  );
}

function Speedo() {
  const rt = useUI((s) => s.rt);
  const bounce = useGame((s) => s.game.bounce);
  if (rt.mode === 'foot') return null;
  const v = VEHICLE_BY_ID[rt.vehicleId];
  return (
    <div className="glass speedo">
      <div className="veh">{rt.mode === 'boat' ? 'YACHT · AT THE HELM' : `${v?.make.toUpperCase()} ${v?.name.toUpperCase()}`}</div>
      <div className="v">{Math.round(rt.speed)}</div>
      <div className="u">{rt.mode === 'boat' ? 'KM/H · ' : 'KM/H · '}{rt.gear}</div>
      {rt.mode === 'car' && v?.id === 'maybach' && (
        rt.bounceActive ? (
          <div className="bounce-pill">
            <div className="bt">HYDRAULICS ACTIVE{rt.bounceLimited ? ' · LIMITED' : ''}</div>
            <div className="bs">{STYLE_LABEL[bounce.style]} · {Math.round(bounce.intensity * 100)}%</div>
            <div className="bounce-meter"><div style={{ width: `${rt.bounceLevel * 100}%` }} /></div>
          </div>
        ) : (
          <div className="small muted" style={{ marginTop: 8 }}>Press <kbd>B</kbd> to bounce · <kbd>V</kbd> settings</div>
        )
      )}
    </div>
  );
}

function Toasts() {
  const toasts = useUI((s) => s.toasts);
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`glass toast ${t.kind}`}>{t.text}</div>
      ))}
    </div>
  );
}

function MinigameHud() {
  const mg = useUI((s) => s.rt.minigame);
  if (!mg) return null;
  return (
    <div className="glass minigame">
      <div className="ttl">{mg.title}</div>
      <div className="row between"><span className="muted small">⏱ {Math.ceil(mg.timeLeft)}s</span><span className="score">{mg.score}</span><span className="muted small">SCORE</span></div>
      {mg.call && <div className="call">{mg.call}</div>}
      {mg.hint && <div className="small muted">{mg.hint}</div>}
      {mg.lines.length > 1 && (
        <ul>
          {mg.lines.map((l, i) => <li key={i} className={l.done ? 'done' : l.active ? 'active' : ''}>{l.done ? '✓' : l.active ? '▶' : '·'} {l.text}</li>)}
        </ul>
      )}
    </div>
  );
}

function PromptAndHints() {
  const prompt = useUI((s) => s.rt.prompt);
  const panel = useUI((s) => s.panel);
  const fps = useUI((s) => s.rt.fps);
  const showFps = useSettings((s) => s.s.showFps);
  const wp = useUI((s) => s.waypoint);
  const rt = useUI((s) => s.rt);
  const locked = typeof document !== 'undefined' && !!document.pointerLockElement;
  const dist = wp ? Math.round(Math.hypot(wp.x - rt.x, wp.z - rt.z)) : 0;
  return (
    <>
      {prompt && !panel && (
        <div className="glass prompt">
          {prompt.split('   ').map((p, i) => (
            <span key={i} style={{ marginRight: 16 }}><b>{p.slice(0, 1)}</b>{p.slice(1)}</span>
          ))}
        </div>
      )}
      {wp && !panel && <div className="glass wp-arrow">📍 {wp.label} · {dist} m</div>}
      {!locked && !panel && <div className="glass lock-hint">Click to look around · Tab phone · M map · Esc menu</div>}
      {showFps && <div className="glass fps">{fps} FPS</div>}
    </>
  );
}

export function Hud() {
  const rt = useUI((s) => s.rt);
  useUI((s) => s.panel);
  return (
    <div className="hud">
      <CashClout />
      <div className="hud-tr">
        <Clock />
        {rt.drunk > 0.05 && <div className="glass small" style={{ padding: '6px 12px', color: rt.drunk > 0.6 ? 'var(--red)' : 'var(--gold2)' }}>🥂 {rt.drunk >= 1 ? 'BLACKED OUT · SLEEP IT OFF' : drunkLevel(rt.drunk).toUpperCase()}{rt.drunk < 1 && rt.drunk >= 0.35 && rt.mode !== 'foot' ? ' · DRIVING IMPAIRED' : ''}</div>}
        {rt.interior && <div className="glass small" style={{ padding: '6px 12px' }}>{rt.interior === 'club' ? '⚡ VOLT NIGHTCLUB' : rt.interior === 'casino' ? '🎰 THE GILDED FLAMINGO' : rt.interior === 'penthouse' ? '🏙 AURUM PENTHOUSE' : '⚓ ON YOUR YACHT'}</div>}
      </div>
      <Toasts />
      <Minimap />
      <Speedo />
      <MinigameHud />
      <PromptAndHints />
    </div>
  );
}
