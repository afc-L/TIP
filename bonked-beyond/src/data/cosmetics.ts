// Purely visual unlocks. None of these change gameplay.
export type CosmeticSlot = 'tint' | 'trail' | 'title' | 'theme';

export interface CosmeticDef {
  id: string;
  slot: CosmeticSlot;
  name: string;
  value: string;             // color, trail style, title text or theme accent
  cost?: number;             // buyable with currency
  source?: string;           // challenge id that awards it
}

export const COSMETICS: CosmeticDef[] = [
  { id: 'tint_default', slot: 'tint', name: 'Original', value: '' },
  { id: 'tint_gold', slot: 'tint', name: 'Gilded', value: '#ffd60a', source: 'gold_500' },
  { id: 'tint_arcane', slot: 'tint', name: 'Arcane', value: '#9d4edd', source: 'boss_wizard' },
  { id: 'tint_steel', slot: 'tint', name: 'Steel', value: '#adb5bd', source: 'boss_moose' },
  { id: 'tint_neon', slot: 'tint', name: 'Neon', value: '#39ff14', source: 'level_40' },
  { id: 'tint_crimson', slot: 'tint', name: 'Crimson', value: '#d00000', cost: 300 },
  { id: 'tint_frost', slot: 'tint', name: 'Frostbitten', value: '#a0e7ff', cost: 300 },
  { id: 'tint_shadow', slot: 'tint', name: 'Shadow', value: '#2b2d42', cost: 500 },
  { id: 'trail_none', slot: 'trail', name: 'No trail', value: '' },
  { id: 'trail_dust', slot: 'trail', name: 'Dust Cloud', value: 'dust', cost: 100 },
  { id: 'trail_fire', slot: 'trail', name: 'Blazing', value: 'fire', source: 'survive_10' },
  { id: 'trail_shadow', slot: 'trail', name: 'Shadowstep', value: 'shadow', source: 'elites_100' },
  { id: 'trail_sparkle', slot: 'trail', name: 'Sparkles', value: 'sparkle', source: 'synergy_4' },
  { id: 'trail_rainbow', slot: 'trail', name: 'Rainbow', value: 'rainbow', cost: 800 },
  { id: 'title_none', slot: 'title', name: 'Rookie Bonker', value: 'Rookie Bonker' },
  { id: 'title_evolver', slot: 'title', name: 'Mad Evolutionist', value: 'Mad Evolutionist', source: 'evolve_3' },
  { id: 'title_ironwill', slot: 'title', name: 'Iron Will', value: 'Iron Will', source: 'no_heal_win' },
  { id: 'title_hordeender', slot: 'title', name: 'Horde Ender', value: 'Horde Ender', source: 'kills_10000' },
  { id: 'title_globetrotter', slot: 'title', name: 'Globetrotter', value: 'Globetrotter', source: 'all_maps' },
  { id: 'title_hoarder', slot: 'title', name: 'Coin Hoarder', value: 'Coin Hoarder', cost: 250 },
  { id: 'theme_default', slot: 'theme', name: 'Sunburst', value: '#ffb627' },
  { id: 'theme_mint', slot: 'theme', name: 'Mint', value: '#5ef2b0', source: 'endless_15' },
  { id: 'theme_crimson', slot: 'theme', name: 'Crimson', value: '#ff4d6d', source: 'modifier_win' },
  { id: 'theme_royal', slot: 'theme', name: 'Royal', value: '#9d7bff', source: 'hard_10' },
  { id: 'theme_ocean', slot: 'theme', name: 'Ocean', value: '#4cc9f0', cost: 200 },
];

export const COSMETIC_MAP = Object.fromEntries(COSMETICS.map((c) => [c.id, c])) as Record<string, CosmeticDef>;
export const DEFAULT_COSMETICS: Record<CosmeticSlot, string> = { tint: 'tint_default', trail: 'trail_none', title: 'title_none', theme: 'theme_default' };
