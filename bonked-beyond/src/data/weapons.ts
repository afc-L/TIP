import type { WeaponDef, WeaponId, WeaponStats } from './types';

const S = (s: Partial<WeaponStats>): WeaponStats => ({
  damage: 10, cooldown: 1, area: 1, count: 1, pierce: 1, speed: 10, duration: 1, knockback: 2, crit: 0, ...s,
});

export const WEAPON_MAX_LEVEL = 8;

export const WEAPONS: WeaponDef[] = [
  {
    id: 'hammer', name: 'BONK HAMMER', icon: '🔨', color: '#ffb627',
    tags: ['physical', 'melee', 'heavy'], element: 'physical',
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
    tags: ['physical', 'melee'], element: 'physical',
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
    tags: ['arcane', 'projectile'], element: 'arcane',
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
    tags: ['physical', 'projectile'], element: 'physical',
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
    tags: ['lightning', 'area'], element: 'lightning',
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
    tags: ['explosive', 'fire', 'projectile', 'heavy'], element: 'explosive',
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
    tags: ['poison', 'area'], element: 'poison',
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
    tags: ['physical', 'area', 'heavy'], element: 'physical',
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
    tags: ['physical', 'projectile'], element: 'physical',
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
    tags: ['physical', 'melee', 'heavy'], element: 'physical',
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
  {
    id: 'meteor', name: 'METEOR STORM', icon: '☄️', color: '#ff7b00',
    tags: ['fire', 'explosive', 'area'], element: 'fire',
    description: 'Calls burning meteors down near enemies. Watch the landing markers.',
    base: S({ damage: 30, cooldown: 2.4, area: 2.4, count: 2, duration: 0.7, knockback: 6 }),
    explosive: true,
    levels: [
      { mod: { count: 1 }, text: '+1 meteor' },
      { mod: { damage: 10 }, text: '+10 damage' },
      { mod: { area: 0.6 }, text: 'Bigger impacts' },
      { mod: { count: 1, cooldown: -0.3 }, text: '+1 meteor, faster' },
      { mod: { damage: 14 }, text: '+14 damage' },
      { mod: { count: 2 }, text: '+2 meteors' },
      { mod: { damage: 20, area: 0.6 }, text: '+20 damage, bigger impacts' },
    ],
    unlock: 'survive_8',
    evolution: {
      name: 'EXTINCTION EVENT', passive: 'blastPowder', passiveLevel: 3, icon: '🌠',
      description: 'Every third volley drops a planet-killer on the densest crowd and scorches the earth.',
    },
  },
  {
    id: 'soulReaper', name: 'SOUL REAPER', icon: '💀', color: '#9bf6ff',
    tags: ['arcane', 'melee', 'projectile'], element: 'arcane',
    description: 'Sends spectral scythes after enemies. Kills may restore a little health.',
    base: S({ damage: 16, cooldown: 1.5, count: 1, pierce: 3, speed: 10, duration: 2.2, area: 0.9, knockback: 3 }),
    levels: [
      { mod: { damage: 6 }, text: '+6 damage' },
      { mod: { count: 1 }, text: '+1 scythe' },
      { mod: { pierce: 2 }, text: 'Pierce +2' },
      { mod: { damage: 8, area: 0.3 }, text: '+8 damage, bigger scythes' },
      { mod: { count: 1, cooldown: -0.2 }, text: '+1 scythe, faster' },
      { mod: { pierce: 3 }, text: 'Pierce +3' },
      { mod: { damage: 14, count: 1 }, text: '+14 damage, +1 scythe' },
    ],
    evolution: {
      name: "DEATH'S COLLECTION", passive: 'magnet', passiveLevel: 3, icon: '⚰️',
      description: 'Every kill releases a hungry soul that hunts the next victim. Heals far more often.',
    },
  },
  {
    id: 'tesla', name: 'TESLA COIL', icon: '🗼', color: '#4cc9f0',
    tags: ['lightning', 'summon'], element: 'lightning',
    description: 'Drops a coil turret that zaps chains of nearby enemies until it burns out.',
    base: S({ damage: 9, cooldown: 4, area: 6, count: 1, pierce: 2, duration: 6, knockback: 1 }),
    levels: [
      { mod: { pierce: 1 }, text: 'Arcs chain +1' },
      { mod: { damage: 4 }, text: '+4 damage' },
      { mod: { area: 1.2 }, text: 'Longer arc range' },
      { mod: { count: 1 }, text: '+1 coil' },
      { mod: { duration: 2, damage: 4 }, text: 'Coils last longer, +4 damage' },
      { mod: { pierce: 2 }, text: 'Arcs chain +2' },
      { mod: { count: 1, damage: 6 }, text: '+1 coil, +6 damage' },
    ],
    unlock: 'kills_100',
    evolution: {
      name: 'INFINITE CIRCUIT', passive: 'critLens', passiveLevel: 3, icon: '🔌',
      description: 'Coils never burn out and link into electric fences that shred anything crossing them.',
    },
  },
  {
    id: 'gravityWell', name: 'GRAVITY WELL', icon: '🌑', color: '#7b2cbf',
    tags: ['arcane', 'area'], element: 'arcane',
    description: 'Opens a gravitational field in the thick of the horde. Light enemies get sucked in.',
    base: S({ damage: 5, cooldown: 6, area: 4, count: 1, duration: 3, knockback: 0 }),
    levels: [
      { mod: { damage: 2 }, text: '+2 damage per tick' },
      { mod: { area: 0.8 }, text: 'Wider pull' },
      { mod: { duration: 1 }, text: 'Lasts longer' },
      { mod: { count: 1 }, text: '+1 well' },
      { mod: { damage: 3, cooldown: -1 }, text: '+3 damage, sooner' },
      { mod: { area: 1 }, text: 'Wider pull' },
      { mod: { damage: 5, duration: 1 }, text: '+5 damage, lasts longer' },
    ],
    unlock: 'first_boss',
    evolution: {
      name: 'EVENT HORIZON', passive: 'arcaneFocus', passiveLevel: 3, icon: '🌌',
      description: 'Wells collapse into a supernova that grows with every enemy they swallowed.',
    },
  },
  {
    id: 'boulder', name: 'BOULDER ROLLER', icon: '🪨', color: '#a98467',
    tags: ['physical', 'heavy', 'projectile'], element: 'physical',
    description: 'Rolls a huge boulder through enemy lines, flattening everything in its path.',
    base: S({ damage: 28, cooldown: 3, area: 16, count: 1, speed: 9, knockback: 12, pierce: 999 }),
    levels: [
      { mod: { damage: 10 }, text: '+10 damage' },
      { mod: { area: 4 }, text: 'Rolls further' },
      { mod: { count: 1 }, text: '+1 boulder' },
      { mod: { damage: 12, knockback: 4 }, text: '+12 damage, more knockback' },
      { mod: { cooldown: -0.5 }, text: 'Roll 0.5s sooner' },
      { mod: { count: 1 }, text: '+1 boulder' },
      { mod: { damage: 20, speed: 3 }, text: '+20 damage, faster rolling' },
    ],
    evolution: {
      name: 'AVALANCHE', passive: 'ironShell', passiveLevel: 3, icon: '🏔️',
      description: 'Giant boulders shatter into a rockslide of smaller boulders when they stop.',
    },
  },
  {
    id: 'drones', name: 'DRONE SWARM', icon: '🛸', color: '#90e0ef',
    tags: ['summon', 'projectile'], element: 'physical',
    description: 'Little drones orbit you and laser anything that gets close.',
    base: S({ damage: 7, cooldown: 0.9, area: 9, count: 2, speed: 2 }),
    levels: [
      { mod: { count: 1 }, text: '+1 drone' },
      { mod: { damage: 3 }, text: '+3 damage' },
      { mod: { cooldown: -0.15 }, text: 'Fire faster' },
      { mod: { count: 1, area: 2 }, text: '+1 drone, longer range' },
      { mod: { damage: 4 }, text: '+4 damage' },
      { mod: { count: 1, cooldown: -0.1 }, text: '+1 drone, faster' },
      { mod: { damage: 6, count: 1 }, text: '+6 damage, +1 drone' },
    ],
    evolution: {
      name: 'OVERLORD PROTOCOL', passive: 'coolingFan', passiveLevel: 3, icon: '🤖',
      description: 'Two more drones, and every shot is a homing micro-missile with a blast radius.',
    },
  },
  {
    id: 'fireTornado', name: 'FIRE TORNADO', icon: '🌪️', color: '#ff5400',
    tags: ['fire', 'area'], element: 'fire',
    description: 'Unleashes a roaming tornado of fire that burns enemies and leaves flames behind.',
    base: S({ damage: 7, cooldown: 4.5, area: 1.6, count: 1, speed: 4, duration: 4, knockback: 2 }),
    levels: [
      { mod: { damage: 3 }, text: '+3 damage per tick' },
      { mod: { duration: 1.5 }, text: 'Lasts longer' },
      { mod: { area: 0.5 }, text: 'Bigger tornado' },
      { mod: { count: 1 }, text: '+1 tornado' },
      { mod: { damage: 4, cooldown: -0.7 }, text: '+4 damage, sooner' },
      { mod: { area: 0.6, duration: 1 }, text: 'Bigger, lasts longer' },
      { mod: { count: 1, damage: 5 }, text: '+1 tornado, +5 damage' },
    ],
    unlock: 'level_15',
    evolution: {
      name: 'INFERNO CYCLONE', passive: 'longArm', passiveLevel: 3, icon: '🔥',
      description: 'Massive cyclones hunt the horde, drag enemies in and carpet the ground in fire.',
    },
  },
  {
    id: 'goldenCannon', name: 'GOLDEN CANNON', icon: '💰', color: '#ffd60a',
    tags: ['physical', 'heavy', 'projectile', 'treasure'], element: 'physical',
    description: 'A slow, devastating golden cannonball. Enemies it kills may cough up coins.',
    base: S({ damage: 70, cooldown: 3.4, count: 1, pierce: 3, speed: 16, duration: 1.6, area: 0.6, knockback: 14 }),
    levels: [
      { mod: { damage: 25 }, text: '+25 damage' },
      { mod: { pierce: 2 }, text: 'Pierce +2' },
      { mod: { cooldown: -0.4 }, text: 'Reload 0.4s faster' },
      { mod: { damage: 30, area: 0.2 }, text: '+30 damage, bigger balls' },
      { mod: { count: 1 }, text: '+1 cannonball' },
      { mod: { pierce: 3, cooldown: -0.4 }, text: 'Pierce +3, faster' },
      { mod: { damage: 50 }, text: '+50 damage' },
    ],
    evolution: {
      name: 'MIDAS BARRAGE', passive: 'luckyCoin', passiveLevel: 3, icon: '👑',
      description: 'A rapid volley of cannonballs. Damage grows with your gold and every kill pays out.',
    },
  },
  {
    id: 'mirrorShards', name: 'MIRROR SHARDS', icon: '🔷', color: '#a0e7ff',
    tags: ['arcane', 'projectile', 'frost'], element: 'frost',
    description: 'Fires crystal shards that split into smaller shards when they hit.',
    base: S({ damage: 12, cooldown: 1.3, count: 1, pierce: 1, speed: 18, duration: 1, knockback: 2 }),
    levels: [
      { mod: { damage: 4 }, text: '+4 damage' },
      { mod: { count: 1 }, text: '+1 shard' },
      { mod: { pierce: 1 }, text: 'Shards split into more pieces' },
      { mod: { damage: 6, cooldown: -0.15 }, text: '+6 damage, faster' },
      { mod: { count: 1 }, text: '+1 shard; splits twice' },
      { mod: { pierce: 1, damage: 4 }, text: 'More pieces, +4 damage' },
      { mod: { count: 1, damage: 8 }, text: '+1 shard, +8 damage' },
    ],
    evolution: {
      name: 'KALEIDOSCOPE', passive: 'powerCore', passiveLevel: 3, icon: '💠',
      description: 'Shards split into five, three times over, and every split is a guaranteed critical hit.',
    },
  },
  {
    id: 'voidRift', name: 'VOID RIFT', icon: '🕳️', color: '#c77dff',
    tags: ['arcane', 'area'], element: 'arcane',
    description: 'Tears a line through reality that shreds and slows everything inside it.',
    base: S({ damage: 6, cooldown: 3.2, area: 9, count: 1, duration: 1.6, knockback: 0 }),
    levels: [
      { mod: { damage: 3 }, text: '+3 damage per tick' },
      { mod: { area: 2 }, text: 'Longer rift' },
      { mod: { count: 1 }, text: '+1 rift' },
      { mod: { duration: 0.8 }, text: 'Rifts last longer' },
      { mod: { damage: 4, cooldown: -0.5 }, text: '+4 damage, sooner' },
      { mod: { count: 1, area: 2 }, text: '+1 rift, longer' },
      { mod: { damage: 6, duration: 0.8 }, text: '+6 damage, lasts longer' },
    ],
    unlock: 'elites_25',
    evolution: {
      name: 'ABYSSAL GATE', passive: 'xpCrystal', passiveLevel: 3, icon: '🌀',
      description: 'Four rifts rotate around you like the spokes of a wheel, pulling enemies into the void.',
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
