// Boss state machines: telegraphed, avoidable attacks with distinct phases.
import * as THREE from 'three';
import { BOSSES, type BossDef } from '../../data/enemies';
import type { BossId } from '../../data/types';
import { buildBoss, type BossRig } from '../models/bossModels';
import { cone } from '../models/shapes';
import type { Run } from '../Run';
import { angleDiff, rand } from '../util';
import type { Enemy } from './Enemy';

type BossState = 'intro' | 'chase' | 'slam' | 'roots' | 'summon' | 'charge' | 'dash' | 'volley' | 'oil' | 'dying'
  | 'wells' | 'barrage' | 'blink' | 'pull' | 'sweep' | 'judgment' | 'spikes' | 'wave' | 'elites';

export class BossController {
  id: BossId;
  def: BossDef;
  rig: BossRig;
  entity: Enemy;
  state: BossState = 'intro';
  stateT = 0;
  cooldown = 2.5;
  facing = 0;
  enraged = false;
  majorHits = 0;
  tier: number;
  dead = false;
  private last: BossState = 'chase';
  private dashDir = { x: 0, z: 0 };
  private dashLeft = 0;
  private contactT = 0;
  private volleyLeft = 0;
  private volleyT = 0;
  private spikes: THREE.Mesh[] = [];
  private spikeT: number[] = [];
  private shadow: THREE.Mesh;
  private dashHit = false;
  private anim = 0;
  final: boolean;
  /** Phase index: grows as health thresholds are crossed. */
  phase = 0;
  private waves: { r: number; max: number; speed: number; hit: boolean }[] = [];
  private repeat = 0;
  private blinkTo = { x: 0, z: 0 };
  private farT = 0;

