// Shop catalogs: watches, outfits, properties, business upgrades, staff, campaigns, club upgrades, yachts.

export interface WatchDef {
  id: string;
  name: string;
  brand: string;
  style: string;
  price: number;
  clout: number;
  minLevel: number;
  caseColor: string;
  dialColor: string;
  strapColor: string;
  diamonds: boolean;
  blurb: string;
}

export const WATCHES: WatchDef[] = [
  { id: 'classique', name: 'Lumière Classique', brand: 'Maison Ferrand', style: 'Dress watch', price: 8500, clout: 8, minLevel: 0, caseColor: '#d9d9d9', dialColor: '#f6f2e8', strapColor: '#2b1a10', diamonds: false, blurb: 'Says "I have a meeting" even when you do not.' },
  { id: 'abyss', name: 'Abyss Diver 300', brand: 'Nautilon', style: 'Sport watch', price: 14000, clout: 12, minLevel: 0, caseColor: '#c8ccd2', dialColor: '#0b2a5a', strapColor: '#c8ccd2', diamonds: false, blurb: 'Water resistant to 300m. You will use it in a pool once.' },
  { id: 'chrono', name: 'Brickell Chronograph', brand: 'Atelier Vasco', style: 'Sport chronograph', price: 32000, clout: 25, minLevel: 1, caseColor: '#1a1a1a', dialColor: '#d4af6a', strapColor: '#111', diamonds: false, blurb: 'Three sub-dials for timing three different excuses.' },
  { id: 'nautico', name: 'Oro Nautico', brand: 'Nautilon', style: 'Gold sport watch', price: 68000, clout: 45, minLevel: 2, caseColor: '#d4af37', dialColor: '#1f3d2b', strapColor: '#d4af37', diamonds: false, blurb: 'Solid gold. Waitlisted. You "know a guy".' },
  { id: 'meridian', name: 'Iced Meridian', brand: 'Gemma & Fils', style: 'Diamond statement', price: 125000, clout: 80, minLevel: 3, caseColor: '#e8e8f0', dialColor: '#e8f4ff', strapColor: '#e8e8f0', diamonds: true, blurb: 'So much ice the valet needs sunglasses.' },
  { id: 'souverain', name: 'Tourbillon Souverain', brand: 'Maison Ferrand', style: 'Limited collector', price: 420000, clout: 160, minLevel: 4, caseColor: '#b76e79', dialColor: '#151515', strapColor: '#3a0d14', diamonds: false, blurb: 'Limited to 25 pieces. You are number 24. Someone is number 25.' },
  { id: 'celestia', name: 'Celestia Grande Complication', brand: 'Atelier Vasco', style: 'Prestige piece', price: 1800000, clout: 320, minLevel: 6, caseColor: '#e5e4e2', dialColor: '#0a1a3a', strapColor: '#0a1a3a', diamonds: true, blurb: 'Shows moon phase, star chart and how much you spent.' },
  { id: 'eternite', name: 'Éternité 1/1', brand: 'Gemma & Fils', style: 'One-of-one prestige', price: 6500000, clout: 600, minLevel: 7, caseColor: '#d4af37', dialColor: '#ffffff', strapColor: '#d4af37', diamonds: true, blurb: 'A unique piece. Insurance costs more than most cars.' },
];
export const WATCH_BY_ID = Object.fromEntries(WATCHES.map((w) => [w.id, w]));

export interface OutfitDef {
  id: string;
  name: string;
  price: number;
  clout: number;
  minLevel: number;
  top: string;
  bottom: string;
  shoes: string;
  accent: string;
  blurb: string;
}

export const OUTFITS: OutfitDef[] = [
  { id: 'starter', name: 'Starter Polo', price: 0, clout: 0, minLevel: 0, top: '#2f5d8a', bottom: '#d8cfbd', shoes: '#f0f0f0', accent: '#ffffff', blurb: 'Business casual from the outlet mall.' },
  { id: 'linen', name: 'Miami Linen Set', price: 3500, clout: 6, minLevel: 0, top: '#f4efe4', bottom: '#f4efe4', shoes: '#c8a77a', accent: '#d4af6a', blurb: 'Breathable. Wrinkled on purpose.' },
  { id: 'track', name: 'Designer Track Suit', price: 9000, clout: 12, minLevel: 1, top: '#111111', bottom: '#111111', shoes: '#ffffff', accent: '#d4af6a', blurb: 'For "working out" in the lobby.' },
  { id: 'yacht', name: 'All-White Yacht Fit', price: 22000, clout: 25, minLevel: 3, top: '#ffffff', bottom: '#ffffff', shoes: '#ffffff', accent: '#1e3a8a', blurb: 'Impossible to wear near ketchup.' },
  { id: 'velvet', name: 'Velvet Club Blazer', price: 48000, clout: 40, minLevel: 4, top: '#4b0f2e', bottom: '#111111', shoes: '#111111', accent: '#d4af37', blurb: 'Smells like VIP section.' },
  { id: 'king', name: 'King of Brickell Suit', price: 250000, clout: 120, minLevel: 6, top: '#d4af37', bottom: '#111111', shoes: '#d4af37', accent: '#ffffff', blurb: 'Gold thread. Gold buttons. Gold audacity.' },
];
export const OUTFIT_BY_ID = Object.fromEntries(OUTFITS.map((o) => [o.id, o]));

