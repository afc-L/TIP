import * as THREE from 'three';
import { clamp, v3, q4 } from './util.js';

// Fraction of damage removed by armor, per damage type. A simplified, consistent model —
// not a simulation of real cutting.
const ARMOR_REDUCTION = {
  plate: { slash: 0.92, thrust: 0.6, blunt: 0.35 },
  mail: { slash: 0.75, thrust: 0.35, blunt: 0.12 },
  gambeson: { slash: 0.4, thrust: 0.25, blunt: 0.2 },
};
// Damage per joule above the threshold.
const DAMAGE_K = { slash: 0.21, thrust: 0.75, blunt: 0.16 };
const ENERGY_THRESHOLD = 9; // J — slow pushes do nothing
// Raw (pre-multiplier) slash damage needed to sever at the joint above the struck part.
const SEVER_THRESHOLD = { hand: 16, arm: 24, foot: 20, leg: 36, head: 34 };

const _p = new THREE.Vector3(), _n = new THREE.Vector3(), _rel = new THREE.Vector3();
const _va = { x: 0, y: 0, z: 0 }, _vb = { x: 0, y: 0, z: 0 };
const _axis = new THREE.Vector3(), _edge = new THREE.Vector3(), _perp = new THREE.Vector3();
const _q = new THREE.Quaternion(), _tmp = new THREE.Vector3();

export class Combat {
  constructor(game) {
    this.game = game;
    this.physics = game.physics;
    this.time = 0;
    this.cooldown = new Map();
  }

  process(dt) {
    this.time += dt;
    const ph = this.physics;
    ph.events.drainCollisionEvents((h1, h2, started) => {
      if (!started) return;
      const a = ph.info(h1), b = ph.info(h2);
      if (!a || !b) return;
      if (a.type === 'weapon') this.onWeaponContact(h1, a, h2, b);
      else if (b.type === 'weapon') this.onWeaponContact(h2, b, h1, a);
    });
    if (this.cooldown.size > 400) {
      for (const [k, t] of this.cooldown) if (this.time - t > 1) this.cooldown.delete(k);
    }
  }

  contactPoint(hw, ho, outP, outN) {
    const world = this.physics.world;
    const cw = world.getCollider(hw), co = world.getCollider(ho);
    let found = false;
    world.contactPair(cw, co, (manifold, flipped) => {
      if (found) return;
      const n = manifold.normal();
      outN.set(n.x, n.y, n.z);
      if (flipped) outN.negate();
      if (manifold.numSolverContacts() > 0) {
        const s = manifold.solverContactPoint(0);
        outP.set(s.x, s.y, s.z);
        found = true;
      }
    });
    if (!found) {
      const t = cw.translation();
      const proj = co.projectPoint(t, true);
      if (proj) outP.set(proj.point.x, proj.point.y, proj.point.z);
      else outP.set(t.x, t.y, t.z);
    }
    return { cw, co };
  }

  onCooldown(key, dur) {
    const t = this.cooldown.get(key);
    if (t !== undefined && this.time - t < dur) return true;
    this.cooldown.set(key, this.time);
    return false;
  }

  onWeaponContact(hw, wi, ho, oi) {
    const { cw, co } = this.contactPoint(hw, ho, _p, _n);
    const wb = cw.parent(), ob = co.parent();
    const key = wb.handle + ':' + ob.handle;
    this.physics.preVelocityAt(wb, _p, _va);
    this.physics.preVelocityAt(ob, _p, _vb);
    _rel.set(_va.x - _vb.x, _va.y - _vb.y, _va.z - _vb.z);
    const speed = _rel.length();

    if (oi.type === 'weapon') {
      if (this.onCooldown(key, 0.1)) return;
      this.weaponClash(wi, oi, _p, _n, speed);
    } else if (oi.type === 'body') {
      if (this.onCooldown(key, 0.16)) return;
      this.weaponHit(wi, oi.part, wb, _p, _rel, speed);
    } else if (speed > 3) {
      if (this.onCooldown(key, 0.15)) return;
      this.game.audio.thud(_p, speed * 0.4, true);
      if (speed > 6) this.game.gore.sparks(_p, _n.set(0, 1, 0), Math.floor(speed * 0.6));
    }
  }

