import { PLAYER_BASE, RARITY } from './config.js';

const pct = (v) => `${Math.round(v * 100)}%`;

// Every upgrade recomputes stats from scratch via apply(stats, level), so levels never
// compound unexpectedly and restarting is just "levels = {}".
export const UPGRADES = [
  { id: 'damage', name: 'Sharpened Rift', icon: '⚔️', rarity: 'common', max: 5,
    desc: () => '+12% damage for all weapons and abilities.',
    apply: (s, l) => { s.damageMult += 0.12 * l; } },
  { id: 'firerate', name: 'Quickened Hands', icon: '⏩', rarity: 'common', max: 5,
    desc: () => '+10% attack speed for all weapons.',
    apply: (s, l) => { s.fireRateMult += 0.1 * l; } },
  { id: 'speed', name: 'Fleet Feet', icon: '👟', rarity: 'common', max: 4,
    desc: () => '+8% movement speed.',
    apply: (s, l) => { s.moveMult += 0.08 * l; } },
  { id: 'vitality', name: 'Vital Core', icon: '❤️', rarity: 'common', max: 5,
    desc: () => '+20 max health and heal 20 health now.',
    apply: (s, l) => { s.maxHp += 20 * l; } },
  { id: 'dash', name: 'Swift Step', icon: '💨', rarity: 'common', max: 3,
    desc: () => '-15% dash cooldown.',
    apply: (s, l) => { s.dashCdMult *= Math.pow(0.85, l); } },
  { id: 'crit', name: 'Keen Eye', icon: '🎯', rarity: 'common', max: 4,
    desc: () => '+6% critical hit chance.',
    apply: (s, l) => { s.critChance += 0.06 * l; } },
  { id: 'velocity', name: 'Velocity Runes', icon: '➶', rarity: 'common', max: 3,
    desc: () => '+18% projectile speed (and range).',
    apply: (s, l) => { s.projSpeedMult += 0.18 * l; } },
  { id: 'magnet', name: 'Magnet Field', icon: '🧲', rarity: 'common', max: 3,
    desc: () => '+35% crystal pickup radius.',
    apply: (s, l) => { s.pickupMult += 0.35 * l; } },
  { id: 'regen', name: 'Regeneration', icon: '✚', rarity: 'common', max: 3,
    desc: () => 'Regenerate +0.5 health per second.',
    apply: (s, l) => { s.regen += 0.5 * l; } },

  { id: 'multishot', name: 'Split Shot', icon: '⋔', rarity: 'rare', max: 3,
    desc: () => 'Rift Bolt fires +1 additional projectile in a spread.',
    apply: (s, l) => { s.extraProj += l; } },
  { id: 'pierce', name: 'Piercing Rounds', icon: '➹', rarity: 'rare', max: 3,
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
  { id: 'arc', name: 'Arc Burst', icon: 'ϟ', rarity: 'rare', max: 4, weapon: true,
    desc: (l) => l === 1
      ? 'NEW WEAPON: Unleash a crackling burst that damages and knocks back all nearby enemies.'
      : 'Arc Burst: +30% damage, +12% radius, -10% cooldown.',
    apply: (s, l) => { s.arc = l; } },
  { id: 'orb', name: 'Void Orb', icon: '◉', rarity: 'rare', max: 4, weapon: true,
    desc: (l) => [
      'NEW WEAPON: Launch a slow, heavy orb of void energy toward the cursor.',
      'Void Orb now passes through up to 4 enemies.',
      'Void Orb: +35% damage and a larger orb.',
      'Void Orb fires 2 orbs that pierce endlessly.',
    ][l - 1],
    apply: (s, l) => { s.orb = l; } },

  { id: 'explode', name: 'Volatile Rounds', icon: '💣', rarity: 'legendary', max: 3,
    desc: (l) => `Projectile hits explode in a ${[1.8, 2.3, 2.8][l - 1]}m radius for ${[35, 50, 65][l - 1]}% of their damage.`,
    apply: (s, l) => { s.explode = l; } },
  { id: 'chain', name: 'Chain Lightning', icon: '⚡', rarity: 'legendary', max: 3,
    desc: (l) => `Hits have a ${[20, 30, 40][l - 1]}% chance to arc lightning across ${2 + l} enemies for 60% damage.`,
    apply: (s, l) => { s.chain = l; } },
  { id: 'overcharge', name: 'Rift Overcharge', icon: '🌀', rarity: 'legendary', max: 2,
    desc: () => '+20% damage, +15% attack speed and +6% move speed.',
    apply: (s, l) => { s.damageMult += 0.2 * l; s.fireRateMult += 0.15 * l; s.moveMult += 0.06 * l; } },
  { id: 'phoenix', name: 'Phoenix Heart', icon: '🪶', rarity: 'legendary', max: 1,
    desc: () => 'Once per run, survive a killing blow and revive with 50% health.',
    apply: (s, l) => { s.revive = l; } },
];

export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

export const SYNERGIES = [
  { id: 'wildfire', name: 'Wildfire', icon: '🔥➹', parts: 'Ignite + Piercing Rounds',
    desc: 'Burning projectiles spread flames to every enemy near each hit. Burn +50%.',
    req: (l) => l.burn >= 1 && l.pierce >= 1 },
  { id: 'storm', name: 'Storm Conduit', icon: '⚡⏩', parts: 'Chain Lightning + Quickened Hands II',
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
];

export function computeStats(meta, levels, synergies) {
  const s = {
    maxHp: PLAYER_BASE.maxHp + 10 * (meta.vitality || 0),
    damageMult: 1 + 0.05 * (meta.might || 0),
    fireRateMult: 1,
    moveMult: 1 + 0.04 * (meta.swift || 0),
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
    xpMult: 1 + 0.08 * (meta.wisdom || 0),
    arc: 0, orb: 0,
    revive: 0,
    syn: {},
  };
  for (const u of UPGRADES) {
    const l = levels[u.id] || 0;
    if (l > 0) u.apply(s, l);
  }
  for (const id of synergies) s.syn[id] = true;
  s.critChance = Math.min(0.6, s.critChance);
  return s;
}

// Pick `n` distinct upgrade offers, weighted by rarity. Legendary odds rise each wave.
export function rollUpgrades(levels, wave, n = 3) {
  const pool = UPGRADES.filter((u) => (levels[u.id] || 0) < u.max).map((u) => {
    let w = RARITY[u.rarity].weight;
    if (u.rarity === 'legendary') w += wave * 0.8;
    if (u.weapon && !levels[u.id]) w *= 1.5; // nudge new weapons into early runs
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
    { id: 'cache', name: 'Shard Cache', icon: '💎', rarity: 'common', desc: () => 'Gain 15 Rift Shards.', filler: true },
  ];
  while (out.length < n) out.push(fillers[out.length % 2]);
  return out;
}

export function newSynergies(levels, active) {
  return SYNERGIES.filter((s) => !active.has(s.id) && s.req(levels));
}

export { pct };
