import { useGame } from '../store/gameStore';

export function BossIntro() {
  const b = useGame((s) => s.bossIntro);
  if (!b) return null;
  return (
    <div className="overlay boss-intro">
      <div className="bi-warning">⚠ WARNING ⚠</div>
      <div className="bi-name">{b.name}</div>
      <div className="bi-title">{b.title}</div>
    </div>
  );
}
