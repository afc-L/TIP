// The run director: decides what spawns, where and when, based on the (scaled) timeline.
import type { BossId, EnemyKind } from '../data/types';
import { CONFIG, DIRECTOR_EVENTS, DIRECTOR_PHASES, GUARANTEED_ELITE, type DirectorPhase } from './GameConfig';
import type { Run } from './Run';
import { rand, randInt, weightedIndex } from './util';

const KINDS: EnemyKind[] = ['slime', 'bigSlime', 'goblin', 'brute', 'shaman', 'exploder', 'swarmBug', 'bombardier', 'stalker', 'shieldKnight', 'healer', 'phantom', 'burrower', 'beetle', 'archer'];
const ENDLESS_ORDER: BossId[] = ['stumpKing', 'crystalColossus', 'goldenExecutioner', 'scrapGolem', 'voidDevourer'];

export class SpawnDirector {
  private spawnT = 1.5;
  private phaseIndex = -1;
  private eventIndex = 0;
  private nextElite = GUARANTEED_ELITE.start;
  private bossIndex = 0;
  private nextEndlessBoss = 0;
  bossesSpawned = 0;
  private campsDone = false;

  constructor(private run: Run) {}

  phase(t: number): DirectorPhase {
    let p = DIRECTOR_PHASES[0];
    for (const ph of DIRECTOR_PHASES) if (t >= ph.at) p = ph;
    return p;
  }

  private bossTime(i: number) { return this.run.map.bossTimes[i] * this.run.rm.bossTime; }

