import { PLAYER_BASE, RARITY, WEAPONS, MAX_WEAPONS } from './config.js';
import { CLASSES, LOADOUTS } from './characters.js';
import { EVOLUTIONS } from './relics.js';

const hasProjectiles = (l) => l.bolt > 0 || l.orb > 0;

// Weapon cards: one per weapon, levels 1-5. Level 1 = unlock.
const WEAPON_LEVEL_TEXT = {
  bolt: ['', '+20% damage, -6% cooldown.', '+20% damage. Bolts pierce +1 enemy.', '+20% damage, -6% cooldown.', '+20% damage. Bolts pierce +1 enemy.'],
  slash: ['', '+25% damage, +8% reach.', '+25% damage, +8% reach.', '+25% damage, -10% cooldown.', 'Slashes twice (a backswing follows).'],
  arc: ['', '+30% damage, +12% radius, -10% cooldown.', '+30% damage, +12% radius, -10% cooldown.', '+30% damage, +12% radius, -10% cooldown.', '+30% damage, +12% radius, -10% cooldown.'],
  orb: ['', 'Orbs pass through up to 4 enemies.', '+35% damage and a larger orb.', 'Fires 2 orbs that pierce endlessly.', '+30% damage.'],
  zap: ['', '+1 jump, +20% damage.', '+1 jump, +20% damage, -6% cooldown.', '+1 jump, +20% damage.', '+1 jump, +20% damage, -6% cooldown.'],
  blades: ['', '+1 blade, +15% damage.', '+1 blade, +15% damage.', '+1 blade, +15% damage.', '+1 blade, +15% damage.'],
  meteor: ['', '+25% damage, +8% radius.', '+25% damage, +8% radius.', 'Calls 2 meteors at once.', '+25% damage, +8% radius.'],
};

const WEAPON_UPGRADES = Object.entries(WEAPONS).map(([id, w]) => ({
  id, name: w.name, icon: w.icon, rarity: 'rare', max: 5, weapon: true,
  desc: (l) => (l === 1 ? `NEW WEAPON: ${w.desc}` : `${w.name}: ${WEAPON_LEVEL_TEXT[id][l - 1]}`),
  apply: (s, l) => { s.weapons[id] = l; },
}));

