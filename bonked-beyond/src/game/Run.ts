// A single run: owns every gameplay system and the damage pipeline. Created fresh on every start.
import * as THREE from 'three';
import { ACHIEVEMENT_MAP } from '../data/achievements';
import { CHARACTER_MAP } from '../data/characters';
import { MAP_MAP, type MapDef } from '../data/maps';
import { PASSIVE_MAP } from '../data/passives';
import type { BossId, CharacterId, Difficulty, MapId, PassiveId, RunMode, StatBlock, WeaponId } from '../data/types';
import { WEAPON_MAP } from '../data/weapons';
import type { RunResult } from '../store/gameStore';
import { getSave, useProgression } from '../store/progressionStore';
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
import { chance, rand } from './util';
import { ProjectileManager } from './weapons/Projectile';
import { WeaponManager, type WeaponInstance } from './weapons/WeaponManager';
import { World } from './world/World';

export interface RunOptions { character: CharacterId; map: MapId; mode: RunMode; difficulty: Difficulty }

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
  poison?: boolean;
  explosive?: boolean;
}

export interface PlayerHitSource { x: number; z: number; label: string; attacker?: Enemy; major?: boolean; ignoreIframes?: boolean }

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
  rerolls: number;
  superCharge = 0;
  shrineStacks = 0;
  buffs = { damage: 0, frenzy: 0, shield: 0 };
  aimPoint: { x: number; z: number } | null = null;
  dead = false;
  victory = false;
  ended = false;
  private endT = 0;
  private delayed: { t: number; fn: () => void }[] = [];
  private achCheckT = 0;
  private evolvedAny = false;
  private hadFlawless = false;
  unlockedThisRun: string[] = [];
  interactText: string | null = null;
  private interactAct: (() => void) | null = null;
  readonly timelineScale: number;

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
    this.timelineScale = RUN_MODES[opts.mode].timeline;
    const save = getSave();
    this.permanent = { ...save.upgrades };
    this.rerolls = CONFIG.levelUp.baseRerolls + (this.permanent.reroll ?? 0);
    this.gold = 15 * (this.permanent.startGold ?? 0);

    this.world = new World(this.map, ctx.quality);
    this.scene.add(this.world.group);
    this.stats = this.computeStats();
    this.player = new Player(this.scene, opts.character, this.stats.maxHp);
    this.enemies = new EnemyManager(this.scene, ctx.quality.maxEnemies, this.world.radius);
    this.projectiles = new ProjectileManager(this.scene);
    this.weapons = new WeaponManager(this.scene);
    this.pickups = new PickupManager(this.scene);
    this.director = new SpawnDirector(this);
    this.weapons.add(CHARACTER_MAP[opts.character].weapon, this.stats);
    this.pickups.setupWorld(this);
    useProgression.getState().markDiscovered([CHARACTER_MAP[opts.character].weapon, 'map:' + opts.map]);
  }

  get timeline() { return this.time * this.timelineScale; }
  get timelineMinutes() { return this.timeline / 60; }

  private computeStats(): StatBlock {
    return computeStats({
      character: this.characterId,
      permanent: this.permanent,
      passives: this.passives,
      temp: { damage: this.buffs.damage > 0, frenzy: this.buffs.frenzy > 0 },
      shrineDamage: this.shrineStacks,
    });
  }

  recomputeStats() {
    const oldMax = this.stats.maxHp;
    this.stats = this.computeStats();
    if (this.stats.maxHp > oldMax) this.player.hp += this.stats.maxHp - oldMax;
    this.player.hp = Math.min(this.player.hp, this.stats.maxHp);
    this.weapons.recompute(this.stats);
  }

  sfx(s: Sfx) { audio.play(s); }
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
    if (!this.dead && !this.victory) this.director.update(dt);
    this.enemies.update(dt, this);
    if (this.boss) {
      this.boss.update(dt, this);
      if (this.boss.dead) { this.boss.dispose(); this.boss = null; }
    }
    this.weapons.update(dt, this);
    this.projectiles.update(dt, this);
    this.hazards.update(dt, this);
    this.pickups.update(dt, this);

    // buffs
    let changed = false;
    for (const k of ['damage', 'frenzy', 'shield'] as const) {
      if (this.buffs[k] > 0) {
        this.buffs[k] -= dt;
        if (this.buffs[k] <= 0) { this.buffs[k] = 0; if (k !== 'shield') changed = true; }
      }
    }
    if (changed) this.recomputeStats();
    if (p.alive && this.stats.regen > 0) p.hp = Math.min(this.stats.maxHp, p.hp + this.stats.regen * dt);

    // interaction prompt
    const it = p.alive ? this.pickups.nearestInteractable(this) : null;
    this.interactText = it?.text ?? null;
    this.interactAct = it?.act ?? null;

    this.achCheckT -= dt;
    if (this.achCheckT <= 0) { this.achCheckT = 0.5; this.checkAchievements(); }

    if (this.dead || this.victory) {
      this.endT -= dt;
      if (this.endT <= 0 && !this.ended) {
        this.ended = true;
        this.hooks.onEnd(this.victory);
      }
    } else if (this.pendingLevels > 0) {
      this.hooks.onLevelUp();
    }
  }

  updateIntro(dt: number) {
    if (this.boss) this.boss.updateIntro(dt, this);
  }

  render(time: number) {
    this.player.render(time, this.buffs.shield > 0);
    this.enemies.render(time);
    this.projectiles.render();
    this.pickups.render(time);
    this.weapons.render(this);
    this.boss?.render(time, this);
  }

  // ================= damage pipeline =================
  hitEnemy(e: Enemy, base: number, o: HitOpts = {}): { damage: number; crit: boolean; killed: boolean } {
    if (!e.alive) return { damage: 0, crit: false, killed: false };
    const s = this.stats;
    const crit = Math.random() < s.critChance + (o.crit ?? 0);
    let dmg = base * rand(0.92, 1.08);
    if (crit) dmg *= s.critDamage;
    if (e.kind === 'boss' && this.boss?.state === 'intro') return { damage: 0, crit: false, killed: false };
    this.damageDealt += Math.min(dmg, e.hp);
    e.hp -= dmg;
    e.flash = 1;
    if (dmg > this.highestHit) this.highestHit = dmg;
    // knockback
    const kb = (o.kb ?? 0) * (1 - e.kbResist);
    if (kb > 0) {
      let dx = o.dirX, dz = o.dirZ;
      if (dx === undefined || dz === undefined) {
        const l = Math.hypot(e.x - this.player.x, e.z - this.player.z) || 1;
        dx = (e.x - this.player.x) / l; dz = (e.z - this.player.z) / l;
      }
      e.vx += dx * kb * (o.heavy ? 1.3 : 1);
      e.vz += dz * kb * (o.heavy ? 1.3 : 1);
    }
    if (!o.noNumber) this.numbers.damage(e.x, (e.def?.height ?? 4) * e.scale + 0.3, e.z, dmg, crit);
    if (!o.quiet) {
      if (crit) this.sfx('crit'); else this.sfx('hit');
    }
    if (crit && o.heavy) { this.screen.stop(0.04); this.screen.shake(0.1); }
    if (Math.random() < 0.5) this.particles.burst(e.x, 0.7, e.z, 2, crit ? '#ffd60a' : '#ffffff', 3, 0.1, 0.25);
    let killed = false;
    if (e.hp <= 0) { killed = true; this.killEnemy(e); }
    return { damage: dmg, crit, killed };
  }

  killEnemy(e: Enemy) {
    if (!e.alive) return;
    if (e.telegraph) { this.vfx.release(e.telegraph); e.telegraph = null; }
    this.enemies.markDead(e);
    if (e.kind === 'boss') { this.onBossDefeated(); return; }
    this.kills++;
    if (e.elite) this.elites++;
    const def = e.def!;
    const color = e.elite ? '#ffd166' : def.color;
    this.particles.burst(e.x, 0.6 * e.scale, e.z, e.elite ? 26 : 9, color, 5 * Math.sqrt(e.scale), 0.22 * e.scale, 0.6);
    this.sfx('kill');
    this.superCharge = Math.min(1, this.superCharge + 1 / CONFIG.player.superKills);
    // loot
    if (!e.summoned || Math.random() < 0.4) this.pickups.gem(e.x, e.z, e.xp);
    const luck = 1 + this.stats.luck / 100;
    if (chance(e.goldChance * luck)) {
      const n = e.elite ? 6 : 1;
      for (let i = 0; i < n; i++) this.pickups.coin(e.x, e.z, 1 + Math.floor(this.timelineMinutes / 5));
    }
    if (e.dropsChest || (e.elite && Math.random() < 0.2)) {
      this.pickups.addChest(e.x, e.z, true, 0);
      this.announce('An elite dropped a golden chest!');
    } else if (e.elite) {
      this.pickups.gem(e.x, e.z, e.xp * 0.5);
      if (Math.random() < 0.35) this.pickups.powerup((['health', 'magnet', 'bomb', 'frenzy', 'shield', 'damage'] as PowerupKind[])[Math.floor(Math.random() * 6)], e.x, e.z);
    } else if (chance(0.006 * luck)) {
      const hpLow = this.player.hp < this.stats.maxHp * 0.5;
      const kinds: PowerupKind[] = ['health', 'damage', 'magnet', 'bomb', 'frenzy', 'shield', 'bigGold'];
      const kind = hpLow && Math.random() < 0.5 ? 'health' : kinds[Math.floor(Math.random() * kinds.length)];
      this.pickups.powerup(kind, e.x, e.z);
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
    if (e.poisonT > 0 && this.weapons.plagueGarden) {
      const w = this.weapons.get('poison')!;
      if (Math.random() < 0.35) this.weapons.addCloud(e.x, e.z, w.stats.area * 0.7, 2.5, w.stats.damage * 0.6, w);
      this.player.hp = Math.min(this.stats.maxHp, this.player.hp + 0.5);
    }
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
      // the bug itself dies without rewards beyond its gem
      if (e.alive) {
        this.enemies.markDead(e);
        this.pickups.gem(e.x, e.z, e.xp * 0.5);
      }
    }
    this.enemies.grid.query(e.x, e.z, r, (o) => {
      if (o === e || o.kind === 'boss') return;
      const dx = o.x - e.x, dz = o.z - e.z, d = Math.hypot(dx, dz) || 1;
      this.hitEnemy(o, (byFuse ? 15 : 25) * this.stats.explosiveMult * (1 + this.timelineMinutes * 0.15), { kb: 8, dirX: dx / d, dirZ: dz / d, quiet: true });
    });
    this.pickups.breakBarrelsIn(e.x, e.z, r, this);
  }

  explode(x: number, z: number, r: number, dmg: number, o: { kb: number; crit: number; weapon?: WeaponInstance | null; color: string; quiet?: boolean }) {
    this.vfx.ring(x, z, 0.3, r, o.color, 0.4, 1);
    this.vfx.ring(x, z, 0.2, r * 0.6, '#ffffff', 0.25, 0.7);
    this.particles.burst(x, 0.5, z, 16, o.color, r * 2.5, 0.28, 0.5);
    this.particles.burst(x, 0.5, z, 6, '#495057', r * 1.5, 0.35, 0.8, 3, 2);
    this.sfx('explode');
    if (!o.quiet) this.screen.shake(0.15);
    this.enemies.grid.query(x, z, r, (e) => {
      const dx = e.x - x, dz = e.z - z, d = Math.hypot(dx, dz) || 1;
      this.hitEnemy(e, dmg, { crit: o.crit, kb: o.kb, dirX: dx / d, dirZ: dz / d, weapon: o.weapon, quiet: true, explosive: true });
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
      this.sfx('dodge');
      return true;
    }
    const dmg = armorReduce(amount, this.stats.armor);
    p.hp -= dmg;
    this.damageTaken += dmg;
    p.invuln = CONFIG.player.hurtInvulnerability;
    p.hurtFlash = 1;
    if (src.major && this.boss) this.boss.majorHits++;
    const dx = p.x - src.x, dz = p.z - src.z, d = Math.hypot(dx, dz) || 1;
    const kb = 6 * (1 - this.stats.knockbackResist);
    p.knockX += (dx / d) * kb; p.knockZ += (dz / d) * kb;
    this.numbers.damage(p.x, 2.4, p.z, dmg, false, true);
    this.screen.shake(0.25);
    this.screen.flash('rgba(255,30,30,0.9)', 0.45);
    this.sfx('hurt');
    // thorns
    if (src.attacker && this.stats.thorns > 0 && src.attacker.alive) {
      const lvl = this.passives.thorns ?? 0;
      this.hitEnemy(src.attacker, amount * this.stats.thorns + 4 * lvl, { kb: 4, quiet: true });
    }
    if (p.hp <= 0) {
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
      this.hitEnemy(e, dmg, { kb: 22, dirX: dx / d, dirZ: dz / d, heavy: true, quiet: true });
    });
    for (const pr of this.projectiles.pool) if (pr.active && pr.enemy && (pr.x - p.x) ** 2 + (pr.z - p.z) ** 2 < R * R) pr.active = false;
    this.pickups.breakBarrelsIn(p.x, p.z, R, this);
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
    const amt = Math.max(1, Math.round(v * this.stats.goldGain * this.map.goldMult));
    this.gold += amt;
    this.goldEarned += amt;
    this.sfx('gold');
  }

  applyPowerup(kind: PowerupKind, x: number, z: number) {
    const info = POWERUP_INFO[kind];
    const p = this.player;
    this.numbers.label(x, 2, z, `${info.icon} ${info.name}`, 'ft-pickup');
    this.sfx('pickup');
    this.particles.burst(x, 0.8, z, 12, info.color, 4, 0.18, 0.5);
    switch (kind) {
      case 'health': {
        const heal = this.stats.maxHp * 0.3;
        p.hp = Math.min(this.stats.maxHp, p.hp + heal);
        this.sfx('heal');
        break;
      }
      case 'damage': this.buffs.damage = 15; this.recomputeStats(); break;
      case 'frenzy': this.buffs.frenzy = 15; this.recomputeStats(); break;
      case 'shield': this.buffs.shield = 20; break;
      case 'magnet': this.pickups.magnetAll(); break;
      case 'bomb':
        this.explode(p.x, p.z, 10, (80 + this.timelineMinutes * 40) * this.stats.damageMult, { kb: 16, crit: 0, color: '#ff9f1c' });
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
    for (let i = 0; i < c.rewards; i++) results.push(this.chestReward());
    this.hooks.onToast('🎁', c.golden ? 'GOLDEN CHEST' : 'CHEST', results.join(' · '), 'info');
  }

  private chestReward(): string {
    const evos = evolutionsAvailable(this);
    if (evos.length) {
      this.applyChoice({ kind: 'evolution', id: evos[0], rarity: 'evolution' });
      return `Evolved ${WEAPON_MAP[evos[0]].evolution.name}!`;
    }
    const upgradable = this.weapons.list.filter((w) => w.level < 8);
    if (upgradable.length && Math.random() < 0.75) {
      const w = upgradable[Math.floor(Math.random() * upgradable.length)];
      this.applyChoice({ kind: 'weaponLevel', id: w.id, levels: 1, rarity: 'common' });
      return `${w.def.name} +1`;
    }
    const owned = (Object.entries(this.passives) as [PassiveId, number][]).filter(([id, l]) => l > 0 && l < PASSIVE_MAP[id].maxLevel);
    if (owned.length) {
      const [id] = owned[Math.floor(Math.random() * owned.length)];
      this.applyChoice({ kind: 'passiveLevel', id, rarity: 'common' });
      return `${PASSIVE_MAP[id].name} +1`;
    }
    const g = goldAmount(this);
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
        this.passives[c.id] = Math.min(PASSIVE_MAP[c.id].maxLevel, (this.passives[c.id] ?? 0) + 1);
        useProgression.getState().markDiscovered([c.id]);
        this.recomputeStats();
        break;
      case 'evolution': {
        this.weapons.evolve(c.id, this.stats);
        this.evolvedAny = true;
        const evo = WEAPON_MAP[c.id].evolution;
        useProgression.getState().markDiscovered(['evo:' + c.id]);
        this.hooks.onToast(evo.icon, 'EVOLUTION!', evo.name, 'evolution');
        this.vfx.ring(this.player.x, this.player.z, 0.5, 6, '#ffd60a', 0.7);
        this.particles.burst(this.player.x, 1, this.player.z, 40, '#ffd60a', 7, 0.25, 1);
        this.screen.flash('rgba(255,214,10,0.8)', 0.4);
        break;
      }
      case 'heal':
        this.player.hp = Math.min(this.stats.maxHp, this.player.hp + this.stats.maxHp * 0.4);
        break;
      case 'gold': {
        const g = goldAmount(this);
        this.gold += g; this.goldEarned += g;
        break;
      }
      case 'frenzy':
        this.buffs.damage = 30; this.buffs.frenzy = 30;
        this.recomputeStats();
        break;
    }
    this.weapons.recompute(this.stats);
  }

  // ================= bosses =================
  startBoss(id: BossId, tier: number) {
    if (this.boss) return;
    this.boss = new BossController(id, this, tier);
    useProgression.getState().markDiscovered(['boss:' + id]);
    this.sfx('bossWarn');
    this.screen.shake(0.5);
    this.hooks.onBossIntro(this.boss.def.name, this.boss.def.title);
  }

  private onBossDefeated() {
    const b = this.boss;
    if (!b) return;
    b.die(this);
    this.bossesDefeated++;
    const e = b.entity;
    this.announce(`${b.def.name} HAS FALLEN!`, true);
    if (b.majorHits === 0) this.hadFlawless = true;
    for (let i = 0; i < 6; i++) this.pickups.gem(e.x + rand(-3, 3), e.z + rand(-3, 3), 30 + this.timelineMinutes * 6);
    for (let i = 0; i < 20; i++) this.pickups.coin(e.x + rand(-3, 3), e.z + rand(-3, 3), Math.round(b.def.rewardGold / 20));
    this.schedule(1.2, () => {
      this.pickups.addChest(e.x, e.z, true, 0, b.id === 'scrapGolem' ? 3 : 2);
      this.pickups.powerup('health', e.x + 2, e.z);
    });
    this.unlock('first_boss');
    if (b.id === 'scrapGolem') this.unlock('golem');
    if (b.majorHits === 0) this.unlock('flawless_boss');
    if (b.id === 'scrapGolem' && this.mode !== 'endless') {
      this.victory = true;
      this.endT = 4;
      this.schedule(1.5, () => {
        this.sfx('victory');
        this.announce('VICTORY!', true);
        // the horde flees
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
    if (this.kills >= 100) this.unlock('kills_100');
    if (this.kills >= 500) this.unlock('kills_500');
    if (this.level >= 10) this.unlock('level_10');
    if (this.level >= 15) this.unlock('level_15');
    if (this.evolvedAny) this.unlock('evolution');
    if (this.highestHit >= 500) this.unlock('big_hit');
    const s = getSave().stats;
    if (s.totalKills + this.kills >= 1000) this.unlock('kills_1000_total');
    if (s.totalElites + this.elites >= 25) this.unlock('elites_25');
    void this.hadFlawless;
  }

  /** Writes lifetime stats and rewards exactly once per run. */
  private finalized = false;
  finalize(): RunResult {
    const save = getSave();
    const prevBest = save.bestTimeByMap[this.map.id] ?? 0;
    const minutes = this.time / 60;
    const currency = this.finalized ? 0 : Math.round(
      (this.gold * 0.6 + this.kills * 0.05 + minutes * 6 + this.bossesDefeated * 60 + (this.victory ? 150 : 0)) * this.difficulty.reward * RUN_MODES[this.mode].reward,
    );
    if (!this.finalized) {
      this.finalized = true;
      this.checkAchievements();
      if (this.victory && !save.purchasedAnyUpgrade) this.unlock('no_upgrade_win');
      if (this.victory && this.map.id === 'arena') this.unlock('arena_win');
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
        s.characterRuns[this.characterId] = (s.characterRuns[this.characterId] ?? 0) + 1;
        s.bestTimeByMap[this.map.id] = Math.max(prevBest, this.time);
      });
      if (getSave().stats.totalCurrency >= 2000) this.unlock('rich');
    }
    return this.result(currency, prevBest);
  }

  private resultCache: RunResult | null = null;
  private result(currency: number, prevBest: number) {
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

export type { WeaponId };
