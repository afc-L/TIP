// Match orchestration: scene, entities, player control, camera, damage, rewards.
import * as THREE from 'three';
import { Arena } from './arenas.js';
import { Effects } from './effects.js';
import { ProjectileSystem, hitTest } from './combat.js';
import { Mech, Drone, Structure } from './mech.js';
import { AIController, Squad } from './ai.js';
import { createBossController, BOSS_SETUP } from './bosses.js';
import { createMode } from './modes.js';
import { Input } from './input.js';
import { sfx, playMusic } from './audio.js';
import {
  profile, save, addXp, checkAchievements, contractProgress, ensureDaily, upgradeTotal,
} from './save.js';
import { ENEMY_TYPES, DIFFICULTIES, CONDITIONS, BOSSES, ARENAS, CHALLENGES, levelUnlocks, WEAPONS, FRAMES } from './data.js';
import { clamp, rand, pick, wrapAngle, damp, segSphere } from './util.js';
import { Hud } from './hud.js';

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _u = new THREE.Vector3();
const SHIELD_MULT = { energy: 1.25, explosive: 0.85, impact: 1, precision: 1, hazard: 1 };
const ARMOR_MULT = { impact: 1.2, energy: 1, explosive: 1, precision: 1, hazard: 1 };

export class Game {
  constructor(app, cfg) {
    this.app = app; this.cfg = cfg; this.profile = profile;
    this.renderer = app.renderer; this.camera = app.camera;
    const st = profile.settings;
    this.quality = st.quality; this.shadows = st.shadows && st.quality !== 'low';
    this.difficulty = cfg.difficulty || st.difficulty;
    this.diffDef = DIFFICULTIES[this.difficulty];
    this.pilotLevel = profile.level;
    this.frame = 0; this.time = 0; this.ended = false; this.paused = false;
    this.condition = CONDITIONS[cfg.condition || 'clear'];
    const ch = cfg.mode === 'challenge' ? CHALLENGES.find((c) => c.id === cfg.challenge) : null;
    this.challengeMods = ch ? ch.mods : {};
    if (ch) { this.difficulty = ch.diff; this.diffDef = DIFFICULTIES[ch.diff]; cfg.arena = ch.arena; }
    if (cfg.mode === 'boss') cfg.arena = BOSSES[cfg.boss].arena;

    // ---------------- scene ----------------
    this.scene = new THREE.Scene();
    this.arena = new Arena(cfg.arena, this.quality, this.condition);
    const th = this.arena.theme;
    let fogD = th.fogD;
    if (this.condition.fog) fogD = Math.max(fogD, 0.004) / this.condition.fog * 0.6;
    if (this.challengeMods.fog) fogD = Math.max(fogD, 0.004) / this.challengeMods.fog * 0.8;
    const fogCol = new THREE.Color(th.fog);
    if (this.condition.dark) fogCol.multiplyScalar(0.25);
    this.scene.fog = new THREE.FogExp2(fogCol, fogD);
    this.scene.background = fogCol;
    this.sightRange = clamp(2.2 / fogD, 70, 240);
    this.scene.add(this.arena.group);
    const dark = this.condition.dark ? 0.35 : 1;
    this.hemi = new THREE.HemisphereLight(th.hemiS, th.hemiG, th.hemiI * dark);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(th.sun, th.sunI * dark);
    this.sunDir = new THREE.Vector3(...th.sunDir).normalize();
    this.scene.add(this.sun, this.sun.target);
    if (this.shadows) {
      this.sun.castShadow = true;
      const s = st.quality === 'high' ? 2048 : 1024;
      this.sun.shadow.mapSize.set(s, s);
      const c = this.sun.shadow.camera; c.left = -70; c.right = 70; c.top = 70; c.bottom = -70; c.near = 10; c.far = 320;
      this.sun.shadow.bias = -0.0008; this.sun.shadow.normalBias = 0.6;
    }
    if (this.condition.dark && this.arena.themeId !== 'neon') {
      this.playerLight = new THREE.SpotLight(0xdfefff, 3, 90, 0.5, 0.5, 1);
      this.scene.add(this.playerLight, this.playerLight.target);
    }
    this.gravityMul = this.arena.gravityMul * (this.condition.gravity || 1) * (this.challengeMods.gravity || 1);
    this.shieldRegenMul = this.condition.shieldRegen || 1;
    this.energyRegenMul = this.condition.energyRegen || 1;

    this.effects = new Effects(this.scene, this.camera, st);
    this.projectiles = new ProjectileSystem(this);

    this.mechs = []; this.structures = []; this.targets = []; this.drones = []; this.pickups = []; this.waves = []; this.timers = []; this.domes = [];
    this.squads = [new Squad(this, 0, this.difficulty), new Squad(this, 1, this.difficulty)];
    this.matchStats = { kills: 0, damage: 0, damageTaken: 0, crits: 0, shots: 0, hits: 0, weaponDamage: {}, abilities: 0, killsByType: {}, captures: 0, deaths: 0, dmgByType: {}, meleeHits: 0, meleeKills: 0 };
    this.pickupT = 25;
    // threat scaling: enemies grow modestly with player's upgrades so progression doesn't trivialize the game
    this.threat = 1 + Math.min(0.2, upgradeTotal() * 0.0075) + Math.max(0, profile.level - 10) * 0.005;

    // ---------------- player ----------------
    const lo = JSON.parse(JSON.stringify(profile.loadouts[profile.currentFrame]));
    if (this.challengeMods.forceWeapons) lo.weapons = this.challengeMods.forceWeapons.slice();
    this.player = new Mech(this, { loadout: lo, team: 0, isPlayer: true, name: profile.pilot || 'YOU', upgrades: profile.upgrades, mods: this.challengeMods });
    this.player.controller = new PlayerController(this, this.player);
    const sp = this.arena.playerSpawns[0];
    this.player.pos.copy(sp);
    this.player.yaw = this.player.legYaw = Math.atan2(-sp.x, -sp.z);
    this.addMech(this.player);
    this.camYaw = this.player.yaw; this.camPitch = -0.08;
    this.camPos = new THREE.Vector3();
    this.zoom = 0;
    this.hud = new Hud(this);

    // destructible props
    for (const p of this.arena.props) this.spawnBarrel(p.x, p.z);

    this.mode = createMode(this, cfg);
    this.mode.start();
    this.hud.showCondition(this.condition);
    this.startStats = { hp: this.player.stats.maxHp };
    this.minHpFrac = 1;
    this.spectate = false; this.respawnAt = 0;
    playMusic(cfg.mode === 'boss' ? 'boss' : 'combat');
  }