// Every upgrade recomputes stats from scratch via apply(stats, level), so levels never
// compound unexpectedly and restarting is just "levels = {}".
export const UPGRADES = [
  { id: 'damage', name: 'Sharpened Rift', icon: '⚔️', rarity: 'common', max: 5,
    desc: () => '+10% damage for all weapons and abilities.',
    apply: (s, l) => { s.damageMult += 0.1 * l; } },
  { id: 'firerate', name: 'Quickened Hands', icon: '⏩', rarity: 'common', max: 5,
    desc: () => '+9% attack speed for all weapons.',
    apply: (s, l) => { s.fireRateMult += 0.09 * l; } },
  { id: 'speed', name: 'Fleet Feet', icon: '👟', rarity: 'common', max: 4,
    desc: () => '+7% movement speed.',
    apply: (s, l) => { s.moveMult += 0.07 * l; } },
  { id: 'vitality', name: 'Vital Core', icon: '❤️', rarity: 'common', max: 5,
    desc: () => '+20 max health and heal 20 health now.',
    apply: (s, l) => { s.maxHp += 20 * l; } },
  { id: 'dash', name: 'Swift Step', icon: '💨', rarity: 'common', max: 3,
    desc: () => '-15% dash cooldown.',
    apply: (s, l) => { s.dashCdMult *= Math.pow(0.85, l); } },
  { id: 'crit', name: 'Keen Eye', icon: '🎯', rarity: 'common', max: 4,
    desc: () => '+6% critical hit chance.',
    apply: (s, l) => { s.critChance += 0.06 * l; } },
  { id: 'velocity', name: 'Velocity Runes', icon: '➶', rarity: 'common', max: 3, req: hasProjectiles,
    desc: () => '+18% projectile speed (and range).',
    apply: (s, l) => { s.projSpeedMult += 0.18 * l; } },
  { id: 'magnet', name: 'Magnet Field', icon: '🧲', rarity: 'common', max: 3,
    desc: () => '+35% crystal pickup radius.',
    apply: (s, l) => { s.pickupMult += 0.35 * l; } },
  { id: 'regen', name: 'Regeneration', icon: '✚', rarity: 'common', max: 3,
    desc: () => 'Regenerate +0.4 health per second.',
    apply: (s, l) => { s.regen += 0.4 * l; } },
  { id: 'armor', name: 'Rift Plating', icon: '🪨', rarity: 'common', max: 3,
    desc: () => 'Take 6% less damage from all sources.',
    apply: (s, l) => { s.dmgTaken *= Math.pow(0.94, l); } },

  { id: 'multishot', name: 'Split Shot', icon: '⋔', rarity: 'rare', max: 3, req: (l) => l.bolt > 0,
    desc: () => 'Rift Bolt fires +1 additional projectile in a spread.',
    apply: (s, l) => { s.extraProj += l; } },
  { id: 'pierce', name: 'Piercing Rounds', icon: '➹', rarity: 'rare', max: 3, req: (l) => l.bolt > 0,
    desc: () => 'Rift Bolts pierce through +1 more enemy.',
    apply: (s, l) => { s.pierce += l; } },
  { id: 'burn', name: 'Ignite', icon: '🔥', rarity: 'rare', max: 3,
    desc: (l) => `Hits set enemies ablaze for ${[4, 7, 10][l - 1]} damage/sec over 3 seconds.`,
    apply: (s, l) => { s.burn = l; } },
  { id: 'poison', name: 'Venom', icon: '☠️', rarity: 'rare', max: 3,
    desc: (l) => `Hits add a poison stack (max 5). Each stack deals ${[1.5, 2.5, 3.5][l - 1]} damage/sec for 4 seconds.`,
    apply: (s, l) => { s.poison = l; } },
  { id: 'shield', name: 'Rift Shield', icon: '🛡️', rarity: 'rare', max: 3,
    desc: (l) => `A barrier absorbs up to ${20 * l} damage. Recharges after 4 seconds without being hit.`,
    apply: (s, l) => { s.shield = 20 * l; } },
  { id: 'critdmg', name: 'Critical Mass', icon: '💥', rarity: 'rare', max: 3,
    desc: () => '+40% critical hit damage.',
    apply: (s, l) => { s.critMult += 0.4 * l; } },

  { id: 'explode', name: 'Volatile Rounds', icon: '💣', rarity: 'legendary', max: 3,
    desc: (l) => `Projectile and slash hits explode in a ${[1.8, 2.3, 2.8][l - 1]}m radius for ${[30, 45, 60][l - 1]}% of their damage.`,
    apply: (s, l) => { s.explode = l; } },
  { id: 'chain', name: 'Static Charge', icon: '⚡', rarity: 'legendary', max: 3,
    desc: (l) => `Hits have a ${[20, 30, 40][l - 1]}% chance to arc lightning across ${2 + l} enemies for 60% damage.`,
    apply: (s, l) => { s.chain = l; } },
  { id: 'overcharge', name: 'Rift Overcharge', icon: '🌀', rarity: 'legendary', max: 2,
    desc: () => '+18% damage, +12% attack speed and +5% move speed.',
    apply: (s, l) => { s.damageMult += 0.18 * l; s.fireRateMult += 0.12 * l; s.moveMult += 0.05 * l; } },
  { id: 'phoenix', name: 'Phoenix Heart', icon: '🪶', rarity: 'legendary', max: 1,
    desc: () => 'Once per run, survive a killing blow and revive with 50% health.',
    apply: (s, l) => { s.revive += l; } },
  ...WEAPON_UPGRADES,
];

export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
export const WEAPON_IDS = Object.keys(WEAPONS);

