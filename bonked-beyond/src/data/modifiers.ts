// Run modifiers: optional twists rolled before a run. Each changes real parameters.
export type ModifierId = 'doubleTrouble' | 'glassBonk' | 'richRun' | 'fastPaced' | 'magnetic' | 'eliteHunt'
  | 'chaosMagic' | 'bossRush' | 'lowGravity' | 'survivalInstinct';

export interface ModifierDef {
  id: ModifierId;
  name: string;
  icon: string;
  description: string;
  reward: number;            // currency multiplier contribution (e.g. 0.25 = +25%)
  spawnMult?: number;
  enemyDamageMult?: number;
  enemyHpMult?: number;
  enemySpeedMult?: number;
  eliteMult?: number;
  goldMult?: number;
  playerDamageMult?: number;
  pickupMult?: number;
  bossTimeMult?: number;
  healMult?: number;
  dashMult?: number;
  knockbackMult?: number;
}

export const MODIFIERS: ModifierDef[] = [
  { id: 'doubleTrouble', name: 'DOUBLE TROUBLE', icon: '👯', description: '50% more enemies spawn.', reward: 0.3, spawnMult: 1.5 },
  { id: 'glassBonk', name: 'GLASS BONK', icon: '🍷', description: 'You and enemies both deal +40% damage.', reward: 0.15, enemyDamageMult: 1.4, playerDamageMult: 1.4 },
  { id: 'richRun', name: 'RICH RUN', icon: '💸', description: 'Gold drops are worth 75% more.', reward: 0, goldMult: 1.75 },
  { id: 'fastPaced', name: 'FAST PACED', icon: '⏩', description: 'Enemies move 20% faster.', reward: 0.2, enemySpeedMult: 1.2 },
  { id: 'magnetic', name: 'MAGNETIC', icon: '🧲', description: 'Pickup radius doubled.', reward: -0.05, pickupMult: 2 },
  { id: 'eliteHunt', name: 'ELITE HUNT', icon: '🎯', description: 'Elites are three times as common.', reward: 0.25, eliteMult: 3 },
  { id: 'chaosMagic', name: 'CHAOS MAGIC', icon: '🎲', description: 'Every 20s a random effect hits the battlefield.', reward: 0.1 },
  { id: 'bossRush', name: 'BOSS RUSH', icon: '👹', description: 'Bosses arrive 35% sooner.', reward: 0.25, bossTimeMult: 0.65 },
  { id: 'lowGravity', name: 'LOW GRAVITY', icon: '🪐', description: 'Dashes go 50% further; everything gets knocked back much further.', reward: 0, dashMult: 1.5, knockbackMult: 1.8 },
  { id: 'survivalInstinct', name: 'SURVIVAL INSTINCT', icon: '❤️‍🔥', description: 'Healing is 60% stronger, but enemies have 25% more health.', reward: 0.2, healMult: 1.6, enemyHpMult: 1.25 },
];

export const MODIFIER_MAP = Object.fromEntries(MODIFIERS.map((m) => [m.id, m])) as Record<ModifierId, ModifierDef>;

export function rollModifiers(): ModifierId[] {
  const pool = [...MODIFIERS];
  const n = Math.random() < 0.45 ? 2 : 1;
  const out: ModifierId[] = [];
  for (let i = 0; i < n && pool.length; i++) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].id);
  return out;
}
