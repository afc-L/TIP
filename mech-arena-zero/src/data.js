// ============================================================================
// MECH ARENA ZERO — static game data
// All weapons/equipment are fictional, arcade-style.
// ============================================================================

export const DAMAGE_TYPES = {
  energy: { name: 'Energy', color: '#4fe3ff', desc: 'Strong vs shields (+25%).' },
  impact: { name: 'Impact', color: '#ffd166', desc: 'Strong vs armor once shields are down (+20%).' },
  explosive: { name: 'Explosive', color: '#ff8a3d', desc: 'Area damage. Weak vs shields (-15%).' },
  precision: { name: 'Precision', color: '#c792ff', desc: 'Critical hits on head/cockpit (x1.6).' },
};

// ---------------------------------------------------------------------------
// Mech frames (the 8 unlockable mech designs). Each is a chassis class.
// ---------------------------------------------------------------------------
export const FRAMES = {
  striker: {
    id: 'striker', name: 'Striker', cls: 'Medium', model: 'striker',
    desc: 'Balanced assault frame. Reliable armor, good speed and a missile barrage.',
    hp: 820, shield: 260, speed: 11.5, accel: 6.0, jump: 13, energy: 100, energyRegen: 22,
    capacity: 42, slots: 3, radius: 2.0, height: 7.2, ability: 'barrage',
    level: 1, cost: 0, rp: 0, stepLen: 3.4,
  },
  viper: {
    id: 'viper', name: 'Viper', cls: 'Light', model: 'viper',
    desc: 'Reverse-joint skirmisher. Blistering speed, paper armor. Overdrive boosts speed and fire rate.',
    hp: 540, shield: 220, speed: 15.5, accel: 9.0, jump: 15, energy: 120, energyRegen: 30,
    capacity: 32, slots: 2, radius: 1.6, height: 5.6, ability: 'overdrive',
    level: 2, cost: 4000, rp: 0, stepLen: 3.6,
  },
  bulwark: {
    id: 'bulwark', name: 'Bulwark', cls: 'Heavy', model: 'bulwark',
    desc: 'Fortress frame with shield emitters. Its Aegis Dome protects itself and nearby allies.',
    hp: 980, shield: 480, speed: 9.5, accel: 4.5, jump: 11, energy: 110, energyRegen: 20,
    capacity: 48, slots: 3, radius: 2.4, height: 7.0, ability: 'aegis',
    level: 4, cost: 7500, rp: 0, stepLen: 3.0,
  },
  titan: {
    id: 'titan', name: 'Titan', cls: 'Heavy', model: 'titan',
    desc: 'Towering brawler. Massive armor and a devastating leaping Ground Slam.',
    hp: 1250, shield: 280, speed: 9.0, accel: 4.0, jump: 11.5, energy: 100, energyRegen: 18,
    capacity: 52, slots: 3, radius: 2.7, height: 9.0, ability: 'slam',
    level: 6, cost: 10000, rp: 0, stepLen: 3.8,
  },
  phantom: {
    id: 'phantom', name: 'Phantom', cls: 'Light', model: 'phantom',
    desc: 'Stealth hunter. Active camouflage makes enemies lose track of you.',
    hp: 620, shield: 300, speed: 14.0, accel: 8.0, jump: 14.5, energy: 130, energyRegen: 28,
    capacity: 36, slots: 3, radius: 1.7, height: 7.0, ability: 'cloak',
    level: 8, cost: 12500, rp: 0, stepLen: 3.8,
  },
  juggernaut: {
    id: 'juggernaut', name: 'Juggernaut', cls: 'Assault', model: 'juggernaut',
    desc: 'Four-legged siege platform. Slow, unstoppable, and Fortify makes it nearly invincible.',
    hp: 1500, shield: 320, speed: 7.8, accel: 3.2, jump: 9.5, energy: 90, energyRegen: 16,
    capacity: 60, slots: 4, radius: 3.0, height: 7.4, ability: 'fortify',
    level: 11, cost: 16000, rp: 0, stepLen: 2.6,
  },
  wraith: {
    id: 'wraith', name: 'Wraith', cls: 'Experimental', model: 'wraith',
    desc: 'Hovering energy frame. No legs — glides on a grav ring and Phase Blinks across the field.',
    hp: 700, shield: 420, speed: 13.0, accel: 7.0, jump: 13, energy: 150, energyRegen: 34,
    capacity: 44, slots: 4, radius: 1.9, height: 7.4, ability: 'blink',
    level: 14, cost: 18000, rp: 60, stepLen: 4.0, hover: true,
  },
  apex: {
    id: 'apex', name: 'Apex', cls: 'Experimental', model: 'apex',
    desc: 'Endgame prototype. Superb all-round stats and Overclock, which supercharges every system.',
    hp: 1000, shield: 420, speed: 13.0, accel: 7.0, jump: 14, energy: 140, energyRegen: 30,
    capacity: 56, slots: 4, radius: 2.1, height: 8.2, ability: 'overclock',
    level: 20, cost: 30000, rp: 150, stepLen: 3.8,
  },
};
export const FRAME_ORDER = ['striker', 'viper', 'bulwark', 'titan', 'phantom', 'juggernaut', 'wraith', 'apex'];

