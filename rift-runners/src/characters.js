// Playable classes, starting loadouts and cosmetics. Costs are in Rift Shards.

export const CLASSES = {
  runner: {
    name: 'Rift Runner', icon: '🏃', cost: 0, weapon: 'bolt',
    desc: 'The original. Balanced in every way.',
    strengths: 'Balanced · Rift Pulse clears bullets',
    maxHp: 100, moveMult: 1, damageMult: 1,
    ability: { id: 'pulse', name: 'Rift Pulse', icon: '🌀', cd: 10, desc: 'Knock nearby enemies away and erase nearby enemy bullets.' },
    colors: { cloak: '#2f5aa8', trim: '#3be6ff' },
  },
  spellblade: {
    name: 'Spellblade', icon: '⚔️', cost: 150, weapon: 'slash',
    desc: 'Balanced health and damage. Fights up close with a sweeping magic slash.',
    strengths: 'Melee slash · +10% damage · Phase Strike',
    maxHp: 110, moveMult: 1.02, damageMult: 1.1,
    ability: { id: 'phase', name: 'Phase Strike', icon: '✴️', cd: 7, desc: 'Blink forward toward the cursor, slashing every enemy along the path.' },
    colors: { cloak: '#8a2a4a', trim: '#ff7ab0' },
  },
  stormcaller: {
    name: 'Stormcaller', icon: '🌩️', cost: 200, weapon: 'zap',
    desc: 'Fragile, but ranged attacks hit harder and lightning chains further.',
    strengths: 'Low health · +20% projectile damage · lightning +1 jump',
    maxHp: 80, moveMult: 1.03, damageMult: 1, projMult: 1.2, chainBonus: 1,
    ability: { id: 'storm', name: 'Thunderstorm', icon: '⛈️', cd: 11, desc: 'Call down 7 lightning strikes on the nearest enemies.' },
    colors: { cloak: '#1f4a6a', trim: '#9fe6ff' },
  },
  warden: {
    name: 'Warden', icon: '🛡️', cost: 250, weapon: 'arc',
    desc: 'High health and defensive tools, but slower on their feet.',
    strengths: 'High health · -12% damage taken · slower',
    maxHp: 150, moveMult: 0.9, damageMult: 1, dmgReduction: 0.12,
    ability: { id: 'bulwark', name: 'Bulwark', icon: '🛡️', cd: 14, desc: 'Become immune to damage for 2.5 seconds and knock enemies back.' },
    colors: { cloak: '#5a4a2a', trim: '#ffd36b' },
  },
};

// Starting weapons. bolt is always available; the rest unlock in the Sanctum.
export const START_WEAPONS = { bolt: 0, slash: 0, zap: 0, arc: 0, orb: 120, blades: 140, meteor: 160 };

export const LOADOUTS = {
  standard:  { name: 'Standard', icon: '🎒', cost: 0, desc: 'No modifiers.' },
  scavenger: { name: 'Scavenger', icon: '🪙', cost: 80, desc: 'Start with 40 gold. Gold drops +20%.' },
  scholar:   { name: 'Scholar', icon: '📘', cost: 100, desc: 'Start at level 3, but take 5% more damage.' },
  seeker:    { name: 'Relic Seeker', icon: '🔮', cost: 130, desc: 'Start with a random relic, but -10% max health.' },
  duelist:   { name: 'Duelist', icon: '🤺', cost: 120, desc: 'Weapon slots reduced to 2, but +25% damage.' },
};

export const COSMETICS = {
  cloaks: {
    default: { name: 'Class Default', color: null, cost: 0 },
    ember:   { name: 'Ember', color: '#c2410c', cost: 40 },
    verdant: { name: 'Verdant', color: '#2f8a4a', cost: 40 },
    royal:   { name: 'Royal', color: '#6d28d9', cost: 60 },
    ivory:   { name: 'Ivory', color: '#d8d0c0', cost: 60 },
    shadow:  { name: 'Shadow', color: '#1a1a24', cost: 0, objective: true },
  },
  trails: {
    default: { name: 'Rift Cyan', color: '#3be6ff', cost: 0 },
    flame:   { name: 'Flame', color: '#ff7a1a', cost: 50 },
    toxic:   { name: 'Toxic', color: '#9dff3a', cost: 50 },
    gold:    { name: 'Gilded', color: '#ffd36b', cost: 80 },
    void:    { name: 'Void', color: '#b06bff', cost: 0, objective: true },
  },
};

export const ARENAS = {
  temple:  { name: 'Forgotten Temple', icon: '🏛️', cost: 0, desc: 'Ancient stone ruins and glowing runes. Favors Brutes and Mirror Knights.',
             bias: { brute: 1.3, knight: 1.4 } },
  garden:  { name: 'Void Garden', icon: '🌿', cost: 100, desc: 'Floating islands and luminous plants. Favors Splitters, Spitters and Leeches.',
             bias: { splitter: 1.5, spitter: 1.3, leech: 1.3 } },
  citadel: { name: 'Shattered Citadel', icon: '🏰', cost: 150, desc: 'Dark fractured architecture and unstable rifts. Favors Stalkers, Bombardiers and Priests.',
             bias: { stalker: 1.5, bombardier: 1.4, priest: 1.3 } },
};
