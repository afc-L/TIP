import { useUI } from '../../game/uiStore';
import { useGame } from '../../game/store';
import { SUBSTANCES } from '../../game/data/substances';
import { engine } from '../../game/engine/Engine';
import { money } from '../../game/systems/format';
import { Bar, Btn, Panel } from '../common';

export function StashPanel() {
  const where = useUI((s) => s.panelArg) ?? 'street';
  const highs = useUI((s) => s.rt.highs);
  const cash = useGame((s) => s.game.cash);
  const street = where !== 'club';
  return (
    <Panel
      title={street ? 'Guy in a Linen Suit' : 'VIP Bathroom Attendant'}
      sub={street ? '"Everything is organic. Probably." Street deals carry a small chance he\'s an undercover cop.' : '"Mints, cologne, and... other things." No cops in the VIP bathroom.'}
    >
      <div className="grid c2">
        {SUBSTANCES.map((s) => (
          <div key={s.id} className="card">
            <div className="row between"><h4>{s.icon} {s.name}</h4><span className="price">{money(s.price)}</span></div>
            <div className="small muted">{s.blurb}</div>
            <div className="small">{s.effect}</div>
            <Bar value={Math.min(1, highs[s.id])} color={highs[s.id] > 0.7 ? 'red' : undefined} />
            <div className="row between">
              <span className="small muted">{highs[s.id] >= 1 ? 'Blacked out' : highs[s.id] > 0.05 ? `Feeling it: ${Math.round(highs[s.id] * 100)}%` : 'Not feeling it'}</span>
              <Btn small kind="gold" disabled={cash < s.price} onClick={() => engine?.takeSubstance(s.id, street)}>Take it</Btn>
            </div>
          </div>
        ))}
      </div>
      <p className="small muted">Effects wear off over time (cocaine fast, LSD slowly). Push any bar to 100% and you black out until you sleep. Steering gets weird on shrooms, LSD and weed.</p>
    </Panel>
  );
}
