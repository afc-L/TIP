// Original cosmetic items. `level` is the account level needed to unlock.

export const OUTFITS = [
  { id: 'rookie', name: 'Rookie', level: 1, skin: 0xf1c27d, top: 0x3a7bd5, bottom: 0x2d3142, shoes: 0x222222, hat: 'none', accent: 0xffffff },
  { id: 'scout', name: 'Trail Scout', level: 1, skin: 0x8d5524, top: 0x4f7942, bottom: 0x6b5b3e, shoes: 0x3b2f2f, hat: 'cap', hatColor: 0x4f7942, accent: 0xe0c070 },
  { id: 'volt', name: 'Voltage', level: 3, skin: 0xe0ac69, top: 0xffd400, bottom: 0x1b1b1b, shoes: 0xffd400, hat: 'beanie', hatColor: 0x1b1b1b, accent: 0x00e5ff },
  { id: 'frostbyte', name: 'Frostbyte', level: 5, skin: 0xc68642, top: 0xbfe9ff, bottom: 0x5b8fb9, shoes: 0xffffff, hat: 'hood', hatColor: 0xeaf6ff, accent: 0x5b8fb9 },
  { id: 'ember', name: 'Ember Knight', level: 8, skin: 0xffdbac, top: 0xb22222, bottom: 0x3b0d0d, shoes: 0x1a1a1a, hat: 'helmet', hatColor: 0x6b6b6b, accent: 0xff8c00 },
  { id: 'mint', name: 'Mint Condition', level: 10, skin: 0xf1c27d, top: 0x98ff98, bottom: 0xffffff, shoes: 0xff6f91, hat: 'cap', hatColor: 0xff6f91, accent: 0xff6f91 },
  { id: 'nightowl', name: 'Night Owl', level: 13, skin: 0x8d5524, top: 0x2c2c54, bottom: 0x1e1e3f, shoes: 0x0f0f1f, hat: 'hood', hatColor: 0x2c2c54, accent: 0xffd32a },
  { id: 'astro', name: 'Astro Ace', level: 16, skin: 0xe0ac69, top: 0xf5f5f5, bottom: 0xdedede, shoes: 0x9e9e9e, hat: 'helmet', hatColor: 0xffffff, accent: 0xff5722 },
  { id: 'pharaoh', name: 'Sand Pharaoh', level: 20, skin: 0xc68642, top: 0xf2d16b, bottom: 0x2b5aa8, shoes: 0xf2d16b, hat: 'crown', hatColor: 0xf2d16b, accent: 0x2b5aa8 },
  { id: 'toxic', name: 'Biohazard', level: 24, skin: 0xffdbac, top: 0x7fff00, bottom: 0x2f4f2f, shoes: 0x111111, hat: 'helmet', hatColor: 0x556b2f, accent: 0xffff00 },
  { id: 'gilded', name: 'Gilded Legend', level: 30, skin: 0xf1c27d, top: 0xffd700, bottom: 0xb8860b, shoes: 0xffd700, hat: 'tophat', hatColor: 0x111111, accent: 0xffffff },
];

export const BACKPACKS = [
  { id: 'none', name: 'No Backpack', level: 1, style: 'none', color: 0x000000 },
  { id: 'daypack', name: 'Daypack', level: 1, style: 'pack', color: 0x8b5a2b },
  { id: 'jet', name: 'Jet Tank', level: 4, style: 'tank', color: 0xc0c0c0 },
  { id: 'wings', name: 'Feather Wings', level: 9, style: 'wings', color: 0xffffff },
  { id: 'battery', name: 'Power Cell', level: 14, style: 'tank', color: 0x00e5ff },
  { id: 'dragon', name: 'Dragon Wings', level: 22, style: 'wings', color: 0xb22222 },
];

export const GLIDERS = [
  { id: 'basic', name: 'Default Glider', level: 1, color: 0x3a7bd5, color2: 0xffffff },
  { id: 'sunset', name: 'Sunset Sail', level: 2, color: 0xff7e5f, color2: 0xfeb47b },
  { id: 'jungle', name: 'Leaf Rider', level: 6, color: 0x2e8b57, color2: 0x98fb98 },
  { id: 'storm', name: 'Storm Chaser', level: 11, color: 0x6a0dad, color2: 0xe0b0ff },
  { id: 'royal', name: 'Royal Wing', level: 18, color: 0xffd700, color2: 0x8b0000 },
  { id: 'void', name: 'Void Kite', level: 26, color: 0x111111, color2: 0x00ffff },
];

export const CONTRAILS = [
  { id: 'none', name: 'None', level: 1, color: null },
  { id: 'white', name: 'Cloud Trail', level: 1, color: 0xffffff },
  { id: 'fire', name: 'Fire Trail', level: 7, color: 0xff6a00 },
  { id: 'rainbow', name: 'Prism Trail', level: 15, color: 'rainbow' },
  { id: 'gold', name: 'Golden Trail', level: 28, color: 0xffd700 },
];

export const COSMETIC_SETS = { outfit: OUTFITS, backpack: BACKPACKS, glider: GLIDERS, contrail: CONTRAILS };

export function findCosmetic(kind, id) {
  const set = COSMETIC_SETS[kind];
  return set.find((c) => c.id === id) || set[0];
}

export function randomAppearance(rng = Math.random) {
  const o = OUTFITS[Math.floor(rng() * OUTFITS.length)];
  const bp = BACKPACKS[Math.floor(rng() * BACKPACKS.length)];
  const gl = GLIDERS[Math.floor(rng() * GLIDERS.length)];
  const skins = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac, 0x5a3a22];
  return { outfit: { ...o, skin: skins[Math.floor(rng() * skins.length)] }, backpack: bp, glider: gl, contrail: CONTRAILS[0] };
}

export function appearanceFromLoadout(loadout) {
  return {
    outfit: findCosmetic('outfit', loadout.outfit),
    backpack: findCosmetic('backpack', loadout.backpack),
    glider: findCosmetic('glider', loadout.glider),
    contrail: findCosmetic('contrail', loadout.contrail),
  };
}
