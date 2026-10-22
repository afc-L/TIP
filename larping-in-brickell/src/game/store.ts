import { create } from 'zustand';
import type { ActiveCampaign, BounceSettings, Contract, GameState, SignedCreator, VehicleMods } from './types';
import {
  CAMPAIGN_BY_ID, CLOUT_LEVELS, CLUB_THEMES, CLUB_UPGRADE_BY_ID, MONTH_DAYS, OUTFIT_BY_ID, PROPERTY_BY_ID, START_CASH, STAFF_BY_ID,
  UPGRADE_BY_ID, WATCH_BY_ID, YACHT_BY_ID, levelFor,
} from './data/catalog';
import { CREATOR_BY_ID } from './data/creators';
import { VEHICLE_BY_ID } from './data/vehicles';
import { RIVALS, RIVAL_BY_ID } from './data/rivals';
import { EVENT_BY_ID } from './data/events';
import { ACHIEVEMENTS, MAIN_MISSIONS, SIDE_MISSIONS, endgameReady } from './data/missions';
import { SOCIAL_AMBIENT } from './data/dialogue';
import { START_SPAWN } from './data/world';
import {
  buildMonthReport, clubNightly, creatorDailyGross, creatorGrowthRate, monthlyExpenses, oddsBonus, staffCap, sumExpenses, vehicleResale,
  accountCapacity,
} from './systems/economy';
import { SAVE_VERSION, clearSave, loadSave, writeSave } from './systems/save';
import { money, pick } from './systems/format';
import { notify, useUI } from './uiStore';
import { WATCHES } from './data/catalog';

export const DEFAULT_BOUNCE: BounceSettings = {
  enabled: false,
  style: 'brickell',
  intensity: 0.6,
  rideHeight: 0,
  stiffness: 0.5,
  sfxVolume: 0.7,
};

