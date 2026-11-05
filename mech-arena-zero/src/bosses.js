// Boss controllers: scripted multi-phase encounters driving oversized mechs.
import * as THREE from 'three';
import { BOSSES } from './data.js';
import { addBossExtras } from './mechModel.js';
import { Structure } from './mech.js';
import { rand, pick, clamp, wrapAngle, segSphere } from './util.js';

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _u = new THREE.Vector3();

export const BOSS_SETUP = {
  irongiant: { frame: 'titan', weapons: ['gauss', 'plasma'], scale: 2.3, palette: 'irongiant', speedMul: 0.65, turnRate: 0.9, out: 0.75 },
  phantomzero: { frame: 'phantom', weapons: ['arc', 'scatter'], scale: 1.5, palette: 'phantomzero', speedMul: 1.35, turnRate: 12, out: 0.7 },
  overlord: { frame: 'juggernaut', weapons: ['gauss', 'mortar'], scale: 2.0, palette: 'overlord', speedMul: 0.7, turnRate: 2, out: 0.7 },
  omega: { frame: 'apex', weapons: ['ion', 'tempest'], scale: 2.3, palette: 'omega', speedMul: 0.9, turnRate: 4, out: 0.75, extras: 'omega' },
};

const SHELL = { id: 'shell', dmgType: 'explosive', kind: 'proj', dmg: 85, splash: 7, gravity: 6, speed: 60, range: 160, size: 1.3, color: 0xff8c1a };
const PRECISION = { id: 'pzshot', dmgType: 'precision', kind: 'proj', dmg: 110, speed: 260, range: 220, size: 0.6, color: 0xff1f4b };

class BossBase {
  constructor(game, mech, id) {
    this.game = game; this.mech = mech; this.id = id; this.def = BOSSES[id];
    this.phase = 1; this.t = 0; this.atkT = 3; this.state = 'idle'; this.stateT = 0;
    mech.isBoss = true; mech.knockRes = 1;
    mech.damageFilter = (amt, type, src, pt, opts) => this.filter(amt, type, src, pt, opts);
    this.moveGoal = mech.pos.clone();
  }
  get player() { return this.game.player; }
  filter() { return 1; }
  hpFrac() { return this.mech.hp / this.mech.stats.maxHp; }
  setPhase(p, title, sub) {
    if (p <= this.phase) return;
    this.phase = p;
    this.game.announce(title, sub, 2.5);
    this.game.sound('alarm', this.mech.pos, 1);
    this.game.effects.ring(this.mech.pos, 25, 0xff3333, 0.8);
  }
  aimAt(target, lead = 0.5) {
    const I = this.mech.intent;
    if (!target) return;
    target.center(I.aim);
    if (target.vel) I.aim.addScaledVector(target.vel, lead);
    I.lock = target;
  }
  moveTo(p, stopDist = 4) {
    const m = this.mech, I = m.intent;
    const dx = p.x - m.pos.x, dz = p.z - m.pos.z, d = Math.hypot(dx, dz);
    if (d < stopDist) { I.move.set(0, 0); return true; }
    let mx = dx / d, mz = dz / d;
    const nav = this.game.arena.nav;
    if (!nav.walkable(m.pos.x + mx * 6, m.pos.z + mz * 6)) {
      for (const a of [0.7, -0.7, 1.4, -1.4]) {
        const c = Math.cos(a), s = Math.sin(a), rx = mx * c - mz * s, rz = mx * s + mz * c;
        if (nav.walkable(m.pos.x + rx * 6, m.pos.z + rz * 6)) { mx = rx; mz = rz; break; }
      }
    }
    I.move.set(mx, mz);
    return false;
  }
  fireWeapons(on0, on1) { const I = this.mech.intent; I.fire[0] = on0; I.fire[1] = on1; }
  update(dt) {
    this.t += dt; this.stateT += dt; this.atkT -= dt;
    const I = this.mech.intent;
    I.fire[0] = I.fire[1] = false; I.jump = false; I.dash = false;
  }
}