export type PropertyType = 'home' | 'office' | 'club' | 'marina' | 'yacht';

export interface PropertyDef {
  id: string;
  name: string;
  type: PropertyType;
  price: number;
  upkeep: number; // per month
  minLevel: number;
  clout: number;
  homeRank?: number; // higher home = better
  requires?: string;
  poi?: string;
  blurb: string;
  benefits: string[];
}

export const PROPERTIES: PropertyDef[] = [
  { id: 'studio', name: 'Studio at The Modest Tower', type: 'home', price: 0, upkeep: 2800, minLevel: 0, clout: 0, homeRank: 0, poi: 'home_modest', blurb: 'The bed folds into the wall. So does your dignity.', benefits: ['Sleep & save', 'Change outfits'] },
  { id: 'heights', name: '1BR at Brickell Heights', type: 'home', price: 160000, upkeep: 4200, minLevel: 1, clout: 25, homeRank: 1, blurb: 'Gym, pool, and a doorman who knows your name (wrongly).', benefits: ['+25 clout', 'Lifestyle credibility (+5 recruit interest)'] },
  { id: 'cielo', name: 'High-Rise Condo at Cielo', type: 'home', price: 680000, upkeep: 9500, minLevel: 3, clout: 70, homeRank: 2, blurb: '42nd floor. Bay views. Elevator music in 4K.', benefits: ['+70 clout', '+10 recruit interest', 'Creator satisfaction +2/day'] },
  { id: 'penthouse', name: 'Aurum Tower Penthouse', type: 'home', price: 4800000, upkeep: 38000, minLevel: 6, clout: 300, homeRank: 3, poi: 'penthouse', blurb: 'The top of the tallest tower in Brickell. Walk-in everything.', benefits: ['+300 clout', '+20 recruit interest', 'Walkable penthouse', 'Penthouse parties'] },
  { id: 'office', name: 'Suite 404 Office', type: 'office', price: 55000, upkeep: 3500, minLevel: 1, clout: 20, poi: 'agency', blurb: 'Suite 404: agency not found. Until now.', benefits: ['Unlocks staff hiring', 'Unlocks agency upgrades', '+5% creator revenue'] },
  { id: 'hq', name: 'Brickell Agency HQ', type: 'office', price: 2600000, upkeep: 26000, minLevel: 5, clout: 220, poi: 'hq', requires: 'office', blurb: 'Glass lobby, branded elevator, kombucha on tap.', benefits: ['+15% creator revenue', '+10% growth', 'Double staff capacity', 'Marketing launch events'] },
  { id: 'club', name: 'VOLT Nightclub', type: 'club', price: 3200000, upkeep: 42000, minLevel: 5, clout: 250, poi: 'club', blurb: 'Bass you can feel in your bank account.', benefits: ['Nightly revenue', 'Host club events', 'Walkable interior', '+250 clout'] },
  { id: 'slip', name: 'Bayside Marina Slip', type: 'marina', price: 240000, upkeep: 5000, minLevel: 4, clout: 40, poi: 'marina', blurb: 'A parking spot. For a boat. For $240k.', benefits: ['Required to own a yacht', '+40 clout'] },
];
export const PROPERTY_BY_ID = Object.fromEntries(PROPERTIES.map((p) => [p.id, p]));

export interface YachtDef {
  id: string;
  name: string;
  length: number; // meters (model scale)
  price: number;
  upkeep: number;
  minLevel: number;
  clout: number;
  speed: number;
  rank: number;
  blurb: string;
}
export const YACHTS: YachtDef[] = [
  { id: 'runner', name: 'Bay Runner 42', length: 14, price: 950000, upkeep: 16000, minLevel: 4, clout: 120, speed: 22, rank: 1, blurb: 'Small, fast, technically a yacht.' },
  { id: 'azure', name: 'Azure Majesty 88', length: 27, price: 5200000, upkeep: 80000, minLevel: 6, clout: 400, speed: 18, rank: 2, blurb: 'Four cabins, jacuzzi, a captain named Captain.' },
  { id: 'leviathan', name: 'Leviathan Gold 180', length: 52, price: 18500000, upkeep: 240000, minLevel: 7, clout: 1200, speed: 15, rank: 3, blurb: 'The superyacht. Helipad. Beach club. Its own zip code.' },
];
export const YACHT_BY_ID = Object.fromEntries(YACHTS.map((y) => [y.id, y]));

