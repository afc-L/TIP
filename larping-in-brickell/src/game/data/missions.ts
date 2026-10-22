import type { GameState } from '../types';
import { CREATOR_BY_ID } from './creators';
import { levelFor } from './catalog';
import { YACHT_BY_ID } from './catalog';

export interface MissionDef {
  id: string;
  title: string;
  desc: string;
  stage: 'Early' | 'Mid' | 'Late' | 'Side';
  target?: string; // POI id for waypoint
  check: (s: GameState) => boolean;
  progress?: (s: GameState) => string;
  reward: { cash: number; clout: number };
}

const st = (s: GameState, k: string) => s.stats[k] || 0;
const signed = (s: GameState) => Object.keys(s.creators).length;
const homeRank = (s: GameState) => (s.properties.includes('penthouse') ? 3 : s.properties.includes('cielo') ? 2 : s.properties.includes('heights') ? 1 : 0);

export const MAIN_MISSIONS: MissionDef[] = [
  { id: 'm_pickup', title: 'Pick Up the Maybach', desc: 'Your Maybach GLS 600 is parked outside The Modest Tower. Walk up and press E to get in.', stage: 'Early', target: 'home_modest', check: (s) => st(s, 'maybachEntered') > 0, reward: { cash: 1000, clout: 10 } },
  { id: 'm_cafe', title: 'Coffee & Clout', desc: 'Drive to Café Clout on Brickell Ave. Creators hang out there.', stage: 'Early', target: 'cafe', check: (s) => st(s, 'visit_cafe') > 0, reward: { cash: 500, clout: 10 } },
  { id: 'm_first', title: 'First Client', desc: 'Talk to Kaylee Brooks at Café Clout (look for the gold diamond) and sign her to your agency.', stage: 'Early', target: 'cafe', check: (s) => signed(s) >= 1, reward: { cash: 5000, clout: 30 } },
  { id: 'm_campaign', title: 'Make It Pop', desc: 'Open your phone (Tab) → AlwaysFans Manager and launch a marketing campaign for your creator.', stage: 'Early', check: (s) => st(s, 'campaigns') >= 1, reward: { cash: 2000, clout: 15 } },
  { id: 'm_bounce', title: 'Hydraulic Lifestyle', desc: 'While driving the Maybach, press B to activate bounce mode. Press V for the Maybach settings panel.', stage: 'Early', check: (s) => st(s, 'bounceActivations') >= 1, reward: { cash: 1500, clout: 15 } },
  { id: 'm_commission', title: 'Business Is Business', desc: 'Earn your first management commission. Commissions are paid out at midnight (sleep at home to skip ahead).', stage: 'Early', target: 'home_modest', check: (s) => st(s, 'commissionDays') >= 1, reward: { cash: 3000, clout: 20 } },
  { id: 'm_valet', title: 'Impress the Valet', desc: 'Drive to a venue with valet (Salt & Status, Sky Lounge 88, VOLT, Aurum Tower) and stop slowly in the valet zone.', stage: 'Early', target: 'restaurant', check: (s) => st(s, 'valetFlex') >= 1, reward: { cash: 2500, clout: 20 } },
  { id: 'm_bounceoff', title: 'Brickell Bounce-Off', desc: 'Take the Maybach to the Underpass Car Meet and win the Bounce-Off (score 60+).', stage: 'Mid', target: 'carmeet', check: (s) => st(s, 'bounceOffWins') >= 1, reward: { cash: 6000, clout: 30 } },
  { id: 'm_dealer', title: 'Window Shopping', desc: 'Visit Brickell Prestige Motors and dream a little.', stage: 'Mid', target: 'dealer', check: (s) => st(s, 'visit_dealer') > 0, reward: { cash: 1000, clout: 10 } },
  { id: 'm_mixer', title: 'Networking 101', desc: 'Attend the Creator Networking Mixer at The Hustle Hub.', stage: 'Mid', target: 'network', check: (s) => (s.eventsDone['mixer'] ?? 0) > 0, reward: { cash: 4000, clout: 20 } },
  { id: 'm_roster3', title: 'Grow the Roster', desc: 'Sign three creators.', stage: 'Mid', check: (s) => signed(s) >= 3, progress: (s) => `${signed(s)}/3 signed`, reward: { cash: 12000, clout: 50 } },
  { id: 'm_office', title: 'Suite 404: Found', desc: 'Buy the Suite 404 Office (Phone → Properties) to unlock staff and agency upgrades.', stage: 'Mid', target: 'agency', check: (s) => s.properties.includes('office'), reward: { cash: 5000, clout: 30 } },
  { id: 'm_staff', title: 'Hire Help', desc: 'Hire your first staff member from AlwaysFans Manager → Agency.', stage: 'Mid', check: (s) => Object.values(s.staff).some((n) => n > 0), reward: { cash: 4000, clout: 20 } },
  { id: 'm_watch', title: 'First Real Flex', desc: "Buy a watch at Tempo d'Oro.", stage: 'Mid', target: 'watch', check: (s) => s.watches.length >= 1, reward: { cash: 0, clout: 15 } },
  { id: 'm_home', title: 'Upgrade Your Address', desc: 'Buy a better home than the studio (Phone → Properties).', stage: 'Mid', check: (s) => homeRank(s) >= 1, reward: { cash: 10000, clout: 30 } },
  { id: 'm_highpot', title: 'High-Potential Talent', desc: 'Sign an Established-tier creator or better (popularity 7+).', stage: 'Mid', check: (s) => Object.keys(s.creators).some((id) => (CREATOR_BY_ID[id]?.popularity ?? 0) >= 7), reward: { cash: 25000, clout: 60 } },
  { id: 'm_chase', title: 'Beat Chase Valentino', desc: 'Win the agency showdown against Chase Valentino (Events app).', stage: 'Mid', target: 'cafe', check: (s) => !!s.rivals.chase?.defeated, reward: { cash: 20000, clout: 50 } },
  { id: 'm_garage', title: 'Garage Goals', desc: 'Buy a second vehicle at Brickell Prestige Motors.', stage: 'Mid', target: 'dealer', check: (s) => s.vehicles.length >= 2, reward: { cash: 10000, clout: 30 } },
  { id: 'm_hq', title: 'Headquarters', desc: 'Buy the Brickell Agency HQ.', stage: 'Late', target: 'hq', check: (s) => s.properties.includes('hq'), reward: { cash: 50000, clout: 100 } },
  { id: 'm_club', title: 'Nightlife Owner', desc: 'Buy VOLT Nightclub.', stage: 'Late', target: 'club', check: (s) => s.properties.includes('club'), reward: { cash: 50000, clout: 100 } },
  { id: 'm_clubnight', title: 'Host the Night', desc: 'Host a successful event at VOLT (walk inside and use the club office, or the Properties app).', stage: 'Late', target: 'club', check: (s) => st(s, 'clubSuccess') >= 1, reward: { cash: 40000, clout: 80 } },
  { id: 'm_brielle', title: 'Out-Class Brielle', desc: 'Defeat Brielle Monroe in an agency showdown.', stage: 'Late', target: 'restaurant', check: (s) => !!s.rivals.brielle?.defeated, reward: { cash: 60000, clout: 100 } },
  { id: 'm_celeb', title: 'Celebrity Signing', desc: 'Sign a Celebrity-tier creator.', stage: 'Late', check: (s) => Object.keys(s.creators).some((id) => CREATOR_BY_ID[id]?.tier === 'Celebrity'), reward: { cash: 100000, clout: 150 } },
  { id: 'm_penthouse', title: 'Penthouse Living', desc: 'Buy the Aurum Tower Penthouse.', stage: 'Late', target: 'penthouse', check: (s) => s.properties.includes('penthouse'), reward: { cash: 100000, clout: 150 } },
  { id: 'm_yacht', title: 'Marina Life', desc: 'Buy a marina slip and your first yacht at Bayside Marina.', stage: 'Late', target: 'marina', check: (s) => !!s.yacht, reward: { cash: 50000, clout: 100 } },
  { id: 'm_dmitri', title: 'Dethrone Drip', desc: "Defeat Dmitri 'Drip' Kovac in the final showdown.", stage: 'Late', target: 'marina', check: (s) => !!s.rivals.dmitri?.defeated, reward: { cash: 250000, clout: 250 } },
  { id: 'm_superyacht', title: 'Captain of Clout', desc: 'Buy the Leviathan Gold 180 superyacht.', stage: 'Late', target: 'marina', check: (s) => !!s.yacht && (YACHT_BY_ID[s.yacht]?.rank ?? 0) >= 3, reward: { cash: 0, clout: 400 } },
  { id: 'm_king', title: 'King of Brickell', desc: 'Reach the King of Brickell clout level with an agency, a nightclub, a garage of cars and the superyacht. Then throw the party of the decade at the marina.', stage: 'Late', target: 'marina', check: (s) => s.endgameCelebrated, reward: { cash: 1000000, clout: 500 } },
];

