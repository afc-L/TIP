// A single run: owns every gameplay system and the damage pipeline. Created fresh on every start.
import * as THREE from 'three';
import { ACHIEVEMENT_MAP } from '../data/achievements';
import { CHALLENGES, type RunSummary } from '../data/challenges';
import { CHARACTER_MAP } from '../data/characters';
import { COSMETIC_MAP } from '../data/cosmetics';
import { ELITE_MODS } from '../data/enemies';
import { MAP_MAP, type MapDef } from '../data/maps';
import { MODIFIER_MAP, type ModifierId } from '../data/modifiers';
import { PASSIVE_MAP } from '../data/passives';
import { SYNERGIES, type SynergyContext, type SynergyFlag } from '../data/synergies';
import type { BossId, CharacterId, Difficulty, Element, MapId, PassiveId, RunMode, StatBlock, StatMod, WeaponId, WeaponTag } from '../data/types';
import { RARITY_POWER, SPECIAL_MAP, STAT_CARDS, type SpecialId } from '../data/upgrades';
import { WEAPON_MAP } from '../data/weapons';
import type { RunResult } from '../store/gameStore';
import { challengeProgress, getSave, useProgression } from '../store/progressionStore';
import { CONFIG, DIFFICULTY, RUN_MODES } from './GameConfig';
import { input } from './Input';
import { audio, type Sfx } from './effects/AudioManager';
import type { DamageNumbers } from './effects/DamageNumbers';
import type { ParticleManager } from './effects/ParticleManager';
import type { ScreenEffects } from './effects/ScreenEffects';
import type { Vfx } from './effects/Vfx';
import { BossController } from './enemies/BossController';
import type { Enemy } from './enemies/Enemy';
import { EnemyManager } from './enemies/EnemyManager';
import { HazardManager } from './enemies/HazardManager';
import { PickupManager, type Chest } from './items/PickupManager';
import { evolutionsAvailable, goldAmount, type Choice } from './items/UpgradeSystem';
import { POWERUP_INFO, type PowerupKind } from './models/propModels';
import { Player } from './player/Player';
import { armorReduce, computeStats } from './player/PlayerStats';
import { SpawnDirector } from './SpawnDirector';
import { chance, pick, rand } from './util';
import { ProjectileManager } from './weapons/Projectile';
import { WeaponManager, type WeaponInstance } from './weapons/WeaponManager';
import { World } from './world/World';

export interface RunOptions { character: CharacterId; map: MapId; mode: RunMode; difficulty: Difficulty; modifiers: ModifierId[] }

export interface RunContext {
  scene: THREE.Scene;
  particles: ParticleManager;
  vfx: Vfx;
  numbers: DamageNumbers;
  screen: ScreenEffects;
  quality: { maxEnemies: number; grassMult: number; propMult: number; shadows: boolean };
}

export interface RunHooks {
  onLevelUp: () => void;
  onBossIntro: (name: string, title: string) => void;
  onAnnounce: (text: string, big: boolean) => void;
  onToast: (icon: string, title: string, text: string, kind: 'achievement' | 'info' | 'evolution') => void;
  onEnd: (victory: boolean) => void;
}

export interface HitOpts {
  crit?: number;
  kb?: number;
  dirX?: number;
  dirZ?: number;
  weapon?: WeaponInstance | null;
  heavy?: boolean;
  quiet?: boolean;
  noNumber?: boolean;
  dot?: boolean;          // damage over time: no knockback, ignores shields
  explosive?: boolean;
  element?: Element;
  forceCrit?: boolean;
  noCrit?: boolean;
}

export interface PlayerHitSource { x: number; z: number; label: string; attacker?: Enemy; major?: boolean; ignoreIframes?: boolean }

/** Aggregated run-modifier multipliers. */
export interface ModAggregate {
  spawn: number; enemyDamage: number; enemyHp: number; enemySpeed: number; elite: number; gold: number;
  playerDamage: number; pickup: number; bossTime: number; heal: number; dash: number; knockback: number; reward: number;
}

type DiceBuff = 'might' | 'haste' | 'swift' | 'fortune' | 'aegis' | 'magnet';
const DICE: Record<DiceBuff, { name: string; icon: string; stats?: StatMod }> = {
  might: { name: 'Might', icon: '💪', stats: { damageMult: 1.4 } },
  haste: { name: 'Haste', icon: '⏱️', stats: { cooldownMult: 0.7 } },
  swift: { name: 'Swiftness', icon: '👟', stats: { moveSpeed: 1.25 } },
  fortune: { name: 'Fortune', icon: '🍀', stats: { luck: 50, goldGain: 1.5 } },
  aegis: { name: 'Aegis', icon: '🛡️', stats: { armor: 10 } },
  magnet: { name: 'Vacuum', icon: '🧲', stats: { pickupRadius: 3 } },
};

const ELEMENT_FX: Record<Element, string[]> = {
  physical: ['#ffffff', '#dee2e6'], fire: ['#ff7b00', '#ffd60a'], lightning: ['#7df9ff', '#ffffff'], poison: ['#80ff72', '#38b000'],
  arcane: ['#c77dff', '#e0aaff'], explosive: ['#ff9f1c', '#495057'], frost: ['#a0e7ff', '#ffffff'],
};

export class Run {
  readonly scene: THREE.Scene;
  readonly particles: ParticleManager;
  readonly vfx: Vfx;
  readonly numbers: DamageNumbers;
  readonly screen: ScreenEffects;
  readonly hooks: RunHooks;
  readonly opts: RunOptions;
  readonly map: MapDef;
  readonly difficulty: (typeof DIFFICULTY)[Difficulty];
  readonly mode: RunMode;
  readonly characterId: CharacterId;
  readonly rm: ModAggregate;
  readonly trait: string | undefined;
  world: World;
  player: Player;
  enemies: EnemyManager;
  projectiles: ProjectileManager;
  weapons: WeaponManager;
  pickups: PickupManager;
  director: SpawnDirector;
  hazards = new HazardManager();
  boss: BossController | null = null;
  stats: StatBlock;
  passives: Partial<Record<PassiveId, number>> = {};
  permanent: Record<string, number>;
  /** Accumulated stat-card increments. */
  cards: StatMod = {};
  specials = new Set<SpecialId>();
  synergies: string[] = [];
  synergyFlags = new Set<SynergyFlag>();
  elementMult: Partial<Record<Element, number>> = {};
  banished = new Set<string>();
  banishes: number;

  time = 0;
  level = 1;
  xp = 0;
  xpNext = CONFIG.xp.toNext(1);
  pendingLevels = 0;
  gold = 0;
  goldEarned = 0;
  kills = 0;
  elites = 0;
  damageDealt = 0;
  damageTaken = 0;
  highestHit = 0;
  bossesDefeated = 0;
  bossIds: BossId[] = [];
  rerolls: number;
  superCharge = 0;
  shrineStacks = 0;
  buffs = { damage: 0, frenzy: 0, shield: 0, totem: 0, overcharge: 0, dice: 0 };
  dice: DiceBuff = 'might';
  blizzardSlow = 1;
  blizzard = false;
  aimPoint: { x: number; z: number } | null = null;
  dead = false;
  victory = false;
  ended = false;
  healed = false;
  evolutions = 0;
  maxSynergies = 0;
  reviveAvailable: boolean;
  private endT = 0;
  private delayed: { t: number; fn: () => void }[] = [];
  private achCheckT = 0;
  private hazardT = 20;
  private chaosT = 20;
  private diceT = 8;
  private lavaT = 0;
  private killHeal = 0;
  private vampT = 0;
  private evoNotified = new Set<WeaponId>();
  unlockedThisRun: string[] = [];
  interactText: string | null = null;
  private interactAct: (() => void) | null = null;
  readonly timelineScale: number;
  readonly trailStyle: string;

