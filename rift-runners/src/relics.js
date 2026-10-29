// Relics: run-changing passive items. Max MAX_RELICS held at once (see config.js).
// `unlock` = Rift Shard cost in the Sanctum; relics without it are available from the start.

export const RELICS = [
  { id: 'glass', name: 'Glass Cannon', icon: '🔮', rarity: 'rare',
    desc: '+35% damage, but -25% max health.' },
  { id: 'stormcore', name: 'Storm Core', icon: '🌩️', rarity: 'rare',
    desc: 'All lightning chains to 2 more enemies and deals +20% damage.' },
  { id: 'phoenix', name: 'Phoenix Sigil', icon: '☀️', rarity: 'legendary',
    desc: 'Once per run, survive a fatal hit and recover 40% health.' },
  { id: 'gravity', name: 'Gravity Well', icon: '🌀', rarity: 'rare',
    desc: 'Every 7 seconds, pull nearby enemies together in front of you and deal light damage.' },
  { id: 'blood', name: 'Blood Battery', icon: '🩸', rarity: 'rare',
    desc: 'Kills restore 1 health (up to 8 health every 5 seconds).' },
  { id: 'echo', name: 'Echo Chamber', icon: '🔁', rarity: 'rare',
    desc: 'Every 5th weapon attack is repeated at 50% damage.' },
  { id: 'lucky', name: 'Lucky Coin', icon: '🍀', rarity: 'common',
    desc: 'Rare and Legendary upgrades appear more often. +25% gold.' },
  { id: 'overclock', name: 'Overclocked Heart', icon: '💓', rarity: 'rare',
    desc: 'After dashing, +60% attack speed for 2.5 seconds.' },
  { id: 'thorn', name: 'Thorn Armor', icon: '🌵', rarity: 'common',
    desc: 'Enemies that touch you take 60% of the damage back (min 8). Contact damage taken -10%.' },
  { id: 'voidmagnet', name: 'Void Magnet', icon: '🧲', rarity: 'common',
    desc: '+90% pickup radius. Gold flies to you from anywhere.' },
  { id: 'glassstorm', name: 'Glassstorm', icon: '❄️', rarity: 'rare',
    desc: 'Critical hits shatter into a small explosion dealing 40% of the hit.' },
  { id: 'laststand', name: 'Last Stand', icon: '🛡️', rarity: 'rare',
    desc: 'While below 35% health: +40% damage and +15% move speed.' },
  { id: 'hunter', name: "Hunter's Mark", icon: '🎯', rarity: 'rare', unlock: 90,
    desc: '+30% damage to elites, minibosses and bosses.' },
  { id: 'chrono', name: 'Chrono Shard', icon: '⏳', rarity: 'rare', unlock: 100,
    desc: '-30% dash cooldown. Enemies you dash past are slowed by 40% for 2 seconds.' },
  { id: 'ember', name: 'Ember Heart', icon: '♨️', rarity: 'rare', unlock: 110,
    desc: 'Every hit ignites (Ignite I if you lack it). Burn damage +40%.' },
  { id: 'bulwark', name: 'Iron Bulwark', icon: '🧱', rarity: 'common', unlock: 120,
    desc: 'Take 15% less damage, but -8% move speed.' },
];

export const RELIC_BY_ID = Object.fromEntries(RELICS.map((r) => [r.id, r]));

// Weapon evolutions: weapon at `level` + owned relic => evolved form.
export const EVOLUTIONS = [
  { id: 'tempest', weapon: 'bolt', relic: 'stormcore', level: 4, name: 'Tempest Bolt', icon: '🌩️',
    desc: 'Rift Bolts release chain lightning to 2 enemies on impact.' },
  { id: 'bramble', weapon: 'blades', relic: 'thorn', level: 4, name: 'Bramble Halo', icon: '🌿',
    desc: '+2 blades on a wider orbit. Blades destroy enemy bullets and you take 10% less damage.' },
  { id: 'shatterfall', weapon: 'meteor', relic: 'glassstorm', level: 4, name: 'Shatterfall', icon: '💠',
    desc: 'Meteors burst into 5 smaller explosions after landing.' },
  { id: 'horizon', weapon: 'orb', relic: 'gravity', level: 4, name: 'Event Horizon', icon: '🕳️',
    desc: 'Void Orbs drag nearby enemies toward their path.' },
  { id: 'thunder', weapon: 'zap', relic: 'echo', level: 4, name: 'Thunder Crown', icon: '👑',
    desc: 'Chain Lightning strikes twice and jumps to 3 more enemies.' },
  { id: 'crimsonarc', weapon: 'slash', relic: 'blood', level: 4, name: 'Crimson Arc', icon: '🌙',
    desc: 'Slashes are 40% wider and heal 1 health per enemy hit (max 3 per slash).' },
  { id: 'stormnova', weapon: 'arc', relic: 'overclock', level: 4, name: 'Storm Nova', icon: '💫',
    desc: 'Arc Burst radius +50%. Dashing triggers a free Arc Burst.' },
];

export function availableRelics(meta, owned) {
  return RELICS.filter((r) => !owned.includes(r.id) && (!r.unlock || meta.data.unlocks.relics?.includes(r.id)));
}

// Pick n relic offers. `minRarity` lets special rewards guarantee something good.
export function rollRelics(meta, owned, n = 3, legendaryBias = 0) {
  const pool = availableRelics(meta, owned).map((r) => ({ r, w: r.rarity === 'legendary' ? 6 + legendaryBias : r.rarity === 'rare' ? 10 : 12 }));
  const out = [];
  while (out.length < n && pool.length) {
    const total = pool.reduce((a, p) => a + p.w, 0);
    let x = Math.random() * total, i = 0;
    for (; i < pool.length - 1; i++) { x -= pool[i].w; if (x <= 0) break; }
    out.push(pool[i].r);
    pool.splice(i, 1);
  }
  return out;
}