  // ---------------- entity management ----------------
  addMech(m) { this.mechs.push(m); this.targets.push(m); }
  addStructure(s) { this.structures.push(s); this.targets.push(s); }
  removeTarget(t) { const i = this.targets.indexOf(t); if (i >= 0) this.targets.splice(i, 1); }

  makeLoadout(typeId) {
    const t = ENEMY_TYPES[typeId];
    return { frame: t.frame, armor: t.armor, mobility: t.mobility, weapons: t.weapons.slice(), equip: t.equip.slice() };
  }
  spawnEnemy(typeId, pos, o = {}) {
    const t = ENEMY_TYPES[typeId] || ENEMY_TYPES.assault;
    const lo = o.loadout || this.makeLoadout(typeId);
    const m = new Mech(this, {
      loadout: lo, team: 1, name: o.name || t.name, role: t.role, enemyType: typeId,
      hpMul: (o.hpMul || 1) * this.threat, scale: o.scale, palette: o.palette || (typeId === 'elite' ? 'elite' : 'enemy'),
      maxHp: o.maxHp, maxShield: o.maxShield, outDmgMul: o.outDmgMul, speedMul: o.speedMul, extras: o.extras,
    });
    m.decoy = !!o.decoy; m.noReward = !!o.noReward; m.miniboss = !!o.miniboss;
    m.pos.copy(pos); m.pos.y = 0;
    m.yaw = m.legYaw = Math.atan2(-pos.x, -pos.z);
    m.controller = new AIController(m, t.role, this.difficulty, this.squads[1]);
    this.addMech(m);
    this.effects.flash(m.center(_v).clone(), 4, 0xff7a1a, 0.4);
    return m;
  }
  spawnAlly(role, pos) {
    const typeId = { assault: 'assault', sniper: 'sniper', support: 'support', tank: 'tank' }[role] || 'assault';
    const lo = this.makeLoadout(typeId);
    const m = new Mech(this, { loadout: lo, team: 0, name: `ALLY ${['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA'][this.mechs.filter((x) => x.team === 0).length % 4]}`, role, enemyType: typeId, palette: 'ally' });
    m.pos.copy(pos);
    m.yaw = m.legYaw = Math.atan2(-pos.x, -pos.z);
    m.controller = new AIController(m, role, this.difficulty === 'easy' ? 'normal' : this.difficulty, this.squads[0]);
    this.addMech(m);
    return m;
  }
  spawnBoss(id, pos) {
    const S = BOSS_SETUP[id], B = BOSSES[id];
    const lo = { frame: S.frame, armor: 'standard', mobility: 'standard', weapons: S.weapons.slice(), equip: [] };
    const diffHp = { easy: 0.75, normal: 1, hard: 1.15, expert: 1.3 }[this.difficulty];
    const m = new Mech(this, {
      loadout: lo, team: 1, name: B.name, scale: S.scale, palette: S.palette, maxHp: B.hp * diffHp * this.threat, maxShield: B.shield * diffHp,
      speedMul: S.speedMul, outDmgMul: S.out, extras: S.extras,
    });
    m.pos.copy(pos);
    m.yaw = m.legYaw = Math.atan2(-pos.x, -pos.z);
    m.turnRate = S.turnRate;
    m.bossCtrl = createBossController(this, m, id);
    m.controller = m.bossCtrl;
    this.boss = m;
    this.addMech(m);
    return m;
  }
  spawnBarrel(x, z) {
    if (!this._barrelGeo) {
      this._barrelGeo = new THREE.CylinderGeometry(1.1, 1.1, 2.6, 10); this._barrelGeo.userData.shared = true;
      this._barrelMat = new THREE.MeshStandardMaterial({ color: 0xc23b22, metalness: 0.4, roughness: 0.5, flatShading: true }); this._barrelMat.userData.shared = true;
      this._stripeGeo = new THREE.CylinderGeometry(1.15, 1.15, 0.3, 10); this._stripeGeo.userData.shared = true;
      this._stripeMat = new THREE.MeshBasicMaterial({ color: 0xffcc33 }); this._stripeMat.userData.shared = true;
    }
    const g = new THREE.Group();
    const b = new THREE.Mesh(this._barrelGeo, this._barrelMat); b.position.y = 1.3; b.castShadow = this.shadows;
    const s = new THREE.Mesh(this._stripeGeo, this._stripeMat); s.position.y = 1.8;
    g.add(b, s);
    const st = new Structure(this, { kind: 'barrel', name: 'Fuel Cell', pos: new THREE.Vector3(x, 0, z), radius: 1.2, height: 2.6, hp: 60, team: 2, mesh: g, solid: true,
      onDeath: (o) => { this.explode(o.center(new THREE.Vector3()), 9, 130, 'explosive', o.lastHitBy || null, { color: 0xff7a1a, prop: true }); } });
    this.addStructure(st);
  }
  /** Best barrage target for a mech: the visible enemy nearest its aim (players) or its AI target. */
  barrageTarget(m) {
    if (m.controller && m.controller.target && m.controller.target.alive && !m.isPlayer) return m.controller.target;
    const eye = m.eye(new THREE.Vector3());
    const aimDir = m.intent.aim.clone().sub(eye).normalize();
    let best = null, bestScore = Infinity;
    for (const t of this.targets) {
      if (!t.alive || t.team === m.team || t.team === 2 || t.intangible || t.cloaked) continue;
      const c = t.center(new THREE.Vector3());
      const d = c.distanceTo(eye);
      if (d > 180) continue;
      const ang = Math.acos(clamp(c.clone().sub(eye).normalize().dot(aimDir), -1, 1));
      if (ang > 0.6 || !this.arena.lineOfSight(eye, c)) continue;
      const score = ang * 60 + d * 0.1;
      if (score < bestScore) { bestScore = score; best = t; }
    }
    return best;
  }
  hitStop(t) { this.hitStopT = Math.max(this.hitStopT || 0, t); }
  meleeHit() { this.matchStats.meleeHits++; }
  spawnDrone(owner, life) { this.drones.push(new Drone(this, owner, life)); }
  spawnDome(owner, dur) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(12, 20, 12), new THREE.MeshBasicMaterial({ color: owner.model.P.glowColor, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.scene.add(m);
    this.domes.push({ owner, t: dur, mesh: m });
  }
  spawnPickup(pos) {
    if (this.pickups.length >= 3) return;
    const p = pos || this.arena.randomPointNear(rand(-50, 50), rand(-50, 50), 30);
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshStandardMaterial({ color: 0x2a6f4a, metalness: 0.5, roughness: 0.4, flatShading: true }));
    const cross = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.5), new THREE.MeshBasicMaterial({ color: 0x66ff99 }));
    const cross2 = cross.clone(); cross2.rotation.y = Math.PI / 2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.1, 4, 20), new THREE.MeshBasicMaterial({ color: 0x66ff99 }));
    ring.rotation.x = Math.PI / 2;
    g.add(box, cross, cross2, ring);
    g.position.set(p.x, 1.6, p.z);
    this.scene.add(g);
    this.pickups.push({ pos: new THREE.Vector3(p.x, 0, p.z), mesh: g, t: 0 });
  }
  farSpawn() {
    const p = this.player.pos;
    const sp = this.arena.enemySpawns.slice().sort((a, b) => b.distanceTo(p) - a.distanceTo(p));
    return pick(sp.slice(0, Math.max(2, Math.ceil(sp.length / 2)))).clone().add(new THREE.Vector3(rand(-4, 4), 0, rand(-4, 4)));
  }
  respawnPlayer() {
    const p = this.player;
    const old = p;
    const lo = old.loadout;
    this.scene.remove(old.model.root); old.removed = true;
    this.removeTarget(old); this.mechs.splice(this.mechs.indexOf(old), 1);
    const np = new Mech(this, { loadout: lo, team: 0, isPlayer: true, name: old.name, upgrades: profile.upgrades, mods: this.challengeMods });
    np.controller = new PlayerController(this, np);
    np.kills = old.kills; np.deaths = old.deaths; np.dmgDealt = old.dmgDealt;
    np.pos.copy(pick(this.arena.playerSpawns));
    np.yaw = np.legYaw = this.camYaw;
    this.player = np; this.addMech(np);
    old.model.dispose();
    this.hud.rebuildLoadout();
    this.effects.flash(np.center(_v).clone(), 5, 0x5ce8ff, 0.5);
  }
  makePointMarker(p, r) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.4, r, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15;
    const fill = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, depthWrite: false }));
    fill.rotation.x = -Math.PI / 2; fill.position.y = 0.1;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 40, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    beam.position.y = 20;
    g.add(ring, fill, beam);
    g.position.set(p.x, 0, p.z);
    g.userData = { ring, fill, beam };
    this.scene.add(g);
    return g;
  }
  updatePointMarker(p) {
    const c = p.owner === 0 ? 0x3aa8ff : p.owner === 1 ? 0xff6a2a : (p.prog > 0 ? 0x88ccff : p.prog < 0 ? 0xffaa88 : 0xffffff);
    const u = p.mesh.userData;
    u.ring.material.color.set(c); u.fill.material.color.set(c); u.beam.material.color.set(c);
    u.fill.material.opacity = 0.06 + Math.abs(p.prog) * 0.12;
    u.beam.material.opacity = p.contested ? 0.25 + Math.sin(this.time * 12) * 0.2 : 0.25;
  }

  // ---------------- timers / announcements / sound ----------------
  schedule(delay, fn) { this.timers.push({ t: delay, fn }); }
  announce(title, sub, dur = 2.5) { this.hud.banner(title, sub, dur); }
  announceSmall(text) { this.hud.toast(text); }
  sound(name, pos, vol = 1, pitch = 1) {
    if (pos) {
      const d = pos.distanceTo(this.camPos);
      vol *= clamp(1.15 - d / 160, 0, 1);
    }
    sfx(name, vol, pitch);
  }
  contract(stat, n) {
    const done = contractProgress(stat, n);
    for (const c of done) this.hud.toast(`CONTRACT COMPLETE: ${c.text} (+${c.reward} CR)`, '#7dffb0');
  }
  onAbility(m) { if (m.isPlayer) { this.matchStats.abilities++; this.contract('abilities', 1); } }
  stats_shot(o) { if (o.isPlayer) this.matchStats.shots++; }

  // ---------------- damage ----------------
  applyDamage(target, amount, type, source, point, opts = {}) {
    if (!target.alive || this.ended) return 0;
    if (target.invuln) return 0;
    if (source && source.team === target.team && source !== target && !opts.prop) return 0;
    let dmg = amount;
    if (source && !source.isPlayer && source.team === 1 && target.team === 0) dmg *= this.diffDef.dmg * (this.condition.enemyDmg || 1);
    if (target.damageFilter) { dmg *= target.damageFilter(dmg, type, source, point, opts); if (dmg <= 0) { if (source && source.isPlayer && !opts.silent) { this.hud.hitmarker(false, false, true); } return 0; } }
    if (target.dmgTakenMul) dmg *= target.dmgTakenMul();
    // aegis dome allies
    if (target.isMech && target.team !== undefined) {
      for (const d of this.domes) if (d.owner.alive && d.owner.team === target.team && d.owner.pos.distanceTo(target.pos) < 12 && d.owner !== target) { dmg *= 0.3; break; }
    }
    const res = (target.resist || (target.stats && target.stats.resist) || {})[type] || 0;
    dmg *= 1 - res;
    let toShield = 0, toArmor = 0;
    // overshield
    if (target.overshield > 0) {
      const a = Math.min(target.overshield, dmg); target.overshield -= a; dmg -= a; toShield += a;
      if (target.model) target.model.hitShield(true);
    }
    if (dmg > 0 && target.shield > 0) {
      const mult = SHIELD_MULT[type] || 1;
      const eff = dmg * mult;
      const a = Math.min(target.shield, eff);
      target.shield -= a; toShield += a;
      dmg -= a / mult;
      if (target.model) target.model.hitShield(false);
      if (target.shield <= 0 && target.isMech) { this.sound('shieldbreak', target.pos, target.isPlayer ? 1 : 0.6); }
    }
    if (dmg > 0) {
      const mult = ARMOR_MULT[type] || 1;
      toArmor = dmg * mult;
      target.hp -= toArmor;
      if (target.model) target.model.flash(clamp(toArmor / 80, 0.3, 1.2));
    }
    const total = toShield + toArmor;
    if (source && opts.weapon) target.lastWeapon = opts.weapon;
    if (target.isMech) { target.shieldDelayT = target.stats.shieldDelay; target.recentDamage += total; target.lastHitBy = source; target.lastHitTime = this.time; }
    else target.lastHitBy = source;
    // stats & feedback
    if (source && source.isMech) {
      source.dmgDealt += total;
      if (source.controller && source.controller.tacticDealt !== undefined) source.controller.tacticDealt += total;
    }
    if (source && source.isPlayer && !opts.silent) {
      const ms = this.matchStats;
      ms.damage += total; ms.hits++;
      if (opts.weapon) ms.weaponDamage[opts.weapon] = (ms.weaponDamage[opts.weapon] || 0) + total;
      ms.dmgByType[type] = (ms.dmgByType[type] || 0) + total;
      if (opts.crit) ms.crits++;
      if (!opts.splash || Math.random() < 0.5) this.sound(opts.crit ? 'crit' : toArmor > toShield ? 'armorhit' : 'shieldhit', null, 0.5);
      this.hud.hitmarker(opts.crit, target.hp <= 0);
      if (point) this.effects.number(point, total, opts.crit ? '#ffe066' : toShield > toArmor ? '#7fe8ff' : '#ffffff', opts.crit || opts.weak);
    }
    if (target.isPlayer && !opts.silent) {
      this.matchStats.damageTaken += total;
      const from = source ? source.pos : point;
      if (from) this.hud.damageFrom(from, total);
      this.effects.addShake(clamp(total / 150, 0.05, 0.6) * (opts.splash ? 1.3 : 1));
      if (toArmor > 0) this.sound('armorhit', null, 0.6);
    } else if (target.isPlayer && type === 'hazard') {
      this.hud.flashHazard();
    }
    if (target.hp <= 0) {
      target.hp = 0;
      if (target.isMech) this.kill(target, source);
      else target.die();
    }
    return total;
  }

  kill(victim, killer) {
    if (!victim.alive) return;
    victim.die();
    victim.deaths++;
    if (killer && killer.isMech && killer !== victim) { killer.kills++; killer.score += victim.isBoss ? 1000 : 100; }
    this.hud.killfeed(killer, victim);
    if (killer && killer.isPlayer && victim.team !== killer.team && !victim.decoy) {
      this.matchStats.kills++;
      const tid = victim.enemyType || 'assault';
      this.matchStats.killsByType[tid] = (this.matchStats.killsByType[tid] || 0) + 1;
      if (WEAPONS[victim.lastWeapon] && WEAPONS[victim.lastWeapon].kind === 'melee') this.matchStats.meleeKills++;
      this.sound('kill', null, 0.8);
      if (!victim.isBoss) {
        this.contract('kills', 1);
        if (['scout', 'flanker'].includes(tid)) this.contract('killLight', 1);
        if (['tank', 'heavy'].includes(tid)) this.contract('killHeavy', 1);
      }
    }
    // assists: allies credit
    if (this.mode.onKill) this.mode.onKill(victim, killer);
    if (victim.isPlayer) {
      this.matchStats.deaths++;
      this.mode.onPlayerDeath();
      this.deathCam = { t: 0 };
    }
    if (victim.isBoss) {
      this.effects.addShake(1.5);
      for (let i = 0; i < 6; i++) this.schedule(i * 0.35, () => this.effects.explosion(victim.center(new THREE.Vector3()).add(new THREE.Vector3(rand(-6, 6), rand(-3, 5), rand(-6, 6))), 6, 0xffaa44, 0.6));
      this.sound('bigexplosion', victim.pos, 1);
      // remaining minions self-destruct
      this.schedule(1.0, () => { for (const m of this.mechs) if (m.alive && m.team === victim.team) this.kill(m, null); });
    }
  }

  /** Area damage with falloff and cover check. */
  explode(pos, radius, dmg, type, source, opts = {}) {
    this.effects.explosion(pos, radius * 0.55, opts.color || 0xff8a3d, source && source.isPlayer ? 0.15 : 0.35);
    this.sound('explosion', pos, clamp(radius / 8, 0.4, 1));
    for (const t of this.targets.slice()) {
      if (!t.alive) continue;
      if (source && t.team === source.team && !opts.prop && t !== source) continue;
      if (source && t === source && !opts.prop) continue;
      const c = t.center ? t.center(_u) : t.pos;
      let d = c.distanceTo(pos) - t.radius;
      if (t === opts.direct) d = 0;
      if (d > radius) continue;
      if (t !== opts.direct && !this.arena.lineOfSight(pos.clone().setY(pos.y + 0.5), c)) continue;
      const k = 1 - 0.7 * clamp(d / radius, 0, 1);
      this.applyDamage(t, dmg * k, type, source, c.clone(), { splash: true, weapon: opts.weapon, weak: t === opts.direct && opts.weak, prop: opts.prop });
      if (t.applyKnock && k > 0.5 && radius >= 6) { _w.subVectors(t.pos, pos).setY(0).normalize().multiplyScalar(6 * k).setY(3 * k); t.applyKnock(_w); }
    }
  }

  /** Expanding ground shockwave; jump to avoid. */
  shockwave(pos, o) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1.8, 48, 1, true), new THREE.MeshBasicMaterial({ color: o.color || 0xff7a20, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    mesh.position.set(pos.x, pos.y + 0.9, pos.z);
    this.scene.add(mesh);
    this.waves.push({ pos: pos.clone(), r: 1, speed: o.speed, maxR: o.maxR, dmg: o.dmg, source: o.source, hit: new Set(), mesh });
  }
  /** Telegraphed area strike. */
  strike(x, z, radius, delay, dmg, source, color) {
    this.effects.telegraph(x, z, radius, color, delay);
    this.schedule(delay, () => {
      if (this.ended) return;
      const p = new THREE.Vector3(x, 1, z);
      this.effects.tracer(new THREE.Vector3(x, 80, z), p, color, 1.2, 0.25);
      this.explode(p, radius, dmg, 'explosive', source, { color });
    });
  }

  // ---------------- intro ----------------
  startIntro(boss, def) {
    this.intro = { t: 0, dur: 4.2, boss, def };
    this.hud.bossIntro(def);
    this.sound('alarm', null, 0.8);
  }

  // ---------------- update ----------------
  update(dt) {
    if (this.paused) return;
    dt = Math.min(dt, 1 / 20);
    if (this.hitStopT > 0) { this.hitStopT -= dt; dt *= 0.15; }
    this.frame++;
    this.time += dt;
    // timers
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const t = this.timers[i]; t.t -= dt;
      if (t.t <= 0) { this.timers.splice(i, 1); t.fn(); }
    }
    const intro = this.intro && this.intro.t < this.intro.dur;
    if (intro) {
      this.intro.t += dt;
      if (this.intro.t >= this.intro.dur || Input.hit('jump')) { this.intro.t = this.intro.dur; this.hud.bossIntroEnd(); }
    }
    this.inputEnabled = !intro && !this.ended;
    if (!this.ended) this.mode.update(dt);
    for (const s of this.squads) s.update(dt);
    for (const m of this.mechs) {
      if (intro && !m.isPlayer) { m.intent.move.set(0, 0); m.intent.fire[0] = m.intent.fire[1] = false; m.model.root.position.copy(m.pos); m.model.update(dt, { fwdSpeed: 0, sideSpeed: 0, maxSpeed: 1, onGround: true, vy: 0, aimPitch: 0, torsoYaw: 0, jet: 0 }); continue; }
      m.update(dt);
    }
    // mech separation
    for (let i = 0; i < this.mechs.length; i++) {
      const a = this.mechs[i]; if (!a.alive) continue;
      for (let j = i + 1; j < this.mechs.length; j++) {
        const b = this.mechs[j]; if (!b.alive) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, min = a.radius + b.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min && d2 > 1e-4 && Math.abs(a.pos.y - b.pos.y) < Math.max(a.height, b.height)) {
          const d = Math.sqrt(d2), push = (min - d) / 2;
          const wa = a.isBoss ? 0 : b.isBoss ? 2 : 1, wb = b.isBoss ? 0 : a.isBoss ? 2 : 1;
          a.pos.x -= dx / d * push * wa; a.pos.z -= dz / d * push * wa;
          b.pos.x += dx / d * push * wb; b.pos.z += dz / d * push * wb;
        }
      }
    }
    // structures
    for (const s of this.structures) if (s.alive && s.update) s.update(dt);
    // drones
    for (let i = this.drones.length - 1; i >= 0; i--) if (!this.drones[i].update(dt)) { this.drones[i].dispose(); this.drones.splice(i, 1); }
    // domes
    for (let i = this.domes.length - 1; i >= 0; i--) {
      const d = this.domes[i]; d.t -= dt;
      d.mesh.position.copy(d.owner.pos).setY(d.owner.pos.y + 3);
      d.mesh.material.opacity = 0.1 + Math.sin(this.time * 6) * 0.03;
      if (d.t <= 0 || !d.owner.alive) { this.scene.remove(d.mesh); d.mesh.geometry.dispose(); d.mesh.material.dispose(); this.domes.splice(i, 1); }
    }
    // shockwaves
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      w.r += w.speed * dt;
      w.mesh.scale.set(w.r, 1, w.r);
      w.mesh.material.opacity = 0.65 * (1 - w.r / w.maxR);
      for (const t of this.targets) {
        if (!t.alive || !t.isMech || (w.source && t.team === w.source.team) || w.hit.has(t)) continue;
        const d = Math.hypot(t.pos.x - w.pos.x, t.pos.z - w.pos.z);
        if (d > w.r - 2 - t.radius * 0.5 && d < w.r + 1 + t.radius * 0.5 && t.pos.y < w.pos.y + 1.7) {
          w.hit.add(t);
          this.applyDamage(t, w.dmg, 'impact', w.source, t.center(_u).clone(), { weapon: 'shockwave' });
          if (t.applyKnock) t.applyKnock(_w.set(t.pos.x - w.pos.x, 0, t.pos.z - w.pos.z).normalize().multiplyScalar(14).setY(7));
        }
      }
      if (w.r >= w.maxR) { this.scene.remove(w.mesh); w.mesh.geometry.dispose(); w.mesh.material.dispose(); this.waves.splice(i, 1); }
    }
    // aegis dome buff for allies inside (visual buff only for HUD)
    this.projectiles.update(dt);
    // pickups
    this.pickupT -= dt;
    if (this.pickupT <= 0) { this.pickupT = this.condition.supply ? 14 : 32; this.spawnPickup(); }
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i]; p.t += dt;
      p.mesh.rotation.y += dt * 1.5; p.mesh.position.y = 1.6 + Math.sin(p.t * 2) * 0.3;
      for (const m of this.mechs) {
        if (!m.alive || m.pos.distanceTo(p.pos) > m.radius + 2.5 || m.hp >= m.stats.maxHp * 0.98) continue;
        m.hp = Math.min(m.stats.maxHp, m.hp + m.stats.maxHp * 0.3);
        for (const w of m.weapons) if (w.usesAmmo) { w.ammo = w.def.mag; w.reloadT = 0; }
        this.effects.ring(p.pos, 5, 0x66ff99, 0.5);
        if (m.isPlayer) { this.sound('heal', null, 1); this.hud.toast('REPAIR CACHE: +30% ARMOR', '#66ff99'); }
        this.scene.remove(p.mesh); p.mesh.traverse((x) => { if (x.geometry) x.geometry.dispose(); if (x.material) x.material.dispose(); });
        this.pickups.splice(i, 1);
        break;
      }
    }
    // cleanup dead mechs after wreck time
    for (let i = this.mechs.length - 1; i >= 0; i--) {
      const m = this.mechs[i];
      if (!m.alive && !m.isPlayer && m.deadT > 6) { m.removed = true; m.dispose(); this.mechs.splice(i, 1); this.removeTarget(m); }
    }
    for (let i = this.structures.length - 1; i >= 0; i--) {
      const s = this.structures[i];
      if (!s.alive) { s.dispose(); this.structures.splice(i, 1); this.removeTarget(s); }
    }
    if (this.player.alive) this.minHpFrac = Math.min(this.minHpFrac, this.player.hp / this.player.stats.maxHp);
    this.effects.update(dt);
    this.arena.update(dt, this.player.pos);
    this.updateCamera(dt);
    this.hud.update(dt);
    // end of match
    if (this.mode.result && !this.ended) {
      this.ended = true;
      this.endT = 0;
      const r = this.mode.result;
      this.hud.banner(r.win ? 'VICTORY' : 'DEFEAT', r.reason, 3);
      this.sound(r.win ? 'levelup' : 'alarm', null, 0.8);
    }
    if (this.ended) {
      this.endT += dt;
      if (this.endT > 3.2 && !this.finished) this.finish();
    }
  }

  // ---------------- camera ----------------
  updateCamera(dt) {
    const cam = this.camera, p = this.player, st = profile.settings;
    let target = p;
    if (this.intro && this.intro.t < this.intro.dur) {
      const b = this.intro.boss, k = this.intro.t / this.intro.dur;
      const a = b.yaw + 0.6 - k * 1.2;
      const r = b.height * 1.6 + 10;
      _v.set(b.pos.x + Math.sin(a) * r, b.pos.y + b.height * (0.4 + k * 0.3), b.pos.z + Math.cos(a) * r);
      cam.position.copy(_v);
      cam.lookAt(b.pos.x, b.pos.y + b.height * 0.6, b.pos.z);
      this.camPos.copy(cam.position);
      cam.fov = st.fov; cam.updateProjectionMatrix();
      return;
    }
    if (!p.alive && this.spectate) {
      const ally = this.mechs.find((m) => m.alive && m.team === 0);
      if (ally) target = ally;
    }
    const zoomTarget = (Input.held('zoom') && p.alive && this.inputEnabled) ? 1 : 0;
    this.zoom = damp(this.zoom, zoomTarget, 12, dt);
    const fov = st.fov * (1 - this.zoom * 0.45);
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
    const h = target.height;
    const pivot = _v.set(target.pos.x, target.pos.y + h * 0.9 + 1.6, target.pos.z);
    let dist = (9 + h * 0.95) * (1 - this.zoom * 0.4);
    if (!p.alive && !this.spectate) { this.camYaw += dt * 0.3; dist *= 1.4; }
    const cy = Math.cos(this.camPitch), sy = Math.sin(this.camPitch);
    const fwd = _w.set(Math.sin(this.camYaw) * cy, sy, Math.cos(this.camYaw) * cy);
    const right = _u.set(-Math.cos(this.camYaw), 0, Math.sin(this.camYaw));
    const shoulder = 2.4 + h * 0.2;
    const base = pivot.clone().addScaledVector(right, shoulder);
    const desired = base.clone().addScaledVector(fwd, -dist);
    desired.y = Math.max(desired.y, 1.0);
    const t = this.arena.raycast(base, desired, true);
    if (t >= 0) desired.lerpVectors(base, desired, Math.max(0.15, t - 0.08));
    cam.position.copy(desired);
    // shake
    const sh = this.effects.shake * st.cameraShake;
    if (sh > 0.001) cam.position.add(new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(sh * 0.6));
    const look = base.clone().addScaledVector(fwd, 60);
    cam.lookAt(look);
    this.camPos.copy(cam.position);
    // shadow light follows
    this.sun.position.copy(p.pos).addScaledVector(this.sunDir, 150);
    this.sun.target.position.copy(p.pos);
    if (this.playerLight) {
      this.playerLight.position.copy(cam.position).add(new THREE.Vector3(0, 6, 0));
      this.playerLight.target.position.copy(look);
    }
  }

  // ---------------- end / rewards ----------------
  finish() {
    this.finished = true;
    const r = this.mode.result || { win: false, reason: 'Match ended' };
    const base = this.mode.baseRewards();
    const diff = this.diffDef;
    let credits = base.credits * diff.reward;
    let xp = base.xp * diff.reward;
    let rp = base.rp + (r.win ? diff.rp : 0);
    if (this.condition.bounty) credits *= this.condition.bounty;
    const daily = this.cfg.daily && r.win && !profile.daily.op.done;
    if (daily) { credits *= 2; xp *= 1.5; rp += 15; profile.daily.op.done = true; }
    credits = Math.round(credits); xp = Math.round(xp);
    // profile updates
    const s = profile.stats;
    s.matches++; if (r.win) s.wins++; else s.losses++;
    s.kills += this.matchStats.kills; s.deaths += this.matchStats.deaths;
    s.damage += Math.round(this.matchStats.damage); s.damageTaken += Math.round(this.matchStats.damageTaken);
    s.crits += this.matchStats.crits; s.meleeKills = (s.meleeKills || 0) + this.matchStats.meleeKills; s.shotsFired += this.matchStats.shots; s.shotsHit += this.matchStats.hits;
    s.playTime += this.time;
    s.mechUse[this.player.frame.id] = (s.mechUse[this.player.frame.id] || 0) + 1;
    for (const [w, d] of Object.entries(this.matchStats.weaponDamage)) s.weaponDamage[w] = Math.round((s.weaponDamage[w] || 0) + d);
    s.modePlays[this.cfg.mode] = (s.modePlays[this.cfg.mode] || 0) + 1;
    if (this.cfg.mode === 'domination' && r.win) s.modePlays.dominationWins = (s.modePlays.dominationWins || 0) + 1;
    if (this.cfg.mode === 'survival') s.bestWave = Math.max(s.bestWave, this.mode.cleared);
    let firstBoss = false;
    if (this.cfg.mode === 'boss' && r.win) { firstBoss = !profile.bosses[this.cfg.boss]; profile.bosses[this.cfg.boss] = (profile.bosses[this.cfg.boss] || 0) + 1; s.bossKills++; }
    if (this.cfg.mode === 'challenge' && r.win) profile.challenges[this.cfg.challenge] = Math.min(profile.challenges[this.cfg.challenge] || 1e9, Math.round(this.time));
    if (r.win && ARENAS[this.cfg.arena]) profile.arenaWins[this.cfg.arena] = (profile.arenaWins[this.cfg.arena] || 0) + 1;
    if (r.win) this.contract('wins', 1);
    for (const [t, d] of Object.entries(this.matchStats.dmgByType)) this.contract('dmg_' + t, Math.round(d));
    if (this.matchStats.crits) this.contract('crits', this.matchStats.crits);
    if (this.matchStats.meleeHits) this.contract('meleeHits', this.matchStats.meleeHits);
    profile.credits += credits; profile.rp += rp;
    const levelBefore = profile.level;
    const ups = addXp(xp);
    const unlocks = [];
    for (const l of ups) unlocks.push(...levelUnlocks(l));
    const ach = checkAchievements({ untouchable: r.win && this.minHpFrac > 0.85, expertWin: r.win && this.difficulty === 'expert', dailyDone: daily, dominationWin: this.cfg.mode === 'domination' && r.win });
    save();
    this.app.showResults({
      win: r.win, reason: r.reason, mode: this.cfg.mode, cfg: this.cfg, time: this.time,
      stats: this.matchStats, credits, xp, rp, levelBefore, levelAfter: profile.level, unlocks, achievements: ach, daily, firstBoss,
      wave: this.mode.cleared,
    });
  }

  quit() { this.ended = true; this.finished = true; }

  dispose() {
    for (const m of this.mechs) m.dispose();
    for (const s of this.structures) s.dispose();
    for (const d of this.drones) d.dispose();
    for (const p of this.pickups) this.scene.remove(p.mesh);
    for (const m of this.mechs) if (m.bossCtrl && m.bossCtrl.dispose) m.bossCtrl.dispose();
    if (this.mode.dispose) this.mode.dispose();
    this.projectiles.dispose();
    this.effects.dispose();
    this.arena.dispose();
    this.hud.dispose();
    this.scene.traverse((o) => { if (o.isLight && o.shadow && o.shadow.map) o.shadow.map.dispose(); });
  }
}

