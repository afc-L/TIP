import { WEAPONS } from './config.js';

// Optional run objectives. Two are rolled per run; progress shows in the HUD.
export const OBJECTIVES = {
  untouched: { name: 'Untouchable', target: 30, reward: 60, desc: () => 'Defeat 30 enemies in a row without taking damage.' },
  elites:    { name: 'Elite Slayer', target: 3, reward: 50, desc: () => 'Defeat 3 elite enemies.' },
  noshop:    { name: 'Self-Reliant', target: 1, reward: 40, campaignOnly: false, desc: () => 'Reach wave 5 without buying anything at a Supply Rift.' },
  bosstime:  { name: 'Executioner', target: 1, reward: 70, cosmetic: ['cloaks', 'shadow'], desc: () => 'Defeat a boss within 100 seconds of it appearing.' },
  crystals:  { name: 'Hoarder', target: 300, reward: 50, desc: () => 'Collect 300 XP crystals.' },
  weapon:    { name: 'Specialist', target: 1, reward: 90, cosmetic: ['trails', 'void'], campaignOnly: true, desc: (o) => `Win the run with ${WEAPONS[o.param].name} equipped.` },
  relics:    { name: 'Collector', target: 3, reward: 50, desc: () => 'Hold 3 relics at the same time.' },
  nodash:    { name: 'Grounded', target: 1, reward: 50, desc: () => 'Clear wave 3 without dashing.' },
  shrine:    { name: 'Pilgrim', target: 2, reward: 50, desc: () => 'Accept 2 shrine bargains.' },
};

export function rollObjectives(endless, startWeapon) {
  const ids = Object.keys(OBJECTIVES).filter((id) => !(endless && OBJECTIVES[id].campaignOnly));
  const out = [];
  while (out.length < 2) {
    const id = ids[Math.floor(Math.random() * ids.length)];
    if (out.some((o) => o.id === id)) continue;
    const def = OBJECTIVES[id];
    const o = { id, progress: 0, target: def.target, done: false, failed: false, reward: def.reward };
    if (id === 'weapon') {
      const choices = Object.keys(WEAPONS).filter((w) => w !== startWeapon);
      o.param = choices[Math.floor(Math.random() * choices.length)];
    }
    o.text = def.desc(o);
    o.name = def.name;
    out.push(o);
  }
  return out;
}

// Small helper the game calls on events; returns objectives that just completed.
export class ObjectiveTracker {
  constructor(game) { this.game = game; this.list = []; }

  start(endless, startWeapon) { this.list = rollObjectives(endless, startWeapon); }

  complete(o) {
    if (o.done || o.failed) return;
    o.done = true;
    o.progress = o.target;
    this.game.onObjectiveComplete(o);
  }

  fail(o) { if (!o.done) o.failed = true; }

  each(id, fn) { for (const o of this.list) if (o.id === id && !o.done && !o.failed) fn(o); }

  // --- hooks ---
  onKill(e) {
    this.each('untouched', (o) => { o.progress++; if (o.progress >= o.target) this.complete(o); });
    if (e.elite || e.miniboss) this.each('elites', (o) => { o.progress++; if (o.progress >= o.target) this.complete(o); });
  }
  onHurt() { this.each('untouched', (o) => { o.progress = 0; }); }
  onCrystal() { this.each('crystals', (o) => { o.progress++; if (o.progress >= o.target) this.complete(o); }); }
  onPurchase() { this.each('noshop', (o) => this.fail(o)); }
  onWaveStart(n) { if (n >= 5) this.each('noshop', (o) => this.complete(o)); }
  onWaveCleared(n) { if (n >= 3) this.each('nodash', (o) => this.complete(o)); }
  onDash() { this.each('nodash', (o) => this.fail(o)); }
  onBossKilled(seconds) { if (seconds <= 100) this.each('bosstime', (o) => this.complete(o)); }
  onRelics(n) { this.each('relics', (o) => { o.progress = Math.max(o.progress, n); if (n >= o.target) this.complete(o); }); }
  onShrine() { this.each('shrine', (o) => { o.progress++; if (o.progress >= o.target) this.complete(o); }); }
  onVictory(levels) { this.each('weapon', (o) => { if (levels[o.param] > 0) this.complete(o); else this.fail(o); }); }
}