  constructor(id: BossId, run: Run, tier: number, final = false) {
    this.id = id;
    this.def = BOSSES[id];
    this.tier = tier;
    this.final = final;
    this.rig = buildBoss(id);
    const p = run.player;
    // arrive between the player and the arena centre so there's room to fight
    const toC = Math.atan2(-p.z, -p.x);
    let x = p.x + Math.cos(toC) * 14, z = p.z + Math.sin(toC) * 14;
    if (Math.hypot(x, z) > run.world.radius - 6) { x *= 0.7; z *= 0.7; }
    const pos = { x, z };
    run.world.resolve(pos, this.def.radius);
    const hp = this.def.hp * run.difficulty.hp * tier * (run.mode === 'practice' ? 0.7 : 1);
    this.entity = run.enemies.spawnBoss(pos.x, pos.z, hp, this.def.radius);
    this.rig.root.position.set(pos.x, -7, pos.z);
    this.facing = Math.atan2(p.z - pos.z, p.x - pos.x);
    run.scene.add(this.rig.root);
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(this.def.radius * 1.2, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    this.shadow.position.set(pos.x, 0.04, pos.z);
    run.scene.add(this.shadow);
    if (id === 'stumpKing' || id === 'crystalColossus') {
      const geo = cone(0.7, 3.2, { p: [0, 1.6, 0] }, 5);
      const mat = id === 'stumpKing' ? new THREE.MeshLambertMaterial({ color: '#6f4518', flatShading: true }) : new THREE.MeshBasicMaterial({ color: '#4cc9f0', transparent: true, opacity: 0.9 });
      for (let i = 0; i < 14; i++) {
        const m = new THREE.Mesh(geo, mat);
        m.visible = false;
        run.scene.add(m);
        this.spikes.push(m);
        this.spikeT.push(0);
      }
    }
    this.stateT = 2.4;
  }

  get name() { return this.def.name; }

  dispose() {
    this.rig.root.removeFromParent();
    this.shadow.removeFromParent();
    for (const s of this.spikes) s.removeFromParent();
  }

  /** Boss rising out of the ground during BOSS_INTRO. */
  updateIntro(dt: number, run: Run) {
    this.stateT -= dt;
    const t = Math.max(0, Math.min(1, 1 - this.stateT / 2.4));
    const e = this.entity;
    this.rig.root.position.set(e.x + Math.sin(run.time * 60) * 0.1 * (1 - t), -7 + 7 * (1 - Math.pow(1 - t, 3)), e.z);
    this.rig.root.rotation.y = Math.PI / 2 - this.facing;
    if (Math.random() < 0.8) run.particles.burst(e.x + rand(-2, 2), 0.2, e.z + rand(-2, 2), 2, this.id === 'stumpKing' ? '#7f5539' : '#6c757d', 5, 0.35, 0.8, 7);
    run.screen.shake(0.15);
    if (this.stateT <= 0) { this.state = 'chase'; this.cooldown = 1.5; this.rig.root.position.y = 0; }
  }

  update(dt: number, run: Run) {
    const e = this.entity;
    const p = run.player;
    this.anim += dt;
    if (this.state === 'dying') {
      this.stateT -= dt;
      this.rig.root.position.y -= dt * 1.2;
      this.rig.root.rotation.z = Math.sin(run.time * 30) * 0.05;
      if (Math.random() < 0.5) run.particles.burst(e.x + rand(-2, 2), rand(1, 4), e.z + rand(-2, 2), 4, Math.random() < 0.5 ? '#ffd166' : this.def.color, 6, 0.3, 0.7);
      if (Math.random() < 0.08) { run.vfx.ring(e.x, e.z, 1, 6, '#ffd166', 0.4); run.sfx('explode'); }
      if (this.stateT <= 0) { this.dead = true; this.rig.root.visible = false; this.shadow.visible = false; }
      return;
    }
    if (!e.alive) return;
    if (this.state === 'intro') {
      // the intro screen is timed in real seconds; finish rising here if frames were slow
      this.updateIntro(dt, run);
      return;
    }
    const ratio = e.hp / e.maxHp;
    const enter = (text: string) => {
      run.announce(text, true);
      run.sfx('phase', this.def.roar / 80);
      run.sfx('bossRoar', this.def.roar / 80);
      run.screen.shake(0.45);
      run.vfx.ring(e.x, e.z, 1, 10, this.def.color, 0.6);
    };
    if (!this.enraged && this.id === 'scrapGolem' && ratio < 0.4) { this.enraged = true; this.rig.eyeMat.color.set('#ff1e1e'); enter('THE SCRAP GOLEM OVERHEATS!'); }
    if (!this.enraged && this.id === 'voidDevourer' && ratio < 0.35) { this.enraged = true; enter('THE VOID DEVOURER IS STARVING!'); }
    if (this.id === 'goldenExecutioner' && this.phase === 0 && ratio < 0.5) { this.phase = 1; enter('THE EXECUTIONER DRAWS A SECOND BLADE!'); }
    if (this.id === 'crystalColossus') {
      if (this.phase === 0 && ratio < 0.6) { this.phase = 1; enter('THE COLOSSUS CRACKS!'); }
      if (this.phase === 1 && ratio < 0.3) { this.phase = 2; this.enraged = true; enter('THE COLOSSUS SHATTERS INTO FURY!'); }
    }
    const speedMul = this.enraged ? 1.35 : 1;
    const dx = p.x - e.x, dz = p.z - e.z;
    const dist = Math.hypot(dx, dz) || 1;
    const want = Math.atan2(dz, dx);
    this.contactT -= dt;
    // never leave the fight: leap back into range if stranded far from the player
    this.farT = dist > 22 && this.state === 'chase' ? this.farT + dt : 0;
    if (this.farT > 4) {
      this.farT = 0;
      const a = Math.atan2(-dz, -dx) + rand(-0.6, 0.6);
      const pos = { x: p.x - Math.cos(a) * -12, z: p.z - Math.sin(a) * -12 };
      run.world.resolve(pos, this.def.radius);
      run.particles.burst(e.x, 2, e.z, 20, '#adb5bd', 6, 0.3, 0.6);
      e.x = pos.x; e.z = pos.z;
      run.vfx.ring(e.x, e.z, 1, 6, this.def.color, 0.5);
      run.sfx('bossSlam');
      run.screen.shake(0.3);
    }

    switch (this.state) {
      case 'chase': {
        this.facing += angleDiff(this.facing, want) * Math.min(1, dt * 3);
        if (this.id === 'voidDevourer') {
          const dir = dist > 9 ? 1 : dist < 6 ? -1 : 0;
          e.x += Math.cos(this.facing) * this.def.speed * speedMul * dt * dir + Math.cos(this.facing + Math.PI / 2) * dt * 1.5;
          e.z += Math.sin(this.facing) * this.def.speed * speedMul * dt * dir + Math.sin(this.facing + Math.PI / 2) * dt * 1.5;
        } else if (dist > this.def.radius + 1.5) {
          e.x += Math.cos(this.facing) * this.def.speed * speedMul * dt;
          e.z += Math.sin(this.facing) * this.def.speed * speedMul * dt;
        }
        this.cooldown -= dt * speedMul;
        if (this.cooldown <= 0 && p.alive) this.chooseAttack(run, dist);
        break;
      }
      case 'slam': {
        this.stateT -= dt;
        if (this.stateT <= 0) this.toChase(2.2);
        break;
      }
      case 'roots':
      case 'oil':
      case 'wells':
      case 'spikes':
      case 'judgment':
      case 'elites':
      case 'pull': {
        this.stateT -= dt;
        if (this.stateT <= 0) this.toChase(this.state === 'judgment' ? 2.5 : 2);
        break;
      }
      case 'sweep': {
        this.facing += angleDiff(this.facing, want) * Math.min(1, dt * 1.5);
        this.stateT -= dt;
        if (this.stateT <= 0) {
          if (this.repeat > 0) { this.repeat--; this.sweep(run); }
          else this.toChase(1.8);
        }
        break;
      }
      case 'barrage': {
        this.stateT -= dt;
        this.volleyT -= dt;
        if (this.volleyT <= 0 && this.volleyLeft > 0) {
          this.volleyLeft--;
          this.volleyT = 0.45;
          const n = this.enraged ? 22 : 14;
          const off = this.volleyLeft * 0.13;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + off;
            run.projectiles.enemyBolt(e.x + Math.cos(a) * 2, e.z + Math.sin(a) * 2, Math.cos(a), Math.sin(a), 8, 13 * run.difficulty.damage * Math.sqrt(this.tier), 'bolt', 0.38);
          }
          run.sfx('enemyShot');
        }
        if (this.volleyLeft <= 0 && this.volleyT <= 0) this.toChase(1.6);
        break;
      }
      case 'blink': {
        this.stateT -= dt;
        if (this.stateT <= 0.9 && !this.dashHit) {
          // vanish now, reappear when the destination telegraph resolves
          this.dashHit = true;
          run.particles.burst(e.x, 3, e.z, 30, '#7b2cbf', 6, 0.3, 0.6);
          e.x = this.blinkTo.x; e.z = this.blinkTo.z;
        }
        if (this.stateT <= 0) this.toChase(1.5);
        break;
      }
      case 'wave': {
        this.stateT -= dt;
        if (this.stateT <= 0) this.toChase(1.8);
        break;
      }
      case 'summon': {
        this.stateT -= dt;
        if (this.stateT <= 0) {
          const n = 6 + Math.floor(this.tier * 2);
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            const sx = e.x + Math.cos(a) * (this.def.radius + 1.5), sz = e.z + Math.sin(a) * (this.def.radius + 1.5);
            run.enemies.spawn(i % 3 === 0 ? 'goblin' : 'slime', sx, sz, run, { summoned: true, hpMult: 0.8 });
            run.particles.burst(sx, 0.3, sz, 6, '#52b788', 4, 0.2, 0.5);
          }
          run.sfx('poison');
          this.toChase(2.4);
        }
        break;
      }
      case 'charge': {
        // windup handled by hazard telegraph; we wait then dash
        this.stateT -= dt;
        if (this.stateT <= 0) { this.state = 'dash'; this.dashHit = false; run.sfx('bossSlam'); }
        break;
      }
      case 'dash': {
        const sp = (this.id === 'stumpKing' ? 22 : 27) * (this.enraged ? 1.15 : 1);
        const step = Math.min(this.dashLeft, sp * dt);
        e.x += this.dashDir.x * step;
        e.z += this.dashDir.z * step;
        this.dashLeft -= step;
        if (Math.random() < 0.9) run.particles.burst(e.x, 0.3, e.z, 2, '#adb5bd', 4, 0.3, 0.5, 6);
        run.screen.shake(0.08);
        if (!this.dashHit && dist < this.def.radius + p.radius + 0.4) {
          if (run.damagePlayer(this.def.contactDamage * 1.6 * run.difficulty.damage, { x: e.x, z: e.z, label: this.def.name, major: true })) {
            this.dashHit = true;
            p.knockX += this.dashDir.x * 14; p.knockZ += this.dashDir.z * 14;
          }
        }
        const hitWall = run.world.resolve(e, this.def.radius * 0.9);
        if (this.dashLeft <= 0 || hitWall) {
          if (hitWall) { run.screen.shake(0.4); run.vfx.ring(e.x, e.z, 1, 5, '#ffd166', 0.4); run.sfx('bossSlam'); }
          this.toChase(1.6);
        }
        break;
      }
      case 'volley': {
        this.facing += angleDiff(this.facing, want) * Math.min(1, dt * 4);
        this.stateT -= dt;
        if (this.stateT <= 0) {
          this.volleyT -= dt;
          if (this.volleyT <= 0 && this.volleyLeft > 0) {
            this.volleyLeft--;
            this.volleyT = this.enraged ? 0.2 : 0.3;
            const n = this.enraged ? 11 : 7;
            const spread = this.enraged ? 1.6 : 1.1;
            const off = (this.volleyLeft % 2) * (spread / n / 2);
            for (let i = 0; i < n; i++) {
              const a = this.facing - spread / 2 + (i / (n - 1)) * spread + off;
              run.projectiles.enemyBolt(e.x + Math.cos(a) * 2, e.z + Math.sin(a) * 2, Math.cos(a), Math.sin(a), 11, 14 * run.difficulty.damage * this.tier ** 0.5, this.id === 'crystalColossus' ? 'crystal' : 'scrap', 0.35);
            }
            run.sfx('enemyShot');
          }
          if (this.volleyLeft <= 0) this.toChase(1.8);
        }
        break;
      }
    }

