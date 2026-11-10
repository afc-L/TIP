// Weapons, consumables, ammo and loot tables.
import { R_DMG, R_RELOAD, R_SPREAD, RARITY } from './config.js';
import { weightedPick, randInt, chance, pick } from './util.js';

// cat: ar | shotgun | smg | sniper | pistol | explosive | special
// ammo: light | medium | heavy | shells | rockets
export const WEAPONS = {
  ar:       { name: 'Vanguard AR', cat: 'ar', ammo: 'medium', dmg: 31, rof: 5.5, mag: 30, reload: 2.25, hip: 0.032, ads: 0.006, bloom: 0.006, recoil: 0.011, range: 75, maxRange: 280, head: 1.5, auto: true, rarities: [0, 1, 2, 3, 4], len: 0.85, color: 0x555a63, snd: 'ar', zoom: 1.35 },
  burst:    { name: 'Pulse Burst AR', cat: 'ar', ammo: 'medium', dmg: 29, rof: 4.2, burst: 3, mag: 30, reload: 2.4, hip: 0.035, ads: 0.004, bloom: 0.004, recoil: 0.009, range: 80, maxRange: 280, head: 1.5, auto: false, rarities: [0, 1, 2, 3, 4], len: 0.85, color: 0x3c4c66, snd: 'burst', zoom: 1.4 },
  heavyar:  { name: 'Bastion Heavy AR', cat: 'ar', ammo: 'heavy', dmg: 42, rof: 3.8, mag: 25, reload: 2.7, hip: 0.04, ads: 0.009, bloom: 0.012, recoil: 0.02, range: 70, maxRange: 260, head: 1.5, auto: true, rarities: [2, 3, 4], len: 0.9, color: 0x3a2f2a, snd: 'heavy', zoom: 1.35 },
  pump:     { name: 'Breacher Pump', cat: 'shotgun', ammo: 'shells', dmg: 9.5, pellets: 10, rof: 0.75, mag: 5, reload: 4.4, hip: 0.085, ads: 0.07, bloom: 0, recoil: 0.06, range: 9, maxRange: 32, head: 2.0, auto: false, rarities: [1, 2, 3, 4], len: 0.8, color: 0x6b4426, snd: 'pump', zoom: 1.15 },
  tac:      { name: 'Rattler Tactical', cat: 'shotgun', ammo: 'shells', dmg: 7.2, pellets: 10, rof: 1.5, mag: 8, reload: 5.2, hip: 0.09, ads: 0.075, bloom: 0, recoil: 0.04, range: 9, maxRange: 30, head: 1.75, auto: false, rarities: [0, 1, 2, 3, 4], len: 0.78, color: 0x2f3236, snd: 'tac', zoom: 1.15 },
  smg:      { name: 'Hornet SMG', cat: 'smg', ammo: 'light', dmg: 17, rof: 12, mag: 30, reload: 2.1, hip: 0.04, ads: 0.022, bloom: 0.005, recoil: 0.007, range: 28, maxRange: 120, head: 1.75, auto: true, rarities: [0, 1, 2, 3, 4], len: 0.55, color: 0x3d4a3a, snd: 'smg', zoom: 1.2 },
  compact:  { name: 'Buzzsaw Compact', cat: 'smg', ammo: 'light', dmg: 21, rof: 10, mag: 40, reload: 3.0, hip: 0.05, ads: 0.03, bloom: 0.006, recoil: 0.009, range: 22, maxRange: 100, head: 1.75, auto: true, rarities: [2, 3, 4], len: 0.5, color: 0x272727, snd: 'smg', zoom: 1.2 },
  sniper:   { name: 'Longshot Bolt Sniper', cat: 'sniper', ammo: 'heavy', dmg: 105, rof: 0.33, mag: 1, reload: 2.7, hip: 0.12, ads: 0.0, bloom: 0, recoil: 0.08, range: 400, maxRange: 600, head: 2.5, auto: false, projSpeed: 520, drop: 9, rarities: [2, 3, 4], len: 1.15, color: 0x2a3b2a, snd: 'sniper', zoom: 4.5, scope: true },
  dmr:      { name: 'Hawkeye DMR', cat: 'sniper', ammo: 'medium', dmg: 46, rof: 2.0, mag: 10, reload: 2.4, hip: 0.05, ads: 0.002, bloom: 0.01, recoil: 0.02, range: 150, maxRange: 400, head: 2.0, auto: false, projSpeed: 420, drop: 6, rarities: [1, 2, 3, 4], len: 1.0, color: 0x44403a, snd: 'dmr', zoom: 2.6, scope: true },
  pistol:   { name: 'Sidekick Pistol', cat: 'pistol', ammo: 'light', dmg: 25, rof: 6.75, mag: 16, reload: 1.5, hip: 0.025, ads: 0.012, bloom: 0.01, recoil: 0.012, range: 30, maxRange: 120, head: 2.0, auto: false, rarities: [0, 1, 2, 3, 4], len: 0.32, color: 0x333333, snd: 'pistol', zoom: 1.15 },
  revolver: { name: 'Thunder Revolver', cat: 'pistol', ammo: 'heavy', dmg: 56, rof: 1.1, mag: 6, reload: 2.2, hip: 0.03, ads: 0.004, bloom: 0.02, recoil: 0.05, range: 45, maxRange: 160, head: 2.0, auto: false, rarities: [1, 2, 3, 4], len: 0.38, color: 0x8a8a8a, snd: 'revolver', zoom: 1.2 },
  rocket:   { name: 'Boomtube Launcher', cat: 'explosive', ammo: 'rockets', dmg: 110, rof: 0.75, mag: 1, reload: 3.0, hip: 0.01, ads: 0.004, bloom: 0, recoil: 0.06, range: 300, maxRange: 300, head: 1, auto: false, projSpeed: 75, explosive: 6, buildDmg: 500, rarities: [2, 3, 4], len: 1.1, color: 0x4a5a2a, snd: 'rocket', zoom: 1.25 },
  gl:       { name: 'Thumper Launcher', cat: 'explosive', ammo: 'rockets', dmg: 85, rof: 1.2, mag: 6, reload: 3.4, hip: 0.02, ads: 0.01, bloom: 0, recoil: 0.04, range: 120, maxRange: 120, head: 1, auto: false, projSpeed: 40, drop: 18, explosive: 4.5, buildDmg: 300, bounce: true, rarities: [2, 3, 4], len: 0.85, color: 0x5a4a2a, snd: 'gl', zoom: 1.2 },
  minigun:  { name: 'Shredder Minigun', cat: 'special', ammo: 'light', dmg: 16, rof: 13, mag: 999, reload: 0, hip: 0.06, ads: 0.05, bloom: 0, recoil: 0.004, range: 45, maxRange: 140, head: 1.5, auto: true, spinup: 0.9, rarities: [3, 4], len: 1.0, color: 0x2a2a2a, snd: 'minigun', zoom: 1.15, buildMult: 2 },
  rail:     { name: 'Arc Railspike', cat: 'special', ammo: 'heavy', dmg: 95, rof: 0.6, mag: 3, reload: 3.0, hip: 0.02, ads: 0.0, bloom: 0, recoil: 0.05, range: 300, maxRange: 400, head: 1.6, auto: false, pierce: true, charge: 0.6, rarities: [3, 4], len: 1.05, color: 0x23324a, snd: 'rail', zoom: 2.2, scope: true },
};