export const ABILITIES = {
  barrage: { name: 'Missile Barrage', cd: 18, desc: 'Launches 12 homing micro-missiles at your target.' },
  overdrive: { name: 'Overdrive', cd: 20, dur: 5, desc: '+40% speed and +35% fire rate for 5s.' },
  aegis: { name: 'Aegis Dome', cd: 24, dur: 6, desc: 'Dome that cuts damage by 70% for you and allies inside for 6s.' },
  slam: { name: 'Ground Slam', cd: 16, desc: 'Leap and crash down: 140 impact damage and knockback in a wide radius.' },
  cloak: { name: 'Active Camo', cd: 22, dur: 6, desc: 'Become nearly invisible for 6s. Enemies lose your position. Firing shortens it.' },
  fortify: { name: 'Fortify', cd: 22, dur: 6, desc: '-50% damage taken, +40% weapon damage, -40% speed for 6s.' },
  blink: { name: 'Phase Blink', cd: 8, desc: 'Teleport ~28m in your move direction and restore 25% shield.' },
  overclock: { name: 'Overclock', cd: 30, dur: 8, desc: '+25% damage and speed, no heat, equipment cooldowns reset.' },
};

// ---------------------------------------------------------------------------
// Weapons
// kind: proj | hitscan | missile | lob | beam
// ---------------------------------------------------------------------------
export const WEAPONS = {
  pulse: {
    id: 'pulse', name: 'Pulse Cannon', cat: 'Energy Cannon', dmgType: 'energy', kind: 'proj',
    dmg: 34, rate: 3.2, speed: 150, range: 170, spread: 0.006, heat: 9,
    weight: 7, color: 0x44ddff, size: 0.5, sound: 'pulse', level: 1, cost: 0,
    desc: 'Dependable mid-range energy bolts. Overheats under sustained fire.',
  },
  missile: {
    id: 'missile', name: 'Swarm Pod', cat: 'Missile Launcher', dmgType: 'explosive', kind: 'missile',
    dmg: 22, splash: 3.5, salvo: 6, salvoDelay: 0.08, speed: 70, turn: 3.2, range: 190, spread: 0.12,
    mag: 1, reload: 5.0, rate: 1, weight: 10, color: 0xff9944, size: 0.35, sound: 'missile', level: 1, cost: 0,
    desc: 'Six-missile salvo. Missiles home in on a locked target (T).',
  },
  arc: {
    id: 'arc', name: 'Arc Repeater', cat: 'Rapid-Fire Energy', dmgType: 'energy', kind: 'proj',
    dmg: 8.5, rate: 11, speed: 185, range: 115, spread: 0.022, heat: 3.3,
    weight: 6, color: 0x66ffcc, size: 0.28, sound: 'arc', level: 1, cost: 1500,
    desc: 'Hose of small energy darts. Great vs shields and fast targets.',
  },
  scatter: {
    id: 'scatter', name: 'Scatter Blaster', cat: 'Energy Shotgun', dmgType: 'energy', kind: 'proj',
    dmg: 10, pellets: 9, rate: 1.35, speed: 165, range: 50, spread: 0.075, mag: 6, reload: 2.0,
    weight: 7, color: 0x9be7ff, size: 0.3, sound: 'scatter', level: 2, cost: 2200,
    desc: 'Devastating up close, useless at range.',
  },
  gauss: {
    id: 'gauss', name: 'Gauss Autocannon', cat: 'Kinetic Repeater', dmgType: 'impact', kind: 'proj',
    dmg: 17, rate: 7, speed: 235, range: 150, spread: 0.012, mag: 45, reload: 2.6,
    weight: 9, color: 0xffd166, size: 0.3, sound: 'gauss', level: 3, cost: 2800,
    desc: 'High-velocity slugs that chew through armor.',
  },
  plasma: {
    id: 'plasma', name: 'Plasma Launcher', cat: 'Plasma Launcher', dmgType: 'explosive', kind: 'proj',
    dmg: 72, splash: 6, gravity: 10, rate: 1.0, speed: 78, range: 150, spread: 0.004, mag: 5, reload: 2.4,
    weight: 10, color: 0xff55ff, size: 0.9, sound: 'plasma', level: 3, cost: 3200,
    desc: 'Slow arcing plasma orbs with splash damage. Punishes campers.',
  },
  rail: {
    id: 'rail', name: 'Rail Lance', cat: 'Heavy Rail', dmgType: 'precision', kind: 'hitscan',
    dmg: 150, rate: 0.7, range: 330, spread: 0.0, mag: 4, reload: 2.8,
    weight: 12, color: 0xc792ff, size: 0.3, sound: 'rail', level: 5, cost: 4500,
    desc: 'Instant-hit precision lance. Huge damage, crits on the cockpit.',
  },
  mortar: {
    id: 'mortar', name: 'Nova Mortar', cat: 'Siege Launcher', dmgType: 'explosive', kind: 'lob',
    dmg: 95, splash: 9, rate: 0.55, flight: 1.5, range: 160, mag: 3, reload: 3.2,
    weight: 12, color: 0xffaa33, size: 1.0, sound: 'mortar', level: 7, cost: 5200,
    desc: 'Lobs shells over cover onto the aim point. Huge blast.',
  },
  ion: {
    id: 'ion', name: 'Ion Lance', cat: 'Energy Beam', dmgType: 'energy', kind: 'beam',
    dmg: 7.2, rate: 16, range: 75, heat: 2.6, spread: 0,
    weight: 11, color: 0x7af0ff, size: 0.35, sound: 'ion', level: 10, cost: 6000, rp: 40, experimental: true,
    desc: 'Experimental continuous beam. Melts shields at close-mid range.',
  },
  tempest: {
    id: 'tempest', name: 'Tempest Array', cat: 'Missile Launcher', dmgType: 'explosive', kind: 'missile',
    dmg: 19, splash: 4, salvo: 10, salvoDelay: 0.06, speed: 80, turn: 4.2, range: 210, spread: 0.18,
    mag: 1, reload: 5.5, rate: 1, weight: 13, color: 0xff6644, size: 0.35, sound: 'missile',
    level: 14, cost: 8000, rp: 60, experimental: true,
    desc: 'Experimental ten-missile swarm with aggressive tracking.',
  },
  photon: {
    id: 'photon', name: 'Photon Rail', cat: 'Heavy Rail', dmgType: 'precision', kind: 'hitscan',
    dmg: 105, rate: 1.25, range: 300, heat: 34, pierce: true,
    weight: 12, color: 0xffffff, size: 0.3, sound: 'rail', level: 16, cost: 9000, rp: 70, experimental: true,
    desc: 'Experimental heat-based rail that pierces through multiple targets.',
  },
};
// ---- Melee: swing on fire. `reach` is the hit range, `lunge` the distance the mech dashes in to close on a target.
// windup/active/recover are swing phases (s); `arc` is the hit cone (radians).
Object.assign(WEAPONS, {
  blade: {
    id: 'blade', name: 'Plasma Blade', cat: 'Melee · Energy Sword', dmgType: 'energy', kind: 'melee', style: 'slash',
    dmg: 95, rate: 1.6, reach: 8.5, lunge: 20, arc: 2.2, windup: 0.1, active: 0.14, recover: 0.2, deflect: true,
    range: 28, weight: 6, color: 0x5ce8ff, size: 0.3, sound: 'swing', level: 2, cost: 1800,
    desc: 'Fast sweeping slashes with a lunge. The blade burns enemy bolts out of the air mid-swing.',
  },
  claws: {
    id: 'claws', name: 'Thermal Claws', cat: 'Melee · Rapid Strikes', dmgType: 'impact', kind: 'melee', style: 'claw',
    dmg: 42, rate: 3.6, reach: 7, lunge: 16, arc: 1.8, windup: 0.05, active: 0.09, recover: 0.08, burn: 14,
    range: 22, weight: 5, color: 0xff8a3d, size: 0.3, sound: 'swing', level: 3, cost: 2200,
    desc: 'A blur of superheated claw strikes that leave targets burning for 2s. Best on light frames.',
  },
  hammer: {
    id: 'hammer', name: 'Seismic Hammer', cat: 'Melee · Heavy Impact', dmgType: 'impact', kind: 'melee', style: 'smash',
    dmg: 230, rate: 0.62, reach: 9, lunge: 14, arc: 2.6, windup: 0.32, active: 0.1, recover: 0.4, aoe: 7, knock: 20, stagger: 1.2,
    range: 22, weight: 10, color: 0xffd166, size: 0.3, sound: 'swing', level: 4, cost: 3500,
    desc: 'Slow overhead smash that cracks the ground, hitting everything nearby and staggering targets.',
  },
  lance: {
    id: 'lance', name: 'Arc Lance', cat: 'Melee · Charging Thrust', dmgType: 'precision', kind: 'melee', style: 'thrust',
    dmg: 165, rate: 0.9, reach: 11, lunge: 32, arc: 0.7, windup: 0.16, active: 0.16, recover: 0.28, pierce: true,
    range: 42, weight: 8, color: 0xc792ff, size: 0.3, sound: 'swing', level: 6, cost: 4200,
    desc: 'Long-reach thrust with the longest lunge. A narrow strike that pierces every mech in its line.',
  },
});
export const MELEE_ORDER = ['blade', 'claws', 'hammer', 'lance'];
export const WEAPON_ORDER = ['pulse', 'missile', 'arc', 'scatter', 'gauss', 'plasma', 'rail', 'mortar', 'blade', 'claws', 'hammer', 'lance', 'ion', 'tempest', 'photon'];