// Synergies combine upgrades (l = levels) and relics (r = Set of relic ids).
export const SYNERGIES = [
  { id: 'wildfire', name: 'Wildfire', icon: '🔥➹', parts: 'Ignite + Piercing Rounds',
    desc: 'Burning projectiles spread flames to every enemy near each hit. Burn +50%.',
    req: (l) => l.burn >= 1 && l.pierce >= 1 },
  { id: 'storm', name: 'Storm Conduit', icon: '⚡⏩', parts: 'Static Charge + Quickened Hands II',
    desc: 'Lightning chains to 2 extra enemies and triggers 15% more often.',
    req: (l) => l.chain >= 1 && l.firerate >= 2 },
  { id: 'riftslash', name: 'Rift Slash', icon: '💨⚔️', parts: 'Swift Step + Sharpened Rift II',
    desc: 'Your dash tears through enemies, dealing heavy damage along its path.',
    req: (l) => l.dash >= 1 && l.damage >= 2 },
  { id: 'overload', name: 'Overload', icon: '🎯⋔', parts: 'Keen Eye II + Split Shot',
    desc: 'With multiple projectiles, critical hits deal +75% extra damage.',
    req: (l) => l.crit >= 2 && l.multishot >= 1 },
  { id: 'toxicblaze', name: 'Toxic Blaze', icon: '☠️🔥', parts: 'Venom + Ignite',
    desc: 'Enemies that are both burning and poisoned take double damage over time.',
    req: (l) => l.burn >= 1 && l.poison >= 1 },
  { id: 'singularity', name: 'Singularity', icon: '◉💣', parts: 'Void Orb II + Volatile Rounds',
    desc: 'Void Orbs detonate in a massive blast when they expire.',
    req: (l) => l.orb >= 2 && l.explode >= 1 },
  // Relic synergies
  { id: 'superconductor', name: 'Superconductor', icon: '🌩️⚡', parts: 'Storm Core + Static Charge', relic: true,
    desc: 'Static Charge triggers 15% more often and its arcs deal +30% damage.',
    req: (l, r) => r.has('stormcore') && l.chain >= 1 },
  { id: 'crimson', name: 'Crimson Engine', icon: '🩸🛡️', parts: 'Blood Battery + Last Stand', relic: true,
    desc: 'Last Stand activates below 50% health, and its kills heal double.',
    req: (l, r) => r.has('blood') && r.has('laststand') },
  { id: 'collapse', name: 'Collapse', icon: '🌀💣', parts: 'Gravity Well + Volatile Rounds', relic: true,
    desc: 'Gravity Well ends in a heavy explosion at the pull point.',
    req: (l, r) => r.has('gravity') && l.explode >= 1 },
  { id: 'spiked', name: 'Spiked Barrier', icon: '🌵🛡️', parts: 'Thorn Armor + Rift Shield', relic: true,
    desc: 'While your shield holds, Thorn Armor reflects 150% of contact damage.',
    req: (l, r) => r.has('thorn') && l.shield >= 1 },
  { id: 'fortune', name: "Fortune's Edge", icon: '🍀🎯', parts: 'Lucky Coin + Keen Eye II', relic: true,
    desc: '+8% critical hit chance and +25% critical damage.',
    req: (l, r) => r.has('lucky') && l.crit >= 2 },
];

