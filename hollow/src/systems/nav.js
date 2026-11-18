// Navigation graph: nodes + links authored by each map, A* pathfinding, nearest-node
// lookup and "where should I run?" queries used by fleeing / hiding NPCs.
export class NavGraph {
  constructor(nodes) {
    this.nodes = nodes;
    this.grid = new Map(); this.cell = 12;
    for (const n of nodes) {
      const k = this.k(Math.floor(n.pos.x / this.cell), Math.floor(n.pos.z / this.cell));
      if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(n);
    }
    this.hide = nodes.filter((n) => n.tags.has('hide'));
    this.activity = nodes.filter((n) => n.tags.has('activity'));
    this.indoor = nodes.filter((n) => n.tags.has('indoor'));
    this.exits = nodes.filter((n) => n.tags.has('exit'));
  }
  k(x, z) { return x * 92821 + z; }
  nearest(p, maxR = 40, filter = null, world = null) {
    let best = null, bd = Infinity;
    const cx = Math.floor(p.x / this.cell), cz = Math.floor(p.z / this.cell); const R = Math.ceil(maxR / this.cell);
    for (let r = 0; r <= R; r++) {
      for (let ix = cx - r; ix <= cx + r; ix++) for (let iz = cz - r; iz <= cz + r; iz++) {
        if (Math.max(Math.abs(ix - cx), Math.abs(iz - cz)) !== r) continue;
        const list = this.grid.get(this.k(ix, iz)); if (!list) continue;
        for (const n of list) {
          if (filter && !filter(n)) continue;
          const dy = Math.abs(n.pos.y - p.y); if (dy > 2.2) continue;
          const d = Math.hypot(n.pos.x - p.x, n.pos.z - p.z) + dy * 3;
          if (d < bd) {
            if (world && !world.lineOfSight({ x: p.x, y: p.y + 1, z: p.z }, { x: n.pos.x, y: n.pos.y + 1, z: n.pos.z })) continue;
            bd = d; best = n;
          }
        }
      }
      if (best && bd < r * this.cell) break;
    }
    return best;
  }
  // A* with optional danger point (nodes near it cost more)
  path(a, b, danger = null, dangerR = 10) {
    if (!a || !b) return null;
    if (a === b) return [a];
    const open = new Map([[a.id, a]]); const g = new Map([[a.id, 0]]); const f = new Map([[a.id, a.pos.distanceTo(b.pos)]]); const came = new Map();
    let iter = 0;
    while (open.size && iter++ < 3000) {
      let cur = null, cf = Infinity;
      for (const [, n] of open) { const v = f.get(n.id); if (v < cf) { cf = v; cur = n; } }
      if (cur === b) {
        const out = [cur]; let c = cur;
        while (came.has(c.id)) { c = came.get(c.id); out.unshift(c); }
        return out;
      }
      open.delete(cur.id);
      for (const nb of cur.links) {
        if (nb.blocked) continue;
        let cost = cur.pos.distanceTo(nb.pos);
        if (danger) { const d = Math.hypot(nb.pos.x - danger.x, nb.pos.z - danger.z); if (d < dangerR) cost += (dangerR - d) * 6; }
        const ng = g.get(cur.id) + cost;
        if (ng < (g.has(nb.id) ? g.get(nb.id) : Infinity)) {
          came.set(nb.id, cur); g.set(nb.id, ng); f.set(nb.id, ng + nb.pos.distanceTo(b.pos)); open.set(nb.id, nb);
        }
      }
    }
    return null;
  }
  // Pick a destination away from a threat: far from it, reachable, preferring a given tag.
  escapeTarget(from, threat, { preferTag = null, minDist = 25, sample = 18 } = {}) {
    let best = null, bs = -Infinity;
    const pool = preferTag === 'hide' ? this.hide : preferTag === 'indoor' ? this.indoor : this.nodes;
    if (!pool.length) return null;
    const tdx = from.x - threat.x, tdz = from.z - threat.z; const tl = Math.hypot(tdx, tdz) || 1;
    for (let i = 0; i < sample; i++) {
      const n = pool[Math.floor(Math.random() * pool.length)];
      const dThreat = Math.hypot(n.pos.x - threat.x, n.pos.z - threat.z);
      const dSelf = Math.hypot(n.pos.x - from.x, n.pos.z - from.z);
      if (dThreat < minDist * 0.5) continue;
      // prefer nodes in the direction away from the threat
      const dirScore = ((n.pos.x - from.x) * tdx + (n.pos.z - from.z) * tdz) / (tl * (dSelf || 1));
      const s = dThreat - dSelf * 0.45 + dirScore * 12 + (preferTag && n.tags.has(preferTag) ? 10 : 0) - (n.claimed ? 15 : 0);
      if (s > bs) { bs = s; best = n; }
    }
    return best;
  }
  randomNear(p, r, tag = null) {
    const list = (tag === 'activity' ? this.activity : this.nodes).filter((n) => Math.hypot(n.pos.x - p.x, n.pos.z - p.z) < r);
    return list.length ? list[Math.floor(Math.random() * list.length)] : null;
  }
}
