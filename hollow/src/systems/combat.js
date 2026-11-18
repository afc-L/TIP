// Monster attacks, feeding, breakables and the (few) ways NPCs fight back.
// Presentation is deliberately stylised: dark bursts, ash and sound, never anatomy.
import * as THREE from 'three';
import { angleDiff, rand, clamp, chance } from '../core/util.js';

const ATTACKS = {
  swipeR: { range: 2.8, arc: 1.25, dmg: 45 }, swipeL: { range: 2.8, arc: 1.25, dmg: 45 },
  rake: { range: 3.0, arc: 1.4, dmg: 62 }, heavy: { range: 3.1, arc: 1.0, dmg: 120, heavy: true }, pounce: { range: 3.4, arc: 1.2, dmg: 130, heavy: true },
};

export class Combat {
  constructor(game) { this.game = game; this.projectiles = []; this.breakables = []; this.tracers = []; }
  reset() { for (const p of this.projectiles) p.mesh.parent && p.mesh.parent.remove(p.mesh); this.projectiles = []; this.breakables = []; this.tracers.forEach((t) => t.parent && t.parent.remove(t)); this.tracers = []; }

  resolveAttack(type) {
    const g = this.game, m = g.monster, A = ATTACKS[type];
    const dmgMul = m.attackMul >= 1.2 ? 1.25 : 1;
    let hits = 0;
    for (const n of g.npcs.list) {
      if (!(n.alive || n.state === 'crawl')) continue;
      const dx = n.pos.x - m.pos.x, dz = n.pos.z - m.pos.z, d = Math.hypot(dx, dz);
      if (d > A.range + 0.3 || Math.abs(n.pos.y - m.pos.y) > 2) continue;
      const off = Math.abs(angleDiff(m.yaw, Math.atan2(dx, dz)));
      if (off > A.arc && d > 1.2) continue;
      const dir = new THREE.Vector3(dx / (d || 1), 0, dz / (d || 1));
      const down = n.takeHit(A.dmg * dmgMul * rand(0.85, 1.15), dir, A.heavy);
      g.audio.play('impact', n.center(), { vol: 1, heavy: A.heavy ? 1.4 : 1 });
      g.fx.impact(n.center(), dir);
      m.camShake = Math.max(m.camShake, A.heavy ? 0.35 : 0.18);
      g.hitStop(A.heavy ? 0.09 : 0.05);
      hits++;
      if (down) g.ui.hint('Hold F to feed', 3);
    }
    // doors & breakables
    const fwd = m.forward;
    for (const d of g.map.doors) {
      const dd = d.pos.distanceTo(m.pos); if (dd > 3) continue;
      const off = Math.abs(angleDiff(m.yaw, Math.atan2(d.pos.x - m.pos.x, d.pos.z - m.pos.z)));
      if (off > 1.2) continue;
      if (A.heavy && (d.locked || !d.open)) {
        d.locked = false; d.broken = true; d.open = true; d.target = 1.75 * (d.dir || 1); d.collider.enabled = false;
        g.audio.play('impact', d.pos, { vol: 1.2, heavy: 2 }); g.audio.play('thud', d.pos, { vol: 1 }); g.fx.impact(d.pos.clone().setY(d.pos.y + 1), fwd);
        g.emitNoise(d.pos, 30, 'slam'); m.camShake = 0.4;
        g.story && g.story.event('doorBroken', d);
      } else if (!A.heavy && !d.open) { g.audio.play('knock', d.pos, { vol: 0.9, n: 1 }); g.emitNoise(d.pos, 14, 'door'); }
    }
    for (const b of this.breakables) {
      if (b.broken) continue;
      const dd = b.pos.distanceTo(m.pos); if (dd > A.range + b.r) continue;
      const off = Math.abs(angleDiff(m.yaw, Math.atan2(b.pos.x - m.pos.x, b.pos.z - m.pos.z)));
      if (off > A.arc) continue;
      this.breakObject(b, fwd);
      hits++;
    }
    return hits;
  }