// ---------------------------------------------------------------------------
// Special equipment (active modules, keys 1-4 select, Q activates)
// ---------------------------------------------------------------------------
export const EQUIPMENT = {
  aegis: { id: 'aegis', name: 'Aegis Bubble', cat: 'Temporary Energy Shield', cd: 18, dur: 5, weight: 5, level: 1, cost: 0, icon: '⬡',
    desc: 'Projects a 300-point overshield for 5s.' },
  repair: { id: 'repair', name: 'Repair Nanites', cat: 'Repair System', cd: 28, dur: 5, weight: 6, level: 1, cost: 0, icon: '✚',
    desc: 'Restores 35% armor over 5s.' },
  boost: { id: 'boost', name: 'Vector Thruster', cat: 'Short-Range Boost', cd: 7, weight: 4, level: 2, cost: 1200, icon: '➤',
    desc: 'Explosive burst of speed in your move direction. No energy cost.' },
  servo: { id: 'servo', name: 'Overdrive Servos', cat: 'Movement Enhancement', cd: 20, dur: 6, weight: 4, level: 2, cost: 1500, icon: '⇮',
    desc: '+35% speed, +40% jump and double energy regen for 6s.' },
  target: { id: 'target', name: 'Target Uplink', cat: 'Targeting Assistance', cd: 22, dur: 8, weight: 4, level: 3, cost: 1800, icon: '◎',
    desc: 'Strong aim assist, +20% damage, double lock range, enemies shown on minimap for 8s.' },
  ecm: { id: 'ecm', name: 'Countermeasure Pod', cat: 'Electronic Warfare', cd: 20, dur: 5, weight: 3, level: 5, cost: 2500, icon: '≋',
    desc: 'Destroys nearby missiles; enemies targeting you lose accuracy for 5s.' },
  capacitor: { id: 'capacitor', name: 'Shield Capacitor', cat: 'Experimental', cd: 30, weight: 5, level: 8, cost: 4000, rp: 30, experimental: true, icon: '⚡',
    desc: 'Instantly restores full shields.' },
  drone: { id: 'drone', name: 'Sentry Drone', cat: 'Experimental', cd: 35, dur: 15, weight: 6, level: 12, cost: 6000, rp: 50, experimental: true, icon: '✦',
    desc: 'Deploys a hovering drone that fires on enemies for 15s.' },
};
export const EQUIP_ORDER = ['aegis', 'repair', 'boost', 'servo', 'target', 'ecm', 'capacitor', 'drone'];

