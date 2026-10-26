import type { WeaponDef, WeaponId, WeaponStats } from './types';

const S = (s: Partial<WeaponStats>): WeaponStats => ({
  damage: 10, cooldown: 1, area: 1, count: 1, pierce: 1, speed: 10, duration: 1, knockback: 2, crit: 0, ...s,
});

export const WEAPON_MAX_LEVEL = 8;

export const WEAPONS: WeaponDef[] = [
  {
    id: 'hammer', name: 'BONK HAMMER', icon: '🔨', color: '#ffb627',
    description: 'Swings a huge hammer in an arc toward the nearest enemy. Massive knockback.',
    base: S({ damage: 24, cooldown: 1.35, area: 3.8, knockback: 10, count: 1 }),
    levels: [
      { mod: { damage: 8 }, text: '+8 damage' },
      { mod: { area: 0.5 }, text: '+15% swing reach' },
      { mod: { cooldown: -0.2 }, text: 'Swing 0.2s faster' },
      { mod: { count: 1 }, text: 'Also swings behind you' },
      { mod: { damage: 12, knockback: 3 }, text: '+12 damage, more knockback' },
      { mod: { area: 0.6 }, text: '+18% swing reach' },
      { mod: { damage: 16, cooldown: -0.15 }, text: '+16 damage, faster swings' },
    ],
    evolution: {
      name: 'THUNDER BONKER', passive: 'powerCore', passiveLevel: 3, icon: '⚡',
      description: 'Every swing is a full 360° slam that calls lightning down on everything it hits.',
    },
  },
  {
    id: 'blades', name: 'SPINNING BLADES', icon: '🌀', color: '#c0fdff',
    description: 'Scrap blades orbit you, slicing anything they touch.',
    base: S({ damage: 9, cooldown: 0.45, area: 2.6, count: 2, speed: 3.4, knockback: 3 }),
    levels: [
      { mod: { count: 1 }, text: '+1 blade' },
      { mod: { damage: 4 }, text: '+4 damage' },
      { mod: { area: 0.5, speed: 0.6 }, text: 'Wider, faster orbit' },
      { mod: { count: 1 }, text: '+1 blade' },
      { mod: { damage: 6 }, text: '+6 damage' },
      { mod: { cooldown: -0.1, speed: 0.8 }, text: 'Hits more often' },
      { mod: { count: 1, damage: 6 }, text: '+1 blade, +6 damage' },
    ],
    evolution: {
      name: 'VORTEX ENGINE', passive: 'coolingFan', passiveLevel: 3, icon: '🌪️',
      description: 'Two rings of blades that breathe in and out and drag enemies into the grinder.',
    },
  },
  {
    id: 'orb', name: 'MAGIC ORB', icon: '🔮', color: '#b388ff',
    description: 'Fires seeking arcane orbs at nearby enemies.',
    base: S({ damage: 14, cooldown: 1.1, count: 1, pierce: 1, speed: 13, duration: 1.7, area: 0.45, knockback: 2 }),
    levels: [
      { mod: { count: 1 }, text: '+1 orb' },
      { mod: { damage: 6 }, text: '+6 damage' },
      { mod: { pierce: 1 }, text: 'Orbs pierce +1 enemy' },
      { mod: { count: 1, cooldown: -0.1 }, text: '+1 orb, faster casting' },
      { mod: { damage: 8, area: 0.15 }, text: '+8 damage, bigger orbs' },
      { mod: { pierce: 2 }, text: 'Orbs pierce +2 enemies' },
      { mod: { count: 1, damage: 10 }, text: '+1 orb, +10 damage' },
    ],
    evolution: {
      name: 'BLACK HOLE ORB', passive: 'arcaneFocus', passiveLevel: 3, icon: '🕳️',
      description: 'Orbs collapse into singularities that swallow and shred the horde.',
    },
  },
  {
    id: 'boomerang', name: 'BOOMERANG', icon: '🪃', color: '#f77f00',
    description: 'Flies out and comes back, hitting enemies both ways.',
    base: S({ damage: 16, cooldown: 1.8, area: 9, count: 1, speed: 16, knockback: 4, pierce: 999 }),
    levels: [
      { mod: { damage: 6 }, text: '+6 damage' },
      { mod: { count: 1 }, text: '+1 boomerang' },
      { mod: { area: 2 }, text: 'Flies further' },
      { mod: { damage: 8, speed: 3 }, text: '+8 damage, faster flight' },
      { mod: { count: 1 }, text: '+1 boomerang' },
      { mod: { cooldown: -0.3 }, text: 'Throw 0.3s faster' },
      { mod: { damage: 12, count: 1 }, text: '+12 damage, +1 boomerang' },
    ],
    evolution: {
      name: 'INFINITE RETURN', passive: 'longArm', passiveLevel: 3, icon: '♾️',
      description: 'Giant boomerangs that never land, looping endlessly through the horde.',
    },
  },
  {
    id: 'lightning', name: 'LIGHTNING STRIKE', icon: '🌩️', color: '#7df9ff',
    description: 'Calls chain lightning on a random nearby enemy. Jumps between targets.',
    base: S({ damage: 20, cooldown: 1.9, area: 4.5, count: 2, pierce: 1, knockback: 1, crit: 0.05 }),
    levels: [
      { mod: { count: 1 }, text: 'Chains to +1 enemy' },
      { mod: { damage: 8 }, text: '+8 damage' },
      { mod: { pierce: 1 }, text: '+1 bolt per cast' },
      { mod: { count: 2, area: 1 }, text: 'Chains +2, longer jumps' },
      { mod: { cooldown: -0.3 }, text: 'Strike 0.3s faster' },
      { mod: { damage: 12, crit: 0.05 }, text: '+12 damage, +5% crit' },
      { mod: { pierce: 1, count: 2 }, text: '+1 bolt, chains +2' },
    ],
    unlock: 'kills_100',
    evolution: {
      name: 'STORM GOD', passive: 'critLens', passiveLevel: 3, icon: '⛈️',
      description: 'A permanent storm follows you. Critical bolts fork into fresh chains.',
    },
  },
  {
    id: 'rocket', name: 'ROCKET LAUNCHER', icon: '🚀', color: '#ff595e',
    description: 'Slow but devastating rockets that explode on impact.',
    base: S({ damage: 34, cooldown: 2.6, area: 2.8, count: 1, speed: 12, knockback: 8 }),
    explosive: true,
    levels: [
      { mod: { damage: 12 }, text: '+12 damage' },
      { mod: { area: 0.6 }, text: 'Bigger explosions' },
      { mod: { count: 1 }, text: '+1 rocket' },
      { mod: { cooldown: -0.4 }, text: 'Reload 0.4s faster' },
      { mod: { damage: 18, area: 0.5 }, text: '+18 damage, bigger blasts' },
      { mod: { count: 1 }, text: '+1 rocket' },
      { mod: { damage: 25, cooldown: -0.3 }, text: '+25 damage, faster reload' },
    ],
    unlock: 'survive_5',
    evolution: {
      name: 'APOCALYPSE CANNON', passive: 'blastPowder', passiveLevel: 3, icon: '☄️',
      description: 'Rockets burst into a carpet of cluster bombs.',
    },
  },
  {
    id: 'poison', name: 'POISON CLOUD', icon: '☠️', color: '#80ff72',
    description: 'Drops toxic clouds that damage and slow enemies inside.',
    base: S({ damage: 6, cooldown: 3.4, area: 2.6, count: 1, duration: 4, knockback: 0 }),
    explosive: true,
    levels: [
      { mod: { damage: 3 }, text: '+3 damage per tick' },
      { mod: { area: 0.6 }, text: 'Bigger clouds' },
      { mod: { count: 1 }, text: '+1 cloud' },
      { mod: { duration: 1.5 }, text: 'Clouds last longer' },
      { mod: { damage: 4, area: 0.5 }, text: '+4 damage, bigger clouds' },
      { mod: { count: 1, cooldown: -0.5 }, text: '+1 cloud, faster' },
      { mod: { damage: 6, duration: 1.5 }, text: '+6 damage, longer clouds' },
    ],
    unlock: 'level_15',
    evolution: {
      name: 'PLAGUE GARDEN', passive: 'regenSeed', passiveLevel: 3, icon: '🍄',
      description: 'You exude a toxic aura. Enemies that die inside it burst into new clouds and heal you.',
    },
  },
  {
    id: 'quake', name: 'EARTHQUAKE', icon: '🌋', color: '#c9a227',
    description: 'Slams the ground, sending out a shockwave that damages and pushes enemies away.',
    base: S({ damage: 18, cooldown: 3.2, area: 6, count: 1, knockback: 13 }),
    explosive: true,
    levels: [
      { mod: { damage: 8 }, text: '+8 damage' },
      { mod: { area: 1 }, text: 'Wider shockwave' },
      { mod: { cooldown: -0.4 }, text: 'Quake 0.4s sooner' },
      { mod: { damage: 10, knockback: 3 }, text: '+10 damage, stronger push' },
      { mod: { area: 1.2 }, text: 'Wider shockwave' },
      { mod: { count: 1 }, text: 'Double quake' },
      { mod: { damage: 16, cooldown: -0.4 }, text: '+16 damage, faster' },
    ],
    unlock: 'first_boss',
    evolution: {
      name: 'TECTONIC RIFT', passive: 'ironHeart', passiveLevel: 3, icon: '🏔️',
      description: 'Shockwaves tear erupting fissures through the ground. Damage scales with max HP.',
    },
  },
  {
    id: 'knives', name: 'THROWING KNIVES', icon: '🗡️', color: '#e0e1dd',
    description: 'Throws a fan of knives where you aim (or where you run).',
    base: S({ damage: 9, cooldown: 0.75, count: 2, pierce: 1, speed: 24, duration: 0.85, knockback: 1.5, crit: 0.08 }),
    levels: [
      { mod: { count: 1 }, text: '+1 knife' },
      { mod: { damage: 4 }, text: '+4 damage' },
      { mod: { pierce: 1 }, text: 'Knives pierce +1' },
      { mod: { count: 1, cooldown: -0.1 }, text: '+1 knife, faster' },
      { mod: { damage: 5, crit: 0.05 }, text: '+5 damage, +5% crit' },
      { mod: { count: 2 }, text: '+2 knives' },
      { mod: { pierce: 2, damage: 6 }, text: 'Pierce +2, +6 damage' },
    ],
    evolution: {
      name: 'THOUSAND EDGES', passive: 'runningShoes', passiveLevel: 3, icon: '✴️',
      description: 'Knives erupt in every direction, pierce everything, and hit harder the faster you run.',
    },
  },
  {
    id: 'charge', name: 'ANTLER CHARGE', icon: '🦌', color: '#adb5bd',
    description: 'Lunge forward, plowing through enemies in your path. Stomps when standing still.',
    base: S({ damage: 28, cooldown: 2.8, area: 6, count: 1, speed: 24, knockback: 14 }),
    levels: [
      { mod: { damage: 10 }, text: '+10 damage' },
      { mod: { cooldown: -0.3 }, text: 'Charge 0.3s sooner' },
      { mod: { area: 1.5 }, text: 'Longer charge' },
      { mod: { damage: 12, knockback: 4 }, text: '+12 damage, more knockback' },
      { mod: { cooldown: -0.3 }, text: 'Charge 0.3s sooner' },
      { mod: { area: 1.5, damage: 10 }, text: 'Longer charge, +10 damage' },
      { mod: { damage: 20, cooldown: -0.3 }, text: '+20 damage, faster' },
    ],
    evolution: {
      name: 'JUGGERNAUT', passive: 'thorns', passiveLevel: 3, icon: '🛡️',
      description: 'Invulnerable while charging. Each charge ends in a shattering shockwave.',
    },
  },
];

export const WEAPON_MAP = Object.fromEntries(WEAPONS.map((w) => [w.id, w])) as Record<WeaponId, WeaponDef>;

export function weaponStatsAt(def: WeaponDef, level: number): WeaponStats {
  const s = { ...def.base };
  for (let i = 0; i < Math.min(level - 1, def.levels.length); i++) {
    const m = def.levels[i].mod;
    for (const k in m) {
      const key = k as keyof WeaponStats;
      s[key] += m[key] as number;
    }
  }
  return s;
}