  constructor(ctx: RunContext, opts: RunOptions, hooks: RunHooks) {
    this.scene = ctx.scene;
    this.particles = ctx.particles;
    this.vfx = ctx.vfx;
    this.numbers = ctx.numbers;
    this.screen = ctx.screen;
    this.hooks = hooks;
    this.opts = opts;
    this.map = MAP_MAP[opts.map];
    this.difficulty = DIFFICULTY[opts.difficulty];
    this.mode = opts.mode;
    this.characterId = opts.character;
    this.trait = CHARACTER_MAP[opts.character].trait;
    this.timelineScale = RUN_MODES[opts.mode].timeline;
    this.rm = aggregateModifiers(opts.modifiers);
    const save = getSave();
    this.permanent = { ...save.upgrades };
    this.rerolls = CONFIG.levelUp.baseRerolls + (this.permanent.reroll ?? 0) + (this.trait === 'loadedDice' ? 2 : 0);
    this.banishes = 1 + (this.permanent.banish ?? 0);
    this.gold = 15 * (this.permanent.startGold ?? 0);
    this.reviveAvailable = (this.permanent.revive ?? 0) > 0;
    this.trailStyle = COSMETIC_MAP[save.cosmetics.trail]?.value ?? '';

    this.world = new World(this.map, ctx.quality);
    this.scene.add(this.world.group);
    this.stats = this.computeStats();
    this.player = new Player(this.scene, opts.character, this.stats.maxHp, COSMETIC_MAP[save.cosmetics.tint]?.value || undefined);
    this.player.friction = this.map.friction;
    this.player.dashMult = this.rm.dash;
    this.enemies = new EnemyManager(this.scene, ctx.quality.maxEnemies, this.world.radius);
    this.projectiles = new ProjectileManager(this.scene);
    this.weapons = new WeaponManager(this.scene);
    this.weapons.trait = this.trait;
    this.pickups = new PickupManager(this.scene);
    this.director = new SpawnDirector(this);
    this.weapons.add(CHARACTER_MAP[opts.character].weapon, this.stats);
    this.pickups.setupWorld(this);
    this.evaluateSynergies(false);
    useProgression.getState().markDiscovered([CHARACTER_MAP[opts.character].weapon, 'map:' + opts.map, ...opts.modifiers.map((m) => 'mod:' + m)]);
  }

  get timeline() { return this.time * this.timelineScale; }
  get timelineMinutes() { return this.timeline / 60; }
  get hpRatio() { return this.player.hp / this.stats.maxHp; }

  private computeStats(): StatBlock {
    const factors: StatMod[] = [];
    for (const id of this.synergies) { const s = SYNERGIES.find((x) => x.id === id); if (s?.stats) factors.push(s.stats); }
    for (const id of this.specials) { const s = SPECIAL_MAP[id]; if (s.stats) factors.push(s.stats); }
    if (this.rm.pickup !== 1) factors.push({ pickupRadius: this.rm.pickup });
    if (this.rm.playerDamage !== 1) factors.push({ damageMult: this.rm.playerDamage });
    if (this.rm.heal !== 1) factors.push({ healMult: this.rm.heal });
    if (this.shrineStacks) factors.push({ damageMult: 1 + 0.12 * this.shrineStacks });
    if (this.buffs.damage > 0) factors.push({ damageMult: 1.5 });
    if (this.buffs.frenzy > 0) factors.push({ cooldownMult: 0.6 });
    if (this.buffs.totem > 0) factors.push({ cooldownMult: 0.5, damageMult: 1.25 });
    if (this.buffs.overcharge > 0) factors.push({ cooldownMult: 1.3 });
    if (this.buffs.dice > 0 && DICE[this.dice].stats) factors.push(DICE[this.dice].stats!);
    if (this.blizzard) factors.push({ moveSpeed: 0.85 });
    if (this.trait === 'gunslinger') factors.push({ extraProjectiles: 1 });
    return computeStats({ character: this.characterId, permanent: this.permanent, passives: this.passives, cards: this.cards, factors });
  }

  recomputeStats() {
    const oldMax = this.stats.maxHp;
    this.stats = this.computeStats();
    if (this.stats.maxHp > oldMax && this.time > 0) this.player.hp += this.stats.maxHp - oldMax;
    this.player.hp = Math.min(this.player.hp, this.stats.maxHp);
    this.player.dodgeCooldownMult = this.stats.dodgeCooldown;
    this.weapons.recompute(this.stats);
  }

  sfx(s: Sfx, pitch = 1) { audio.play(s, pitch); }
  announce(text: string, big = false) { this.hooks.onAnnounce(text, big); }
  schedule(t: number, fn: () => void) { this.delayed.push({ t, fn }); }

  // ================= update =================
  update(dt: number) {
    if (this.ended) return;
    this.time += dt;
    for (let i = this.delayed.length - 1; i >= 0; i--) {
      const d = this.delayed[i];
      d.t -= dt;
      if (d.t <= 0) { this.delayed.splice(i, 1); if (!this.ended) d.fn(); }
    }
    const p = this.player;
    if (p.alive && !this.victory) {
      if (input.consume('dodge') && p.tryDodge()) {
        this.sfx('dodge');
        this.particles.burst(p.x, 0.4, p.z, 8, '#ffffff', 3, 0.18, 0.35);
      }
      if (input.consume('super')) this.superBonk();
      if (input.consume('interact') && this.interactAct) this.interactAct();
    } else input.clearPresses();

    p.update(dt, this.stats, this.world, this.aimPoint);
    this.emitTrail(dt);
    if (!this.dead && !this.victory) {
      this.director.update(dt);
      this.updateMapHazard(dt);
      this.updateRunEvents(dt);
    }
    this.enemies.update(dt, this);
    if (this.boss) {
      this.boss.update(dt, this);
      if (this.boss.dead) {
        this.boss.dispose();
        this.boss = null;
        if (!this.victory) audio.music(this.map.music === 1 ? 'game1' : this.map.music === 2 ? 'game2' : 'game0');
      }
    }
    this.weapons.update(dt, this);
    this.projectiles.update(dt, this);
    this.hazards.update(dt, this);
    this.pickups.update(dt, this);

    // buffs
    let changed = false;
    for (const k of Object.keys(this.buffs) as (keyof Run['buffs'])[]) {
      if (this.buffs[k] > 0) {
        this.buffs[k] -= dt;
        if (this.buffs[k] <= 0) { this.buffs[k] = 0; if (k !== 'shield') changed = true; }
      }
    }
    if (changed) this.recomputeStats();
    if (p.alive) {
      let regen = this.stats.regen;
      if (this.synergyFlags.has('survivor') && this.hpRatio < 0.4) regen *= 3;
      if (regen > 0) p.hp = Math.min(this.stats.maxHp, p.hp + regen * this.stats.healMult * dt);
    }
    this.vampT = Math.max(0, this.vampT - dt * 4);

    // interaction prompt
    const it = p.alive ? this.pickups.nearestInteractable(this) : null;
    this.interactText = it?.text ?? null;
    this.interactAct = it?.act ?? null;

    this.achCheckT -= dt;
    if (this.achCheckT <= 0) { this.achCheckT = 0.5; this.checkAchievements(); }

    if (this.dead || this.victory) {
      this.endT -= dt;
      if (this.victory && Math.random() < 0.5) {
        const a = Math.random() * Math.PI * 2;
        this.particles.emit(p.x + Math.cos(a) * 3, 6, p.z + Math.sin(a) * 3, rand(-3, 3), rand(2, 6), rand(-3, 3), 1.6, 0.18, pick(['#ffd60a', '#ff4d6d', '#4cc9f0', '#80ff72', '#c77dff']), 6);
      }
      if (this.endT <= 0 && !this.ended) {
        this.ended = true;
        this.hooks.onEnd(this.victory);
      }
    } else if (this.pendingLevels > 0) {
      this.hooks.onLevelUp();
    }
  }

  private trailT = 0;
  private emitTrail(dt: number) {
    const p = this.player;
    if (!this.trailStyle || !p.alive) return;
    this.trailT -= dt;
    const moving = Math.hypot(p.vx, p.vz) > 2;
    if (this.trailT > 0 || !moving) return;
    this.trailT = p.dodging ? 0.01 : 0.05;
    const colors: Record<string, string[]> = {
      dust: ['#c2a878', '#a98467'], fire: ['#ff5400', '#ffd60a'], shadow: ['#240046', '#3c096c'],
      sparkle: ['#ffffff', '#ffd60a', '#a0e7ff'], rainbow: ['#ff4d6d', '#ff9f1c', '#ffd60a', '#80ff72', '#4cc9f0', '#c77dff'],
    };
    const c = colors[this.trailStyle] ?? ['#ffffff'];
    this.particles.emit(p.x + rand(-0.3, 0.3), 0.3, p.z + rand(-0.3, 0.3), 0, this.trailStyle === 'fire' ? 1.5 : 0.6, 0, 0.6, 0.14, c[Math.floor(this.time * 10) % c.length], this.trailStyle === 'dust' ? 3 : -0.5);
  }