  registerBreakable(obj) { this.breakables.push(obj); }
  breakObject(b, dir) {
    b.broken = true; const g = this.game;
    if (b.collider) b.collider.enabled = false;
    b.mesh.visible = false;
    g.audio.play(b.sound || 'impact', b.pos, { vol: 1 });
    g.fx.impact(b.pos, dir); g.fx.sparks(b.pos, [0.6, 0.55, 0.5]);
    g.emitNoise(b.pos, 20, 'slam');
    // scatter a few debris pieces as projectiles with no damage
    for (let i = 0; i < 5; i++) {
      const piece = new THREE.Mesh(new THREE.BoxGeometry(rand(0.08, 0.25), rand(0.05, 0.2), rand(0.08, 0.25)), b.mesh.material || b.mesh.children[0]?.material);
      piece.position.copy(b.pos); piece.position.y += 0.5; g.scene.add(piece);
      this.projectiles.push({ mesh: piece, vel: new THREE.Vector3(dir.x * rand(2, 6) + rand(-2, 2), rand(2, 5), dir.z * rand(2, 6) + rand(-2, 2)), life: 4, debris: true, spin: new THREE.Vector3(rand(-8, 8), rand(-8, 8), rand(-8, 8)) });
    }
  }

  // ---------------- feeding ----------------
  findFeedTarget() {
    const m = this.game.monster; let best = null, bd = 2.6;
    for (const n of this.game.npcs.list) {
      if (!n.vulnerable) continue;
      const d = n.pos.distanceTo(m.pos); if (d < bd) { bd = d; best = n; }
    }
    if (!best) this.game.ui.hint('Nothing to feed on. Bring someone down first.', 1.5);
    return best;
  }
  findFeedTargetQuiet() {
    const m = this.game.monster;
    for (const n of this.game.npcs.list) if (n.vulnerable && n.pos.distanceTo(m.pos) < 2.6) return n;
    return null;
  }
  startFeed(npc) {
    const g = this.game;
    npc.setState('fed');
    const f = { npc, t: 0, dur: 3.2 / (g.progress.upgradeLevel('feed') ? 1.35 : 1), soundT: 0, blend: 0 };
    g.audio.play('feed', npc.center(), { vol: 0.85, dur: f.dur });
    g.emitNoise(npc.pos, 14, 'feed');
    return f;
  }
  updateFeed(f, dt) {
    const g = this.game, m = g.monster, n = f.npc;
    if (n.removed || m.pos.distanceTo(n.pos) > 3.2) { this.cancelFeed(f); return false; }
    f.t += dt;
    const mouth = m.headPos(); mouth.y -= 0.1;
    g.fx.wisps(n.center(), mouth, 2);
    g.post.feed = Math.min(1, g.post.feed + dt * 2);
    if (f.t >= f.dur) { this.completeFeed(f); return true; }
    return null;
  }
  cancelFeed(f) {
    if (f.npc && f.npc.state === 'fed') { f.npc.setState('downed'); f.npc.downedT = Math.max(0, f.npc.downedT - 3); }
    this.game.audio.play('growl', this.game.monster.headPos(), { vol: 0.4, dur: 0.6 });
  }
  completeFeed(f) {
    const g = this.game, n = f.npc, m = g.monster;
    n.setState('dissolve');
    g.audio.play('dissolve', n.center(), { vol: 0.8 });
    g.fx.ash(n.pos, 1.7 * n.H);
    g.fx.sparks(n.center(), [0.6, 0.1, 0.1]);
    m.hunger = Math.min(100, m.hunger + 45); m.health = Math.min(100, m.health + 25);
    const reward = (n.role === 'searcher' || n.role === 'guard' ? 30 : 20) + (n.seesMonster ? 0 : 5) + (n.recognized ? 0 : 10);
    g.progress.addEssence(reward);
    g.ui.toast(`+${reward} essence`, 2, 'essence');
    g.stats.fed++; g.stats.fedInMap++; if (n.firstHitRecognized === false) g.stats.unseenFeeds++; g.progress.d.stats.fed++;
    g.npcs.onRemoved(n, 'fed');
    g.story && g.story.event('fed', n);
    g.hallucinations.onFeed();
    // leave a dark mark where it happened
    g.map.addStain && g.map.addStain(n.pos);
  }