export const ARMORS = {
  standard: { id: 'standard', name: 'Standard Armor', hpMul: 1, speedMul: 1, resist: {}, weight: 0, level: 1, cost: 0,
    desc: 'Baseline composite plating.' },
  reinforced: { id: 'reinforced', name: 'Reinforced Armor', hpMul: 1.3, speedMul: 0.92, resist: { impact: 0.15, explosive: 0.1 }, weight: 7, level: 2, cost: 2000,
    desc: '+30% armor, resists impact/explosive. -8% speed.' },
  light: { id: 'light', name: 'Lightweight Armor', hpMul: 0.85, speedMul: 1.1, energyRegenMul: 1.15, resist: {}, weight: -3, level: 3, cost: 1600,
    desc: '-15% armor, +10% speed, +15% energy regen. Frees 3 capacity.' },
  energy: { id: 'energy', name: 'Energy-Resistant Armor', hpMul: 1.05, speedMul: 1, resist: { energy: 0.3, explosive: -0.1 }, weight: 4, level: 4, cost: 3000,
    desc: '-30% energy damage taken, +10% explosive damage taken.' },
  adaptive: { id: 'adaptive', name: 'Adaptive Plating', hpMul: 1.15, speedMul: 0.98, resist: { energy: 0.12, impact: 0.12, explosive: 0.12, precision: 0.12 }, weight: 6, level: 12, cost: 7000, rp: 45, experimental: true,
    desc: 'Experimental: +15% armor and 12% resistance to everything.' },
};
export const ARMOR_ORDER = ['standard', 'reinforced', 'light', 'energy', 'adaptive'];

export const MOBILITY = {
  standard: { id: 'standard', name: 'Standard Legs', weight: 0, level: 1, cost: 0, desc: 'Balanced actuators.' },
  heavy: { id: 'heavy', name: 'Heavy Legs', weight: 4, level: 2, cost: 1800, hpMul: 1.08, speedMul: 0.93, knockRes: 0.6, stability: 0.5,
    desc: '+8% armor, -60% knockback, steadier aim while moving. -7% speed.' },
  speed: { id: 'speed', name: 'Speed Boosters', weight: 4, level: 3, cost: 2200, speedMul: 1.18, sprintCost: 0.5,
    desc: '+18% speed, sprinting costs half energy.' },
  jump: { id: 'jump', name: 'Jump Boosters', weight: 3, level: 4, cost: 2000, jumpMul: 1.35, jetMul: 1.7,
    desc: '+35% jump and far stronger jump jets (hold Space in air).' },
  dash: { id: 'dash', name: 'Dash System', weight: 3, level: 5, cost: 2600, dashCost: 0.55, dashCharges: 2,
    desc: 'Dashes cost 45% less and you get 2 dash charges.' },
};
export const MOBILITY_ORDER = ['standard', 'heavy', 'speed', 'jump', 'dash'];

// ---------------------------------------------------------------------------
// Upgrade tree
// ---------------------------------------------------------------------------
export const UPGRADE_BRANCHES = {
  armor: { name: 'Armor', icon: '▣', per: 'Armor +5%', desc: 'Structural integrity of the chassis.' },
  mobility: { name: 'Movement', icon: '➶', per: 'Speed +3%, dash cost -6%', desc: 'Actuators and thrusters.' },
  weapons: { name: 'Weapon Efficiency', icon: '✹', per: 'Damage +4%, heat/reload -5%', desc: 'Fire control and cooling.' },
  energy: { name: 'Energy Capacity', icon: 'ϟ', per: 'Energy +8%, regen +8%', desc: 'Reactor output.' },
  shields: { name: 'Shield Strength', icon: '⬡', per: 'Shield +7%, recharge delay -8%', desc: 'Shield emitters.' },
  abilities: { name: 'Special Abilities', icon: '✦', per: 'Ability & equipment cooldowns -6%', desc: 'Module firmware.' },
};
export const UPGRADE_TIERS = [
  { cost: 1500, rp: 0, level: 1 },
  { cost: 3000, rp: 0, level: 4 },
  { cost: 5000, rp: 10, level: 8 },
  { cost: 7500, rp: 25, level: 12 },
  { cost: 11000, rp: 45, level: 18 },
];