  /** Map-specific environmental hazards and bonuses. */
  private updateMapHazard(dt: number) {
    const p = this.player;
    const hz = this.map.hazard;
    this.hazardT -= dt;
    if (hz === 'lava') {
      this.lavaT -= dt;
      if (this.lavaT <= 0) {
        this.lavaT = 0.5;
        for (const pool of this.world.lavaPools) {
          if ((p.x - pool.x) ** 2 + (p.z - pool.z) ** 2 < (pool.r - 0.3) ** 2 && !p.dodging) this.damagePlayer(6 + this.timelineMinutes * 0.8, { x: pool.x, z: pool.z, label: 'Lava', ignoreIframes: false });
          this.enemies.grid.query(pool.x, pool.z, pool.r, (e) => { this.burn(e, 8 + this.timelineMinutes * 4); });
        }
      }
    }
    if (this.hazardT > 0) return;
    switch (hz) {
      case 'fruit': {
        this.hazardT = 45;
        const a = Math.random() * Math.PI * 2;
        const pos = { x: p.x + Math.cos(a) * 7, z: p.z + Math.sin(a) * 7 };
        this.world.resolve(pos, 1);
        this.pickups.powerup('health', pos.x, pos.z);
        this.announce('A healing fruit has grown nearby!');
        break;
      }
      case 'crystals': {
        this.hazardT = 18;
        for (let i = 0; i < 5; i++) {
          const x = p.x + rand(-8, 8), z = p.z + rand(-8, 8);
          this.hazards.add({ shape: 'circle', x, z, r: 2.1, warn: 1.5, damage: 14 * this.difficulty.damage * (1 + this.timelineMinutes * 0.06), label: 'Crystal Eruption', color: '#ff4ecd', onTrigger: (run) => {
            run.particles.burst(x, 0.5, z, 14, pick(this.map.palette.crystals), 6, 0.25, 0.6);
            run.enemies.grid.query(x, z, 2.1, (e) => { run.hitEnemy(e, 40 + run.timelineMinutes * 25, { element: 'arcane', quiet: true }); });
            run.sfx('shard');
          } }, this);
        }
        break;
      }
      case 'firejets': {
        this.hazardT = 22;
        for (let i = 0; i < 2; i++) {
          const a = Math.random() * Math.PI;
          const L = this.world.radius * 2;
          const off = (i - 0.5) * 6;
          const sx = p.x - Math.cos(a) * L / 2 - Math.sin(a) * off, sz = p.z - Math.sin(a) * L / 2 + Math.cos(a) * off;
          this.hazards.add({ shape: 'rect', x: sx, z: sz, angle: a, length: L, width: 2.4, warn: 1.8, damage: 16 * this.difficulty.damage * (1 + this.timelineMinutes * 0.06), label: 'Fire Jet', color: '#ff7b00', onTrigger: (run) => {
            for (let k = 0; k < 20; k++) { const t = Math.random() * L; run.particles.emit(sx + Math.cos(a) * t, 0.3, sz + Math.sin(a) * t, 0, 6, 0, 0.6, 0.3, pick(['#ff5400', '#ffd60a']), 4); }
            run.enemies.pool.forEach((e) => {
              if (!e.alive || e.kind === 'boss') return;
              const rx = e.x - sx, rz = e.z - sz, along = rx * Math.cos(a) + rz * Math.sin(a), side = -rx * Math.sin(a) + rz * Math.cos(a);
              if (along > 0 && along < L && Math.abs(side) < 1.4) run.burn(e, 30);
            });
            run.sfx('burn');
          } }, this);
        }
        break;
      }
      case 'blizzard': {
        this.blizzard = !this.blizzard;
        this.hazardT = this.blizzard ? 12 : 30;
        this.blizzardSlow = this.blizzard ? 0.75 : 1;
        this.world.setBlizzard(this.blizzard);
        this.recomputeStats();
        this.announce(this.blizzard ? 'A blizzard rolls in! Everything slows down.' : 'The blizzard passes.');
        break;
      }
      case 'lava': {
        this.hazardT = 25;
        for (let i = 0; i < 4; i++) {
          const x = p.x + rand(-9, 9), z = p.z + rand(-9, 9);
          this.particles.emit(x, 12, z, 0, -2, 0, 1.4, 0.5, '#ff5400', 6);
          this.hazards.add({ shape: 'circle', x, z, r: 2.4, warn: 1.4, damage: 18 * this.difficulty.damage * (1 + this.timelineMinutes * 0.06), label: 'Eruption', color: '#ff5400', onTrigger: (run) => {
            run.vfx.ring(x, z, 0.3, 2.6, '#ff5400', 0.4);
            run.particles.burst(x, 0.5, z, 18, '#ff7b00', 6, 0.28, 0.6);
            run.enemies.grid.query(x, z, 2.4, (e) => { run.hitEnemy(e, 30 + run.timelineMinutes * 20, { element: 'fire', quiet: true }); run.burn(e, 20); });
            run.sfx('explode');
          } }, this);
        }
        this.announce('The ground rumbles — eruption incoming!');
        break;
      }
    }
  }

  /** Chaos Magic modifier and the Gambler's dice. */
  private updateRunEvents(dt: number) {
    const p = this.player;
    if (this.opts.modifiers.includes('chaosMagic')) {
      this.chaosT -= dt;
      if (this.chaosT <= 0) {
        this.chaosT = 20;
        const roll = Math.floor(Math.random() * 5);
        if (roll === 0) {
          this.announce('CHAOS: Gifts from the sky!');
          for (let i = 0; i < 3; i++) this.pickups.powerup(pick(['health', 'damage', 'frenzy', 'shield', 'magnet', 'bomb'] as PowerupKind[]), p.x + rand(-6, 6), p.z + rand(-6, 6));
        } else if (roll === 1) {
          this.announce('CHAOS: Time freeze!');
          for (const e of this.enemies.pool) if (e.alive && e.kind !== 'boss') { e.slowT = 3; e.slowFactor = 0.1; e.lastElement = 'frost'; }
        } else if (roll === 2) {
          this.announce('CHAOS: Meteor shower!');
          for (let i = 0; i < 8; i++) {
            const x = p.x + rand(-12, 12), z = p.z + rand(-12, 12);
            this.schedule(i * 0.15, () => this.explode(x, z, 2.5, 60 + this.timelineMinutes * 30, { kb: 6, crit: 0, color: '#ff7b00', quiet: true, element: 'fire' }));
          }
        } else if (roll === 3) {
          this.announce('CHAOS: The horde is frenzied!');
          this.blizzardSlow = 1.35;
          this.schedule(5, () => { this.blizzardSlow = this.blizzard ? 0.75 : 1; });
        } else {
          this.announce('CHAOS: Gold rain!');
          for (let i = 0; i < 15; i++) this.pickups.coin(p.x + rand(-6, 6), p.z + rand(-6, 6), 2);
        }
      }
    }
    if (this.trait === 'loadedDice') {
      this.diceT -= dt;
      if (this.diceT <= 0) {
        this.diceT = 25;
        this.dice = pick(Object.keys(DICE) as DiceBuff[]);
        this.buffs.dice = 12;
        if (this.dice === 'magnet') this.pickups.magnetAll();
        this.recomputeStats();
        this.hooks.onToast('🎲', 'LOADED DICE', `${DICE[this.dice].icon} ${DICE[this.dice].name} for 12s`, 'info');
        this.sfx('rare');
      }
    }
  }

  updateIntro(dt: number) {
    if (this.boss) this.boss.updateIntro(dt, this);
  }

  render(time: number, camera: THREE.Camera) {
    this.player.render(time, this.buffs.shield > 0);
    this.enemies.render(time, camera);
    this.projectiles.render();
    this.pickups.render(time);
    this.weapons.render(this);
    this.boss?.render(time, this);
  }

