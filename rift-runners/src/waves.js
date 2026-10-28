import { WAVES, WAVE_BREAK, MAX_ALIVE, ARENA_RADIUS } from './config.js';

// Drives the 10-wave run: intro banner -> spawning -> clear-up -> short break -> next wave.
export class WaveDirector {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.wave = 1;
    this.state = 'idle';
    this.timer = 0;
    this.spawned = 0;
    this.killed = 0;
    this.quota = 0;
    this.spawnAcc = 0;
    this.eliteQueue = [];
    this.breakT = 0;
  }

  get def() { return WAVES[this.wave - 1]; }
  get isBoss() { return !!this.def.boss; }
  get remaining() { return Math.max(0, this.quota - this.killed); }

  start(n) {
    const g = this.game;
    this.wave = n;
    this.timer = 0;
    this.spawned = 0;
    this.killed = 0;
    this.spawnAcc = 0;
    const d = this.def;
    if (d.boss) {
      this.state = 'boss';
      this.quota = 1;
      g.ui.announce('WAVE 10', 'The Rift Guardian awakens', '#ff6bd5');
      g.boss.spawn();
      return;
    }
    this.state = 'active';
    this.quota = d.quota;
    this.eliteQueue = (d.elites || []).map((e) => ({ ...e }));
    g.ui.announce(`WAVE ${n}`, n === 1 ? 'Survive the rift' : this.flavor(n), '#b98cff');
    g.sound.play('waveStart');
  }

  flavor(n) {
    return ['', '', 'Dashers sharpen their claws', 'Something elite stirs', 'Spitters emerge from the dark', 'The ground trembles',
      'A Warlord approaches', 'The swarm grows restless', 'The Matriarch hungers', 'Final stand before the Guardian'][n - 1] || '';
  }

  onKill(e) {
    if (e.counts && e.waveTag === this.wave && this.state !== 'boss') this.killed++;
  }

  pickType(mix) {
    let r = Math.random(), last = 'crawler';
    for (const [type, w] of Object.entries(mix)) { last = type; r -= w; if (r <= 0) return type; }
    return last;
  }

  spawnPoint(minDist = 15) {
    const g = this.game, pl = g.player;
    for (let i = 0; i < 25; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 17 + Math.random() * 10;
      let x = pl.x + Math.cos(a) * d, z = pl.z + Math.sin(a) * d;
      const r = Math.hypot(x, z);
      if (r > ARENA_RADIUS - 2) { x *= (ARENA_RADIUS - 2) / r; z *= (ARENA_RADIUS - 2) / r; }
      if (Math.hypot(x - pl.x, z - pl.z) < minDist) continue;
      if (g.world.insideObstacle(x, z, 1.2)) continue;
      return [x, z];
    }
    // Fallback: opposite side of the arena from the player.
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
      // Spread spawns over ~85% of the wave duration, in small clusters.
      const rate = this.quota / (d.duration * 0.85);
      this.spawnAcc += rate * dt;
      while (this.spawnAcc >= 1 && this.spawned < this.quota) {
        if (g.enemies.aliveCount >= MAX_ALIVE) { this.spawnAcc = Math.min(this.spawnAcc, 3); break; }
        const cluster = Math.min(Math.floor(this.spawnAcc), 1 + Math.floor(Math.random() * 3), this.quota - this.spawned);
        const [x, z] = this.spawnPoint();
        for (let i = 0; i < cluster; i++) {
          const a = Math.random() * Math.PI * 2;
          g.enemies.spawn(this.pickType(d.mix), x + Math.cos(a) * i * 1.3, z + Math.sin(a) * i * 1.3);
        }
        this.spawned += cluster;
        this.spawnAcc -= cluster;
      }
      for (let i = this.eliteQueue.length - 1; i >= 0; i--) {
        const el = this.eliteQueue[i];
        if (this.timer >= d.duration * el.at) {
          const [x, z] = this.spawnPoint(18);
          g.enemies.spawn(el.type, x, z, { elite: !el.miniboss, miniboss: !!el.miniboss, name: el.name });
          this.quota++;
          this.spawned++;
          g.sound.play('spawnElite');
          if (el.miniboss) g.ui.announce(el.name.toUpperCase(), 'Miniboss', '#ffb547');
          else g.ui.toast(`Elite ${el.type[0].toUpperCase() + el.type.slice(1)} has appeared!`, '#ffcc4a');
          this.eliteQueue.splice(i, 1);
        }
      }
      if (this.spawned >= this.quota && this.eliteQueue.length === 0) this.state = 'clearing';
    }

    if (this.state === 'clearing') {
      // Safety valve: stragglers far away are pulled back into the fight.
      if (this.timer > d.duration + 18) {
        for (const e of g.enemies.list) {
          if (e.type === 'boss' || e.dead) continue;
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

  complete() {
    const g = this.game;
    this.state = 'break';
    this.breakT = WAVE_BREAK;
    g.onWaveCleared(this.wave);
  }
}
