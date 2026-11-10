// Procedural island content: every named location, roads, bridges, forests, vehicles and hidden loot.
import * as THREE from 'three';
import { Builder, MAT_COLORS } from './world.js';
import { POIS, HIDDEN, ROADS, FORESTS, RIVERS, LAKES } from './layout.js';
import { TSTEP } from './terrain.js';
import { segDist, clamp } from './util.js';

const WALL_PASTEL = [0xf2e3c6, 0xbfe0f0, 0xc9edd0, 0xf6cdb4, 0xd9cdf0, 0xf0f0f0, 0xf7e08a, 0xe8b9b9];
const ROOF = [0xa8442f, 0x4b4f58, 0x2f7f86, 0x7d5536, 0x5b3a6b, 0x355a3a];
const CAR_COLORS = [0xd8342c, 0x2f6fd8, 0xf2c230, 0xeeeeee, 0x333333, 0x37a356, 0xf07c2a, 0x8a3fd1];

export function generateMap(world) {
  const g = new MapGen(world);
  g.run();
  return g;
}

class MapGen {
  constructor(world) {
    this.w = world;
    this.T = world.terrain;
    this.rng = world.game.rng;
  }
  r(a = 0, b = 1) { return a + this.rng() * (b - a); }
  ri(a, b) { return Math.floor(this.r(a, b + 1)); }
  pick(arr) { return arr[Math.floor(this.rng() * arr.length)]; }
  B(x, z, rot, poi, yOverride) {
    const y = yOverride !== undefined ? yOverride : poi ? this.T.poiHeight(poi.id) : this.T.heightAt(x, z);
    const b = new Builder(this.w, x, y, z, rot);
    b.poi = poi ? poi.id : null;
    return b;
  }

  run() {
    for (const p of POIS) {
      this.w.labels.push({ name: p.name, x: p.x, z: p.z, big: true });
      const fn = this['poi_' + p.type];
      if (fn) fn.call(this, p);
    }
    for (const h of HIDDEN) this.hidden(h);
    this.scatterBuildings();
    this.roads();
    this.forests();
    this.rocksAndProps();
  }

  // ---------------- building archetypes ----------------
  foundation(b, w, d, color = 0x8d8a84) {
    b.box(0, -2.5, 0, w + 0.4, 2.75, d + 0.4, color, { destr: false });
  }

  house(b, { floors = 2, wall = this.pick(WALL_PASTEL), roof = this.pick(ROOF), decay = 0, flatRoof = false, chests = true } = {}) {
    const w = 12, d = 10, H = 3.4, t = 0.3;
    b.decay = decay;
    b.footprint(w, d, roof);
    this.foundation(b, w, d);
    const g = 0.25;
    const inner = 0xe9e2d4;
    b.via = null;
    for (let f = 0; f < floors; f++) {
      const y0 = g + f * H;
      if (f === 1) b.via = [b.wp(-w / 2 + t + 1.1, g, -3.2), b.wp(-w / 2 + t + 1.1, g + 1.2, -1.2), b.wp(-w / 2 + t + 1.1, g + H, d / 2 - t - 0.5), b.wp(-w / 2 + t + 2.8, g + H, d / 2 - t - 0.8)];
      const fo = f === 0 ? [{ at: -2, w: 1.6, sill: 0, h: 2.4 }] : [{ at: -2, w: 1.5, sill: 1, h: 1.3, glass: true }];
      b.wallX(-w / 2, w / 2, -d / 2 + t / 2, y0, H, t, wall, 'wood', [...fo, { at: 3, w: 1.6, sill: 1, h: 1.3, glass: true }]);
      b.wallX(-w / 2, w / 2, d / 2 - t / 2, y0, H, t, wall, 'wood', [{ at: -2.5, w: 1.5, sill: 1, h: 1.3, glass: true }, { at: 3, w: 1.5, sill: 1, h: 1.3, glass: true }]);
      b.wallZ(-d / 2 + t, d / 2 - t, -w / 2 + t / 2, y0, H, t, wall, 'wood', [{ at: -2.5, w: 1.4, sill: 1, h: 1.3, glass: true }]);
      b.wallZ(-d / 2 + t, d / 2 - t, w / 2 - t / 2, y0, H, t, wall, 'wood', f === 0 ? [{ at: 2.5, w: 1.4, sill: 0, h: 2.3 }] : [{ at: 0, w: 1.5, sill: 1, h: 1.3, glass: true }]);
      // interior partition
      b.wallZ(-d / 2 + t, d / 2 - t, 1, y0, H, 0.2, inner, 'wood', [{ at: -2.4, w: 1.4, sill: 0, h: 2.3 }]);
      if (f < floors - 1) {
        b.slab(-w / 2, w / 2, -d / 2, d / 2, y0 + H, 0.3, 0xc7a27a, {}, { x0: -w / 2 + t, x1: -w / 2 + t + 2.3, z0: -1.2, z1: d / 2 - t });
        b.ramp(-w / 2 + t, -1.9, -w / 2 + t + 2.2, d / 2 - t, y0, y0 + H, 2, 0x9c7a55);
      }
      if (chests) {
        if (f === 0) b.chest(3.6, y0, 3); else b.chest(4, y0, -2.8);
        b.loot(-1.5, y0, -2.5);
        if (this.rng() < 0.6) b.loot(4, y0, 0.5);
        if (this.rng() < 0.3) b.ammo(-0.5, y0, 3.5);
      }
      // furniture
      if (!decay) {
        b.box(3.5, y0, -2.6, 1.8, 0.75, 1, 0x8b5a2b, { mat: 'wood', hp: 60, kind: 'crate' });
        if (f === 0) b.box(-1, y0, 3.8, 2.4, 0.8, 0.9, this.pick([0x5574a6, 0xa65555, 0x6a8f5a]), { mat: 'wood', hp: 60, kind: 'crate' });
      }
    }
    b.via = null;
    const top = g + floors * H;
    b.slab(-w / 2, w / 2, -d / 2, d / 2, top, 0.3, 0xc7a27a, { hp: 300 });
    if (flatRoof || (decay && this.rng() < 0.5)) {
      b.wallX(-w / 2, w / 2, -d / 2 + 0.15, top, 0.8, 0.3, wall, 'wood');
      b.wallX(-w / 2, w / 2, d / 2 - 0.15, top, 0.8, 0.3, wall, 'wood');
    } else {
      b.gable(0, top, 0, w + 0.8, d + 0.8, 2.6, roof, false);
    }
    b.decay = 0;
  }

  cabin(b, { wall = 0x9b6b43, roof = 0x5a3b26, rare = false, decay = 0 } = {}) {
    const w = 8, d = 7, H = 3.2, t = 0.3;
    b.decay = decay;
    b.footprint(w, d, roof);
    this.foundation(b, w, d, 0x6d5a48);
    const y0 = 0.25;
    b.wallX(-w / 2, w / 2, -d / 2 + t / 2, y0, H, t, wall, 'wood', [{ at: 0, w: 1.5, sill: 0, h: 2.3 }]);
    b.wallX(-w / 2, w / 2, d / 2 - t / 2, y0, H, t, wall, 'wood', [{ at: 1.5, w: 1.3, sill: 1, h: 1.1, glass: true }]);
    b.wallZ(-d / 2 + t, d / 2 - t, -w / 2 + t / 2, y0, H, t, wall, 'wood', [{ at: 0, w: 1.3, sill: 1, h: 1.1, glass: true }]);
    b.wallZ(-d / 2 + t, d / 2 - t, w / 2 - t / 2, y0, H, t, wall, 'wood');
    b.slab(-w / 2, w / 2, -d / 2, d / 2, y0 + H, 0.25, 0x7a5638);
    b.gable(0, y0 + H, 0, w + 0.8, d + 0.8, 2.2, roof, false);
    b.chest(2.5, y0, 2, rare);
    b.loot(-2, y0, 1);
    if (rare) b.chest(-2.5, y0, 2.2, true);
    b.box(-2.6, y0, -2, 1.2, 0.8, 1.2, 0x7a4a24, { mat: 'wood', hp: 60, kind: 'crate' });
    b.decay = 0;
  }

