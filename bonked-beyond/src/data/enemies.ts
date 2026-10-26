import type { BossId, Element, EliteMod, EnemyKind } from './types';

export type DeathFx = 'splat' | 'poof' | 'debris' | 'spirit' | 'burst' | 'bugs';

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  description: string;
  role: string;            // gameplay purpose, shown in the codex
  hp: number;
  speed: number;
  damage: number;
  attackCooldown: number;
  radius: number;
  xp: number;
  knockbackResist: number; // 0 = full knockback, 1 = immune
  goldChance: number;
  color: string;
  height: number;          // for damage numbers / hit effects
  deathFx: DeathFx;
  resist?: Partial<Record<Element, number>>; // damage multipliers
  armor?: number;          // flat damage reduction fraction
  heavy?: boolean;         // resists pulls
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  slime: {
    kind: 'slime', name: 'Bonk Slime', description: 'Jiggly, hungry and always in a crowd.', role: 'Basic fodder that swarms you.',
    hp: 14, speed: 2.9, damage: 6, attackCooldown: 0.9, radius: 0.55, xp: 1,
    knockbackResist: 0, goldChance: 0.02, color: '#7bd84b', height: 0.9, deathFx: 'splat',
  },
  bigSlime: {
    kind: 'bigSlime', name: 'Mega Slime', description: 'A slime that ate its friends. Splits apart when popped.', role: 'Tanky blob that splits into slimes.',
    hp: 60, speed: 2.4, damage: 12, attackCooldown: 1.0, radius: 1.0, xp: 4,
    knockbackResist: 0.4, goldChance: 0.1, color: '#3fb950', height: 1.6, deathFx: 'splat',
  },
  goblin: {
    kind: 'goblin', name: 'Stab Goblin', description: 'Fast flankers that try to cut off your escape.', role: 'Flanks around your sides.',
    hp: 12, speed: 5.0, damage: 7, attackCooldown: 0.8, radius: 0.5, xp: 1,
    knockbackResist: 0, goldChance: 0.03, color: '#d4c73b', height: 1.3, deathFx: 'poof',
  },
  brute: {
    kind: 'brute', name: 'Armored Brute', description: 'Slow, heavy and almost impossible to push around.', role: 'Damage sponge that blocks paths.',
    hp: 110, speed: 2.1, damage: 22, attackCooldown: 1.4, radius: 1.05, xp: 6,
    knockbackResist: 0.8, goldChance: 0.12, color: '#6d597a', height: 2.2, deathFx: 'debris', heavy: true,
  },
  shaman: {
    kind: 'shaman', name: 'Hex Shaman', description: 'Keeps its distance and lobs cursed bolts.', role: 'Ranged caster: keep moving.',
    hp: 30, speed: 3.0, damage: 12, attackCooldown: 2.8, radius: 0.6, xp: 3,
    knockbackResist: 0.1, goldChance: 0.12, color: '#9b5de5', height: 1.7, deathFx: 'spirit',
  },
  exploder: {
    kind: 'exploder', name: 'Boom Bug', description: 'Runs at you, swells up and detonates. Watch the red ring!', role: 'Suicide bomber with a warning ring.',
    hp: 20, speed: 4.2, damage: 28, attackCooldown: 0, radius: 0.6, xp: 2,
    knockbackResist: 0.1, goldChance: 0.06, color: '#ef476f', height: 1.0, deathFx: 'burst',
  },
  swarmBug: {
    kind: 'swarmBug', name: 'Swarm Bug', description: 'Tiny, fast and never alone. Area attacks shine here.', role: 'Huge weak swarms.',
    hp: 5, speed: 5.4, damage: 3, attackCooldown: 0.6, radius: 0.35, xp: 0.5,
    knockbackResist: 0, goldChance: 0.01, color: '#b5179e', height: 0.6, deathFx: 'bugs',
  },
  bombardier: {
    kind: 'bombardier', name: 'Bombardier', description: 'Lobs slow, heavy bombs. The landing zone is marked in red.', role: 'Artillery: get out of the circle.',
    hp: 40, speed: 2.4, damage: 22, attackCooldown: 4, radius: 0.75, xp: 4,
    knockbackResist: 0.3, goldChance: 0.15, color: '#bc6c25', height: 1.6, deathFx: 'burst',
  },
  stalker: {
    kind: 'stalker', name: 'Shadow Stalker', description: 'Vanishes into shadow and reappears right behind you.', role: 'Teleporting ambusher.',
    hp: 30, speed: 4.0, damage: 14, attackCooldown: 1, radius: 0.55, xp: 3,
    knockbackResist: 0.1, goldChance: 0.08, color: '#3c096c', height: 1.6, deathFx: 'spirit',
  },
  shieldKnight: {
    kind: 'shieldKnight', name: 'Shield Knight', description: 'Blocks 80% of damage from the front. Hit it from the side, or with explosions and poison.', role: 'Frontal blocker: flank it.',
    hp: 70, speed: 2.4, damage: 15, attackCooldown: 1.2, radius: 0.8, xp: 5,
    knockbackResist: 0.6, goldChance: 0.15, color: '#adb5bd', height: 2, deathFx: 'debris', heavy: true,
  },
  healer: {
    kind: 'healer', name: 'Moss Healer', description: 'Hangs back and heals nearby enemies. Kill it first!', role: 'Support: prioritise it.',
    hp: 35, speed: 2.8, damage: 6, attackCooldown: 1, radius: 0.6, xp: 5,
    knockbackResist: 0.1, goldChance: 0.2, color: '#52b788', height: 1.6, deathFx: 'spirit',
  },
  phantom: {
    kind: 'phantom', name: 'Phantom', description: 'Drifts unpredictably. Shrugs off physical hits but fears magic, fire and lightning.', role: 'Erratic ghost weak to elements.',
    hp: 26, speed: 3.6, damage: 10, attackCooldown: 1, radius: 0.55, xp: 3,
    knockbackResist: 0.2, goldChance: 0.06, color: '#caf0f8', height: 1.5, deathFx: 'spirit',
    resist: { physical: 0.5, arcane: 1.6, lightning: 1.5, fire: 1.4 },
  },
  burrower: {
    kind: 'burrower', name: 'Burrower', description: 'Tunnels underground and bursts out beneath you after a rumbling warning.', role: 'Ambusher from below.',
    hp: 45, speed: 6.5, damage: 18, attackCooldown: 1.2, radius: 0.7, xp: 4,
    knockbackResist: 0.3, goldChance: 0.1, color: '#9c6644', height: 1.3, deathFx: 'debris',
  },
  beetle: {
    kind: 'beetle', name: 'Giant Beetle', description: 'Thick carapace and a devastating charge. Sidestep the charge lane.', role: 'Armored charger.',
    hp: 180, speed: 2.0, damage: 26, attackCooldown: 1.5, radius: 1.2, xp: 8,
    knockbackResist: 0.9, goldChance: 0.2, color: '#264653', height: 1.6, deathFx: 'debris', armor: 0.35, heavy: true,
  },
  archer: {
    kind: 'archer', name: 'Cursed Archer', description: 'Fires fans of cursed arrows from range.', role: 'Spread-shot ranged unit.',
    hp: 26, speed: 3.0, damage: 10, attackCooldown: 3, radius: 0.55, xp: 3,
    knockbackResist: 0.1, goldChance: 0.1, color: '#6a994e', height: 1.7, deathFx: 'poof',
  },
  ogre: {
    kind: 'ogre', name: 'Grunk the Ogre', description: 'A mini-boss with a telegraphed ground smash. Drops a golden chest.', role: 'Mini-boss with area slams.',
    hp: 900, speed: 2.3, damage: 30, attackCooldown: 1.5, radius: 1.5, xp: 60,
    knockbackResist: 0.95, goldChance: 1, color: '#7f4f24', height: 3.2, deathFx: 'debris', heavy: true,
  },
};