export interface CampaignDef {
  id: string;
  name: string;
  cost: number;
  days: number;
  growth: number; // extra daily growth (solid outcome)
  oneShot?: 'audience' | 'popularity' | 'cash';
  oneShotValue?: number;
  odds: { flop: number; solid: number; viral: number };
  minLevel: number;
  roster?: boolean; // applies to entire roster
  clout: number;
  blurb: string;
}

export const CAMPAIGNS: CampaignDef[] = [
  { id: 'social', name: 'Social Media Promotion', cost: 2500, days: 3, growth: 0.015, odds: { flop: 0.15, solid: 0.7, viral: 0.15 }, minLevel: 0, clout: 3, blurb: 'Reels, stories, and a suspicious number of fire emojis.' },
  { id: 'photo', name: 'Professional Photoshoot', cost: 6000, days: 1, growth: 0, oneShot: 'popularity', oneShotValue: 0.6, odds: { flop: 0.1, solid: 0.75, viral: 0.15 }, minLevel: 0, clout: 4, blurb: 'Golden hour in Wynwood. Raises popularity (revenue per fan).' },
  { id: 'collab', name: 'Influencer Collaboration', cost: 9000, days: 4, growth: 0.03, odds: { flop: 0.25, solid: 0.55, viral: 0.2 }, minLevel: 1, clout: 6, blurb: 'Two creators, one blender, infinite engagement.' },
  { id: 'event', name: 'Event Appearance', cost: 12000, days: 1, growth: 0, oneShot: 'audience', oneShotValue: 0.08, odds: { flop: 0.2, solid: 0.6, viral: 0.2 }, minLevel: 2, clout: 10, blurb: 'A paid appearance at a launch party. Instant audience bump.' },
  { id: 'brand', name: 'Brand Partnership', cost: 15000, days: 1, growth: 0, oneShot: 'cash', oneShotValue: 2.2, odds: { flop: 0.25, solid: 0.55, viral: 0.2 }, minLevel: 2, clout: 8, blurb: 'Energy drink sponsorship. Pays out a bonus (multiplier of cost).' },
  { id: 'ads', name: 'Paid Advertising Push', cost: 25000, days: 5, growth: 0.04, odds: { flop: 0.2, solid: 0.6, viral: 0.2 }, minLevel: 3, clout: 10, blurb: 'Targeted ads to people who definitely wanted this.' },
  { id: 'blitz', name: 'Roster Growth Blitz', cost: 90000, days: 6, growth: 0.035, roster: true, odds: { flop: 0.15, solid: 0.6, viral: 0.25 }, minLevel: 5, clout: 30, blurb: 'Agency-wide campaign. Boosts every signed creator.' },
];
export const CAMPAIGN_BY_ID = Object.fromEntries(CAMPAIGNS.map((c) => [c.id, c]));

export interface UpgradeDef {
  id: string;
  name: string;
  price: number;
  minLevel: number;
  requires?: string; // property id
  blurb: string;
  effect: { growth?: number; revenue?: number; interest?: number; satisfaction?: number; odds?: number; opsDiscount?: number; autoRenew?: boolean };
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'ringlights', name: 'Ring Light Bundle', price: 4000, minLevel: 0, blurb: 'Better marketing equipment. +5% growth.', effect: { growth: 0.05 } },
  { id: 'analytics', name: 'Analytics Suite', price: 22000, minLevel: 1, requires: 'office', blurb: 'Improved analytics. Campaign viral odds +10%.', effect: { odds: 0.1 } },
  { id: 'studio', name: 'Professional Studio Space', price: 45000, minLevel: 2, requires: 'office', blurb: '+10% revenue, +5 satisfaction.', effect: { revenue: 0.1, satisfaction: 5 } },
  { id: 'concierge', name: 'Client Concierge', price: 60000, minLevel: 3, requires: 'office', blurb: 'Better client services. +1 satisfaction per day.', effect: { satisfaction: 1 } },
  { id: 'networking', name: 'Premium Networking Access', price: 80000, minLevel: 3, blurb: '+12 recruit interest at every pitch.', effect: { interest: 12 } },
  { id: 'automation', name: 'HustleBot 9000 Automation', price: 150000, minLevel: 4, requires: 'office', blurb: 'Auto-renews expiring contracts. -15% agency ops.', effect: { autoRenew: true, opsDiscount: 0.15 } },
  { id: 'contenthouse', name: 'Content House', price: 400000, minLevel: 5, requires: 'office', blurb: '+20% growth, +10% revenue.', effect: { growth: 0.2, revenue: 0.1 } },
];
export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

