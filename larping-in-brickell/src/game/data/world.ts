import type { Poi } from '../types';

// City grid. +x is east (toward Biscayne Bay), -z is north.
export const ROAD_W = 16; // full road width
export const SIDEWALK = 4;
export const ROADS_X = [-300, -200, -100, 0, 100, 200, 290];
export const ROADS_Z = [-300, -200, -100, 0, 100, 200, 300];
export const MAP_MIN_X = -330;
export const MAP_MAX_X = 312; // seawall
export const MAP_MIN_Z = -330;
export const MAP_MAX_Z = 330;
export const SEAWALL_X = 312;
export const WATER_MAX_X = 900;
export const LANE = 4; // lane offset from road centre (drive on the right)

export const STREET_NAMES_X: Record<number, string> = {
  [-300]: 'SW 2nd Ave',
  [-200]: 'SW 1st Ave',
  [-100]: 'S Miami Ave',
  0: 'Brickell Ave',
  100: 'Brickell Plaza',
  200: 'Brickell Bay Dr',
  290: 'Bayshore Dr',
};
export const STREET_NAMES_Z: Record<number, string> = {
  [-300]: 'SE 5th St',
  [-200]: 'SE 7th St',
  [-100]: 'SE 9th St',
  0: 'SE 11th St',
  100: 'SE 13th St',
  200: 'SE 15th St',
  300: 'Rickenbacker Way',
};

export interface Block {
  cx: number;
  cz: number;
  w: number; // lot width (x)
  d: number; // lot depth (z)
}

export function blocks(): Block[] {
  const out: Block[] = [];
  for (let i = 0; i < ROADS_X.length - 1; i++) {
    for (let j = 0; j < ROADS_Z.length - 1; j++) {
      const x0 = ROADS_X[i] + ROAD_W / 2 + SIDEWALK;
      const x1 = ROADS_X[i + 1] - ROAD_W / 2 - SIDEWALK;
      const z0 = ROADS_Z[j] + ROAD_W / 2 + SIDEWALK;
      const z1 = ROADS_Z[j + 1] - ROAD_W / 2 - SIDEWALK;
      out.push({ cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 });
    }
  }
  return out;
}

export function blockKey(cx: number, cz: number) {
  return `${Math.round(cx)},${Math.round(cz)}`;
}

const E = Math.PI / 2; // entrance faces east (+x)
const W = -Math.PI / 2;
const N = Math.PI; // faces north (-z)

export const POIS: Poi[] = [
  { id: 'home_modest', name: 'The Modest Tower', kind: 'home', x: -250, z: 210, face: N, radius: 6, icon: '⌂', color: '#9ad', desc: 'Your starter studio. Sleep, save and change outfits.' },
  { id: 'cafe', name: 'Café Clout', kind: 'cafe', x: -10, z: 50, face: E, radius: 7, icon: '☕', color: '#e8b46c', desc: 'Oat-milk lattes and aspiring creators.' },
  { id: 'brunch', name: 'Brunch Theory', kind: 'cafe', x: -210, z: 50, face: E, radius: 7, icon: '🥂', color: '#f2a7b5', desc: 'Bottomless mimosas, bottomless networking.' },
  { id: 'agency', name: 'Suite 404 Offices', kind: 'agency', x: -110, z: 150, face: E, radius: 6, icon: '💼', color: '#d4af6a', desc: 'Your AlwaysFans management office (once you rent it).' },
  { id: 'dealer', name: 'Brickell Prestige Motors', kind: 'dealer', x: 150, z: 210, face: N, radius: 8, icon: '🚘', color: '#6cf', desc: 'Luxury dealership. Financing not available (to you).' },
  { id: 'watch', name: "Tempo d'Oro", kind: 'watch', x: 10, z: -50, face: W, radius: 6, icon: '⌚', color: '#ffd27a', desc: 'Watch boutique. Prices available on request (they are big).' },
  { id: 'clothes', name: 'Drip District', kind: 'clothes', x: -10, z: -150, face: E, radius: 6, icon: '👔', color: '#c9f', desc: 'Designer fits for people who say "fit".' },
  { id: 'club', name: 'VOLT Nightclub', kind: 'club', x: 110, z: -150, face: W, radius: 7, icon: '♫', color: '#f0f', desc: 'The loudest room in Brickell.', valet: true },
  { id: 'rooftop', name: 'Sky Lounge 88', kind: 'rooftop', x: 10, z: 150, face: W, radius: 7, icon: '🍸', color: '#7ff', desc: 'Rooftop bar. Sunset is mandatory.', valet: true },
  { id: 'restaurant', name: 'Salt & Status', kind: 'restaurant', x: 110, z: 50, face: W, radius: 7, icon: '🍽', color: '#fa8', desc: 'A steakhouse where the steak is gold-leafed.', valet: true },
  { id: 'penthouse', name: 'Aurum Tower', kind: 'penthouse', x: 210, z: -50, face: W, radius: 7, icon: '🏙', color: '#ffcf6a', desc: 'The tallest flex in Brickell. Penthouse on top.', valet: true },
  { id: 'garage', name: 'Brickell Central Garage', kind: 'garage', x: -110, z: -50, face: E, radius: 8, icon: 'P', color: '#8af', desc: 'Swap vehicles from your collection.' },
  { id: 'carmeet', name: 'Underpass Car Meet', kind: 'carmeet', x: -250, z: -150, face: E, radius: 22, icon: '🏁', color: '#ff6a3d', desc: 'Where suspensions go to dance.' },
  { id: 'network', name: 'The Hustle Hub', kind: 'network', x: -110, z: -250, face: E, radius: 6, icon: '🤝', color: '#9f9', desc: 'Co-working space. Everyone is a founder.' },
  { id: 'hq', name: 'Brickell Agency HQ', kind: 'hq', x: 10, z: -250, face: W, radius: 6, icon: '🏢', color: '#d4af6a', desc: 'Premium headquarters tower for serious agencies.' },
  { id: 'marina', name: 'Bayside Marina', kind: 'marina', x: 304, z: 200, face: E, radius: 8, icon: '⚓', color: '#4cf', desc: 'Yachts, slips and people who say "on the boat".' },
  { id: 'showoff', name: 'Bayfront Promenade', kind: 'showoff', x: 245, z: 250, face: E, radius: 22, icon: '★', color: '#ffd700', desc: 'Miami Showoff challenge plaza.' },
];

export const POI_BY_ID: Record<string, Poi> = Object.fromEntries(POIS.map((p) => [p.id, p]));

// Player start: next to the parked Maybach outside The Modest Tower.
export const START_SPAWN = { x: -250, z: 209.5, yaw: Math.PI / 2 };
export const START_CAR = { x: -238, z: 204.5, yaw: Math.PI / 2 };

// Where valet-parked vehicles sit / where valet zones are (in the curb lane in front of the POI).
export function valetSpot(p: Poi) {
  const fx = Math.sin(p.face);
  const fz = Math.cos(p.face);
  return { x: p.x + fx * 8, z: p.z + fz * 8 };
}

// Yacht berth (in the water east of the marina)
export const YACHT_BERTH = { x: 382, z: 192, yaw: Math.PI / 2 };
export const PIER_Z = 205;
// Open water area where the yacht can be driven
export const BAY_BOUNDS = { minX: 330, maxX: 860, minZ: -320, maxZ: 320 };
