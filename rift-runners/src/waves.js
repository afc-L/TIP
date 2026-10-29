import { WAVES, WAVE_BREAK, MAX_ALIVE, ARENA_RADIUS, ENEMY_TYPES, endlessWave } from './config.js';
import { ARENAS } from './characters.js';

// Drives the run: intro banner -> spawning -> clear-up -> short break -> next wave.
// Campaign = 10 fixed waves (mid-boss on 5, Rift Guardian on 10). Endless = generated forever.
export class WaveDirector {
  constructor(game) {
    this.game = game;
    this.mode = 'campaign';
    this.endlessCache = new Map();
    this.reset();
  }

  reset(mode = this.mode) {
    this.mode = mode;
    this.endlessCache.clear();
    this.wave = 1;
    this.state = 'idle';
    this.timer = 0;
    this.spawned = 0;
    this.killed = 0;
    this.quota = 0;
    this.spawnAcc = 0;
    this.eliteQueue = [];
    this.breakT = 0;
    this.bossKind = null;
  }

  get endless() { return this.mode === 'endless'; }
  get total() { return this.endless ? '∞' : 10; }

  defFor(n) {
    if (!this.endless) return WAVES[n - 1] || { boss: 'guardian' };
    if (!this.endlessCache.has(n)) this.endlessCache.set(n, endlessWave(n));
    return this.endlessCache.get(n);
  }

  get def() { return this.defFor(this.wave); }
  get isBoss() { return !!this.def.boss; }
  get scalingWave() { return this.wave; }
  get endlessBonusMods() { return this.endless ? Math.min(0.35, Math.max(0, (this.wave - 8) * 0.02)) : 0; }
  get remaining() { return Math.max(0, this.quota - this.killed); }

  addQuota(n) { this.quota += n; this.spawned += n; }

  start(n) {
    const g = this.game;
    this.wave = n;
    this.timer = 0;
    this.spawned = 0;
    this.killed = 0;
    this.spawnAcc = 0;
    g.events.startWave(n);
    g.objectives.onWaveStart(n);
    g.onWaveStart(n);
    const d = this.def;
    if (d.boss) {
      this.state = 'boss';
      this.quota = 1;
      let kind = d.boss;
      if (kind === 'mid') kind = Math.random() < 0.5 ? 'devourer' : 'engineer';
      if (kind === 'random') kind = ['guardian', 'devourer', 'engineer'][Math.floor(Math.random() * 3)];
      this.bossKind = kind;
      const tier = d.tier || 1;
      const label = kind === 'guardian' ? 'The Rift Guardian awakens' : kind === 'devourer' ? 'The Devourer surfaces' : 'The Rift Engineer deploys';
      g.ui.announce(`WAVE ${n}`, label, '#ff6bd5');
      // Endless bosses beyond the first tier get extra hp scaling and new tricks via `tier`.
      g.startBoss(kind, tier, kind === 'guardian' && !this.endless ? 1 : this.endless ? 1 : 1);
      return;
    }
    this.state = 'active';
    const diff = g.diff;
    this.quota = Math.round(d.quota * (1 + (diff.spawnRate - 1) * 0.6));
    this.eliteQueue = (d.elites || []).map((e) => ({ ...e }));
    if (diff !== g.diffs.normal && n >= 6 && !this.endless) this.eliteQueue.push({ type: this.pickType(d.mix), at: 0.6 });
    g.ui.announce(`WAVE ${n}`, this.flavor(n), '#b98cff');
    g.sound.play('waveStart');
  }

  flavor(n) {
    if (this.endless) return n % 5 === 0 ? 'A champion approaches' : n % 3 === 1 ? 'The rift shifts — new foes' : 'The rift grows hungrier';
    return ['Survive the rift', 'Splitters break apart when slain', 'Stalkers mark where they will strike', 'Watch the ground for falling shells', '',
      'A Warlord approaches', 'Strike Mirror Knights from behind', 'The Matriarch hungers', 'Final stand before the Guardian'][n - 1] || '';
  }

  onKill(e) {
    if (e.counts && e.waveTag === this.wave && this.state !== 'boss') this.killed++;
  }

  // Weighted pick from the wave mix, biased by the current arena's theme.
  pickType(mix) {
    const bias = ARENAS[this.game.run.arena]?.bias || {};
    let total = 0;
    for (const [t, w] of Object.entries(mix)) total += w * (bias[t] || 1);
    let r = Math.random() * total, last = 'crawler';
    for (const [type, w] of Object.entries(mix)) { last = type; r -= w * (bias[type] || 1); if (r <= 0) return type; }
    return last;
  }

