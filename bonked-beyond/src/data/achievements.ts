export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  reward: number; // currency
  unlocks?: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'survive_5', name: 'Still Standing', description: 'Survive 5 minutes in a run.', icon: '⏱️', reward: 50, unlocks: 'Rocket Launcher' },
  { id: 'kills_100', name: 'Centurion', description: 'Defeat 100 enemies in a single run.', icon: '💀', reward: 30, unlocks: 'Lightning Strike & Tesla Coil' },
  { id: 'level_10', name: 'Getting Stronger', description: 'Reach level 10 in a single run.', icon: '⭐', reward: 40, unlocks: 'The Runner' },
  { id: 'survive_8', name: 'Seasoned Survivor', description: 'Survive 8 minutes in a run.', icon: '🏜️', reward: 80, unlocks: 'Crystal Canyon & Meteor Storm' },
  { id: 'first_boss', name: 'Timber!', description: 'Defeat your first boss.', icon: '🪓', reward: 100, unlocks: 'The Wizard, Earthquake & Gravity Well' },
  { id: 'survive_10', name: 'Unbonkable', description: 'Survive 10 minutes in a run.', icon: '🦾', reward: 120, unlocks: 'Iron Moose' },
  { id: 'kills_1000_total', name: 'Horde Breaker', description: 'Defeat 1,000 enemies across all runs.', icon: '⚔️', reward: 80, unlocks: 'Scrap Rat' },
  { id: 'level_15', name: 'Power Spike', description: 'Reach level 15 in a single run.', icon: '🌟', reward: 60, unlocks: 'Poison Cloud & Fire Tornado' },
  { id: 'evolution', name: 'Evolved', description: 'Collect a weapon evolution.', icon: '🧬', reward: 100 },
  { id: 'golem', name: 'Scrapped', description: 'Defeat The Scrap Golem.', icon: '⚙️', reward: 200, unlocks: 'The Forgotten Arena' },
  { id: 'survive_15', name: 'Marathon Bonker', description: 'Survive 15 minutes in a run.', icon: '🏃', reward: 200 },
  { id: 'flawless_boss', name: 'Untouchable', description: "Defeat a boss without being hit by its major attacks.", icon: '🕊️', reward: 150 },
  { id: 'no_upgrade_win', name: 'Purist', description: 'Win a run without ever purchasing a permanent upgrade.', icon: '🧘', reward: 300 },
  { id: 'elites_25', name: 'Elite Hunter', description: 'Defeat 25 elite enemies across all runs.', icon: '👑', reward: 100, unlocks: 'Void Rift' },
  { id: 'rich', name: 'Hoarder', description: 'Earn 2,000 currency in total.', icon: '💰', reward: 100 },
  { id: 'arena_win', name: 'Champion of the Arena', description: 'Win a run in The Forgotten Arena.', icon: '🏆', reward: 500 },
  { id: 'kills_500', name: 'Massacre', description: 'Defeat 500 enemies in a single run.', icon: '🩸', reward: 80 },
  { id: 'big_hit', name: 'Mega Bonk', description: 'Deal 500 damage with a single hit.', icon: '💥', reward: 60 },
  { id: 'kills_2500_total', name: 'Exterminator', description: 'Defeat 2,500 enemies across all runs.', icon: '⚗️', reward: 120, unlocks: 'The Alchemist' },
  { id: 'executioner', name: 'Headsman Down', description: 'Defeat The Golden Executioner.', icon: '🪓', reward: 200, unlocks: 'The Gunslinger & Lava Fields' },
  { id: 'colossus', name: 'Geode Cracker', description: 'Defeat The Crystal Colossus.', icon: '💎', reward: 150, unlocks: 'Frozen Wasteland' },
  { id: 'devourer', name: 'Void Walker', description: 'Defeat The Void Devourer.', icon: '🌌', reward: 250 },
  { id: 'evolve_2', name: 'Mad Scientist', description: 'Evolve two weapons in a single run.', icon: '🧪', reward: 120, unlocks: 'The Engineer' },
  { id: 'elites_50', name: 'Elite Slayer', description: 'Defeat 50 elite enemies across all runs.', icon: '🗡️', reward: 150, unlocks: 'The Berserker' },
  { id: 'frozen_8', name: 'Cold Feet', description: 'Survive 8 minutes in the Frozen Wasteland.', icon: '❄️', reward: 150, unlocks: 'The Frost Knight' },
  { id: 'rich_5000', name: 'High Roller', description: 'Earn 5,000 currency in total.', icon: '🎰', reward: 200, unlocks: 'The Gambler' },
  { id: 'synergy_3', name: 'Theorycrafter', description: 'Have three build synergies active at once.', icon: '🧩', reward: 120 },
  { id: 'endless_20', name: 'Eternal', description: 'Survive 20 minutes in Endless mode.', icon: '♾️', reward: 300 },
  { id: 'win_hard', name: 'Hardcore', description: 'Win a run on Hard difficulty.', icon: '🔥', reward: 400 },
  { id: 'all_bosses', name: 'Boss Collector', description: 'Defeat all five bosses at least once.', icon: '🏅', reward: 500 },
];

export const ACHIEVEMENT_MAP = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a])) as Record<string, AchievementDef>;