export interface StaffDef {
  id: string;
  name: string;
  salary: number; // per month
  hireFee: number;
  max: number;
  blurb: string;
}

export const STAFF: StaffDef[] = [
  { id: 'marketing', name: 'Marketing Specialist', salary: 9000, hireFee: 3000, max: 3, blurb: '+8% creator growth each.' },
  { id: 'account', name: 'Account Manager', salary: 7500, hireFee: 2500, max: 4, blurb: 'Handles 4 creators each. Without enough, satisfaction drops.' },
  { id: 'photographer', name: 'Photographer', salary: 6500, hireFee: 2000, max: 2, blurb: '+5% revenue each. Photoshoots never flop.' },
  { id: 'events', name: 'Event Coordinator', salary: 9500, hireFee: 3500, max: 2, blurb: '+20% event & club scores each.' },
  { id: 'assistant', name: 'Business Assistant', salary: 5000, hireFee: 1500, max: 2, blurb: '-8% recurring expenses each (they find the coupons).' },
];
export const STAFF_BY_ID = Object.fromEntries(STAFF.map((s) => [s.id, s]));

export interface ClubUpgradeDef {
  id: string;
  name: string;
  price: number;
  upkeep: number;
  attendance: number;
  blurb: string;
}
export const CLUB_UPGRADES: ClubUpgradeDef[] = [
  { id: 'sound', name: 'Line-Array Sound System', price: 180000, upkeep: 3000, attendance: 0.15, blurb: 'Bass so deep it has a podcast.' },
  { id: 'lights', name: 'Laser & LED Lighting Rig', price: 140000, upkeep: 2500, attendance: 0.12, blurb: 'Lights that sync to the beat and your heart rate.' },
  { id: 'vip', name: 'VIP Mezzanine', price: 350000, upkeep: 6000, attendance: 0.1, blurb: 'Bottle service with sparklers and attitude.' },
  { id: 'security', name: 'Professional Security Team', price: 90000, upkeep: 8000, attendance: 0.06, blurb: 'Large men in small earpieces.' },
  { id: 'dj', name: 'Resident Celebrity DJ', price: 250000, upkeep: 15000, attendance: 0.2, blurb: 'DJ Palmetto, three-time "Best DJ" (self-awarded).' },
  { id: 'bar', name: 'Premium Bar Program', price: 120000, upkeep: 4000, attendance: 0.08, blurb: 'Cocktails served with smoke and a story.' },
];
export const CLUB_UPGRADE_BY_ID = Object.fromEntries(CLUB_UPGRADES.map((u) => [u.id, u]));

export const CLUB_THEMES = [
  { id: 'neon', name: 'Neon Night', cost: 20000, appeal: 1.0, blurb: 'Classic VOLT. Glow sticks included.' },
  { id: 'white', name: 'All-White Party', cost: 45000, appeal: 1.15, blurb: 'Everyone in white. No red wine allowed.' },
  { id: 'creator', name: 'Creator Mixer', cost: 35000, appeal: 1.05, blurb: 'Boosts your roster satisfaction & recruiting.' },
  { id: 'roast', name: 'Rival Roast Night', cost: 60000, appeal: 1.25, blurb: 'Comedians roast rival managers. Risky. Hilarious.' },
];

// Clout levels
export const CLOUT_LEVELS = [
  { name: 'Unknown', min: 0, perk: 'Everyone starts somewhere. Usually in a rented studio.' },
  { name: 'Local LARPer', min: 60, perk: 'Rising creators take your meetings. Office rentals unlocked.' },
  { name: 'Brickell Regular', min: 180, perk: 'Valets remember your car. Rooftop gatherings & networking upgrades.' },
  { name: 'Luxury Lifestyle Influencer', min: 420, perk: 'Established creators, condo towers, collector watches.' },
  { name: 'Miami Connector', min: 900, perk: 'Famous creators, business dinners, marina slips & yachts.' },
  { name: 'Brickell Big Shot', min: 1800, perk: 'Celebrity creators, nightclub & HQ purchases, supercars.' },
  { name: 'Miami Elite', min: 3500, perk: 'Penthouse, hypercars, prestige watches, superstar meetings.' },
  { name: 'King of Brickell', min: 6500, perk: 'The superyacht, the throne, the bounce.' },
];

export function levelFor(clout: number) {
  let l = 0;
  for (let i = 0; i < CLOUT_LEVELS.length; i++) if (clout >= CLOUT_LEVELS[i].min) l = i;
  return l;
}

export const MONTH_DAYS = 7;
export const START_CASH = 25000;
