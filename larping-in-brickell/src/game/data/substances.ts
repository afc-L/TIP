// Party substances sold by the shady dealers. Purely in-game effects (visual + gameplay).
export type SubstanceId = 'weed' | 'shrooms' | 'lsd' | 'coke';

export interface SubstanceDef {
  id: SubstanceId;
  name: string;
  icon: string;
  price: number;
  amount: number; // added to the effect level (1 = blackout)
  decay: number; // effect lost per second
  blurb: string;
  effect: string;
  lines: string[];
}

export const SUBSTANCES: SubstanceDef[] = [
  {
    id: 'weed', name: 'Weed', icon: '🌿', price: 60, amount: 0.35, decay: 0.006,
    blurb: '"Exotic." Smells like a Brickell parking garage.',
    effect: 'Hazy green tint, slow walk, zoomed-in vision, the munchies.',
    lines: ['Bro... what if the Maybach bounced... on the moon.', 'Is Salt & Status still open? I need a steak. Or twelve.', 'Everything is so chill. Even the valet.', 'I could really go for a gold-leaf croissant right now.'],
  },
  {
    id: 'shrooms', name: 'Shrooms', icon: '🍄', price: 120, amount: 0.45, decay: 0.005,
    blurb: '"From a guy who knows a guy in Homestead."',
    effect: 'Breathing world, melting colors, slow rolling camera. Steering gets weird.',
    lines: ['The palm trees are waving at me. I wave back.', 'The bay is breathing. Respect the bay.', 'My watch is melting. Worth it.', 'Every building in Brickell is a giant crystal.'],
  },
  {
    id: 'lsd', name: 'LSD', icon: '🌈', price: 150, amount: 0.5, decay: 0.0035,
    blurb: 'A tiny square with a flamingo printed on it.',
    effect: 'Rainbow-cycling colors, warping field of view, heavy wobble. Lasts a long time.',
    lines: ['I can HEAR the neon.', 'The flamingo on the casino just winked at me.', 'Time is a flat circle. Like a roulette wheel.', 'I am the Maybach. The Maybach is me.'],
  },
  {
    id: 'coke', name: 'Cocaine', icon: '❄️', price: 300, amount: 0.4, decay: 0.012,
    blurb: '"Miami Classic." Overpriced, like everything here.',
    effect: 'Sharp contrast, jittery camera, sprint much faster. Short-lived, with a sluggish comedown.',
    lines: ["I've got like nine business ideas right now.", 'WHO WANTS TO SIGN WITH MY AGENCY?!', "I'm not talking fast, you're listening slow.", 'Let me tell you about my podcast. Actually two podcasts.'],
  },
];

export const SUBSTANCE_BY_ID = Object.fromEntries(SUBSTANCES.map((s) => [s.id, s])) as Record<SubstanceId, SubstanceDef>;