export const ENEMY_KINDS = Object.keys(ENEMIES) as EnemyKind[];

export interface EliteModDef { id: EliteMod; name: string; color: string; description: string }

export const ELITE_MODS: Record<EliteMod, EliteModDef> = {
  enraged: { id: 'enraged', name: 'Enraged', color: '#ff3b30', description: '+35% movement speed.' },
  armored: { id: 'armored', name: 'Armored', color: '#8d99ae', description: 'Takes 40% less damage.' },
  vampiric: { id: 'vampiric', name: 'Vampiric', color: '#9d0208', description: 'Heals heavily when it hurts you.' },
  explosive: { id: 'explosive', name: 'Explosive', color: '#ff9f1c', description: 'Explodes when it dies. Back off!' },
  swift: { id: 'swift', name: 'Swift', color: '#4cc9f0', description: '+60% speed, 30% less health.' },
  regenerating: { id: 'regenerating', name: 'Regenerating', color: '#70e000', description: 'Regenerates 3% health per second.' },
  summoner: { id: 'summoner', name: 'Summoner', color: '#c77dff', description: 'Keeps calling swarm bugs.' },
};

export interface BossDef {
  id: BossId;
  name: string;
  title: string;
  description: string;
  hp: number;
  speed: number;
  contactDamage: number;
  radius: number;
  color: string;
  attacks: string[];
  rewardGold: number;
  roar: number; // pitch of its signature sound
}

