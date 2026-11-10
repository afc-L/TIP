// Global tuning constants.

export const GAME_NAME = 'DROPZONE 100';
export const MAP_HALF = 900;            // island playfield is [-900, 900] metres
export const WATER_Y = 0;
export const GRAVITY = 24;

// Building grid
export const BW = 4;                    // build tile width (m)
export const BH = 3.5;                  // build tile height (m)
export const BUILD_COST = 10;
export const MAX_MATS = 999;

// Character
export const CHAR_R = 0.4;
export const CHAR_H = 1.8;
export const CROUCH_H = 1.2;
export const STEP_H = 0.55;

export const MOVE = {
  walk: 4.6,
  sprint: 6.6,
  crouch: 2.6,
  ads: 3.2,
  swim: 3.4,
  jump: 7.8,
  slideBoost: 9.5,
  airControl: 0.35,
  skydiveH: 30,
  skydiveV: 26,
  diveV: 52,
  glideH: 17,
  glideV: 7,
  glideAuto: 48,        // auto-deploy glider at this height above ground
};

export const RARITY = [
  { name: 'Common', color: '#b9bcc2', hex: 0xb9bcc2 },
  { name: 'Uncommon', color: '#5ccf3c', hex: 0x5ccf3c },
  { name: 'Rare', color: '#3aa0ff', hex: 0x3aa0ff },
  { name: 'Epic', color: '#b765ff', hex: 0xb765ff },
  { name: 'Legendary', color: '#ffa733', hex: 0xffa733 },
  { name: 'Mythic', color: '#ffe14a', hex: 0xffe14a },
];
export const R_DMG = [1, 1.05, 1.1, 1.16, 1.22, 1.32];
export const R_RELOAD = [1, 0.95, 0.9, 0.85, 0.8, 0.72];
export const R_SPREAD = [1, 0.95, 0.9, 0.85, 0.8, 0.7];

export const MAT_NAMES = ['wood', 'stone', 'metal'];
export const MAT_HP = { wood: 150, stone: 300, metal: 500 };
export const MAT_BUILD_TIME = { wood: 2.2, stone: 4, metal: 6 };

export const DIFFICULTY = {
  easy:   { label: 'Easy',   aim: 0.38, react: 1.7, build: 0.35, aggr: 0.75, aware: 0.75, decision: 0.6 },
  normal: { label: 'Normal', aim: 0.75, react: 1.0, build: 0.7,  aggr: 1.0,  aware: 1.0,  decision: 0.85 },
  hard:   { label: 'Hard',   aim: 0.95, react: 0.75, build: 0.95, aggr: 1.1, aware: 1.15, decision: 1.0 },
  elite:  { label: 'Elite',  aim: 1.15, react: 0.55, build: 1.25, aggr: 1.2, aware: 1.3,  decision: 1.15 },
};

// AI behaviour archetypes. These are personalities, not teams — every AI is hostile to every other player.
export const PROFILES = {
  aggressive: {
    label: 'Aggressive', aggression: 0.95, caution: 0.25, aim: 0.85, react: 1.0, build: 0.6, edit: 0.4,
    awareness: 0.85, greed: 0.5, thirdParty: 0.7, range: 'close', hotDrop: 0.85, harvest: 0.3, patience: 0.2, retreatAt: 0.15,
  },
  balanced: {
    label: 'Balanced', aggression: 0.55, caution: 0.55, aim: 0.8, react: 1.0, build: 0.6, edit: 0.35,
    awareness: 0.9, greed: 0.7, thirdParty: 0.4, range: 'mid', hotDrop: 0.45, harvest: 0.6, patience: 0.5, retreatAt: 0.35,
  },
  strategic: {
    label: 'Strategic', aggression: 0.45, caution: 0.65, aim: 0.9, react: 0.9, build: 0.7, edit: 0.5,
    awareness: 1.05, greed: 0.65, thirdParty: 0.9, range: 'long', hotDrop: 0.3, harvest: 0.7, patience: 0.8, retreatAt: 0.4,
  },
  defensive: {
    label: 'Defensive', aggression: 0.3, caution: 0.85, aim: 0.75, react: 1.1, build: 0.85, edit: 0.4,
    awareness: 0.95, greed: 0.6, thirdParty: 0.25, range: 'long', hotDrop: 0.15, harvest: 0.8, patience: 0.9, retreatAt: 0.5,
  },
  skilled: {
    label: 'Highly Skilled', aggression: 0.75, caution: 0.5, aim: 1.0, react: 0.7, build: 1.0, edit: 1.0,
    awareness: 1.2, greed: 0.6, thirdParty: 0.7, range: 'adaptive', hotDrop: 0.6, harvest: 0.7, patience: 0.6, retreatAt: 0.3,
  },
};
export const PROFILE_MIX = [
  ['aggressive', 0.24], ['balanced', 0.3], ['strategic', 0.16], ['defensive', 0.16], ['skilled', 0.14],
];

// Storm phases: wait (s), shrink (s), radius at the end, damage per tick (1 tick/s)
export const STORM_PHASES = [
  { wait: 65, shrink: 55, radius: 560, dmg: 1 },
  { wait: 45, shrink: 45, radius: 330, dmg: 1 },
  { wait: 40, shrink: 40, radius: 180, dmg: 2 },
  { wait: 35, shrink: 35, radius: 95, dmg: 5 },
  { wait: 30, shrink: 30, radius: 45, dmg: 8 },
  { wait: 20, shrink: 25, radius: 18, dmg: 10 },
  { wait: 10, shrink: 40, radius: 0, dmg: 10, moving: true },
];

export const AI_NAMES = [
  'Pixel', 'Nova', 'Rook', 'Jinx', 'Blaze', 'Echo', 'Vortex', 'Mango', 'Sly', 'Comet', 'Drift', 'Ziggy', 'Turbo', 'Frost',
  'Kiwi', 'Bolt', 'Raven', 'Sprocket', 'Lumen', 'Gizmo', 'Onyx', 'Taco', 'Wisp', 'Flux', 'Pebble', 'Hex', 'Rogue', 'Sable',
  'Nimbus', 'Pickle', 'Quartz', 'Rumble', 'Sizzle', 'Tango', 'Umbra', 'Vex', 'Waffle', 'Yeti', 'Zephyr', 'Ace', 'Bramble',
  'Cosmo', 'Dash', 'Ember', 'Fable', 'Gust', 'Halo', 'Ink', 'Jolt', 'Krill', 'Loop', 'Moxie', 'Nacho', 'Orbit', 'Patch',
  'Quill', 'Riff', 'Spud', 'Tinsel', 'Unit', 'Volt', 'Widget', 'Xeno', 'Yo-Yo', 'Zest', 'Axel', 'Biscuit', 'Cinder', 'Dot',
  'Fizz', 'Glitch', 'Hopper', 'Iggy', 'Juniper', 'Kodiak', 'Lynx', 'Meteor', 'Noodle', 'Otter', 'Pogo', 'Rascal', 'Scout',
  'Thorn', 'Vapor', 'Wombat', 'Zinc', 'Atlas', 'Bandit', 'Cricket', 'Dynamo', 'Falcon', 'Grizzly', 'Husk', 'Jett', 'Kestrel',
  'Lucky', 'Maverick', 'Nugget', 'Pyro', 'Sparky', 'Tundra', 'Viper', 'Whiskers',
];