// ---------------------------------------------------------------------------
// IRON GIANT — frontal Bastion shield, back reactor weak point, shockwaves, mortars
// ---------------------------------------------------------------------------
class IronGiant extends BossBase {
  constructor(game, mech) {
    super(game, mech, 'irongiant');
    addBossExtras(mech.model, 'irongiant');
    this.weak = { c: new THREE.Vector3(), r: 1.9, weak: true };
    mech._spheres.push(this.weak);
    this.venting = 0; this.attacks = 0;
  }
  filter(amt, type, src, pt, opts) {
    if (opts && opts.weak) { this.game.hud && this.game.hud.toast('REACTOR HIT', '#ffdd55'); return 2.5; }
    if (!pt || this.venting > 0) return this.venting > 0 ? 1.3 : 1;
    const m = this.mech;
    _v.set(pt.x - m.pos.x, 0, pt.z - m.pos.z).normalize();
    const fwd = _w.set(Math.sin(m.yaw), 0, Math.cos(m.yaw));
    if (_v.dot(fwd) > 0.15) {
      m.model.hitShield(true);
      if (m.model.bastion) m.model.bastion.material.opacity = 0.8;
      return opts && opts.splash ? 0.25 : 0.1;
    }
    return 1;
  }
  update(dt) {
    super.update(dt);
    const m = this.mech, P = this.player, g = this.game;
    if (!m.alive) return;
    m.model.weakPoint.getWorldPosition(this.weak.c);
    const hf = this.hpFrac();
    if (hf < 0.5) this.setPhase(2, 'IRON GIANT — PHASE 2', 'Artillery barrage online. Shockwaves intensify.');
    if (hf < 0.2) this.setPhase(3, 'IRON GIANT — ENRAGED', 'Its reactor is overheating!');
    if (this.venting > 0) {
      this.venting -= dt;
      if (Math.random() < 0.5) g.effects.smokePuff(this.weak.c, 3, 1.4, 0.4, 5);
    }
    const plate = m.model.bastion;
    if (plate) { plate.visible = this.venting <= 0; plate.material.opacity = Math.max(0.3, plate.material.opacity - dt * 2); }
    m.turnRate = this.phase === 3 ? 1.6 : this.venting > 0 ? 0.3 : 0.9;
    if (!P || !P.alive) { m.intent.move.set(0, 0); return; }
    this.aimAt(P, 0.3);
    const d = m.pos.distanceTo(P.pos);
    // movement: approach slowly to mid range
    if (this.state === 'idle') {
      if (d > 34) this.moveTo(P.pos, 30); else if (d < 16) { _v.subVectors(m.pos, P.pos).setY(0).normalize().multiplyScalar(10).add(m.pos); this.moveTo(_v, 2); } else m.intent.move.set(0, 0);
      this.fireWeapons(d < 120 && Math.sin(this.t * 0.9) > -0.2, false);
    } else m.intent.move.set(0, 0);
    // attack scheduler
    const rate = this.phase === 3 ? 0.6 : 1;
    if (this.state === 'idle' && this.atkT <= 0) {
      const opts = ['salvo', 'stomp'];
      if (this.phase >= 2) opts.push('barrage');
      if (d < 22) opts.push('stomp');
      this.state = pick(opts); this.stateT = 0;
      if (this.state === 'stomp') {
        g.effects.telegraph(m.pos.x, m.pos.z, 12, 0xff4020, 1.1);
        g.announceSmall('SHOCKWAVE — JUMP!');
      }
    }
    if (this.state === 'salvo') {
      if (this.stateT > 0.6 && !this._s1) { this._s1 = 1; this.fireShells(3); }
      if (this.stateT > 1.4 && this.phase >= 2 && !this._s2) { this._s2 = 1; this.fireShells(3); }
      if (this.stateT > 1.8) this.endAttack(rate * rand(3, 4.5));
    } else if (this.state === 'stomp') {
      if (this.stateT > 1.1 && !this._s1) {
        this._s1 = 1;
        g.shockwave(m.pos, { speed: 24, maxR: 65, dmg: 110, source: m, color: 0xff7a20 });
        g.effects.explosion(m.pos.clone().setY(1), 6, 0xff9944, 0.9);
        g.sound('slam', m.pos, 1);
      }
      if (this.phase >= 2 && this.stateT > 2.0 && !this._s2) {
        this._s2 = 1; g.shockwave(m.pos, { speed: 30, maxR: 65, dmg: 110, source: m, color: 0xff3a20 }); g.sound('slam', m.pos, 1);
      }
      if (this.stateT > 2.4) this.endAttack(rate * rand(3, 4));
    } else if (this.state === 'barrage') {
      if (this.stateT > 0.3 && !this._s1) {
        this._s1 = 1;
        g.announceSmall('ARTILLERY INCOMING');
        for (let i = 0; i < (this.phase === 3 ? 10 : 7); i++) {
          const x = P.pos.x + rand(-18, 18), z = P.pos.z + rand(-18, 18);
          g.strike(x, z, 7, 1.4 + i * 0.18, 100, m, 0xff8c1a);
        }
      }
      if (this.stateT > 2.5) this.endAttack(rate * rand(4, 5));
    }
  }
  fireShells(n) {
    const m = this.mech, P = this.player, g = this.game;
    for (let i = 0; i < n; i++) {
      const from = m.muzzlePos(i % 2, new THREE.Vector3());
      const to = P.center(new THREE.Vector3()).addScaledVector(P.vel, 0.6).add(new THREE.Vector3(rand(-4, 4), 0, rand(-4, 4)));
      const dir = to.sub(from).normalize(); dir.y += 0.08; dir.normalize();
      g.projectiles.spawn(m, from, dir, SHELL, SHELL.dmg * m.damageMul(), null, null);
    }
    g.sound('mortar', m.pos, 1);
  }
  endAttack(cd) {
    this.state = 'idle'; this.atkT = cd; this._s1 = this._s2 = 0;
    this.attacks++;
    if (this.attacks % 3 === 0) {
      this.venting = this.phase === 3 ? 5 : 4;
      this.game.announceSmall('BASTION SHIELD VENTING — ATTACK!');
      this.game.sound('shieldbreak', this.mech.pos, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// PHANTOM ZERO — cloak, telegraphed lunges, vulnerability windows, decoys
// ---------------------------------------------------------------------------
class PhantomZero extends BossBase {
  constructor(game, mech) {
    super(game, mech, 'phantomzero');
    addBossExtras(mech.model, 'phantomzero');
    this.orbit = 0; this.decoys = []; this.lungeTarget = new THREE.Vector3(); this.chain = 0;
  }
  filter(amt) { return this.state === 'stunned' ? 1.6 : 1; }
  update(dt) {
    super.update(dt);
    const m = this.mech, P = this.player, g = this.game;
    if (!m.alive) { for (const d of this.decoys) if (d.alive) { d.die(); } return; }
    const hf = (m.hp + m.shield) / (m.stats.maxHp + m.stats.maxShield);
    if (hf < 0.55 && this.phase < 2) { this.setPhase(2, 'PHANTOM ZERO — PHASE 2', 'Holographic decoys deployed. Lock on (T) to identify the real one.'); this.spawnDecoys(); }
    if (hf < 0.25) this.setPhase(3, 'PHANTOM ZERO — DESPERATION', 'Chained lunges. Stay mobile!');
    if (this.phase >= 2 && this.decoys.filter((d) => d.alive).length === 0 && this.t % 20 < dt) this.spawnDecoys();
    if (!P || !P.alive) { m.intent.move.set(0, 0); return; }
    const d = m.pos.distanceTo(P.pos);
    this.aimAt(P, 0.4);
    switch (this.state) {
      case 'idle': {
        // circle at mid range, harass
        this.orbit += dt * 0.5;
        _v.set(P.pos.x + Math.cos(this.orbit) * 32, 0, P.pos.z + Math.sin(this.orbit) * 32);
        this.moveTo(_v, 3);
        m.intent.sprint = true;
        this.fireWeapons(d < 90 && Math.sin(this.t * 1.7) > 0.2, d < 30);
        if (this.atkT <= 0) {
          const r = Math.random();
          if (d < 11) { this.state = 'spin'; this.stateT = 0; g.effects.telegraph(m.pos.x, m.pos.z, 11, 0xff1f4b, 0.6); }
          else if (r < 0.45) { this.state = 'cloak'; this.stateT = 0; m.buffs.cloak = 3; g.sound('warp', m.pos, 0.8); }
          else if (r < 0.75) this.startLunge();
          else { this.state = 'aimshot'; this.stateT = 0; }
        }
        break;
      }
      case 'cloak':
        // reposition while invisible, then lunge from stealth
        this.orbit += dt * 1.6;
        _v.set(P.pos.x + Math.cos(this.orbit) * 26, 0, P.pos.z + Math.sin(this.orbit) * 26);
        this.moveTo(_v, 2); m.intent.sprint = true;
        if (this.stateT > 2.4) this.startLunge();
        break;
      case 'windup':
        m.intent.move.set(0, 0);
        if (Math.random() < 0.7) g.effects.tracer(m.center(_u).clone(), this.lungeTarget.clone().setY(this.lungeTarget.y + 3), 0xff1f4b, 0.25, 0.05);
        if (this.stateT > (this.phase === 3 ? 0.55 : 0.8)) {
          this.state = 'lunge'; this.stateT = 0;
          const dir = _v.subVectors(this.lungeTarget, m.pos).setY(0).normalize();
          m.dashT = 0.45; m.dashVel.copy(dir).multiplyScalar(75);
          this.lungeHit = false;
          g.sound('dash', m.pos, 1);
        }
        break;
      case 'lunge':
        if (!this.lungeHit && P.pos.distanceTo(m.pos) < 6 + m.radius) {
          this.lungeHit = true;
          g.applyDamage(P, 150 * m.damageMul(), 'impact', m, P.center(_w), { weapon: 'lunge' });
          P.applyKnock(_w.copy(m.dashVel).normalize().multiplyScalar(18).setY(6));
        }
        if (Math.random() < 0.8) g.effects.trail(m.center(_u), 0xff1f4b, 2, 0.4);
        if (this.stateT > 0.45) {
          if (this.phase === 3 && this.chain < 1) { this.chain++; this.startLunge(); }
          else { this.chain = 0; this.state = 'stunned'; this.stateT = 0; g.announceSmall('PHANTOM ZERO VULNERABLE!'); }
        }
        break;
      case 'stunned':
        m.intent.move.set(0, 0);
        if (Math.random() < 0.3) g.effects.sparks(m.chest, 3, 0xff1f4b, 8);
        if (this.stateT > 1.8) { this.state = 'idle'; this.atkT = rand(2, 3.5) * (this.phase === 3 ? 0.6 : 1); }
        break;
      case 'spin':
        m.intent.move.set(0, 0);
        if (this.stateT > 0.6 && !this._s) {
          this._s = 1;
          g.effects.ring(m.pos, 12, 0xff1f4b, 0.4);
          g.sound('slam', m.pos, 0.6);
          if (P.pos.distanceTo(m.pos) < 12) { g.applyDamage(P, 95 * m.damageMul(), 'impact', m, P.center(_w), { weapon: 'blade' }); P.applyKnock(_w.subVectors(P.pos, m.pos).setY(0).normalize().multiplyScalar(20).setY(5)); }
        }
        if (this.stateT > 1.0) { this._s = 0; this.state = 'idle'; this.atkT = rand(1.5, 2.5); }
        break;
      case 'aimshot':
        m.intent.move.set(0, 0);
        if (Math.random() < 0.8) g.effects.tracer(m.muzzlePos(0, _u).clone(), P.center(_w).clone(), 0xff1f4b, 0.08, 0.04);
        if (this.stateT > 1.0) {
          const from = m.muzzlePos(0, new THREE.Vector3());
          const dir = P.center(new THREE.Vector3()).sub(from).normalize();
          g.projectiles.spawn(m, from, dir, PRECISION, PRECISION.dmg * m.damageMul(), null, null);
          g.sound('rail', from, 1);
          this.state = 'idle'; this.atkT = rand(1.5, 3);
        }
        break;
    }
  }
  startLunge() {
    const P = this.player, m = this.mech;
    this.state = 'windup'; this.stateT = 0;
    m.buffs.cloak = 0; delete m.buffs.cloak;
    this.lungeTarget.copy(P.pos).addScaledVector(P.vel, 0.3);
    _v.subVectors(this.lungeTarget, m.pos).setY(0).normalize();
    this.lungeTarget.addScaledVector(_v, 8);
    this.game.sound('lockwarn', m.pos, 1);
  }
  spawnDecoys() {
    const g = this.game, m = this.mech;
    for (let i = 0; i < 2; i++) {
      const p = g.arena.randomPointNear(m.pos.x + rand(-15, 15), m.pos.z + rand(-15, 15), 10);
      const dm = g.spawnEnemy('flanker', p, { frame: 'phantom', loadout: { frame: 'phantom', armor: 'standard', mobility: 'standard', weapons: ['arc', 'scatter'], equip: [] }, scale: 1.5, palette: 'phantomzero', maxHp: 120, maxShield: 0, outDmgMul: 0.25, name: 'PHANTOM ZERO', decoy: true, extras: null, noReward: true, speedMul: 1.3 });
      addBossExtras(dm.model, 'phantomzero');
      this.decoys.push(dm);
      g.effects.flash(p.clone().setY(5), 4, 0xff1f4b, 0.3);
    }
  }
}

// ---------------------------------------------------------------------------
// OVERLORD — invulnerable while pylons stand; commands escorts; orbital strikes
// ---------------------------------------------------------------------------
class Overlord extends BossBase {
  constructor(game, mech) {
    super(game, mech, 'overlord');
    addBossExtras(mech.model, 'overlord');
    this.pylons = []; this.shieldDownT = 0; this.summonT = 16; this.strikeT = 10;
    this.pylonMat = new THREE.MeshStandardMaterial({ color: 0x4d4a5c, metalness: 0.6, roughness: 0.4, flatShading: true });
    this.pylonGlow = new THREE.MeshBasicMaterial({ color: 0xb36bff });
    this.beamMat = new THREE.MeshBasicMaterial({ color: 0xb36bff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
    this.buildPylons(1);
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshBasicMaterial({ color: 0xb36bff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.dome.scale.setScalar(m_radius(mech));
    game.scene.add(this.dome);
  }
  buildPylons(hpMul) {
    const g = this.game;
    for (const p of this.pylons) { if (p.alive) p.die(); p.dispose(); if (p.beam) g.scene.remove(p.beam); }
    this.pylons = [];
    const spots = g.arena.pylons.length ? g.arena.pylons : [new THREE.Vector3(-40, 0, 20), new THREE.Vector3(40, 0, 20), new THREE.Vector3(0, 0, -40)];
    for (const sp of spots) {
      const grp = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, 2, 6), this.pylonMat); base.position.y = 1;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.0, 7, 6), this.pylonMat); col.position.y = 5.5;
      const orb = new THREE.Mesh(new THREE.OctahedronGeometry(1.2, 0), this.pylonGlow); orb.position.y = 10;
      grp.add(base, col, orb);
      [base, col, orb].forEach((x) => { x.castShadow = true; });
      const s = new Structure(g, { kind: 'pylon', name: 'Relay Pylon', pos: sp, radius: 1.8, height: 11, hp: Math.round(900 * hpMul), team: this.mech.team, mesh: grp, solid: true, onDeath: (st) => this.pylonDown(st) });
      s.priority = 30; s.orb = orb;
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1, 6), this.beamMat);
      g.scene.add(beam); s.beam = beam;
      g.addStructure(s);
      this.pylons.push(s);
    }
  }
  pylonDown(st) {
    const g = this.game;
    g.effects.explosion(st.center(new THREE.Vector3()), 6, 0xb36bff, 0.6);
    g.sound('explosion', st.pos, 1);
    if (st.beam) st.beam.visible = false;
    const left = this.pylons.filter((p) => p.alive).length;
    if (left === 0) {
      this.shieldDownT = this.phase >= 2 ? 12 : 15;
      g.announce('COMMAND AEGIS DOWN', 'Strike the Overlord now!', 2);
      g.sound('shieldbreak', this.mech.pos, 1);
      this.mech.buffs.vulnerable = 4;
    } else g.announceSmall(`PYLON DESTROYED — ${left} REMAINING`);
  }
  filter(amt, type, src, pt) {
    if (this.shieldDownT > 0) return 1;
    this.mech.model.hitShield(); this.dome.material.opacity = 0.45;
    if (src && src.isPlayer && this.game.hud) this.game.hud.toast('SHIELDED — DESTROY THE PYLONS', '#b36bff');
    return 0;
  }
  update(dt) {
    super.update(dt);
    const m = this.mech, P = this.player, g = this.game;
    if (!m.alive) { this.cleanup(); return; }
    const hf = this.hpFrac();
    if (hf < 0.5) this.setPhase(2, 'OVERLORD — PHASE 2', 'Elite escorts and rapid orbital strikes.');
    // shield dome
    const shielded = this.shieldDownT <= 0;
    this.dome.visible = shielded;
    this.dome.position.copy(m.pos).setY(m.pos.y + m.height * 0.5);
    this.dome.material.opacity = Math.max(0.15, this.dome.material.opacity - dt);
    for (const p of this.pylons) {
      if (!p.alive) continue;
      p.orb.rotation.y += dt * 2;
      // connecting beam
      const a = _v.set(p.pos.x, 10, p.pos.z), b = _w.set(m.pos.x, m.pos.y + m.height * 0.8, m.pos.z);
      const len = a.distanceTo(b);
      p.beam.position.copy(a).add(b).multiplyScalar(0.5);
      p.beam.scale.set(1, len, 1);
      p.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _u.subVectors(b, a).normalize());
      p.beam.visible = shielded;
    }
    if (this.shieldDownT > 0) {
      this.shieldDownT -= dt;
      if (this.shieldDownT <= 0) {
        g.announce('COMMAND AEGIS RESTORED', 'Pylons rebuilt. Take them down again.', 2);
        this.buildPylons(this.phase >= 2 ? 1.0 : 0.8);
      }
    }
    if (!P || !P.alive) { m.intent.move.set(0, 0); return; }
    this.aimAt(P, 0.5);
    const d = m.pos.distanceTo(P.pos);
    // hold near center, keep distance
    if (d < 25) { _v.subVectors(m.pos, P.pos).setY(0).normalize().multiplyScalar(15).add(m.pos); this.moveTo(_v, 2); }
    else if (m.pos.length() > 25) this.moveTo(_v.set(0, 0, 0), 6);
    else m.intent.move.set(0, 0);
    this.fireWeapons(d < 140 && Math.sin(this.t * 1.1) > 0, d > 25 && d < 150);
    // summon escorts
    this.summonT -= dt;
    if (this.summonT <= 0) {
      const alive = g.mechs.filter((x) => x.alive && x.team === m.team && !x.isBoss).length;
      this.summonT = this.phase >= 2 ? 18 : 24;
      if (alive < 4) {
        const types = this.phase >= 2 ? ['elite', 'assault', 'support'] : ['assault', 'flanker', 'scout'];
        for (let i = 0; i < 2; i++) g.spawnEnemy(pick(types), pick(g.arena.enemySpawns), { noReward: false });
        g.announceSmall('OVERLORD: "Reinforcements, engage!"');
      }
    }
    // orbital strikes
    this.strikeT -= dt;
    if (this.strikeT <= 0) {
      this.strikeT = this.phase >= 2 ? 7 : 11;
      g.announceSmall('ORBITAL STRIKE INBOUND');
      for (let i = 0; i < 3; i++) {
        g.schedule(i * 0.7, () => { if (P.alive) g.strike(P.pos.x + P.vel.x * 0.8, P.pos.z + P.vel.z * 0.8, 9, 1.8, 140, m, 0xb36bff); });
      }
    }
  }
  cleanup() {
    for (const p of this.pylons) { if (p.alive) p.die(); if (p.beam) this.game.scene.remove(p.beam); }
    this.dome.visible = false;
  }
  dispose() { this.cleanup(); this.game.scene.remove(this.dome); }
}
function m_radius(mech) { return mech.height * 0.75; }

// ---------------------------------------------------------------------------
// OMEGA PRIME — beam sweeps, core fortress, adaptive berserk
// ---------------------------------------------------------------------------
class OmegaPrime extends BossBase {
  constructor(game, mech) {
    super(game, mech, 'omega');
    this.cores = []; this.fortress = false; this.coreAng = 0;
    this.beamMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xff3df2, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.beamMesh.geometry.translate(0, 0, 0.5); this.beamMesh.visible = false; this.beamMesh.frustumCulled = false;
    game.scene.add(this.beamMesh);
    this.distSamples = []; this.atkT = 4;
    this.coreMat = new THREE.MeshBasicMaterial({ color: 0xff3df2 });
    this.fortDome = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xff3df2, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false, wireframe: true }));
    this.fortDome.visible = false; game.scene.add(this.fortDome);
  }
  filter(amt) {
    if (this.fortress) { this.mech.model.hitShield(); if (this.game.hud) this.game.hud.toast('FORTRESS SHIELD — DESTROY THE CORES', '#ff3df2'); return 0; }
    if (this.state === 'stagger') return 1.5;
    return 1;
  }
  update(dt) {
    super.update(dt);
    const m = this.mech, P = this.player, g = this.game;
    if (!m.alive) { this.beamMesh.visible = false; this.fortDome.visible = false; for (const c of this.cores) if (c.alive) c.die(); return; }
    const hf = (m.hp + m.shield) / (m.stats.maxHp + m.stats.maxShield);
    if (hf < 0.66 && this.phase < 2) {
      this.setPhase(2, 'OMEGA PRIME — FORTRESS PROTOCOL', 'Destroy the four orbiting energy cores.');
      this.enterFortress();
    }
    if (hf < 0.33 && this.phase < 3 && !this.fortress) this.setPhase(3, 'OMEGA PRIME — BERSERK', 'It is reading your range. Adapt or die.');
    if (P && P.alive) { this.distSamples.push(m.pos.distanceTo(P.pos)); if (this.distSamples.length > 120) this.distSamples.shift(); }
    if (this.fortress) { this.updateFortress(dt); return; }
    if (!P || !P.alive) { m.intent.move.set(0, 0); return; }
    this.aimAt(P, 0.5);
    const d = m.pos.distanceTo(P.pos);
    if (this.state === 'beam') { this.updateBeam(dt); return; }
    if (this.state === 'stagger') { m.intent.move.set(0, 0); if (this.stateT > 3) { this.state = 'idle'; } return; }
    if (this.phase < 3) {
      // ranged artillery: keep long distance, strafe
      const want = 45;
      _v.subVectors(m.pos, P.pos).setY(0).normalize();
      const side = _w.set(-_v.z, 0, _v.x).multiplyScalar(Math.sin(this.t * 0.4) * 20);
      _u.copy(P.pos).addScaledVector(_v, want).add(side);
      this.moveTo(_u, 4);
      this.fireWeapons(d < 70, d < 200 && Math.sin(this.t * 0.7) > 0.3);
      if (this.atkT <= 0) {
        const r = Math.random();
        if (r < 0.5) this.startBeam();
        else { g.shockwave(m.pos, { speed: 26, maxR: 70, dmg: 100, source: m, color: 0xff3df2 }); g.sound('slam', m.pos, 1); g.effects.telegraph(m.pos.x, m.pos.z, 8, 0xff3df2, 0.3); this.atkT = rand(4, 6); }
      }
    } else {
      // berserk adaptive hunter
      m.stats.speed = this.baseSpeed ? this.baseSpeed * 1.5 : (this.baseSpeed = m.stats.speed) * 1.5;
      const avg = this.distSamples.reduce((a, b) => a + b, 0) / Math.max(1, this.distSamples.length);
      const playerKeepsAway = avg > 38;
      this.moveTo(P.pos, 10); m.intent.sprint = true;
      this.fireWeapons(d < 70, d > 20);
      if (this.atkT <= 0) {
        if (playerKeepsAway && d > 30) {
          // teleport in close, then shockwave
          const behind = _v.set(P.pos.x - Math.sin(P.yaw) * 14, 0, P.pos.z - Math.cos(P.yaw) * 14);
          if (g.arena.nav.walkable(behind.x, behind.z)) {
            g.effects.flash(m.center(_w).clone(), 6, 0xff3df2, 0.4);
            m.pos.copy(behind); g.sound('warp', m.pos, 1);
            g.effects.flash(m.center(_w).clone(), 6, 0xff3df2, 0.4);
            g.announceSmall('OMEGA: "Distance will not save you."');
          }
          this.atkT = rand(2.5, 3.5);
          g.schedule(0.8, () => { if (m.alive) { g.shockwave(m.pos, { speed: 30, maxR: 50, dmg: 110, source: m, color: 0xff3df2 }); g.sound('slam', m.pos, 1); } });
        } else if (d < 20) {
          g.shockwave(m.pos, { speed: 32, maxR: 45, dmg: 110, source: m, color: 0xff3df2 }); g.sound('slam', m.pos, 1);
          g.announceSmall('OMEGA: "Too close."');
          this.atkT = rand(3, 4);
        } else { this.startBeam(); }
      }
    }
  }
  startBeam() {
    const m = this.mech, P = this.player;
    this.state = 'beam'; this.stateT = 0;
    const toP = Math.atan2(P.pos.x - m.pos.x, P.pos.z - m.pos.z);
    this.beamDir = Math.random() < 0.5 ? 1 : -1;
    this.beamAng = toP - this.beamDir * 1.6;
    this.game.announceSmall('BEAM SWEEP — JUMP OR TAKE COVER');
    this.game.sound('beam', m.pos, 1);
    this.beamHit = new Set();
  }
  updateBeam(dt) {
    const m = this.mech, g = this.game;
    m.intent.move.set(0, 0);
    const charge = 1.1, sweep = this.phase >= 3 ? 1.9 : 2.6;
    const origin = _u.set(m.pos.x, m.pos.y + 2.2, m.pos.z);
    if (this.stateT < charge) {
      // charge telegraph: thin line
      this.beamMesh.visible = true;
      this.beamMesh.position.copy(origin);
      this.beamMesh.rotation.set(0, this.beamAng, 0);
      this.beamMesh.scale.set(0.15, 0.15, 95);
      this.beamMesh.material.opacity = 0.4 + Math.sin(this.stateT * 30) * 0.3;
      return;
    }
    const k = (this.stateT - charge) / sweep;
    if (k > 1) { this.beamMesh.visible = false; this.state = 'idle'; this.atkT = rand(3, 5); return; }
    this.beamAng += this.beamDir * 3.2 / sweep * dt;
    const dir = _v.set(Math.sin(this.beamAng), 0, Math.cos(this.beamAng));
    const end = _w.copy(origin).addScaledVector(dir, 95);
    const tw = g.arena.raycast(origin, end, false);
    const len = tw >= 0 ? 95 * tw : 95;
    end.copy(origin).addScaledVector(dir, len);
    this.beamMesh.position.copy(origin);
    this.beamMesh.rotation.set(0, this.beamAng, 0);
    this.beamMesh.scale.set(1.6, 1.6, len);
    this.beamMesh.material.opacity = 0.9;
    if (Math.random() < 0.6) g.effects.impact(end, 0xff3df2, 'energy', 1.2);
    for (const t of g.targets) {
      if (!t.alive || t.team === m.team || this.beamHit.has(t)) continue;
      const spheres = t.hitSpheres();
      // only the lower body spheres are at beam height — jumping clears it
      for (const s of spheres) {
        if (Math.abs(s.c.y - origin.y) > s.r + 0.8) continue;
        if (segSphere(origin, end, s.c, s.r) >= 0) {
          this.beamHit.add(t);
          g.applyDamage(t, 160 * m.damageMul(), 'energy', m, s.c, { weapon: 'beam' });
          break;
        }
      }
    }
  }
  enterFortress() {
    const g = this.game, m = this.mech;
    this.fortress = true; this.state = 'idle'; this.beamMesh.visible = false;
    this.fortDome.visible = true;
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Group();
      const o = new THREE.Mesh(new THREE.OctahedronGeometry(1.4, 0), this.coreMat);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2, 0.12, 4, 16), this.coreMat);
      mesh.add(o, ring); mesh.userData.ring = ring;
      const c = new Structure(g, { kind: 'core', name: 'Energy Core', pos: m.pos.clone(), radius: 1.8, height: 3.6, hp: 650, team: m.team, mesh, onDeath: (s) => this.coreDown(s) });
      c.priority = 40; c.idx = i;
      g.addStructure(c);
      this.cores.push(c);
    }
    this.minionT = 2;
  }
  coreDown(c) {
    const g = this.game;
    g.effects.explosion(c.center(new THREE.Vector3()), 5, 0xff3df2, 0.5);
    g.sound('explosion', c.pos, 1);
    const left = this.cores.filter((x) => x.alive).length;
    if (left === 0) {
      this.fortress = false; this.fortDome.visible = false;
      this.state = 'stagger'; this.stateT = 0;
      g.announce('FORTRESS BROKEN', 'Omega Prime is staggered — unload everything!', 2);
      g.sound('shieldbreak', this.mech.pos, 1);
    } else g.announceSmall(`CORE DESTROYED — ${left} REMAINING`);
  }
  updateFortress(dt) {
    const m = this.mech, P = this.player, g = this.game;
    this.moveTo(_v.set(0, 0, 0), 4);
    this.coreAng += dt * 0.5;
    this.fortDome.position.copy(m.pos).setY(m.pos.y + m.height * 0.5);
    this.fortDome.scale.setScalar(m.height * 0.8);
    this.fortDome.rotation.y += dt * 0.3;
    this.cores.forEach((c, i) => {
      if (!c.alive) return;
      const a = this.coreAng + i * Math.PI / 2;
      c.setPos(_w.set(m.pos.x + Math.cos(a) * 22, 4 + Math.sin(this.t * 2 + i) * 1.5, m.pos.z + Math.sin(a) * 22));
      c.mesh.userData.ring.rotation.x += dt * 2;
    });
    if (P && P.alive) {
      this.aimAt(P, 0.4);
      this.fireWeapons(false, Math.sin(this.t * 0.8) > 0.4);
      this.minionT -= dt;
      if (this.minionT <= 0) {
        this.minionT = 14;
        const alive = g.mechs.filter((x) => x.alive && x.team === m.team && !x.isBoss).length;
        if (alive < 3) { g.spawnEnemy('scout', pick(g.arena.enemySpawns)); g.spawnEnemy('flanker', pick(g.arena.enemySpawns)); }
      }
      if (this.atkT <= 0) { this.atkT = 6; for (let i = 0; i < 5; i++) g.strike(P.pos.x + rand(-14, 14), P.pos.z + rand(-14, 14), 6, 1.5 + i * 0.25, 90, m, 0xff3df2); }
    }
  }
  dispose() { this.game.scene.remove(this.beamMesh, this.fortDome); }
}

export function createBossController(game, mech, id) {
  switch (id) {
    case 'irongiant': return new IronGiant(game, mech);
    case 'phantomzero': return new PhantomZero(game, mech);
    case 'overlord': return new Overlord(game, mech);
    case 'omega': return new OmegaPrime(game, mech);
  }
  throw new Error('unknown boss ' + id);
}
