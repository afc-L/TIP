import { useEffect, useState } from 'react';
import { CHALLENGE_MAP } from '../data/challenges';
import { CHARACTER_MAP } from '../data/characters';
import { COSMETICS, type CosmeticSlot } from '../data/cosmetics';
import { audio } from '../game/effects/AudioManager';
import { engine } from '../game/Engine';
import { useProgression } from '../store/progressionStore';
import { Btn, PageHeader } from './ui';

const SLOTS: { id: CosmeticSlot; name: string }[] = [
  { id: 'tint', name: 'Character colour' }, { id: 'trail', name: 'Movement trail' }, { id: 'title', name: 'Title' }, { id: 'theme', name: 'UI theme' },
];
const TRAIL_SWATCH: Record<string, string> = { '': 'transparent', dust: '#c2a878', fire: 'linear-gradient(90deg,#ff5400,#ffd60a)', shadow: 'linear-gradient(90deg,#240046,#7b2cbf)', sparkle: 'linear-gradient(90deg,#fff,#ffd60a,#a0e7ff)', rainbow: 'linear-gradient(90deg,#ff4d6d,#ff9f1c,#ffd60a,#80ff72,#4cc9f0,#c77dff)' };

export function CosmeticsScreen({ onBack }: { onBack: () => void }) {
  const save = useProgression((s) => s.save);
  const buy = useProgression((s) => s.buyCosmetic);
  const equip = useProgression((s) => s.equipCosmetic);
  const [preview, setPreview] = useState<string | null>(null);
  const tintId = preview && preview.startsWith('tint_') ? preview : save.cosmetics.tint;
  const tint = COSMETICS.find((c) => c.id === tintId)?.value ?? '';
  useEffect(() => { engine.showcase.setCharacter(save.selectedCharacter, tint); }, [save.selectedCharacter, tint]);
  useEffect(() => () => { engine.showcase.setCharacter(useProgression.getState().save.selectedCharacter, COSMETICS.find((c) => c.id === useProgression.getState().save.cosmetics.tint)?.value ?? ''); }, []);

  return (
    <div className="screen menu-page cosmetics-page">
      <PageHeader title="COSMETICS" subtitle={`Purely visual. Previewing on ${CHARACTER_MAP[save.selectedCharacter].name} — hover a colour to preview it on the model.`} onBack={onBack}
        right={<div className="wallet">🪙 <b>{save.currency.toLocaleString()}</b></div>} />
      <div className="cos-cols">
        {SLOTS.map((slot) => (
          <div key={slot.id} className="cos-slot panel">
            <h3>{slot.name}</h3>
            {COSMETICS.filter((c) => c.slot === slot.id).map((c) => {
              const owned = save.cosmeticsOwned.includes(c.id);
              const equipped = save.cosmetics[slot.id] === c.id;
              const swatch = slot.id === 'tint' ? (c.value || 'linear-gradient(135deg,#ff9f1c,#2ec4b6)') : slot.id === 'trail' ? TRAIL_SWATCH[c.value] : slot.id === 'theme' ? c.value : 'transparent';
              return (
                <div key={c.id} className={`cos-item ${equipped ? 'equipped' : ''} ${owned ? '' : 'locked'}`}
                  onMouseEnter={() => slot.id === 'tint' && setPreview(c.id)} onMouseLeave={() => setPreview(null)}>
                  {slot.id !== 'title' ? <span className="swatch" style={{ background: swatch }} /> : <span className="title-chip">“{c.value}”</span>}
                  <div className="cos-name">{slot.id === 'title' ? '' : c.name}<div className="dim small">{owned ? (equipped ? 'Equipped' : 'Owned') : c.cost ? `${c.cost} coins` : `Challenge: ${CHALLENGE_MAP[c.source!]?.name}`}</div></div>
                  {owned ? <Btn disabled={equipped} onClick={() => { equip(c.id); audio.play('select'); }}>{equipped ? '✔' : 'Equip'}</Btn>
                    : c.cost ? <Btn variant="gold" disabled={save.currency < c.cost} onClick={() => { if (buy(c.id)) { audio.play('select'); equip(c.id); } }}>🪙 {c.cost}</Btn>
                    : <span className="lock">🔒</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
