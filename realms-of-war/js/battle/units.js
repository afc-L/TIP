// Battle units: a regiment of individual soldiers kept in formation around a moving centre.
(function () {
  const RW = window.RW;
  const U = RW.util;

  const FORMATIONS = {
    line: { name: 'Line', rankMul: 1, spacing: 1, def: 0, morale: 0, speed: 1, missile: 1, chargeTaken: 1,
      desc: 'Standard formation. A wide front for maximum fighting men.' },
    defensive: { name: 'Defensive', rankMul: 1.8, spacing: 0.85, def: 10, morale: 8, speed: 0.72, missile: 0.9, chargeTaken: 0.45,
      desc: 'Tight, deep block. +10 defence, +8 morale, blunts charges from the front. Slower.' },
    loose: { name: 'Loose', rankMul: 0.6, spacing: 1.75, def: -6, morale: -4, speed: 1.05, missile: 0.55, chargeTaken: 1.2,
      desc: 'Spread out. Missiles hit 45% less often, but -6 defence in melee.' },
  };

  function baseSpacing(t) {
    if (t.model.kind === 'beast') return { troll: 3.4, golem: 3.8, behemoth: 6 }[t.model.type] || 4;
    if (t.model.kind === 'siege') return 8;
    if (t.model.kind === 'mounted') return 2.3;
    if (t.cat === 'ranged') return 1.45;
    return t.cat === 'general' ? 1.6 : 1.3;
  }
  function baseRanks(t) {
    if (t.cat === 'inf') return 4;
    if (t.cat === 'ranged') return 3;
    if (t.cat === 'cav' || t.cat === 'general') return 2;
    return 1;
  }

  // Apply campaign upgrades, commander traits and veterancy to base stats.
  function computeStats(typeId, mods) {
    const b = RW.data.UNITS[typeId];
    const t = Object.assign({}, b);
    const rank = mods.rank || 0;
    t.atk += rank * 3; t.def += rank * 3; t.morale += rank * 5;
    for (const up of mods.upgrades || []) {
      const a = up.apply;
      if (!a.cats) continue;
      if (!(a.cats.includes('all') || a.cats.includes(t.cat))) continue;
      for (const k of ['atk', 'def', 'armor', 'charge', 'morale', 'range', 'rdmg', 'ammo']) if (a[k] && (k !== 'range' && k !== 'rdmg' && k !== 'ammo' || t.range)) t[k] += a[k];
      if (a.dmgMul) t.dmg *= a.dmgMul;
      if (a.hpMul) t.hp *= a.hpMul;
      if (a.speedMul) t.speed *= a.speedMul;
      if (a.rdmgMul && t.range) t.rdmg *= a.rdmgMul;
    }
    switch (mods.trait) {
      case 'shieldwall': if (t.cat === 'inf') { t.def += 8; t.armor += 10; } break;
      case 'outrider': if (t.cat === 'cav') { t.speed *= 1.15; t.charge += 12; } break;
      case 'inspiring': t.morale += 12; break;
      case 'bloodthirsty': t.dmg *= 1.12; break;
      case 'eagleeye': if (t.range && t.cat !== 'siege') { t.rdmg *= 1.15; t.range *= 1.1; } break;
      case 'siegebreaker': if (t.cat === 'siege') t.rdmg *= 1.3; break;
      case 'beastmaster': if (t.cat === 'monster') { t.hp *= 1.2; t.atk += 10; } break;
    }
    // Army-wide modifiers: legendary passives, equipment, skills, doctrine, technology, landmarks.
    const A = mods.army || {};
    const inf = t.cat === 'inf', cav = t.cat === 'cav' || (t.cat === 'general' && t.model.kind === 'mounted'), mon = t.cat === 'monster', gen = t.cat === 'general';
    if (A.morale) t.morale += A.morale;
    if (A.dmgMul) t.dmg *= A.dmgMul;
    if (A.infDmg && inf) t.dmg *= A.infDmg;
    if (A.rdmgMul && t.range) t.rdmg *= A.rdmgMul;
    if (A.rangeMul && t.range && t.cat !== 'siege') t.range *= A.rangeMul;
    if (A.speedAll) t.speed *= A.speedAll;
    if (A.defAll) t.def += A.defAll;
    if (inf) { t.def += A.infDef || 0; t.armor += A.infArmor || 0; t.atk += A.infAtk || 0; }
    if (cav) { t.charge += A.cavCharge || 0; t.atk += A.cavAtk || 0; if (A.cavSpeed) t.speed *= A.cavSpeed; }
    if ((cav || t.fly) && A.scoutSpeed) t.speed *= A.scoutSpeed;
    if (mon) { if (A.monHp) t.hp *= A.monHp; t.armor += A.monArmor || 0; }
    if (gen) {
      t.atk += A.genAtk || 0; t.def += A.genDef || 0; t.armor += A.genArmor || 0; t.charge += A.genCharge || 0;
      t.ap = Math.min(0.9, t.ap + (A.genAp || 0)); if (A.genHp) t.hp *= A.genHp;
    }
    if (t.cat === 'siege' && A.siegeDmg) t.rdmg *= A.siegeDmg;
    t.harvest = A.harvest || 0;
    const drill = mods.drill && mods.drill[typeId];
    if (drill) { t.atk += drill * 2; t.def += drill * 2; t.morale += drill * 3; }
    t.armor = Math.min(t.armor, 95);
    t.morale += (mods.cmdLevel || 0) * 1.5;
    return t;
  }

  // Flying units ignore terrain: walls, rivers, lava and cliffs.
  class FlyNav {
    constructor(map) { this.map = map; }
    inside(x, z) { const h = this.map.half - 2; return x > -h && x < h && z > -h && z < h; }
    blocked(x, z) { return !this.inside(x, z); }
    lineClear(x0, z0, x1, z1) { return this.inside(x1, z1); }
    nearestFree(x, z) { const h = this.map.half - 3; return { x: U.clamp(x, -h, h), z: U.clamp(z, -h, h) }; }
    heightAt(x, z) { return this.map.heightAt(x, z); }
    speedMul() { return 1; }
    onWall() { return false; }
  }
  RW.FlyNav = FlyNav;

  let nextId = 1;

  class Unit {
    constructor(battle, side, spec, mods) {
      this.battle = battle;
      this.id = nextId++;
      this.side = side;
      this.spec = spec;
      this.typeId = spec.typeId;
      this.faction = spec.faction || RW.data.UNITS[spec.typeId].faction;
      this.t = computeStats(spec.typeId, Object.assign({}, mods, { rank: spec.rank || 0 }));
      this.base = RW.data.UNITS[spec.typeId];
      this.name = this.base.name;
      this.cat = this.base.cat;
      this.fly = !!this.base.fly;
      this.nav = this.fly ? new FlyNav(battle.map) : battle.map;
      this.alt = this.fly ? 6 : 0;
      this.isGeneral = this.cat === 'general';
      this.equip = this.base.equip || null;
      this.rank = spec.rank || 0;
      this.count = this.t.count;
      this.hpEach = this.t.hp;
      this.maxPool = this.count * this.hpEach;
      const start = U.clamp(Math.round(this.count * (spec.hpFrac == null ? 1 : spec.hpFrac)), 1, this.count);
      this.alive = start;
      this.startAlive = start;
      this.pool = start * this.hpEach;
      const n = this.count;
      this.sx = new Float32Array(n); this.sz = new Float32Array(n); this.sy = new Float32Array(n);
      this.sf = new Float32Array(n); this.sa = new Uint8Array(n); this.sdie = new Float32Array(n);
      this.sphase = new Float32Array(n); this.sstuck = new Float32Array(n); this.sslot = new Int16Array(n);
      this.scomp = new Float32Array(n).fill(1); this.sfoe = new Int32Array(n).fill(-1); this.sfoeU = new Array(n).fill(null);
      this.satk = new Float32Array(n); this.smove = new Float32Array(n); this.sknock = new Float32Array(n);
      this.rankGained = 0; this.xp0 = spec.xp || 0;
      for (let i = 0; i < n; i++) { this.sa[i] = i < start ? 1 : 0; this.sdie[i] = -999; this.sphase[i] = Math.random() * 6; }
      this.x = 0; this.z = 0; this.facing = 0;
      this.formation = 'line';
      this.spacing = baseSpacing(this.t);
      this.ranks0 = baseRanks(this.t);
      this.order = { type: 'idle' };
      this.path = []; this.pathIdx = 0; this.repathT = 0; this.pathGoal = null;
      this.state = 'idle';
      this.morale = this.t.morale;
      this.ammo = this.t.ammo;
      this.reloadT = Math.random() * 2;
      this.engaged = new Map();      // enemy unit -> contact count of our soldiers
      this.engagedBy = new Set();    // enemy units touching us
      this.prevEngaged = new Set();
      this.chargeT = new Map();      // enemy unit id -> remaining charge bonus time
      this.speedSmooth = 0;
      this.chargeHist = new Map();   // enemy unit id -> time of last charge impact
      this.lastMeleeT = -99;
      this.buffs = [];
      this.hold = false;
      this.kills = 0;
      this.dealt = 0; this.taken = 0; this.recentLoss = 0;
      this.routCount = 0; this.routT = 0; this.shattered = false;
      this.disengageT = 0;
      this.lastShotT = -99;
      this.hidden = false;
      this.stuckT = 0; this.lastPos = { x: 0, z: 0 }; this.progressT = 0;
      this.slotTimer = Math.random() * 0.3;
      this.foeTimer = Math.random() * 0.3;
      this.lastDamageFrom = null;
      this.meleeTarget = null; this.rangedTarget = null;
      this.aiRole = null; this.aiData = {};
    }

    get active() { return this.state !== 'dead' && this.state !== 'escaped' && this.state !== 'routing'; }
    get gone() { return this.state === 'dead' || this.state === 'escaped'; }
    get hpFrac() { return this.pool / this.maxPool; }
    get large() { return this.t.large; }
    get form() { return FORMATIONS[this.formation]; }

    buffVal(key) {
      let v = 0;
      for (const b of this.buffs) if (b[key]) v += b[key];
      return v;
    }
    buffMul(key) {
      let v = 1;
      for (const b of this.buffs) if (b[key]) v *= b[key];
      return v;
    }
    addBuff(b) {
      // Refresh same-named buffs instead of stacking.
      const i = this.buffs.findIndex((x) => x.name === b.name);
      if (i >= 0) this.buffs.splice(i, 1);
      this.buffs.push(b);
    }

    // ---------------------------------------------------------------- formation geometry
    get ranks() {
      if (this.cat === 'monster' || this.cat === 'siege') return 1;
      return Math.max(1, Math.round(this.ranks0 * this.form.rankMul));
    }
    get sp() { return this.spacing * (this.cat === 'monster' || this.cat === 'siege' ? 1 : this.form.spacing); }
    get cols() { return Math.max(1, Math.ceil(this.alive / this.ranks)); }
    get hw() { return Math.max(1, this.cols * this.sp * 0.5); }
    get hd() { return Math.max(1, Math.min(this.ranks, this.alive) * this.sp * this.depthMul * 0.5); }
    get depthMul() { return this.t.model.kind === 'mounted' ? 1.5 : 1; }
    get radius() { return Math.hypot(this.hw, this.hd); }

    // Local offset of slot k (x right, z forward).
    slotLocal(k, alive) {
      const ranks = Math.min(this.ranks, alive);
      const cols = Math.max(1, Math.ceil(alive / ranks));
      const row = Math.floor(k / cols), col = k % cols;
      const inRow = row === ranks - 1 ? alive - row * cols : cols;
      const sp = this.sp, dsp = sp * this.depthMul;
      const lx = (col - (inRow - 1) / 2) * sp;
      const lz = ((ranks - 1) / 2 - row) * dsp;
      return [lx, lz];
    }
    toWorld(lx, lz, x = this.x, z = this.z, f = this.facing) {
      const c = Math.cos(f), s = Math.sin(f);
      return [x + lx * c + lz * s, z - lx * s + lz * c];
    }
    toLocal(wx, wz) {
      const dx = wx - this.x, dz = wz - this.z, c = Math.cos(this.facing), s = Math.sin(this.facing);
      return [dx * c - dz * s, dx * s + dz * c];
    }
    // Assign alive soldiers to compact slots.
    reslot() {
      let k = 0;
      for (let i = 0; i < this.count; i++) if (this.sa[i]) this.sslot[i] = k++;
    }

    // Place the whole regiment instantly (deployment).
    placeAt(x, z, facing) {
      const map = this.nav;
      const p = map.nearestFree(x, z, this.side);
      this.x = p.x; this.z = p.z; this.facing = facing;
      this.reslot();
      for (let i = 0; i < this.count; i++) {
        const [lx, lz] = this.slotLocal(this.sslot[i], this.alive);
        let [wx, wz] = this.toWorld(lx, lz);
        if (!this.sa[i]) { wx = this.x; wz = this.z; }
        const q = this.validSlot(wx, wz, lx, lz);
        this.sx[i] = q[0]; this.sz[i] = q[1];
        this.sy[i] = map.heightAt(this.sx[i], this.sz[i]);
        this.sf[i] = facing;
      }
      this.order = { type: 'idle' };
      this.path = [];
      this.lastPos = { x: this.x, z: this.z };
    }
    // Pull a slot toward the centre until it is walkable.
    validSlot(wx, wz, lx, lz) {
      const map = this.nav;
      if (!map.blocked(wx, wz, this.side) && map.lineClear(this.x, this.z, wx, wz, this.side)) return [wx, wz];
      for (const f of [0.75, 0.5, 0.3, 0.12]) {
        const [x2, z2] = this.toWorld(lx * f, lz * f);
        if (!map.blocked(x2, z2, this.side) && map.lineClear(this.x, this.z, x2, z2, this.side)) return [x2, z2];
      }
      return [this.x, this.z];
    }

    // ---------------------------------------------------------------- orders
    orderMove(x, z, facing, keepTarget = false) {
      if (this.state === 'routing' || this.gone) return;
      const map = this.nav;
      const g = map.nearestFree(x, z, this.side);
      this.order = { type: 'move', x: g.x, z: g.z, facing: facing == null ? null : facing };
      if (!keepTarget) this.meleeTarget = null;
      this.rangedTarget = null;
      if (this.engagedBy.size || this.engaged.size) this.disengageT = 2.0;
      this.computePath(g.x, g.z);
    }
    orderAttack(target) {
      if (this.state === 'routing' || this.gone || !target || target.gone || target.side === this.side) return;
      this.order = { type: 'attack', target };
      this.meleeTarget = target;
      this.rangedTarget = this.t.range && this.ammo > 0 ? target : null;
      this.disengageT = 0;
      this.computePath(target.x, target.z);
    }
    // Siege towers roll up to the wall at x; once docked they open a breach.
    orderTower(x) {
      if (this.equip !== 'tower' || this.gone || this.docked) return;
      const m = this.battle.map;
      const z = m.wallZ + (this.battle.sideNorth[this.side] ? -5 : 5.5);
      this.order = { type: 'tower', x, z };
      this.computePath(x, z);
    }
    orderGate(gate) {
      const g = gate && gate.hp > 0 ? gate : this.battle.map.nearestGate(this.x, this.z);
      if (!g || g.hp <= 0 || this.state === 'routing' || this.gone) return;
      if (this.equip === 'tower') return;
      const dir = this.battle.sideNorth[this.side] ? -1 : 1;
      if (this.t.splash && this.ammo > 0) {
        // Siege engines bombard the gate from range.
        const d = Math.hypot(g.x - this.x, g.z - this.z);
        const want = this.t.range * 0.8;
        const tx = d > want ? g.x + (this.x - g.x) * (want / d) : this.x;
        const tz = d > want ? g.z + (this.z - g.z) * (want / d) : this.z;
        this.order = { type: 'gate', x: tx, z: tz, ranged: true, gate: g };
        this.computePath(tx, tz);
        return;
      }
      const zFront = g.z + dir * 5;
      this.order = { type: 'gate', x: g.x + (Math.random() - 0.5) * 4, z: zFront, gate: g };
      this.computePath(this.order.x, zFront);
    }
    halt() {
      if (this.state === 'routing' || this.gone) return;
      this.order = { type: 'idle' };
      this.path = [];
      this.meleeTarget = null; this.rangedTarget = null;
    }
    computePath(x, z) {
      if (this.fly) {
        const p = this.nav.nearestFree(x, z);
        this.path = [p];
      } else this.path = RW.findPath(this.battle.map, this.x, this.z, x, z, this.side);
      this.pathIdx = 0;
      this.pathGoal = { x, z };
      this.repathT = 1 + Math.random() * 0.5;
      this.progressT = 0;
    }

    // ---------------------------------------------------------------- per-tick movement
    effectiveSpeed() {
      const map = this.nav;
      let s = this.t.speed * this.form.speed * this.buffMul('speedMul');
      s *= map.speedMul(this.x, this.z, this.cat) * this.battle.weatherFx.speed;
      if (this.state === 'routing') s *= 1.1;
      if (this.alive < this.count * 0.3 && this.cat !== 'monster' && this.cat !== 'siege') s *= 1.05;
      return s;
    }

    moveCenter(dt) {
      const map = this.nav;
      let moving = false;
      const ox = this.x, oz = this.z;
      if (this.path.length && this.pathIdx < this.path.length) {
        const wp = this.path[this.pathIdx];
        const dx = wp.x - this.x, dz = wp.z - this.z;
        const d = Math.hypot(dx, dz);
        const step = this.effectiveSpeed() * dt;
        if (d <= step || d < 0.3) {
          this.x = wp.x; this.z = wp.z; this.pathIdx++;
        } else {
          let nx = this.x + (dx / d) * step, nz = this.z + (dz / d) * step;
          if (map.blocked(nx, nz, this.side)) {
            // Path cell became blocked (gate closed/obstacle) - repath.
            this.repathT = 0;
          } else { this.x = nx; this.z = nz; }
          const want = Math.atan2(dx, dz);
          this.facing = U.turnToward(this.facing, want, (this.cat === 'cav' ? 3 : this.cat === 'siege' ? 0.8 : 2.2) * dt);
        }
        moving = true;
      }
      const moved = Math.hypot(this.x - ox, this.z - oz);
      const inst = dt > 0 ? moved / dt : 0;
      this.speedSmooth += (inst - this.speedSmooth) * Math.min(1, dt * 2.5);
      // Stuck detection: no progress while we think we're moving.
      if (moving) {
        this.progressT += dt;
        if (this.progressT > 2.5) {
          if (Math.hypot(this.x - this.lastPos.x, this.z - this.lastPos.z) < 1) {
            this.stuckT++;
            const goal = this.pathGoal;
            if (goal && this.stuckT < 4) this.computePath(goal.x, goal.z);
            else { this.path = []; this.stuckT = 0; }
          } else this.stuckT = 0;
          this.lastPos = { x: this.x, z: this.z };
          this.progressT = 0;
        }
      }
      return moving;
    }

    // Move each soldier toward its slot (or its melee opponent), never into blocked cells.
    updateSoldiers(dt, time) {
      const map = this.nav;
      if (this.fly) {
        const want = this.state === 'fighting' ? 1.8 : this.state === 'idle' && !this.path.length ? 3.5 : 7;
        this.alt += (want - this.alt) * Math.min(1, dt * 1.5);
      }
      const fighting = this.state === 'fighting';
      const routing = this.state === 'routing';
      const spd = this.t.speed * (routing ? 1.15 : 1) * this.buffMul('speedMul');
      this.slotTimer -= dt;
      const recheck = this.slotTimer <= 0;
      if (recheck) this.slotTimer = 0.3;
      const alive = this.alive;
      const reach = this.large ? 2.6 : 1.25;
      for (let i = 0; i < this.count; i++) {
        if (!this.sa[i]) continue;
        let [lx, lz] = this.slotLocal(this.sslot[i], alive);
        if (routing) { lx *= 1.6; lz *= 1.6; }
        let [tx, tz] = this.toWorld(lx * this.scomp[i], lz * this.scomp[i]);
        if (recheck) {
          const [fx, fz] = this.toWorld(lx, lz);
          if (map.blocked(fx, fz, this.side) || !map.lineClear(this.x, this.z, fx, fz, this.side)) {
            let c = 1;
            for (const f of [0.75, 0.5, 0.3, 0.12, 0]) {
              const [x2, z2] = this.toWorld(lx * f, lz * f);
              c = f;
              if (!map.blocked(x2, z2, this.side) && map.lineClear(this.x, this.z, x2, z2, this.side)) break;
            }
            this.scomp[i] = c;
          } else this.scomp[i] = 1;
          [tx, tz] = this.toWorld(lx * this.scomp[i], lz * this.scomp[i]);
        }
        let faceTo = null;
        // Melee: step toward the chosen enemy soldier.
        if (fighting && this.sfoe[i] >= 0) {
          const fu = this.sfoeU[i];
          const k = this.sfoe[i];
          if (fu && fu.sa[k]) {
            const ex = fu.sx[k], ez = fu.sz[k];
            const dx = ex - this.sx[i], dz = ez - this.sz[i];
            const d = Math.hypot(dx, dz) || 0.001;
            const stand = reach * 0.9 + (fu.large ? 1.2 : 0.2);
            tx = ex - (dx / d) * stand; tz = ez - (dz / d) * stand;
            faceTo = Math.atan2(dx, dz);
          } else this.sfoe[i] = -1;
        }
        let dx = tx - this.sx[i], dz = tz - this.sz[i];
        const d = Math.hypot(dx, dz);
        let moved = 0;
        if (d > 0.08) {
          const maxStep = spd * (d > 3 ? 1.35 : 1) * dt;
          const step = Math.min(d, maxStep);
          const nx = this.sx[i] + (dx / d) * step, nz = this.sz[i] + (dz / d) * step;
          if (!map.blocked(nx, nz, this.side)) { this.sx[i] = nx; this.sz[i] = nz; moved = step; this.sstuck[i] = 0; }
          else if (!map.blocked(nx, this.sz[i], this.side)) { moved = Math.abs(nx - this.sx[i]); this.sx[i] = nx; this.sstuck[i] += dt * 0.5; }
          else if (!map.blocked(this.sx[i], nz, this.side)) { moved = Math.abs(nz - this.sz[i]); this.sz[i] = nz; this.sstuck[i] += dt * 0.5; }
          else this.sstuck[i] += dt;
          if (this.sstuck[i] > 3) {
            // Hopelessly stuck soldier: rejoin the centre of the regiment.
            const p = map.nearestFree(this.x + (Math.random() - 0.5) * 2, this.z + (Math.random() - 0.5) * 2, this.side);
            this.sx[i] = p.x; this.sz[i] = p.z; this.sstuck[i] = 0;
          }
          if (step > 0.02 && !faceTo) faceTo = Math.atan2(dx, dz);
        }
        this.smove[i] = moved / Math.max(dt, 1e-4);
        this.sphase[i] += moved * 2.2;
        if (faceTo == null) faceTo = (fighting || d < 0.5) ? this.facing : this.sf[i];
        if (routing && moved > 0.01) faceTo = Math.atan2(dx, dz);
        this.sf[i] = U.turnToward(this.sf[i], faceTo, 6 * dt);
        this.sy[i] = map.heightAt(this.sx[i], this.sz[i]) + (this.fly ? this.alt : map.onWall(this.sx[i], this.sz[i]) ? 8.2 : 0);
        if (this.satk[i] > 0) this.satk[i] = Math.max(0, this.satk[i] - dt);
        if (this.sknock[i] > 0) this.sknock[i] = Math.max(0, this.sknock[i] - dt);
      }
    }

    // Choose a nearby enemy soldier for each of ours to fight (melee only).
    pickFoes() {
      const foes = [...this.engaged.keys(), ...this.engagedBy].filter((u) => !u.gone);
      const reachSearch = this.large ? 10 : 7;
      for (let i = 0; i < this.count; i++) {
        if (!this.sa[i]) continue;
        let best = -1, bu = null, bd = reachSearch * reachSearch;
        for (const fu of foes) {
          for (let k = 0; k < fu.count; k++) {
            if (!fu.sa[k]) continue;
            const dd = (fu.sx[k] - this.sx[i]) ** 2 + (fu.sz[k] - this.sz[i]) ** 2;
            if (dd < bd) { bd = dd; best = k; bu = fu; }
          }
        }
        this.sfoe[i] = best; this.sfoeU[i] = bu;
      }
    }

    // ---------------------------------------------------------------- casualties
    // Remove HP from the pool; kill soldiers nearest to (px, pz).
    damage(amount, px, pz, source) {
      if (this.gone || amount <= 0) return 0;
      const before = this.alive;
      this.pool = Math.max(0, this.pool - amount);
      this.taken += amount;
      this.recentLoss += amount;
      if (source) this.lastDamageFrom = source;
      const want = Math.ceil(this.pool / this.hpEach - 1e-6);
      let toKill = before - want;
      let killed = 0;
      while (toKill > 0 && this.alive > 0) {
        let best = -1, bd = Infinity;
        for (let i = 0; i < this.count; i++) {
          if (!this.sa[i]) continue;
          const d = px == null ? Math.random() : (this.sx[i] - px) ** 2 + (this.sz[i] - pz) ** 2 + Math.random() * 4;
          if (d < bd) { bd = d; best = i; }
        }
        if (best < 0) break;
        this.sa[best] = 0; this.sdie[best] = this.battle.time;
        this.alive--; toKill--; killed++;
      }
      if (killed) {
        this.reslot();
        if (source) {
          source.kills += killed;
          source.checkRank();
          const h = source.t.harvest + source.buffVal('harvest');
          if (h > 0 && !source.gone) source.heal(killed * this.hpEach * h);
        }
        this.battle.onCasualties(this, killed);
      }
      if (this.alive <= 0) { this.state = 'dead'; this.pool = 0; this.battle.onUnitDestroyed(this); }
      return killed;
    }
    // In-battle veterancy uses the campaign rule: a rank every 30 experience (kills).
    checkRank() {
      if (this.isGeneral || this.equip) return;
      while (this.rank < 3 && this.xp0 + this.kills >= (this.rank + 1) * 30) {
        this.rank++; this.rankGained++;
        this.t.atk += 3; this.t.def += 3; this.t.morale += 5; this.morale += 5;
        this.battle.emit('rankup', this);
      }
    }
    // Restore HP and revive fallen soldiers near the unit.
    heal(amount) {
      if (this.gone) return;
      const lost = this.maxPool - this.pool;
      const add = Math.min(lost, amount);
      this.pool += add;
      const want = Math.min(this.count, Math.ceil(this.pool / this.hpEach - 1e-6));
      for (let i = 0; i < this.count && this.alive < want; i++) {
        if (this.sa[i]) continue;
        this.sa[i] = 1; this.alive++;
        const p = this.nav.nearestFree(this.x + (Math.random() - 0.5) * 4, this.z + (Math.random() - 0.5) * 4, this.side);
        this.sx[i] = p.x; this.sz[i] = p.z;
      }
      this.reslot();
    }
  }

  RW.Unit = Unit;
  RW.FORMATIONS = FORMATIONS;
  RW.computeStats = computeStats;
})();