export const SIDE_MISSIONS: MissionDef[] = [
  { id: 's_valettour', title: 'Valet Tour', desc: 'Impress the valet at all four valet venues.', stage: 'Side', check: (s) => Object.keys(s.valetDone).length >= 4, progress: (s) => `${Object.keys(s.valetDone).length}/4 venues`, reward: { cash: 15000, clout: 40 } },
  { id: 's_drip', title: 'Drip Check', desc: 'Buy a new outfit at Drip District.', stage: 'Side', target: 'clothes', check: (s) => s.outfits.length >= 2, reward: { cash: 2000, clout: 10 } },
  { id: 's_speed', title: 'Speed Trap', desc: 'Hit 150 km/h anywhere in the city (carefully).', stage: 'Side', check: (s) => st(s, 'maxSpeed') >= 150, reward: { cash: 3000, clout: 10 } },
  { id: 's_sunset', title: 'Gram the Sunset', desc: 'Be at Bayside Marina between 18:00 and 20:00.', stage: 'Side', target: 'marina', check: (s) => st(s, 'sunsetMarina') > 0, reward: { cash: 2500, clout: 15 } },
  { id: 's_showoff', title: 'Miami Showoff', desc: 'Score 70+ in the Miami Showoff challenge at the Bayfront Promenade.', stage: 'Side', target: 'showoff', check: (s) => st(s, 'showoffWins') > 0, reward: { cash: 8000, clout: 30 } },
  { id: 's_contacts', title: 'Social Butterfly', desc: 'Meet all four business contacts around Brickell.', stage: 'Side', check: (s) => ['marco', 'gloria', 'palmetto', 'yuki'].every((c) => s.contacts.includes(c)), progress: (s) => `${['marco', 'gloria', 'palmetto', 'yuki'].filter((c) => s.contacts.includes(c)).length}/4 met`, reward: { cash: 6000, clout: 25 } },
  { id: 's_watches', title: 'Watch Collector', desc: 'Own three watches.', stage: 'Side', target: 'watch', check: (s) => s.watches.length >= 3, progress: (s) => `${s.watches.length}/3 watches`, reward: { cash: 10000, clout: 40 } },
  { id: 's_custom', title: 'Make It Yours', desc: 'Buy any customization for a vehicle (Phone → Vehicles, or the garage).', stage: 'Side', check: (s) => st(s, 'modsBought') > 0, reward: { cash: 3000, clout: 10 } },
  { id: 's_bounceall', title: 'Suspension Specialist', desc: 'Activate all three bounce styles at least once.', stage: 'Side', check: (s) => st(s, 'style_executive') > 0 && st(s, 'style_brickell') > 0 && st(s, 'style_miami') > 0, reward: { cash: 4000, clout: 20 } },
];

