// The run director: decides what spawns, where and when, based on the (scaled) timeline.
import type { BossId, EnemyKind } from '../data/types';
import { CONFIG, DIRECTOR_EVENTS, DIRECTOR_PHASES, GUARANTEED_ELITE, type DirectorPhase } from './GameConfig';
import type { Run } from './Run';
import { rand, randInt, weightedIndex } from './util';

const KINDS: EnemyKind[] = ['slime', 'bigSlime', 'goblin', 'brute', 'shaman', 'exploder'];

export class SpawnDirector {
  private spawnT = 1.5;
  private phaseIndex = -1;
  private eventIndex = 0;
  private nextElite = GUARANTEED_ELITE.start;
  private bossIndex = 0;
  private nextEndlessBoss = 0;
  bossesSpawned = 0;

  phase(t: number): DirectorPhase {
    let p = DIRECTOR_PHASES[0];
    for (const ph of DIRECTOR_PHASES) if (t >= ph.at) p = ph;
    return p;
  }

  /** A walkable point on the spawn ring around the player. */
  ringPoint(angle: number, minD = CONFIG.enemies.spawnMinDist, maxD = CONFIG.enemies.spawnMaxDist, run?: Run): { x: number; z: number } {
    const r = run ?? this.run;
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
    // fallback: toward the arena centre
    const a = Math.atan2(-p.z, -p.x);
    return { x: p.x + Math.cos(a) * minD, z: p.z + Math.sin(a) * minD };
  }

  constructor(private run: Run) {}

  /** HUD objective text. */
  objective(): string {
    const run = this.run;
    if (run.boss) return `Defeat ${run.boss.def.name}`;
    const bosses = CONFIG.bosses;
    if (this.bossIndex < bosses.length) {
      const left = (bosses[this.bossIndex].at - run.timeline) / run.timelineScale;
      const name = bosses[this.bossIndex].id === 'stumpKing' ? 'The Stump King' : 'The Scrap Golem';
      const s = Math.max(0, Math.ceil(left));
      return `${name} arrives in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }
    if (run.mode === 'endless') {
      const s = Math.max(0, Math.ceil((this.nextEndlessBoss - run.timeline) / run.timelineScale));
      return `Endless · next boss in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }
    return 'Survive!';
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

    // scripted events
    while (this.eventIndex < DIRECTOR_EVENTS.length && t >= DIRECTOR_EVENTS[this.eventIndex].at) {
      const ev = DIRECTOR_EVENTS[this.eventIndex++];
      if (run.boss) continue; // don't stack events on top of boss fights
      run.announce(ev.announce);
      this.event(ev.type);
    }

    // bosses
    const bosses = CONFIG.bosses;
    if (!run.boss) {
      if (this.bossIndex < bosses.length && t >= bosses[this.bossIndex].at) {
        run.startBoss(bosses[this.bossIndex].id, 1);
        this.bossIndex++;
        this.bossesSpawned++;
        if (this.bossIndex >= bosses.length) this.nextEndlessBoss = t + CONFIG.endlessBossInterval;
      } else if (run.mode === 'endless' && this.bossIndex >= bosses.length && t >= this.nextEndlessBoss) {
        const id: BossId = this.bossesSpawned % 2 === 0 ? 'stumpKing' : 'scrapGolem';
        const tier = 1 + Math.floor(this.bossesSpawned / 2) * 0.8 + (t / 60) * 0.06;
        run.startBoss(id, tier);
        this.bossesSpawned++;
        this.nextEndlessBoss = t + CONFIG.endlessBossInterval;
      }
    }

    // guaranteed elites (they drop chests)
    if (t >= this.nextElite) {
      this.nextElite += GUARANTEED_ELITE.every;
      if (!run.boss) this.spawnOne(this.pickKind(ph, true), true, true);
    }

    // regular spawning
    const extra = t > 900 ? (t - 900) / 60 : 0; // endless escalation
    const interval = ph.interval / (run.map.spawnRateMult * run.difficulty.spawn * (1 + extra * 0.12));
    const maxEnemies = Math.min(run.enemies.cap, Math.round(ph.maxEnemies * (1 + extra * 0.1) * Math.min(1.3, run.map.spawnRateMult)));
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
          const elite = Math.random() < ph.eliteChance * run.map.eliteChanceMult;
          const kind = this.pickKind(ph, elite);
          const a = cluster ? base + rand(-0.35, 0.35) : Math.random() * Math.PI * 2;
          this.spawnAt(kind, a, elite);
        }
      }
    }
  }

  private pickKind(ph: DirectorPhase, elite: boolean): EnemyKind {
    const mw = this.run.map.enemyWeights;
    const weights = KINDS.map((k) => (ph.weights[k] ?? 0) * (mw[k] ?? 1) * (elite && (k === 'slime') ? 0.4 : 1));
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

  private event(type: 'ring' | 'rush' | 'elites') {
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
    } else {
      const kinds: EnemyKind[] = ['brute', 'goblin', 'shaman', 'bigSlime'];
      for (let i = 0; i < 4; i++) this.spawnAt(kinds[i], Math.random() * Math.PI * 2, true, i === 0);
    }
  }
}
