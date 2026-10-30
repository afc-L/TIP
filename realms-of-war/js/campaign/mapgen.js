// Campaign world: a hex-tile continent split into territories (noisy Voronoi around each site).
// Deterministic so saves always match the same map; adjacency is derived from shared borders.
(function () {
  const RW = window.RW;
  const U = RW.util;

  const HEX = 1.15;               // hex radius in world units
  const SQ3 = Math.sqrt(3);
  let W = 54, H = 42;             // grid size of the map being generated

  function tileCenter(c, r) {
    return { x: c * SQ3 * HEX + (r & 1 ? SQ3 * HEX / 2 : 0), z: r * 1.5 * HEX };
  }
  function neighbors(c, r) {
    const odd = r & 1;
    const d = odd ? [[1, 0], [-1, 0], [0, -1], [1, -1], [0, 1], [1, 1]] : [[1, 0], [-1, 0], [-1, -1], [0, -1], [-1, 1], [0, 1]];
    return d.map(([dc, dr]) => [c + dc, r + dr]).filter(([a, b]) => a >= 0 && b >= 0 && a < W && b < H);
  }

  function generate(def) {
    const T = def.territories;
    W = def.W; H = def.H;
    const noise = U.makeNoise(def.seed), noise2 = U.makeNoise(def.seed === 4242 ? 777 : def.seed + 13);
    // Scale territory coordinates onto the hex grid's world extent.
    const ext = tileCenter(W - 1, H - 1);
    const sx = (ext.x - 6) / def.coords[0], sz = (ext.z - 6) / def.coords[1];
    const sites = T.map((t) => ({ id: t.id, x: 3 + t.x * sx, z: 3 + t.y * sz }));
    const tiles = [];
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const p = tileCenter(c, r);
      let best = -1, bd = Infinity, second = Infinity;
      for (const s of sites) {
        const d = Math.hypot(p.x - s.x, p.z - s.z) + (noise(p.x * 0.12 + s.id * 3.1, p.z * 0.12) - 0.5) * 7;
        if (d < bd) { second = bd; bd = d; best = s.id; } else if (d < second) second = d;
      }
      // Coastline: far from every site, or near the outer frame, becomes sea.
      const edge = Math.min(p.x, p.z, ext.x - p.x, ext.z - p.z);
      const coast = 11.5 + (noise2(p.x * 0.09, p.z * 0.09) - 0.5) * 8;
      const land = bd < coast && edge > 1.2 + noise2(p.x * 0.3, p.z * 0.3) * 2.5;
      tiles.push({ c, r, x: p.x, z: p.z, t: land ? best : -1, border: false, h: 0 });
    }
    const idx = (c, r) => r * W + c;
    // Remove tiny specks of sea inside land / land islands not connected (keeps borders clean).
    for (let pass = 0; pass < 2; pass++) {
      for (const tl of tiles) {
        const nb = neighbors(tl.c, tl.r).map(([c, r]) => tiles[idx(c, r)]);
        if (tl.t === -1) {
          const landN = nb.filter((n) => n.t !== -1);
          if (landN.length >= 5) tl.t = landN[0].t;
        } else {
          const same = nb.filter((n) => n.t === tl.t).length;
          if (same === 0) { const other = nb.find((n) => n.t !== -1); tl.t = other ? other.t : -1; }
        }
      }
    }
    // Adjacency from shared hex edges.
    const counts = new Map();
    for (const tl of tiles) {
      if (tl.t === -1) continue;
      for (const [c, r] of neighbors(tl.c, tl.r)) {
        const n = tiles[idx(c, r)];
        if (n.t === -1) { tl.coast = true; continue; }
        if (n.t !== tl.t) {
          tl.border = true;
          const key = Math.min(tl.t, n.t) + '-' + Math.max(tl.t, n.t);
          counts.set(key, (counts.get(key) || 0) + 1);
        }
      }
    }
    const adj = T.map(() => new Set());
    for (const [key, n] of counts) {
      if (n < 4) continue; // need a real shared border, not a corner touch
      const [a, b] = key.split('-').map(Number);
      adj[a].add(b); adj[b].add(a);
    }
    // Tile heights by terrain type.
    for (const tl of tiles) {
      if (tl.t === -1) { tl.h = 0.15; continue; }
      const terr = T[tl.t].terrain;
      const n = noise(tl.x * 0.25, tl.z * 0.25);
      let h = 0.55 + n * 0.3;
      if (terr === 'hills') h = 0.8 + n * 1.0;
      else if (terr === 'pass') h = 0.9 + n * 1.2;
      else if (terr === 'forest') h = 0.6 + n * 0.35;
      else if (terr === 'river') h = 0.45 + n * 0.25;
      else if (terr === 'snow') h = 0.75 + n * 0.9;
      else if (terr === 'volcanic') h = 0.7 + n * 1.1;
      else if (terr === 'desert') h = 0.5 + n * 0.2;
      tl.h = h;
      tl.mountain = (terr === 'pass' || terr === 'snow' || terr === 'volcanic') && n > (terr === 'pass' ? 0.55 : 0.68) && !tl.border;
      tl.peak = (terr === 'hills' && n > 0.72) || tl.mountain;
      tl.tree = (terr === 'forest' && n > 0.25) || (terr === 'snow' && n < 0.3 && noise2(tl.x * 0.4, tl.z * 0.4) > 0.6) ||
        (!['pass', 'snow', 'volcanic', 'desert'].includes(terr) && noise2(tl.x * 0.4, tl.z * 0.4) > 0.72);
      tl.water = terr === 'river' && Math.abs(noise2(tl.x * 0.15 + 9, tl.z * 0.15) - 0.5) < 0.04;
      tl.lava = terr === 'volcanic' && !tl.mountain && Math.abs(noise2(tl.x * 0.2 + 3, tl.z * 0.2) - 0.5) < 0.03;
    }
    // Make sure the site tile itself is land and flat enough for a settlement.
    for (const s of sites) {
      let best = null, bd = Infinity;
      for (const tl of tiles) { if (tl.t !== s.id) continue; const d = Math.hypot(tl.x - s.x, tl.z - s.z); if (d < bd) { bd = d; best = tl; } }
      if (best) { s.x = best.x; s.z = best.z; best.site = true; best.mountain = false; best.peak = false; best.tree = false; best.water = false; best.lava = false; }
    }
    return { tiles, W, H, HEX, sites, adj: adj.map((s) => [...s].sort((a, b) => a - b)), extent: ext };
  }

  const cache = {};
  RW.campaignMap = function (mapId = 'classic') {
    if (!cache[mapId]) { const m = generate(RW.data.MAPS[mapId]); m.id = mapId; m.territories = RW.data.MAPS[mapId].territories; cache[mapId] = m; }
    W = cache[mapId].W; H = cache[mapId].H;
    return cache[mapId];
  };
  RW.hexNeighbors = neighbors;
})();