// ---------------------------------------------------------------------------
// Player controller
// ---------------------------------------------------------------------------
class PlayerController {
  constructor(game, mech) { this.game = game; this.mech = mech; this.lockT = 0; }
  update(dt) {
    const g = this.game, m = this.mech, I = m.intent, st = profile.settings;
    if (!g.inputEnabled) {
      I.move.set(0, 0); I.fire[0] = I.fire[1] = false; I.sprint = false; I.jet = false;
      this.updateAim(); return;
    }
    const mouse = Input.consumeMouse();
    const sens = 0.0022 * st.sensitivity * (1 - g.zoom * 0.5);
    g.camYaw -= mouse.dx * sens;
    g.camPitch = clamp(g.camPitch - mouse.dy * sens * (st.invertY ? -1 : 1), -1.05, 0.95);
    // movement relative to camera
    const f = (Input.held('forward') ? 1 : 0) - (Input.held('back') ? 1 : 0);
    const r = (Input.held('right') ? 1 : 0) - (Input.held('left') ? 1 : 0);
    const sy = Math.sin(g.camYaw), cy = Math.cos(g.camYaw);
    I.move.set(sy * f - cy * r, cy * f + sy * r);
    if (I.move.length() > 1) I.move.normalize();
    I.sprint = Input.held('sprint');
    if (Input.hit('jump')) I.jump = true;
    I.jet = Input.held('jump');
    if (Input.hit('dash')) I.dash = true;
    if (Input.hit('reload')) I.reload = true;
    if (Input.hit('ability')) I.ability = true;
    for (let i = 0; i < 4; i++) {
      if (Input.hit('slot' + (i + 1)) && i < m.equip.length) {
        if (m.selEquip === i) I.equip = i; // press again to fire
        m.selEquip = i;
        g.sound('ui', null, 0.5);
      }
    }
    if (Input.hit('equipUse') && m.equip.length) I.equip = m.selEquip;
    if (Input.hit('lock')) this.toggleLock();
    I.fire[0] = Input.held('fire1');
    I.fire[1] = Input.held('fire2');
    if (I.lock && (!I.lock.alive || I.lock.removed)) { I.lock = null; }
    if (I.lock) {
      // drop lock if out of range / LOS lost for a while
      const c = I.lock.center(_u);
      const vis = g.arena.lineOfSight(m.eye(_v), c);
      this.lockT = vis ? 0 : this.lockT + dt;
      if (this.lockT > 2.5 || c.distanceTo(m.pos) > this.lockRange() * 1.2) { I.lock = null; g.hud.toast('LOCK LOST'); }
    }
    this.updateAim();
  }
  lockRange() { return 220 * (this.mech.buffs.uplink ? 1.6 : 1); }
  toggleLock() {
    const g = this.game, m = this.mech, I = m.intent;
    if (I.lock) { I.lock = null; g.sound('ui', null, 0.6); return; }
    const cam = g.camera;
    const fwd = _w; cam.getWorldDirection(fwd);
    let best = null, bestA = (m.buffs.uplink ? 0.42 : 0.22);
    for (const t of g.targets) {
      if (!t.alive || t.team === m.team || t.team === 2 || t.intangible) continue;
      const c = t.center(new THREE.Vector3());
      const d = c.distanceTo(cam.position);
      if (d > this.lockRange()) continue;
      const dir = c.clone().sub(cam.position).normalize();
      const ang = Math.acos(clamp(dir.dot(fwd), -1, 1));
      if (ang < bestA && g.arena.lineOfSight(m.eye(_v), c)) { bestA = ang; best = t; }
    }
    if (best) { I.lock = best; g.sound('lock', null, 0.8); if (best.decoy) g.hud.toast('HOLOGRAPHIC DECOY DETECTED', '#ff1f4b'); }
    else g.sound('uideny', null, 0.5);
  }
  updateAim() {
    const g = this.game, m = this.mech, I = m.intent, st = profile.settings;
    const cam = g.camera;
    const origin = cam.position;
    const dir = _w; cam.getWorldDirection(dir);
    const far = 420;
    const end = origin.clone().addScaledVector(dir, far);
    let t = g.arena.raycast(origin, end, true);
    if (t < 0) t = 1;
    let hitTarget = null;
    for (const tg of g.targets) {
      if (!tg.alive || tg === m || tg.team === m.team) continue;
      const r = hitTest(tg, origin, end);
      if (r && r.t < t) { t = r.t; hitTarget = tg; }
    }
    // never aim at a point behind/inside our own mech
    const minT = (m.pos.distanceTo(origin) + m.radius * 2) / far;
    if (t < minT) t = Math.max(t, minT + 0.02);
    I.aim.copy(origin).addScaledVector(dir, far * t);
    g.aimTarget = hitTarget;
    // aim assist toward locked target
    const lock = I.lock;
    if (lock && lock.alive && (st.aimAssist || m.buffs.uplink)) {
      const c = lock.center(_v);
      const to = c.clone().sub(origin).normalize();
      const ang = Math.acos(clamp(to.dot(dir), -1, 1));
      const lim = m.buffs.uplink ? 0.16 : 0.06;
      if (ang < lim) I.aim.copy(c);
    }
  }
}