  /** HUD objective text. */
  objective(): string {
    const run = this.run;
    if (run.boss) return `Defeat ${run.boss.def.name}${run.boss.final && run.mode !== 'endless' ? ' to win' : ''}`;
    const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.ceil(s) % 60)).padStart(2, '0')}`;
    if (this.bossIndex < 2) {
      const left = Math.max(0, (this.bossTime(this.bossIndex) - run.timeline) / run.timelineScale);
      const id = run.map.bosses[this.bossIndex];
      const name = id.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
      return `The ${name} arrives in ${fmt(left)}`;
    }
    if (run.mode === 'endless') return `Endless · next boss in ${fmt(Math.max(0, (this.nextEndlessBoss - run.timeline) / run.timelineScale))}`;
    return 'Survive!';
  }

  /** A walkable point on the spawn ring around the player. */
  ringPoint(angle: number, minD = CONFIG.enemies.spawnMinDist, maxD = CONFIG.enemies.spawnMaxDist): { x: number; z: number } {
    const r = this.run;
    const p = r.player;
    for (let tries = 0; tries < 8; tries++) {
      const a = angle + (tries ? rand(-1.2, 1.2) * tries : 0);
      const d = rand(minD, maxD);
      let x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      const lim = r.world.radius - 1.5;
      const l = Math.hypot(x, z);
      if (l > lim) {
        if (tries < 7) continue;
        x *= lim / l; z *= lim / l;
      }
      if (!r.world.blocked(x, z, 1)) return { x, z };
    }
    const a = Math.atan2(-p.z, -p.x);
    return { x: p.x + Math.cos(a) * minD, z: p.z + Math.sin(a) * minD };
  }

  update(dt: number) {
    const run = this.run;
    const t = run.timeline;
    const ph = this.phase(t);
    const idx = DIRECTOR_PHASES.indexOf(ph);
    if (idx !== this.phaseIndex) {
      this.phaseIndex = idx;
      if (ph.announce) run.announce(ph.announce);
    }
    if (!this.campsDone) { this.campsDone = true; this.eliteCamps(); }

    // scripted events
    while (this.eventIndex < DIRECTOR_EVENTS.length && t >= DIRECTOR_EVENTS[this.eventIndex].at) {
      const ev = DIRECTOR_EVENTS[this.eventIndex++];
      if (run.boss && ev.type !== 'swarm') continue; // don't stack big events on top of boss fights
      run.announce(ev.announce, ev.type === 'ogre');
      this.event(ev.type);
    }

    // bosses: two per map, the second one is the final boss (endless keeps going)
    if (!run.boss) {
      if (this.bossIndex < 2 && t >= this.bossTime(this.bossIndex)) {
        run.startBoss(run.map.bosses[this.bossIndex], 1, this.bossIndex === 1);
        this.bossIndex++;
        this.bossesSpawned++;
        if (this.bossIndex >= 2) this.nextEndlessBoss = t + CONFIG.endlessBossInterval * run.rm.bossTime;
      } else if (run.mode === 'endless' && this.bossIndex >= 2 && t >= this.nextEndlessBoss) {
        const id = ENDLESS_ORDER[this.bossesSpawned % ENDLESS_ORDER.length];
        const tier = 1 + Math.floor(this.bossesSpawned / 2) * 0.8 + (t / 60) * 0.06;
        run.startBoss(id, tier, false);
        this.bossesSpawned++;
        this.nextEndlessBoss = t + CONFIG.endlessBossInterval * run.rm.bossTime;
      }
    }

    // guaranteed elites (they drop chests)
    if (t >= this.nextElite) {
      this.nextElite += GUARANTEED_ELITE.every / Math.sqrt(run.rm.elite);
      if (!run.boss) this.spawnOne(this.pickKind(ph, true), true, true);
    }

    // regular spawning
    const extra = t > 900 ? (t - 900) / 60 : 0; // endless escalation
    const rate = run.map.spawnRateMult * run.difficulty.spawn * run.rm.spawn * (1 + extra * 0.12);
    const interval = ph.interval / rate;
    const maxEnemies = Math.min(run.enemies.cap, Math.round(ph.maxEnemies * (1 + extra * 0.1) * Math.min(1.4, run.map.spawnRateMult * Math.sqrt(run.rm.spawn))));
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = interval * rand(0.8, 1.2);
      const alive = run.enemies.aliveCount;
      if (alive < maxEnemies) {
        // fill faster when the field is empty; slow down near the cap
        const fill = 1 - alive / maxEnemies;
        const n = Math.max(1, Math.round(randInt(ph.group[0], ph.group[1]) * (0.6 + fill * 0.8) * (1 + extra * 0.15)));
        const base = Math.random() * Math.PI * 2;
        const cluster = Math.random() < 0.5;
        for (let i = 0; i < n; i++) {
          const elite = Math.random() < ph.eliteChance * run.map.eliteChanceMult * run.rm.elite;
          const kind = this.pickKind(ph, elite);
          const a = cluster ? base + rand(-0.35, 0.35) : Math.random() * Math.PI * 2;
          this.spawnAt(kind, a, elite);
          if (kind === 'swarmBug' && !elite) for (let k = 0; k < 4; k++) this.spawnAt('swarmBug', a + rand(-0.2, 0.2));
        }
      }
    }
  }

  private pickKind(ph: DirectorPhase, elite: boolean): EnemyKind {
    const mw = this.run.map.enemyWeights;
    const weights = KINDS.map((k) => (ph.weights[k] ?? 0) * (mw[k] ?? 1) * (elite && (k === 'slime' || k === 'swarmBug') ? 0.3 : 1));
    const i = weightedIndex(weights);
    return i < 0 ? 'slime' : KINDS[i];
  }

  private spawnAt(kind: EnemyKind, angle: number, elite = false, chest = false) {
    const pos = this.ringPoint(angle);
    this.run.enemies.spawn(kind, pos.x, pos.z, this.run, { elite, chest });
  }

  spawnOne(kind: EnemyKind, elite: boolean, chest = false) {
    this.spawnAt(kind, Math.random() * Math.PI * 2, elite, chest);
  }

  /** Optional elite encounter areas: dormant elites guarding a chest. */
  private eliteCamps() {
    const run = this.run;
    for (let c = 0; c < 2; c++) {
      const p = run.world.openPoint(22, run.world.radius - 6, 3);
      run.pickups.addCamp(p.x, p.z);
      const kinds: EnemyKind[] = ['brute', 'goblin', 'shaman'];
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        run.enemies.spawn(kinds[i], p.x + Math.cos(a) * 2.5, p.z + Math.sin(a) * 2.5, run, { elite: true, dormant: true, chest: i === 0, hpMult: 0.7 });
      }
    }
  }

  private event(type: 'ring' | 'rush' | 'elites' | 'swarm' | 'ogre') {
    const run = this.run;
    const p = run.player;
    if (type === 'ring') {
      const n = 36;
      const kind: EnemyKind = run.timeline > 400 ? 'goblin' : 'slime';
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const x = p.x + Math.cos(a) * 15, z = p.z + Math.sin(a) * 15;
        if (x * x + z * z > (run.world.radius - 1) ** 2 || run.world.blocked(x, z, 0.6)) continue;
        run.enemies.spawn(kind, x, z, run);
      }
    } else if (type === 'rush') {
      const base = Math.random() * Math.PI * 2;
      for (let i = 0; i < 26; i++) this.spawnAt('goblin', base + rand(-0.25, 0.25));
    } else if (type === 'swarm') {
      const base = Math.random() * Math.PI * 2;
      for (let i = 0; i < 40; i++) this.spawnAt('swarmBug', base + rand(-0.5, 0.5));
    } else if (type === 'ogre') {
      const n = run.timeline > 900 ? 2 : 1;
      for (let i = 0; i < n; i++) this.spawnAt('ogre', Math.random() * Math.PI * 2, false, true);
    } else {
      const kinds: EnemyKind[] = ['brute', 'goblin', 'shaman', 'beetle'];
      for (let i = 0; i < 4; i++) this.spawnAt(kinds[i], Math.random() * Math.PI * 2, true, i === 0);
    }
  }
}