// ---------------------------------------------------------------------------
// Arenas
// ---------------------------------------------------------------------------
export const ARENAS = {
  industrial: { id: 'industrial', name: 'Industrial Zone', level: 1, desc: 'Abandoned factories, container stacks and multiple routes.' },
  desert: { id: 'desert', name: 'Desert Outpost', level: 2, desc: 'Open dunes, rock formations and long sightlines.' },
  frozen: { id: 'frozen', name: 'Frozen Research Facility', level: 4, desc: 'Snowbound labs with drifting fog that limits visibility.' },
  neon: { id: 'neon', name: 'Neon City', level: 6, desc: 'Tight streets between glowing skyscrapers.' },
  volcanic: { id: 'volcanic', name: 'Volcanic Wasteland', level: 9, desc: 'Basalt ridges and lava channels that burn your armor.' },
  orbital: { id: 'orbital', name: 'Orbital Station', level: 12, desc: 'Low-gravity interior decks high above the planet.' },
};
export const ARENA_ORDER = ['industrial', 'desert', 'frozen', 'neon', 'volcanic', 'orbital'];

// ---------------------------------------------------------------------------
// Enemy archetypes (AI personalities + loadouts)
// ---------------------------------------------------------------------------
export const ENEMY_TYPES = {
  scout: { name: 'Scout', frame: 'viper', weapons: ['arc', 'scatter'], role: 'scout', armor: 'light', mobility: 'speed', equip: ['boost'], weak: 'Low armor — any burst kills it. Explosives struggle to hit.' },
  sniper: { name: 'Sniper', frame: 'phantom', weapons: ['rail', 'pulse'], role: 'sniper', armor: 'standard', mobility: 'jump', equip: ['boost'], weak: 'Weak up close. Rush it through cover.' },
  assault: { name: 'Assault', frame: 'striker', weapons: ['pulse', 'missile'], role: 'assault', armor: 'standard', mobility: 'standard', equip: ['aegis'], weak: 'Balanced. Out-maneuver it.' },
  tank: { name: 'Tank', frame: 'titan', weapons: ['gauss', 'plasma'], role: 'tank', armor: 'reinforced', mobility: 'heavy', equip: ['aegis'], weak: 'Slow and resists impact — use energy or precision and keep moving.' },
  support: { name: 'Support', frame: 'bulwark', weapons: ['pulse', 'arc'], role: 'support', armor: 'energy', mobility: 'standard', equip: ['repair'], weak: 'Heals allies — kill it first. Resists energy; use impact/explosives.' },
  flanker: { name: 'Flanker', frame: 'viper', weapons: ['scatter', 'gauss'], role: 'flanker', armor: 'standard', mobility: 'dash', equip: ['boost'], weak: 'Watch your back. Fragile when caught in the open.' },
  heavy: { name: 'Juggernaut', frame: 'juggernaut', weapons: ['gauss', 'mortar'], role: 'tank', armor: 'reinforced', mobility: 'heavy', equip: ['repair'], weak: 'Very slow. Flank it — mortars cannot hit you up close.' },
  elite: { name: 'Elite', frame: 'apex', weapons: ['rail', 'arc'], role: 'elite', armor: 'adaptive', mobility: 'dash', equip: ['aegis', 'repair'], weak: 'Adapts its tactics. Bait its abilities, then punish.' },
  brawler: { name: 'Brawler', frame: 'striker', weapons: ['blade', 'scatter'], role: 'brawler', armor: 'reinforced', mobility: 'dash', equip: ['aegis'], weak: 'Lethal up close. Keep your distance and punish its lunge with burst damage.' },
  wraith: { name: 'Specter', frame: 'wraith', weapons: ['ion', 'plasma'], role: 'flanker', armor: 'energy', mobility: 'standard', equip: ['boost'], weak: 'Blinks behind you. Impact weapons hurt it most.' },
};

export const DIFFICULTIES = {
  easy: { name: 'Easy', reward: 0.75, rp: 0, dmg: 0.42, desc: 'Slower reactions, poor aim, rarely coordinates.' },
  normal: { name: 'Normal', reward: 1.0, rp: 1, dmg: 0.58, desc: 'Uses cover and basic positioning.' },
  hard: { name: 'Hard', reward: 1.35, rp: 2, dmg: 0.75, desc: 'Aggressive, predicts movement, coordinates flanks.' },
  expert: { name: 'Expert', reward: 1.7, rp: 4, dmg: 0.9, desc: 'Tactical crossfire, dodges shots, punishes mistakes.' },
};
export const DIFF_ORDER = ['easy', 'normal', 'hard', 'expert'];

