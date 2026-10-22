import { useEffect, useRef } from 'react';
import { useGame, DEFAULT_BOUNCE } from '../../game/store';
import { useUI } from '../../game/uiStore';
import { useSettings } from '../../game/settings';
import { engine } from '../../game/engine/Engine';
import type { BounceStyle } from '../../game/types';
import { Btn, Slider } from '../common';

const STYLES: { id: BounceStyle; name: string; desc: string }[] = [
  { id: 'executive', name: 'Executive', desc: 'Slow · smooth · subtle' },
  { id: 'brickell', name: 'Brickell', desc: 'Fast · nose-to-tail hops' },
  { id: 'miami', name: 'Miami Mode', desc: 'Chaotic · roll · front hops' },
];

/** Live mini-visualisation of the suspension: draws the car body offset from the engine's suspension state. */
function SuspensionViz() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = ref.current;
      if (!c) return;
      const W = (c.width = c.clientWidth * 2), H = (c.height = c.clientHeight * 2);
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, W, H);
      const car = engine?.car;
      const out = car?.susp.out;
      const heave = out ? out.heave : 0;
      const pitch = out ? out.pitch : 0;
      const k = 90;
      const S = Math.min(1, W / 640) * 0.8;
      // ground
      ctx.strokeStyle = 'rgba(255,255,255,.15)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, H - 20);
      ctx.lineTo(W, H - 20);
      ctx.stroke();
      const cx = W / 2, wy = H - 20 - 26 * S;
      const fl = out ? out.wheelLift[0] * k : 0, rl = out ? out.wheelLift[2] * k : 0;
      // wheels
      ctx.fillStyle = '#222';
      ctx.strokeStyle = '#d4af6a';
      for (const [x, lift] of [[cx + 150 * S, fl], [cx - 150 * S, rl]] as [number, number][]) {
        ctx.beginPath();
        ctx.arc(x, wy - lift, 26 * S, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      // body
      ctx.save();
      ctx.translate(cx, wy - 40 * S - heave * k);
      ctx.rotate(-pitch);
      ctx.scale(S, S);
      const g = ctx.createLinearGradient(0, -70, 0, 20);
      g.addColorStop(0, '#8a6d4a');
      g.addColorStop(0.55, '#8a6d4a');
      g.addColorStop(0.56, '#111');
      g.addColorStop(1, '#0b0b0b');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-230, 10);
      ctx.lineTo(-235, -40);
      ctx.lineTo(-200, -55);
      ctx.lineTo(-170, -95);
      ctx.lineTo(80, -100);
      ctx.lineTo(140, -55);
      ctx.lineTo(225, -45);
      ctx.lineTo(232, 10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(80,140,200,.35)';
      ctx.fillRect(-160, -88, 220, 30);
      ctx.restore();
      // struts
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 4;
      for (const [x, lift, i] of [[cx + 150 * S, fl, 0], [cx - 150 * S, rl, 2]] as [number, number, number][]) {
        const top = wy - 40 * S - (out ? out.corner[i] : 0) * k;
        ctx.beginPath();
        ctx.moveTo(x, wy - lift);
        ctx.lineTo(x, top);
        ctx.stroke();
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} style={{ width: '100%', height: '100%' }} />;
}

export function MaybachPanel() {
  const bounce = useGame((s) => s.game.bounce);
  const setBounce = useGame((s) => s.setBounce);
  const owns = useGame((s) => s.game.vehicles.includes('maybach'));
  const close = useUI((s) => s.close);
  const rt = useUI((s) => s.rt);
  const vfx = useSettings((s) => s.s.vehicleFxVolume);
  const inMaybach = rt.mode === 'car' && rt.vehicleId === 'maybach';
  const toggle = () => {
    if (engine && inMaybach) engine.toggleBounce();
    else setBounce({ enabled: !bounce.enabled });
  };
  const style = (s: BounceStyle) => {
    if (engine && inMaybach) engine.setBounceStyle(s);
    else setBounce({ style: s });
  };
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="mb">
        <div className="mb-head">
          <div>
            <div className="mb-brand">M A Y B A C H</div>
            <div className="small muted">GLS 600 · Hydraulic Suspension Control</div>
          </div>
          <button className="close-x" onClick={close}>✕</button>
        </div>
        <div className="mb-body">
          <div className="mb-col">
            <div className="mb-big">
              <div>
                <div className="mb-label">Bounce mode</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: bounce.enabled ? 'var(--green)' : 'var(--muted)' }}>{bounce.enabled ? 'ACTIVE' : 'OFF'}</div>
                <div className="small muted">{inMaybach ? (rt.bounceLimited && bounce.enabled ? 'Limited while cruising — stop for full effect' : 'Full effect available') : owns ? 'Settings apply next time you drive the Maybach' : ''}</div>
              </div>
              <button className={`mb-power ${bounce.enabled ? 'on' : ''}`} onClick={toggle}>BOUNCE<br />MODE</button>
            </div>
            <div>
              <div className="mb-label" style={{ marginBottom: 8 }}>Bounce style</div>
              <div className="mb-styles">
                {STYLES.map((s) => (
                  <button key={s.id} className={`mb-style ${bounce.style === s.id ? 'sel' : ''}`} onClick={() => style(s.id)}>
                    <b>{s.name}</b>
                    <span>{s.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-viz"><SuspensionViz /></div>
          </div>
          <div className="mb-col">
            <div className="mb-label">Intensity</div>
            <Slider label="Bounce intensity" value={bounce.intensity} min={0} max={1} step={0.05} onChange={(v) => setBounce({ intensity: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
            <div className="mb-label">Suspension customization</div>
            <Slider label="Ride height" value={bounce.rideHeight} min={-1} max={1} step={0.05} onChange={(v) => setBounce({ rideHeight: v })} fmt={(v) => (v === 0 ? 'Std' : v > 0 ? `+${Math.round(v * 7)}cm` : `${Math.round(v * 7)}cm`)} />
            <Slider label="Hydraulic stiffness" value={bounce.stiffness} min={0} max={1} step={0.05} onChange={(v) => setBounce({ stiffness: v })} fmt={(v) => (v < 0.35 ? 'Soft' : v > 0.7 ? 'Firm' : 'Medium')} />
            <div className="mb-label">Sound</div>
            <Slider label="Hydraulic SFX" value={bounce.sfxVolume} min={0} max={1} step={0.05} onChange={(v) => setBounce({ sfxVolume: v })} fmt={(v) => (v === 0 ? 'Muted' : `${Math.round(v * 100)}%`)} />
            <Slider label="Vehicle FX bus" value={vfx} min={0} max={1} step={0.05} onChange={(v) => { useSettings.getState().set({ vehicleFxVolume: v }); engine?.applySettings(); }} fmt={(v) => `${Math.round(v * 100)}%`} />
            <div className="small muted" style={{ lineHeight: 1.5 }}>
              Shortcuts while driving: <kbd>B</kbd> toggle · <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> style · <kbd>Z</kbd>/<kbd>X</kbd> intensity · <kbd>C</kbd> cockpit view (the dash screen mirrors these settings).
              Full effect while parked or slow; automatically limited at speed, and Miami Mode downgrades above ~25 km/h.
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 'auto' }}>
              <Btn kind="ghost" onClick={() => setBounce({ ...DEFAULT_BOUNCE, enabled: bounce.enabled })}>Reset to default</Btn>
              <Btn kind="gold" onClick={close}>Done</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
