// Recruitment math. Everything is transparent: the UI shows the interest meter
// and the acceptance likelihood before any offer is made.
import type { GameState } from '../types';
import type { CreatorDef, Preference } from '../data/creators';
import { levelFor } from '../data/catalog';
import { interestBonus } from './economy';

export function canMeet(s: GameState, def: CreatorDef) {
  return levelFor(s.clout) >= def.minLevel;
}

export function baseInterest(s: GameState, def: CreatorDef) {
  const lvl = levelFor(s.clout);
  const signed = Object.keys(s.creators).length;
  let i = 22 + lvl * 5 + Math.min(18, signed * 3) + interestBonus(s);
  if (lvl >= def.minLevel + 2) i += 8;
  if (s.equippedWatch && def.preference === 'prestige') i += 4;
  return Math.max(5, Math.min(80, i));
}

export interface PitchOption {
  id: string;
  label: string;
  effect: (s: GameState, def: CreatorDef) => { delta: number; line: string };
}

const prefBonus = (def: CreatorDef, p: Preference, n: number) => (def.preference === p ? n : 0);

export const PITCHES: PitchOption[] = [
  {
    id: 'intro',
    label: 'Introduce yourself professionally',
    effect: (_s, def) => ({
      delta: 9 + prefBonus(def, 'respect', 7),
      line: def.preference === 'respect' ? 'They visibly relax. "Finally, someone who introduces themselves properly."' : 'They nod. "Nice to meet you."',
    }),
  },
  {
    id: 'services',
    label: "Explain the agency's services",
    effect: (s, def) => {
      const extras = s.upgrades.length * 2 + (s.properties.includes('office') ? 4 : 0) + Object.values(s.staff).reduce((a, b) => a + b, 0) * 2;
      return {
        delta: 6 + Math.min(14, extras) + prefBonus(def, 'growth', 6),
        line: extras > 6 ? 'You walk them through campaigns, staff and analytics. They take notes.' : 'You explain campaigns and contract transparency. It is a short list, but it is honest.',
      };
    },
  },
  {
    id: 'success',
    label: "Show the agency's existing success",
    effect: (s, def) => {
      const signed = Object.keys(s.creators).length;
      if (signed === 0) return { delta: -4, line: 'You open the dashboard. It is an empty spreadsheet. They politely look away.' };
      const daily = Object.values(s.creators).reduce((a, c) => a + c.lastDayCommission, 0);
      const d = Math.min(24, 4 + signed * 3 + Math.floor(Math.log10(daily + 1) * 2)) + prefBonus(def, 'money', 4);
      return { delta: d, line: `You show the roster: ${signed} creator${signed > 1 ? 's' : ''}, all growing. "Okay, that's real."` };
    },
  },
  {
    id: 'invite',
    label: 'Invite them to a networking event',
    effect: (s, def) => {
      const venue = s.yacht ? 'a yacht party' : s.properties.includes('club') ? 'VIP night at VOLT' : 'the next Hustle Hub mixer';
      const bonus = s.yacht ? 10 : s.properties.includes('club') ? 7 : 0;
      return { delta: 5 + bonus + prefBonus(def, 'prestige', 7), line: `You invite them to ${venue}. "${bonus > 0 ? 'Wait, really? I am in.' : 'Sure, maybe.'}"` };
    },
  },
  {
    id: 'flex',
    label: 'Casually flex the car keys',
    effect: (_s, def) => {
      if (def.preference === 'prestige') return { delta: 6, line: `"${def.lines.flex}"` };
      if (def.preference === 'respect') return { delta: -6, line: `"${def.lines.flex}"` };
      return { delta: 1, line: `"${def.lines.flex}"` };
    },
  },
];

export function acceptChance(
  s: GameState,
  def: CreatorDef,
  interest: number,
  commission: number,
  months: number,
  stipend: boolean,
) {
  const fair = def.maxCommission;
  const over = commission - fair;
  let p = interest / 100 + 0.12;
  if (over > 0) p -= over * 4.5;
  else p += Math.min(0.18, -over * 1.4);
  if (stipend) p += def.preference === 'growth' ? 0.12 : 0.06;
  if (months >= 12 && (def.preference === 'prestige' || def.preference === 'growth')) p += 0.05;
  if (months <= 3 && def.preference === 'money') p += 0.05;
  if (months >= 12 && def.preference === 'money') p -= 0.05;
  if (Object.keys(s.creators).length === 0 && def.minLevel === 0) p += 0.1; // first client is forgiving
  return Math.max(0.03, Math.min(0.97, p));
}