    // expanding resonance waves: jump through them with a dodge
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      w.r += w.speed * dt;
      if (!w.hit && Math.abs(dist - w.r) < 0.8 && p.alive) {
        if (run.damagePlayer(18 * run.difficulty.damage * Math.sqrt(this.tier), { x: e.x, z: e.z, label: 'Resonance Wave', major: true })) w.hit = true;
      }
      if (w.r > w.max) this.waves.splice(i, 1);
    }
    // body contact
    if (this.state !== 'dash' && dist < this.def.radius + p.radius + 0.2 && this.contactT <= 0) {
      if (run.damagePlayer(this.def.contactDamage * run.difficulty.damage, { x: e.x, z: e.z, label: this.def.name })) this.contactT = 1;
    }
    // shove regular enemies out of the way and stay in bounds
    run.enemies.grid.query(e.x, e.z, this.def.radius, (o) => {
      if (o === e) return;
      const ox = o.x - e.x, oz = o.z - e.z, d = Math.hypot(ox, oz) || 1;
      const min = this.def.radius + o.radius;
      if (d < min) { o.x = e.x + (ox / d) * min; o.z = e.z + (oz / d) * min; }
    });
    run.world.resolve(e, this.def.radius * 0.9);
    this.updateSpikes(dt);
  }

  private toChase(cd: number) {
    this.state = 'chase';
    this.cooldown = cd * (this.enraged ? 0.6 : 1) * (this.phase ? 0.85 : 1);
    const eye: Record<BossId, string> = { stumpKing: '#ffea00', scrapGolem: '#4cc9f0', voidDevourer: '#ff006e', goldenExecutioner: '#ffea00', crystalColossus: '#ff4ecd' };
    this.rig.eyeMat.color.set(this.enraged ? '#ff1e1e' : eye[this.id]);
  }

  private sweep(run: Run) {
    const e = this.entity;
    const p = run.player;
    const a = Math.atan2(p.z - e.z, p.x - e.x);
    this.facing = a;
    this.state = 'sweep';
    this.stateT = 1.05;
    const dmg = run.difficulty.damage * Math.sqrt(this.tier);
    run.hazards.add({ shape: 'sector', x: e.x, z: e.z, angle: a, r: 7.5, warn: 0.85, damage: 30 * dmg, major: true, label: 'Axe Sweep', color: '#ffb703', onTrigger: (rr) => {
      rr.vfx.arc(e.x, e.z, a, 7.5, '#ffd166');
      rr.screen.shake(0.3);
      rr.sfx('swing');
    } }, run);
  }

  private chooseAttack(run: Run, dist: number) {
    const options: BossState[] = {
      stumpKing: ['slam', 'roots', 'summon', 'charge'] as BossState[],
      scrapGolem: ['volley', 'charge', 'oil'] as BossState[],
      voidDevourer: (this.enraged ? ['wells', 'barrage', 'blink', 'pull', 'barrage'] : ['wells', 'barrage', 'blink', 'pull']) as BossState[],
      goldenExecutioner: (this.phase ? ['sweep', 'slam', 'charge', 'elites', 'judgment', 'judgment'] : ['sweep', 'slam', 'charge', 'elites', 'judgment']) as BossState[],
      crystalColossus: (this.phase ? ['volley', 'spikes', 'wave', 'spikes'] : ['volley', 'spikes', 'wave']) as BossState[],
    }[this.id];
    let pick: BossState;
    do { pick = options[Math.floor(Math.random() * options.length)]; } while (pick === this.last && options.length > 1);
    if (this.id === 'stumpKing' && dist < 6 && Math.random() < 0.6) pick = 'slam';
    if (this.id === 'goldenExecutioner' && dist < 6 && Math.random() < 0.5) pick = 'sweep';
    if (pick === 'summon' && run.enemies.aliveCount > run.enemies.cap * 0.8) pick = 'roots';
    if (pick === 'elites' && run.enemies.aliveCount > run.enemies.cap * 0.9) pick = 'slam';
    this.last = pick;
    this.state = pick;
    this.rig.eyeMat.color.set('#ff3b30');
    const e = this.entity;
    const p = run.player;
    const dmg = run.difficulty.damage * Math.sqrt(this.tier);
    switch (pick) {
      case 'slam': {
        const r = 7.5;
        this.stateT = 1.6;
        run.hazards.add({
          shape: 'circle', x: e.x, z: e.z, r, warn: 1.3, damage: 32 * dmg, major: true, label: 'Ground Slam',
          onTrigger: (rr) => {
            rr.vfx.ring(e.x, e.z, 1, r, '#ffd166', 0.5, 1);
            rr.particles.ring(e.x, e.z, r * 0.5, 30, '#7f5539', 7, 0.3);
            rr.screen.shake(0.6);
            rr.sfx('bossSlam');
          },
        }, run);
        break;
      }
      case 'roots': {
        const n = Math.round(6 + this.tier * 2);
        this.stateT = 1.8;
        for (let i = 0; i < n; i++) {
          const lead = i === 0 ? 0 : 0.6;
          const x = i < 2 ? p.x + p.vx * lead : p.x + rand(-7, 7);
          const z = i < 2 ? p.z + p.vz * lead : p.z + rand(-7, 7);
          const idx = i;
          run.hazards.add({
            shape: 'circle', x, z, r: 1.7, warn: 1.0 + i * 0.07, damage: 22 * dmg, major: true, label: 'Root Eruption', color: '#ff6b35',
            onTrigger: (rr) => { this.popSpike(idx, x, z); rr.particles.burst(x, 0.3, z, 8, '#6f4518', 5, 0.25, 0.5); rr.sfx('hit'); },
          }, run);
        }
        break;
      }
      case 'summon': {
        this.stateT = 1.1;
        run.announce('The Stump King calls his saplings!');
        break;
      }
      case 'charge': {
        const a = Math.atan2(p.z - e.z, p.x - e.x);
        this.facing = a;
        this.dashDir = { x: Math.cos(a), z: Math.sin(a) };
        const len = this.id === 'stumpKing' ? 16 : this.id === 'goldenExecutioner' ? 20 : 22;
        this.dashLeft = len;
        this.stateT = this.id === 'stumpKing' ? 1.1 : 1.0;
        run.hazards.add({ shape: 'rect', x: e.x, z: e.z, angle: a, length: len + this.def.radius, width: this.def.radius * 2.2, warn: this.stateT, damage: 0, label: 'Charge', color: '#ff9f1c' }, run);
        break;
      }
      case 'volley': {
        this.stateT = 0.8;
        this.volleyLeft = this.enraged ? 5 : 3;
        this.volleyT = 0;
        break;
      }
      case 'barrage': {
        this.volleyLeft = this.enraged ? 5 : 3;
        this.volleyT = 0.6;
        this.stateT = 3;
        run.particles.burst(e.x, 3, e.z, 20, '#c77dff', 4, 0.25, 0.6);
        break;
      }
      case 'wells': {
        this.stateT = 1.4;
        const n = this.enraged ? 4 : 3;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + Math.random();
          const x = p.x + Math.cos(a) * rand(3, 6), z = p.z + Math.sin(a) * rand(3, 6);
          run.hazards.add({ shape: 'circle', x, z, r: 5, warn: 1.2, damage: 0, linger: 3.5, lingerDamage: 0, pull: 3.2, label: 'Gravity Well', color: '#7b2cbf', lingerColor: '#3c096c' }, run);
          run.hazards.add({ shape: 'circle', x, z, r: 1.5, warn: 1.2, damage: 16 * dmg, major: true, linger: 3.5, lingerDamage: 8 * dmg, label: 'Singularity', color: '#ff006e', lingerColor: '#ff006e' }, run);
        }
        run.sfx('rift');
        break;
      }
      case 'blink': {
        const a = Math.random() * Math.PI * 2;
        const dest = { x: p.x + Math.cos(a) * 7, z: p.z + Math.sin(a) * 7 };
        run.world.resolve(dest, this.def.radius);
        this.blinkTo = dest;
        this.dashHit = false;
        this.stateT = 1.6;
        run.hazards.add({ shape: 'circle', x: dest.x, z: dest.z, r: 3.6, warn: 1.5, damage: 24 * dmg, major: true, label: 'Blink Strike', color: '#c77dff', onTrigger: (rr) => {
          rr.vfx.ring(dest.x, dest.z, 0.5, 4, '#c77dff', 0.5); rr.particles.burst(dest.x, 2, dest.z, 30, '#c77dff', 7, 0.3, 0.6); rr.screen.shake(0.35); rr.sfx('blink');
        } }, run);
        break;
      }
      case 'pull': {
        this.stateT = 2.6;
        run.announce('The Devourer inhales — run!');
        run.hazards.add({ shape: 'circle', x: e.x, z: e.z, r: 16, warn: 2.4, damage: 0, label: 'Event Pull', color: '#3c096c', pull: this.enraged ? 4.6 : 3.6 }, run);
        run.hazards.add({ shape: 'circle', x: e.x, z: e.z, r: 5.2, warn: 2.4, damage: 34 * dmg, major: true, label: 'Devour', color: '#ff006e', onTrigger: (rr) => {
          rr.vfx.ring(e.x, e.z, 1, 6, '#ff006e', 0.5); rr.screen.shake(0.5); rr.sfx('bossSlam');
        } }, run);
        run.sfx('bossRoar', this.def.roar / 80);
        break;
      }
      case 'sweep': {
        this.repeat = this.phase ? 1 : 0;
        this.sweep(run);
        break;
      }
      case 'elites': {
        this.stateT = 1.2;
        run.announce('The Executioner calls his champions!');
        for (let i = 0; i < 2; i++) {
          const a = this.facing + (i ? 1 : -1) * 1.2;
          run.enemies.spawn(i ? 'shieldKnight' : 'brute', e.x + Math.cos(a) * 4, e.z + Math.sin(a) * 4, run, { elite: true, summoned: true });
        }
        run.sfx('bossRoar', this.def.roar / 80);
        break;
      }
      case 'judgment': {
        this.stateT = 3.4;
        const safe: { x: number; z: number; r: number }[] = [];
        for (let i = 0; i < 3; i++) {
          const a = Math.random() * Math.PI * 2;
          const d = rand(4.5, 8);
          const s = { x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d, r: 2.6 };
          run.world.resolve(s, 2.6);
          safe.push(s);
        }
        run.announce('JUDGMENT! Stand in a green circle!', true);
        run.hazards.add({ shape: 'circle', x: p.x, z: p.z, r: 18, warn: 3.1, damage: 42 * dmg, major: true, safe, label: 'Judgment', color: '#ffb703', onTrigger: (rr) => {
          rr.screen.shake(0.6); rr.screen.flash('rgba(255,183,3,0.9)', 0.4); rr.sfx('bossSlam');
        } }, run);
        break;
      }
      case 'spikes': {
        this.stateT = 1.8;
        const n = this.phase ? 10 : 7;
        for (let i = 0; i < n; i++) {
          const x = i < 2 ? p.x + p.vx * 0.5 : p.x + rand(-7, 7), z = i < 2 ? p.z + p.vz * 0.5 : p.z + rand(-7, 7);
          const idx = i;
          run.hazards.add({ shape: 'circle', x, z, r: 1.8, warn: 1.15 + i * 0.05, damage: 22 * dmg, major: true, label: 'Crystal Spike', color: '#4cc9f0', onTrigger: (rr) => {
            this.popSpike(idx, x, z);
            rr.particles.burst(x, 0.5, z, 8, '#4cc9f0', 5, 0.2, 0.5);
            rr.sfx('shard');
            if (this.phase >= 2) for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + Math.random(); rr.projectiles.enemyBolt(x, z, Math.cos(a), Math.sin(a), 9, 10 * dmg, 'crystal', 0.3); }
          } }, run);
        }
        if (this.phase >= 1) {
          for (let k = 0; k < 4; k++) {
            const a = this.facing + (k / 4) * Math.PI * 2 + Math.PI / 4;
            run.hazards.add({ shape: 'rect', x: e.x, z: e.z, angle: a, length: 16, width: 1.8, warn: 1.4, damage: 20 * dmg, major: true, label: 'Spike Line', color: '#4cc9f0' }, run);
          }
        }
        break;
      }
      case 'wave': {
        this.stateT = 2.2;
        const count = this.phase >= 2 ? 4 : 3;
        for (let k = 0; k < count; k++) {
          run.schedule(0.5 + k * 0.55, () => {
            if (this.dead || this.state === 'dying') return;
            this.waves.push({ r: this.def.radius, max: 20, speed: 9, hit: false });
            run.vfx.ring(this.entity.x, this.entity.z, this.def.radius, 20, '#4cc9f0', 20 / 9, 1);
            run.sfx('phase', 1.4);
          });
        }
        run.announce('Resonance! Dodge through the waves.');
        break;
      }
      case 'oil': {
        this.stateT = 1.6;
        const n = this.enraged ? 7 : 5;
        for (let i = 0; i < n; i++) {
          const x = p.x + (i === 0 ? 0 : rand(-8, 8)), z = p.z + (i === 0 ? 0 : rand(-8, 8));
          run.particles.emit(e.x, 4, e.z, (x - e.x) * 1.0, 8, (z - e.z) * 1.0, 1.1, 0.4, '#212529', 14);
          run.hazards.add({ shape: 'circle', x, z, r: 2.6, warn: 1.2, damage: 18 * dmg, major: true, linger: 5, lingerDamage: 7 * dmg, label: 'Oil Fire', color: '#ff2e2e', onTrigger: (rr) => { rr.sfx('explode'); rr.vfx.ring(x, z, 0.5, 2.8, '#ff7b00', 0.4); } }, run);
        }
        break;
      }
    }
  }

  private popSpike(i: number, x: number, z: number) {
    const s = this.spikes[i % this.spikes.length];
    if (!s) return;
    s.position.set(x, -3, z);
    s.visible = true;
    this.spikeT[i % this.spikes.length] = 1.0;
  }

  private updateSpikes(dt: number) {
    for (let i = 0; i < this.spikes.length; i++) {
      if (this.spikeT[i] <= 0) continue;
      this.spikeT[i] -= dt;
      const t = this.spikeT[i];
      const s = this.spikes[i];
      s.position.y = t > 0.8 ? -3 + (1 - t) * 15 : t < 0.25 ? -3 * (1 - t / 0.25) : 0;
      if (t <= 0) s.visible = false;
    }
  }

  die(run: Run) {
    this.state = 'dying';
    this.stateT = 2.2;
    run.sfx('bossDie');
    run.screen.shake(0.8);
    run.screen.flash('#ffffff', 0.5);
    run.hazards.clear(run);
  }

  render(time: number, run: Run) {
    const e = this.entity;
    const r = this.rig;
    if (this.state === 'intro') return;
    if (this.state !== 'dying') {
      r.root.position.set(e.x, 0, e.z);
      let d = Math.PI / 2 - this.facing - r.root.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      r.root.rotation.y += d * 0.2;
    }
    this.shadow.position.set(e.x, 0.04, e.z);
    const a = this.anim;
    const walk = this.state === 'chase' ? 1 : 0;
    r.body.rotation.y = 0;
    r.body.position.y = Math.abs(Math.sin(a * 3)) * 0.15 * walk + (this.id === 'voidDevourer' ? 3 + Math.sin(a * 1.5) * 0.4 : 0);
    if (this.state === 'blink') { const vis = this.stateT > 0.9 ? Math.max(0.05, (this.stateT - 0.9) / 0.7) : Math.max(0.05, 1 - this.stateT / 0.9); r.root.scale.setScalar(vis); } else r.root.scale.setScalar(1);
    r.body.rotation.z = Math.sin(a * 3) * 0.05 * walk;
    r.armL.rotation.x = Math.sin(a * 3) * 0.3 * walk;
    r.armR.rotation.x = -Math.sin(a * 3) * 0.3 * walk;
    if (this.state === 'slam') {
      const t = this.stateT;
      const raise = t > 0.3 ? Math.min(1, (1.6 - t) / 1) : t / 0.3;
      r.armL.rotation.x = r.armR.rotation.x = -2.4 * raise;
      r.body.rotation.x = -0.2 * raise;
    } else if (this.state === 'sweep') {
      const t = Math.max(0, this.stateT / 1.05);
      r.armR.rotation.x = t > 0.2 ? -2.2 * (1 - (t - 0.2) / 0.85) : -2.2 + (0.2 - t) * 12;
      r.body.rotation.y = t < 0.2 ? (0.2 - t) * 6 : 0;
    } else if (this.state === 'summon' || this.state === 'roots' || this.state === 'oil' || this.state === 'wells' || this.state === 'spikes' || this.state === 'elites' || this.state === 'judgment' || this.state === 'pull' || this.state === 'barrage' || this.state === 'wave') {
      r.armL.rotation.z = -0.9 - Math.sin(time * 10) * 0.1;
      r.armR.rotation.z = 0.9 + Math.sin(time * 10) * 0.1;
    } else if (this.state === 'charge') {
      r.body.rotation.x = 0.35;
      r.root.position.x += Math.sin(time * 70) * 0.06;
    } else if (this.state === 'dash') {
      r.body.rotation.x = 0.45;
    } else {
      r.body.rotation.x *= 0.9;
      r.armL.rotation.z *= 0.85; r.armR.rotation.z *= 0.85;
    }
    if (r.spin) for (const s of r.spin) s.rotation.x += (this.enraged ? 0.35 : 0.12);
    const flash = e.flash;
    for (const m of r.materials) m.emissive.setRGB(flash * 0.8 + (this.enraged ? 0.25 + Math.sin(time * 8) * 0.1 : 0), flash * 0.8, flash * 0.8);
    if (this.enraged && Math.random() < 0.3) run.particles.emit(e.x + rand(-1, 1), 5.5, e.z + rand(-1, 1), 0, 3, 0, 0.8, 0.35, '#dee2e6', -3);
  }
}
