// Island layout: named locations, rivers, lakes, roads and biomes.
// Positions are metres; north is -Z (up on the map).

export const POIS = [
  { id: 'city', name: 'Neon Heights', type: 'city', x: 110, z: -60, r: 150, loot: 1.0, hot: 1.0 },
  { id: 'suburb', name: 'Maple Grove', type: 'suburb', x: -270, z: 170, r: 115, loot: 0.75, hot: 0.7 },
  { id: 'factory', name: 'Rustworks', type: 'factory', x: 470, z: 270, r: 110, loot: 0.75, hot: 0.65 },
  { id: 'lab', name: 'Site Zero', type: 'lab', x: -170, z: -470, r: 95, loot: 0.95, hot: 0.9 },
  { id: 'farm', name: 'Haybale Acres', type: 'farm', x: -480, z: 430, r: 120, loot: 0.55, hot: 0.35 },
  { id: 'beach', name: 'Sunspray Shores', type: 'beach', x: 600, z: -390, r: 85, loot: 0.55, hot: 0.4 },
  { id: 'ghost', name: 'Ghost Hollow', type: 'abandoned', x: 190, z: 530, r: 85, loot: 0.6, hot: 0.45 },
  { id: 'lodge', name: 'Pinecrest Lodge', type: 'lodge', x: -580, z: -60, r: 75, loot: 0.5, hot: 0.3 },
  { id: 'summit', name: 'Summit Outpost', type: 'summit', x: -470, z: -440, r: 45, loot: 0.55, hot: 0.25 },
  { id: 'gas1', name: 'Pit Stop West', type: 'gas', x: -50, z: 320, r: 38, loot: 0.4, hot: 0.25 },
  { id: 'gas2', name: 'Pit Stop East', type: 'gas', x: 380, z: -250, r: 38, loot: 0.4, hot: 0.25 },
  { id: 'docks', name: 'Dockside', type: 'docks', x: 330, z: 40, r: 55, loot: 0.45, hot: 0.3 },
];

// Small hidden spots with high-value loot
export const HIDDEN = [
  { id: 'cove', name: "Smuggler's Cove", x: -540, z: 640, kind: 'hut' },
  { id: 'hermit', name: "Hermit's Hut", x: -650, z: -420, kind: 'hut' },
  { id: 'treehouse', name: 'Treehouse', x: 640, z: 60, kind: 'tree' },
  { id: 'bunker2', name: 'Old Bunker', x: 30, z: 700, kind: 'bunker' },
  { id: 'ruin', name: 'Cliff Ruin', x: 720, z: -120, kind: 'hut' },
];

export const RIVERS = [
  { w: 13, pts: [[-330, -250], [-210, -80], [-130, 70], [30, 220], [160, 330], [330, 420], [520, 560], [760, 760]] },
  { w: 9, pts: [[-560, -280], [-700, -240], [-900, -230]] },
];

export const LAKES = [
  { x: 330, z: 110, r: 55 },
  { x: -660, z: 250, r: 48 },
  { x: 40, z: -300, r: 34 },
];

// Mountain ranges: centre, radius, height
export const MOUNTAINS = [
  { x: -440, z: -440, r: 320, h: 120 },
  { x: 640, z: 120, r: 170, h: 45 },
  { x: -100, z: 620, r: 170, h: 35 },
];

export const FORESTS = [
  { x: -580, z: -70, r: 230, density: 1.0 },
  { x: 640, z: 60, r: 150, density: 0.9 },
  { x: -120, z: 600, r: 160, density: 0.8 },
  { x: 120, z: -330, r: 120, density: 0.6 },
  { x: -320, z: -150, r: 130, density: 0.7 },
  { x: 400, z: 520, r: 130, density: 0.6 },
];

// Roads: lists of waypoints between locations
export const ROADS = [
  [[-270, 170], [-120, 120], [0, 20], [110, -60]],
  [[110, -60], [260, 60], [350, 160], [470, 270]],
  [[110, -60], [250, -160], [380, -250], [520, -330], [600, -390]],
  [[-270, 170], [-150, 260], [-50, 320], [80, 430], [190, 530]],
  [[-270, 170], [-380, 300], [-480, 430]],
  [[-270, 170], [-430, 60], [-580, -60]],
  [[110, -60], [40, -200], [-60, -360], [-170, -470]],
  [[470, 270], [380, 400], [190, 530]],
];