export function defaultState(nickname = 'Boss'): GameState {
  const rivals: GameState['rivals'] = {};
  for (const r of RIVALS) rivals[r.id] = { clout: r.startClout, roster: r.startRoster, revenue: r.startRevenue, relation: 0, defeated: false, lastShowdownDay: 0 };
  return {
    version: SAVE_VERSION,
    nickname,
    cash: START_CASH,
    clout: 0,
    day: 1,
    minute: 9 * 60 + 30,
    creators: {},
    cooldowns: {},
    lostToRival: {},
    campaigns: [],
    upgrades: [],
    staff: {},
    vehicles: ['maybach'],
    mods: { maybach: { ...VEHICLE_BY_ID.maybach.defaultMods } },
    activeVehicle: 'maybach',
    bounce: { ...DEFAULT_BOUNCE },
    watches: [],
    equippedWatch: null,
    outfits: ['starter'],
    equippedOutfit: 'starter',
    properties: ['studio'],
    home: 'studio',
    club: { upgrades: [], lastEventDay: 0, eventsHosted: 0, bestAttendance: 0 },
    yacht: null,
    yachtHull: '',
    missionsDone: [],
    sideDone: [],
    achievements: [],
    stats: {},
    ledger: [],
    history: [{ day: 1, revenue: 0, audience: 0, cash: START_CASH }],
    month: { gross: 0, commission: 0, otherIncome: 0, marketing: 0, purchases: 0, incomeBySource: {} },
    reports: [],
    rivals,
    social: [
      { id: 1, day: 1, author: 'Brickell Daily', handle: '@brickelldaily', text: 'Another beautiful morning in Brickell. 87 new "founders" moved here this week. ☀️', likes: 312, tone: 'npc' },
      { id: 2, day: 1, author: 'Chase Valentino', handle: '@chasethebag', text: 'Signed 3 creators before breakfast. Breakfast was a protein bar in a leased lambo. #grindset', likes: 1840, tone: 'rival' },
    ],
    contacts: [],
    eventsDone: {},
    valetDone: {},
    spawn: { ...START_SPAWN },
    trackedMission: null,
    endgameCelebrated: false,
    postId: 3,
  };
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export interface RecruitOffer {
  commission: number;
  months: number;
  stipend: boolean;
}

export interface EventResult {
  score: number;
  cash: number;
  clout: number;
  win: boolean;
  text: string;
}

interface GameStore {
  game: GameState;
  started: boolean;
  newGame: (nick: string) => void;
  continueGame: () => boolean;
  save: (silent?: boolean) => void;
  scheduleSave: () => void;
  resetSave: () => void;
  mutate: (fn: (g: GameState) => void, opts?: { save?: boolean }) => void;
  earn: (amount: number, label: string, category: string) => void;
  spend: (amount: number, label: string, category: 'purchases' | 'marketing' | 'other') => boolean;
  addClout: (n: number, reason?: string) => void;
  stat: (k: string, n?: number) => void;
  maxStat: (k: string, v: number) => void;
  advance: (minutes: number) => void;
  sleep: () => boolean;
  signCreator: (id: string, offer: RecruitOffer) => void;
  declineCreator: (id: string) => void;
  renewContract: (id: string, offer: RecruitOffer) => void;
  releaseCreator: (id: string) => void;
  startCampaign: (type: string, creatorId: string | null) => ActiveCampaign['outcome'] | null;
  buyUpgrade: (id: string) => boolean;
  hireStaff: (id: string) => boolean;
  fireStaff: (id: string) => void;
  buyVehicle: (id: string) => boolean;
  sellVehicle: (id: string) => boolean;
  setActiveVehicle: (id: string) => void;
  buyMod: (vehicleId: string, patch: Partial<VehicleMods>, cost: number, label: string) => boolean;
  setBounce: (patch: Partial<BounceSettings>) => void;
  buyWatch: (id: string) => boolean;
  sellWatch: (id: string) => void;
  equipWatch: (id: string | null) => void;
  buyOutfit: (id: string) => boolean;
  equipOutfit: (id: string) => void;
  buyProperty: (id: string) => boolean;
  buyYacht: (id: string) => boolean;
  buyClubUpgrade: (id: string) => boolean;
  hostClubEvent: (themeId: string, budget: number) => EventResult | null;
  completeEvent: (eventId: string, score: number) => EventResult;
  rivalShowdown: (rivalId: string) => EventResult & { player: number; rival: number };
  valetFlex: (poiId: string, score: number, tier: number) => void;
  gamble: (delta: number, label: string) => void;
  meetContact: (id: string) => void;
  post: (author: string, handle: string, text: string, tone: 'player' | 'rival' | 'npc' | 'creator', likes?: number) => void;
  setSpawn: (x: number, z: number, yaw: number) => void;
  setTracked: (id: string | null) => void;
  celebrate: () => void;
  checkProgress: () => void;
}

function clone<T>(v: T): T {
  return structuredClone(v);
}

export const useGame = create<GameStore>()((set, get) => {
  const mutate: GameStore['mutate'] = (fn, opts) => {
    const g = clone(get().game);
    fn(g);
    set({ game: g });
    if (opts?.save) get().scheduleSave();
  };

  const levelBefore = { v: 0 };

  function award(g: GameState, cash: number, clout: number, label: string) {
    if (cash) {
      g.cash += cash;
      g.month.otherIncome += cash;
      g.month.incomeBySource['Rewards'] = (g.month.incomeBySource['Rewards'] || 0) + cash;
      g.ledger.unshift({ day: g.day, minute: g.minute, label, amount: cash, category: 'reward' });
    }
    if (clout) g.clout = Math.max(0, g.clout + clout);
  }

  function addPost(g: GameState, author: string, handle: string, text: string, tone: 'player' | 'rival' | 'npc' | 'creator', likes?: number) {
    g.social.unshift({ id: g.postId++, day: g.day, author, handle, text, tone, likes: likes ?? Math.floor(50 + Math.random() * 3000 * (1 + levelFor(g.clout))) });
    if (g.social.length > 60) g.social.length = 60;
  }

  function dailyTick(g: GameState) {
    // 1) Creators: growth, revenue, satisfaction, contracts
    let totalComm = 0;
    let totalGross = 0;
    let totalAudience = 0;
    const lvl = levelFor(g.clout);
    const signed = Object.values(g.creators);
    const overload = Math.max(0, signed.length - accountCapacity(g));
    let satDaily = 0;
    if (g.upgrades.includes('concierge')) satDaily += 1;
    if (g.upgrades.includes('studio')) satDaily += 0.5;
    if (g.properties.includes('cielo') || g.properties.includes('penthouse')) satDaily += 2;
    for (const c of signed) {
      const def = CREATOR_BY_ID[c.id];
      if (!def) continue;
      const rate = creatorGrowthRate(g, c) * (0.8 + Math.random() * 0.4);
      c.audience = Math.round(c.audience * (1 + rate));
      const gross = creatorDailyGross(g, c);
      const comm = gross * c.contract.commission;
      c.lastDayGross = Math.round(gross);
      c.lastDayCommission = Math.round(comm);
      c.lifetimeCommission += Math.round(comm);
      c.history.push(c.audience);
      c.revenueHistory.push(Math.round(comm));
      if (c.history.length > 30) c.history.shift();
      if (c.revenueHistory.length > 30) c.revenueHistory.shift();
      totalComm += comm;
      totalGross += gross;
      totalAudience += c.audience;
      // Satisfaction: fair commission, campaigns, staff, overload, drift toward 60
      let ds = (def.maxCommission - c.contract.commission) * 30 + satDaily;
      if (g.campaigns.some((k) => k.creatorId === c.id || k.creatorId === null)) ds += 1.5;
      if (overload > 0) ds -= 2.5 * Math.min(3, overload);
      ds += (60 - c.satisfaction) * 0.03;
      c.satisfaction = Math.max(0, Math.min(100, c.satisfaction + ds));
    }
    if (signed.length > 0) {
      const c = Math.round(totalComm);
      g.cash += c;
      g.month.commission += c;
      g.month.gross += Math.round(totalGross);
      g.month.incomeBySource['Creator commissions'] = (g.month.incomeBySource['Creator commissions'] || 0) + c;
      g.ledger.unshift({ day: g.day, minute: g.minute, label: `Daily commission (${signed.length} creator${signed.length > 1 ? 's' : ''})`, amount: c, category: 'commission' });
      if (c > 0) {
        g.stats.commissionDays = (g.stats.commissionDays || 0) + 1;
        g.stats.bestDay = Math.max(g.stats.bestDay || 0, c);
        notify(`AlwaysFans payout: +${money(c)} commission`, 'cash');
      }
    }
    // 2) Club nightly revenue
    const club = clubNightly(g);
    if (club > 0) {
      g.cash += club;
      g.month.otherIncome += club;
      g.month.incomeBySource['VOLT nightclub'] = (g.month.incomeBySource['VOLT nightclub'] || 0) + club;
      g.ledger.unshift({ day: g.day, minute: g.minute, label: 'VOLT nightly door & bar', amount: club, category: 'club' });
    }
    // 3) Campaigns expire
    g.campaigns = g.campaigns.filter((k) => k.endDay > g.day + 1);
    // 4) Contracts: expiry & warnings
    const auto = g.upgrades.includes('automation');
    for (const c of Object.values(g.creators)) {
      const left = c.contract.endDay - (g.day + 1);
      const def = CREATOR_BY_ID[c.id];
      if (left === 2) notify(`${def?.name}'s contract expires in 2 days. Renew it in AlwaysFans Manager.`, 'warn');
      if (left <= 0) {
        if (auto && c.satisfaction >= 40) {
          c.contract.startDay = g.day + 1;
          c.contract.endDay = g.day + 1 + c.contract.durationMonths * MONTH_DAYS;
          notify(`HustleBot auto-renewed ${def?.name}'s contract.`, 'info');
        } else if (c.satisfaction >= 55 && Math.random() < 0.5) {
          c.contract.startDay = g.day + 1;
          c.contract.endDay = g.day + 1 + 3 * MONTH_DAYS;
          c.contract.durationMonths = 3;
          notify(`${def?.name} was happy enough to extend 3 months on the same terms.`, 'info');
        } else {
          delete g.creators[c.id];
          g.cooldowns[c.id] = g.day + 3;
          g.clout = Math.max(0, g.clout - 10);
          notify(`${def?.name}'s contract expired and they left the agency. (-10 clout)`, 'bad');
          addPost(g, def?.name ?? 'Creator', def?.handle ?? '@creator', 'Contract done! Grateful for the journey. Exploring new management options. 💫', 'creator');
        }
      }
    }
    // 5) Rivals progress + occasional poaching of prospects
    for (const r of RIVALS) {
      const rs = g.rivals[r.id];
      if (!rs) continue;
      rs.clout += Math.round(r.growth * (0.6 + Math.random() * 0.8));
      rs.revenue = Math.round(rs.revenue * (1.012 + Math.random() * 0.012));
      if (Math.random() < 0.06) rs.roster += 1;
    }
    if (lvl >= 2 && Math.random() < 0.07) {
      const candidates = Object.values(CREATOR_BY_ID).filter(
        (c) => !g.creators[c.id] && c.minLevel <= lvl && c.minLevel >= 1 && !(g.lostToRival[c.id] > g.day),
      );
      if (candidates.length) {
        const c = pick(candidates);
        const r = pick(RIVALS.filter((x) => !g.rivals[x.id]?.defeated)) ?? RIVALS[0];
        g.lostToRival[c.id] = g.day + 8;
        addPost(g, r.name, r.handle, `Welcome ${c.name} (${c.handle}) to ${r.agency}! Another one. 🏆`, 'rival');
        notify(`${r.name} signed ${c.name} for now. They'll be a free agent again in ~8 days.`, 'warn');
      }
    }
    // 6) Ambient social
    const amb = pick(SOCIAL_AMBIENT);
    addPost(g, amb.author, amb.handle, amb.text, 'npc');
    if (Math.random() < 0.5) {
      const r = pick(RIVALS);
      addPost(g, r.name, r.handle, pick(r.lines), 'rival');
    }
    // 7) History & day roll
    g.day += 1;
    g.history.push({ day: g.day, revenue: Math.round(totalComm), audience: totalAudience, cash: Math.round(g.cash) });
    if (g.history.length > 60) g.history.shift();
    if (g.ledger.length > 80) g.ledger.length = 80;
    // 8) Month end: pay the bills
    if ((g.day - 1) % MONTH_DAYS === 0) {
      const exp = monthlyExpenses(g);
      const total = sumExpenses(exp);
      g.cash -= total;
      g.ledger.unshift({ day: g.day, minute: 0, label: 'Monthly bills (see report)', amount: -total, category: 'bills' });
      let cloutChange = 0;
      if (g.cash < 0) {
        cloutChange = -Math.round(Math.max(10, g.clout * 0.04));
        g.clout = Math.max(0, g.clout + cloutChange);
        addPost(g, 'Brickell Tea', '@brickelltea', `Rumor: ${g.nickname}'s card got declined at Salt & Status. 👀`, 'npc');
      } else if (g.month.commission + g.month.otherIncome > total) {
        cloutChange = Math.round(5 + levelFor(g.clout) * 4);
        g.clout += cloutChange;
      }
      const report = buildMonthReport(g, exp, cloutChange);
      g.reports.push(report);
      if (g.reports.length > 12) g.reports.shift();
      g.month = { gross: 0, commission: 0, otherIncome: 0, marketing: 0, purchases: 0, incomeBySource: {} };
      setTimeout(() => useUI.getState().open('report'), 50);
    }
  }

  return {
    game: defaultState(),
    started: false,

    newGame: (nick) => {
      const g = defaultState(nick.trim() || 'Boss');
      set({ game: g, started: true });
      levelBefore.v = 0;
      writeSave(g);
    },
    continueGame: () => {
      const g = loadSave(defaultState());
      if (!g) return false;
      set({ game: g, started: true });
      levelBefore.v = levelFor(g.clout);
      return true;
    },
    save: (silent) => {
      const ok = writeSave(get().game);
      if (!silent) notify(ok ? 'Game saved.' : 'Could not save (storage unavailable).', ok ? 'info' : 'bad');
    },
    scheduleSave: () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => get().save(true), 1200);
    },
    resetSave: () => {
      clearSave();
      set({ game: defaultState(), started: false });
    },
    mutate,

    earn: (amount, label, category) => {
      mutate((g) => {
        g.cash += amount;
        g.month.otherIncome += amount;
        g.month.incomeBySource[label] = (g.month.incomeBySource[label] || 0) + amount;
        g.ledger.unshift({ day: g.day, minute: g.minute, label, amount, category });
      }, { save: true });
      notify(`+${money(amount)} · ${label}`, 'cash');
      get().checkProgress();
    },
    spend: (amount, label, category) => {
      if (get().game.cash < amount) {
        notify(`Not enough cash. You need ${money(amount)}.`, 'bad');
        return false;
      }
      mutate((g) => {
        g.cash -= amount;
        if (category === 'marketing') g.month.marketing += amount;
        else if (category === 'purchases') g.month.purchases += amount;
        else g.month.purchases += amount;
        g.ledger.unshift({ day: g.day, minute: g.minute, label, amount: -amount, category });
      }, { save: true });
      return true;
    },
    addClout: (n, reason) => {
      if (!n) return;
      mutate((g) => {
        g.clout = Math.max(0, g.clout + n);
      }, { save: true });
      if (reason) notify(`${n > 0 ? '+' : ''}${n} clout · ${reason}`, n > 0 ? 'clout' : 'bad');
      get().checkProgress();
    },
    stat: (k, n = 1) => {
      mutate((g) => {
        g.stats[k] = (g.stats[k] || 0) + n;
      });
      get().checkProgress();
    },
    maxStat: (k, v) => {
      if ((get().game.stats[k] || 0) >= v) return;
      mutate((g) => {
        g.stats[k] = v;
      });
      get().checkProgress();
    },

    advance: (minutes) => {
      const g0 = get().game;
      if (g0.minute + minutes < 1440) {
        set({ game: { ...g0, minute: g0.minute + minutes } });
        return;
      }
      mutate((g) => {
        g.minute += minutes;
        while (g.minute >= 1440) {
          g.minute -= 1440;
          dailyTick(g);
        }
      });
      get().save(true);
      get().checkProgress();
    },
    sleep: () => {
      const m = get().game.minute;
      if (m < 18 * 60 && m >= 6 * 60) {
        notify('Too early to sleep. Come back after 6:00 PM (or hustle until then).', 'warn');
        return false;
      }
      const target = 8 * 60;
      const add = m >= 18 * 60 ? 1440 - m + target : target - m;
      get().advance(add);
      notify('You slept like someone with recurring revenue.', 'info');
      return true;
    },

    signCreator: (id, offer) => {
      const def = CREATOR_BY_ID[id];
      if (!def) return;
      mutate((g) => {
        const contract: Contract = {
          creatorId: id, commission: offer.commission, durationMonths: offer.months, growthStipend: offer.stipend,
          startDay: g.day, endDay: g.day + offer.months * MONTH_DAYS,
        };
        const c: SignedCreator = {
          id, contract, audience: def.audience, popularity: def.popularity, satisfaction: 62 + (def.maxCommission - offer.commission) * 120,
          lifetimeCommission: 0, lastDayGross: 0, lastDayCommission: 0, history: [def.audience], revenueHistory: [0],
        };
        c.satisfaction = Math.max(20, Math.min(95, c.satisfaction));
        g.creators[id] = c;
        if (!g.contacts.includes(id)) g.contacts.push(id);
        const gain = Math.round(10 + def.popularity * def.popularity * 1.6);
        g.clout += gain;
        g.stats.signed = (g.stats.signed || 0) + 1;
        addPost(g, def.name, def.handle, `Big news: I just signed with ${g.nickname}'s agency on AlwaysFans! New era 🚀`, 'creator');
        notify(`Signed ${def.name}! +${gain} clout`, 'clout');
      }, { save: true });
      get().checkProgress();
    },
    declineCreator: (id) => {
      mutate((g) => {
        g.cooldowns[id] = g.day + 1;
        if (!g.contacts.includes(id)) g.contacts.push(id);
      }, { save: true });
    },
    renewContract: (id, offer) => {
      mutate((g) => {
        const c = g.creators[id];
        if (!c) return;
        c.contract = { ...c.contract, commission: offer.commission, durationMonths: offer.months, growthStipend: offer.stipend, startDay: g.day, endDay: g.day + offer.months * MONTH_DAYS };
        c.satisfaction = Math.min(100, c.satisfaction + 8);
      }, { save: true });
      notify(`Contract renewed with ${CREATOR_BY_ID[id]?.name}.`, 'info');
    },
    releaseCreator: (id) => {
      mutate((g) => {
        delete g.creators[id];
        g.cooldowns[id] = g.day + 5;
        g.clout = Math.max(0, g.clout - 5);
      }, { save: true });
      notify(`Released ${CREATOR_BY_ID[id]?.name} from their contract on good terms.`, 'info');
    },

    startCampaign: (type, creatorId) => {
      const def = CAMPAIGN_BY_ID[type];
      const g0 = get().game;
      if (!def) return null;
      if (levelFor(g0.clout) < def.minLevel) {
        notify(`Requires clout level: ${CLOUT_LEVELS[def.minLevel].name}`, 'bad');
        return null;
      }
      if (!get().spend(def.cost, `Campaign: ${def.name}`, 'marketing')) return null;
      const bonus = oddsBonus(g0);
      const photoPro = type === 'photo' && (g0.staff['photographer'] || 0) > 0;
      const flop = photoPro ? 0 : Math.max(0, def.odds.flop - bonus / 2);
      const viral = def.odds.viral + bonus;
      const r = Math.random();
      const outcome: ActiveCampaign['outcome'] = r < flop ? 'flop' : r > 1 - viral ? 'viral' : 'solid';
      const mult = outcome === 'flop' ? 0.3 : outcome === 'viral' ? 1.8 : 1;
      let msg = '';
      mutate((g) => {
        g.stats.campaigns = (g.stats.campaigns || 0) + 1;
        const targets = creatorId ? [g.creators[creatorId]].filter(Boolean) : Object.values(g.creators);
        if (def.growth > 0) {
          g.campaigns.push({
            id: `${type}-${Date.now()}`, type, creatorId: def.roster ? null : creatorId, startDay: g.day, endDay: g.day + def.days,
            outcome, growthBonus: def.growth * mult,
          });
        }
        if (def.oneShot === 'audience') for (const c of targets) c.audience = Math.round(c.audience * (1 + (def.oneShotValue ?? 0) * mult));
        if (def.oneShot === 'popularity') for (const c of targets) c.popularity = Math.min(10, c.popularity + (def.oneShotValue ?? 0) * mult);
        if (def.oneShot === 'cash') {
          const pay = Math.round(def.cost * (def.oneShotValue ?? 1) * mult);
          g.cash += pay;
          g.month.otherIncome += pay;
          g.month.incomeBySource['Brand deals'] = (g.month.incomeBySource['Brand deals'] || 0) + pay;
          g.ledger.unshift({ day: g.day, minute: g.minute, label: 'Brand partnership payout', amount: pay, category: 'brand' });
          msg = ` Payout: ${money(pay)}.`;
        }
        for (const c of targets) c.satisfaction = Math.min(100, c.satisfaction + 3);
        g.clout += Math.round(def.clout * mult);
      }, { save: true });
      notify(`${def.name}: ${outcome === 'viral' ? 'WENT VIRAL! 🔥' : outcome === 'flop' ? 'flopped. 😬' : 'solid results.'}${msg}`, outcome === 'flop' ? 'warn' : 'cash');
      get().checkProgress();
      return outcome;
    },
    buyUpgrade: (id) => {
      const def = UPGRADE_BY_ID[id];
      const g = get().game;
      if (!def || g.upgrades.includes(id)) return false;
      if (def.requires && !g.properties.includes(def.requires)) {
        notify(`Requires ${PROPERTY_BY_ID[def.requires]?.name}.`, 'bad');
        return false;
      }
      if (!get().spend(def.price, `Upgrade: ${def.name}`, 'purchases')) return false;
      mutate((x) => {
        x.upgrades.push(id);
      }, { save: true });
      notify(`Agency upgrade purchased: ${def.name}`, 'info');
      get().checkProgress();
      return true;
    },
    hireStaff: (id) => {
      const def = STAFF_BY_ID[id];
      const g = get().game;
      if (!def) return false;
      const cap = staffCap(g, def.max);
      if (cap === 0) {
        notify('You need an office before hiring staff.', 'bad');
        return false;
      }
      if ((g.staff[id] || 0) >= cap) {
        notify('No more desks for that role. (HQ doubles capacity.)', 'warn');
        return false;
      }
      if (!get().spend(def.hireFee, `Hiring fee: ${def.name}`, 'other')) return false;
      mutate((x) => {
        x.staff[id] = (x.staff[id] || 0) + 1;
      }, { save: true });
      notify(`Hired a ${def.name}. Salary ${money(def.salary)}/month.`, 'info');
      get().checkProgress();
      return true;
    },
    fireStaff: (id) => {
      mutate((x) => {
        x.staff[id] = Math.max(0, (x.staff[id] || 0) - 1);
      }, { save: true });
    },

    buyVehicle: (id) => {
      const def = VEHICLE_BY_ID[id];
      const g = get().game;
      if (!def || g.vehicles.includes(id)) return false;
      if (levelFor(g.clout) < def.minLevel) {
        notify(`The dealer won't sell to a ${CLOUT_LEVELS[levelFor(g.clout)].name}. Need ${CLOUT_LEVELS[def.minLevel].name}.`, 'bad');
        return false;
      }
      if (!get().spend(def.price, `Vehicle: ${def.make} ${def.name}`, 'purchases')) return false;
      mutate((x) => {
        x.vehicles.push(id);
        x.mods[id] = { ...def.defaultMods };
        const gain = Math.round(def.prestige * def.prestige * 1.5);
        x.clout += gain;
        addPost(x, x.nickname, '@' + x.nickname.toLowerCase().replace(/\s+/g, ''), `New whip just dropped: ${def.make} ${def.name}. 🔑 #BrickellLife`, 'player');
        notify(`You bought the ${def.make} ${def.name}! +${gain} clout`, 'clout');
      }, { save: true });
      get().checkProgress();
      return true;
    },
    sellVehicle: (id) => {
      if (id === 'maybach') {
        notify('Sell the Maybach? Never. It is your whole personality.', 'warn');
        return false;
      }
      const g = get().game;
      if (!g.vehicles.includes(id)) return false;
      const value = vehicleResale(id);
      mutate((x) => {
        x.vehicles = x.vehicles.filter((v) => v !== id);
        if (x.activeVehicle === id) x.activeVehicle = 'maybach';
        x.cash += value;
        x.month.otherIncome += value;
        x.month.incomeBySource['Asset sales'] = (x.month.incomeBySource['Asset sales'] || 0) + value;
        x.ledger.unshift({ day: x.day, minute: x.minute, label: `Sold ${VEHICLE_BY_ID[id]?.name}`, amount: value, category: 'sale' });
        x.clout = Math.max(0, x.clout - 10);
      }, { save: true });
      notify(`Sold for ${money(value)}. (-10 clout, people noticed.)`, 'warn');
      return true;
    },
    setActiveVehicle: (id) => {
      if (!get().game.vehicles.includes(id)) return;
      mutate((x) => {
        x.activeVehicle = id;
      }, { save: true });
    },
    buyMod: (vehicleId, patch, cost, label) => {
      if (cost > 0 && !get().spend(cost, `Customization: ${label}`, 'purchases')) return false;
      mutate((x) => {
        x.mods[vehicleId] = { ...(x.mods[vehicleId] ?? VEHICLE_BY_ID[vehicleId].defaultMods), ...patch };
        if (cost > 0) x.stats.modsBought = (x.stats.modsBought || 0) + 1;
        if (cost > 0) x.clout += Math.max(1, Math.round(cost / 8000));
      }, { save: true });
      get().checkProgress();
      return true;
    },
    setBounce: (patch) => {
      mutate((x) => {
        x.bounce = { ...x.bounce, ...patch };
      }, { save: true });
    },

    buyWatch: (id) => {
      const def = WATCH_BY_ID[id];
      const g = get().game;
      if (!def || g.watches.includes(id)) return false;
      if (levelFor(g.clout) < def.minLevel) {
        notify(`The boutique only shows this piece to ${CLOUT_LEVELS[def.minLevel].name}+ clients.`, 'bad');
        return false;
      }
      if (!get().spend(def.price, `Watch: ${def.name}`, 'purchases')) return false;
      mutate((x) => {
        x.watches.push(id);
        x.equippedWatch = id;
        x.clout += def.clout;
        addPost(x, x.nickname, '@' + x.nickname.toLowerCase().replace(/\s+/g, ''), `Wrist check ⌚ ${def.brand} ${def.name}. Time is money and I have both.`, 'player');
      }, { save: true });
      notify(`Purchased ${def.name}! +${def.clout} clout`, 'clout');
      get().checkProgress();
      return true;
    },
    sellWatch: (id) => {
      const def = WATCH_BY_ID[id];
      if (!def) return;
      const value = Math.round(def.price * 0.7);
      mutate((x) => {
        x.watches = x.watches.filter((w) => w !== id);
        if (x.equippedWatch === id) x.equippedWatch = x.watches[0] ?? null;
        x.cash += value;
        x.month.otherIncome += value;
        x.month.incomeBySource['Asset sales'] = (x.month.incomeBySource['Asset sales'] || 0) + value;
        x.ledger.unshift({ day: x.day, minute: x.minute, label: `Sold ${def.name}`, amount: value, category: 'sale' });
        x.clout = Math.max(0, x.clout - Math.round(def.clout / 2));
      }, { save: true });
      notify(`Sold ${def.name} for ${money(value)}.`, 'warn');
    },
    equipWatch: (id) => mutate((x) => {
      x.equippedWatch = id;
    }, { save: true }),
    buyOutfit: (id) => {
      const def = OUTFIT_BY_ID[id];
      const g = get().game;
      if (!def || g.outfits.includes(id)) return false;
      if (levelFor(g.clout) < def.minLevel) {
        notify(`Requires ${CLOUT_LEVELS[def.minLevel].name}.`, 'bad');
        return false;
      }
      if (!get().spend(def.price, `Outfit: ${def.name}`, 'purchases')) return false;
      mutate((x) => {
        x.outfits.push(id);
        x.equippedOutfit = id;
        x.clout += def.clout;
      }, { save: true });
      notify(`New fit: ${def.name}. +${def.clout} clout`, 'clout');
      get().checkProgress();
      return true;
    },
    equipOutfit: (id) => mutate((x) => {
      if (x.outfits.includes(id)) x.equippedOutfit = id;
    }, { save: true }),

    buyProperty: (id) => {
      const def = PROPERTY_BY_ID[id];
      const g = get().game;
      if (!def || g.properties.includes(id)) return false;
      if (levelFor(g.clout) < def.minLevel) {
        notify(`Requires clout level ${CLOUT_LEVELS[def.minLevel].name}.`, 'bad');
        return false;
      }
      if (def.requires && !g.properties.includes(def.requires)) {
        notify(`Requires ${PROPERTY_BY_ID[def.requires]?.name} first.`, 'bad');
        return false;
      }
      if (!get().spend(def.price, `Property: ${def.name}`, 'purchases')) return false;
      mutate((x) => {
        x.properties.push(id);
        x.clout += def.clout;
        if (def.type === 'home' && (def.homeRank ?? 0) > (PROPERTY_BY_ID[x.home]?.homeRank ?? 0)) {
          x.home = id;
          x.properties = x.properties.filter((p) => p !== 'studio'); // lease ends
        }
        addPost(x, 'Brickell Real Estate', '@brickellre', `${x.nickname} just closed on ${def.name}. Brickell keeps rising. 🏙`, 'npc');
      }, { save: true });
      notify(`Purchased ${def.name}! +${def.clout} clout`, 'clout');
      get().checkProgress();
      return true;
    },
    buyYacht: (id) => {
      const def = YACHT_BY_ID[id];
      const g = get().game;
      if (!def) return false;
      if (!g.properties.includes('slip')) {
        notify('You need a marina slip first.', 'bad');
        return false;
      }
      if (levelFor(g.clout) < def.minLevel) {
        notify(`Requires ${CLOUT_LEVELS[def.minLevel].name}.`, 'bad');
        return false;
      }
      const current = g.yacht ? YACHT_BY_ID[g.yacht] : null;
      if (current && current.rank >= def.rank) return false;
      const tradeIn = current ? Math.round(current.price * 0.6) : 0;
      const cost = def.price - tradeIn;
      if (!get().spend(cost, `Yacht: ${def.name}${tradeIn ? ' (after trade-in)' : ''}`, 'purchases')) return false;
      mutate((x) => {
        x.yacht = id;
        x.clout += def.clout;
        addPost(x, 'Yacht Gossip', '@yachtgossip', `New arrival at Bayside Marina: the ${def.name}, owned by ${x.nickname}. ⚓`, 'npc');
      }, { save: true });
      notify(`You are now the owner of the ${def.name}! +${def.clout} clout`, 'clout');
      get().checkProgress();
      return true;
    },
    buyClubUpgrade: (id) => {
      const def = CLUB_UPGRADE_BY_ID[id];
      const g = get().game;
      if (!def || !g.properties.includes('club') || g.club.upgrades.includes(id)) return false;
      if (!get().spend(def.price, `VOLT: ${def.name}`, 'purchases')) return false;
      mutate((x) => {
        x.club.upgrades.push(id);
        x.clout += 15;
      }, { save: true });
      notify(`VOLT upgraded: ${def.name}`, 'info');
      return true;
    },
    hostClubEvent: (themeId, budget) => {
      const theme = CLUB_THEMES.find((t) => t.id === themeId);
      const g = get().game;
      if (!theme || !g.properties.includes('club')) return null;
      if (g.club.lastEventDay === g.day) {
        notify('VOLT already hosted an event today. Tomorrow night!', 'warn');
        return null;
      }
      const bm = [0.8, 1.15, 1.5][budget] ?? 1;
      const cm = [1, 1.6, 2.5][budget] ?? 1;
      const cost = Math.round(theme.cost * cm);
      if (!get().spend(cost, `VOLT event: ${theme.name}`, 'marketing')) return null;
      let att = 1;
      for (const u of g.club.upgrades) att += CLUB_UPGRADE_BY_ID[u]?.attendance ?? 0;
      const lvl = levelFor(g.clout);
      const coord = 1 + (g.staff['events'] || 0) * 0.2;
      const rand = 0.7 + Math.random() * 0.6;
      const attendance = Math.round(160 * att * theme.appeal * (1 + lvl * 0.12) * bm * coord * rand * (1 + Object.keys(g.creators).length * 0.04));
      const revenue = Math.round(attendance * 140);
      const profit = revenue - cost;
      const success = profit > 0 && attendance >= 300;
      const clout = success ? Math.round(25 + attendance / 25) : 5;
      mutate((x) => {
        x.cash += revenue;
        x.month.otherIncome += revenue;
        x.month.incomeBySource['VOLT nightclub'] = (x.month.incomeBySource['VOLT nightclub'] || 0) + revenue;
        x.ledger.unshift({ day: x.day, minute: x.minute, label: `VOLT ${theme.name} revenue`, amount: revenue, category: 'club' });
        x.club.lastEventDay = x.day;
        x.club.eventsHosted += 1;
        x.club.bestAttendance = Math.max(x.club.bestAttendance, attendance);
        x.clout += clout;
        if (success) x.stats.clubSuccess = (x.stats.clubSuccess || 0) + 1;
        if (themeId === 'creator') for (const c of Object.values(x.creators)) c.satisfaction = Math.min(100, c.satisfaction + 6);
        addPost(x, 'VOLT Nightclub', '@voltmiami', success ? `${theme.name} was INSANE. ${attendance} people, zero chill. Thank you Miami! ⚡` : `${theme.name} tonight was... intimate. ${attendance} guests. Quality over quantity.`, 'npc');
      }, { save: true });
      get().checkProgress();
      return {
        score: attendance, cash: profit, clout, win: success,
        text: success ? `${attendance} guests! Revenue ${money(revenue)} vs costs ${money(cost)}.` : `Only ${attendance} guests. Revenue ${money(revenue)} vs costs ${money(cost)}. Try upgrades, a bigger budget or more clout.`,
      };
    },
    completeEvent: (eventId, score) => {
      const def = EVENT_BY_ID[eventId];
      const s = Math.max(0, Math.min(100, Math.round(score)));
      const g = get().game;
      const coord = 1 + (g.staff['events'] || 0) * 0.2;
      const factor = s < 40 ? 0.2 : (s / 100) * 1.4;
      const cash = Math.round((def?.reward.cash ?? 0) * factor * coord);
      const clout = Math.round((def?.reward.clout ?? 0) * factor * coord);
      const win = s >= 60;
      mutate((x) => {
        x.eventsDone[eventId] = x.day;
        x.stats.eventsAttended = (x.stats.eventsAttended || 0) + 1;
        if (eventId === 'bounceoff' && win) x.stats.bounceOffWins = (x.stats.bounceOffWins || 0) + 1;
        if (eventId === 'showoff' && s >= 70) x.stats.showoffWins = (x.stats.showoffWins || 0) + 1;
        if (eventId === 'launch') for (const c of Object.values(x.creators)) c.audience = Math.round(c.audience * (1 + 0.04 + s / 1000));
        if (eventId === 'mixer' && win) {
          // referral: shorten cooldowns
          x.cooldowns = {};
        }
        award(x, cash, clout, `Event: ${def?.name ?? eventId}`);
        if (win) addPost(x, 'Brickell Daily', '@brickelldaily', `${x.nickname} stole the show at ${def?.name}. Score: ${s}. 🔥`, 'npc');
      }, { save: true });
      get().checkProgress();
      return { score: s, cash, clout, win, text: win ? 'A memorable showing. People are talking.' : s >= 40 ? 'Decent, but nobody is posting about it.' : 'Rough night. You can try again tomorrow.' };
    },
    rivalShowdown: (rivalId) => {
      const r = RIVAL_BY_ID[rivalId];
      const g = get().game;
      const rs = g.rivals[rivalId];
      const daily = Object.values(g.creators).reduce((a, c) => a + c.lastDayCommission, 0) + clubNightly(g) * 0.5;
      const audience = Object.values(g.creators).reduce((a, c) => a + c.audience, 0);
      const player = Math.round(g.clout + daily / 40 + audience / 2000);
      const rival = Math.round((rs.clout + rs.revenue / 40 + rs.roster * 25) * (0.9 + Math.random() * 0.2));
      const win = player >= rival;
      const def = EVENT_BY_ID[`showdown_${rivalId}`];
      const cash = win ? def?.reward.cash ?? 0 : 0;
      const clout = win ? def?.reward.clout ?? 0 : -5;
      mutate((x) => {
        const xr = x.rivals[rivalId];
        xr.lastShowdownDay = x.day;
        x.eventsDone[`showdown_${rivalId}`] = x.day;
        if (win) {
          xr.defeated = true;
          xr.relation = Math.min(100, xr.relation + 20);
          xr.clout = Math.round(xr.clout * 0.85);
          x.stats.showdownsWon = (x.stats.showdownsWon || 0) + 1;
          addPost(x, r.name, r.handle, r.loseLine, 'rival');
        } else {
          xr.relation -= 5;
          addPost(x, r.name, r.handle, r.winLine, 'rival');
        }
        award(x, cash, clout, `Showdown vs ${r.name}`);
      }, { save: true });
      get().checkProgress();
      return { score: player, cash, clout, win, player, rival, text: win ? r.loseLine : r.winLine };
    },
    valetFlex: (poiId, score, tier) => {
      const g = get().game;
      if (g.valetDone[poiId] === g.day) return;
      const clout = Math.round(4 + score / 6);
      mutate((x) => {
        x.valetDone[poiId] = x.day;
        x.stats.valetFlex = (x.stats.valetFlex || 0) + 1;
        if (tier >= 2) x.stats.valetNamed = (x.stats.valetNamed || 0) + 1;
        x.clout += clout;
      }, { save: true });
      notify(`Valet Flex score ${Math.round(score)} · +${clout} clout`, 'clout');
      get().checkProgress();
    },
    gamble: (delta, label) => {
      mutate((x) => {
        x.cash += delta;
        if (delta > 0) {
          x.month.otherIncome += delta;
          x.month.incomeBySource['Casino winnings'] = (x.month.incomeBySource['Casino winnings'] || 0) + delta;
          x.stats.biggestWin = Math.max(x.stats.biggestWin || 0, delta);
        } else x.month.purchases -= delta;
        x.stats.casinoNet = (x.stats.casinoNet || 0) + delta;
        x.stats.handsPlayed = (x.stats.handsPlayed || 0) + 1;
        x.ledger.unshift({ day: x.day, minute: x.minute, label, amount: delta, category: 'casino' });
        if (x.ledger.length > 80) x.ledger.length = 80;
      }, { save: true });
      get().checkProgress();
    },
    meetContact: (id) => {
      if (get().game.contacts.includes(id)) return;
      mutate((x) => {
        x.contacts.push(id);
        x.clout += 5;
      }, { save: true });
      get().checkProgress();
    },
    post: (author, handle, text, tone, likes) => mutate((x) => addPost(x, author, handle, text, tone, likes)),
    setSpawn: (x, z, yaw) => {
      const g = get().game;
      set({ game: { ...g, spawn: { x, z, yaw } } });
    },
    setTracked: (id) => mutate((x) => {
      x.trackedMission = id;
    }),
    celebrate: () => {
      mutate((x) => {
        x.endgameCelebrated = true;
        addPost(x, 'Brickell Daily', '@brickelldaily', `HISTORIC: ${x.nickname} crowned King of Brickell at a superyacht party that lit up the bay. 👑🛥`, 'npc', 250000);
      }, { save: true });
      get().checkProgress();
    },

    checkProgress: () => {
      const g = get().game;
      const doneMain = MAIN_MISSIONS.filter((m) => !g.missionsDone.includes(m.id) && m.check(g));
      const doneSide = SIDE_MISSIONS.filter((m) => !g.sideDone.includes(m.id) && m.check(g));
      const ach = ACHIEVEMENTS.filter((a) => !g.achievements.includes(a.id) && a.check(g));
      const lvlNow = levelFor(g.clout);
      if (!doneMain.length && !doneSide.length && !ach.length && lvlNow === levelBefore.v) return;
      mutate((x) => {
        for (const m of doneMain) {
          x.missionsDone.push(m.id);
          award(x, m.reward.cash, m.reward.clout, `Mission: ${m.title}`);
          notify(`MISSION COMPLETE · ${m.title}  +${money(m.reward.cash)} · +${m.reward.clout} clout`, 'mission');
          if (x.trackedMission === m.id) x.trackedMission = null;
        }
        for (const m of doneSide) {
          x.sideDone.push(m.id);
          award(x, m.reward.cash, m.reward.clout, `Side job: ${m.title}`);
          notify(`SIDE JOB COMPLETE · ${m.title}  +${money(m.reward.cash)}`, 'mission');
          if (x.trackedMission === m.id) x.trackedMission = null;
        }
        for (const a of ach) {
          x.achievements.push(a.id);
          award(x, a.reward.cash, a.reward.clout, `Achievement: ${a.name}`);
          notify(`🏆 ACHIEVEMENT · ${a.name}`, 'achievement');
        }
      }, { save: true });
      const lvlAfter = levelFor(get().game.clout);
      if (lvlAfter > levelBefore.v) {
        notify(`CLOUT LEVEL UP · ${CLOUT_LEVELS[lvlAfter].name}! ${CLOUT_LEVELS[lvlAfter].perk}`, 'achievement');
        get().post('Brickell Daily', '@brickelldaily', `${get().game.nickname} is now officially "${CLOUT_LEVELS[lvlAfter].name}". The bounce continues. 📈`, 'npc');
      }
      levelBefore.v = lvlAfter;
      // further completions may have unlocked (e.g. clout from rewards)
      const g2 = get().game;
      if (
        MAIN_MISSIONS.some((m) => !g2.missionsDone.includes(m.id) && m.check(g2)) ||
        ACHIEVEMENTS.some((a) => !g2.achievements.includes(a.id) && a.check(g2))
      ) setTimeout(() => get().checkProgress(), 0);
    },
  };
});

export function currentMission(g: GameState) {
  if (g.trackedMission) {
    const m = [...MAIN_MISSIONS, ...SIDE_MISSIONS].find((x) => x.id === g.trackedMission);
    if (m && !g.missionsDone.includes(m.id) && !g.sideDone.includes(m.id)) return m;
  }
  return MAIN_MISSIONS.find((m) => !g.missionsDone.includes(m.id)) ?? null;
}

export function isEndgameReady(g: GameState) {
  return endgameReady(g);
}

export function watchCollectionValue(g: GameState) {
  return g.watches.reduce((a, id) => a + (WATCHES.find((w) => w.id === id)?.price ?? 0), 0);
}

export const getGame = () => useGame.getState().game;
export const actions = () => useGame.getState();
