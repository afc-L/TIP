import { ACHIEVEMENTS } from '../data/achievements';
import { formatNumber, formatTime } from '../game/util';
import { favoriteCharacter, useProgression } from '../store/progressionStore';
import { PageHeader } from './ui';

export function StatisticsScreen({ onBack }: { onBack: () => void }) {
  const save = useProgression((s) => s.save);
  const st = save.stats;
  const rows: [string, string][] = [
    ['Total runs', formatNumber(st.totalRuns)], ['Victories', formatNumber(st.wins)], ['Total survival time', formatTime(st.totalTime)],
    ['Best survival time', formatTime(st.bestTime)], ['Total kills', formatNumber(st.totalKills)], ['Most kills in a run', formatNumber(st.mostKills)],
    ['Elites defeated', formatNumber(st.totalElites)], ['Highest level', String(st.highestLevel)], ['Bosses defeated', formatNumber(st.totalBosses)],
    ['Favorite character', favoriteCharacter(save)], ['Total currency earned', formatNumber(st.totalCurrency)], ['Highest single hit', formatNumber(st.highestHit)],
    ['Total damage dealt', formatNumber(st.totalDamage)],
  ];
  const got = ACHIEVEMENTS.filter((a) => save.achievements[a.id]).length;
  return (
    <div className="screen menu-page">
      <PageHeader title="STATISTICS" subtitle="Your lifetime record" onBack={onBack} />
      <div className="stats-layout">
        <div className="panel stats-table">{rows.map(([k, v]) => <div key={k} className="stats-row"><span>{k}</span><b>{v}</b></div>)}</div>
        <div className="panel ach-list">
          <h3>Achievements {got}/{ACHIEVEMENTS.length}</h3>
          {ACHIEVEMENTS.map((a) => {
            const done = !!save.achievements[a.id];
            return (
              <div key={a.id} className={`ach ${done ? 'done' : ''}`}>
                <span className="ach-icon">{done ? a.icon : '🔒'}</span>
                <div>
                  <div className="ach-name">{a.name} <span className="ach-reward">+{a.reward} 🪙</span></div>
                  <div className="ach-desc">{a.description}{a.unlocks ? ` · Unlocks ${a.unlocks}` : ''}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