export const BOSSES: Record<BossId, BossDef> = {
  stumpKing: {
    id: 'stumpKing', name: 'THE STUMP KING', title: 'Corrupted Lord of the Old Wood',
    description: 'A colossal rotten tree that rules the forest floor with roots and fury.',
    hp: 5200, speed: 2.6, contactDamage: 20, radius: 2.4, color: '#7f5539',
    attacks: ['Ground Slam', 'Root Eruption', 'Sapling Summon', 'Trunk Charge'], rewardGold: 120, roar: 70,
  },
  scrapGolem: {
    id: 'scrapGolem', name: 'THE SCRAP GOLEM', title: 'Walking Junkyard',
    description: 'A towering heap of gears and girders, held together by spite. Enrages when damaged.',
    hp: 16000, speed: 3.0, contactDamage: 28, radius: 2.7, color: '#8d99ae',
    attacks: ['Bolt Volley', 'Piston Charge', 'Oil Fire', 'Overdrive (below 40% HP)'], rewardGold: 250, roar: 110,
  },
  voidDevourer: {
    id: 'voidDevourer', name: 'THE VOID DEVOURER', title: 'Hunger Between Stars',
    description: 'A floating maw that bends space. Its gravity wells drag you toward oblivion.',
    hp: 15000, speed: 2.4, contactDamage: 26, radius: 2.5, color: '#3c096c',
    attacks: ['Gravity Wells', 'Radial Barrage', 'Blink Strike', 'Event Pull', 'Starving (below 35% HP)'], rewardGold: 260, roar: 55,
  },
  goldenExecutioner: {
    id: 'goldenExecutioner', name: 'THE GOLDEN EXECUTIONER', title: 'Champion of the Arena',
    description: 'A gilded giant with a headsman\'s axe. Reads the arena like a chessboard.',
    hp: 7000, speed: 3.2, contactDamage: 24, radius: 2.2, color: '#ffb703',
    attacks: ['Axe Sweep', 'Ground Slam', 'Champion Charge', 'Call the Elites', 'Judgment (find the safe zones)'], rewardGold: 160, roar: 90,
  },
  crystalColossus: {
    id: 'crystalColossus', name: 'THE CRYSTAL COLOSSUS', title: 'Heart of the Canyon',
    description: 'A walking geode. Grows new attacks as its crystal shell cracks.',
    hp: 6200, speed: 2.4, contactDamage: 22, radius: 2.5, color: '#4cc9f0',
    attacks: ['Shard Volley', 'Spike Field', 'Resonance Wave', 'Shatter Phase (below 60% and 30% HP)'], rewardGold: 140, roar: 130,
  },
};
