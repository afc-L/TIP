import * as THREE from 'three';
import { PLAYER_BASE, ARENA_RADIUS, DIFFICULTIES, ENEMY_TYPES, xpForLevel } from './config.js';
import { World } from './world.js';
import { Effects } from './effects.js';
import { Player } from './player.js';
import { Enemies } from './enemies.js';
import { Projectiles } from './projectiles.js';
import { Pickups } from './pickups.js';
import { Combat } from './combat.js';
import { createBosses } from './boss.js';
import { WaveDirector } from './waves.js';
import { Hazards } from './hazards.js';
import { RiftEvents, SHRINE_OPTIONS, SUPPLY_ITEMS, rollShrine } from './events.js';
import { ObjectiveTracker, OBJECTIVES } from './objectives.js';
import { computeStats, rollUpgrades, newSynergies, UPGRADE_BY_ID, WEAPON_IDS } from './upgrades.js';
import { RELIC_BY_ID, EVOLUTIONS, rollRelics } from './relics.js';
import { CLASSES, COSMETICS, ARENAS } from './characters.js';

const DEATH_COLORS = Object.fromEntries(Object.entries(ENEMY_TYPES).map(([k, v]) => [k, v.color]));
DEATH_COLORS.boss = '#ff6bd5';
const CAM_OFFSET = new THREE.Vector3(0, 21, 15);
const near = [];

export class Game {
  constructor({ scene, camera, ui, sound, input, meta }) {
    Object.assign(this, { scene, camera, ui, sound, input, meta });
    this.diffs = DIFFICULTIES;
    this.diff = DIFFICULTIES.normal;
    this.mods = { enemySpeed: 1, enemyCd: 1, enemyDmg: 1, xp: 1 };
    this.world = new World(scene);
    this.effects = new Effects(scene, document.getElementById('dmg-layer'));
    this.player = new Player(scene);
    this.enemies = new Enemies(scene, this);
    this.projectiles = new Projectiles(scene);
    this.pickups = new Pickups(scene);
    this.hazards = new Hazards(scene, this);
    this.combat = new Combat(this);
    this.bosses = createBosses(scene, this);
    this.boss = this.bosses.guardian;
    this.waves = new WaveDirector(this);
    this.events = new RiftEvents(scene, this);
    this.objectives = new ObjectiveTracker(this);

    this.raycaster = new THREE.Raycaster();
    this.aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1);
    this.aimPoint = new THREE.Vector3(0, 1, -5);
    this.camTarget = new THREE.Vector3();
    this.camPos = new THREE.Vector3();
    this.tmp = new THREE.Vector2();