  spawnPoint(minDist = 15) {
    const g = this.game, pl = g.player;
    const lim = g.safeRadius() - 2;
    for (let i = 0; i < 25; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 17 + Math.random() * 10;
      let x = pl.x + Math.cos(a) * d, z = pl.z + Math.sin(a) * d;
      const r = Math.hypot(x, z);
      if (r > lim) { x *= lim / r; z *= lim / r; }
      if (Math.hypot(x - pl.x, z - pl.z) < minDist) continue;
      if (g.world.insideObstacle(x, z, 1.2)) continue;
      return [x, z];
    }
    const a = Math.atan2(-pl.z, -pl.x);
    return [Math.cos(a) * (ARENA_RADIUS - 4), Math.sin(a) * (ARENA_RADIUS - 4)];
  }

  update(dt) {
    const g = this.game;
    if (this.state === 'idle' || this.state === 'boss') return;

    if (this.state === 'break') {
      this.breakT -= dt;
      if (this.breakT <= 0) this.start(this.wave + 1);
      return;
    }

    this.timer += dt;
    const d = this.def;
    if (this.state === 'active') {
      const rate = this.quota / (d.duration * 0.85 / g.diff.spawnRate);
      this.spawnAcc += rate * dt;
      const eliteChance = this.wave >= 3 ? g.diff.eliteChance + (this.endless ? this.wave * 0.003 : 0) : 0;
      while (this.spawnAcc >= 1 && this.spawned < this.quota) {
        if (g.enemies.aliveCount >= MAX_ALIVE) { this.spawnAcc = Math.min(this.spawnAcc, 3); break; }
        const cluster = Math.min(Math.floor(this.spawnAcc), 1 + Math.floor(Math.random() * 3), this.quota - this.spawned);
        const [x, z] = this.spawnPoint();
        for (let i = 0; i < cluster; i++) {
          const a = Math.random() * Math.PI * 2;
          const type = this.pickType(d.mix);
          g.enemies.spawn(type, x + Math.cos(a) * i * 1.3, z + Math.sin(a) * i * 1.3, { elite: Math.random() < eliteChance && type !== 'crawler' });
        }
        this.spawned += cluster;
        this.spawnAcc -= cluster;
      }
      for (let i = this.eliteQueue.length - 1; i >= 0; i--) {
        const el = this.eliteQueue[i];
        if (this.timer >= d.duration * el.at) {
          const [x, z] = this.spawnPoint(18);
          g.enemies.spawn(el.type, x, z, { elite: !el.miniboss, miniboss: !!el.miniboss, name: el.name });
          this.addQuota(1);
          g.sound.play('spawnElite');
          if (el.miniboss) g.ui.announce(el.name.toUpperCase(), 'Miniboss', '#ffb547');
          else g.ui.toast(`Elite ${ENEMY_TYPES[el.type].name} has appeared!`, '#ffcc4a');
          this.eliteQueue.splice(i, 1);
        }
      }
      if (this.spawned >= this.quota && this.eliteQueue.length === 0) this.state = 'clearing';
    }

    if (this.state === 'clearing') {
      // Safety valve: stragglers far away are pulled back into the fight.
      if (this.timer > d.duration + 18) {
        for (const e of g.enemies.list) {
          if (e.type === 'boss' || e.dead || e.def.device) continue;
          if (Math.hypot(e.x - g.player.x, e.z - g.player.z) > 24) {
            const [x, z] = this.spawnPoint(12);
            e.x = x; e.z = z;
          }
        }
        this.timer = d.duration + 8;
      }
      if (this.killed >= this.quota) this.complete();
    }
  }

  // Called by the game when a boss wave's boss dies (and the run continues).
  bossDefeated() {
    if (this.state === 'boss') this.complete();
  }

  complete() {
    const g = this.game;
    this.state = 'break';
    this.breakT = WAVE_BREAK;
    g.events.endWave();
    g.onWaveCleared(this.wave);
    g.events.planFor(this.wave + 1);
  }

  // Next wave's enemy line-up for the HUD preview.
  preview() {
    const n = this.wave + 1;
    if (!this.endless && n > 10) return null;
    const d = this.defFor(n);
    if (d.boss) return { boss: true, types: [], event: null };
    const types = Object.entries(d.mix).sort((a, b) => b[1] - a[1]).map(([t]) => t);
    const ev = this.game.events.planned && this.game.events.planned.wave === n ? this.game.events.planned.id : null;
    return { boss: false, types, elites: (d.elites || []).length, event: ev };
  }
}
