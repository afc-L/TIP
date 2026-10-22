import type { VehicleMods } from '../types';

export type BodyShape = 'suv' | 'sedan' | 'supercar' | 'sports' | 'gt' | 'convertible' | 'show';

export interface VehicleDef {
  id: string;
  name: string;
  make: string;
  category: string;
  price: number;
  minLevel: number;
  shape: BodyShape;
  topSpeed: number; // m/s
  accel: number; // m/s^2
  handling: number; // 0..1 grip/turn rate
  mass: number; // feel only
  prestige: number; // clout factor 1..10
  comfort: number; // 1..10
  maintenance: number; // per month
  length: number;
  width: number;
  height: number;
  defaultMods: VehicleMods;
  blurb: string;
}

const mods = (paint: string, accent = '', wheels = 'forged', interior = '#e8e4dc'): VehicleMods => ({
  paint, accent, wheels, tint: 2, interior, underglow: '', engine: 0, handling: 0, chrome: true,
});

export const VEHICLES: VehicleDef[] = [
  {
    id: 'maybach', name: 'Maybach GLS 600', make: 'Mercedes', category: 'Ultra-luxury SUV', price: 180000, minLevel: 0,
    shape: 'suv', topSpeed: 58, accel: 9, handling: 0.55, mass: 2.8, prestige: 6, comfort: 10, maintenance: 4500,
    length: 5.2, width: 2.05, height: 1.85, defaultMods: mods('#0d0d10', '#8a6d4a', 'maybach', '#ece8e0'),
    blurb: 'Your pride, your joy, your entire net worth. Now with hydraulic bounce.',
  },
  {
    id: 'comete', name: 'Comète S', make: 'Vellano', category: 'Luxury sedan', price: 140000, minLevel: 1,
    shape: 'sedan', topSpeed: 62, accel: 10, handling: 0.65, mass: 2.0, prestige: 4, comfort: 8, maintenance: 2500,
    length: 5.0, width: 1.95, height: 1.45, defaultMods: mods('#c9ccd1', '', 'turbine', '#2b2b2b'),
    blurb: 'Executive sedan for executives of things.',
  },
  {
    id: 'ardent', name: 'RS-7 Ardent', make: 'Ardent', category: 'Sports car', price: 220000, minLevel: 2,
    shape: 'sports', topSpeed: 74, accel: 14, handling: 0.8, mass: 1.5, prestige: 5, comfort: 5, maintenance: 3500,
    length: 4.5, width: 1.9, height: 1.25, defaultMods: mods('#1f5eff', '', 'split', '#111'),
    blurb: 'Loud enough to wake up Coconut Grove.',
  },
  {
    id: 'castellan', name: 'Imperium', make: 'Castellan', category: 'Ultra-luxury SUV', price: 420000, minLevel: 3,
    shape: 'suv', topSpeed: 60, accel: 10, handling: 0.58, mass: 2.9, prestige: 7, comfort: 10, maintenance: 6500,
    length: 5.4, width: 2.1, height: 1.9, defaultMods: mods('#f4f1ea', '', 'monoblock', '#4a2c1d'),
    blurb: 'For when the Maybach feels too humble.',
  },
  {
    id: 'monaco', name: 'Monaco Spyder', make: 'Riviera', category: 'Luxury convertible', price: 380000, minLevel: 3,
    shape: 'convertible', topSpeed: 70, accel: 13, handling: 0.75, mass: 1.7, prestige: 7, comfort: 7, maintenance: 5500,
    length: 4.8, width: 1.95, height: 1.3, defaultMods: mods('#b3122e', '', 'split', '#f1e3c6'),
    blurb: 'Top down, sunglasses on, accountant on hold.',
  },
  {
    id: 'aurelius', name: 'Grand Tourer', make: 'Aurelius', category: 'Grand tourer', price: 650000, minLevel: 4,
    shape: 'gt', topSpeed: 78, accel: 15, handling: 0.78, mass: 1.9, prestige: 8, comfort: 8, maintenance: 8000,
    length: 4.9, width: 2.0, height: 1.3, defaultMods: mods('#1b3d2f', '', 'forged', '#c8a165'),
    blurb: 'British-ish. Very long hood. Very long payments.',
  },
  {
    id: 'phantasm', name: 'Phantasm Royale', make: 'Bellagio', category: 'Ultra-luxury sedan', price: 950000, minLevel: 5,
    shape: 'sedan', topSpeed: 66, accel: 11, handling: 0.6, mass: 2.7, prestige: 9, comfort: 10, maintenance: 12000,
    length: 5.8, width: 2.05, height: 1.6, defaultMods: mods('#2b0f3a', '#d4af6a', 'monoblock', '#f4efe6'),
    blurb: 'Starlight headliner. Umbrella in the door. Ego in the trunk.',
  },
  {
    id: 'tempesta', name: 'Tempesta', make: 'Vortessa', category: 'Exotic supercar', price: 1200000, minLevel: 5,
    shape: 'supercar', topSpeed: 88, accel: 19, handling: 0.88, mass: 1.4, prestige: 9, comfort: 4, maintenance: 15000,
    length: 4.7, width: 2.05, height: 1.15, defaultMods: mods('#ff8c00', '', 'turbine', '#111'),
    blurb: 'Doors go up. Bank balance goes down.',
  },
  {
    id: 'zero', name: 'Velocità Zero', make: 'Velocità', category: 'Hypercar', price: 3500000, minLevel: 6,
    shape: 'supercar', topSpeed: 100, accel: 23, handling: 0.92, mass: 1.3, prestige: 10, comfort: 3, maintenance: 30000,
    length: 4.6, width: 2.1, height: 1.1, defaultMods: mods('#e6e6e6', '#111111', 'split', '#d40000'),
    blurb: 'Only 12 exist. You own one. Your landlord is concerned.',
  },
  {
    id: 'lowkey', name: 'The Gilded Lowkey', make: 'Brickell Customs', category: 'Custom show car', price: 2200000, minLevel: 7,
    shape: 'show', topSpeed: 64, accel: 12, handling: 0.7, mass: 2.2, prestige: 10, comfort: 8, maintenance: 20000,
    length: 5.6, width: 2.05, height: 1.35, defaultMods: { ...mods('#d4af37', '#111', 'wire', '#7b0d1e'), underglow: '#ff00ff' },
    blurb: 'Gold-wrapped. Diamond-stitched. Not low key at all.',
  },
];