export const ALL_MISSIONS = [...MAIN_MISSIONS, ...SIDE_MISSIONS];
export const MISSION_BY_ID = Object.fromEntries(ALL_MISSIONS.map((m) => [m.id, m]));

export function endgameReady(s: GameState) {
  return (
    levelFor(s.clout) >= 7 &&
    !!s.yacht && (YACHT_BY_ID[s.yacht]?.rank ?? 0) >= 3 &&
    s.properties.includes('club') &&
    (s.properties.includes('hq') || s.properties.includes('office')) &&
    s.vehicles.length >= 3
  );
}

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  reward: { cash: number; clout: number };
  check: (s: GameState) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'a_flex', name: 'First Flex', desc: 'Drive the Maybach for the first time.', reward: { cash: 500, clout: 5 }, check: (s) => st(s, 'maybachDriven') > 0 },
  { id: 'a_client', name: 'First Client', desc: 'Recruit your first adult creator.', reward: { cash: 1000, clout: 10 }, check: (s) => signed(s) >= 1 },
  { id: 'a_business', name: 'Business Is Business', desc: 'Earn your first management commission.', reward: { cash: 1000, clout: 10 }, check: (s) => st(s, 'commissionDays') > 0 },
  { id: 'a_regular', name: 'Brickell Regular', desc: 'Reach the Brickell Regular clout level.', reward: { cash: 5000, clout: 0 }, check: (s) => levelFor(s.clout) >= 2 },
  { id: 'a_hydraulic', name: 'Hydraulic Lifestyle', desc: 'Activate Maybach bounce mode.', reward: { cash: 500, clout: 5 }, check: (s) => st(s, 'bounceActivations') > 0 },
  { id: 'a_suspension', name: 'Suspension Specialist', desc: 'Complete a bounce challenge.', reward: { cash: 3000, clout: 15 }, check: (s) => st(s, 'bounceOffWins') + st(s, 'showoffWins') > 0 },
  { id: 'a_watch', name: 'Watch Collector', desc: 'Purchase three luxury watches.', reward: { cash: 5000, clout: 20 }, check: (s) => s.watches.length >= 3 },
  { id: 'a_garage', name: 'Garage Goals', desc: 'Own three vehicles.', reward: { cash: 10000, clout: 25 }, check: (s) => s.vehicles.length >= 3 },
  { id: 'a_ceo', name: 'Agency CEO', desc: 'Earn $50,000 in commission in a single day.', reward: { cash: 25000, clout: 50 }, check: (s) => st(s, 'bestDay') >= 50000 },
  { id: 'a_night', name: 'Nightlife Owner', desc: 'Purchase a nightclub.', reward: { cash: 10000, clout: 30 }, check: (s) => s.properties.includes('club') },
  { id: 'a_penthouse', name: 'Penthouse Living', desc: 'Purchase a luxury penthouse.', reward: { cash: 10000, clout: 30 }, check: (s) => s.properties.includes('penthouse') },
  { id: 'a_captain', name: 'Captain of Clout', desc: 'Purchase a yacht.', reward: { cash: 10000, clout: 30 }, check: (s) => !!s.yacht },
  { id: 'a_valet', name: 'Valet Royalty', desc: 'Be greeted by name by a valet.', reward: { cash: 2000, clout: 10 }, check: (s) => st(s, 'valetNamed') > 0 },
  { id: 'a_roster', name: 'Full House', desc: 'Sign eight creators.', reward: { cash: 50000, clout: 60 }, check: (s) => signed(s) >= 8 },
  { id: 'a_rivals', name: 'Undisputed', desc: 'Defeat all three rival managers.', reward: { cash: 100000, clout: 100 }, check: (s) => ['chase', 'brielle', 'dmitri'].every((r) => s.rivals[r]?.defeated) },
  { id: 'a_millionaire', name: 'Actually Rich', desc: 'Have $1,000,000 in cash at once.', reward: { cash: 0, clout: 50 }, check: (s) => s.cash >= 1_000_000 },
  { id: 'a_bigNight', name: 'Big Night Out', desc: 'Get properly drunk at VOLT. Do not drive.', reward: { cash: 0, clout: 15 }, check: (s) => st(s, 'wastedAtVolt') > 0 },
  { id: 'a_king', name: 'King of Brickell', desc: 'Reach the highest clout level and complete the endgame.', reward: { cash: 0, clout: 0 }, check: (s) => s.endgameCelebrated },
];
