import * as THREE from 'three';
import { PLAYER_BASE, xpForLevel } from './config.js';
import { World } from './world.js';
import { Effects } from './effects.js';
import { Player } from './player.js';
import { Enemies } from './enemies.js';
import { Projectiles } from './projectiles.js';
import { Pickups } from './pickups.js';
import { Combat } from './combat.js';
import { Boss } from './boss.js';
import { WaveDirector } from './waves.js';
import { computeStats, rollUpgrades, newSynergies, UPGRADE_BY_ID } from './upgrades.js';

const DEATH_COLORS = { crawler: '#c47bff', dasher: '#38d6d0', spitter: '#9dff3a', brute: '#ff8a3a', boss: '#ff6bd5' };
const CAM_OFFSET = new THREE.Vector3(0, 21, 15);
const near = [];

export class Game {
  constructor({ scene, camera, ui, sound, input, meta }) {
    Object.assign(this, { scene, camera, ui, sound, input, meta });
    this.world = new World(scene);
    this.effects = new Effects(scene, document.getElementById('dmg-layer'));
    this.player = new Player(scene);
    this.enemies = new Enemies(scene, this);
    this.projectiles = new Projectiles(scene);
    this.pickups = new Pickups(scene);
    this.combat = new Combat(this);
    this.boss = new Boss(scene, this);
    this.waves = new WaveDirector(this);

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
    this.pendingLevels = 0;
    this.choices = [];
    this.stats = computeStats(meta.bonuses(), {}, []);
    this.newRunState();
    this.god = false;
  }

  newRunState() {
    this.run = { time: 0, kills: 0, elites: 0, level: 1, xp: 0, xpNext: xpForLevel(1), shards: 0, damageDealt: 0, picks: 0, wavesCleared: 0 };
  }

  // Remove every run-specific object from the world.
  cleanup() {
    this.enemies.clear();
    this.projectiles.clear();
    this.pickups.clear();
    this.effects.clear();
    this.boss.remove();
    this.combat.reset();
    this.waves.reset();
  }

  startRun() {
    this.cleanup();
    this.levels = {};
    this.synergies = new Set();
    this.pendingLevels = 0;
    this.newRunState();
    this.stats = computeStats(this.meta.bonuses(), this.levels, this.synergies);
    this.player.reset(this.stats.maxHp);
    this.input.mouse.down = false;
    this.ui.clearTransient();
    this.ui.renderUpgradeIcons(this.levels, this.synergies);
    this.ui.setHudVisible(true);
    this.ui.show(null);
    this.state = 'playing';
    this.snapCamera();
    this.waves.start(1);
  }

  // Abandoning a run still banks the shards earned so far.
  abandonRun() {
    if (this.run && (this.state === 'paused' || this.state === 'playing' || this.state === 'levelup')) {
      this.meta.recordRun({ shards: this.shardTotal(false), wave: this.waves.wave, time: this.run.time, victory: false });
    }
  }

  goToMenu() {
    this.cleanup();
    this.player.reset(this.stats.maxHp);
    this.state = 'menu';
    this.ui.setHudVisible(false);
  }

  shardTotal(victory) {
    const greed = 1 + 0.1 * this.meta.level('greed');
    return Math.floor((this.run.shards + (victory ? 150 : 0)) * greed);
  }

