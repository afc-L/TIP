import { useEffect, useState, type ReactNode } from 'react';
import { useUI } from '../game/uiStore';
import { audio } from '../game/engine/audio';

export function Panel(props: { title: ReactNode; sub?: ReactNode; children: ReactNode; foot?: ReactNode; size?: 'narrow' | 'wide'; onClose?: () => void }) {
  const close = useUI((s) => s.close);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && (props.onClose ?? close)()}>
      <div className={`panel ${props.size ?? ''}`}>
        <div className="panel-head">
          <div>
            <h2 className="panel-title">{props.title}</h2>
            {props.sub && <div className="panel-sub">{props.sub}</div>}
          </div>
          <button className="close-x" onClick={() => (props.onClose ?? close)()} aria-label="Close">✕</button>
        </div>
        <div className="panel-body">{props.children}</div>
        {props.foot && <div className="panel-foot">{props.foot}</div>}
      </div>
    </div>
  );
}

export function Btn(props: { children: ReactNode; onClick?: () => void; kind?: 'gold' | 'ghost' | 'danger'; small?: boolean; big?: boolean; disabled?: boolean; active?: boolean; title?: string }) {
  return (
    <button
      className={`btn ${props.kind ?? ''} ${props.small ? 'small' : ''} ${props.big ? 'big' : ''} ${props.active ? 'active' : ''}`}
      disabled={props.disabled}
      title={props.title}
      onClick={() => {
        audio.ui('click');
        props.onClick?.();
      }}
    >
      {props.children}
    </button>
  );
}

export function Toggle(props: { on: boolean; onChange: (v: boolean) => void }) {
  return <div className={`toggle ${props.on ? 'on' : ''}`} onClick={() => props.onChange(!props.on)} role="switch" aria-checked={props.on} />;
}

export function Slider(props: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; fmt?: (v: number) => string }) {
  return (
    <div className="slider-row">
      <span className="muted">{props.label}</span>
      <input type="range" min={props.min} max={props.max} step={props.step ?? 0.01} value={props.value} onChange={(e) => props.onChange(parseFloat(e.target.value))} />
      <span style={{ textAlign: 'right' }}>{props.fmt ? props.fmt(props.value) : props.value}</span>
    </div>
  );
}

export function Bar(props: { value: number; color?: 'green' | 'red' }) {
  return (
    <div className={`bar ${props.color ?? ''}`}>
      <div style={{ width: `${Math.max(0, Math.min(1, props.value)) * 100}%` }} />
    </div>
  );
}

export function LineChart(props: { series: { values: number[]; color: string; label: string }[]; height?: number }) {
  const h = props.height ?? 120;
  const w = 320;
  const all = props.series.flatMap((s) => s.values);
  const max = Math.max(1, ...all);
  const min = Math.min(0, ...all);
  const n = Math.max(2, ...props.series.map((s) => s.values.length));
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="chart" preserveAspectRatio="none" style={{ height: h }}>
        <line x1="0" y1={h - 1} x2={w} y2={h - 1} stroke="rgba(255,255,255,.12)" />
        {props.series.map((s, k) => {
          if (s.values.length < 1) return null;
          const pts = s.values.map((v, i) => `${(i / (n - 1)) * w},${h - 4 - ((v - min) / (max - min || 1)) * (h - 10)}`).join(' ');
          return <polyline key={k} points={pts} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />;
        })}
      </svg>
      <div className="row wrap small muted" style={{ gap: 12 }}>
        {props.series.map((s) => (
          <span key={s.label}><span style={{ color: s.color }}>●</span> {s.label}</span>
        ))}
      </div>
    </div>
  );
}

export function Confirm(props: { text: string; onYes: () => void; onNo: () => void; yes?: string }) {
  return (
    <div className="overlay" style={{ zIndex: 80 }}>
      <div className="panel narrow">
        <div className="panel-body">
          <p style={{ fontSize: 15 }}>{props.text}</p>
        </div>
        <div className="panel-foot">
          <Btn onClick={props.onNo}>Cancel</Btn>
          <Btn kind="danger" onClick={props.onYes}>{props.yes ?? 'Confirm'}</Btn>
        </div>
      </div>
    </div>
  );
}

export function useTick(ms: number) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

export function Avatar(props: { name: string; color: string; skin?: string }) {
  const initials = props.name.split(/\s+/).filter((w) => /[A-Za-z]/.test(w[0])).slice(0, 2).map((w) => w[0]).join('');
  return (
    <div className="avatar" style={{ background: `linear-gradient(135deg, ${props.skin ?? '#d7a77f'}, ${props.color})`, color: '#111' }}>
      {initials}
    </div>
  );
}

export function Controls() {
  const rows: [string, string][] = [
    ['W A S D', 'Move / drive'],
    ['Mouse', 'Look around (click the game to capture the mouse)'],
    ['Shift', 'Sprint'],
    ['Space', 'Jump · handbrake when driving'],
    ['E', 'Interact · enter / exit vehicle'],
    ['F', 'Vehicle actions (events, docking)'],
    ['C', 'Change camera (chase / far / cockpit)'],
    ['B', 'Toggle Maybach bounce mode'],
    ['1 · 2 · 3', 'Bounce style: Executive · Brickell · Miami Mode'],
    ['Z · X', 'Bounce intensity − / +'],
    ['V', 'Maybach settings (infotainment)'],
    ['H · L', 'Horn · headlights'],
    ['Tab', 'Smartphone'],
    ['M', 'City map'],
    ['Esc', 'Pause / close menu'],
  ];
  return (
    <div className="controls-grid">
      {rows.map(([k, v]) => (
        <span key={k} style={{ display: 'contents' }}>
          <span>{k.split(' · ').map((x) => <kbd key={x} style={{ marginRight: 4 }}>{x}</kbd>)}</span>
          <span className="muted">{v}</span>
        </span>
      ))}
    </div>
  );
}