  weaponClash(a, b, p, n, speed) {
    const g = this.game;
    if (speed > 1.2) {
      g.audio.clang(p, speed);
      g.gore.sparks(p, n, Math.min(28, Math.floor(speed * 2.2)));
    }
    const fa = a.owner, fb = b.owner;
    if (!fa || !fb) return;
    // Who was swinging harder? The weaker blade gets knocked aside and the arm jarred.
    const sa = fa.swingSpeed || 0, sb = fb.swingSpeed || 0;
    if (speed > 3) {
      const parryA = fa.parryT >= 0, parryB = fb.parryT >= 0;
      for (const [f, own, other, parry] of [[fa, sa, sb, parryA], [fb, sb, sa, parryB]]) {
        if (f.weapon.dropped) continue;
        let jar = clamp(speed * 0.025, 0, 0.35);
        if (own < other) jar *= 1.6;
        if (parry) jar *= 0.3;
        f.jarred = Math.max(f.jarred, jar);
        f.balance -= speed * (parry ? 0.004 : 0.012);
      }
      // A good parry punishes the attacker
      if (parryA && sb > 4) { fb.jarred = Math.max(fb.jarred, 0.6); fb.balance -= 0.18; fa.stamina += 6; g.onParry?.(fa, fb); }
      if (parryB && sa > 4) { fa.jarred = Math.max(fa.jarred, 0.6); fa.balance -= 0.18; fb.stamina += 6; g.onParry?.(fb, fa); }
    }
  }

  weaponHit(wi, part, wb, p, rel, speed) {
    const g = this.game;
    const attacker = wi.owner;
    const victim = part.fighter;
    if (!attacker || attacker === victim) return;
    const weapon = attacker.weapon;
    if (weapon.dropped) {
      if (speed > 4) g.audio.thud(p, speed * 0.3);
      return;
    }

    // Classify the contact
    _q.copy(q4(wb.rotation(), _q));
    _axis.set(0, 1, 0).applyQuaternion(_q);
    const along = rel.dot(_axis);
    let type = 'blunt', eff = speed;
    if (wi.kind === 'tip' && along > 0.55 * speed) {
      type = 'thrust'; eff = along;
    } else if (wi.kind === 'edge') {
      _perp.copy(rel).addScaledVector(_axis, -along);
      const pl = _perp.length();
      const defEdges = weapon.def.edges;
      let best = 0;
      for (const s of defEdges) {
        _edge.set(s, 0, 0).applyQuaternion(_q);
        best = Math.max(best, _perp.dot(_edge) / Math.max(pl, 1e-6));
      }
      if (best > 0.55) { type = 'slash'; eff = pl * best; } else { type = 'blunt'; eff = pl * 0.8; }
    } else if (wi.kind === 'haft') {
      eff = speed * 0.5;
    }
    const mEff = weapon.mass + 1.1;
    const E = 0.5 * mEff * eff * eff;

    // Physical knock: always present, scaled by momentum (on top of the solver's contact response)
    const knock = Math.min(mEff * eff * (type === 'blunt' ? 0.45 : 0.25), 45);
    if (knock > 0.5) {
      _tmp.copy(rel).normalize().multiplyScalar(knock);
      part.body.applyImpulseAtPoint({ x: _tmp.x, y: _tmp.y, z: _tmp.z }, { x: p.x, y: p.y, z: p.z }, true);
    }

    if (E < ENERGY_THRESHOLD) {
      if (speed > 1.5) g.audio.thud(p, speed * 0.2);
      return;
    }

    // Armor
    let covered = false, armorType = null;
    if (part.armor) {
      armorType = part.armor[0];
      const cov = part.armor[1] * (type === 'thrust' ? 0.72 : 1);
      covered = Math.random() < cov;
    }
    let raw = DAMAGE_K[type] * (E - ENERGY_THRESHOLD);
    if (weapon.def === attacker.weaponDef && weapon.def.label === 'Bearded Axe' && type === 'slash') raw *= 1.2;
    const reduction = covered ? ARMOR_REDUCTION[armorType][type] : 0;
    const dmg = raw * part.dmg * (1 - reduction);

    // Balance and stagger (armor spreads, but doesn't remove, the force)
    const regionBal = { head: 1.4, torso: 1.2, pelvis: 1.0, arm: 0.35, hand: 0.2, leg: 0.9, foot: 0.6 }[part.region];
    victim.balance -= (E / 420) * regionBal * (covered && type !== 'blunt' ? 0.7 : 1);
    victim.lastHitBy = attacker;

    // Feedback
    const metal = covered && (armorType === 'plate' || armorType === 'mail');
    if (metal) {
      g.audio.armor(p, eff, armorType);
      if (armorType === 'plate') g.gore.sparks(p, rel.clone().negate().normalize(), Math.floor(clamp(eff * 1.5, 3, 18)));
    }
    if (dmg > 0.5) {
      g.audio.flesh(p, dmg);
      if (!victim.invulnerable) victim.health -= dmg;
      victim.partDamage[part.name] = (victim.partDamage[part.name] || 0) + dmg;
      weapon.blood = Math.min(1, weapon.blood + dmg * 0.025);
      weapon.bladeMat.color.setRGB(0.79, 0.81, 0.84).lerp(BLOOD_STEEL, weapon.blood * 0.85);
      const bleed = type === 'blunt' ? dmg * 0.004 : dmg * 0.02;
      g.gore.wound(part, p, rel, type, dmg, bleed);
      if (dmg > 6 && Math.random() < 0.7) g.audio.pain(victim, dmg);
    }
    g.onHit?.(attacker, victim, part, dmg, type);

    // Injuries & impairments
    this.applyInjury(victim, part, type, raw, dmg, E, covered);

    // Dismemberment: clean, unarmored (or lightly armored) cuts with enough energy
    const softArmor = !covered || armorType === 'gambeson';
    const thr = SEVER_THRESHOLD[part.region];
    if (type === 'slash' && softArmor && thr && raw > thr * (armorType === 'gambeson' ? 1.6 : 1) && g.settings.gore) {
      const lost = victim.sever(part.name);
      if (lost) {
        g.gore.severed(victim, part, rel);
        g.audio.sever(p);
        g.onSever?.(attacker, victim, part);
      }
    } else if (type === 'slash' && part.region === 'torso' && softArmor && raw > 45 && g.settings.gore) {
      g.gore.gut(part, p, rel);
      victim.bleedRate += 1.5;
    }
  }