  shop(b, { w = 10, d = 8, color = this.pick([0xd8d0c0, 0xc8d8e0, 0xe0c8c0, 0xd0e0c8]), sign = this.pick([0xff4477, 0x33bbff, 0xffcc22, 0x66dd55]) } = {}) {
    const H = 4, t = 0.3;
    b.footprint(w, d, 0x77777f);
    this.foundation(b, w, d, 0x77777a);
    const y0 = 0.25;
    b.wallX(-w / 2, w / 2, -d / 2 + t / 2, y0, H, t, color, 'stone', [{ at: -2.4, w: 3.2, sill: 0.6, h: 2.4, glass: true }, { at: 1.5, w: 1.8, sill: 0, h: 2.6 }, { at: 3.9, w: 1.4, sill: 0.6, h: 2.4, glass: true }]);
    b.wallX(-w / 2, w / 2, d / 2 - t / 2, y0, H, t, color, 'stone', [{ at: -3, w: 1.2, sill: 0, h: 2.3 }]);
    b.wallZ(-d / 2 + t, d / 2 - t, -w / 2 + t / 2, y0, H, t, color, 'stone');
    b.wallZ(-d / 2 + t, d / 2 - t, w / 2 - t / 2, y0, H, t, color, 'stone', [{ at: 0, w: 1.5, sill: 1.2, h: 1.2, glass: true }]);
    b.slab(-w / 2, w / 2, -d / 2, d / 2, y0 + H, 0.3, 0x8a8a8a, { mat: 'stone' });
    b.wallX(-w / 2, w / 2, -d / 2 + 0.15, y0 + H, 0.7, 0.3, color, 'stone');
    b.wallX(-w / 2, w / 2, d / 2 - 0.15, y0 + H, 0.7, 0.3, color, 'stone');
    b.box(0, y0 + H - 0.6, -d / 2 - 0.3, w * 0.7, 1.1, 0.25, sign, { decor: true });
    // shelves
    b.box(-2, y0, 1.5, 4, 1.6, 0.6, 0xb0b0b0, { mat: 'metal', hp: 80, kind: 'crate' });
    b.box(2.5, y0, 2.6, 0.6, 1.6, 2.5, 0xb0b0b0, { mat: 'metal', hp: 80, kind: 'crate' });
    b.chest(-3.6, y0, 3);
    b.loot(0, y0, -1.5);
    b.loot(3, y0, -2);
    if (this.rng() < 0.5) b.ammo(-1, y0, 3.2);
    // roof loot
    if (this.rng() < 0.3) b.loot(0, y0 + H, 0);
  }

  midrise(b, { floors = 3, w = 14, d = 14, color = this.pick([0xb5654a, 0xd9c7a6, 0x9fa8b0, 0xc9a07a]) } = {}) {
    const H = 3.6, t = 0.35;
    b.footprint(w, d, 0x6f6f78);
    this.foundation(b, w, d, 0x77777a);
    const g = 0.25;
    const sx = w / 2 - t - 2.4;
    const rx = sx + 1.2;
    const chain = [];
    b.via = null;
    for (let f = 0; f < floors; f++) {
      const y0 = g + f * H;
      if (f > 0) {
        const py = g + (f - 1) * H;
        chain.push(b.wp(rx, py, -5.4), b.wp(rx, py + 0.4, -3.9), b.wp(rx, py + H, 3.1), b.wp(sx - 0.9, py + H, 3.3), b.wp(sx - 0.9, py + H, -5.2));
        b.via = chain.slice();
      }
      const win = (n, len) => {
        const ops = [];
        for (let i = 0; i < n; i++) ops.push({ at: -len / 2 + (len / n) * (i + 0.5), w: 1.4, sill: 1, h: 1.5, glass: true });
        return ops;
      };
      const front = win(3, w);
      if (f === 0) front[1] = { at: 0, w: 2, sill: 0, h: 2.6 };
      b.wallX(-w / 2, w / 2, -d / 2 + t / 2, y0, H, t, color, 'stone', front);
      b.wallX(-w / 2, w / 2, d / 2 - t / 2, y0, H, t, color, 'stone', win(3, w));
      b.wallZ(-d / 2 + t, d / 2 - t, -w / 2 + t / 2, y0, H, t, color, 'stone', win(3, d));
      b.wallZ(-d / 2 + t, d / 2 - t, w / 2 - t / 2, y0, H, t, color, 'stone', f === 0 ? [{ at: -4, w: 1.4, sill: 0, h: 2.4 }] : win(3, d));
      // interior wall (leaves a corridor beside the stair column)
      b.wallX(-w / 2 + t, sx - 1.7, 1.5, y0, H, 0.2, 0xe0dcd2, 'wood', [{ at: -2, w: 1.4, sill: 0, h: 2.4 }]);
      // stairs: every floor's ramp rises +z in the same column; the corridor at x < sx links them
      const hole = { x0: sx, x1: w / 2 - t, z0: -2, z1: 3.6 };
      b.slab(-w / 2, w / 2, -d / 2, d / 2, y0 + H, 0.3, 0x9a9690, { mat: 'stone' }, hole);
      b.ramp(sx, -4.5, w / 2 - t, 3.5, y0, y0 + H, 2, 0x8f8a83, { mat: 'stone' });
      if (this.rng() < 0.55) b.chest(-4.5, y0, this.rng() < 0.5 ? 4.5 : -4.5);
      b.loot(-2, y0, -2);
      if (this.rng() < 0.5) b.loot(-4, y0, 4);
      b.box(-4, y0, -4.5, 2, 0.8, 1, 0x6b4a35, { mat: 'wood', hp: 60, kind: 'crate' });
    }
    const top = g + floors * H;
    {
      const py = g + (floors - 1) * H;
      chain.push(b.wp(rx, py, -5.4), b.wp(rx, py + 0.4, -3.9), b.wp(rx, py + H, 3.1), b.wp(sx - 0.9, py + H, 3.3));
      b.via = chain.slice();
    }
    b.wallX(-w / 2, w / 2, -d / 2 + 0.15, top, 1, 0.3, color, 'stone');
    b.wallX(-w / 2, w / 2, d / 2 - 0.15, top, 1, 0.3, color, 'stone');
    b.wallZ(-d / 2 + 0.3, d / 2 - 0.3, -w / 2 + 0.15, top, 1, 0.3, color, 'stone');
    b.wallZ(-d / 2 + 0.3, d / 2 - 0.3, w / 2 - 0.15, top, 1, 0.3, color, 'stone');
    b.box(-3, top, 2, 2.4, 1.5, 2, 0x9aa0a6, { mat: 'metal', hp: 200, kind: 'crate' });
    if (this.rng() < 0.5) b.chest(-4, top, -4);
    b.via = null;
  }

  tower(b, { w = 18, d = 18, h = 40, color = this.pick([0x5b8db8, 0x6fa7a0, 0x8a96a8, 0x4e6f99, 0xa58fb8]) } = {}) {
    b.footprint(w, d, 0x55606e);
    this.foundation(b, w, d, 0x6a6a70);
    b.box(0, 0.25, 0, w, h, d, color, { destr: false, mat: 'metal' });
    // window bands
    for (let y = 3; y < h - 1; y += 3.5) {
      b.box(0, y + 0.25, 0, w + 0.12, 0.5, d + 0.12, 0xe8eef5, { decor: true });
    }
    // lobby entrance canopy
    b.box(0, 3.2, -d / 2 - 1.5, 6, 0.3, 3, 0x333333, { mat: 'metal', hp: 200 });
    const top = 0.25 + h;
    b.wallX(-w / 2, w / 2, -d / 2 + 0.2, top, 1.1, 0.4, 0x666a70, 'stone');
    b.wallX(-w / 2, w / 2, d / 2 - 0.2, top, 1.1, 0.4, 0x666a70, 'stone');
    b.wallZ(-d / 2 + 0.4, d / 2 - 0.4, -w / 2 + 0.2, top, 1.1, 0.4, 0x666a70, 'stone');
    b.wallZ(-d / 2 + 0.4, d / 2 - 0.4, w / 2 - 0.2, top, 1.1, 0.4, 0x666a70, 'stone');
    b.box(3, top, 3, 3, 2.2, 3, 0x9aa0a6, { mat: 'metal', hp: 300, kind: 'crate' });
    b.cyl(-4, top, -3, 1.2, 4, 0xb0b5ba, { destr: false });
    b.chest(-3, top, 4, this.rng() < 0.3);
    b.loot(2, top, -3);
  }