    this.state = 'menu';
    this.t = 0;
    this.levels = {};
    this.synergies = new Set();
    this.relics = [];
    this.pendingLevels = 0;
    this.modalQueue = [];
    this.choices = [];
    this.interactHint = '';
    this.safe = { r: ARENA_RADIUS, target: ARENA_RADIUS, tick: 0 };
    this.cfg = { mode: 'campaign', diff: 'normal', cls: 'runner', weapon: 'class', loadout: 'standard', arena: 'temple', cloak: 'default', trail: 'default' };
    this.newRunState();
    this.stats = computeStats(meta.bonuses(), {}, [], new Set(), {});
    this.god = false;
  }

  get particleScale() { return this.effects.settings.density; }

  newRunState() {
    this.run = {
      time: 0, kills: 0, elites: 0, level: 1, xp: 0, xpNext: xpForLevel(1), shards: 0, gold: 0, damageDealt: 0, picks: 0,
      wavesCleared: 0, bossesKilled: 0, buffs: { fury: 0 }, cls: this.cfg.cls, arena: this.cfg.arena, mode: this.cfg.mode,
      diffId: this.cfg.diff, shrine: {}, hearts: 0, eventsSeen: 0, objectiveShards: 0, startWeapon: 'bolt', newRecord: false,
    };
  }

  discover(type) {
    if (this.meta.data.seen[type] === undefined) { this.meta.data.seen[type] = 0; }
  }

  // Remove every run-specific object from the world.
  cleanup() {
    this.enemies.clear();
    this.projectiles.clear();
    this.pickups.clear();
    this.hazards.clear();
    this.effects.clear();
    for (const b of Object.values(this.bosses)) b.remove();
    this.boss = this.bosses.guardian;
    this.combat.reset();
    this.waves.reset();
    this.events.reset();
    this.setSafeZone(ARENA_RADIUS, true);
    this.world.setTint(null);
    this.mods = { enemySpeed: 1, enemyCd: 1, enemyDmg: 1, xp: 1 };
    this.modalQueue = [];
  }

  // cfg: { mode, diff, cls, weapon, loadout, arena ('random' allowed), cloak, trail }
  startRun(cfg = this.cfg) {
    this.cfg = { ...this.cfg, ...cfg };
    const c = this.cfg;
    this.diff = DIFFICULTIES[c.diff] || DIFFICULTIES.normal;
    let arena = c.arena;
    if (arena === 'random' || !this.meta.isUnlocked('arenas', arena)) {
      const owned = this.meta.data.unlocks.arenas;
      const choices = owned.length > 1 ? owned.filter((a) => a !== this.lastArena) : owned;
      arena = choices[Math.floor(Math.random() * choices.length)];
    }
    this.lastArena = arena;
    this.world.setTheme(arena);
    this.cleanup();
    this.waves.reset(c.mode);
    this.levels = {};
    this.synergies = new Set();
    this.relics = [];
    this.pendingLevels = 0;
    this.newRunState();
    this.run.arena = arena;
    const cls = CLASSES[c.cls] || CLASSES.runner;
    const startWeapon = c.weapon === 'class' || !c.weapon ? cls.weapon : c.weapon;
    this.run.startWeapon = startWeapon;
    this.levels[startWeapon] = 1;
    this.meta.discover('weapons', startWeapon);
    // Cosmetics
    const cloak = COSMETICS.cloaks[c.cloak]?.color || cls.colors.cloak;
    const trail = COSMETICS.trails[c.trail]?.color || cls.colors.trim;
    this.player.setLook(cloak, cls.colors.trim, c.trail === 'default' ? cls.colors.trim : trail);
    this.recomputeStats();
    this.player.reset(this.stats.maxHp);
    // Loadout effects that need a live run
    if (c.loadout === 'scavenger') this.run.gold = 40;
    if (c.loadout === 'scholar') { this.run.level = 3; this.run.xpNext = xpForLevel(3); this.pendingLevels = 2; }
    if (c.loadout === 'seeker') {
      const r = rollRelics(this.meta, [], 1)[0];
      if (r) this.addRelic(r.id);
    }
    this.objectives.start(c.mode === 'endless', startWeapon);
    this.input.mouse.down = false;
    this.ui.clearTransient();
    this.ui.renderUpgradeIcons(this);
    this.ui.setHudVisible(true);
    this.ui.show(null);
    this.state = 'playing';
    this.snapCamera();
    this.waves.start(1);
    this.ui.toast(`${ARENAS[arena].icon} ${ARENAS[arena].name}`, '#b98cff', `${this.diff.name} · ${cls.name}`);
  }

  // Abandoning a run still banks the shards earned so far.
  abandonRun() {
    if (this.run && ['paused', 'playing', 'levelup', 'modal'].includes(this.state)) this.recordEnd(false);
  }

  goToMenu() {
    this.cleanup();
    this.player.reset(this.stats.maxHp);
    this.state = 'menu';
    this.ui.setHudVisible(false);
    this.world.setTheme(this.world.themeId);
  }

  shardTotal(victory) {
    const greed = 1 + 0.1 * this.meta.level('greed');
    return Math.floor((this.run.shards + (victory ? 60 : 0)) * this.diff.shardMult * greed);
  }

  recomputeStats() {
    const oldMax = this.stats ? this.stats.maxHp : 0;
    const oldEvolved = this.stats ? { ...this.stats.evolved } : {};
    this.stats = computeStats(this.meta.bonuses(), this.levels, this.synergies, new Set(this.relics), { cls: this.cfg.cls, loadout: this.cfg.loadout, shrine: { ...this.run.shrine, maxHpFlat: (this.run.shrine.maxHpFlat || 0) + this.run.hearts * 12 } });
    const p = this.player;
    p.maxHp = this.stats.maxHp;
    if (oldMax && this.stats.maxHp > oldMax) p.hp += this.stats.maxHp - oldMax;
    p.hp = Math.min(p.hp, p.maxHp);
    // Announce fresh evolutions
    if (this.state !== 'menu') {
      for (const [w, id] of Object.entries(this.stats.evolved)) {
        if (oldEvolved[w] === id) continue;
        const ev = EVOLUTIONS.find((e) => e.id === id);
        this.meta.discover('evolutions', id);
        this.ui.announce(`EVOLUTION: ${ev.name.toUpperCase()}`, ev.desc, '#ffd36b');
        this.ui.toast(`${ev.icon} ${ev.name}`, '#ffd36b', ev.desc);
        this.effects.ring(p.x, p.z, 0.5, 7, 0.8, '#ffd36b');
        this.effects.burst(p.x, 1.2, p.z, 40, '#ffd36b', 10, 0.9, 0.25);
        this.sound.play('synergy');
      }
    }
  }

  checkSynergies() {
    for (const s of newSynergies(this.levels, this.synergies, new Set(this.relics))) {
      this.synergies.add(s.id);
      this.recomputeStats();
      this.ui.toast(`✨ Synergy: ${s.name}`, '#ffb547', s.desc);
      this.ui.announce(`SYNERGY: ${s.name.toUpperCase()}`, s.parts, '#ffb547');
      this.effects.ring(this.player.x, this.player.z, 0.5, 6, 0.7, '#ffb547');
      this.effects.burst(this.player.x, 1.2, this.player.z, 30, '#ffb547', 8, 0.8, 0.2);
      this.sound.play('synergy');
    }
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.ui.show('pause');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.input.mouse.down = false;
    this.ui.show(null);
  }

  // ------------------------------------------------------------------ safe zone (Guardian phase 3)
  setSafeZone(r, instant = false) {
    this.safe.target = r;
    if (instant) this.safe.r = r;
    this.world.setSafeZone(this.safe.r);
    if (!instant && r < ARENA_RADIUS) this.ui.toast('The rift is collapsing!', '#ff3355', 'Stay inside the red ring.');
  }

  safeRadius() { return this.safe.r; }

  clampToSafe(o, r) {
    const lim = this.safe.r - r;
    const d = Math.hypot(o.x, o.z);
    if (d > lim) { o.x *= lim / d; o.z *= lim / d; }
  }

  updateSafeZone(dt) {
    const s = this.safe;
    if (s.r === s.target && s.r >= ARENA_RADIUS) return;
    if (s.r !== s.target) {
      s.r += Math.sign(s.target - s.r) * Math.min(Math.abs(s.target - s.r), dt * 6);
      this.world.setSafeZone(s.r);
    }
    const p = this.player;
    if (Math.hypot(p.x, p.z) > s.r) {
      s.tick -= dt;
      if (s.tick <= 0) { s.tick = 0.5; this.damagePlayer(6 * this.diff.enemyDmg, 0, 0, { noKnock: false, zone: true }); }
    } else s.tick = 0;
  }

  // ------------------------------------------------------------------ combat events
  // opts: { src (enemy), drain, noKnock, zone }
  damagePlayer(amount, sx, sz, opts = {}) {
    const p = this.player, s = this.stats;
    if (!p.alive || this.state !== 'playing' || this.god) return;
    if (p.bulwarkT > 0) return;
    if (p.invuln > 0 && !opts.drain) return;
    amount *= this.mods.enemyDmg * s.dmgTaken;
    if (opts.src && s.contactTaken) amount *= s.contactTaken;
    amount = Math.max(1, Math.round(amount));
    p.shieldDelay = 4;
    this.objectives.onHurt();
    if (p.shield >= 1) {
      const absorbed = Math.min(p.shield, amount);
      p.shield -= absorbed;
      amount -= Math.round(absorbed);
      this.effects.number(p.x, 2, p.z, Math.round(absorbed), 'shield');
      this.sound.play('shield');
      this.effects.ring(p.x, p.z, 0.5, 1.6, 0.25, '#8fd8ff', 0.8);
      if (amount <= 0) { if (!opts.drain) p.invuln = 0.35; return; }
    }
    p.hp -= amount;
    if (opts.src && opts.src.mods?.includes('vampiric') && !opts.src.dead) {
      opts.src.hp = Math.min(opts.src.maxHp, opts.src.hp + opts.src.maxHp * 0.15);
      this.effects.number(opts.src.x, opts.src.height + 0.5, opts.src.z, Math.round(opts.src.maxHp * 0.15), 'heal');
    }
    if (!opts.drain) {
      p.invuln = PLAYER_BASE.invulnTime;
      p.hurtFlash = 0.25;
      this.effects.flash = this.meta.settings.reduceFlash ? 0.35 : 0.8;
      this.effects.shake(0.25 + amount / 70);
      this.sound.play('hurt');
    } else this.drainT = 0.4;
    this.effects.number(p.x, 2.2, p.z, amount, 'player');
    this.effects.burst(p.x, 1, p.z, opts.drain ? 3 : 8, '#ff4d6d', 5, 0.35, 0.16);
    if (sx !== undefined && !opts.noKnock && !opts.drain) {
      const dx = p.x - sx, dz = p.z - sz, d = Math.hypot(dx, dz) || 1;
      p.vx += (dx / d) * 10; p.vz += (dz / d) * 10;
    }
    if (p.hp <= 0) {
      if (s.revive > p.revives) {
        p.revives++;
        const frac = this.relics.includes('phoenix') && p.revives === 1 && !this.levels.phoenix ? 0.4 : 0.5;
        p.hp = Math.round(p.maxHp * frac);
        p.invuln = 2.5;
        this.combat.pulse();
        this.effects.ring(p.x, p.z, 0.5, 9, 0.8, '#ffb547');
        this.effects.burst(p.x, 1, p.z, 40, '#ffb547', 12, 0.8, 0.3);
        this.ui.announce('REBORN', 'You rise from the ashes', '#ffb547');
        this.sound.play('levelup');
      } else this.die();
    }
  }

  die() {
    const p = this.player;
    p.alive = false;
    p.hp = 0;
    p.model.group.visible = false;
    this.effects.burst(p.x, 1, p.z, 50, p.trailColor, 12, 1.0, 0.3);
    this.effects.ring(p.x, p.z, 0.5, 8, 0.8, p.trailColor);
    this.effects.shake(0.7);
    this.sound.play('gameover');
    this.state = 'dying';
    this.dyingT = 2.0;
    this.victory = false;
  }

  onDash() {
    this.combat.onDash();
    this.objectives.onDash();
  }

  dashStrike(p) {
    this.enemies.grid.query(p.x, p.z, 4, near);
    for (const e of near) {
      if (e.dead || p.dashHits.has(e.id)) continue;
      const r = e.radius + 1.3;
      if ((e.x - p.x) ** 2 + (e.z - p.z) ** 2 > r * r) continue;
      p.dashHits.add(e.id);
      this.combat.hit(e, 32 * this.stats.damageMult, { procs: false, status: true, kbX: p.dashDirX, kbZ: p.dashDirZ, kb: 8 });
      this.effects.burst(e.x, 1, e.z, 6, p.trailColor, 6, 0.3, 0.18);
    }
  }

  dashSlow(p) {
    this.enemies.grid.query(p.x, p.z, 4, near);
    for (const e of near) if (!e.dead && (e.x - p.x) ** 2 + (e.z - p.z) ** 2 < (e.radius + 2) ** 2) e.slowT = 2;
  }

  addGold(v) {
    const amt = Math.max(1, Math.round(v * this.stats.goldMult));
    this.run.gold += amt;
    this.sound.play('coin');
  }

  onEnemyKilled(e) {
    const run = this.run;
    if (e.type === 'boss') { this.onBossKilled(); return; }
    const device = e.def.device;
    this.waves.onKill(e);
    if (device) {
      this.effects.burst(e.x, 0.8, e.z, 14, DEATH_COLORS[e.type], 8, 0.5, 0.2);
      this.effects.ring(e.x, e.z, 0.3, 2.2, 0.3, DEATH_COLORS[e.type]);
      this.sound.play('explode');
      if (e.xp) this.pickups.drop(e.x, e.z, e.xp);
      return;
    }
    run.kills++;
    if (e.elite || e.miniboss) run.elites++;
    run.shards += e.shards;
    this.meta.recordKill(e.type);
    this.events.onKill(e);
    this.objectives.onKill(e);
    this.combat.onKill(e);
    const big = e.elite || e.miniboss;
    this.effects.burst(e.x, 0.7 * e.scale, e.z, big ? 30 : 9, DEATH_COLORS[e.type], big ? 11 : 6, 0.5, 0.2 * Math.sqrt(e.scale), 8);
    this.sound.play('death');

    // Splitters break into two small, fragile halves.
    if (e.type === 'splitter' && e.gen === 0) {
      for (let i = 0; i < 2; i++) {
        const a = Math.random() * Math.PI * 2;
        const k = this.enemies.spawn('splitter', e.x + Math.cos(a) * 0.8, e.z + Math.sin(a) * 0.8, { gen: 1, waveTag: e.waveTag, counts: e.counts, mods: e.mods.filter((m) => m !== 'explosive' && m !== 'summoner') });
        k.spawnT = 0.7;
        if (e.counts && e.waveTag === this.waves.wave) this.waves.addQuota(1);
      }
    }
    if (e.mods.includes('explosive')) {
      this.hazards.add({ x: e.x, z: e.z, r: 3.2 * Math.sqrt(e.scale), delay: 1.0, damage: 20 * e.dmgScale, color: '#ff8a2a' });
    }
    if (big) {
      this.effects.ring(e.x, e.z, 0.5, 5, 0.5, '#ffcc4a');
      this.effects.shake(0.3);
      this.pickups.drop(e.x, e.z, Math.round((e.miniboss ? 40 : 20) * this.diff.healDrop + 5), 'heal');
      this.pickups.drop(e.x, e.z, e.miniboss ? 30 : 10 + Math.floor(Math.random() * 8), 'gold');
      if (e.miniboss || (!e.special && Math.random() < 0.3)) this.pickups.drop(e.x + 1, e.z, 1, 'chest', { bias: e.miniboss ? 6 : 2 });
    } else {
      if (Math.random() < 0.012 * this.diff.healDrop) this.pickups.drop(e.x, e.z, 12, 'heal');
      if (Math.random() < 0.045) this.pickups.drop(e.x, e.z, 2 + Math.floor(Math.random() * 3), 'gold');
    }
    let xp = Math.round(e.xp * this.mods.xp);
    if (xp <= 0) return;
    const pieces = Math.min(5, Math.ceil(xp / 6));
    for (let i = 0; i < pieces; i++) {
      const v = i === pieces - 1 ? xp : Math.floor(xp / (pieces - i));
      xp -= v;
      this.pickups.drop(e.x, e.z, v);
    }
  }

  startBoss(kind, tier = 1) {
    this.boss = this.bosses[kind];
    this.boss.spawn(tier, 1);
    this.bossStartTime = this.run.time;
  }

  onBossKilled() {
    const b = this.boss;
    this.run.kills++;
    this.run.elites++;
    this.run.bossesKilled++;
    this.objectives.onBossKilled(this.run.time - this.bossStartTime);
    for (const h of [...this.hazards.list]) if (h.tele) this.effects.hideTele(h.tele);
    this.hazards.clear();
    this.projectiles.clear();
    const finalBoss = this.waves.mode === 'campaign' && b.key === 'guardian';
    // Clear adds and devices
    for (const e of this.enemies.list) {
      if (e.type === 'boss' || e.dead) continue;
      if (!finalBoss && !e.def.device && !e.bossDevice) continue;
      e.dead = true;
      if (e.tele) { this.effects.hideTele(e.tele); e.tele = null; }
      this.effects.burst(e.x, 0.8, e.z, 8, DEATH_COLORS[e.type], 6, 0.5, 0.2);
    }
    this.enemies.list = this.enemies.list.filter((e) => !e.dead || e.type === 'boss');
    this.setSafeZone(ARENA_RADIUS, true);
    if (finalBoss) {
      this.run.shards += 120;
      this.state = 'dying';
      this.victory = true;
      this.dyingT = 3.2;
      this.bossBoomT = 0;
      this.player.invuln = 99;
      this.sound.play('bossRoar');
      this.ui.announce('GUARDIAN DEFEATED', 'The rift collapses', '#ffb547');
      return;
    }
    // Mid-run boss: big explosion, rewards, and the run continues.
    const e = b.e;
    this.run.shards += 40 * b.tier;
    this.effects.burst(e.x, 3, e.z, 70, '#ffffff', 16, 1.0, 0.4);
    this.effects.ring(e.x, e.z, 1, 16, 1, '#ffb547');
    this.effects.shake(0.8);
    this.sound.play('victory');
    this.pickups.drop(e.x, e.z, 60 + 20 * b.tier, 'gold');
    this.pickups.drop(e.x, e.z, Math.round(40 * this.diff.healDrop + 10), 'heal');
    this.pickups.drop(e.x + 1.5, e.z, 1, 'chest', { bias: 8, minRare: true });
    for (let i = 0; i < 6; i++) this.pickups.drop(e.x, e.z, 8 + 4 * b.tier);
    this.ui.announce(`${b.name.toUpperCase()} DEFEATED`, 'Claim your reward', '#ffb547');
    b.remove();
    this.waves.bossDefeated();
  }

  onWaveStart(n) {
    if (this.waves.endless && n > this.meta.data.records.endlessWave) this.run.newRecord = true;
  }

  onWaveCleared(n) {
    this.run.wavesCleared = n;
    this.run.shards += 6 + n * 2;
    this.pickups.vacuum();
    this.projectiles.clear();
    this.objectives.onWaveCleared(n);
    const healAmt = Math.round(this.player.maxHp * this.diff.waveHeal);
    if (healAmt > 0) this.heal(healAmt);
    const last = !this.waves.endless && n >= 10;
    if (!last) this.ui.announce(`WAVE ${n} CLEARED`, this.waves.endless ? `Endless — wave ${n}` : n === 9 ? 'The Guardian stirs…' : 'Catch your breath', '#6dffb0');
    this.sound.play('waveClear');
  }

  onObjectiveComplete(o) {
    const def = OBJECTIVES[o.id];
    this.run.shards += o.reward;
    let extra = '';
    if (def.cosmetic) {
      const [cat, id] = def.cosmetic;
      if (this.meta.unlock(cat, id, true)) extra = ` Unlocked cosmetic: ${COSMETICS[cat][id].name}!`;
    }
    this.ui.toast(`✔ Objective: ${o.name}`, '#6dffb0', `+${o.reward} Rift Shards.${extra}`);
    this.sound.play('select');
  }

  gainXp(v) {
    const run = this.run;
    run.xp += v * this.stats.xpMult;
    this.sound.play('xp');
    while (run.xp >= run.xpNext) {
      run.xp -= run.xpNext;
      run.level++;
      run.xpNext = xpForLevel(run.level);
      this.pendingLevels++;
    }
  }

  heal(v, quiet = false) {
    const p = this.player;
    if (!p.alive) return;
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + v);
    const gained = Math.round(p.hp - before);
    if (gained > 0 && !quiet) {
      this.effects.number(p.x, 2.2, p.z, gained, 'heal');
      this.effects.burst(p.x, 1, p.z, 10, '#6dff9b', 4, 0.5, 0.15);
      this.sound.play('heal');
    } else if (gained > 0 && Math.random() < 0.3) this.effects.particle(p.x, 1.5, p.z, 0, 2, 0, 0.4, 0.15, '#6dff9b');
  }

  // ------------------------------------------------------------------ relics
  addRelic(id, replace = null) {
    if (replace) this.relics = this.relics.filter((r) => r !== replace);
    if (this.relics.includes(id)) return;
    this.relics.push(id);
    this.meta.discover('relics', id);
    this.recomputeStats();
    if (id === 'glass' || id === 'bulwark') this.player.hp = Math.min(this.player.hp, this.player.maxHp);
    this.checkSynergies();
    this.objectives.onRelics(this.relics.length);
    this.ui.renderUpgradeIcons(this);
  }

  openRelicChest(extra = {}) {
    this.modalQueue.push({ type: 'relic', bias: extra.bias || 0, minRare: !!extra.minRare });
  }

  offerRelics(m) {
    let offers = rollRelics(this.meta, this.relics, 3, m.bias);
    if (m.minRare) {
      const good = offers.filter((r) => r.rarity !== 'common');
      if (good.length) offers = good.concat(offers.filter((r) => r.rarity === 'common')).slice(0, 3);
    }
    if (!offers.length) { this.addGold(40); this.ui.toast('Relic cache', '#ffd36b', 'No relics left to find — took 40 gold instead.'); this.closeModal(); return; }
    this.state = 'modal';
    this.lastOffers = offers.map((r) => r.id);
    this.sound.play('levelup');
    this.ui.showRelicChoice(offers, this.relics, this.stats.maxRelics ?? 4, (id, replace) => {
      if (id) this.addRelic(id, replace);
      this.closeModal();
    });
  }

  openShrine() {
    if (this.state !== 'playing') return;
    this.state = 'modal';
    const opts = rollShrine();
    this.ui.showShrine(opts.map((id) => ({ id, ...SHRINE_OPTIONS[id], disabled: SHRINE_OPTIONS[id].gold > this.run.gold })), this.run.gold, (id) => {
      if (id) this.applyShrine(id);
      this.closeModal();
    });
  }

  applyShrine(id) {
    const run = this.run, p = this.player;
    this.events.closeShrine();
    this.objectives.onShrine();
    this.sound.play('synergy');
    switch (id) {
      case 'bloodpact': run.shrine.maxHpMult = (run.shrine.maxHpMult || 1) * 0.85; run.shrine.damage = (run.shrine.damage || 0) + 0.15; break;
      case 'trial': {
        const [x, z] = this.waves.spawnPoint(12);
        const types = ['brute', 'knight', 'priest', 'bombardier', 'spitter'];
        this.enemies.spawn(types[Math.floor(Math.random() * types.length)], x, z, { elite: true, mods: this.enemies.rollMods(2), special: 'trial', counts: false });
        this.ui.toast('The trial begins!', '#ffd36b', 'Defeat the champion for a relic.');
        break;
      }
      case 'mend': run.gold -= 30; this.heal(Math.round(p.maxHp * 0.5)); break;
      case 'wisdom': run.xp = run.xpNext; this.gainXp(0.001); break;
      case 'fury': run.buffs.fury = 60; break;
      case 'gamble': {
        run.gold -= 25;
        const r = rollRelics(this.meta, this.relics, 1)[0];
        if (r) this.modalQueue.push({ type: 'relicFixed', id: r.id });
        break;
      }
      case 'ironvow': run.shrine.speed = (run.shrine.speed || 0) - 0.08; run.shrine.maxHpFlat = (run.shrine.maxHpFlat || 0) + 30; break;
    }
    this.recomputeStats();
    if (id === 'ironvow') p.hp = Math.min(p.maxHp, p.hp + 30);
  }

  openSupply() {
    if (this.state !== 'playing') return;
    this.state = 'modal';
    const refresh = () => this.ui.showSupply(SUPPLY_ITEMS.map((it) => ({ ...it, disabled: it.cost > this.run.gold || (it.limit && this.run.hearts >= it.limit) })), this.run.gold, (id) => {
      if (!id) { this.closeModal(); return; }
      const it = SUPPLY_ITEMS.find((x) => x.id === id);
      if (!it || it.cost > this.run.gold) return;
      this.run.gold -= it.cost;
      this.objectives.onPurchase();
      this.sound.play('coin');
      if (id === 'heal') this.heal(Math.round(this.player.maxHp * 0.35));
      if (id === 'heart') { this.run.hearts++; this.recomputeStats(); this.player.hp += 12; }
      if (id === 'tome') { this.pendingLevels++; this.closeModal(); return; }
      if (id === 'relic') { this.modalQueue.push({ type: 'relic', bias: 2 }); this.closeModal(); return; }
      refresh();
    });
    refresh();
  }

  closeModal() {
    this.state = 'playing';
    this.ui.show(null);
    this.input.mouse.down = false;
  }

  // ------------------------------------------------------------------ level up
  openLevelUp() {
    this.state = 'levelup';
    this.choices = rollUpgrades(this.levels, this.waves.wave, 3, { lucky: this.stats.relic.lucky, maxWeapons: this.stats.maxWeapons });
    this.levelOpenedAt = performance.now();
    this.sound.play('levelup');
    this.effects.ring(this.player.x, this.player.z, 0.5, 4, 0.5, '#4fd0ff');
    this.ui.showLevelUp(this.choices, this.levels, this.pendingLevels, this.relics, (i) => this.pickUpgrade(i));
  }

  pickUpgrade(i) {
    if (this.state !== 'levelup' || performance.now() - this.levelOpenedAt < 380) return;
    const u = this.choices[i];
    if (!u) return;
    this.sound.play('select');
    if (u.filler) {
      if (u.id === 'heal') this.heal(Math.round(this.player.maxHp * 0.35));
      else this.addGold(30);
    } else {
      this.levels[u.id] = (this.levels[u.id] || 0) + 1;
      if (u.weapon) this.meta.discover('weapons', u.id);
      this.run.picks++;
      this.recomputeStats();
      if (u.id === 'vitality') this.heal(20);
      if (u.id === 'shield') this.player.shield = this.stats.shield;
      this.checkSynergies();
    }
    this.ui.renderUpgradeIcons(this);
    this.pendingLevels--;
    if (this.pendingLevels > 0) this.openLevelUp();
    else {
      this.state = 'playing';
      this.ui.show(null);
    }
  }

  // ------------------------------------------------------------------ frame
  updateAim() {
    this.tmp.set(this.input.mouse.ndcX, this.input.mouse.ndcY);
    this.raycaster.setFromCamera(this.tmp, this.camera);
    this.raycaster.ray.intersectPlane(this.aimPlane, this.aimPoint);
  }

  update(dt) {
    const input = this.input;
    if (this.state !== 'paused' && this.state !== 'levelup' && this.state !== 'modal') this.t += dt;

    if (this.state === 'playing') {
      if (input.wasPressed('Escape') || input.wasPressed('KeyP')) { this.pause(); return; }
      this.run.time += dt;
      this.run.buffs.fury = Math.max(0, this.run.buffs.fury - dt);
      this.drainT = Math.max(0, (this.drainT || 0) - dt);
      this.updateAim();
      if (input.wasPressed('ShiftLeft') || input.wasPressed('ShiftRight') || input.wasPressed('KeyQ')) this.combat.ability();
      this.player.update(dt, this);
      this.clampToSafe(this.player, this.player.radius - 2); // allow stepping slightly outside (takes damage)
      const firing = input.mouse.down || this.meta.settings.autofire;
      this.combat.update(dt, firing);
      this.waves.update(dt);
      this.events.update(dt);
      this.enemies.update(dt, this.t);
      if (this.boss.active) this.boss.update(dt, this.t);
      this.hazards.update(dt);
      this.projectiles.update(dt, this);
      this.pickups.update(dt, this);
      this.updateSafeZone(dt);
      if (this.state === 'playing') {
        if (this.pendingLevels > 0) this.openLevelUp();
        else if (this.modalQueue.length) {
          const m = this.modalQueue.shift();
          if (m.type === 'relic') this.offerRelics(m);
          else if (m.type === 'relicFixed') {
            this.state = 'modal';
            this.lastOffers = [m.id];
            this.ui.showRelicChoice([RELIC_BY_ID[m.id]], this.relics, 4, (id, replace) => { if (id) this.addRelic(id, replace); this.closeModal(); });
          }
        }
      }
    } else if (this.state === 'levelup') {
      for (let i = 0; i < 3; i++) if (input.wasPressed(`Digit${i + 1}`) || input.wasPressed(`Numpad${i + 1}`)) this.pickUpgrade(i);
    } else if (this.state === 'dying') {
      this.updateDying(dt);
    }
  }

  updateDying(dt) {
    this.dyingT -= dt;
    this.projectiles.update(dt * 0.35, this);
    if (this.victory) {
      const e = this.boss.e;
      this.bossBoomT -= dt;
      if (e && this.bossBoomT <= 0) {
        this.bossBoomT = 0.18;
        const x = e.x + (Math.random() - 0.5) * 5, z = e.z + (Math.random() - 0.5) * 5;
        this.effects.burst(x, 1 + Math.random() * 5, z, 16, Math.random() < 0.5 ? '#ff6bd5' : '#ffb547', 10, 0.6, 0.3);
        this.effects.ring(x, z, 0.3, 4, 0.4, '#ff6bd5');
        this.effects.shake(0.25);
        this.sound.play('explode');
      }
      if (this.dyingT <= 0.8 && e) {
        this.effects.burst(e.x, 3, e.z, 80, '#ffffff', 18, 1.2, 0.4);
        this.effects.ring(e.x, e.z, 1, 20, 1.2, '#ffb547');
        this.effects.shake(1);
        this.boss.remove();
        this.sound.play('victory');
      }
      this.pickups.vacuum();
      this.pickups.update(dt, this);
    }
    if (this.dyingT <= 0) this.endRun(this.victory);
  }

  recordEnd(victory) {
    if (victory) this.objectives.onVictory(this.levels);
    const shards = this.shardTotal(victory);
    const newRecord = this.meta.recordRun({
      shards, wave: this.waves.wave, time: this.run.time, victory, mode: this.waves.mode, diff: this.cfg.diff,
      cls: this.cfg.cls, kills: this.run.kills, level: this.run.level, arena: this.run.arena,
    });
    return { shards, newRecord };
  }

  endRun(victory) {
    const { shards, newRecord } = this.recordEnd(victory);
    this.state = victory ? 'victory' : 'gameover';
    this.ui.setHudVisible(false);
    this.ui.showEnd(victory, {
      time: this.run.time, wave: this.waves.wave, kills: this.run.kills, level: this.run.level,
      damage: this.run.damageDealt, elites: this.run.elites, picks: this.run.picks, shards,
      mode: this.waves.mode, diff: this.diff, newRecord, objectives: this.objectives.list, bosses: this.run.bossesKilled,
      records: this.meta.data.records, cls: CLASSES[this.cfg.cls].name, arena: ARENAS[this.run.arena].name,
    }, this);
  }

  snapCamera() {
    this.camTarget.set(this.player.x, 0, this.player.z);
    this.camPos.copy(this.camTarget).add(CAM_OFFSET);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);
  }

  updateCamera(dt) {
    const cam = this.camera;
    if (this.state === 'menu') {
      const a = this.t * 0.06;
      cam.position.set(Math.sin(a) * 30, 17, Math.cos(a) * 30 + 6);
      cam.lookAt(0, 3, -18);
      return;
    }
    const p = this.player;
    let lx = (this.aimPoint.x - p.x) * 0.15, lz = (this.aimPoint.z - p.z) * 0.15;
    const l = Math.hypot(lx, lz);
    if (l > 3) { lx *= 3 / l; lz *= 3 / l; }
    if (this.state !== 'playing') { lx = lz = 0; }
    const k = 1 - Math.exp(-dt * 6);
    this.camTarget.x += (p.x + lx - this.camTarget.x) * k;
    this.camTarget.z += (p.z + lz - this.camTarget.z) * k;
    this.camPos.copy(this.camTarget).add(CAM_OFFSET);
    cam.position.copy(this.camPos).add(this.effects.shakeOffset);
    cam.lookAt(this.camTarget.x + this.effects.shakeOffset.x * 0.5, 0, this.camTarget.z + this.effects.shakeOffset.z * 0.5);
  }

  render(dt) {
    const active = this.state === 'playing' || this.state === 'dying';
    const vdt = active ? (this.state === 'dying' ? dt * 0.5 : dt) : 0;
    if (active || this.state === 'menu') this.world.update(dt, this.t);
    this.player.render(this.t);
    this.enemies.render(this.t);
    for (const b of Object.values(this.bosses)) b.render(this.t);
    this.projectiles.render(this.t);
    this.pickups.render(this.t);
    this.hazards.render(this.t);
    this.events.render(this.t);
    this.combat.renderBlades(this.t);
    this.effects.update(vdt, this.camera);
    this.updateCamera(dt);
    const sun = this.world.sun;
    sun.position.set(this.camTarget.x - 14, 30, this.camTarget.z + 10);
    sun.target.position.set(this.camTarget.x, 0, this.camTarget.z);
  }

  debugAPI() {
    return {
      game: this,
      wave: (n) => { this.enemies.clear(); this.projectiles.clear(); this.hazards.clear(); for (const b of Object.values(this.bosses)) b.remove(); this.setSafeZone(ARENA_RADIUS, true); this.waves.start(n); },
      god: (on = true) => { this.god = on; },
      xp: (n) => this.gainXp(n),
      gold: (n) => { this.run.gold += n; },
      give: (id, n = 1) => { this.levels[id] = Math.min(UPGRADE_BY_ID[id].max, (this.levels[id] || 0) + n); this.recomputeStats(); this.checkSynergies(); this.ui.renderUpgradeIcons(this); },
      relic: (id) => this.addRelic(id),
      spawn: (type, opts = {}) => this.enemies.spawn(type, this.player.x + 6, this.player.z, opts),
      boss: (kind) => { this.enemies.clear(); this.startBoss(kind, 1); this.waves.state = 'boss'; },
      killAll: () => { for (const e of [...this.enemies.list]) if (e.type !== 'boss') this.enemies.kill(e); },
      hurt: (n) => this.damagePlayer(n),
      shrine: () => this.events.placeShrine(),
      supply: () => this.events.openPortal(),
      weapons: WEAPON_IDS,
    };
  }
}