  // ---------------- NPCs fighting back ----------------
  npcShoot(npc, m) {
    const g = this.game;
    const muzzle = npc.B.handR.getWorldPosition(new THREE.Vector3());
    const target = m.chestPos();
    const d = muzzle.distanceTo(target);
    const hitChance = clamp(0.85 - d / 45 - (m.speed > 5 ? 0.25 : 0) - (m.crouchW > 0.5 ? 0.1 : 0), 0.1, 0.85);
    const hit = chance(hitChance) && g.world.lineOfSight(muzzle, target);
    g.audio.play('gun', muzzle, { vol: 1 });
    g.fx.muzzle(muzzle);
    g.flash(muzzle, 0xffd080, 25, 0.08);
    g.emitNoise(muzzle, 40, 'scream', npc);
    const end = hit ? target.clone() : target.clone().add(new THREE.Vector3(rand(-3, 3), rand(-1, 2), rand(-3, 3)));
    this.tracer(muzzle, end);
    if (hit) { m.damage(rand(6, 11) * (g.difficulty || 1)); g.fx.impact(target, new THREE.Vector3(0, 0, 0)); g.post.damage = 1; }
  }
  tracer(a, b) {
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.8 }));
    l.userData.life = 0.06; this.game.scene.add(l); this.tracers.push(l);
  }
  npcThrow(npc, m) {
    const g = this.game;
    const from = npc.B.handR.getWorldPosition(new THREE.Vector3()); from.y += 0.3;
    const to = m.chestPos().addScaledVector(m.vel, 0.5);
    const T = clamp(from.distanceTo(to) / 14, 0.4, 1.2);
    const vel = new THREE.Vector3((to.x - from.x) / T, (to.y - from.y) / T + 0.5 * 12 * T, (to.z - from.z) / T);
    const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.07, 0), new THREE.MeshStandardMaterial({ color: chance(0.5) ? 0x4a6a3a : 0x6a6a68, roughness: 0.6 }));
    mesh.position.copy(from); g.scene.add(mesh);
    this.projectiles.push({ mesh, vel, life: 3, dmg: 4, spin: new THREE.Vector3(8, 5, 3) });
    g.audio.play('swipe', from, { vol: 0.4, pitch: 1.6 });
  }
  npcMelee(npc, m) {
    const g = this.game;
    if (npc.pos.distanceTo(m.pos) < 2.6) { m.damage(5); g.audio.play('impact', m.chestPos(), { vol: 0.6 }); g.post.damage = 0.6; }
    else g.audio.play('swipe', npc.center(), { vol: 0.5 });
  }

  update(dt) {
    const g = this.game, m = g.monster;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt; p.vel.y -= 12 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.spin) { p.mesh.rotation.x += p.spin.x * dt; p.mesh.rotation.y += p.spin.y * dt; }
      const gy = g.world.groundAt(p.mesh.position.x, p.mesh.position.z, p.mesh.position.y + 0.3, 0.05, 0.3).y;
      if (p.mesh.position.y < gy + 0.05) { p.mesh.position.y = gy + 0.05; p.vel.multiplyScalar(0.3); p.vel.y = Math.abs(p.vel.y) * 0.3; if (!p.debris && !p.landed) { p.landed = true; g.audio.play('impact', p.mesh.position, { vol: 0.25 }); } if (p.debris) p.spin = null; }
      if (p.dmg && !p.landed && p.mesh.position.distanceTo(m.chestPos()) < 0.9) {
        m.damage(p.dmg); g.audio.play(chance(0.5) ? 'glass' : 'impact', p.mesh.position, { vol: 0.7 }); g.post.damage = 0.5; p.life = 0;
      }
      if (p.life <= 0) { g.scene.remove(p.mesh); p.mesh.geometry.dispose(); this.projectiles.splice(i, 1); }
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) { const t = this.tracers[i]; t.userData.life -= dt; if (t.userData.life <= 0) { g.scene.remove(t); t.geometry.dispose(); this.tracers.splice(i, 1); } }
  }
}
