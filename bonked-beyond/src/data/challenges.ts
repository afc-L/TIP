// Optional challenges. Progress is tracked as the best (or lifetime) value; each reward is claimed once.
export interface RunSummary {
  victory: boolean;
  time: number;
  kills: number;
  elites: number;
  level: number;
  gold: number;
  bosses: number;
  evolutions: number;
  healed: boolean;
  character: string;
  map: string;
  mode: string;
  difficulty: string;
  modifiers: number;
  maxSynergies: number;
  chests: number;
}

export interface LifetimeView { totalKills: number; totalElites: number; mapsPlayed: string[] }

export interface ChallengeDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  target: number;
  scope: 'run' | 'total';
  metric: (r: RunSummary | null, l: LifetimeView) => number;
  reward: { currency?: number; cosmetic?: string };
}

const runOnly = (f: (r: RunSummary) => number) => (r: RunSummary | null) => (r ? f(r) : 0);

export const CHALLENGES: ChallengeDef[] = [
  { id: 'kills_250', name: 'Lawnmower', icon: '🌾', description: 'Defeat 250 enemies in one run.', target: 250, scope: 'run', metric: runOnly((r) => r.kills), reward: { currency: 100 } },
  { id: 'survive_10', name: 'Ten Minutes of Fame', icon: '⏳', description: 'Survive 10 minutes in one run.', target: 600, scope: 'run', metric: runOnly((r) => r.time), reward: { cosmetic: 'trail_fire' } },
  { id: 'boss_wizard', name: 'Spell Check', icon: '🧙', description: 'Defeat a boss as The Wizard.', target: 1, scope: 'run', metric: runOnly((r) => (r.character === 'wizard' ? r.bosses : 0)), reward: { cosmetic: 'tint_arcane' } },
  { id: 'evolve_3', name: 'Evolutionary', icon: '🧬', description: 'Evolve three weapons in one run.', target: 3, scope: 'run', metric: runOnly((r) => r.evolutions), reward: { currency: 200, cosmetic: 'title_evolver' } },
  { id: 'gold_500', name: 'Pocket Change', icon: '🪙', description: 'Collect 500 gold in one run.', target: 500, scope: 'run', metric: runOnly((r) => r.gold), reward: { cosmetic: 'tint_gold' } },
  { id: 'no_heal_win', name: 'Iron Will', icon: '🚫', description: 'Win a run without picking up any healing.', target: 1, scope: 'run', metric: runOnly((r) => (r.victory && !r.healed ? 1 : 0)), reward: { currency: 300, cosmetic: 'title_ironwill' } },
  { id: 'elites_100', name: 'Elite Purge', icon: '👑', description: 'Defeat 100 elites in total.', target: 100, scope: 'total', metric: (_r, l) => l.totalElites, reward: { cosmetic: 'trail_shadow' } },
  { id: 'modifier_win', name: 'Twisted Victory', icon: '🎲', description: 'Win a run with at least one run modifier active.', target: 1, scope: 'run', metric: runOnly((r) => (r.victory && r.modifiers > 0 ? 1 : 0)), reward: { currency: 250, cosmetic: 'theme_crimson' } },
  { id: 'boss_moose', name: 'Antler Diplomacy', icon: '🦌', description: 'Defeat a boss as Iron Moose.', target: 1, scope: 'run', metric: runOnly((r) => (r.character === 'moose' ? r.bosses : 0)), reward: { cosmetic: 'tint_steel' } },
  { id: 'kills_10000', name: 'Horde Ender', icon: '☠️', description: 'Defeat 10,000 enemies in total.', target: 10000, scope: 'total', metric: (_r, l) => l.totalKills, reward: { cosmetic: 'title_hordeender' } },
  { id: 'hard_10', name: 'Hard Boiled', icon: '🥚', description: 'Survive 10 minutes on Hard.', target: 600, scope: 'run', metric: runOnly((r) => (r.difficulty === 'hard' ? r.time : 0)), reward: { cosmetic: 'theme_royal' } },
  { id: 'all_maps', name: 'Globetrotter', icon: '🗺️', description: 'Play a run on all five maps.', target: 5, scope: 'total', metric: (_r, l) => l.mapsPlayed.length, reward: { cosmetic: 'title_globetrotter' } },
  { id: 'level_40', name: 'Overleveled', icon: '📈', description: 'Reach level 40 in one run.', target: 40, scope: 'run', metric: runOnly((r) => r.level), reward: { cosmetic: 'tint_neon' } },
  { id: 'synergy_4', name: 'Combo Master', icon: '🧩', description: 'Have four synergies active at once.', target: 4, scope: 'run', metric: runOnly((r) => r.maxSynergies), reward: { cosmetic: 'trail_sparkle' } },
  { id: 'endless_15', name: 'Long Haul', icon: '♾️', description: 'Survive 15 minutes in Endless mode.', target: 900, scope: 'run', metric: runOnly((r) => (r.mode === 'endless' ? r.time : 0)), reward: { cosmetic: 'theme_mint' } },
  { id: 'chests_8', name: 'Treasure Goblin', icon: '🎁', description: 'Open 8 chests in one run.', target: 8, scope: 'run', metric: runOnly((r) => r.chests), reward: { currency: 150 } },
];

export const CHALLENGE_MAP = Object.fromEntries(CHALLENGES.map((c) => [c.id, c])) as Record<string, ChallengeDef>;