// Mythic, unique weapons — only from vaults, rare chests and supply drops
export const MYTHICS = [
  { base: 'ar', name: "Tempest Queen's AR", dmg: 1.08 },
  { base: 'pump', name: 'Ironjaw Pump', dmg: 1.06 },
  { base: 'sniper', name: "Hawk-Eye's Longshot", dmg: 1.1 },
  { base: 'smg', name: 'Hornet Swarm', dmg: 1.05 },
  { base: 'minigun', name: 'Overlord Shredder', dmg: 1.1 },
];

export const CONSUMABLES = {
  bandage: { name: 'Bandage Roll', stack: 15, use: 3.2, heal: 15, healCap: 75, rarity: 0, color: 0xf0f0f0 },
  medkit:  { name: 'Med Kit', stack: 3, use: 9, heal: 100, healCap: 100, rarity: 1, color: 0xe24b4b },
  minishield: { name: 'Shield Sip', stack: 6, use: 2, shield: 25, shieldCap: 50, rarity: 1, color: 0x4fc3ff },
  bigshield:  { name: 'Shield Flask', stack: 3, use: 5, shield: 50, shieldCap: 100, rarity: 2, color: 0x2266ff },
  fizz:    { name: 'Citrus Fizz', stack: 2, use: 1.5, regen: 75, rarity: 3, color: 0xffb833 },
  elixir:  { name: 'Golden Elixir', stack: 1, use: 4, heal: 100, healCap: 100, shield: 100, shieldCap: 100, rarity: 4, color: 0xffe14a },
  grenade: { name: 'Frag Grenade', stack: 6, use: 0, throwable: true, dmg: 100, radius: 5, rarity: 1, color: 0x3d5a2a },
};

export const AMMO = {
  light:   { name: 'Light Ammo', pick: 30, max: 999, color: 0x8fd1ff },
  medium:  { name: 'Medium Ammo', pick: 20, max: 999, color: 0x9be37a },
  heavy:   { name: 'Heavy Ammo', pick: 6, max: 999, color: 0xd38a5a },
  shells:  { name: 'Shells', pick: 6, max: 999, color: 0xe8d34a },
  rockets: { name: 'Rockets', pick: 3, max: 99, color: 0xd84a4a },
};