export const VEHICLE_BY_ID: Record<string, VehicleDef> = Object.fromEntries(VEHICLES.map((v) => [v.id, v]));

export const PAINTS: { name: string; color: string }[] = [
  { name: 'Obsidian Black', color: '#0d0d10' },
  { name: 'Kalahari Gold', color: '#8a6d4a' },
  { name: 'Diamond White', color: '#f2f0ea' },
  { name: 'Selenite Grey', color: '#7d8187' },
  { name: 'Rubellite Red', color: '#6b0f1a' },
  { name: 'Emerald Bay', color: '#0f4d3a' },
  { name: 'Brickell Blue', color: '#1b3b7a' },
  { name: 'Miami Pink', color: '#ff5fa2' },
  { name: 'Biscayne Teal', color: '#11a3a3' },
  { name: 'Champagne', color: '#d7c49e' },
  { name: '24K Wrap', color: '#d4af37' },
  { name: 'Matte Purple', color: '#3c1f5c' },
];
export const ACCENTS: { name: string; color: string }[] = [
  { name: 'None (mono)', color: '' },
  { name: 'Kalahari Gold', color: '#8a6d4a' },
  { name: 'Obsidian Black', color: '#0d0d10' },
  { name: 'Silver', color: '#c0c3c8' },
  { name: 'Champagne', color: '#d7c49e' },
  { name: 'Rose Gold', color: '#b76e79' },
];
export const WHEELS: { id: string; name: string; price: number }[] = [
  { id: 'maybach', name: 'Maybach Multi-Spoke', price: 0 },
  { id: 'forged', name: 'Forged 10-Spoke', price: 8000 },
  { id: 'monoblock', name: 'Monoblock Disc', price: 12000 },
  { id: 'turbine', name: 'Turbine', price: 9000 },
  { id: 'split', name: 'Split Spoke', price: 7000 },
  { id: 'wire', name: 'Gold Wire (Lowrider)', price: 22000 },
];
export const INTERIORS: { name: string; color: string }[] = [
  { name: 'Crystal White', color: '#ece8e0' },
  { name: 'Espresso', color: '#4a2c1d' },
  { name: 'Black Nappa', color: '#1a1a1a' },
  { name: 'Saddle', color: '#a0612e' },
  { name: 'Bordeaux', color: '#7b0d1e' },
  { name: 'Sky Blue', color: '#9cc9e8' },
];
export const UNDERGLOWS: { name: string; color: string }[] = [
  { name: 'Off', color: '' },
  { name: 'Ice Blue', color: '#36c9ff' },
  { name: 'Miami Pink', color: '#ff2fa0' },
  { name: 'Gold', color: '#ffc341' },
  { name: 'Purple', color: '#9b4dff' },
  { name: 'Mint', color: '#3dffb0' },
];

export const MOD_PRICES = {
  paint: 6000,
  accent: 4000,
  tint: 1500,
  interior: 12000,
  underglow: 5000,
  engine: [0, 25000, 60000, 140000],
  handling: [0, 18000, 45000, 100000],
  chrome: 7000,
};
