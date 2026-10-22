// Economy rules: modifiers, daily creator revenue, monthly expense bills.
import type { GameState, MonthReport, SignedCreator } from '../types';
import { ARPU, CREATOR_BY_ID } from '../data/creators';
import {
  CAMPAIGN_BY_ID, CLUB_UPGRADE_BY_ID, CLOUT_LEVELS, MONTH_DAYS, PROPERTY_BY_ID, STAFF, UPGRADE_BY_ID, YACHT_BY_ID, levelFor,
} from '../data/catalog';
import { VEHICLE_BY_ID } from '../data/vehicles';

export const STIPEND_COST = 2500; // per creator per month
export const STIPEND_GROWTH = 0.008;

export function staffCount(s: GameState, id: string) {
  return s.staff[id] || 0;
}

export function growthMult(s: GameState) {
  let m = 1;
  for (const u of s.upgrades) m += UPGRADE_BY_ID[u]?.effect.growth ?? 0;
  m += staffCount(s, 'marketing') * 0.08;
  if (s.properties.includes('hq')) m += 0.1;
  return m;
}

export function revenueMult(s: GameState) {
  let m = 1;
  for (const u of s.upgrades) m += UPGRADE_BY_ID[u]?.effect.revenue ?? 0;
  m += staffCount(s, 'photographer') * 0.05;
  if (s.properties.includes('office')) m += 0.05;
  if (s.properties.includes('hq')) m += 0.15;
  return m;
}

export function interestBonus(s: GameState) {
  let b = 0;
  for (const u of s.upgrades) b += UPGRADE_BY_ID[u]?.effect.interest ?? 0;
  if (s.properties.includes('heights')) b += 5;
  if (s.properties.includes('cielo')) b += 10;
  if (s.properties.includes('penthouse')) b += 20;
  return b;
}

export function oddsBonus(s: GameState) {
  let b = 0;
  for (const u of s.upgrades) b += UPGRADE_BY_ID[u]?.effect.odds ?? 0;
  return b;
}

export function accountCapacity(s: GameState) {
  return 3 + staffCount(s, 'account') * 4 * (s.properties.includes('hq') ? 1.5 : 1);
}

export function staffCap(s: GameState, base: number) {
  if (!s.properties.includes('office')) return 0;
  return s.properties.includes('hq') ? base * 2 : base;
}

export function popFactor(pop: number) {
  return 0.6 + pop * 0.08;
}

export function campaignGrowth(s: GameState, creatorId: string) {
  let g = 0;
  for (const c of s.campaigns) {
    if (c.creatorId === creatorId || c.creatorId === null) g += c.growthBonus;
  }
  return g;
}

export function creatorDailyGross(s: GameState, c: SignedCreator) {
  const sat = 0.75 + c.satisfaction / 400; // 0.75..1.0
  return c.audience * ARPU * popFactor(c.popularity) * revenueMult(s) * sat;
}

export function projectedDaily(s: GameState, audience: number, popularity: number, commission: number) {
  return audience * ARPU * popFactor(popularity) * revenueMult(s) * 0.9 * commission;
}

export function creatorGrowthRate(s: GameState, c: SignedCreator) {
  const def = CREATOR_BY_ID[c.id];
  const base = (def?.growth ?? 0.02) * growthMult(s);
  const extra = campaignGrowth(s, c.id) + (c.contract.growthStipend ? STIPEND_GROWTH : 0);
  const size = 1 / (1 + c.audience / 4_000_000);
  const satF = 0.4 + c.satisfaction / 100; // 0.4..1.4
  return (base + extra) * size * satF;
}

export interface ExpenseBreakdown {
  [k: string]: number;
}