// ---------------------------------------------------------------------------
// Game modes
// ---------------------------------------------------------------------------
export const MODES = {
  survival: { id: 'survival', name: 'Arena Survival', level: 1, icon: '∞',
    desc: 'Endless waves. New enemy types every few waves and a special encounter every 5th wave.' },
  elimination: { id: 'elimination', name: 'Elimination', level: 2, icon: '⚔',
    desc: 'Team battle. Destroy every mech on the opposing team.' },
  challenge: { id: 'challenge', name: 'Challenge Missions', level: 3, icon: '◆',
    desc: 'Special missions with unusual conditions and big rewards.' },
  boss: { id: 'boss', name: 'Boss Battles', level: 4, icon: '☠',
    desc: 'Face enormous specialized war machines with multiple phases.' },
  domination: { id: 'domination', name: 'Domination', level: 5, icon: '⚑',
    desc: 'Capture and hold three control points. First team to 200 points wins.' },
};
export const MODE_ORDER = ['survival', 'elimination', 'challenge', 'boss', 'domination'];

export const ELIM_SIZES = {
  duel: { name: 'Duel 1v1', allies: 0, enemies: 1, reward: 0.8 },
  outnumbered: { name: 'Outnumbered 1v3', allies: 0, enemies: 3, reward: 1.5 },
  skirmish: { name: 'Skirmish 2v3', allies: 1, enemies: 3, reward: 1.2 },
  squad: { name: 'Squad 3v4', allies: 2, enemies: 4, reward: 1.35 },
};

// Randomized match conditions
export const CONDITIONS = {
  clear: { name: 'Clear Skies', desc: 'Standard conditions.' },
  night: { name: 'Night Ops', desc: 'Darkness and reduced visibility.', fog: 0.5, dark: true },
  ionstorm: { name: 'Ion Storm', desc: 'Shields recharge 40% slower for everyone.', shieldRegen: 0.6 },
  overcharge: { name: 'Overcharge', desc: 'Energy regenerates 60% faster.', energyRegen: 1.6 },
  lowgrav: { name: 'Low Gravity', desc: 'Gravity reduced by 45%. Jump high.', gravity: 0.55 },
  supply: { name: 'Supply Drops', desc: 'Repair caches appear more often.', supply: true },
  hunter: { name: 'Bounty Hunt', desc: '+25% credits for kills, enemies deal +10% damage.', bounty: 1.25, enemyDmg: 1.1 },
  fog: { name: 'Dense Fog', desc: 'Heavy fog. Close-quarters fighting.', fog: 0.35 },
};

// ---------------------------------------------------------------------------
// Bosses
// ---------------------------------------------------------------------------
export const BOSSES = {
  irongiant: { id: 'irongiant', name: 'IRON GIANT', title: 'Siege Colossus', level: 4, arena: 'foundry', hp: 9000, shield: 0,
    reward: { credits: 4000, rp: 30, xp: 900 },
    desc: 'A walking fortress. Its frontal Bastion Shield blocks almost everything — hit the glowing reactor on its back. Jump over its shockwaves.',
    intro: 'Its frontal barrier is nearly impenetrable. Flank it. Jump its shockwaves.' },
  phantomzero: { id: 'phantomzero', name: 'PHANTOM ZERO', title: 'Experimental Hunter', level: 8, arena: 'mirage', hp: 6200, shield: 800,
    reward: { credits: 5500, rp: 45, xp: 1200 }, requires: 'irongiant',
    desc: 'Cloaks, dashes and deploys holographic decoys. It is vulnerable for a moment after each lunge. Lock-on (T) reveals the real one.',
    intro: 'It strikes from stealth. Dodge the lunge, then punish the recovery.' },
  overlord: { id: 'overlord', name: 'OVERLORD', title: 'Command Fortress', level: 12, arena: 'citadel', hp: 11000, shield: 0,
    reward: { credits: 7000, rp: 60, xp: 1500 }, requires: 'phantomzero',
    desc: 'Invulnerable while its relay pylons stand. Destroy the pylons to drop its Command Aegis, then strike before they rebuild. Commands escort squads.',
    intro: 'Relay pylons power its shield. Destroy them, then strike fast.' },
  omega: { id: 'omega', name: 'OMEGA PRIME', title: 'Final Prototype', level: 16, arena: 'singularity', hp: 14000, shield: 1500,
    reward: { credits: 10000, rp: 100, xp: 2500 }, requires: 'overlord',
    desc: 'Three phases: beam artillery, a core-shielded fortress, and a berserk adaptive hunter that reads your range.',
    intro: 'It adapts. Phase by phase, change your approach.' },
};
export const BOSS_ORDER = ['irongiant', 'phantomzero', 'overlord', 'omega'];

