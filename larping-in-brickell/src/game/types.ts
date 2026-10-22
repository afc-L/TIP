// Shared types for the persistent game state and static content.

export type BounceStyle = 'executive' | 'brickell' | 'miami';

export interface BounceSettings {
  enabled: boolean;
  style: BounceStyle;
  intensity: number; // 0..1
  rideHeight: number; // -1..1 suspension customization
  stiffness: number; // 0..1
  sfxVolume: number; // 0..1, hydraulic sound effects
}

export interface VehicleMods {
  paint: string;
  accent: string; // second tone (two-tone paint), '' for none
  wheels: string;
  tint: number; // 0..3
  interior: string;
  underglow: string; // '' for off
  engine: number; // 0..3
  handling: number; // 0..3
  chrome: boolean;
}

export interface Contract {
  creatorId: string;
  commission: number; // 0..1 agency share
  durationMonths: number;
  growthStipend: boolean;
  startDay: number;
  endDay: number;
}

export interface SignedCreator {
  id: string;
  contract: Contract;
  audience: number;
  popularity: number; // 1..10 (affects revenue per fan)
  satisfaction: number; // 0..100
  lifetimeCommission: number;
  lastDayGross: number;
  lastDayCommission: number;
  history: number[]; // audience per day (last 30)
  revenueHistory: number[]; // commission per day (last 30)
}

export interface ActiveCampaign {
  id: string; // unique instance
  type: string;
  creatorId: string | null; // null = whole roster
  startDay: number;
  endDay: number;
  outcome: 'flop' | 'solid' | 'viral';
  growthBonus: number; // per day additive growth
}

export interface Txn {
  day: number;
  minute: number;
  label: string;
  amount: number;
  category: string;
}

export interface MonthAcc {
  gross: number;
  commission: number;
  otherIncome: number;
  marketing: number;
  purchases: number;
  incomeBySource: Record<string, number>;
}

export interface MonthReport {
  month: number;
  gross: number;
  commission: number;
  otherIncome: number;
  totalIncome: number;
  expenses: Record<string, number>;
  totalExpenses: number;
  marketing: number;
  net: number;
  cashAfter: number;
  topSources: [string, number][];
  trend: 'up' | 'down' | 'flat';
  cloutChange: number;
}

export interface RivalState {
  clout: number;
  roster: number;
  revenue: number; // per day
  relation: number; // -100..100
  defeated: boolean;
  lastShowdownDay: number;
}

export interface SocialPost {
  id: number;
  day: number;
  author: string;
  handle: string;
  text: string;
  likes: number;
  tone: 'player' | 'rival' | 'npc' | 'creator';
}

export interface DayPoint {
  day: number;
  revenue: number;
  audience: number;
  cash: number;
}

export interface ClubState {
  upgrades: string[];
  lastEventDay: number;
  eventsHosted: number;
  bestAttendance: number;
}

export interface GameState {
  version: number;
  nickname: string;
  cash: number;
  clout: number;
  day: number;
  minute: number; // minutes since midnight
  creators: Record<string, SignedCreator>;
  cooldowns: Record<string, number>; // creatorId -> day available
  lostToRival: Record<string, number>; // creatorId -> day available again
  campaigns: ActiveCampaign[];
  upgrades: string[];
  staff: Record<string, number>;
  vehicles: string[];
  mods: Record<string, VehicleMods>;
  activeVehicle: string;
  bounce: BounceSettings;
  watches: string[];
  equippedWatch: string | null;
  outfits: string[];
  equippedOutfit: string;
  properties: string[];
  home: string;
  club: ClubState;
  yacht: string | null;
  yachtHull: string; // '' = factory finish
  missionsDone: string[];
  sideDone: string[];
  achievements: string[];
  stats: Record<string, number>;
  ledger: Txn[];
  history: DayPoint[];
  month: MonthAcc;
  reports: MonthReport[];
  rivals: Record<string, RivalState>;
  social: SocialPost[];
  contacts: string[];
  eventsDone: Record<string, number>; // event id -> last day completed
  valetDone: Record<string, number>; // poi -> last day flexed
  spawn: { x: number; z: number; yaw: number };
  trackedMission: string | null;
  endgameCelebrated: boolean;
  postId: number;
}

export interface Settings {
  quality: 'low' | 'medium' | 'high';
  shadows: boolean;
  renderScale: number;
  fov: number;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  vehicleFxVolume: number;
  mouseSensitivity: number;
  invertY: boolean;
  showMinimap: boolean;
  rotateMinimap: boolean;
  dayLengthMinutes: number;
  showFps: boolean;
  trafficDensity: number;
}

export type PoiKind =
  | 'home'
  | 'agency'
  | 'cafe'
  | 'dealer'
  | 'watch'
  | 'clothes'
  | 'club'
  | 'rooftop'
  | 'restaurant'
  | 'penthouse'
  | 'garage'
  | 'carmeet'
  | 'marina'
  | 'network'
  | 'hq'
  | 'showoff';

export interface Poi {
  id: string;
  name: string;
  kind: PoiKind;
  x: number;
  z: number;
  // facing direction (radians) of the entrance, used to place NPCs and valets
  face: number;
  radius: number;
  icon: string;
  color: string;
  desc: string;
  valet?: boolean;
}