  warehouse(b, { w = 24, d = 16, h = 7, color = this.pick([0x7d8b96, 0x9a6b4f, 0x6f8a70, 0x8c8c7a]) } = {}) {
    const t = 0.35;
    b.footprint(w, d, 0x5a6168);
    this.foundation(b, w, d, 0x5d5d60);
    const y0 = 0.25;
    b.wallX(-w / 2, w / 2, -d / 2 + t / 2, y0, h, t, color, 'metal', [{ at: -4, w: 5, sill: 0, h: 4.5 }, { at: 7, w: 1.6, sill: 0, h: 2.5 }]);
    b.wallX(-w / 2, w / 2, d / 2 - t / 2, y0, h, t, color, 'metal', [{ at: 5, w: 5, sill: 0, h: 4.5 }]);
    b.wallZ(-d / 2 + t, d / 2 - t, -w / 2 + t / 2, y0, h, t, color, 'metal', [{ at: 0, w: 2.5, sill: 3.5, h: 1.2, glass: true }]);
    b.wallZ(-d / 2 + t, d / 2 - t, w / 2 - t / 2, y0, h, t, color, 'metal', [{ at: 2, w: 1.6, sill: 0, h: 2.5 }]);
    b.slab(-w / 2, w / 2, -d / 2, d / 2, y0 + h, 0.3, 0x6c7178, { mat: 'metal', hp: 400 });
    // catwalk on the back wall
    b.slab(-w / 2 + t, w / 2 - t, d / 2 - 3.4, d / 2 - t, y0 + 3.6, 0.25, 0x5f6670, { mat: 'metal', hp: 300 });
    b.ramp(-w / 2 + t, d / 2 - 3.4 - 2.5, -w / 2 + t + 6.5, d / 2 - 3.4, y0, y0 + 3.6, 0, 0x5f6670, { mat: 'metal' });
    // crates & containers inside
    for (let i = 0; i < 4; i++) {
      const cx = this.r(-w / 2 + 8, w / 2 - 3), cz = this.r(-d / 2 + 2.5, d / 2 - 6);
      const s = this.r(1.2, 2);
      b.box(cx, y0, cz, s, s, s, 0x9c6b3c, { mat: 'wood', hp: 100, kind: 'crate' });
    }
    b.via = [b.wp(-w / 2 + t + 0.5, y0, d / 2 - 3.4 - 3.4), b.wp(-w / 2 + t + 0.5, y0 + 0.3, d / 2 - 3.4 - 1.2), b.wp(-w / 2 + t + 6.0, y0 + 3.6, d / 2 - 3.4 - 1.2), b.wp(-w / 2 + t + 6.0, y0 + 3.6, d / 2 - 1.8)];
    b.chest(w / 2 - 3, y0 + 3.6, d / 2 - 1.6);
    b.loot(-2, y0 + 3.6, d / 2 - 1.7);
    b.via = null;
    b.chest(-w / 2 + 2, y0, -d / 2 + 2);
    b.loot(0, y0, 0); b.loot(-6, y0, 2); b.loot(6, y0, -3);
    b.ammo(4, y0, 4); b.ammo(-8, y0, -4);
  }

  barn(b) {
    const w = 14, d = 18, h = 5.5, t = 0.3, red = 0xb3372b;
    b.footprint(w, d, red);
    this.foundation(b, w, d, 0x6d5a48);
    const y0 = 0.25;
    b.wallX(-w / 2, w / 2, -d / 2 + t / 2, y0, h, t, red, 'wood', [{ at: 0, w: 4.5, sill: 0, h: 4.4 }]);
    b.wallX(-w / 2, w / 2, d / 2 - t / 2, y0, h, t, red, 'wood', [{ at: 0, w: 4.5, sill: 0, h: 4.4 }]);
    b.wallZ(-d / 2 + t, d / 2 - t, -w / 2 + t / 2, y0, h, t, red, 'wood', [{ at: 3, w: 1.4, sill: 2.8, h: 1.2 }]);
    b.wallZ(-d / 2 + t, d / 2 - t, w / 2 - t / 2, y0, h, t, red, 'wood', [{ at: -3, w: 1.4, sill: 0, h: 2.4 }]);
    // hayloft
    b.slab(w / 2 - 5, w / 2 - t, -d / 2 + t, d / 2 - t, y0 + 3.2, 0.25, 0x9b7346);
    b.ramp(w / 2 - 5 - 2.2, -d / 2 + t + 0.5, w / 2 - 5, -d / 2 + t + 6.3, y0, y0 + 3.2, 2, 0x8b6a40);
    b.gable(0, y0 + h, 0, w + 1, d + 1, 3.6, 0x5a4a3a, true);
    for (let i = 0; i < 4; i++) b.box(this.r(-5, -2.5), y0, this.r(-2, 6), 1.6, 1, 1.2, 0xe2c25a, { mat: 'wood', hp: 50, kind: 'crate' });
    b.via = [b.wp(w / 2 - 8.4, y0, -d / 2 + t + 1.2), b.wp(w / 2 - 6.1, y0 + 0.3, -d / 2 + t + 1.2), b.wp(w / 2 - 6.1, y0 + 3.2, -d / 2 + t + 5.6), b.wp(w / 2 - 3, y0 + 3.2, -d / 2 + t + 5.6)];
    b.chest(w / 2 - 2, y0 + 3.2, 6);
    b.loot(w / 2 - 2.5, y0 + 3.2, -2);
    b.via = null;
    b.chest(-w / 2 + 1.5, y0, -6);
    b.loot(-3, y0, 2); b.ammo(2, y0, 7);
  }

  gasStation(b) {
    b.footprint(26, 20, 0x6d6d70);
    b.box(0, -1.5, 0, 28, 1.7, 22, 0x6a6a6e, { destr: false });
    const y0 = 0.2;
    for (const [px, pz] of [[-6, -6], [6, -6], [-6, 2], [6, 2]]) b.box(px, y0, pz, 0.5, 4.6, 0.5, 0xeeeeee, { mat: 'metal', hp: 300 });
    b.box(0, y0 + 4.6, -2, 15, 0.5, 11, 0xe94040, { mat: 'metal', hp: 400 });
    b.box(0, y0 + 4.6 + 0.5, -2, 15.2, 0.25, 11.2, 0xffffff, { decor: true });
    for (const px of [-3, 3]) {
      b.box(px, y0, -2, 1, 1.6, 0.7, 0xdddddd, { mat: 'metal', hp: 80, kind: 'barrel' }).explosive = true;
    }
    const sb = new Builder(this.w, ...[b.tx(0, 8.5)].map(([x, z]) => [x, b.y + 0.05, z])[0], b.rot);
    sb.poi = b.poi;
    this.shop(sb, { w: 12, d: 7, color: 0xf2f2f2, sign: 0xe94040 });
    b.loot(-6, y0, -2); b.loot(6, y0, -5); b.ammo(0, y0, 1);
    // tanks of explosive fuel
    b.cyl(-11, y0, 7, 0.45, 1.1, 0xd83a2a, { kind: 'barrel', mat: 'metal', hp: 60, explosive: true });
    b.cyl(-10, y0, 8, 0.45, 1.1, 0xd83a2a, { kind: 'barrel', mat: 'metal', hp: 60, explosive: true });
    this.car(b, 10, 6, 1);
  }