export function computeStats(meta, levels, synergies, relics = new Set(), opts = {}) {
  const cls = CLASSES[opts.cls || 'runner'];
  const s = {
    maxHp: cls.maxHp + 8 * (meta.vitality || 0),
    damageMult: cls.damageMult * (1 + 0.04 * (meta.might || 0)),
    projMult: cls.projMult || 1,
    chainBonus: cls.chainBonus || 0,
    fireRateMult: 1,
    moveMult: cls.moveMult * (1 + 0.03 * (meta.swift || 0)),
    dashCdMult: 1,
    critChance: PLAYER_BASE.critChance,
    critMult: PLAYER_BASE.critMult,
    projSpeedMult: 1,
    extraProj: 0,
    pierce: 0,
    explode: 0, chain: 0, burn: 0, poison: 0,
    pickupMult: 1 + 0.12 * (meta.magnet || 0),
    shield: 0,
    regen: 0,
    xpMult: 1 + 0.06 * (meta.wisdom || 0),
    goldMult: 1,
    dmgTaken: 1 - (cls.dmgReduction || 0),
    revive: 0,
    weapons: {},
    evolved: {},
    maxWeapons: MAX_WEAPONS,
    syn: {},
    relic: {},
  };
  for (const u of UPGRADES) {
    const l = levels[u.id] || 0;
    if (l > 0) u.apply(s, l);
  }
  for (const id of relics) s.relic[id] = true;
  const R = s.relic;
  if (R.glass) { s.damageMult *= 1.35; s.maxHp = Math.round(s.maxHp * 0.75); }
  if (R.lucky) s.goldMult *= 1.25;
  if (R.thorn) s.contactTaken = 0.9;
  if (R.voidmagnet) s.pickupMult += 0.9;
  if (R.chrono) s.dashCdMult *= 0.7;
  if (R.ember) s.burn = Math.max(1, s.burn);
  if (R.bulwark) { s.dmgTaken *= 0.85; s.moveMult *= 0.92; }
  if (R.phoenix) s.revive += 1;
  const lo = LOADOUTS[opts.loadout || 'standard'];
  if (opts.loadout === 'scavenger') s.goldMult *= 1.2;
  if (opts.loadout === 'scholar') s.dmgTaken *= 1.05;
  if (opts.loadout === 'seeker') s.maxHp = Math.round(s.maxHp * 0.9);
  if (opts.loadout === 'duelist') { s.maxWeapons = 2; s.damageMult *= 1.25; }
  void lo;
  // Shrine effects for this run
  const sh = opts.shrine || {};
  if (sh.maxHpMult) s.maxHp = Math.round(s.maxHp * sh.maxHpMult);
  if (sh.damage) s.damageMult *= 1 + sh.damage;
  if (sh.speed) s.moveMult *= 1 + sh.speed;
  if (sh.maxHpFlat) s.maxHp += sh.maxHpFlat;

  for (const id of synergies) s.syn[id] = true;
  if (s.syn.fortune) { s.critChance += 0.08; s.critMult += 0.25; }
  for (const ev of EVOLUTIONS) {
    if ((s.weapons[ev.weapon] || 0) >= ev.level && R[ev.relic]) s.evolved[ev.weapon] = ev.id;
  }
  if (s.evolved.blades === 'bramble') s.dmgTaken *= 0.9;
  s.critChance = Math.min(0.6, s.critChance);
  return s;
}

// Pick `n` distinct upgrade offers, weighted by rarity. Legendary odds rise each wave.
export function rollUpgrades(levels, wave, n = 3, opts = {}) {
  const ownedWeapons = WEAPON_IDS.filter((w) => levels[w] > 0).length;
  const maxW = opts.maxWeapons ?? MAX_WEAPONS;
  const pool = UPGRADES.filter((u) => {
    const l = levels[u.id] || 0;
    if (l >= u.max) return false;
    if (u.req && !u.req(levels)) return false;
    if (u.weapon && l === 0 && ownedWeapons >= maxW) return false;
    return true;
  }).map((u) => {
    let w = RARITY[u.rarity].weight;
    if (u.rarity === 'legendary') w += wave * 0.6;
    if (opts.lucky && u.rarity !== 'common') w *= u.rarity === 'legendary' ? 2 : 1.4;
    if (u.weapon && !levels[u.id]) w *= 0.8;
    if (u.weapon && levels[u.id]) w *= 1.3; // nudge owned weapons toward evolution levels
    return { u, w };
  });
  const out = [];
  while (out.length < n && pool.length) {
    const total = pool.reduce((a, p) => a + p.w, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (; idx < pool.length - 1; idx++) { r -= pool[idx].w; if (r <= 0) break; }
    out.push(pool[idx].u);
    pool.splice(idx, 1);
  }
  const fillers = [
    { id: 'heal', name: 'Rift Mending', icon: '💖', rarity: 'common', desc: () => 'Restore 35% of your max health.', filler: true },
    { id: 'cache', name: 'Gold Cache', icon: '🪙', rarity: 'common', desc: () => 'Gain 30 gold to spend at Supply Rifts and shrines.', filler: true },
  ];
  while (out.length < n) out.push(fillers[out.length % 2]);
  return out;
}

export function newSynergies(levels, active, relics = new Set()) {
  return SYNERGIES.filter((s) => !active.has(s.id) && s.req(levels, relics));
}

// Evolution hint for an upgrade card (shown on weapon & relic cards).
export function evolutionHint(id) {
  const ev = EVOLUTIONS.find((e) => e.weapon === id || e.relic === id);
  return ev ? ev : null;
}