export function monthlyExpenses(s: GameState): ExpenseBreakdown {
  const lvl = levelFor(s.clout);
  let vehicles = 0;
  for (const v of s.vehicles) {
    const def = VEHICLE_BY_ID[v];
    if (!def) continue;
    const mods = s.mods[v];
    vehicles += def.maintenance * (1 + (mods ? (mods.engine + mods.handling) * 0.1 : 0));
  }
  let property = 0;
  let club = 0;
  let yacht = 0;
  for (const p of s.properties) {
    const def = PROPERTY_BY_ID[p];
    if (!def) continue;
    if (def.type === 'club') club += def.upkeep;
    else if (def.type === 'marina') yacht += def.upkeep;
    else property += def.upkeep;
  }
  if (s.properties.includes('club')) for (const u of s.club.upgrades) club += CLUB_UPGRADE_BY_ID[u]?.upkeep ?? 0;
  if (s.yacht) yacht += YACHT_BY_ID[s.yacht]?.upkeep ?? 0;
  let staff = 0;
  for (const d of STAFF) staff += (s.staff[d.id] || 0) * d.salary;
  const signed = Object.keys(s.creators).length;
  let ops = signed > 0 || s.properties.includes('office') ? 1500 + 450 * signed : 0;
  let opsDiscount = 0;
  for (const u of s.upgrades) opsDiscount += UPGRADE_BY_ID[u]?.effect.opsDiscount ?? 0;
  ops *= 1 - opsDiscount;
  const stipends = Object.values(s.creators).filter((c) => c.contract.growthStipend).length * STIPEND_COST;
  const lifestyle = Math.round(900 * Math.pow(lvl + 1, 1.7));
  const out: ExpenseBreakdown = {
    'Vehicle maintenance': vehicles,
    'Property upkeep': property,
    'Staff salaries': staff,
    'Agency operations': ops + stipends,
    'Nightclub operations': club,
    'Yacht & marina': yacht,
    'Lifestyle spending': lifestyle,
  };
  const discount = (s.staff['assistant'] || 0) * 0.08;
  if (discount > 0) for (const k of Object.keys(out)) out[k] = Math.round(out[k] * (1 - discount));
  for (const k of Object.keys(out)) out[k] = Math.round(out[k]);
  return out;
}

export function sumExpenses(e: ExpenseBreakdown) {
  return Object.values(e).reduce((a, b) => a + b, 0);
}

export function clubNightly(s: GameState) {
  if (!s.properties.includes('club')) return 0;
  let att = 1;
  for (const u of s.club.upgrades) att += CLUB_UPGRADE_BY_ID[u]?.attendance ?? 0;
  const lvl = levelFor(s.clout);
  return Math.round(9000 * att * (1 + lvl * 0.08));
}

export function buildMonthReport(s: GameState, expenses: ExpenseBreakdown, cloutChange: number): MonthReport {
  const totalExpenses = sumExpenses(expenses);
  const totalIncome = s.month.commission + s.month.otherIncome;
  const net = totalIncome - totalExpenses - s.month.marketing - s.month.purchases;
  const prev = s.reports[s.reports.length - 1];
  const trend: MonthReport['trend'] = !prev ? (net >= 0 ? 'up' : 'down') : net > prev.net * 1.05 ? 'up' : net < prev.net * 0.95 ? 'down' : 'flat';
  const topSources = Object.entries(s.month.incomeBySource).sort((a, b) => b[1] - a[1]).slice(0, 4);
  return {
    month: Math.floor((s.day - 2) / MONTH_DAYS) + 1,
    gross: s.month.gross,
    commission: s.month.commission,
    otherIncome: s.month.otherIncome,
    totalIncome,
    expenses: { ...expenses, 'Marketing campaigns': s.month.marketing, 'Luxury purchases': s.month.purchases },
    totalExpenses: totalExpenses + s.month.marketing + s.month.purchases,
    marketing: s.month.marketing,
    net,
    cashAfter: s.cash,
    topSources,
    trend,
    cloutChange,
  };
}

export function levelName(clout: number) {
  return CLOUT_LEVELS[levelFor(clout)].name;
}

export function campaignInfo(id: string) {
  return CAMPAIGN_BY_ID[id];
}

export function vehicleResale(id: string) {
  const def = VEHICLE_BY_ID[id];
  return def ? Math.round(def.price * 0.6) : 0;
}