// ---------- item instances ----------
let ITEM_ID = 1;
export function makeWeapon(type, rarity, mythic = null) {
  const def = WEAPONS[type];
  const r = Math.max(0, Math.min(5, rarity));
  const it = {
    id: ITEM_ID++, kind: 'weapon', type, def, rarity: r,
    name: mythic ? mythic.name : def.name,
    dmg: def.dmg * R_DMG[r] * (mythic ? mythic.dmg : 1),
    reload: def.reload * R_RELOAD[r],
    hip: def.hip * R_SPREAD[r],
    adsSpread: def.ads * R_SPREAD[r],
    mag: def.mag,
    ammoIn: def.mag,
  };
  return it;
}
export function makeConsumable(type, count = 1) {
  const def = CONSUMABLES[type];
  return { id: ITEM_ID++, kind: 'consumable', type, def, rarity: def.rarity, name: def.name, count: Math.min(count, def.stack) };
}
export function itemColor(it) { return RARITY[it.rarity].hex; }

// DPS-ish rating used by the AI (and loot logic) to compare weapons
export function weaponRating(it, role) {
  if (!it || it.kind !== 'weapon') return 0;
  const d = it.def;
  const pellets = d.pellets || 1;
  const burst = d.burst || 1;
  const dps = it.dmg * pellets * Math.min(d.rof * burst, 14);
  let suit = 1;
  const cat = d.cat;
  if (role === 'close') suit = { shotgun: 1.6, smg: 1.25, pistol: 0.8, ar: 0.7, special: 1.0, sniper: 0.2, explosive: 0.3 }[cat];
  else if (role === 'mid') suit = { ar: 1.4, smg: 0.9, pistol: 0.6, shotgun: 0.15, sniper: 0.8, special: 1.0, explosive: 0.6 }[cat];
  else if (role === 'long') suit = { sniper: 1.8, ar: 1.0, special: 0.9, pistol: 0.3, smg: 0.3, shotgun: 0.02, explosive: 0.4 }[cat];
  return dps * suit * (1 + it.rarity * 0.12);
}

// ---------- loot tables ----------
const FLOOR_WEAPONS = [['ar', 12], ['burst', 6], ['pump', 9], ['tac', 9], ['smg', 9], ['compact', 3], ['pistol', 10], ['revolver', 4], ['dmr', 3], ['sniper', 2], ['heavyar', 3], ['rocket', 1], ['gl', 1]];
const CHEST_WEAPONS = [['ar', 12], ['burst', 6], ['pump', 11], ['tac', 8], ['smg', 9], ['compact', 4], ['pistol', 4], ['revolver', 4], ['dmr', 4], ['sniper', 3], ['heavyar', 4], ['rocket', 2], ['gl', 2], ['minigun', 1], ['rail', 1]];
const RARITY_W = {
  floor: [42, 32, 17, 7, 2],
  chest: [18, 34, 30, 13, 5],
  rare: [0, 10, 35, 35, 20],
  drop: [0, 0, 10, 50, 40],
};
const CONS_W = [['bandage', 14], ['medkit', 5], ['minishield', 12], ['bigshield', 7], ['fizz', 3], ['elixir', 1], ['grenade', 7]];

function rollFrom(table) { return weightedPick(table, (e) => e[1])[0]; }

export function rollWeapon(kind = 'floor') {
  const table = kind === 'floor' ? FLOOR_WEAPONS : CHEST_WEAPONS;
  for (let tries = 0; tries < 10; tries++) {
    const type = rollFrom(table);
    const w = RARITY_W[kind] || RARITY_W.chest;
    const idx = [0, 1, 2, 3, 4];
    let r = weightedPick(idx, (i) => w[i]);
    const allowed = WEAPONS[type].rarities;
    if (!allowed.includes(r)) r = r < allowed[0] ? allowed[0] : allowed[allowed.length - 1];
    return makeWeapon(type, r);
  }
}
export function rollMythic() {
  const m = pick(MYTHICS);
  return makeWeapon(m.base, 5, m);
}
export function rollConsumable(boost = 0) {
  let t = rollFrom(CONS_W);
  if (boost && chance(boost)) t = pick(['bigshield', 'medkit', 'fizz']);
  const def = CONSUMABLES[t];
  const n = t === 'bandage' ? 5 : t === 'minishield' ? 3 : t === 'grenade' ? 3 : 1;
  return makeConsumable(t, n);
}
export function ammoFor(type) { return WEAPONS[type].ammo; }
export function ammoDrop(ammo, mult = 1) { return Math.round(AMMO[ammo].pick * mult * (0.8 + Math.random() * 0.5)); }
export function randomAmmoType() { return pick(['light', 'light', 'medium', 'medium', 'heavy', 'shells', 'shells']); }
export { randInt };