// ---------------------------------------------------------------------------
// Challenge missions
// ---------------------------------------------------------------------------
export const CHALLENGES = [
  { id: 'barebones', name: 'Bare Bones', arena: 'industrial', level: 3, diff: 'normal',
    desc: 'Defeat 4 scouts with only your primary weapon. No equipment, no ability.',
    enemies: ['scout', 'scout', 'scout', 'scout'], maxAlive: 2, mods: { noSecondary: true, noEquip: true, noAbility: true }, reward: { credits: 2000, rp: 15, xp: 500 } },
  { id: 'glass', name: 'Glass Cannon', arena: 'desert', level: 3, diff: 'normal',
    desc: 'Your armor is reduced to 40% but you deal +30% damage. Destroy 5 assault mechs.',
    enemies: ['assault', 'assault', 'assault', 'assault', 'assault'], maxAlive: 2, mods: { armorMul: 0.4, dmgMul: 1.3 }, reward: { credits: 2200, rp: 15, xp: 550 } },
  { id: 'eliteduel', name: 'Elite Duel', arena: 'neon', level: 5, diff: 'hard',
    desc: 'One-on-one against an Elite pilot that adapts to your tactics.',
    enemies: ['elite'], maxAlive: 1, mods: {}, reward: { credits: 3000, rp: 25, xp: 700 } },
  { id: 'blitz', name: 'Blitz', arena: 'industrial', level: 4, diff: 'normal',
    desc: 'Destroy 6 enemies within 120 seconds.',
    enemies: ['assault', 'scout', 'assault', 'flanker', 'scout', 'assault'], maxAlive: 3, mods: { timeLimit: 120 }, reward: { credits: 2500, rp: 20, xp: 600 } },
  { id: 'laststand', name: 'Last Stand', arena: 'frozen', level: 5, diff: 'normal',
    desc: 'Survive for 150 seconds against endless reinforcements.',
    enemies: 'endless', maxAlive: 4, mods: { surviveTime: 150 }, reward: { credits: 3000, rp: 25, xp: 700 } },
  { id: 'sniperalley', name: 'Sniper Alley', arena: 'desert', level: 6, diff: 'hard',
    desc: 'Four snipers hold the dunes. You are equipped with a Rail Lance and Scatter Blaster.',
    enemies: ['sniper', 'sniper', 'sniper', 'sniper'], maxAlive: 4, mods: { forceWeapons: ['rail', 'scatter'] }, reward: { credits: 3200, rp: 25, xp: 750 } },
  { id: 'tankbuster', name: 'Tank Buster', arena: 'volcanic', level: 9, diff: 'normal',
    desc: 'Destroy 3 heavy tanks and their support within 180 seconds.',
    enemies: ['tank', 'support', 'tank', 'heavy'], maxAlive: 4, mods: { timeLimit: 180 }, reward: { credits: 3800, rp: 30, xp: 850 } },
  { id: 'ironwill', name: 'Iron Will', arena: 'neon', level: 7, diff: 'normal',
    desc: 'Shields offline. Defeat 8 enemies, two at a time.',
    enemies: ['assault', 'flanker', 'scout', 'assault', 'sniper', 'flanker', 'assault', 'tank'], maxAlive: 2, mods: { noShield: true }, reward: { credits: 3500, rp: 30, xp: 800 } },
  { id: 'zerog', name: 'Zero-G Brawl', arena: 'orbital', level: 12, diff: 'hard',
    desc: 'Ultra-low gravity. Defeat two Specters and two Elites.',
    enemies: ['wraith', 'elite', 'wraith', 'elite'], maxAlive: 2, mods: { gravity: 0.35 }, reward: { credits: 5000, rp: 45, xp: 1100 } },
  { id: 'firewalk', name: 'Fire Walk', arena: 'volcanic', level: 10, diff: 'hard',
    desc: 'Energy regenerates at half rate. Defeat 6 flankers and scouts.',
    enemies: ['flanker', 'scout', 'flanker', 'scout', 'flanker', 'wraith'], maxAlive: 3, mods: { energyRegen: 0.5 }, reward: { credits: 4200, rp: 35, xp: 950 } },
  { id: 'whiteout', name: 'Whiteout', arena: 'frozen', level: 8, diff: 'hard',
    desc: 'A blizzard cuts visibility to almost nothing. Flankers hunt you in the fog.',
    enemies: ['flanker', 'flanker', 'scout', 'flanker', 'assault'], maxAlive: 3, mods: { fog: 0.25 }, reward: { credits: 3800, rp: 30, xp: 850 } },
  { id: 'bladework', name: 'Bladework', arena: 'neon', level: 4, diff: 'normal',
    desc: 'You are issued a Plasma Blade and Thermal Claws. Cut down 5 enemies, two Brawlers among them.',
    enemies: ['scout', 'brawler', 'assault', 'brawler', 'flanker'], maxAlive: 2, mods: { forceWeapons: ['blade', 'claws'] }, reward: { credits: 2600, rp: 20, xp: 650 } },
  { id: 'gauntlet', name: 'The Gauntlet', arena: 'orbital', level: 15, diff: 'expert',
    desc: 'Three Elites with Support cover. The ultimate test.',
    enemies: ['elite', 'support', 'elite', 'support', 'elite'], maxAlive: 3, mods: {}, reward: { credits: 8000, rp: 80, xp: 1800 } },
];

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------
export const ACHIEVEMENTS = {
  first_blood: { name: 'First Blood', desc: 'Destroy your first enemy mech.', reward: 300 },
  first_win: { name: 'First Victory', desc: 'Win your first match.', reward: 500 },
  centurion: { name: 'Centurion', desc: 'Destroy 100 enemy mechs.', reward: 3000 },
  annihilator: { name: 'Annihilator', desc: 'Destroy 500 enemy mechs.', reward: 10000 },
  boss_hunter: { name: 'Boss Hunter', desc: 'Defeat a boss.', reward: 1500 },
  boss_slayer: { name: 'Titan Slayer', desc: 'Defeat all four bosses.', reward: 8000 },
  arena_champion: { name: 'Arena Champion', desc: 'Win a match in all six arenas.', reward: 5000 },
  survivor10: { name: 'Survivor', desc: 'Reach wave 10 in Arena Survival.', reward: 1500 },
  survivor20: { name: 'Unbreakable', desc: 'Reach wave 20 in Arena Survival.', reward: 5000 },
  dominator: { name: 'Dominator', desc: 'Win a Domination match.', reward: 1000 },
  elite_pilot: { name: 'Elite Pilot', desc: 'Reach pilot level 15.', reward: 4000 },
  ace: { name: 'Ace of Aces', desc: 'Reach pilot level 30.', reward: 10000 },
  master_engineer: { name: 'Master Engineer', desc: 'Fully upgrade any branch of the upgrade tree.', reward: 3000 },
  ultimate_mech: { name: 'Ultimate Mech', desc: 'Unlock the Apex.', reward: 5000 },
  collector: { name: 'Hangar Full', desc: 'Own all 8 mechs.', reward: 8000 },
  arsenal: { name: 'Arsenal', desc: 'Own every weapon.', reward: 5000 },
  untouchable: { name: 'Untouchable', desc: 'Win a match after losing less than 15% armor.', reward: 1500 },
  expert_win: { name: 'Tactical Genius', desc: 'Win any match on Expert difficulty.', reward: 3000 },
  sharpshooter: { name: 'Sharpshooter', desc: 'Land 100 critical hits.', reward: 2000 },
  challenger: { name: 'Challenger', desc: 'Complete 5 challenge missions.', reward: 2500 },
  challenge_master: { name: 'Challenge Master', desc: 'Complete every challenge mission.', reward: 8000 },
  daily_op: { name: 'On Duty', desc: 'Complete a Daily Operation.', reward: 1000 },
  duelist: { name: 'Duelist', desc: 'Destroy 25 enemy mechs with melee weapons.', reward: 2500 },
  demolisher: { name: 'Demolisher', desc: 'Deal 250,000 total damage.', reward: 4000 },
};