  // ================= damage pipeline =================
  hitEnemy(e: Enemy, base: number, o: HitOpts = {}): { damage: number; crit: boolean; killed: boolean } {
    if (!e.alive || e.hidden) return { damage: 0, crit: false, killed: false };
    if (e.kind === 'boss' && this.boss?.state === 'intro') return { damage: 0, crit: false, killed: false };
    const s = this.stats;
    const element: Element = o.element ?? o.weapon?.def.element ?? 'physical';
    let dmg = base * rand(0.92, 1.08);
    dmg *= this.elementMult[element] ?? 1;
    const def = e.def;
    if (def?.resist?.[element]) dmg *= def.resist[element]!;
    if (def?.armor && !o.dot) dmg *= 1 - def.armor;
    if (e.mods.includes('armored')) dmg *= 0.6;
    if (e.shockT > 0) dmg *= 1.2;
    if (this.specials.has('giantSlayer') && (e.elite || e.kind === 'ogre' || e.kind === 'boss')) dmg *= 1.5;
    const missing = 1 - Math.max(0, Math.min(1, this.hpRatio));
    if (this.specials.has('lastStand')) dmg *= 1 + 0.6 * missing;
    if (this.trait === 'bloodRage') dmg *= 1 + 0.7 * missing;
    // Shield Knight: frontal block unless the hit is an explosion or damage over time
    let blocked = false;
    if (e.kind === 'shieldKnight' && !o.dot && element !== 'explosive' && !o.explosive) {
      const sx = o.dirX !== undefined ? -o.dirX : this.player.x - e.x;
      const sz = o.dirZ !== undefined ? -o.dirZ! : this.player.z - e.z;
      const fa = Math.atan2(sz, sx);
      let d = fa - e.facing; d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) < 1.05) {
        dmg *= 0.2; blocked = true;
        if (Math.random() < 0.25) { this.numbers.label(e.x, 2.3, e.z, 'BLOCK', 'ft-label'); this.sfx('block'); this.particles.burst(e.x + Math.cos(e.facing) * 0.6, 1, e.z + Math.sin(e.facing) * 0.6, 4, '#ffd166', 4, 0.1, 0.2); }
      }
    }
    const crit = !o.noCrit && !blocked && (o.forceCrit || Math.random() < s.critChance + (o.crit ?? 0));
    if (crit) dmg *= s.critDamage;
    this.damageDealt += Math.min(dmg, e.hp);
    e.hp -= dmg;
    e.flash = o.dot ? Math.max(e.flash, 0.4) : 1;
    e.lastElement = element;
    if (dmg > this.highestHit) this.highestHit = dmg;
    // status effects
    if (element === 'lightning') e.shockT = 2 * s.statusDuration;
    if (element === 'frost' || this.trait === 'frostbite') { e.slowT = 1.5 * s.statusDuration; e.slowFactor = 0.65; e.lastElement = 'frost'; }
    // knockback
    const kb = o.dot ? 0 : (o.kb ?? 0) * (1 - e.kbResist) * this.rm.knockback;
    if (kb > 0) {
      let dx = o.dirX, dz = o.dirZ;
      if (dx === undefined || dz === undefined) {
        const l = Math.hypot(e.x - this.player.x, e.z - this.player.z) || 1;
        dx = (e.x - this.player.x) / l; dz = (e.z - this.player.z) / l;
      }
      e.vx += dx * kb * (o.heavy ? 1.3 : 1);
      e.vz += dz * kb * (o.heavy ? 1.3 : 1);
    }
    if (!o.noNumber) this.numbers.damage(e.x, (e.def?.height ?? 4) * e.scale + 0.3, e.z, dmg, crit, false, element);
    if (!o.quiet) this.sfx(crit ? 'crit' : 'hit');
    if (crit) {
      if (o.heavy) { this.screen.stop(0.04); this.screen.shake(0.1); }
      if (!o.dot && Math.random() < 0.5) this.vfx.ring(e.x, e.z, 0.2, 1 + e.radius, '#ffd60a', 0.18, 0.9, 1);
      if (this.specials.has('vampireTouch') && this.vampT < 4) { this.vampT += 0.4; this.heal(0.4, false); }
    }
    if (!o.dot && Math.random() < 0.6 * this.particles.scale) {
      const fx = ELEMENT_FX[element];
      this.particles.burst(e.x, 0.8 * e.scale, e.z, crit ? 5 : 2, fx[Math.floor(Math.random() * fx.length)], element === 'lightning' ? 6 : 3, 0.1, 0.25, element === 'fire' ? 3 : 4, element === 'fire' ? -3 : 14);
    }
    if (this.specials.has('unstableCore') && !o.dot && !o.explosive && element !== 'explosive' && Math.random() < 0.08) {
      this.schedule(0.05, () => this.explode(e.x, e.z, 2.2, base * 0.8 + 10, { kb: 4, crit: 0, color: '#c7f464', quiet: true, small: true }));
    }
    let killed = false;
    if (e.hp <= 0) { killed = true; this.killEnemy(e, o.weapon, element, o.explosive || element === 'explosive'); }
    return { damage: dmg, crit, killed };
  }

  burn(e: Enemy, dps: number) {
    if (!e.alive) return;
    e.burnT = 3 * this.stats.statusDuration;
    e.burnDps = Math.max(e.burnDps * (e.burnT > 0 ? 1 : 0), dps * this.stats.dotMult);
    if (e.burnTick <= 0) e.burnTick = 0.5;
  }

  heal(amount: number, fromItem: boolean) {
    const p = this.player;
    if (!p.alive) return;
    const v = amount * this.stats.healMult;
    p.hp = Math.min(this.stats.maxHp, p.hp + v);
    if (fromItem) this.healed = true;
  }

  killEnemy(e: Enemy, killer?: WeaponInstance | null, element: Element = 'physical', byExplosion = false) {
    if (!e.alive) return;
    if (e.telegraph) { this.vfx.release(e.telegraph); e.telegraph = null; }
    this.enemies.markDead(e);
    if (e.kind === 'boss') { this.onBossDefeated(); return; }
    this.kills++;
    if (e.elite) this.elites++;
    const def = e.def!;
    const color = e.elite ? '#ffd166' : def.color;
    // death effects by type
    switch (def.deathFx) {
      case 'splat': this.particles.burst(e.x, 0.4 * e.scale, e.z, 12, color, 5 * Math.sqrt(e.scale), 0.22 * e.scale, 0.6, 2); break;
      case 'poof': this.particles.burst(e.x, 0.8, e.z, 10, '#dee2e6', 2.5, 0.3, 0.5, 2, -2); this.particles.burst(e.x, 0.8, e.z, 5, color, 4, 0.15, 0.5); break;
      case 'spirit': this.particles.burst(e.x, 1, e.z, 10, color, 2, 0.2, 0.9, 5, -5); break;
      case 'debris': this.particles.burst(e.x, 1, e.z, 14, color, 6, 0.3 * e.scale, 0.8, 5); this.particles.burst(e.x, 1, e.z, 6, '#6c757d', 5, 0.25, 0.8, 5); break;
      case 'burst': this.particles.burst(e.x, 0.7, e.z, 16, '#ff9f1c', 7, 0.22, 0.45); break;
      case 'bugs': this.particles.burst(e.x, 0.3, e.z, 5, color, 3, 0.1, 0.35); break;
    }
    if (e.elite) this.particles.burst(e.x, 1, e.z, 18, color, 6, 0.25, 0.8);
    if (Math.random() < 0.35) this.sfx('kill');
    this.superCharge = Math.min(1, this.superCharge + (this.specials.has('overcharged') ? 2 : 1) / CONFIG.player.superKills);
    // loot
    const luck = 1 + this.stats.luck / 100;
    if (!e.summoned || Math.random() < 0.4) this.pickups.gem(e.x, e.z, e.xp);
    if (chance(e.goldChance * luck)) {
      const n = e.elite ? 6 : e.kind === 'ogre' ? 12 : 1;
      for (let i = 0; i < n; i++) this.pickups.coin(e.x, e.z, 1 + Math.floor(this.timelineMinutes / 5));
    }
    if (killer?.id === 'goldenCannon' && Math.random() < (killer.evolved ? 1 : 0.3)) for (let i = 0; i < (killer.evolved ? 3 : 1); i++) this.pickups.coin(e.x, e.z, 1 + Math.floor(this.timelineMinutes / 5));
    const treasure = this.synergyFlags.has('treasure');
    const eliteChest = 0.2 + (this.permanent.eliteDrops ?? 0) * 0.1;
    if (e.dropsChest || (e.elite && (treasure || Math.random() < eliteChest))) {
      this.pickups.addChest(e.x, e.z, true, 0, e.kind === 'ogre' ? 2 : 1);
      this.announce(e.kind === 'ogre' ? 'The mini-boss dropped a golden chest!' : 'An elite dropped a golden chest!');
    } else if (e.elite) {
      this.pickups.gem(e.x, e.z, e.xp * 0.5);
      if (Math.random() < (this.specials.has('treasureInstinct') ? 0.8 : 0.35)) this.pickups.powerup(pick(['health', 'magnet', 'bomb', 'frenzy', 'shield', 'damage'] as PowerupKind[]), e.x, e.z);
    } else if (chance(0.006 * luck * (this.specials.has('treasureInstinct') ? 2 : 1))) {
      const hpLow = this.hpRatio < 0.5;
      const kinds: PowerupKind[] = ['health', 'damage', 'magnet', 'bomb', 'frenzy', 'shield', 'bigGold'];
      this.pickups.powerup(hpLow && Math.random() < 0.5 ? 'health' : pick(kinds), e.x, e.z);
    }
    // death behaviours
    if (e.kind === 'bigSlime') {
      const n = e.elite ? 5 : 3;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const s = this.enemies.spawn('slime', e.x + Math.cos(a) * 0.8, e.z + Math.sin(a) * 0.8, this, { summoned: true, hpMult: 0.7 });
        if (s) { s.vx = Math.cos(a) * 6; s.vz = Math.sin(a) * 6; }
      }
    } else if (e.kind === 'exploder') {
      this.exploderDetonate(e, false);
    }
    if (e.mods.includes('explosive')) {
      const x = e.x, z = e.z, dmg = e.damage * 1.2;
      this.hazards.add({ shape: 'circle', x, z, r: 3.2, warn: 0.7, damage: dmg, label: ELITE_MODS.explosive.name, color: '#ff9f1c', onTrigger: (run) => {
        run.vfx.ring(x, z, 0.3, 3.3, '#ff9f1c', 0.4); run.particles.burst(x, 0.6, z, 20, '#ff9f1c', 7, 0.3, 0.5); run.sfx('explode'); run.screen.shake(0.15);
      } }, this);
    }
    if (e.burnT > 0 && this.synergyFlags.has('burnSpread')) {
      let n = 0;
      this.enemies.grid.query(e.x, e.z, 3, (o) => { if (n++ < 4) this.burn(o, e.burnDps / this.stats.dotMult); });
    }
    if (byExplosion && this.specials.has('chainReaction') && Math.random() < 0.3) {
      const x = e.x, z = e.z, d = 20 + this.timelineMinutes * 12;
      this.schedule(0.12, () => this.explode(x, z, 2.4, d * this.stats.damageMult, { kb: 5, crit: 0, color: '#ff595e', quiet: true, small: true }));
    }
    if (e.poisonT > 0 && this.weapons.plagueGarden) {
      const w = this.weapons.get('poison')!;
      if (Math.random() < 0.35) this.weapons.addCloud(e.x, e.z, w.stats.area * 0.7, 2.5, w.stats.damage * 0.6, w);
      this.heal(0.5, false);
    }
    if (this.trait === 'bloodRage' && ++this.killHeal >= 20) { this.killHeal = 0; this.heal(2, false); }
    this.weapons.onKill(e, killer, this);
  }

  /** Boom Bug detonation. A fuse explosion hurts the player; a death pop only hurts enemies. */
  exploderDetonate(e: Enemy, byFuse: boolean) {
    const r = CONFIG.enemies.exploderRadius * (e.elite ? 1.5 : 1);
    if (e.telegraph) { this.vfx.release(e.telegraph); e.telegraph = null; }
    this.vfx.ring(e.x, e.z, 0.4, r, '#ff595e', 0.4, 1);
    this.particles.burst(e.x, 0.6, e.z, 22, '#ff9f1c', 8, 0.3, 0.55);
    this.sfx('explode');
    this.screen.shake(byFuse ? 0.25 : 0.12);
    if (byFuse) {
      const p = this.player;
      if ((p.x - e.x) ** 2 + (p.z - e.z) ** 2 < (r + p.radius * 0.5) ** 2) this.damagePlayer(e.damage, { x: e.x, z: e.z, label: 'Boom Bug' });
      if (e.alive) {
        this.enemies.markDead(e);
        this.pickups.gem(e.x, e.z, e.xp * 0.5);
      }
    }
    this.enemies.grid.query(e.x, e.z, r, (o) => {
      if (o === e || o.kind === 'boss') return;
      const dx = o.x - e.x, dz = o.z - e.z, d = Math.hypot(dx, dz) || 1;
      this.hitEnemy(o, (byFuse ? 15 : 25) * this.stats.explosiveMult * (1 + this.timelineMinutes * 0.15), { kb: 8, dirX: dx / d, dirZ: dz / d, quiet: true, explosive: true, element: 'explosive' });
    });
    this.pickups.breakBarrelsIn(e.x, e.z, r, this);
  }

  explode(x: number, z: number, r: number, dmg: number, o: { kb: number; crit: number; weapon?: WeaponInstance | null; color: string; quiet?: boolean; small?: boolean; element?: Element }) {
    if (this.synergyFlags.has('blastRadius')) r *= 1.25;
    this.vfx.ring(x, z, 0.3, r, o.color, 0.4, 1);
    if (!o.small) this.vfx.ring(x, z, 0.2, r * 0.6, '#ffffff', 0.25, 0.7);
    this.particles.burst(x, 0.5, z, o.small ? 8 : 16, o.color, r * 2.5, 0.28, 0.5);
    if (!o.small) this.particles.burst(x, 0.5, z, 6, '#495057', r * 1.5, 0.35, 0.8, 3, 2);
    this.sfx('explode');
    if (!o.quiet) this.screen.shake(0.15);
    this.enemies.grid.query(x, z, r, (e) => {
      const dx = e.x - x, dz = e.z - z, d = Math.hypot(dx, dz) || 1;
      this.hitEnemy(e, dmg, { crit: o.crit, kb: o.kb, dirX: dx / d, dirZ: dz / d, weapon: o.weapon, quiet: true, explosive: true, element: o.element ?? 'explosive' });
    });
    this.pickups.breakBarrelsIn(x, z, r, this);
  }

  damagePlayer(amount: number, src: PlayerHitSource): boolean {
    const p = this.player;
    if (!p.alive || this.victory) return false;
    if (p.invulnerable && !src.ignoreIframes) return false;
    if (this.buffs.shield > 0) {
      this.buffs.shield = 0;
      p.invuln = CONFIG.player.hurtInvulnerability;
      this.vfx.ring(p.x, p.z, 0.5, 3, '#90e0ef', 0.3);
      this.numbers.label(p.x, 2.4, p.z, 'BLOCKED!', 'ft-label');
      this.sfx('block');
      return true;
    }
    let armor = this.stats.armor;
    if (this.synergyFlags.has('survivor') && this.hpRatio < 0.4) armor += 6;
    const dmg = armorReduce(amount, armor);
    p.hp -= dmg;
    this.damageTaken += dmg;
    p.invuln = CONFIG.player.hurtInvulnerability;
    p.hurtFlash = 1;
    if (src.major && this.boss) this.boss.majorHits++;
    const dx = p.x - src.x, dz = p.z - src.z, d = Math.hypot(dx, dz) || 1;
    const kb = 6 * (1 - this.stats.knockbackResist);
    p.knockX += (dx / d) * kb; p.knockZ += (dz / d) * kb;
    this.numbers.damage(p.x, 2.4, p.z, dmg, false, true);
    this.screen.shake(0.25 + Math.min(0.3, dmg / this.stats.maxHp));
    this.screen.flash('rgba(255,30,30,0.9)', 0.45);
    this.sfx('hurt');
    if (src.attacker?.mods.includes('vampiric') && src.attacker.alive) {
      src.attacker.hp = Math.min(src.attacker.maxHp, src.attacker.hp + dmg * 3);
      this.particles.burst(src.attacker.x, 1, src.attacker.z, 6, '#9d0208', 3, 0.15, 0.4);
    }
    // thorns
    if (src.attacker && this.stats.thorns > 0 && src.attacker.alive) {
      const lvl = this.passives.thorns ?? 0;
      this.hitEnemy(src.attacker, amount * this.stats.thorns + 4 * lvl, { kb: 4, quiet: true });
    }
    if (p.hp <= 0) {
      if (this.reviveAvailable) {
        this.reviveAvailable = false;
        p.hp = this.stats.maxHp * 0.4;
        p.invuln = 2.5;
        this.announce('SECOND LIFE!', true);
        this.sfx('levelup');
        this.vfx.ring(p.x, p.z, 0.5, 8, '#ffffff', 0.6);
        this.enemies.grid.query(p.x, p.z, 8, (e) => { const ex = e.x - p.x, ez = e.z - p.z, l = Math.hypot(ex, ez) || 1; e.vx += ex / l * 20; e.vz += ez / l * 20; });
        return true;
      }
      p.hp = 0;
      p.alive = false;
      this.dead = true;
      this.endT = 1.1;
      this.sfx('gameover');
      this.screen.flash('rgba(120,0,0,1)', 0.7);
      this.particles.burst(p.x, 1, p.z, 30, '#ff4d6d', 6, 0.3, 0.8);
      this.announce('BONKED!', true);
      this.hazards.clear(this);
    }
    return true;
  }

  superBonk() {
    if (this.superCharge < 1) { if (this.superCharge > 0.05) this.sfx('deny'); return; }
    this.superCharge = 0;
    const p = this.player;
    const R = CONFIG.player.superRadius * Math.sqrt(this.stats.areaMult);
    const dmg = (60 + this.level * 14) * this.stats.damageMult * this.stats.explosiveMult;
    this.vfx.ring(p.x, p.z, 0.5, R, '#ffd60a', 0.6, 1);
    this.vfx.ring(p.x, p.z, 0.5, R * 0.75, '#ff6b35', 0.5, 0.9);
    this.vfx.ring(p.x, p.z, 0.5, R * 0.5, '#ffffff', 0.4, 0.8);
    this.particles.ring(p.x, p.z, 1, 40, '#ffd60a', 12, 0.35);
    this.screen.shake(0.7);
    this.screen.flash('rgba(255,214,10,0.9)', 0.5);
    this.screen.stop(0.08);
    this.sfx('super');
    this.announce('SUPER BONK!', true);
    p.invuln = Math.max(p.invuln, 0.6);
    p.attackAnim = 1;
    this.enemies.grid.query(p.x, p.z, R, (e) => {
      const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz) || 1;
      this.hitEnemy(e, dmg, { kb: 22, dirX: dx / d, dirZ: dz / d, heavy: true, quiet: true, element: 'explosive' });
    });
    for (const pr of this.projectiles.pool) if (pr.active && pr.enemy && (pr.x - p.x) ** 2 + (pr.z - p.z) ** 2 < R * R) pr.active = false;
    this.pickups.breakBarrelsIn(p.x, p.z, R, this);
    if (this.specials.has('overcharged')) { this.buffs.overcharge = 6; this.recomputeStats(); }
  }

  // ================= progression within the run =================
  gainXp(v: number) {
    if (!this.player.alive) return;
    this.xp += v * this.stats.xpGain;
    this.sfx('xp');
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.pendingLevels++;
      this.xpNext = CONFIG.xp.toNext(this.level);
    }
  }

  gainGold(v: number) {
    if (!this.player.alive) return;
    const amt = Math.max(1, Math.round(v * this.stats.goldGain * this.map.goldMult * this.rm.gold));
    this.gold += amt;
    this.goldEarned += amt;
    this.sfx('gold');
  }

  applyPowerup(kind: PowerupKind, x: number, z: number) {
    const info = POWERUP_INFO[kind];
    this.numbers.label(x, 2, z, `${info.icon} ${info.name}`, 'ft-pickup');
    this.sfx(kind === 'bigGold' || kind === 'frenzy' ? 'rare' : 'pickup');
    this.particles.burst(x, 0.8, z, 12, info.color, 4, 0.18, 0.5);
    switch (kind) {
      case 'health': this.heal(this.stats.maxHp * 0.3, true); this.sfx('heal'); break;
      case 'damage': this.buffs.damage = 15; this.recomputeStats(); break;
      case 'frenzy': this.buffs.frenzy = 15; this.recomputeStats(); break;
      case 'shield': this.buffs.shield = 20; break;
      case 'magnet': this.pickups.magnetAll(); break;
      case 'bomb':
        this.explode(this.player.x, this.player.z, 10, (80 + this.timelineMinutes * 40) * this.stats.damageMult, { kb: 16, crit: 0, color: '#ff9f1c' });
        this.screen.shake(0.5);
        break;
      case 'bigGold': for (let i = 0; i < 10; i++) this.pickups.coin(x, z, 2 + Math.floor(this.timelineMinutes / 5)); break;
    }
  }

  openChest(c: Chest) {
    if (c.opened) return;
    if (!c.golden) {
      if (this.gold < c.cost) {
        this.sfx('deny');
        this.numbers.label(c.x, 2, c.z, `Need ${c.cost} gold`, 'ft-label');
        return;
      }
      this.gold -= c.cost;
    }
    c.opened = true;
    this.pickups.chestsOpened++;
    this.sfx('chest');
    this.particles.burst(c.x, 1, c.z, 30, c.golden ? '#ffd60a' : '#ffffff', 6, 0.2, 0.9, 7);
    this.vfx.ring(c.x, c.z, 0.5, 4, '#ffd60a', 0.5);
    const results: string[] = [];
    for (let i = 0; i < c.rewards; i++) results.push(this.chestReward(c.golden));
    this.hooks.onToast('🎁', c.golden ? 'GOLDEN CHEST' : 'CHEST', results.join(' · '), 'info');
  }

  private chestReward(golden: boolean): string {
    const evos = evolutionsAvailable(this);
    const evoBias = (this.permanent.evolution ?? 0) > 0 ? 1 : 0.85;
    if (evos.length && Math.random() < evoBias) {
      this.applyChoice({ kind: 'evolution', id: evos[0], rarity: 'evolution' });
      return `Evolved ${WEAPON_MAP[evos[0]].evolution.name}!`;
    }
    const r = Math.random();
    const upgradable = this.weapons.list.filter((w) => w.level < 8);
    if (upgradable.length && r < 0.5) {
      const w = pick(upgradable);
      const n = golden && w.level < 7 ? 2 : 1;
      this.applyChoice({ kind: 'weaponLevel', id: w.id, levels: n, rarity: 'common' });
      return `${w.def.name} +${n}`;
    }
    const owned = (Object.entries(this.passives) as [PassiveId, number][]).filter(([id, l]) => l > 0 && l < PASSIVE_MAP[id].maxLevel);
    if (owned.length && r < 0.75) {
      const [id] = pick(owned);
      this.applyChoice({ kind: 'passiveLevel', id, levels: 1, rarity: 'common' });
      return `${PASSIVE_MAP[id].name} +1`;
    }
    if (r < 0.87) {
      const card = pick(STAT_CARDS);
      this.applyChoice({ kind: 'stat', id: card.id, rarity: golden ? 'epic' : 'rare' });
      return `${card.name}: ${card.text(RARITY_POWER[golden ? 'epic' : 'rare'])}`;
    }
    if (this.hpRatio < 0.6) { this.heal(this.stats.maxHp * 0.5, true); return 'Healed 50%'; }
    const g = goldAmount(this) * (golden ? 2 : 1);
    this.gold += g; this.goldEarned += g;
    return `+${g} gold`;
  }

  useShrine(): boolean {
    const p = this.player;
    if (p.hp < this.stats.maxHp * 0.3) {
      this.sfx('deny');
      this.numbers.label(p.x, 2.4, p.z, 'Too weak to sacrifice!', 'ft-label');
      return false;
    }
    const cost = p.hp * 0.25;
    p.hp -= cost;
    this.damageTaken += cost;
    this.shrineStacks++;
    this.recomputeStats();
    this.sfx('levelup');
    this.vfx.ring(p.x, p.z, 0.5, 4, '#ff006e', 0.6);
    this.particles.burst(p.x, 1, p.z, 25, '#ff006e', 5, 0.2, 0.8);
    this.hooks.onToast('🩸', 'BLOOD PACT', `+12% damage (x${this.shrineStacks})`, 'info');
    return true;
  }

  useHealingShrine() {
    this.heal(this.stats.maxHp * 0.5, true);
    this.sfx('heal');
    this.vfx.ring(this.player.x, this.player.z, 0.5, 4, '#70e000', 0.6);
    this.particles.burst(this.player.x, 1, this.player.z, 25, '#70e000', 4, 0.2, 0.8, 5, -3);
    this.hooks.onToast('🌿', 'HEALING SPRING', 'Restored 50% HP', 'info');
  }

  usePowerTotem() {
    this.buffs.totem = 20;
    this.recomputeStats();
    this.sfx('rare');
    this.vfx.ring(this.player.x, this.player.z, 0.5, 5, '#4cc9f0', 0.6);
    this.hooks.onToast('⚡', 'POWER TOTEM', 'Weapons overdrive for 20s: -50% cooldowns, +25% damage', 'info');
  }

  useRiskAltar(x: number, z: number) {
    this.sfx('altar');
    this.screen.shake(0.4);
    this.announce('The altar demands a champion!', true);
    const og = this.enemies.spawn('ogre', x + 4, z, this, { elite: true, chest: true, mods: [pick(['enraged', 'armored', 'regenerating'])] });
    if (og) og.goldChance = 1;
    for (let i = 0; i < 2; i++) this.enemies.spawn(pick(['brute', 'goblin', 'shieldKnight']), x + rand(-4, 4), z + rand(-4, 4), this, { elite: true });
    this.particles.burst(x, 1, z, 40, '#ff3b30', 8, 0.3, 1);
  }

  applyChoice(c: Choice) {
    switch (c.kind) {
      case 'newWeapon':
        this.weapons.add(c.id, this.stats);
        useProgression.getState().markDiscovered([c.id]);
        break;
      case 'weaponLevel':
        this.weapons.levelUp(c.id, c.levels, this.stats);
        break;
      case 'newPassive':
      case 'passiveLevel':
        this.passives[c.id] = Math.min(PASSIVE_MAP[c.id].maxLevel, (this.passives[c.id] ?? 0) + (c.kind === 'passiveLevel' ? c.levels : 1));
        useProgression.getState().markDiscovered([c.id]);
        break;
      case 'stat': {
        const def = STAT_CARDS.find((s) => s.id === c.id);
        if (def) {
          const k = RARITY_POWER[c.rarity] ?? 1;
          for (const key of Object.keys(def.base) as (keyof StatBlock)[]) this.cards[key] = (this.cards[key] ?? 0) + (def.base[key] as number) * k;
        }
        break;
      }
      case 'special':
        if (!this.specials.has(c.id)) {
          this.specials.add(c.id);
          this.hooks.onToast(SPECIAL_MAP[c.id].icon, 'LEGENDARY TRAIT', SPECIAL_MAP[c.id].name, 'evolution');
          this.sfx('rare');
        }
        break;
      case 'evolution': {
        const w = this.weapons.get(c.id);
        if (!w || w.evolved) break;
        this.weapons.evolve(c.id, this.stats);
        this.evolutions++;
        const evo = WEAPON_MAP[c.id].evolution;
        useProgression.getState().markDiscovered(['evo:' + c.id]);
        this.hooks.onToast(evo.icon, 'EVOLUTION!', evo.name, 'evolution');
        this.vfx.ring(this.player.x, this.player.z, 0.5, 6, '#ffd60a', 0.7);
        this.particles.burst(this.player.x, 1, this.player.z, 40, '#ffd60a', 7, 0.25, 1);
        this.screen.flash('rgba(255,214,10,0.8)', 0.4);
        this.sfx('evolve');
        break;
      }
      case 'heal':
        this.heal(this.stats.maxHp * 0.4, true);
        break;
      case 'gold': {
        const g = goldAmount(this);
        this.gold += g; this.goldEarned += g;
        break;
      }
      case 'frenzy':
        this.buffs.damage = 30; this.buffs.frenzy = 30;
        break;
    }
    this.evaluateSynergies(true);
    this.notifyEvolutions();
  }

  /** Data-driven synergy evaluation. */
  evaluateSynergies(announce: boolean) {
    const tags: Partial<Record<WeaponTag, number>> = {};
    for (const w of this.weapons.list) for (const t of w.def.tags) tags[t] = (tags[t] ?? 0) + 1;
    const ctx: SynergyContext = { tags, weapons: this.weapons.list.map((w) => w.id), passives: this.passives };
    const active = SYNERGIES.filter((s) => s.check(ctx));
    const fresh = active.filter((s) => !this.synergies.includes(s.id));
    this.synergies = active.map((s) => s.id);
    this.synergyFlags = new Set(active.flatMap((s) => s.flags ?? []));
    this.elementMult = {};
    for (const s of active) for (const [el, m] of Object.entries(s.elementMult ?? {}) as [Element, number][]) this.elementMult[el] = (this.elementMult[el] ?? 1) * m;
    this.weapons.flags = this.synergyFlags;
    this.maxSynergies = Math.max(this.maxSynergies, active.length);
    this.recomputeStats();
    if (announce) for (const s of fresh) {
      this.hooks.onToast(s.icon, 'SYNERGY ACTIVE', `${s.name}: ${s.description}`, 'evolution');
      this.sfx('synergy');
      useProgression.getState().markDiscovered(['syn:' + s.id]);
    }
  }

  private notifyEvolutions() {
    for (const id of evolutionsAvailable(this)) {
      if (this.evoNotified.has(id)) continue;
      this.evoNotified.add(id);
      const evo = WEAPON_MAP[id].evolution;
      this.hooks.onToast(evo.icon, 'EVOLUTION READY', `${evo.name} will appear in your next level-up or chest`, 'evolution');
      this.sfx('evoReady');
    }
  }

  // ================= bosses =================
  startBoss(id: BossId, tier: number, final: boolean) {
    if (this.boss) return;
    this.boss = new BossController(id, this, tier * this.map.bossHpMult, final);
    useProgression.getState().markDiscovered(['boss:' + id]);
    this.sfx('bossWarn');
    this.sfx('bossRoar', this.boss.def.roar / 80);
    this.screen.shake(0.5);
    this.hooks.onBossIntro(this.boss.def.name, this.boss.def.title);
  }

  private onBossDefeated() {
    const b = this.boss;
    if (!b) return;
    b.die(this);
    this.bossesDefeated++;
    this.bossIds.push(b.id);
    const e = b.entity;
    this.announce(`${b.def.name} HAS FALLEN!`, true);
    for (let i = 0; i < 6; i++) this.pickups.gem(e.x + rand(-3, 3), e.z + rand(-3, 3), 30 + this.timelineMinutes * 6);
    for (let i = 0; i < 20; i++) this.pickups.coin(e.x + rand(-3, 3), e.z + rand(-3, 3), Math.round(b.def.rewardGold / 20));
    const extra = this.synergyFlags.has('treasure') ? 1 : 0;
    this.schedule(1.2, () => {
      this.pickups.addChest(e.x, e.z, true, 0, (b.final ? 3 : 2) + extra);
      this.pickups.powerup('health', e.x + 2, e.z);
    });
    this.unlock('first_boss');
    if (b.id === 'scrapGolem') this.unlock('golem');
    if (b.id === 'goldenExecutioner') this.unlock('executioner');
    if (b.id === 'crystalColossus') this.unlock('colossus');
    if (b.id === 'voidDevourer') this.unlock('devourer');
    if (b.majorHits === 0) this.unlock('flawless_boss');
    const kills = { ...getSave().bossKills };
    for (const id of this.bossIds) kills[id] = (kills[id] ?? 0) + 1;
    if (Object.keys(kills).length >= 5) this.unlock('all_bosses');
    if (b.final && this.mode !== 'endless') {
      this.victory = true;
      this.endT = 4.5;
      this.screen.stop(0.12);
      this.schedule(1.5, () => {
        this.sfx('victory');
        this.announce('VICTORY!', true);
        for (const en of this.enemies.pool) if (en.alive && en.kind !== 'boss') this.killEnemy(en);
      });
    }
  }

  // ================= achievements & results =================
  private unlock(id: string) {
    if (useProgression.getState().unlockAchievement(id)) {
      this.unlockedThisRun.push(id);
      this.sfx('achievement');
      const a = ACHIEVEMENT_MAP[id];
      this.hooks.onToast(a.icon, 'ACHIEVEMENT', `${a.name}${a.unlocks ? ` — unlocked ${a.unlocks}` : ''}`, 'achievement');
    }
  }

  checkAchievements() {
    const t = this.time;
    if (t >= 300) this.unlock('survive_5');
    if (t >= 480) this.unlock('survive_8');
    if (t >= 600) this.unlock('survive_10');
    if (t >= 900) this.unlock('survive_15');
    if (this.mode === 'endless' && t >= 1200) this.unlock('endless_20');
    if (this.map.id === 'frozen' && t >= 480) this.unlock('frozen_8');
    if (this.kills >= 100) this.unlock('kills_100');
    if (this.kills >= 500) this.unlock('kills_500');
    if (this.level >= 10) this.unlock('level_10');
    if (this.level >= 15) this.unlock('level_15');
    if (this.evolutions >= 1) this.unlock('evolution');
    if (this.evolutions >= 2) this.unlock('evolve_2');
    if (this.synergies.length >= 3) this.unlock('synergy_3');
    if (this.highestHit >= 500) this.unlock('big_hit');
    const s = getSave().stats;
    if (s.totalKills + this.kills >= 1000) this.unlock('kills_1000_total');
    if (s.totalKills + this.kills >= 2500) this.unlock('kills_2500_total');
    if (s.totalElites + this.elites >= 25) this.unlock('elites_25');
    if (s.totalElites + this.elites >= 50) this.unlock('elites_50');
  }

  /** Writes lifetime stats, challenges and rewards exactly once per run. */
  private finalized = false;
  finalize(): RunResult {
    const save = getSave();
    const prevBest = save.bestTimeByMap[this.map.id] ?? 0;
    const minutes = this.time / 60;
    const rewardMult = this.difficulty.reward * RUN_MODES[this.mode].reward * this.rm.reward;
    const currency = Math.round((this.gold * 0.4 + this.kills * 0.05 + minutes * 6 + this.bossesDefeated * 60 + (this.victory ? 150 : 0)) * rewardMult);
    const newChallenges: { icon: string; name: string }[] = [];
    if (!this.finalized) {
      this.finalized = true;
      this.checkAchievements();
      if (this.victory && !save.purchasedAnyUpgrade) this.unlock('no_upgrade_win');
      if (this.victory && this.map.id === 'arena') this.unlock('arena_win');
      if (this.victory && this.opts.difficulty === 'hard') this.unlock('win_hard');
      const summary: RunSummary = {
        victory: this.victory, time: this.time, kills: this.kills, elites: this.elites, level: this.level, gold: this.goldEarned,
        bosses: this.bossesDefeated, evolutions: this.evolutions, healed: this.healed, character: this.characterId, map: this.map.id,
        mode: this.mode, difficulty: this.opts.difficulty, modifiers: this.opts.modifiers.length, maxSynergies: this.maxSynergies, chests: this.pickups.chestsOpened,
      };
      const before = CHALLENGES.filter((c) => challengeProgress(c.id, save) >= c.target).map((c) => c.id);
      useProgression.getState().update((s) => {
        s.currency += currency;
        s.stats.totalCurrency += currency;
        s.stats.totalRuns++;
        if (this.victory) s.stats.wins++;
        s.stats.totalTime += this.time;
        s.stats.totalKills += this.kills;
        s.stats.totalElites += this.elites;
        s.stats.highestLevel = Math.max(s.stats.highestLevel, this.level);
        s.stats.bestTime = Math.max(s.stats.bestTime, this.time);
        s.stats.totalBosses += this.bossesDefeated;
        s.stats.highestHit = Math.max(s.stats.highestHit, Math.round(this.highestHit));
        s.stats.totalDamage += Math.round(this.damageDealt);
        s.stats.mostKills = Math.max(s.stats.mostKills, this.kills);
        s.stats.totalEvolutions += this.evolutions;
        if (this.mode === 'endless') s.stats.bestEndless = Math.max(s.stats.bestEndless, this.time);
        s.characterRuns[this.characterId] = (s.characterRuns[this.characterId] ?? 0) + 1;
        s.bestTimeByMap[this.map.id] = Math.max(prevBest, this.time);
        if (!s.mapsPlayed.includes(this.map.id)) s.mapsPlayed.push(this.map.id);
        for (const id of this.bossIds) s.bossKills[id] = (s.bossKills[id] ?? 0) + 1;
        for (const c of CHALLENGES) if (c.scope === 'run') s.challengeBest[c.id] = Math.max(s.challengeBest[c.id] ?? 0, c.metric(summary, { totalKills: 0, totalElites: 0, mapsPlayed: [] }));
        // next run gets fresh modifiers
        if (s.modifiersEnabled && this.opts.modifiers.length) s.rolledModifiers = [];
      });
      const after = getSave();
      for (const c of CHALLENGES) if (!before.includes(c.id) && challengeProgress(c.id, after) >= c.target && !after.challengeClaimed.includes(c.id)) newChallenges.push({ icon: c.icon, name: c.name });
      useProgression.getState().markDiscovered([...[...this.enemies.seen].map((k) => 'enemy:' + k), ...this.synergies.map((s) => 'syn:' + s)]);
      if (getSave().stats.totalCurrency >= 2000) this.unlock('rich');
      if (getSave().stats.totalCurrency >= 5000) this.unlock('rich_5000');
    }
    return this.result(currency, prevBest, newChallenges);
  }

  private resultCache: RunResult | null = null;
  private result(currency: number, prevBest: number, challenges: { icon: string; name: string }[]) {
    if (this.resultCache) return this.resultCache;
    const ch = CHARACTER_MAP[this.characterId];
    this.resultCache = {
      victory: this.victory,
      character: ch.name,
      characterId: ch.id,
      map: this.map.name,
      mode: RUN_MODES[this.mode].label,
      difficulty: this.difficulty.label,
      time: this.time,
      kills: this.kills,
      elites: this.elites,
      level: this.level,
      bosses: this.bossesDefeated,
      gold: this.goldEarned,
      currency,
      damageDealt: Math.round(this.damageDealt),
      damageTaken: Math.round(this.damageTaken),
      highestHit: Math.round(this.highestHit),
      weapons: this.weapons.list.map((w) => ({ icon: w.evolved ? w.def.evolution.icon : w.def.icon, name: w.evolved ? w.def.evolution.name : w.def.name, level: w.level, evolved: w.evolved })),
      passives: (Object.entries(this.passives) as [PassiveId, number][]).filter(([, l]) => l > 0).map(([id, l]) => ({ icon: PASSIVE_MAP[id].icon, name: PASSIVE_MAP[id].name, level: l })),
      bestTime: Math.max(prevBest, this.time),
      previousBest: prevBest,
      newRecord: this.time > prevBest,
      achievements: this.unlockedThisRun.map((id) => ({ icon: ACHIEVEMENT_MAP[id].icon, name: ACHIEVEMENT_MAP[id].name })),
      unlocks: this.unlockedThisRun.map((id) => ACHIEVEMENT_MAP[id].unlocks).filter((u): u is string => !!u),
      challenges,
      synergies: this.synergies.map((id) => { const s = SYNERGIES.find((x) => x.id === id)!; return { icon: s.icon, name: s.name }; }),
      modifiers: this.opts.modifiers.map((id) => ({ icon: MODIFIER_MAP[id].icon, name: MODIFIER_MAP[id].name })),
      rewardMult: Math.round(this.difficulty.reward * RUN_MODES[this.mode].reward * this.rm.reward * 100) / 100,
    };
    return this.resultCache;
  }

  // ================= cleanup =================
  dispose() {
    this.ended = true;
    this.delayed.length = 0;
    this.hazards.clear(this);
    this.enemies.clear(this);
    this.enemies.dispose();
    this.projectiles.dispose();
    this.weapons.clear();
    this.weapons.dispose();
    this.pickups.dispose();
    this.boss?.dispose();
    this.boss = null;
    this.player.dispose();
    this.world.dispose();
    this.vfx.clear();
    this.particles.clear();
    this.numbers.clear();
    this.screen.reset();
  }
}

export function aggregateModifiers(ids: ModifierId[]): ModAggregate {
  const a: ModAggregate = { spawn: 1, enemyDamage: 1, enemyHp: 1, enemySpeed: 1, elite: 1, gold: 1, playerDamage: 1, pickup: 1, bossTime: 1, heal: 1, dash: 1, knockback: 1, reward: 1 };
  for (const id of ids) {
    const m = MODIFIER_MAP[id];
    if (!m) continue;
    a.spawn *= m.spawnMult ?? 1;
    a.enemyDamage *= m.enemyDamageMult ?? 1;
    a.enemyHp *= m.enemyHpMult ?? 1;
    a.enemySpeed *= m.enemySpeedMult ?? 1;
    a.elite *= m.eliteMult ?? 1;
    a.gold *= m.goldMult ?? 1;
    a.playerDamage *= m.playerDamageMult ?? 1;
    a.pickup *= m.pickupMult ?? 1;
    a.bossTime *= m.bossTimeMult ?? 1;
    a.heal *= m.healMult ?? 1;
    a.dash *= m.dashMult ?? 1;
    a.knockback *= m.knockbackMult ?? 1;
    a.reward += m.reward;
  }
  return a;
}

export type { WeaponId };
