'use strict';
// Seeded map generators. A map spec (from the world data files) is turned into a tile grid,
// buildings, warps, NPC spots, item spots and exits. Same seed => same map every time.
MB.MapGen = (function () {
  const PASS = new Set(['.', ',', ':', '=', 's', 'F', 'L', 'i', 'K', 'E', '>', 'e', '_', 'u', 'G', 'q', 't', 'd', 'R', 'r']);
  function grid(w, h, ch) { return Array.from({ length: h }, () => Array(w).fill(ch)); }
  function inb(g, x, y) { return y >= 0 && y < g.length && x >= 0 && x < g[0].length; }
  function blob(g, r, cx, cy, rx, ry, ch, canOverwrite) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      if (!inb(g, x, y)) continue;
      const dx = (x - cx) / (rx + 0.5), dy = (y - cy) / (ry + 0.5);
      if (dx * dx + dy * dy + r.range(-0.25, 0.25) <= 1 && canOverwrite(g[y][x], x, y)) g[y][x] = ch;
    }
  }
  function carvePath(g, r, pts, ch, width, keep) {
    const cells = [];
    for (let i = 0; i < pts.length - 1; i++) {
      let [x, y] = pts[i]; const [tx, ty] = pts[i + 1];
      let guard = 0;
      while ((x !== tx || y !== ty) && guard++ < 2000) {
        for (let a = 0; a < width; a++) for (let b = 0; b < width; b++) if (inb(g, x + a, y + b) && !(keep && keep.has(g[y + b][x + a]))) { g[y + b][x + a] = ch; cells.push([x + a, y + b]); }
        const dx = Math.sign(tx - x), dy = Math.sign(ty - y);
        const wig = r.chance(0.18);
        if (dx && (!dy || r.chance(0.5)) && !wig) x += dx;
        else if (dy && !wig) y += dy;
        else if (wig) { if (dx) y += r.pick([-1, 0, 1]) * (dy ? 0 : 1); else x += r.pick([-1, 0, 1]); x = MB.clamp(x, 1, g[0].length - 2); y = MB.clamp(y, 1, g.length - 2); }
      }
      for (let a = 0; a < width; a++) for (let b = 0; b < width; b++) if (inb(g, tx + a, ty + b) && !(keep && keep.has(g[ty + b][tx + a]))) { g[ty + b][tx + a] = ch; cells.push([tx + a, ty + b]); }
    }
    return cells;
  }
  function flood(g, sx, sy, passFn) {
    const H = g.length, W = g[0].length, seen = new Uint8Array(W * H), q = [[sx, sy]];
    seen[sy * W + sx] = 1;
    while (q.length) {
      const [x, y] = q.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny * W + nx]) continue;
        if (!passFn(g[ny][nx])) continue;
        seen[ny * W + nx] = 1; q.push([nx, ny]);
      }
    }
    return seen;
  }
  // exit opening positions on a side
  function exitPos(spec, side, idx, w, h, r) {
    const ex = spec.exits.filter((e) => e.side === side);
    const k = ex.length;
    const len = side === 'n' || side === 's' ? w : h;
    const i = ex.indexOf(spec.exits[idx]);
    let p = spec.exits[idx].at !== undefined ? spec.exits[idx].at : Math.floor((len * (i + 1)) / (k + 1)) + (k === 1 ? r.int(-Math.floor(len / 6), Math.floor(len / 6)) : 0);
    p = MB.clamp(p, 3, len - 5);
    spec.exits[idx].at = p;
    return p;
  }
  function openExits(g, spec, r, ground) {
    const w = g[0].length, h = g.length;
    const pts = [];
    spec.exits.forEach((e, i) => {
      const p = exitPos(spec, e.side, i, w, h, r);
      const wdt = 3;
      for (let k = 0; k < wdt; k++) for (let d = 0; d < 3; d++) {
        if (e.side === 'n') g[d][p + k] = ground;
        if (e.side === 's') g[h - 1 - d][p + k] = ground;
        if (e.side === 'w') g[p + k][d] = ground;
        if (e.side === 'e') g[p + k][w - 1 - d] = ground;
      }
      e.cells = [];
      for (let k = 0; k < wdt; k++) {
        if (e.side === 'n') e.cells.push([p + k, 0]);
        if (e.side === 's') e.cells.push([p + k, h - 1]);
        if (e.side === 'w') e.cells.push([0, p + k]);
        if (e.side === 'e') e.cells.push([w - 1, p + k]);
      }
      const inner = e.side === 'n' ? [p + 1, 2] : e.side === 's' ? [p + 1, h - 3] : e.side === 'w' ? [2, p + 1] : [w - 3, p + 1];
      e.inner = inner;
      pts.push(inner);
    });
    return pts;
  }
  function freeCells(g, pred) { const out = []; for (let y = 1; y < g.length - 1; y++) for (let x = 1; x < g[0].length - 1; x++) if (pred(g[y][x], x, y)) out.push([x, y]); return out; }

  // ======================= ROUTE =======================
  function route(spec) {
    const r = new MB.RNG('map:' + spec.id);
    const w = spec.w || 30, h = spec.h || 40;
    const g = grid(w, h, '.');
    const wall = spec.wall || 'T';
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) g[y][x] = wall;
    const pts = openExits(g, spec, r, '.');
    if (!pts.length) pts.push([Math.floor(w / 2), h - 4]);
    // waypoints for a winding road
    const way = [pts[0]];
    const nW = Math.max(1, Math.floor((w * h) / 500));
    for (let i = 0; i < nW; i++) way.push([r.int(4, w - 6), r.int(4, h - 6)]);
    way.sort((a, b) => (Math.abs(a[0] - pts[0][0]) + Math.abs(a[1] - pts[0][1])) - (Math.abs(b[0] - pts[0][0]) + Math.abs(b[1] - pts[0][1])));
    const ordered = [pts[0], ...way.slice(1)];
    for (let i = 1; i < pts.length; i++) ordered.push(pts[i]);
    const pathCh = spec.path || ':';
    const pathCells = carvePath(g, r, ordered, pathCh, 2);
    for (let i = 1; i < pts.length - 1; i++) carvePath(g, r, [way[Math.floor(way.length / 2)] || pts[0], pts[i]], pathCh, 2);
    const onPath = new Set(pathCells.map(([x, y]) => x + ',' + y));
    const nearPath = (x, y, d) => { for (let a = -d; a <= d; a++) for (let b = -d; b <= d; b++) if (onPath.has(x + a + ',' + (y + b))) return true; return false; };
    // water
    const waterCh = spec.waterCh || '~';
    if (spec.water) for (let i = 0; i < spec.water; i++) {
      const cx = r.int(5, w - 6), cy = r.int(5, h - 6);
      blob(g, r, cx, cy, r.int(3, 6), r.int(2, 5), waterCh, (c, x, y) => c === '.' && !nearPath(x, y, 1) && x > 2 && y > 2 && x < w - 3 && y < h - 3);
    }
    if (spec.river) {
      const horiz = h > w ? true : false;
      const at = horiz ? r.int(Math.floor(h * 0.3), Math.floor(h * 0.7)) : r.int(Math.floor(w * 0.3), Math.floor(w * 0.7));
      for (let k = 0; k < (horiz ? w : h); k++) for (let t = 0; t < 3; t++) {
        const x = horiz ? k : at + t + Math.round(Math.sin(k * 0.3) * 1.5), y = horiz ? at + t + Math.round(Math.sin(k * 0.3) * 1.5) : k;
        if (!inb(g, x, y)) continue;
        if (g[y][x] === wall && (horiz ? k < 2 || k >= w - 2 : k < 2 || k >= h - 2)) continue;
        g[y][x] = onPath.has(x + ',' + y) && !spec.surfRiver ? 'K' : '~';
      }
    }
    // trees
    const treeDensity = spec.trees !== undefined ? spec.trees : 0.5;
    const nT = Math.floor((w * h * treeDensity) / 60);
    for (let i = 0; i < nT; i++) {
      const cx = r.int(2, w - 3), cy = r.int(2, h - 3);
      blob(g, r, cx, cy, r.int(1, 3), r.int(1, 2), wall, (c, x, y) => c === '.' && !nearPath(x, y, 1));
    }
    // tall grass
    const grassAmt = spec.grass !== undefined ? spec.grass : 0.6;
    const nG = Math.floor((w * h * grassAmt) / 70);
    for (let i = 0; i < nG; i++) {
      const p = r.chance(0.6) ? r.pick(pathCells) : [r.int(3, w - 4), r.int(3, h - 4)];
      if (!p) continue;
      blob(g, r, p[0] + r.int(-3, 3), p[1] + r.int(-3, 3), r.int(2, 4), r.int(1, 3), ',', (c, x, y) => (c === '.' || (c === pathCh && r.chance(spec.forceGrass ? 0.9 : 0.35))) && x > 1 && y > 1 && x < w - 2 && y < h - 2);
    }
    // Velorian rift barriers: a Bright crystal row, a gap, then a Gloam crystal row across the road.
    // Passing needs the Rift Lens: shift to Gloam, cross, stand in the gap, shift to Bright, cross.
    if (spec.rift) {
      const used = [];
      for (let i = 0; i < spec.rift; i++) {
        const c = r.pick(pathCells); if (!c) break;
        if (used.some(([a, b]) => Math.abs(a - c[0]) + Math.abs(b - c[1]) < 8)) continue;
        if (pts.some(([a, b]) => Math.abs(a - c[0]) + Math.abs(b - c[1]) < 6)) continue;
        used.push(c);
        const horiz = onPath.has(c[0] + 1 + ',' + c[1]) && onPath.has(c[0] - 1 + ',' + c[1]);
        const layers = r.chance(0.5) ? ['R', null, 'r'] : ['r', null, 'R'];
        layers.forEach((ch, li) => {
          if (!ch) return;
          for (let k = -3; k <= 4; k++) {
            const x = horiz ? c[0] + li : c[0] + k, y = horiz ? c[1] + k : c[1] + li;
            if (!inb(g, x, y) || x < 2 || y < 2 || x >= w - 2 || y >= h - 2) continue;
            const t = g[y][x];
            if (t === '.' || t === ',' || t === pathCh || t === 'F' || t === wall) g[y][x] = ch;
          }
        });
      }
      for (let i = 0; i < spec.rift * 2; i++) blob(g, r, r.int(3, w - 4), r.int(3, h - 4), r.int(1, 2), r.int(1, 2), r.chance(0.5) ? 'R' : 'r', (t, x, y) => t === '.' && !nearPath(x, y, 1));
    }
    // ledges (south-facing one-way)
    if (spec.ledges) for (let i = 0; i < spec.ledges; i++) {
      const y = r.int(6, h - 8), x0 = r.int(3, w / 2), len = r.int(5, w - 8);
      for (let x = x0; x < Math.min(w - 3, x0 + len); x++) if (g[y][x] === '.' || g[y][x] === ',') g[y][x] = 'L';
    }
    // flowers
    for (let i = 0; i < (spec.flowers !== undefined ? spec.flowers : 6); i++) blob(g, r, r.int(3, w - 4), r.int(3, h - 4), r.int(1, 2), 1, 'F', (c) => c === '.');
    // rocks & features
    if (spec.boulders) for (let i = 0; i < spec.boulders; i++) { const c = r.pick(freeCells(g, (ch, x, y) => ch === '.' && !nearPath(x, y, 1))); if (c) g[c[1]][c[0]] = 'B'; }
    // gated alcoves with treasure
    const alcoves = [];
    for (const gate of spec.gates || []) {
      const cells = freeCells(g, (ch, x, y) => (ch === wall || ch === '.') && x > 4 && y > 4 && x < w - 6 && y < h - 6 && !nearPath(x, y, 2) && nearPath(x, y, 5));
      const c = r.pick(cells); if (!c) continue;
      const [ax, ay] = c;
      for (let y = ay - 2; y <= ay + 2; y++) for (let x = ax - 2; x <= ax + 2; x++) if (inb(g, x, y)) g[y][x] = wall;
      for (let y = ay - 1; y <= ay + 1; y++) for (let x = ax - 1; x <= ax + 1; x++) g[y][x] = '.';
      // gate tile toward nearest path cell
      const pc = pathCells.reduce((b, p) => (Math.abs(p[0] - ax) + Math.abs(p[1] - ay) < Math.abs(b[0] - ax) + Math.abs(b[1] - ay) ? p : b), pathCells[0]);
      const dx = Math.sign(pc[0] - ax), dy = dx ? 0 : Math.sign(pc[1] - ay) || 1;
      const gx = ax + dx * 2, gy = ay + dy * 2;
      const gch = gate.kind === 'shears' ? 'b' : gate.kind === 'hammer' ? 'C' : gate.kind === 'climb' ? 'H' : gate.kind === 'boulder' ? 'B' : 'b';
      g[gy][gx] = gch;
      carvePath(g, r, [[gx + dx, gy + dy], pc], '.', 1, new Set([pathCh, 'K', '~']));
      alcoves.push({ x: ax, y: ay, gate, gx, gy });
    }
    // keep exits clear and connected
    ensureConnected(g, spec, r, pathCh, wall);
    return finish(spec, g, r, { pathCells, alcoves, wall, pathCh });
  }
  function ensureConnected(g, spec, r, ch, wall) {
    const pass = (c) => PASS.has(c) || c === 'K';
    if (!spec.exits.length) return;
    const [sx, sy] = spec.exits[0].inner;
    for (let i = 1; i < spec.exits.length; i++) {
      const seen = flood(g, sx, sy, pass);
      const [tx, ty] = spec.exits[i].inner;
      if (!seen[ty * g[0].length + tx]) carvePath(g, r, [[sx, sy], [tx, ty]], ch, 1, new Set(['K']));
    }
    void wall;
  }

  // ======================= TOWN =======================
  const BSIZE = { center: [5, 4], shop: [4, 4], house: [4, 3], lab: [6, 4], gym: [7, 5], daycare: [5, 4], tower: [6, 6], hq: [8, 5], league: [9, 6], museum: [6, 4], port: [6, 4], hut: [3, 3], igloo: [4, 3], observatory: [7, 6], facility: [6, 5], temple: [6, 5] };
  function town(spec) {
    const r = new MB.RNG('map:' + spec.id);
    const w = spec.w || 32, h = spec.h || 28;
    const g = grid(w, h, '.');
    const wall = spec.wall || 'T';
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) g[y][x] = wall;
    const pts = openExits(g, spec, r, '.');
    const road = spec.road || (spec.city ? '=' : ':');
    // main roads: horizontal at mid and vertical at mid
    const my = Math.floor(h / 2), mx = Math.floor(w / 2);
    for (let x = 2; x < w - 2; x++) { g[my][x] = road; g[my + 1][x] = road; }
    for (let y = 2; y < h - 2; y++) { g[y][mx] = road; g[y][mx + 1] = road; }
    for (const p of pts) carvePath(g, r, [p, [MB.clamp(p[0], 2, w - 3), my]], road, 2);
    // building lots
    const buildings = [];
    const occupied = (x, y, bw, bh) => { for (let j = y - 1; j <= y + bh; j++) for (let i = x - 1; i <= x + bw; i++) { if (!inb(g, i, j) || g[j][i] === 'X' || g[j][i] === road || g[j][i] === wall || g[j][i] === '~') return true; } return false; };
    const list = spec.buildings || [];
    for (const b of list) {
      const [bw, bh] = BSIZE[b.kind] || [4, 3];
      let placed = false;
      // candidate lots: scan the whole town, prefer spots hugging the main road, randomised within ties
      const cands = [];
      for (let y = 3; y + bh <= h - 3; y++) for (let x = 3; x + bw <= w - 3; x++) {
        const dRoad = Math.min(Math.abs(y + bh - my), Math.abs(y - (my + 2)));
        cands.push([x, y, dRoad + r.next() * 3]);
      }
      cands.sort((a, b) => a[2] - b[2]);
      for (const [x, y] of cands) {
        if (placed) break;
        if (occupied(x, y, bw, bh + 1)) continue;
        // door must have open ground beneath it
        const dx0 = x + Math.floor(bw / 2);
        if (!inb(g, dx0, y + bh) || g[y + bh][dx0] === 'X') continue;
        for (let j = y; j < y + bh; j++) for (let i = x; i < x + bw; i++) g[j][i] = 'X';
        const door = { x: dx0, y: y + bh - 1 };
        const target = door.y < my ? [door.x, my] : [door.x, my + 1];
        carvePath(g, r, [[door.x, door.y + 1], target], road === '=' ? '=' : ':', 1, new Set(['X', road]));
        buildings.push(Object.assign({}, b, { x, y, w: bw, h: bh, door, doorRel: Math.floor(bw / 2) }));
        placed = true;
      }
      if (!placed) console.warn('could not place building', b.kind, spec.id);
    }
    // deco
    if (spec.pond) blob(g, r, r.int(5, w - 6), r.int(4, my - 3), 3, 2, '~', (c) => c === '.');
    for (let i = 0; i < (spec.trees !== undefined ? spec.trees : 6); i++) { const c = r.pick(freeCells(g, (ch, x, y) => ch === '.' && Math.abs(x - mx) > 2 && Math.abs(y - my) > 2)); if (c) g[c[1]][c[0]] = 'T'; }
    for (let i = 0; i < (spec.flowers !== undefined ? spec.flowers : 8); i++) blob(g, r, r.int(3, w - 4), r.int(3, h - 4), r.int(1, 2), 1, 'F', (c) => c === '.');
    if (spec.lamps !== false) for (let x = 4; x < w - 4; x += 7) { if (g[my - 1][x] === '.') g[my - 1][x] = 'l'; if (g[my + 2][x + 3] === '.') g[my + 2][x + 3] = 'l'; }
    if (spec.grass) for (let i = 0; i < spec.grass; i++) blob(g, r, r.int(3, w - 4), r.int(3, h - 4), 2, 2, ',', (c) => c === '.');
    ensureConnected(g, spec, r, road, wall);
    return finish(spec, g, r, { buildings, road, wall, my, mx });
  }

  // ======================= CAVE / DUNGEON =======================
  function cave(spec) {
    const r = new MB.RNG('map:' + spec.id);
    const w = spec.w || 36, h = spec.h || 30;
    let g = grid(w, h, '#');
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) g[y][x] = r.chance(spec.open || 0.56) ? '.' : '#';
    for (let it = 0; it < 4; it++) {
      const n = grid(w, h, '#');
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        let c = 0; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (g[y + b][x + a] === '#') c++;
        n[y][x] = c >= 5 ? '#' : '.';
      }
      g = n;
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) g[y][x] = '#';
    const pts = openExits(g, spec, r, '.');
    // ladders/warps inside
    const inner = [];
    for (const wp of spec.ladders || []) {
      let c = null;
      for (let t = 0; t < 200 && !c; t++) { const x = r.int(3, w - 4), y = r.int(3, h - 4); if (g[y][x] === '.') c = [x, y]; }
      if (!c) c = [Math.floor(w / 2), Math.floor(h / 2)];
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) g[c[1] + b][c[0] + a] = '.';
      g[c[1]][c[0]] = '>';
      wp.x = c[0]; wp.y = c[1];
      inner.push(c);
    }
    // connect everything to the first point
    const all = pts.concat(inner);
    if (!all.length) { const c = [Math.floor(w / 2), Math.floor(h / 2)]; g[c[1]][c[0]] = '.'; all.push(c); }
    for (let i = 1; i < all.length; i++) {
      const seen = flood(g, all[0][0], all[0][1], (c) => PASS.has(c) || c === '~');
      if (!seen[all[i][1] * w + all[i][0]]) carvePath(g, r, [all[0], all[i]], '.', 2, new Set(['>']));
    }
    // remove disconnected pockets (fill)
    const seen = flood(g, all[0][0], all[0][1], (c) => PASS.has(c) || c === '~' || c === 'D');
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!seen[y * w + x] && g[y][x] === '.') g[y][x] = '#';
    // features
    if (spec.water) for (let i = 0; i < spec.water; i++) { const c = r.pick(freeCells(g, (ch) => ch === '.')); if (c) blob(g, r, c[0], c[1], r.int(2, 4), r.int(2, 3), spec.deep ? 'D' : '~', (ch, x, y) => ch === '.' && !all.some((p) => Math.abs(p[0] - x) + Math.abs(p[1] - y) < 4)); }
    if (spec.lava) for (let i = 0; i < spec.lava; i++) { const c = r.pick(freeCells(g, (ch) => ch === '.')); if (c) blob(g, r, c[0], c[1], r.int(1, 3), r.int(1, 2), 'x', (ch, x, y) => ch === '.' && !all.some((p) => Math.abs(p[0] - x) + Math.abs(p[1] - y) < 4)); }
    if (spec.ice) for (let i = 0; i < spec.ice; i++) { const c = r.pick(freeCells(g, (ch) => ch === '.')); if (c) blob(g, r, c[0], c[1], r.int(2, 4), r.int(2, 3), 'i', (ch) => ch === '.'); }
    if (spec.grassy) for (let i = 0; i < spec.grassy; i++) { const c = r.pick(freeCells(g, (ch) => ch === '.')); if (c) blob(g, r, c[0], c[1], 2, 2, ',', (ch) => ch === '.'); }
    if (spec.boulders) for (let i = 0; i < spec.boulders; i++) { const c = r.pick(freeCells(g, (ch, x, y) => ch === '.' && !all.some((p) => Math.abs(p[0] - x) + Math.abs(p[1] - y) < 3))); if (c) g[c[1]][c[0]] = r.chance(0.5) ? 'B' : 'C'; }
    // re-ensure connectivity after features (hazards may block)
    for (let i = 1; i < all.length; i++) {
      const s2 = flood(g, all[0][0], all[0][1], (c) => PASS.has(c));
      if (!s2[all[i][1] * w + all[i][0]]) carvePath(g, r, [all[0], all[i]], '.', 1, new Set(['>']));
    }
    if (spec.tt) for (let i = 0; i < spec.tt; i++) { const c = r.pick(freeCells(g, (ch) => ch === '.')); if (c && countPass(g, c[0], c[1]) >= 6) g[c[1]][c[0]] = 'T'; }
    return finish(spec, g, r, { wall: '#', pathCh: '.' });
  }
  function countPass(g, x, y) { let c = 0; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (inb(g, x + a, y + b) && PASS.has(g[y + b][x + a])) c++; return c; }

  // ======================= INTERIORS =======================
  const INTERIOR = {
    center: ['WWWWWWWWWWWW', 'WWkkkkhkkkpW', '____________', '____________', '_o________o_', '____uuuu____', '____uuuu____', '_____ee_____'],
    shop: ['WWWWWWWWWW', 'QQ______QQ', '__kkk_____', '__________', 'QQ__QQ__QQ', '__________', '____ee____'],
    house: ['WWWWWWWW', 'zQ___Yo_', '________', '__YY____', '________', '___ee___'],
    lab: ['WWWWWWWWWWWW', 'QQQQ__pp_QQQ', '____________', '_YY______YY_', '____________', '_pp______oo_', '____________', '_____ee_____'],
    daycare: ['WWWWWWWWWW', 'Q__kkkk__o', '__________', '_YY____YY_', '__________', '____ee____'],
    museum: ['WWWWWWWWWWWW', 'PP__PP__PP__', '____________', '_P___YY___P_', '____________', '_____ee_____'],
    port: ['WWWWWWWWWW', '_kkkk_____', '__________', '_YY___YY__', '__________', '____ee____'],
    hut: ['WWWWWW', 'z__Yo_', '______', '__ee__'],
    igloo: ['WWWWWW', 'z___o_', '______', '__ee__'],
    observatory: ['WWWWWWWWWWWW', 'QQ__pPPp__QQ', '____________', '_Y________Y_', '____________', '_____ee_____'],
    temple: ['WWWWWWWWWWWW', '_____PP_____', '_o________o_', '____________', '_o________o_', '_____ee_____'],
    facility: ['WWWWWWWWWWWW', '_kkkk__kkkk_', '____________', '_Q__uuuu__Q_', '____uuuu____', '_____ee_____'],
    tower: ['WWWWWWWWWWWW', '___kkkkkk___', '____________', '_o__uuuu__o_', '____uuuu____', '_____ee_____'],
    hq: ['WWWWWWWWWWWW', 'QpQ_pp_QpQ__', '____________', '_YY_____YY__', '____________', '_____ee_____'],
    league: ['WWWWWWWWWWWW', '_kkkhkk__pp_', '____________', '_o________o_', '____uuuu____', '_____ee_____'],
  };
  function interior(spec) {
    const r = new MB.RNG('map:' + spec.id);
    const tpl = INTERIOR[spec.kind] || INTERIOR.house;
    const g = tpl.map((row) => row.split(''));
    const res = finish(spec, g, r, {});
    res.indoor = true;
    return res;
  }

  // ======================= GYMS =======================
  function gym(spec) {
    const r = new MB.RNG('map:' + spec.id);
    const w = 15, h = 20;
    const g = grid(w, h, 'w');
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) g[y][x] = 'G';
    for (let x = 0; x < w; x++) { g[0][x] = 'W'; g[1][x] = 'W'; }
    const puzzle = spec.puzzle;
    const trainerSpots = [];
    const blockRow = (y, ch, gapX) => { for (let x = 1; x < w - 1; x++) if (x !== gapX) g[y][x] = ch; };
    if (puzzle === 'hedge') { // Nature: hedge maze
      for (let y = 4; y < h - 3; y += 3) { const gap = r.int(2, w - 3); blockRow(y, 'T', gap); g[y][gap + 1] = 'G'; trainerSpots.push([gap + (r.chance(0.5) ? -2 : 3), y + 1]); }
      for (let i = 0; i < 14; i++) { const x = r.int(1, w - 2), y = r.int(3, h - 4); if (g[y][x] === 'G') g[y][x] = ','; }
    } else if (puzzle === 'switch') { // Electric: switches open gates
      for (const [y, sx] of [[14, 3], [9, 11], [5, 4]]) { blockRow(y, 'f'); g[y][7] = 'v'; g[y + 2][sx] = 'q'; trainerSpots.push([sx === 3 ? 11 : 3, y + 1]); }
    } else if (puzzle === 'boulder') { // Earth: push boulders out of the way
      for (const y of [14, 10, 6]) { blockRow(y, '#'); const gx = r.int(3, w - 4); g[y][gx] = 'B'; g[y - 1][gx] = 'G'; trainerSpots.push([r.chance(0.5) ? 2 : w - 3, y + 2]); }
    } else if (puzzle === 'slide' || puzzle === 'ice') { // Aqua / Ice: slide across slick floors
      for (let y = 4; y < h - 3; y++) for (let x = 2; x < w - 2; x++) if (y % 4 !== 3) g[y][x] = 'i';
      for (let i = 0; i < 16; i++) { const x = r.int(2, w - 3), y = r.int(4, h - 5); if (g[y][x] === 'i') g[y][x] = puzzle === 'ice' ? 'B' : '#'; }
      for (const y of [h - 5, 11, 7]) trainerSpots.push([r.chance(0.5) ? 1 : w - 2, y]);
    } else if (puzzle === 'lava') { // Flame: lava maze
      for (let y = 4; y < h - 3; y++) for (let x = 2; x < w - 2; x++) if (r.chance(0.32)) g[y][x] = 'x';
      trainerSpots.push([3, 14], [11, 10], [4, 6]);
    } else if (puzzle === 'teleport') { // Psychic: teleport pads
      for (const y of [14, 9, 5]) { blockRow(y, 'W'); }
      g[16][3] = 't'; g[16][11] = 't'; g[12][4] = 't'; g[12][10] = 't'; g[7][3] = 't'; g[7][11] = 't'; g[3][7] = 'G';
      spec.teleports = [[3, 16, 10, 12], [11, 16, 3, 17], [4, 12, 11, 7], [10, 12, 3, 13], [3, 7, 7, 3], [11, 7, 4, 10]];
      trainerSpots.push([7, 16], [7, 11], [7, 6]);
    } else if (puzzle === 'dark') { // Shadow: invisible maze in darkness
      for (let y = 4; y < h - 3; y += 3) { const gap = r.int(2, w - 3); for (let x = 1; x < w - 1; x++) if (Math.abs(x - gap) > 0) g[y][x] = 'X'; }
      spec.dark = true;
      trainerSpots.push([3, h - 5], [11, 9], [5, 5]);
    } else if (puzzle === 'arena') {
      for (let y = 6; y < h - 4; y++) for (let x = 4; x < w - 4; x++) g[y][x] = 'u';
    }
    // entrance and leader dais
    g[h - 1][7] = 'e'; g[h - 2][7] = 'G'; g[h - 2][6] = 'G'; g[h - 2][8] = 'G';
    for (let x = 5; x <= 9; x++) g[2][x] = 'u';
    g[3][7] = 'G'; g[2][7] = 'u';
    // guarantee a path from door to leader (except puzzle tiles which have their own logic)
    const pass = (c) => PASS.has(c) || c === 'v' || c === 'B' || c === 'x' || c === 't' || c === 'X' || c === 'T' || c === 'f' || c === 'W';
    void pass;
    spec.exits = [];
    const res = finish(spec, g, r, {});
    res.indoor = true; res.gym = true;
    // never let a trainer stand beside a one-tile chokepoint (gap in a wall row)
    const solid = (c) => c === 'X' || c === 'T' || c === 'f' || c === 'W' || c === '#' || c === 'w' || c === 'x';
    const choke = (x, y) => inb(g, x, y) && !solid(g[y][x]) && inb(g, x - 1, y) && inb(g, x + 1, y) && solid(g[y][x - 1]) && solid(g[y][x + 1]);
    const nearChoke = (x, y) => choke(x, y) || choke(x, y - 1) || choke(x, y + 1) || choke(x - 1, y) || choke(x + 1, y);
    for (const sp of trainerSpots) { let guard = 0; while (nearChoke(sp[0], sp[1]) && guard++ < 12) sp[0] = 2 + ((sp[0] + 1) % (w - 4)); }
    res.trainerSpots = trainerSpots.filter(([x, y]) => inb(g, x, y));
    for (const [x, y] of res.trainerSpots) if (res.tiles[y][x] !== 'G') res.tiles[y][x] = 'G';
    res.leaderSpot = [7, 2];
    res.entry = [7, h - 2];
    return res;
  }

  function finish(spec, g, r, extra) {
    return Object.assign({ id: spec.id, w: g[0].length, h: g.length, tiles: g, exits: spec.exits || [] }, extra);
  }
  return { route, town, cave, interior, gym, flood, PASS, freeCells, BSIZE, INTERIOR };
})();
