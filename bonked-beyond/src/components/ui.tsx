import type { ReactNode } from 'react';
import { audio } from '../game/effects/AudioManager';

export function Btn(props: { children: ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' | 'danger' | 'gold'; disabled?: boolean; big?: boolean; className?: string; title?: string }) {
  const { variant = 'ghost', big, disabled, className = '' } = props;
  return (
    <button
      className={`btn btn-${variant} ${big ? 'btn-big' : ''} ${className}`}
      disabled={disabled}
      title={props.title}
      onMouseEnter={() => !disabled && audio.play('hover')}
      onClick={() => {
        audio.unlock();
        if (disabled) return;
        audio.play('click');
        props.onClick?.();
      }}
    >
      {props.children}
    </button>
  );
}

export function Confirm(props: { title: string; text: string; confirm: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="confirm-backdrop" onClick={props.onCancel}>
      <div className="confirm panel pop-in" onClick={(e) => e.stopPropagation()}>
        <h3>{props.title}</h3>
        <p>{props.text}</p>
        <div className="row-btns">
          <Btn onClick={props.onCancel}>Cancel</Btn>
          <Btn variant="danger" onClick={props.onConfirm}>{props.confirm}</Btn>
        </div>
      </div>
    </div>
  );
}

export function PageHeader(props: { title: string; subtitle?: string; onBack: () => void; right?: ReactNode }) {
  return (
    <div className="page-header">
      <Btn onClick={props.onBack}>← Back</Btn>
      <div className="page-titles">
        <h2>{props.title}</h2>
        {props.subtitle && <p>{props.subtitle}</p>}
      </div>
      <div className="page-right">{props.right}</div>
    </div>
  );
}

export function Stars(props: { n: number; max?: number }) {
  const max = props.max ?? 3;
  return <span className="stars">{'★'.repeat(props.n)}<span className="dim">{'★'.repeat(Math.max(0, max - props.n))}</span></span>;
}

export function Bar(props: { value: number; max: number; color: string; label?: string }) {
  const pct = Math.max(0, Math.min(1, props.value / props.max)) * 100;
  return (
    <div className="statbar">
      {props.label && <span className="statbar-label">{props.label}</span>}
      <div className="statbar-track"><div className="statbar-fill" style={{ width: `${pct}%`, background: props.color }} /></div>
    </div>
  );
}

export const RARITY_COLOR: Record<string, string> = {
  common: '#adb5bd', uncommon: '#52b788', rare: '#4cc9f0', epic: '#c77dff', legendary: '#ff9f1c', evolution: '#ffd60a',
};