  recomputeStats() {
    const oldMax = this.stats.maxHp;
    this.stats = computeStats(this.meta.bonuses(), this.levels, this.synergies);
    const p = this.player;
    p.maxHp = this.stats.maxHp;
    if (this.stats.maxHp > oldMax) p.hp += this.stats.maxHp - oldMax;
    p.hp = Math.min(p.hp, p.maxHp);
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

  // ------------------------------------------------------------------ combat events
  damagePlayer(amount, sx, sz) {
    const p = this.player;
    if (!p.alive || p.invuln > 0 || this.state !== 'playing' || this.god) return;
    amount = Math.max(1, Math.round(amount));
    p.shieldDelay = 4;
    if (p.shield >= 1) {
      const absorbed = Math.min(p.shield, amount);
      p.shield -= absorbed;
      amount -= Math.round(absorbed);
      this.effects.number(p.x, 2, p.z, Math.round(absorbed), 'shield');
      this.sound.play('shield');
      this.effects.ring(p.x, p.z, 0.5, 1.6, 0.25, '#8fd8ff', 0.8);
      if (amount <= 0) { p.invuln = 0.35; return; }
    }
    p.hp -= amount;
    p.invuln = PLAYER_BASE.invulnTime;
    p.hurtFlash = 0.25;
    this.effects.flash = 0.8;
    this.effects.shake(0.25 + amount / 70);
    this.effects.number(p.x, 2.2, p.z, amount, 'player');
    this.effects.burst(p.x, 1, p.z, 8, '#ff4d6d', 5, 0.35, 0.16);
    this.sound.play('hurt');
    if (sx !== undefined) {
      const dx = p.x - sx, dz = p.z - sz, d = Math.hypot(dx, dz) || 1;
      p.vx += (dx / d) * 10; p.vz += (dz / d) * 10;
    }
    if (p.hp <= 0) {
      if (this.stats.revive && !p.revived) {
        p.revived = true;
        p.hp = Math.round(p.maxHp * 0.5);
        p.invuln = 2.5;
        p.pulseCd = 0;
        this.combat.pulse();
        this.effects.ring(p.x, p.z, 0.5, 9, 0.8, '#ffb547');
        this.effects.burst(p.x, 1, p.z, 40, '#ffb547', 12, 0.8, 0.3);
        this.ui.announce('PHOENIX HEART', 'You rise from the ashes', '#ffb547');
        this.sound.play('levelup');
      } else this.die();
    }
  }

  die() {
    const p = this.player;
    p.alive = false;
    p.hp = 0;
    p.model.group.visible = false;
    this.effects.burst(p.x, 1, p.z, 50, '#3be6ff', 12, 1.0, 0.3);
    this.effects.ring(p.x, p.z, 0.5, 8, 0.8, '#3be6ff');
    this.effects.shake(0.7);
    this.sound.play('gameover');
    this.state = 'dying';
    this.dyingT = 2.0;
    this.victory = false;
  }

  dashStrike(p) {
    this.enemies.grid.query(p.x, p.z, 4, near);
    for (const e of near) {
      if (e.dead || p.dashHits.has(e.id)) continue;
      const r = e.radius + 1.3;
      if ((e.x - p.x) ** 2 + (e.z - p.z) ** 2 > r * r) continue;
      p.dashHits.add(e.id);
      this.combat.hit(e, 32 * this.stats.damageMult, { procs: false, status: true, kbX: p.dashDirX, kbZ: p.dashDirZ, kb: 8 });
      this.effects.burst(e.x, 1, e.z, 6, '#7ff6ff', 6, 0.3, 0.18);
    }
  }

  onEnemyKilled(e) {
    const run = this.run;
    if (e.type === 'boss') { this.onBossKilled(); return; }
    run.kills++;
    if (e.elite || e.miniboss) run.elites++;
    run.shards += e.shards;
    this.waves.onKill(e);
    const color = DEATH_COLORS[e.type];
    this.effects.burst(e.x, 0.7 * e.scale, e.z, e.elite || e.miniboss ? 30 : 9, color, e.elite || e.miniboss ? 11 : 6, 0.5, 0.2 * Math.sqrt(e.scale), 8);
    if (e.elite || e.miniboss) {
      this.effects.ring(e.x, e.z, 0.5, 5, 0.5, '#ffcc4a');
      this.effects.shake(0.3);
      this.pickups.drop(e.x, e.z, e.miniboss ? 40 : 20, 'heal');
    } else if (Math.random() < 0.012) this.pickups.drop(e.x, e.z, 12, 'heal');
    this.sound.play('death');

    let xp = e.xp;
    const pieces = Math.min(5, Math.ceil(xp / 6));
    for (let i = 0; i < pieces; i++) {
      const v = i === pieces - 1 ? xp : Math.floor(e.xp / pieces);
      xp -= v;
      this.pickups.drop(e.x, e.z, v);
    }
  }

  onBossKilled() {
    const b = this.boss;
    this.run.kills++;
    this.run.elites++;
    this.state = 'dying';
    this.victory = true;
    this.dyingT = 3.2;
    this.bossBoomT = 0;
    this.player.invuln = 99;
    for (const e of this.enemies.list) {
      if (e.type === 'boss' || e.dead) continue;
      e.dead = true;
      if (e.tele) { this.effects.hideTele(e.tele); e.tele = null; }
      this.effects.burst(e.x, 0.8, e.z, 8, DEATH_COLORS[e.type], 6, 0.5, 0.2);
    }
    this.enemies.list = this.enemies.list.filter((e) => e.type === 'boss');
    this.projectiles.clear();
    for (const h of b.hazards) this.effects.hideTele(h.tele);
    b.hazards.length = 0;
    if (b.tele) { this.effects.hideTele(b.tele); b.tele = null; }
    this.sound.play('bossRoar');
    this.ui.announce('GUARDIAN DEFEATED', 'The rift collapses', '#ffb547');
  }

  onWaveCleared(n) {
    this.run.wavesCleared = n;
    this.run.shards += 10 + n * 2;
    this.pickups.vacuum();
    this.projectiles.clear();
    const p = this.player;
    const healAmt = Math.round(p.maxHp * 0.1);
    this.heal(healAmt);
    this.ui.announce(`WAVE ${n} CLEARED`, n === 9 ? 'The Guardian stirs…' : 'Catch your breath', '#6dffb0');
    this.sound.play('waveClear');
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

  heal(v) {
    const p = this.player;
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + v);
    const gained = Math.round(p.hp - before);
    if (gained > 0) {
      this.effects.number(p.x, 2.2, p.z, gained, 'heal');
      this.effects.burst(p.x, 1, p.z, 10, '#6dff9b', 4, 0.5, 0.15);
      this.sound.play('heal');
    }
  }

  // ------------------------------------------------------------------ level up
  openLevelUp() {
    this.state = 'levelup';
    this.choices = rollUpgrades(this.levels, this.waves.wave);
    this.levelOpenedAt = performance.now();
    this.sound.play('levelup');
    this.effects.ring(this.player.x, this.player.z, 0.5, 4, 0.5, '#4fd0ff');
    this.ui.showLevelUp(this.choices, this.levels, this.pendingLevels, (i) => this.pickUpgrade(i));
  }

  pickUpgrade(i) {
    if (this.state !== 'levelup' || performance.now() - this.levelOpenedAt < 380) return;
    const u = this.choices[i];
    if (!u) return;
    this.sound.play('select');
    if (u.filler) {
      if (u.id === 'heal') this.heal(Math.round(this.player.maxHp * 0.35));
      else this.run.shards += 15;
    } else {
      this.levels[u.id] = (this.levels[u.id] || 0) + 1;
      this.run.picks++;
      this.recomputeStats();
      if (u.id === 'vitality') this.heal(20);
      if (u.id === 'shield') this.player.shield = this.stats.shield;
      for (const s of newSynergies(this.levels, this.synergies)) {
        this.synergies.add(s.id);
        this.recomputeStats();
        this.ui.toast(`✨ Synergy: ${s.name}`, '#ffb547', s.desc);
        this.ui.announce(`SYNERGY: ${s.name.toUpperCase()}`, s.parts, '#ffb547');
        this.effects.ring(this.player.x, this.player.z, 0.5, 6, 0.7, '#ffb547');
        this.effects.burst(this.player.x, 1.2, this.player.z, 30, '#ffb547', 8, 0.8, 0.2);
        this.sound.play('synergy');
      }
    }
    this.ui.renderUpgradeIcons(this.levels, this.synergies);
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
    if (this.state !== 'paused' && this.state !== 'levelup') this.t += dt;

    if (this.state === 'playing') {
      if (input.wasPressed('Escape') || input.wasPressed('KeyP')) { this.pause(); return; }
      this.run.time += dt;
      this.updateAim();
      if (input.wasPressed('ShiftLeft') || input.wasPressed('ShiftRight')) this.combat.pulse();
      this.player.update(dt, this);
      const firing = input.mouse.down || this.meta.settings.autofire;
      this.combat.update(dt, firing);
      this.waves.update(dt);
      this.enemies.update(dt, this.t);
      this.boss.update(dt, this.t);
      this.projectiles.update(dt, this);
      this.pickups.update(dt, this);
      if (this.pendingLevels > 0 && this.state === 'playing') this.openLevelUp();
    } else if (this.state === 'levelup') {
      for (let i = 0; i < 3; i++) if (input.wasPressed(`Digit${i + 1}`) || input.wasPressed(`Numpad${i + 1}`)) this.pickUpgrade(i);
    } else if (this.state === 'dying') {
      this.updateDying(dt);
    }
  }

  updateDying(dt) {
    this.dyingT -= dt;
    const slow = dt * 0.35;
    this.projectiles.update(slow, this);
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

  endRun(victory) {
    const shards = this.shardTotal(victory);
    this.meta.recordRun({ shards, wave: this.waves.wave, time: this.run.time, victory });
    this.state = victory ? 'victory' : 'gameover';
    this.ui.setHudVisible(false);
    this.ui.showEnd(victory, {
      time: this.run.time, wave: this.waves.wave, kills: this.run.kills, level: this.run.level,
      damage: this.run.damageDealt, elites: this.run.elites, picks: this.run.picks, shards,
    }, this.levels, this.synergies);
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
    this.boss.render(this.t);
    this.projectiles.render(this.t);
    this.pickups.render(this.t);
    this.effects.update(vdt, this.camera);
    this.updateCamera(dt);
    // Shadow camera follows the action
    const sun = this.world.sun;
    sun.position.set(this.camTarget.x - 14, 30, this.camTarget.z + 10);
    sun.target.position.set(this.camTarget.x, 0, this.camTarget.z);
  }

  debugAPI() {
    return {
      game: this,
      wave: (n) => { this.enemies.clear(); this.projectiles.clear(); this.boss.remove(); this.waves.start(n); },
      god: (on = true) => { this.god = on; },
      xp: (n) => this.gainXp(n),
      give: (id, n = 1) => { this.levels[id] = Math.min(UPGRADE_BY_ID[id].max, (this.levels[id] || 0) + n); for (const s of newSynergies(this.levels, this.synergies)) this.synergies.add(s.id); this.recomputeStats(); this.ui.renderUpgradeIcons(this.levels, this.synergies); },
      killAll: () => { for (const e of [...this.enemies.list]) if (e.type !== 'boss') this.enemies.kill(e); },
      hurt: (n) => this.damagePlayer(n),
    };
  }
}