// Pilot level unlock notes (shown on level-up)
export function levelUnlocks(level) {
  const out = [];
  for (const id of ARENA_ORDER) if (ARENAS[id].level === level) out.push(`Arena: ${ARENAS[id].name}`);
  for (const id of MODE_ORDER) if (MODES[id].level === level) out.push(`Mode: ${MODES[id].name}`);
  for (const id of FRAME_ORDER) if (FRAMES[id].level === level && level > 1) out.push(`Mech available: ${FRAMES[id].name}`);
  for (const id of WEAPON_ORDER) if (WEAPONS[id].level === level && level > 1) out.push(`Weapon: ${WEAPONS[id].name}`);
  for (const id of EQUIP_ORDER) if (EQUIPMENT[id].level === level && level > 1) out.push(`Equipment: ${EQUIPMENT[id].name}`);
  for (const id of ARMOR_ORDER) if (ARMORS[id].level === level && level > 1) out.push(`Armor: ${ARMORS[id].name}`);
  for (const id of MOBILITY_ORDER) if (MOBILITY[id].level === level && level > 1) out.push(`Mobility: ${MOBILITY[id].name}`);
  for (const c of CHALLENGES) if (c.level === level) out.push(`Challenge: ${c.name}`);
  for (const id of BOSS_ORDER) if (BOSSES[id].level === level) out.push(`Boss: ${BOSSES[id].name}`);
  UPGRADE_TIERS.forEach((t, i) => { if (t.level === level && level > 1) out.push(`Upgrade tier ${i + 1}`); });
  return out;
}

export const MAX_LEVEL = 40;
export function xpForLevel(level) { return 300 + (level - 1) * 140; }

export const CONTRACT_POOL = [
  { id: 'kills', text: 'Destroy {n} enemy mechs', n: [8, 12, 16], reward: 900, stat: 'kills' },
  { id: 'scouts', text: 'Destroy {n} Scouts or Flankers', n: [4, 6], reward: 800, stat: 'killLight' },
  { id: 'tanks', text: 'Destroy {n} Tanks or Juggernauts', n: [2, 3], reward: 900, stat: 'killHeavy' },
  { id: 'energy', text: 'Deal {n} energy damage', n: [4000, 6000], reward: 800, stat: 'dmg_energy' },
  { id: 'explosive', text: 'Deal {n} explosive damage', n: [3000, 5000], reward: 800, stat: 'dmg_explosive' },
  { id: 'impact', text: 'Deal {n} impact damage', n: [3000, 5000], reward: 800, stat: 'dmg_impact' },
  { id: 'precision', text: 'Deal {n} precision damage', n: [2500, 4000], reward: 850, stat: 'dmg_precision' },
  { id: 'wins', text: 'Win {n} matches', n: [2, 3], reward: 1000, stat: 'wins' },
  { id: 'wave', text: 'Clear {n} survival waves', n: [6, 10], reward: 900, stat: 'waves' },
  { id: 'abilities', text: 'Use your mech ability {n} times', n: [6, 10], reward: 600, stat: 'abilities' },
  { id: 'melee', text: 'Land {n} melee hits', n: [15, 25], reward: 750, stat: 'meleeHits' },
  { id: 'crits', text: 'Land {n} critical hits', n: [10, 20], reward: 700, stat: 'crits' },
  { id: 'captures', text: 'Capture {n} control points', n: [3, 5], reward: 900, stat: 'captures' },
];