  lookout(b, { h = 8, rare = false } = {}) {
    b.footprint(6, 6, 0x7a5a3a);
    for (const [px, pz] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]]) b.box(px, -1, pz, 0.4, h + 1, 0.4, 0x6b4a2e, { mat: 'wood', hp: 400 });
    b.box(0, h - 0.3, 0, 6, 0.3, 6, 0x8b6a45, { mat: 'wood', hp: 400, kind: 'floor' });
    b.wallX(-3, 3, -2.85, h, 1.1, 0.25, 0x8b6a45, 'wood');
    b.wallZ(-2.6, 2.6, -2.85, h, 1.1, 0.25, 0x8b6a45, 'wood');
    b.wallZ(-2.6, 2.6, 2.85, h, 1.1, 0.25, 0x8b6a45, 'wood');
    b.box(0, h + 2.6, 0, 6.6, 0.25, 6.6, 0x5a3b26, { mat: 'wood', hp: 200 });
    for (const [px, pz] of [[-2.9, -2.9], [2.9, -2.9], [-2.9, 2.9], [2.9, 2.9]]) b.box(px, h, pz, 0.2, 2.6, 0.2, 0x6b4a2e, { decor: true });
    // long ramp up to the open side (+z)
    b.ramp(-1.2, 3, 1.2, 3 + h * 1.25, 0, h, 3, 0x8b6a45);
    b.via = [b.wp(0, 0, 3 + h * 1.25 + 0.8), b.wp(0, 0.4, 3 + h * 1.25 - 0.5), b.wp(0, h, 2.4), b.wp(0, h, 0.5)];
    b.chest(1.5, h, -1.5, rare);
    b.loot(-1.5, h, 1);
    b.via = null;
  }

  car(b, lx, lz, rot = 0) {
    const color = this.pick(CAR_COLORS);
    const [wx, wz] = b.tx(lx, lz);
    const y = Math.max(b.y, this.T.heightAt(wx, wz));
    const w = this.w;
    const alongX = (rot + b.rot) % 2 === 0;
    const L = 4.2, W = 1.9;
    const sx = alongX ? L : W, sz = alongX ? W : L;
    const obj = w.newObj('car', 'metal', 350);
    obj.cx = wx; obj.cy = y + 0.8; obj.cz = wz;
    w.addBoxW(wx, y + 0.3, wz, sx, 0.75, sz, color, { obj });
    w.addBoxW(wx, y + 1.05, wz, alongX ? L * 0.55 : W * 0.9, 0.65, alongX ? W * 0.9 : L * 0.55, 0x2b3440, { obj });
    for (const s of [-1, 1]) for (const e of [-1, 1]) {
      w.addBoxW(wx + (alongX ? e * L * 0.32 : s * W * 0.45), y, wz + (alongX ? s * W * 0.45 : e * L * 0.32), 0.7, 0.6, 0.7, 0x151515, { obj, solid: false });
    }
    return obj;
  }

  container(b, lx, ly, lz, alongX, color) {
    const [wx, wz] = b.tx(lx, lz);
    const ax = alongX !== !!(b.rot & 1);
    const obj = this.w.addBoxW(wx, b.y + ly, wz, ax ? 6 : 2.5, 2.6, ax ? 2.5 : 6, color, { mat: 'metal', hp: 600, kind: 'wall' });
    return obj;
  }

  fenceLine(x0, z0, x1, z1, color = 0xd8c8a8, h = 1.1, mat = 'wood') {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / 3));
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      const y = this.T.heightAt(x, z);
      if (y < 0.5) continue;
      this.w.addBoxW(x, y - 0.3, z, alongX ? len / n : 0.15, h + 0.3, alongX ? 0.15 : len / n, color, { mat, hp: 60, kind: 'fence' });
    }
  }

  bunker(x, z, groundY, poiId, { mythic = false } = {}) {
    const T = this.T, w = this.w;
    const c = T.cellOf(x, z);
    T.setHole(c.i, c.j);
    const S = TSTEP;
    const x0 = c.x0, z0 = c.z0, x1 = x0 + S, z1 = z0 + S;
    const gy = groundY;
    const floorY = gy - 5.6;
    const conc = 0x8a8f94, dark = 0x55595e;
    const ind = { destr: false, mat: 'stone' };
    // ramp in the shaft: high (ground) at north (z0), low at south (z1)
    w.phys.ramp(x0, floorY, z0, x1, gy + 0.02, z1, 3, null);
    const ang = Math.atan2(gy - floorY, S);
    w.addRotBoxW((x0 + x1) / 2, (gy + floorY) / 2 - 0.12, (z0 + z1) / 2, S, 0.22, Math.hypot(S, gy - floorY), ang, 0, 0, dark, false);
    // shaft walls (below + above ground)
    const top = gy + 3.2;
    w.addBoxW(x0 - 0.3, floorY - 0.5, (z0 + z1) / 2, 0.6, top - floorY + 0.5, S + 0.6, conc, ind);
    w.addBoxW(x1 + 0.3, floorY - 0.5, (z0 + z1) / 2, 0.6, top - floorY + 0.5, S + 0.6, conc, ind);
    // north wall: open doorway above ground, solid below ground
    w.addBoxW((x0 + x1) / 2, floorY - 0.5, z0 - 0.3, S + 1.2, gy - floorY + 0.5, 0.6, conc, ind);
    w.addBoxW(x0 + 1.2, gy, z0 - 0.3, 2.4, 3.2, 0.6, conc, ind);
    w.addBoxW(x1 - 1.2, gy, z0 - 0.3, 2.4, 3.2, 0.6, conc, ind);
    w.addBoxW((x0 + x1) / 2, gy + 2.6, z0 - 0.3, S, 0.6, 0.6, conc, ind);
    // south wall above ground
    w.addBoxW((x0 + x1) / 2, gy - 1.2, z1 + 0.3, S + 1.2, top - gy + 1.2, 0.6, conc, ind);
    w.addBoxW((x0 + x1) / 2, top, (z0 + z1) / 2, S + 1.4, 0.4, S + 1.8, dark, ind);
    w.footprints.push({ x0: x0 - 1, z0: z0 - 1, x1: x1 + 1, z1: z1 + 1, color: 0x666666 });
    // underground room south of shaft
    const rx0 = x0 - 6, rx1 = x1 + 6, rz0 = z1, rz1 = z1 + 16;
    const ceil = gy - 1.4;
    w.addBoxW((rx0 + rx1) / 2, floorY - 0.6, (rz0 + rz1) / 2, rx1 - rx0 + 1, 0.6, rz1 - rz0 + 1, dark, ind);
    w.addBoxW((rx0 + rx1) / 2, ceil, (rz0 + rz1) / 2, rx1 - rx0 + 1, 0.5, rz1 - rz0 + 1, dark, ind);
    w.addBoxW(rx0 - 0.3, floorY - 0.6, (rz0 + rz1) / 2, 0.6, ceil - floorY + 1.2, rz1 - rz0 + 1, conc, ind);
    w.addBoxW(rx1 + 0.3, floorY - 0.6, (rz0 + rz1) / 2, 0.6, ceil - floorY + 1.2, rz1 - rz0 + 1, conc, ind);
    w.addBoxW((rx0 + rx1) / 2, floorY - 0.6, rz1 + 0.3, rx1 - rx0 + 1, ceil - floorY + 1.2, 0.6, conc, ind);
    // north wall of room either side of the shaft opening
    w.addBoxW((rx0 + x0) / 2, floorY - 0.6, rz0 - 0.3, x0 - rx0 + 0.6, ceil - floorY + 1.2, 0.6, conc, ind);
    w.addBoxW((x1 + rx1) / 2, floorY - 0.6, rz0 - 0.3, rx1 - x1 + 0.6, ceil - floorY + 1.2, 0.6, conc, ind);
    // shaft wall below the floor of the opening (south side of ramp) is open into the room
    w.phys.underground.push({ minX: rx0 - 1, maxX: rx1 + 1, minZ: rz0 - 0.1, maxZ: rz1 + 1, maxY: ceil });
    w.phys.underground.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, maxY: gy - 0.3 });
    // contents
    const mid = (rx0 + rx1) / 2;
    w.chestSpots.push({ x: mid, y: floorY, z: rz1 - 2, poi: poiId, rare: true, mythic });
    w.chestSpots.push({ x: rx0 + 2, y: floorY, z: rz1 - 3, poi: poiId, rare: true });
    w.chestSpots.push({ x: rx1 - 2, y: floorY, z: rz0 + 3, poi: poiId, rare: false });
    w.floorSpots.push({ x: mid - 4, y: floorY, z: rz0 + 6, poi: poiId });
    w.floorSpots.push({ x: mid + 4, y: floorY, z: rz0 + 8, poi: poiId });
    w.ammoSpots.push({ x: mid, y: floorY, z: rz0 + 9, poi: poiId });
    for (let i = 0; i < 3; i++) w.addBoxW(rx0 + 2 + i * 5, floorY, rz0 + 12, 1.4, 1.4, 1.4, 0x5d6b52, { mat: 'metal', hp: 150, kind: 'crate' });
    w.addBoxW(mid, floorY, rz1 - 0.8, 6, 3, 0.4, 0xffd94a, { decor: true });
  }

  // ---------------- named locations ----------------
  poi_city(p) {
    const y = this.T.poiHeight(p.id);
    this.T.addPaint(p.x, p.z, p.r + 20, 0x5c5f66, 0.15);
    const pitch = 46;
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
      const bx = p.x + i * pitch, bz = p.z + j * pitch;
      const dc = Math.hypot(i * pitch, j * pitch);
      if (dc > p.r - 12) continue;
      // sidewalk block plate
      this.w.addBoxW(bx, y - 0.6, bz, 34, 0.8, 34, 0xa8a8a2, { destr: false, mat: 'stone' });
      this.w.footprints.push({ x0: bx - 17, z0: bz - 17, x1: bx + 17, z1: bz + 17, color: 0x9a9a96 });
      const yb = y + 0.2;
      if (i === 0 && j === 0) {
        // central plaza with a fountain and statue
        const b = this.B(bx, bz, 0, p, yb);
        b.cyl(0, 0, 0, 5, 0.8, 0xd0d0d0, { destr: false });
        b.cyl(0, 0.8, 0, 4.3, 0.1, 0x47a3e8, { solid: false, destr: false });
        b.box(0, 0.8, 0, 1.4, 3.5, 1.4, 0xcfa64a, { mat: 'metal', hp: 500 });
        for (const [tx, tz] of [[-12, -12], [12, -12], [-12, 12], [12, 12]]) this.w.addTree(bx + tx, bz + tz, 'round', 1.0, true);
        b.chest(8, 0, 0, true);
        b.loot(-8, 0, 3); b.loot(3, 0, -9);
        continue;
      }
      const rot = this.ri(0, 3);
      const kind = dc < 75 ? (this.rng() < 0.65 ? 'tower' : 'mid') : this.pick(['mid', 'shop', 'mid', 'shops', 'tower']);
      if (kind === 'tower') {
        const b = this.B(bx, bz, rot, p, yb);
        const s = this.r(16, 22);
        this.tower(b, { w: s, d: s, h: this.r(28, 58) });
        this.car(b, 12, -14, 0);
      } else if (kind === 'mid') {
        this.midrise(this.B(bx - 8, bz, this.ri(0, 3), p, yb), { floors: this.ri(2, 4) });
        if (this.rng() < 0.6) this.shop(this.B(bx + 9, bz - 6, rot, p, yb));
        else this.midrise(this.B(bx + 8, bz + 2, this.ri(0, 3), p, yb), { floors: this.ri(2, 3), w: 12, d: 12 });
      } else {
        this.shop(this.B(bx - 8, bz - 8, 0, p, yb));
        this.shop(this.B(bx + 8, bz - 8, 0, p, yb));
        if (this.rng() < 0.7) this.shop(this.B(bx - 8, bz + 8, 2, p, yb));
        this.house(this.B(bx + 8, bz + 8, 2, p, yb), { floors: 2, flatRoof: true, wall: 0xc9b9a6 });
      }
      // lamps & cars on the streets around the block
      for (let k = 0; k < 2; k++) {
        const side = this.ri(0, 3);
        const off = this.r(-14, 14);
        const lx = side < 2 ? off : (side === 2 ? -23 : 23);
        const lz = side < 2 ? (side === 0 ? -23 : 23) : off;
        if (this.rng() < 0.6) this.car(this.B(bx, bz, 0, p, y), lx, lz, side < 2 ? 0 : 1);
      }
      for (const [lx, lz] of [[-17.5, -17.5], [17.5, 17.5]]) {
        this.w.addBoxW(bx + lx, yb, bz + lz, 0.25, 6, 0.25, 0x333840, { mat: 'metal', hp: 150, kind: 'prop' });
        this.w.addBoxW(bx + lx, yb + 6, bz + lz, 1.2, 0.25, 0.4, 0xfff4c0, { decor: true });
      }
    }
  }

  poi_suburb(p) {
    const y = this.T.poiHeight(p.id);
    // two streets east-west, houses on both sides
    this.T.addPaint(p.x, p.z, p.r + 10, 0x6aa24a, 0.4);
    for (const sz of [-30, 30]) {
      for (let xi = -4; xi <= 4; xi++) {
        const hx = p.x + xi * 24;
        for (const side of [-1, 1]) {
          const hz = p.z + sz + side * 16;
          if (Math.hypot(hx - p.x, hz - p.z) > p.r - 10) continue;
          if (this.rng() < 0.12) continue;
          const b = this.B(hx, hz, side < 0 ? 2 : 0, p, y);
          this.house(b, { floors: this.rng() < 0.6 ? 2 : 1 });
          // yard
          const [ax, az] = b.tx(-8, 0), [bx2, bz2] = b.tx(-8, 9);
          this.fenceLine(ax, az, bx2, bz2);
          if (this.rng() < 0.5) this.car(b, 8, -4, 1);
          const [tx, tz] = b.tx(this.r(-5, 5), 8.5);
          this.w.addTree(tx, tz, this.rng() < 0.3 ? 'autumn' : 'round', this.r(0.8, 1.2));
        }
      }
    }
    // little park with a playground
    const b = this.B(p.x, p.z, 0, p, y);
    b.box(-3, 0, 0, 6, 0.4, 3, 0xd94a4a, { mat: 'wood', hp: 100 });
    b.box(3, 0, 0, 0.3, 2.5, 0.3, 0x3a7ad9, { mat: 'metal', hp: 100 });
    b.chest(0, 0.2, 2);
  }

  poi_factory(p) {
    const y = this.T.poiHeight(p.id);
    this.T.addPaint(p.x, p.z, p.r + 10, 0x55524c, 0.2);
    this.w.addBoxW(p.x, y - 1, p.z, p.r * 1.6, 1.15, p.r * 1.6, 0x5c5a55, { destr: false });
    const yb = y + 0.15;
    const spots = [[-45, -40, 0], [5, -45, 1], [50, -30, 0], [-40, 20, 1], [30, 30, 2]];
    for (const [dx, dz, rot] of spots) this.warehouse(this.B(p.x + dx, p.z + dz, rot, p, yb));
    // smokestacks and tanks
    for (const [dx, dz] of [[-10, 5], [-3, 12]]) this.w.addCylW(p.x + dx, yb, p.z + dz, 2.2, 40, 0x9a5a48, { destr: false });
    for (const [dx, dz] of [[60, 20], [66, 30], [60, 40]]) {
      this.w.addCylW(p.x + dx, yb, p.z + dz, 4, 8, 0xd8d8d0, { mat: 'metal', hp: 900 });
      this.w.chestSpots.push({ x: p.x + dx, y: yb + 8, z: p.z + dz, poi: p.id, rare: false });
    }
    // container yard
    const cb = this.B(p.x - 5, p.z + 60, 0, p, yb);
    const cc = [0xc24a3a, 0x3a72c2, 0x3aa25a, 0xe2a23a, 0x8a4ac2];
    for (let i = 0; i < 6; i++) {
      const lx = -25 + i * 8, lz = this.r(-6, 6);
      this.container(cb, lx, 0, lz, false, this.pick(cc));
      if (this.rng() < 0.5) {
        this.container(cb, lx, 2.6, lz + this.r(-1, 1), false, this.pick(cc));
        if (this.rng() < 0.5) cb.chest(lx, 5.2, lz);
      } else if (this.rng() < 0.5) cb.loot(lx + 2.5, 0, lz);
    }
    // explosive barrels
    for (let i = 0; i < 10; i++) {
      this.w.addCylW(p.x + this.r(-60, 60), yb, p.z + this.r(-60, 60), 0.45, 1.1, 0xd83a2a, { kind: 'barrel', mat: 'metal', hp: 60, explosive: true });
    }
    // perimeter fence
    const R = p.r - 5;
    this.fenceLine(p.x - R, p.z - R, p.x + R, p.z - R, 0x8a9096, 2.2, 'metal');
    this.fenceLine(p.x - R, p.z + R, p.x + R - 20, p.z + R, 0x8a9096, 2.2, 'metal');
  }

  poi_lab(p) {
    const y = this.T.poiHeight(p.id);
    this.T.addPaint(p.x, p.z, p.r + 10, 0xb8bcc0, 0.15);
    this.w.addBoxW(p.x, y - 1, p.z, p.r * 1.5, 1.1, p.r * 1.5, 0xc4c8cc, { destr: false });
    const yb = y + 0.1;
    // main lab building (two wings)
    const b = this.B(p.x, p.z - 20, 0, p, yb);
    const w = 30, d = 16, H = 4.2, t = 0.35, white = 0xeef2f5, trim = 0x2f6fae;
    b.footprint(w, d, 0xdfe6ec);
    for (let f = 0; f < 2; f++) {
      const y0 = f * H;
      const win = [];
      for (let i = 0; i < 6; i++) win.push({ at: -w / 2 + 2.5 + i * 5, w: 2.6, sill: 0.9, h: 2, glass: true });
      if (f === 0) win[2] = { at: -w / 2 + 12.5, w: 3, sill: 0, h: 3 };
      b.wallX(-w / 2, w / 2, -d / 2 + t / 2, y0, H, t, white, 'metal', win);
      b.wallX(-w / 2, w / 2, d / 2 - t / 2, y0, H, t, white, 'metal', f === 0 ? [{ at: 8, w: 2, sill: 0, h: 2.8 }] : [{ at: 0, w: 4, sill: 0.9, h: 2, glass: true }]);
      b.wallZ(-d / 2 + t, d / 2 - t, -w / 2 + t / 2, y0, H, t, white, 'metal');
      b.wallZ(-d / 2 + t, d / 2 - t, w / 2 - t / 2, y0, H, t, white, 'metal', [{ at: 0, w: 3, sill: 0.9, h: 2, glass: true }]);
      b.wallZ(-d / 2 + t, d / 2 - t, 0, y0, H, 0.25, 0xd0d6dc, 'metal', [{ at: 3, w: 1.8, sill: 0, h: 2.6 }]);
      const hole = { x0: w / 2 - t - 2.6, x1: w / 2 - t, z0: -d / 2 + t, z1: 1.5 };
      b.slab(-w / 2, w / 2, -d / 2, d / 2, y0 + H, 0.3, 0xa9b4bf, { mat: 'metal', hp: 400 }, f === 0 ? hole : null);
      if (f === 0) b.ramp(w / 2 - t - 2.5, -d / 2 + t, w / 2 - t, 2.2, 0, H, 3, 0x9aa5b0, { mat: 'metal' });
      b.via = f === 1 ? [b.wp(w / 2 - t - 1.25, 0, 3.0), b.wp(w / 2 - t - 1.25, 0.4, 1.6), b.wp(w / 2 - t - 1.25, H, -d / 2 + t + 0.6), b.wp(w / 2 - t - 3.2, H, -d / 2 + t + 1)] : null;
      b.chest(-10, y0, 4); b.chest(6, y0, -4);
      b.loot(-5, y0, -3); b.loot(10, y0, 3); b.ammo(-12, y0, -5);
      // lab benches
      b.box(-7, y0, 0, 4, 0.9, 1.2, 0xc9d3db, { mat: 'metal', hp: 120, kind: 'crate' });
      b.box(7, y0, 2, 4, 0.9, 1.2, 0xc9d3db, { mat: 'metal', hp: 120, kind: 'crate' });
    }
    b.via = null;
    b.box(0, 2 * H, -d / 2 - 0.2, w, 0.6, 0.3, trim, { decor: true });
    b.wallX(-w / 2, w / 2, -d / 2 + 0.15, 2 * H, 0.9, 0.3, white, 'metal');
    b.wallX(-w / 2, w / 2, d / 2 - 0.15, 2 * H, 0.9, 0.3, white, 'metal');
    b.chest(-12, 2 * H, -5, true);
    // satellite dish & secondary buildings
    const sb = this.B(p.x + 35, p.z + 20, 1, p, yb);
    this.warehouse(sb, { w: 18, d: 12, h: 6, color: 0xdfe6ec });
    const db = this.B(p.x - 35, p.z + 22, 0, p, yb);
    db.cyl(0, 0, 0, 1, 6, 0xcccccc, { destr: false });
    db.cyl(0, 6, 0, 5, 0.6, 0xf0f0f0, { mat: 'metal', hp: 300 });
    db.chest(3, 0, 3);
    // guard towers
    this.lookout(this.B(p.x - 55, p.z - 55, 0, p, yb), { h: 7 });
    this.lookout(this.B(p.x + 55, p.z - 55, 1, p, yb), { h: 7 });
    // underground vault with a mythic weapon
    this.bunker(p.x + 5, p.z + 30, this.T.heightAt(p.x + 5, p.z + 30), p.id, { mythic: true });
    // perimeter
    const R = p.r - 8;
    this.fenceLine(p.x - R, p.z - R, p.x + R, p.z - R, 0x9aa3ab, 2.4, 'metal');
    this.fenceLine(p.x - R, p.z - R, p.x - R, p.z + R, 0x9aa3ab, 2.4, 'metal');
    this.fenceLine(p.x + R, p.z - R, p.x + R, p.z + R - 25, 0x9aa3ab, 2.4, 'metal');
  }

  poi_farm(p) {
    const y = this.T.poiHeight(p.id);
    this.house(this.B(p.x - 25, p.z - 30, 0, p, y), { floors: 2, wall: 0xf3efe6, roof: 0x7a2f2a });
    this.barn(this.B(p.x + 20, p.z - 25, 1, p, y));
    this.cabin(this.B(p.x - 50, p.z + 5, 1, p, y), { wall: 0xb08a5a });
    for (const [dx, dz] of [[42, -8], [48, 2]]) {
      this.w.addCylW(p.x + dx, y, p.z + dz, 3.2, 14, 0xc9ccd0, { mat: 'metal', hp: 900 });
      this.w.addCylW(p.x + dx, y + 14, p.z + dz, 3.4, 0.6, 0x8a8f94, { solid: false, destr: false });
    }
    this.w.chestSpots.push({ x: p.x + 42, y: y + 14, z: p.z - 8, poi: p.id });
    // crop fields (decorative rows) and hay
    const fields = [[-30, 35, 0xd7b84a], [25, 40, 0x6aa83a], [-60, 60, 0x9bbf4a], [55, 55, 0xd7b84a]];
    for (const [dx, dz, col] of fields) {
      this.T.addPaint(p.x + dx, p.z + dz, 26, 0x7a5a35, 0.1);
      for (let r = -9; r <= 9; r += 3) {
        const fx = p.x + dx + r, fz = p.z + dz;
        const fy = this.T.heightAt(fx, fz);
        this.w.addBoxW(fx, fy - 0.2, fz, 1.2, 1.0, 34, col, { decor: true });
      }
    }
    for (let i = 0; i < 10; i++) {
      const hx = p.x + this.r(-70, 70), hz = p.z + this.r(-10, 80);
      this.w.addCylW(hx, this.T.heightAt(hx, hz) - 0.1, hz, 0.9, 1.4, 0xe2c25a, { mat: 'wood', hp: 70, kind: 'crate' });
    }
    // tractor
    const tb = this.B(p.x, p.z - 5, 0, p, y);
    const obj = this.w.newObj('car', 'metal', 300);
    obj.cx = p.x; obj.cy = y + 1; obj.cz = p.z - 5;
    this.w.addBoxW(p.x, y + 0.6, p.z - 5, 3, 1.2, 1.6, 0x2f9a3a, { obj });
    this.w.addBoxW(p.x - 0.6, y + 1.8, p.z - 5, 1.2, 1.2, 1.4, 0x2f3a40, { obj });
    this.w.addCylW(p.x + 1, y, p.z - 6.1, 0.7, 0.4, 0x111111, { solid: false, destr: false });
    tb.loot(3, 0, 0);
    this.fenceLine(p.x - p.r + 10, p.z + 10, p.x + p.r - 10, p.z + 10, 0xb08a5a);
    this.fenceLine(p.x - p.r + 10, p.z + 95, p.x + p.r - 10, p.z + 95, 0xb08a5a);
  }

  poi_beach(p) {
    const y = this.T.poiHeight(p.id);
    const colors = [0xffd5e5, 0xbff0ff, 0xfff1a8, 0xc8ffd4];
    const spots = [[-35, -25, 1], [-10, -35, 0], [20, -30, 0], [-30, 15, 1], [25, 15, 3]];
    for (const [dx, dz, rot] of spots) this.house(this.B(p.x + dx, p.z + dz, rot, p, y), { floors: this.rng() < 0.5 ? 2 : 1, wall: this.pick(colors), roof: 0x2f9aa6, flatRoof: this.rng() < 0.4 });
    this.lookout(this.B(p.x + 50, p.z + 40, 3, p, y), { h: 4 });
    this.lookout(this.B(p.x - 10, p.z + 50, 3, p, y), { h: 4 });
    for (let i = 0; i < 8; i++) {
      const ux = p.x + this.r(-60, 60), uz = p.z + this.r(30, 70);
      const uy = this.T.heightAt(ux, uz);
      if (uy < 0.5) continue;
      this.w.addBoxW(ux, uy, uz, 0.12, 2.4, 0.12, 0xeeeeee, { decor: true });
      this.w.addCylW(ux, uy + 2.4, uz, 1.4, 0.25, this.pick([0xff5050, 0x50a0ff, 0xffd040]), { solid: false, destr: false });
    }
    this.T.addPaint(p.x, p.z + 30, 80, 0xeedb9e, 0.4);
  }

  poi_abandoned(p) {
    const y = this.T.poiHeight(p.id);
    this.T.addPaint(p.x, p.z, p.r, 0x7e8a58, 0.5);
    const spots = [[-40, -20, 0], [-10, -40, 1], [30, -25, 0], [-35, 25, 2], [10, 20, 3], [40, 30, 2]];
    for (const [dx, dz, rot] of spots) this.house(this.B(p.x + dx, p.z + dz, rot, p, y), { floors: this.rng() < 0.5 ? 2 : 1, wall: this.pick([0x9a9488, 0x8a8f86, 0xa3907c]), roof: 0x4a4440, decay: 0.22 });
    // old chapel
    const b = this.B(p.x + 5, p.z - 5, 0, p, y);
    const cw = 9, cd = 16;
    b.footprint(cw, cd, 0x5a5550);
    this.foundation(b, cw, cd, 0x6f6a62);
    b.decay = 0.12;
    b.wallX(-cw / 2, cw / 2, -cd / 2 + 0.2, 0.25, 6, 0.4, 0xb8b0a0, 'stone', [{ at: 0, w: 2, sill: 0, h: 3.2 }]);
    b.wallX(-cw / 2, cw / 2, cd / 2 - 0.2, 0.25, 6, 0.4, 0xb8b0a0, 'stone', [{ at: 0, w: 1.4, sill: 2.5, h: 2.5, glass: true }]);
    b.wallZ(-cd / 2 + 0.4, cd / 2 - 0.4, -cw / 2 + 0.2, 0.25, 6, 0.4, 0xb8b0a0, 'stone', [{ at: -3, w: 1.2, sill: 2.4, h: 2.4 }, { at: 3, w: 1.2, sill: 2.4, h: 2.4 }]);
    b.wallZ(-cd / 2 + 0.4, cd / 2 - 0.4, cw / 2 - 0.2, 0.25, 6, 0.4, 0xb8b0a0, 'stone', [{ at: -3, w: 1.2, sill: 2.4, h: 2.4 }, { at: 3, w: 1.2, sill: 2.4, h: 2.4 }]);
    b.decay = 0;
    b.gable(0, 6.25, 0, cw + 1, cd + 1, 3.5, 0x4a4440, true);
    b.box(0, 0.25, -cd / 2 - 2, 3.4, 13, 3.4, 0xa8a090, { mat: 'stone', hp: 1200 });
    b.chest(0, 0.25, 5, true);
    b.loot(-2, 0.25, 0); b.loot(2, 0.25, -3);
    for (let i = 0; i < 4; i++) {
      const cx = p.x + this.r(-60, 60), cz = p.z + this.r(-60, 60);
      const cb = this.B(cx, cz, 0, null);
      this.car(cb, 0, 0, this.ri(0, 1));
    }
    for (let i = 0; i < 14; i++) this.w.addTree(p.x + this.r(-80, 80), p.z + this.r(-80, 80), 'dead', this.r(0.8, 1.3));
  }

  poi_lodge(p) {
    const y = this.T.poiHeight(p.id);
    this.house(this.B(p.x, p.z, 0, p, y), { floors: 2, wall: 0x8b5e3c, roof: 0x3d2a1e });
    const spots = [[-35, -20, 1], [32, -25, 3], [-30, 28, 1], [30, 30, 3]];
    for (const [dx, dz, rot] of spots) this.cabin(this.B(p.x + dx, p.z + dz, rot, p, y));
    const b = this.B(p.x, p.z + 20, 0, p, y);
    b.cyl(0, 0, 0, 1.2, 0.4, 0x555555, { destr: false, solid: false });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      b.box(Math.cos(a) * 3, 0, Math.sin(a) * 3, 2, 0.5, 0.5, 0x6b4a2e, { mat: 'wood', hp: 60, kind: 'crate' });
    }
    b.loot(2, 0, 2);
  }

  poi_summit(p) {
    const y = this.T.poiHeight(p.id);
    this.lookout(this.B(p.x, p.z, 0, p, y), { h: 10, rare: true });
    this.cabin(this.B(p.x - 18, p.z + 8, 1, p, y), { wall: 0x7d6a5a });
    // radio mast
    this.w.addBoxW(p.x + 15, y, p.z - 10, 0.6, 30, 0.6, 0xd84a3a, { destr: false });
    this.w.addBoxW(p.x + 15, y + 30, p.z - 10, 1.2, 0.6, 1.2, 0xffffff, { decor: true });
  }

  poi_gas(p) {
    const y = this.T.poiHeight(p.id);
    this.T.addPaint(p.x, p.z, 22, 0x55555a, 0.2);
    this.gasStation(this.B(p.x, p.z, this.ri(0, 3), p, y));
  }

  poi_docks(p) {
    const y = this.T.poiHeight(p.id);
    // find the lake direction
    const lake = LAKES[0];
    const ang = Math.atan2(lake.z - p.z, lake.x - p.x);
    const dx = Math.cos(ang), dz = Math.sin(ang);
    this.cabin(this.B(p.x - dx * 12, p.z - dz * 12, 0, p, y), { wall: 0x6a8fa6, roof: 0x34495e });
    this.warehouse(this.B(p.x - dz * 22 - dx * 10, p.z + dx * 22 - dz * 10, 0, p, y), { w: 16, d: 12, h: 6, color: 0x6a8fa6 });
    // piers out over the water, starting where the shore meets the lake
    let k0 = 6;
    while (k0 < 80 && this.T.heightAt(p.x + dx * k0, p.z + dz * k0) > 1.6) k0 += 2;
    const deckY = 0.95;
    for (const side of [-8, 8]) {
      for (let k = -1; k < 9; k++) {
        const px = p.x + dx * (k0 + k * 4) - dz * side, pz = p.z + dz * (k0 + k * 4) + dx * side;
        this.w.addBoxW(px, deckY - 0.35, pz, 4.2, 0.35, 4.2, 0x9b7a55, { mat: 'wood', hp: 200, kind: 'floor' });
        this.w.addCylW(px, -4, pz, 0.2, 4.6, 0x6b4a2e, { destr: false, solid: false });
      }
      const ex = p.x + dx * (k0 + 30) - dz * side, ez = p.z + dz * (k0 + 30) + dx * side;
      this.w.chestSpots.push({ x: ex, y: deckY, z: ez, poi: p.id });
      // moored boat
      this.w.addBoxW(ex - dz * 4, -0.3, ez + dx * 4, 2.2, 1.0, 2.2, 0xffffff, { mat: 'metal', hp: 200, kind: 'car' });
    }
    this.w.floorSpots.push({ x: p.x + dx * (k0 + 12) - dz * 8, y: deckY, z: p.z + dz * (k0 + 12) + dx * 8, poi: p.id });

  }

  hidden(h) {
    const y = this.T.poiHeight(h.id);
    this.w.labels.push({ name: h.name, x: h.x, z: h.z, big: false });
    if (h.kind === 'hut') {
      this.cabin(this.B(h.x, h.z, this.ri(0, 3), null, y), { rare: true, wall: 0x7a6a5a });
      this.w.chestSpots.forEach((c) => { if (Math.hypot(c.x - h.x, c.z - h.z) < 10) c.poi = h.id; });
    } else if (h.kind === 'tree') {
      const b = this.B(h.x, h.z, 0, null, y);
      b.cyl(0, 0, 0, 1.4, 14, 0x6b4a2e, { destr: false });
      this.w.addTree(h.x, h.z, 'round', 3.2, true);
      b.box(0, 7, 0, 7, 0.3, 7, 0x8b6a45, { mat: 'wood', hp: 400, kind: 'floor' });
      b.wallX(-3.5, 3.5, -3.35, 7.3, 1, 0.25, 0x8b6a45, 'wood');
      b.wallZ(-3.2, 3.2, 3.35, 7.3, 1, 0.25, 0x8b6a45, 'wood');
      b.ramp(-6, -3.4, -3.55, 6, 0, 7.3, 3, 0x8b6a45);
      b.poi = h.id;
      b.via = [b.wp(-4.8, 0, 6.8), b.wp(-4.8, 0.4, 5.6), b.wp(-4.8, 7.3, -2.6), b.wp(-2, 7.3, -2)];
      b.chest(2, 7.3, 2, true);
      b.loot(-1, 7.3, 1);
      b.via = null;
    } else if (h.kind === 'bunker') {
      this.bunker(h.x, h.z, this.T.heightAt(h.x, h.z), h.id, { mythic: false });
    }
  }

  scatterBuildings() {
    // Lone houses, cabins and ruins dotted around the island
    let placed = 0;
    for (let tries = 0; tries < 400 && placed < 26; tries++) {
      const x = this.r(-720, 720), z = this.r(-720, 720);
      const y = this.T.heightAt(x, z);
      if (y < 3 || y > 60 || this.T.islandMask(x, z) < 0.95) continue;
      if (this.T.slopeAt(x, z) > 0.18 || this.T.slopeAt(x + 6, z + 6) > 0.18 || this.T.slopeAt(x - 6, z - 6) > 0.18) continue;
      if (POIS.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + 40)) continue;
      if (HIDDEN.some((p) => Math.hypot(p.x - x, p.z - z) < 40)) continue;
      if (this.nearRiver(x, z, 30)) continue;
      const tmp = [];
      if (this.w.phys.query(x - 14, z - 14, x + 14, z + 14, tmp).length) continue;
      const k = this.rng();
      const b = this.B(x, z, this.ri(0, 3), null, y);
      if (k < 0.4) this.house(b, { floors: this.rng() < 0.5 ? 1 : 2, decay: this.rng() < 0.4 ? 0.25 : 0 });
      else if (k < 0.8) this.cabin(b, { decay: this.rng() < 0.3 ? 0.2 : 0 });
      else this.lookout(b, { h: 6 });
      placed++;
    }
  }

  nearRiver(x, z, m) {
    for (const r of RIVERS) for (let k = 0; k < r.pts.length - 1; k++) {
      const a = r.pts[k], b = r.pts[k + 1];
      if (segDist(x, z, a[0], a[1], b[0], b[1]).d < r.w + m) return true;
    }
    for (const l of LAKES) if (Math.hypot(x - l.x, z - l.z) < l.r + m) return true;
    return false;
  }

  roads() {
    const T = this.T, w = this.w;
    const pos = [], col = [], idx = [];
    const asphalt = new THREE.Color(0x3d3f44), line = new THREE.Color(0xf2e6a0);
    const half = 4;
    for (const road of ROADS) {
      // resample
      const pts = [];
      for (let k = 0; k < road.length - 1; k++) {
        const [ax, az] = road[k], [bx, bz] = road[k + 1];
        const len = Math.hypot(bx - ax, bz - az);
        const n = Math.ceil(len / 4);
        for (let i = 0; i < n; i++) pts.push({ x: ax + (bx - ax) * (i / n), z: az + (bz - az) * (i / n) });
      }
      pts.push({ x: road[road.length - 1][0], z: road[road.length - 1][1] });
      for (const p of pts) {
        p.h = T.heightAt(p.x, p.z);
      }
      // directions
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
        pts[i].nx = -dz / l; pts[i].nz = dx / l;
        pts[i].y = Math.max(T.heightAt(pts[i].x + pts[i].nx * half, pts[i].z + pts[i].nz * half), T.heightAt(pts[i].x - pts[i].nx * half, pts[i].z - pts[i].nz * half), pts[i].h) + 0.12;
      }
      // bridges over water
      let i = 0;
      while (i < pts.length) {
        if (pts[i].h < 1.2) {
          let j = i;
          while (j < pts.length && pts[j].h < 1.2) j++;
          const i0 = Math.max(0, i - 2), i1 = Math.min(pts.length - 1, j + 1);
          const deck = Math.max(pts[i0].y, pts[i1].y, 3.2);
          for (let k = i0; k <= i1; k++) pts[k].y = Math.max(pts[k].y, deck);
          for (let k = i0; k <= i1; k++) {
            const p = pts[k];
            // walkable deck colliders + rails
            for (const s of [-2.7, 0, 2.7]) {
              w.addBoxW(p.x + p.nx * s, deck - 0.6, p.z + p.nz * s, 3, 0.6, 3, 0x6d6d70, { destr: false, decor: false, mat: 'stone' });
            }
            for (const s of [-half - 0.2, half + 0.2]) {
              w.addBoxW(p.x + p.nx * s, deck, p.z + p.nz * s, 1.2, 1.0, 1.2, 0xb0b0b0, { destr: false, mat: 'stone' });
            }
            if ((k - i0) % 3 === 0) w.addCylW(p.x, -6, p.z, 0.8, deck - 0.6 + 6, 0x7a7a7a, { destr: false });
          }
          i = j + 1;
        } else i++;
      }
      w.roads.push(pts.map((p) => ({ x: p.x, z: p.z })));
      // ribbon
      const base = pos.length / 3;
      for (let k = 0; k < pts.length; k++) {
        const p = pts[k];
        pos.push(p.x + p.nx * half, p.y, p.z + p.nz * half, p.x - p.nx * half, p.y, p.z - p.nz * half);
        col.push(asphalt.r, asphalt.g, asphalt.b, asphalt.r, asphalt.g, asphalt.b);
        if (k < pts.length - 1) {
          const a = base + k * 2;
          idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
      }
      // centre dashes
      for (let k = 0; k < pts.length - 1; k += 3) {
        const p = pts[k], q = pts[k + 1];
        const b2 = pos.length / 3;
        const s = 0.15;
        pos.push(p.x + p.nx * s, p.y + 0.02, p.z + p.nz * s, p.x - p.nx * s, p.y + 0.02, p.z - p.nz * s, q.x + q.nx * s, q.y + 0.02, q.z + q.nz * s, q.x - q.nx * s, q.y + 0.02, q.z - q.nz * s);
        for (let c = 0; c < 4; c++) col.push(line.r, line.g, line.b);
        idx.push(b2, b2 + 2, b2 + 1, b2 + 1, b2 + 2, b2 + 3);
      }
      // parked cars along roads
      for (let k = 10; k < pts.length - 10; k += 14) {
        if (this.rng() > 0.25) continue;
        const p = pts[k];
        if (p.h < 1.5) continue;
        if (POIS.some((q) => q.type === 'city' && Math.hypot(q.x - p.x, q.z - p.z) < q.r)) continue;
        const s = this.rng() < 0.5 ? 6 : -6;
        const cx = p.x + p.nx * s, cz = p.z + p.nz * s;
        const b = this.B(cx, cz, 0, null);
        this.car(b, 0, 0, Math.abs(p.nx) > Math.abs(p.nz) ? 1 : 0);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    mesh.receiveShadow = true;
    this.w.scene.add(mesh);
    this.w.roadMesh = mesh;
  }

  nearRoad(x, z, m) {
    for (const road of ROADS) for (let k = 0; k < road.length - 1; k++) {
      if (segDist(x, z, road[k][0], road[k][1], road[k + 1][0], road[k + 1][1]).d < m) return true;
    }
    return false;
  }

  okTreeSpot(x, z) {
    for (const p of POIS) if (Math.hypot(p.x - x, p.z - z) < p.r * 0.85) return false;
    for (const h of HIDDEN) if (Math.hypot(h.x - x, h.z - z) < 14) return false;
    if (this.nearRoad(x, z, 7)) return false;
    const tmp = [];
    if (this.w.phys.query(x - 2.5, z - 2.5, x + 2.5, z + 2.5, tmp).length) return false;
    return true;
  }

  forests() {
    for (const f of FORESTS) {
      const n = Math.round((Math.PI * f.r * f.r) / 170 * f.density);
      for (let i = 0; i < n; i++) {
        const a = this.r(0, Math.PI * 2), d = Math.sqrt(this.rng()) * f.r;
        const x = f.x + Math.cos(a) * d, z = f.z + Math.sin(a) * d;
        if (!this.okTreeSpot(x, z)) continue;
        const y = this.T.heightAt(x, z);
        const type = y > 45 || this.rng() < 0.55 ? 'pine' : this.rng() < 0.15 ? 'autumn' : 'round';
        this.w.addTree(x, z, type, this.r(0.8, 1.45));
      }
    }
    // scattered trees everywhere
    for (let i = 0; i < 1400; i++) {
      const x = this.r(-820, 820), z = this.r(-820, 820);
      if (this.T.islandMask(x, z) < 0.9) continue;
      if (!this.okTreeSpot(x, z)) continue;
      const y = this.T.heightAt(x, z);
      if (y > 100) continue;
      this.w.addTree(x, z, y > 40 ? 'pine' : this.rng() < 0.5 ? 'round' : 'pine', this.r(0.7, 1.3));
    }
    // palm-like trees on beaches
    for (let i = 0; i < 400; i++) {
      const x = this.r(-850, 850), z = this.r(-850, 850);
      const y = this.T.heightAt(x, z);
      if (y < 1.6 || y > 3.2) continue;
      if (!this.okTreeSpot(x, z)) continue;
      this.w.addTree(x, z, 'round', this.r(0.7, 1.0));
    }
  }

  rocksAndProps() {
    for (let i = 0; i < 900; i++) {
      const x = this.r(-820, 820), z = this.r(-820, 820);
      const y = this.T.heightAt(x, z);
      if (y < 1 || this.T.islandMask(x, z) < 0.9) continue;
      if (!this.okTreeSpot(x, z)) continue;
      const big = y > 40 ? 1.6 : 1;
      this.w.addRock(x, z, this.r(1.2, 3.2) * big);
    }
    // supply crates / wooden pallets in the wild (harvestable)
    for (let i = 0; i < 120; i++) {
      const x = this.r(-760, 760), z = this.r(-760, 760);
      const y = this.T.heightAt(x, z);
      if (y < 2 || !this.okTreeSpot(x, z)) continue;
      this.w.addBoxW(x, y - 0.1, z, 1.3, 1.3, 1.3, 0x9c6b3c, { mat: 'wood', hp: 90, kind: 'crate' });
      if (this.rng() < 0.3) this.w.floorSpots.push({ x: x + 1.5, y, z, poi: null });
    }
  }
}

export { clamp };