  applyInjury(victim, part, type, raw, dmg, E, covered) {
    if (victim.state === 'dead') return;
    const pd = (n) => victim.partDamage[n] || 0;
    if (part.region === 'arm' || part.region === 'hand') {
      const s = part.side === -1 ? 'R' : 'L';
      const total = pd('upperArm' + s) + pd('forearm' + s) + pd('hand' + s);
      victim.limb['arm' + s] = Math.min(victim.limb['arm' + s], clamp(1 - total / 70, 0.15, 1));
      if (s === 'R') victim.jarred = Math.max(victim.jarred, 0.25 + dmg * 0.02);
      // a hard blow to the sword hand can knock the weapon out of it
      if (s === 'R' && part.region === 'hand' && E > 70 && Math.random() < 0.4) victim.dropWeapon(true);
    } else if (part.region === 'leg' || part.region === 'foot') {
      const s = part.side === -1 ? 'R' : 'L';
      const total = pd('thigh' + s) + pd('shin' + s) + pd('foot' + s);
      victim.limb['leg' + s] = Math.min(victim.limb['leg' + s], clamp(1 - total / 80, 0.2, 1));
      if (dmg > 15) victim.balance -= 0.25;
    } else if (part.region === 'head') {
      if (type === 'blunt' || covered) {
        if (E > 140 || (type === 'blunt' && raw > 24)) { victim.koTime = Math.max(victim.koTime, 3 + Math.random() * 3); }
        else if (E > 40) victim.dazed = Math.max(victim.dazed, 1.2 + E / 100);
      } else if (dmg > 10) victim.dazed = Math.max(victim.dazed, 1.0);
    } else if (part.region === 'torso' || part.region === 'pelvis') {
      if (dmg > 20 || E > 150) { victim.balance -= 0.2; victim.dazed = Math.max(victim.dazed, 0.4); }
    }
    // cumulative wear: repeated hits sap fighting ability
    const hurt = 1 - victim.health / 100;
    victim.stamina -= dmg * 0.6 + hurt * 3;
  }
}

const BLOOD_STEEL = new THREE.Color(0.32, 0.02, 0.02);
