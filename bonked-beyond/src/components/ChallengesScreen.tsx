import { CHALLENGES } from '../data/challenges';
import { COSMETIC_MAP } from '../data/cosmetics';
import { audio } from '../game/effects/AudioManager';
import { formatNumber } from '../game/util';
import { challengeProgress, useProgression } from '../store/progressionStore';
import { Btn, PageHeader } from './ui';

export function ChallengesScreen({ onBack }: { onBack: () => void }) {
  const save = useProgression((s) => s.save);
  const claim = useProgression((s) => s.claimChallenge);
  const done = save.challengeClaimed.length;
  return (
    <div className="screen menu-page">
      <PageHeader title="CHALLENGES" subtitle={`Optional goals with rewards · ${done}/${CHALLENGES.length} claimed`} onBack={onBack} />
      <div className="challenge-grid">
        {CHALLENGES.map((c) => {
          const prog = challengeProgress(c.id, save);
          const complete = prog >= c.target;
          const claimed = save.challengeClaimed.includes(c.id);
          const reward = [c.reward.currency ? `🪙 ${c.reward.currency}` : '', c.reward.cosmetic ? `🎨 ${COSMETIC_MAP[c.reward.cosmetic]?.name}` : ''].filter(Boolean).join(' + ');
          const clamped = Math.min(prog, c.target);
          const shown = c.description.includes('minutes') ? `${Math.floor(clamped / 60)}/${c.target / 60} min` : `${formatNumber(clamped)}/${formatNumber(c.target)}`;
          return (
            <div key={c.id} className={`challenge panel ${claimed ? 'claimed' : complete ? 'complete' : ''}`}>
              <span className="ch-icon">{c.icon}</span>
              <div className="ch-body">
                <div className="ch-name">{c.name} <span className="dim">{c.scope === 'run' ? 'single run' : 'lifetime'}</span></div>
                <div className="ch-desc">{c.description}</div>
                <div className="statbar-track"><div className="statbar-fill" style={{ width: `${Math.min(100, (prog / c.target) * 100)}%`, background: complete ? 'var(--green)' : 'var(--gold)' }} /></div>
                <div className="ch-foot"><span>{shown}</span><span className="ch-reward">{reward}</span></div>
              </div>
              {claimed ? <span className="ch-done">✔ Claimed</span>
                : <Btn variant={complete ? 'gold' : 'ghost'} disabled={!complete} onClick={() => { if (claim(c.id)) audio.play('achievement'); }}>{complete ? 'Claim' : 'Locked'}</Btn>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
