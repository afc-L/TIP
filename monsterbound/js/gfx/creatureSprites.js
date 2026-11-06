'use strict';
// Procedural pixel-art creature generator. Every species is drawn from its body plan plus
// seeded parameters (ears, tails, wings, horns, markings) and type-specific features, then
// shaded and outlined like hand-made handheld sprites. 48x48 grid.
MB.Sprites = (function () {
  const N = 48;
  const cache = {};

  class Grid {
    constructor() { this.px = new Array(N * N).fill(null); this.mask = new Uint8Array(N * N); }
    set(x, y, c, m) {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || y < 0 || x >= N || y >= N) return;
      this.px[y * N + x] = c; if (m !== undefined) this.mask[y * N + x] = m;
    }
    get(x, y) { if (x < 0 || y < 0 || x >= N || y >= N) return null; return this.px[y * N + x]; }
  }

  function makePalette(sp, mega, shiny) {
    const r = new MB.RNG(sp.seed + (mega ? 77 : 0));
    const types = mega ? sp.mega.types : sp.types;
    const base = MB.hex(MB.TYPE_COLORS[types[0]]);
    const sec = MB.hex(MB.TYPE_COLORS[types[1] || types[0]]);
    // convert to hsl-ish variation by mixing with random tint
    const tint = MB.hsl(r.int(0, 359), 60, 55);
    let main = MB.mix(base, tint, r.range(0.05, 0.3));
    let second = types[1] ? MB.mix(sec, tint, r.range(0, 0.2)) : MB.mix(base, [255, 245, 220], r.range(0.35, 0.6));
    if (r.chance(0.25) && !types[1]) second = MB.mix(base, [40, 30, 50], 0.45);
    let accent = MB.hsl(r.int(0, 359), 85, 60);
    if (types.includes('Flame')) accent = [255, 200, 60];
    if (types.includes('Electric')) accent = [255, 235, 80];
    if (types.includes('Ice')) accent = [200, 250, 255];
    if (types.includes('Shadow')) accent = [230, 50, 70];
    if (types.includes('Light')) accent = [255, 250, 190];
    if (types.includes('Psychic')) accent = [255, 110, 200];
    if (types.includes('Spirit')) accent = [150, 230, 255];
    if (mega) { main = MB.mix(main, [30, 20, 40], 0.15); accent = MB.mix(accent, [255, 255, 255], 0.2); }
    if (shiny) {
      const rot = (c, k) => [c[(0 + k) % 3], c[(1 + k) % 3], c[(2 + k) % 3]];
      main = rot(main, 1); second = rot(second, 2); accent = MB.mix(accent, [255, 230, 120], 0.5);
    }
    // Normal types get warm browns/creams
    if (types[0] === 'Normal' && !shiny) main = MB.mix(main, MB.hsl(r.int(15, 45), 45, 55), 0.6);
    return { main, second, accent, eye: types.includes('Shadow') ? [240, 60, 60] : [20, 20, 30], belly: MB.mix(main, [255, 250, 235], 0.55) };
  }

  function draw(sp, mega, shiny) {
    const g = new Grid();
    const r = new MB.RNG(sp.seed + (mega ? 4099 : 0));
    const pal = makePalette(sp, mega, shiny);
    if (mega) { const m0 = pal.main; pal.main = MB.shade(MB.mix(pal.main, pal.second, 0.3), 0.88); pal.second = MB.mix(pal.accent, m0, 0.35); pal.belly = MB.mix(pal.belly, pal.accent, 0.25); }
    const types = mega ? sp.mega.types : sp.types;
    let sz = sp.legendary ? 1.02 : [0.62, 0.8, 0.95][sp.nStages === 1 ? 1 + (sp.rarity === 'vr' ? 1 : 0) : sp.nStages === 2 ? sp.stage + 1 : sp.stage];
    if (sp.nStages === 2 && sp.stage === 0) sz = 0.66;
    if (mega) sz = Math.min(1.08, sz * 1.1);
    const cx = 24, by = 44; // center x, baseline y (feet)
    const P = (x, y) => [cx + x * sz, by + y * sz];
    const S = (v) => v * sz;

    // ---------- primitives ----------
    function ell(x, y, rx, ry, col, m) {
      for (let j = Math.floor(y - ry); j <= Math.ceil(y + ry); j++)
        for (let i = Math.floor(x - rx); i <= Math.ceil(x + rx); i++) {
          const dx = (i - x) / (rx + 0.3), dy = (j - y) / (ry + 0.3);
          if (dx * dx + dy * dy <= 1) g.set(i, j, col, m);
        }
    }
    function sEll(x, y, rx, ry, col, m) {
      // shaded ellipse: dark base, mid body, highlight
      const dark = MB.shade(col, 0.68), hi = MB.mix(col, [255, 255, 255], 0.35);
      for (let j = Math.floor(y - ry); j <= Math.ceil(y + ry); j++)
        for (let i = Math.floor(x - rx); i <= Math.ceil(x + rx); i++) {
          const dx = (i - x) / (rx + 0.3), dy = (j - y) / (ry + 0.3);
          const d = dx * dx + dy * dy;
          if (d > 1) continue;
          const lx = (i - (x - rx * 0.3)) / (rx * 0.95), ly = (j - (y - ry * 0.35)) / (ry * 0.95);
          const l = lx * lx + ly * ly;
          let c = col;
          if (l > 0.95 && (dx > -0.2 || dy > 0.1)) c = dark;
          else if (l < 0.12) c = hi;
          g.set(i, j, c, m);
        }
    }
    function tri(x1, y1, x2, y2, x3, y3, col, shadeIt) {
      const minX = Math.floor(Math.min(x1, x2, x3)), maxX = Math.ceil(Math.max(x1, x2, x3));
      const minY = Math.floor(Math.min(y1, y2, y3)), maxY = Math.ceil(Math.max(y1, y2, y3));
      const area = (x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1);
      if (Math.abs(area) < 0.01) return;
      for (let j = minY; j <= maxY; j++) for (let i = minX; i <= maxX; i++) {
        const px = i + 0.5 - 0.5, py = j;
        const w1 = ((x2 - px) * (y3 - py) - (x3 - px) * (y2 - py)) / area;
        const w2 = ((x3 - px) * (y1 - py) - (x1 - px) * (y3 - py)) / area;
        const w3 = 1 - w1 - w2;
        if (w1 >= -0.04 && w2 >= -0.04 && w3 >= -0.04) {
          let c = col;
          if (shadeIt) c = (i - minX) / (maxX - minX + 1) > 0.6 ? MB.shade(col, 0.75) : col;
          g.set(i, j, c);
        }
      }
    }
    function limb(x1, y1, x2, y2, rad, col) {
      const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 2) + 1;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        ell(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, rad, rad, t > 0.5 ? MB.shade(col, 0.85) : col);
      }
    }
    function eye(x, y, s, style) {
      s = Math.max(1, s);
      const white = [250, 250, 250];
      if (style === 'glow') { ell(x, y, s, s * 0.8, pal.accent); g.set(x, y, [255, 255, 255]); return; }
      if (style === 'slit') { ell(x, y, s, s, [250, 230, 120]); for (let k = -s; k <= s; k++) g.set(x, y + k, [20, 10, 10]); return; }
      ell(x, y, s, s * (style === 'sleepy' ? 0.5 : 1), white);
      ell(x - (s > 1.5 ? 0.6 : 0), y + (style === 'sleepy' ? 0 : 0.3), Math.max(0.6, s * 0.6), Math.max(0.6, s * (style === 'sleepy' ? 0.4 : 0.7)), pal.eye);
      if (s >= 2) g.set(Math.round(x - s * 0.5), Math.round(y - s * 0.4), [255, 255, 255]);
      if (style === 'angry') { for (let k = -s; k <= s; k++) g.set(x + k, y - s - 1 + (k > 0 ? 1 : 0) * 0, MB.shade(pal.main, 0.4)); }
    }
    const eyeStyle = types.includes('Shadow') || types.includes('Dragon') ? (r.chance(0.5) ? 'angry' : 'slit') : types.includes('Spirit') || types.includes('Psychic') ? (r.chance(0.5) ? 'glow' : 'round') : r.pick(['round', 'round', 'angry', 'sleepy']);
    const big = sp.stage === 0 && sp.nStages > 1; // baby proportions: big eyes
    const eS = (base) => Math.max(1, Math.round(S(base) * (big ? 1.35 : 1)));

    // ---------- feature helpers ----------
    function ears(hx, hy, hr, kind, facing) {
      const col = pal.main, inner = MB.mix(pal.main, [255, 180, 190], 0.5);
      const off = facing ? 0.45 : 0.6;
      const sides = facing ? [-1, 1] : [-1, 0.2];
      for (const s of sides) {
        const ex = hx + s * hr * off;
        if (kind === 'pointy') { tri(ex - hr * 0.35, hy - hr * 0.5, ex + hr * 0.35, hy - hr * 0.5, ex + s * hr * 0.15, hy - hr * 1.6, col, true); tri(ex - hr * 0.15, hy - hr * 0.6, ex + hr * 0.15, hy - hr * 0.6, ex + s * hr * 0.1, hy - hr * 1.3, inner); }
        else if (kind === 'round') { sEll(ex, hy - hr * 0.85, hr * 0.4, hr * 0.4, col); ell(ex, hy - hr * 0.85, hr * 0.2, hr * 0.2, inner); }
        else if (kind === 'long') { sEll(ex + s * 1, hy - hr * 1.5, hr * 0.25, hr * 0.8, col); ell(ex + s * 1, hy - hr * 1.4, hr * 0.1, hr * 0.55, inner); }
        else if (kind === 'fin') tri(ex - hr * 0.3, hy - hr * 0.3, ex + hr * 0.4, hy - hr * 0.4, ex + s * hr * 0.9, hy - hr * 1.2, pal.second, true);
        else if (kind === 'horn') tri(ex - hr * 0.18, hy - hr * 0.6, ex + hr * 0.18, hy - hr * 0.6, ex + s * hr * 0.5, hy - hr * 1.6, MB.mix(pal.second, [240, 230, 210], 0.5), true);
        else if (kind === 'antler') {
          const ac = MB.mix([150, 110, 70], pal.second, 0.3);
          limb(ex, hy - hr * 0.6, ex + s * hr * 0.5, hy - hr * 1.8, 0.6, ac);
          limb(ex + s * hr * 0.25, hy - hr * 1.2, ex + s * hr * 0.9, hy - hr * 1.4, 0.5, ac);
          limb(ex + s * hr * 0.4, hy - hr * 1.6, ex + s * hr * 0.1, hy - hr * 2.1, 0.5, ac);
        }
        else if (kind === 'leaf') { sEll(ex + s * hr * 0.3, hy - hr * 1.1, hr * 0.35, hr * 0.6, MB.hex(MB.TYPE_COLORS.Nature)); }
        else if (kind === 'bolt') { const yc = MB.hex(MB.TYPE_COLORS.Electric); limb(ex, hy - hr * 0.5, ex + s * hr * 0.4, hy - hr * 1.1, 0.8, yc); limb(ex + s * hr * 0.4, hy - hr * 1.1, ex + s * 0.1 * hr, hy - hr * 1.3, 0.8, yc); limb(ex + s * 0.1 * hr, hy - hr * 1.3, ex + s * hr * 0.7, hy - hr * 2, 0.8, yc); }
      }
    }
    function flame(x, y, s) {
      tri(x - s, y, x + s, y, x, y - s * 2.6, [240, 90, 30]);
      tri(x - s * 0.6, y, x + s * 0.6, y, x + s * 0.2, y - s * 1.8, [255, 170, 40]);
      tri(x - s * 0.3, y, x + s * 0.3, y, x, y - s * 1.1, [255, 240, 150]);
    }
    function crystal(x, y, s, col) { tri(x - s * 0.5, y, x + s * 0.5, y, x, y - s * 2, col || [190, 240, 255], true); g.set(x, y - s, [255, 255, 255]); }
    function leaf(x, y, s, ang) {
      const c = MB.hex(MB.TYPE_COLORS.Nature);
      const dx = Math.cos(ang) * s * 1.6, dy = Math.sin(ang) * s * 1.6;
      for (let t = 0; t <= 1; t += 0.12) ell(x + dx * t, y + dy * t, s * 0.55 * Math.sin(Math.PI * t) + 0.5, s * 0.55 * Math.sin(Math.PI * t) + 0.5, t > 0.5 ? MB.shade(c, 0.8) : c);
    }
    function spikesAlong(pts, len, col) {
      for (const [x, y, nx, ny] of pts) tri(x - ny * 1.4, y + nx * 1.4, x + ny * 1.4, y - nx * 1.4, x + nx * len, y + ny * len, col, true);
    }
    function wing(x, y, s, side, kind) {
      const col = kind === 'bat' ? MB.shade(pal.second, 0.9) : kind === 'insect' ? MB.mix(pal.accent, [255, 255, 255], 0.5) : pal.second;
      if (kind === 'feather') {
        for (let k = 0; k < 4; k++) {
          const a = -Math.PI / 2 - side * (0.4 + k * 0.32);
          limb(x, y, x + Math.cos(a) * s * (1.6 - k * 0.2) * -side * -1, y + Math.sin(a) * s * (1.6 - k * 0.2), Math.max(1, s * 0.28), k % 2 ? MB.shade(col, 0.85) : col);
        }
      } else if (kind === 'bat' || kind === 'dragon') {
        const tipX = x + side * s * 1.8, tipY = y - s * 1.4;
        tri(x, y, tipX, tipY, x + side * s * 1.3, y + s * 0.6, col, true);
        tri(x, y, x + side * s * 1.3, y + s * 0.6, x + side * s * 0.5, y + s * 0.8, MB.shade(col, 0.8));
        limb(x, y, tipX, tipY, 0.6, MB.shade(col, 0.6));
      } else if (kind === 'insect') {
        ell(x + side * s * 0.9, y - s * 0.6, s * 0.9, s * 0.55, col);
        ell(x + side * s * 0.9, y - s * 0.6, s * 0.4, s * 0.25, pal.second);
      }
    }
    function aura() {
      // mega aura: crackling ring of accent energy around the creature silhouette
      const glow = MB.mix(pal.accent, [255, 255, 255], 0.2);
      const filled = g.px.slice();
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (filled[y * N + x]) continue;
        let near = false;
        for (let d = 2; d <= 3 && !near; d++) for (const [ox, oy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) { const v = filled[(y + oy) * N + (x + ox)]; if (x + ox >= 0 && x + ox < N && y + oy >= 0 && y + oy < N && v) near = true; }
        if (near && ((x * 7 + y * 13 + sp.seed) % 5 === 0)) g.set(x, y, glow, 9);
      }
    }
    function megaMark(x, y) {
      // diamond emblem of Mega Evolution
      const c = [255, 255, 255], c2 = pal.accent;
      for (let k = -2; k <= 2; k++) { g.set(x + k, y, c2); g.set(x, y + k, c2); }
      g.set(x, y, c); g.set(x - 1, y, c); g.set(x + 1, y, c);
    }

    // ---------- body plans ----------
    const body = sp.body;
    let eyeAt = null; // [x,y,size]
    let chest = [cx, by - S(14)];
    const tF = (t) => types.includes(t);

    const quadKinds = { fox: 1, quad: 1, cat: 1, deer: 1, bear: 1, rodent: 1, sheep: 1, hedgehog: 1, horse: 1, armadillo: 1, hippo: 1, seal: 1, lizard: 1, dragon: 1 };
    if (quadKinds[body]) {
      // side view, facing left
      const p = {
        len: { fox: 12, cat: 11, deer: 11, bear: 14, rodent: 9, sheep: 12, hedgehog: 11, horse: 13, armadillo: 13, hippo: 15, seal: 13, lizard: 13, dragon: 13, quad: r.int(10, 14) }[body],
        h: { fox: 7, cat: 6.5, deer: 7, bear: 10, rodent: 8, sheep: 9, hedgehog: 8, horse: 8, armadillo: 8, hippo: 10, seal: 7, lizard: 6, dragon: 8, quad: r.int(6, 9) }[body],
        leg: { fox: 7, cat: 6, deer: 11, bear: 5, rodent: 3, sheep: 6, hedgehog: 3, horse: 12, armadillo: 4, hippo: 5, seal: 0, lizard: 4, dragon: 7, quad: r.int(4, 8) }[body],
        head: { fox: 6.5, cat: 6, deer: 5.5, bear: 7.5, rodent: 7, sheep: 5, hedgehog: 6, horse: 5, armadillo: 5, hippo: 9, seal: 6.5, lizard: 5.5, dragon: 6.5, quad: r.range(5, 7.5) }[body],
      };
      if (big) { p.head *= 1.25; p.leg *= 0.8; }
      const legTop = -p.leg - p.h * 0.4;
      const bodyY = -p.leg - p.h * 0.5;
      const bx = 3;
      // tail first (behind)
      const tailKind = { fox: 'bushy', cat: 'curl', deer: 'stub', bear: 'stub', rodent: r.pick(['thin', 'bushy']), sheep: 'stub', hedgehog: 'stub', horse: 'mane', armadillo: 'thin', hippo: 'stub', seal: 'fish', lizard: 'long', dragon: 'long', quad: r.pick(['thin', 'bushy', 'curl', 'long']) }[body];
      const tx = bx + p.len * 0.95, ty = bodyY;
      const [tX, tY] = P(tx, ty);
      if (tailKind === 'bushy') { sEll(tX + S(4), tY - S(5), S(4.5), S(6.5), pal.main); ell(tX + S(5), tY - S(10), S(2.6), S(2.6), pal.belly); }
      else if (tailKind === 'curl') { limb(tX, tY, tX + S(5), tY - S(4), S(1.2), pal.main); limb(tX + S(5), tY - S(4), tX + S(3), tY - S(9), S(1.2), pal.main); }
      else if (tailKind === 'thin') limb(tX, tY, tX + S(8), tY - S(3), S(0.9), pal.main);
      else if (tailKind === 'long') { limb(tX, tY, tX + S(7), tY + S(2), S(2.2), pal.main); limb(tX + S(7), tY + S(2), tX + S(13), tY - S(1), S(1.3), pal.main); if (tF('Flame')) flame(tX + S(13), tY - S(1), S(2)); }
      else if (tailKind === 'mane') limb(tX, tY, tX + S(5), tY + S(5), S(1.6), pal.second);
      else if (tailKind === 'fish') { tri(tX, tY, tX + S(8), tY - S(5), tX + S(8), tY + S(4), pal.main, true); }
      else if (tailKind === 'stub') ell(tX + S(1), tY - S(1), S(2), S(2), pal.main);
      if (tF('Flame') && tailKind === 'bushy') flame(tX + S(5), tY - S(10), S(2.5));
      // far legs (darker)
      if (p.leg > 0) {
        const lc = MB.shade(pal.main, 0.7);
        for (const lx of [bx - p.len * 0.55 + 2, bx + p.len * 0.6 + 2]) { const [a, b] = P(lx, legTop); const [c, d] = P(lx + 0.5, 0); limb(a, b, c, d - S(1), S(body === 'deer' || body === 'horse' ? 1.1 : 1.7), lc); }
      }
      // wings (dragon)
      if (body === 'dragon' || (mega && (tF('Wind') || tF('Dragon') || tF('Light') || tF('Spirit') || tF('Psychic')))) { const [wx, wy] = P(bx + 2, bodyY - p.h * 0.6); wing(wx, wy, S(9), 1, 'dragon'); }
      // body
      const [bX, bY] = P(bx, bodyY);
      if (body === 'sheep') { for (let k = 0; k < 7; k++) sEll(bX + S(-p.len + 3 + k * 3.3), bY + S((k % 2) * 2 - 2), S(4.5), S(4.5), pal.belly); }
      else sEll(bX, bY, S(p.len), S(p.h), pal.main, 1);
      // belly
      if (body !== 'sheep' && body !== 'armadillo') ell(bX - S(1), bY + S(p.h * 0.45), S(p.len * 0.65), S(p.h * 0.4), pal.belly);
      if (body === 'armadillo') for (let k = -2; k <= 2; k++) { const xx = bX + S(k * 4); for (let j = -p.h; j < p.h * 0.6; j++) { if (g.get(Math.round(xx), Math.round(bY + S(j)))) g.set(xx, bY + S(j), MB.shade(pal.second, 0.7)); } }
      if (body === 'hedgehog' || tF('Ice') || (mega && r.chance(0.6))) {
        const pts = [];
        for (let k = 0; k < 5; k++) { const a = Math.PI + 0.5 + k * 0.45; pts.push([bX + Math.cos(a) * S(p.len) * -1, bY + Math.sin(a) * S(p.h), -Math.cos(a) * -1 * 0.3 + 0.2, -0.9]); }
        spikesAlong(pts, S(body === 'hedgehog' ? 6 : 4), tF('Ice') ? [190, 240, 255] : MB.shade(pal.second, 0.85));
      }
      // markings
      const mark = r.pick(['stripes', 'spots', 'none', 'band']);
      if (mark === 'stripes') for (let k = 0; k < 3; k++) { const xx = bX + S(k * 3.5 - 1); for (let j = -p.h; j < -p.h * 0.1; j++) if (g.get(Math.round(xx), Math.round(bY + S(j)))) g.set(xx, bY + S(j), pal.second); }
      if (mark === 'spots') for (let k = 0; k < 4; k++) ell(bX + S(r.range(-p.len * 0.5, p.len * 0.6)), bY - S(r.range(0, p.h * 0.6)), S(1.2), S(1.2), pal.second);
      if (mark === 'band') ell(bX - S(p.len * 0.7), bY - S(p.h * 0.1), S(2), S(p.h * 0.8), pal.second);
      // near legs
      if (p.leg > 0) for (const lx of [bx - p.len * 0.55, bx + p.len * 0.6]) { const [a, b] = P(lx, legTop); const [c, d] = P(lx - 0.5, 0); limb(a, b, c, d - S(1), S(body === 'deer' || body === 'horse' ? 1.2 : 1.9), pal.main); ell(c - S(0.5), d - S(0.8), S(2), S(1.2), MB.shade(pal.main, 0.6)); }
      else { const [a, b] = P(bx - p.len * 0.4, -2); sEll(a, b, S(4), S(1.8), MB.shade(pal.main, 0.85)); }
      // head
      const hx = bx - p.len * 0.85, hy = bodyY - p.h * 0.8 - (body === 'horse' || body === 'deer' ? 4 : 0);
      const [hX, hY] = P(hx, hy);
      if (body === 'horse' || body === 'deer') limb(bX - S(p.len * 0.6), bY - S(p.h * 0.3), hX, hY, S(3), pal.main);
      const earKind = { fox: 'pointy', cat: 'pointy', deer: 'antler', bear: 'round', rodent: r.pick(['round', 'long']), sheep: 'horn', hedgehog: 'round', horse: 'pointy', armadillo: 'round', hippo: 'round', seal: 'none', lizard: r.pick(['none', 'horn']), dragon: 'horn', quad: r.pick(['pointy', 'round', 'horn']) }[body];
      let ek = earKind;
      if (tF('Electric') && r.chance(0.6)) ek = 'bolt';
      if (tF('Nature') && r.chance(0.5)) ek = 'leaf';
      if (tF('Aqua') && body === 'seal') ek = 'none';
      if (mega && ek !== 'antler') ek = r.pick(['horn', 'pointy', ek]);
      ears(hX, hY, S(p.head), ek, false);
      sEll(hX, hY, S(p.head), S(p.head * 0.9), pal.main);
      // snout
      const snout = { fox: 1.0, cat: 0.5, deer: 0.8, bear: 0.7, rodent: 0.4, horse: 1.1, hippo: 0.9, lizard: 1.1, dragon: 1.1, seal: 0.6 }[body] || 0.7;
      sEll(hX - S(p.head * 0.85), hY + S(p.head * 0.25), S(p.head * 0.55 * snout + 1), S(p.head * 0.42), MB.mix(pal.main, pal.belly, 0.5));
      g.set(hX - S(p.head * 0.85) - S(p.head * 0.55 * snout), hY + S(p.head * 0.1), [30, 25, 30]);
      if (body === 'dragon' || body === 'lizard' || tF('Shadow')) { g.set(hX - S(p.head * 0.7), hY + S(p.head * 0.6), [255, 255, 255]); g.set(hX - S(p.head * 0.4), hY + S(p.head * 0.65), [255, 255, 255]); }
      eyeAt = [hX - S(p.head * 0.25), hY - S(p.head * 0.15), eS(1.6)];
      if (body === 'horse' || (body === 'quad' && tF('Flame')) || (body === 'fox' && tF('Flame') && sp.stage > 0)) for (let k = 0; k < 3; k++) flame(hX + S(2 + k * 2.5), hY - S(p.head * 0.6 - k), S(1.6));
      if (body === 'horse' && !tF('Flame')) limb(hX + S(2), hY - S(3), bX - S(p.len * 0.3), bY - S(p.h), S(1.5), pal.second);
      chest = [Math.round(bX - S(p.len * 0.3)), Math.round(bY)];
    } else if (body === 'bird' || body === 'bat') {
      const bodyR = body === 'bat' ? 6 : 7.5;
      const [bX, bY] = P(1, -12);
      const kind = body === 'bat' ? 'bat' : r.chance(0.5) ? 'feather' : 'bat';
      if (body === 'bird') {
        // tail feathers
        tri(bX + S(4), bY + S(2), bX + S(14), bY + S(6), bX + S(12), bY - S(2), pal.second, true);
        // legs
        limb(bX - S(1), bY + S(6), bX - S(2), P(0, 0)[1] - S(1), S(0.8), [230, 160, 60]); limb(bX + S(3), bY + S(6), bX + S(3), P(0, 0)[1] - S(1), S(0.8), [210, 140, 50]);
        // far wing
        if (kind === 'feather') wing(bX + S(2), bY - S(2), S(8), 1, 'feather'); else wing(bX + S(2), bY - S(1), S(8), 1, 'bat');
        sEll(bX, bY, S(bodyR + 1.5), S(bodyR), pal.main, 1);
        ell(bX - S(2), bY + S(2.5), S(bodyR * 0.7), S(bodyR * 0.55), pal.belly);
        const [hX, hY] = [bX - S(6), bY - S(7)];
        sEll(hX, hY, S(5.5), S(5), pal.main);
        tri(hX - S(4), hY - S(1), hX - S(4), hY + S(2), hX - S(10), hY + S(1), [245, 180, 60], true);
        if (r.chance(0.7) || mega) for (let k = 0; k < (mega ? 4 : 3); k++) limb(hX + S(1 + k), hY - S(4), hX + S(4 + k * 2), hY - S(9 + k), S(0.8), k % 2 ? pal.second : pal.accent);
        eyeAt = [hX - S(1.5), hY - S(0.5), eS(1.5)];
        if (tF('Flame')) flame(bX + S(12), bY - S(1), S(2.5));
        if (tF('Electric')) { limb(bX + S(10), bY - S(4), bX + S(12), bY - S(1), 0.8, pal.accent); }
        chest = [Math.round(bX - S(2)), Math.round(bY + S(1))];
      } else {
        wing(bX - S(4), bY - S(1), S(10), -1, 'bat'); wing(bX + S(4), bY - S(1), S(10), 1, 'bat');
        sEll(bX, bY, S(bodyR), S(bodyR + 1), pal.main, 1);
        ears(bX, bY - S(3), S(6), 'pointy', true);
        eyeAt = null;
        eye(bX - S(2.5), bY - S(2), eS(1.4), eyeStyle); eye(bX + S(2.5), bY - S(2), eS(1.4), eyeStyle);
        g.set(bX - 1, bY + S(3), [255, 255, 255]); g.set(bX + 1, bY + S(3), [255, 255, 255]);
        chest = [Math.round(bX), Math.round(bY + S(3))];
      }
    } else if (['fish', 'shark', 'whale', 'dolphin', 'seahorse'].includes(body)) {
      const len = { fish: 11, shark: 14, whale: 17, dolphin: 13, seahorse: 6 }[body], h = { fish: 7, shark: 6.5, whale: 9, dolphin: 6.5, seahorse: 8 }[body];
      const [bX, bY] = P(0, -14);
      if (body === 'seahorse') {
        limb(bX + S(2), bY + S(6), bX + S(4), bY + S(13), S(2.2), pal.main); limb(bX + S(4), bY + S(13), bX + S(1), bY + S(16), S(1.6), pal.main);
        sEll(bX, bY, S(5), S(h), pal.main, 1); ell(bX - S(2), bY + S(1), S(2.5), S(h * 0.6), pal.belly);
        const [hX, hY] = [bX - S(2), bY - S(h + 2)]; sEll(hX, hY, S(4.5), S(4), pal.main); limb(hX - S(3), hY + S(1), hX - S(8), hY + S(2), S(1.4), pal.main);
        for (let k = 0; k < 4; k++) tri(bX + S(4), bY - S(6 - k * 3), bX + S(4), bY - S(3 - k * 3), bX + S(8), bY - S(5 - k * 3), pal.second);
        eyeAt = [hX - S(1), hY - S(1), eS(1.5)];
        chest = [Math.round(bX), Math.round(bY)];
      } else {
        // tail fin
        const tx = bX + S(len);
        if (body === 'whale' || body === 'dolphin') { tri(tx - S(2), bY, tx + S(7), bY - S(6), tx + S(5), bY + S(1), pal.main, true); tri(tx - S(2), bY, tx + S(7), bY + S(5), tx + S(5), bY, MB.shade(pal.main, 0.8)); }
        else tri(tx - S(3), bY, tx + S(6), bY - S(7), tx + S(6), bY + S(7), pal.second, true);
        // dorsal fin
        tri(bX - S(2), bY - S(h - 1), bX + S(4), bY - S(h - 1), bX + S(body === 'shark' ? 4 : 2), bY - S(h + (body === 'shark' ? 7 : 4)), body === 'dolphin' ? pal.main : pal.second, true);
        sEll(bX, bY, S(len), S(h), pal.main, 1);
        ell(bX - S(2), bY + S(h * 0.5), S(len * 0.8), S(h * 0.38), pal.belly);
        tri(bX - S(2), bY + S(2), bX + S(3), bY + S(2), bX + S(2), bY + S(h + 3), pal.second, true);
        eyeAt = [bX - S(len * 0.62), bY - S(h * 0.25), eS(body === 'whale' ? 1.3 : 1.6)];
        if (body === 'shark') for (let k = 0; k < 4; k++) tri(bX - S(len * 0.85 - k * 1.5), bY + S(2), bX - S(len * 0.85 - k * 1.5 - 1), bY + S(2), bX - S(len * 0.85 - k * 1.5 - 0.5), bY + S(3.5), [255, 255, 255]);
        else { g.set(bX - S(len * 0.9), bY + S(2), MB.shade(pal.main, 0.4)); g.set(bX - S(len * 0.85), bY + S(2.3), MB.shade(pal.main, 0.4)); }
        if (body === 'whale') for (let k = 0; k < 3; k++) for (let i = -len * 0.6; i < len * 0.4; i += 1) if (g.get(Math.round(bX + S(i)), Math.round(bY + S(h * 0.3 + k * 1.5)))) g.set(bX + S(i), bY + S(h * 0.3 + k * 1.5), MB.shade(pal.belly, 0.85));
        chest = [Math.round(bX), Math.round(bY)];
      }
      if (tF('Light')) { ell(bX - S(len * 0.6), bY - S(h + 4), S(1.5), S(1.5), pal.accent); limb(bX - S(len * 0.5), bY - S(h - 1), bX - S(len * 0.6), bY - S(h + 3), 0.5, pal.second); }
    } else if (body === 'serpent' || body === 'wyrm') {
      const segs = 7, thick = body === 'wyrm' ? 5 : 4.2;
      const pts = [];
      const amp = r.range(4, 7);
      for (let k = 0; k < segs; k++) { const t = k / (segs - 1); pts.push([14 - t * 26, -3 - t * 14 - Math.sin(t * Math.PI * 1.6) * amp * (1 - t * 0.4), thick * (0.55 + t * 0.55)]); }
      if (body === 'wyrm' || (mega && tF('Dragon'))) { const [wx, wy] = P(pts[3][0], pts[3][1] - 3); wing(wx, wy, S(9), 1, 'dragon'); wing(wx, wy, S(8), -1, 'dragon'); }
      for (let k = 0; k < segs; k++) { const [x, y] = P(pts[k][0], pts[k][1]); sEll(x, y, S(pts[k][2]), S(pts[k][2]), k % 2 ? pal.main : MB.mix(pal.main, pal.second, 0.25), 1); }
      for (let k = 1; k < segs - 1; k++) { const [x, y] = P(pts[k][0], pts[k][1]); ell(x, y + S(pts[k][2] * 0.5), S(pts[k][2] * 0.6), S(pts[k][2] * 0.35), pal.belly); }
      const [hX, hY] = P(pts[segs - 1][0] - 3, pts[segs - 1][1] - 2);
      sEll(hX, hY, S(5.5), S(4.5), pal.main);
      sEll(hX - S(4), hY + S(1.5), S(3.5), S(2.5), MB.mix(pal.main, pal.belly, 0.4));
      if (tF('Dragon') || body === 'wyrm' || mega) ears(hX + S(1), hY, S(5), 'horn', false);
      if (tF('Venom')) { tri(hX - S(6), hY + S(3), hX - S(5), hY + S(3), hX - S(5.5), hY + S(6), [255, 255, 255]); }
      if (tF('Electric')) for (let k = 0; k < 3; k++) { const [x, y] = P(pts[k * 2][0], pts[k * 2][1] - pts[k * 2][2]); limb(x, y, x + S(1), y - S(3), 0.7, pal.accent); }
      eyeAt = [hX - S(1.5), hY - S(1.5), eS(1.5)];
      const [tx, ty] = P(pts[0][0] + 3, pts[0][1]);
      if (tF('Flame')) flame(tx, ty, S(2)); else if (tF('Aqua')) tri(tx - S(1), ty, tx + S(5), ty - S(4), tx + S(5), ty + S(3), pal.second, true);
      chest = [Math.round(P(pts[3][0], pts[3][1])[0]), Math.round(P(pts[3][0], pts[3][1])[1])];
    } else if (['insect', 'moth', 'beetle', 'spider', 'cocoon'].includes(body)) {
      const [bX, bY] = P(0, -13);
      if (body === 'moth') {
        wing(bX - S(1), bY - S(2), S(11), -1, 'insect'); wing(bX + S(1), bY - S(2), S(11), 1, 'insect');
        ell(bX - S(7), bY + S(5), S(4), S(3.5), pal.second); ell(bX + S(7), bY + S(5), S(4), S(3.5), pal.second);
        for (const s of [-1, 1]) { ell(bX + s * S(10), bY - S(8), S(2.4), S(2.4), pal.main); ell(bX + s * S(10), bY - S(8), S(1.2), S(1.2), pal.eye); }
        sEll(bX, bY + S(2), S(3), S(8), pal.main, 1);
        sEll(bX, bY - S(7), S(4), S(3.5), pal.main);
        limb(bX - S(1), bY - S(9), bX - S(5), bY - S(15), 0.5, pal.main); limb(bX + S(1), bY - S(9), bX + S(5), bY - S(15), 0.5, pal.main);
        ell(bX - S(5), bY - S(15), S(1.2), S(1.2), pal.accent); ell(bX + S(5), bY - S(15), S(1.2), S(1.2), pal.accent);
        eye(bX - S(2), bY - S(7), eS(1.3), 'glow'); eye(bX + S(2), bY - S(7), eS(1.3), 'glow');
        chest = [Math.round(bX), Math.round(bY)];
      } else if (body === 'beetle') {
        for (const s of [-1, 1]) for (let k = 0; k < 3; k++) limb(bX + s * S(5), bY + S(k * 3), bX + s * S(11), bY + S(4 + k * 4), S(0.8), MB.shade(pal.main, 0.5));
        sEll(bX, bY + S(2), S(9), S(10), pal.main, 1);
        for (let j = -8; j < 12; j++) g.set(bX, bY + S(j), MB.shade(pal.main, 0.5));
        ell(bX - S(4), bY - S(2), S(2), S(3), MB.mix(pal.main, [255, 255, 255], 0.4));
        sEll(bX, bY - S(9), S(5), S(4), MB.shade(pal.second, 0.9));
        limb(bX, bY - S(11), bX, bY - S(18), S(1.3), pal.second); limb(bX, bY - S(18), bX - S(3), bY - S(20), S(1), pal.second);
        eye(bX - S(2.5), bY - S(9), eS(1.2), 'glow'); eye(bX + S(2.5), bY - S(9), eS(1.2), 'glow');
        chest = [Math.round(bX), Math.round(bY + S(3))];
      } else if (body === 'spider') {
        for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const a = -0.9 + k * 0.6; limb(bX + s * S(3), bY + S(1), bX + s * S(10), bY + S(-3 + k * 4), S(0.9), MB.shade(pal.main, 0.6)); limb(bX + s * S(10), bY + S(-3 + k * 4), bX + s * S(13), bY + S(4 + k * 3), S(0.8), MB.shade(pal.main, 0.6)); }
        sEll(bX, bY + S(5), S(8), S(7), pal.main, 1);
        ell(bX, bY + S(5), S(3), S(4), pal.second);
        sEll(bX, bY - S(4), S(5), S(4.5), pal.main);
        for (const [ex, ey] of [[-2, -5], [2, -5], [-3.5, -3], [3.5, -3]]) ell(bX + S(ex), bY + S(ey), S(1), S(1), pal.accent);
        chest = [Math.round(bX), Math.round(bY + S(5))];
      } else if (body === 'cocoon') {
        limb(bX, bY - S(18), bX, bY - S(13), S(0.6), [220, 220, 210]);
        for (let k = 0; k < 4; k++) sEll(bX, bY - S(9) + S(k * 5), S(6.5 - Math.abs(k - 1.3) * 1.2), S(3.5), k % 2 ? pal.main : MB.shade(pal.main, 0.88), 1);
        eye(bX - S(2), bY - S(7), eS(1.2), 'sleepy'); eye(bX + S(2), bY - S(7), eS(1.2), 'sleepy');
        chest = [Math.round(bX), Math.round(bY)];
      } else {
        // caterpillar / mantis style insect (side)
        const mantis = sp.stage > 0 || r.chance(0.3);
        if (mantis) {
          wing(bX + S(3), bY - S(4), S(8), 1, 'insect');
          sEll(bX + S(5), bY + S(4), S(7), S(4.5), pal.main, 1);
          sEll(bX - S(1), bY - S(2), S(3.5), S(5), pal.main);
          for (const lx of [2, 6, 9]) limb(bX + S(lx), bY + S(7), bX + S(lx - 1), bY + S(13), S(0.8), MB.shade(pal.main, 0.6));
          limb(bX - S(2), bY - S(2), bX - S(8), bY - S(6), S(1.2), pal.second); limb(bX - S(8), bY - S(6), bX - S(10), bY + S(1), S(1.4), MB.shade(pal.second, 0.9));
          const [hX, hY] = [bX - S(3), bY - S(9)]; sEll(hX, hY, S(4), S(3.5), pal.main);
          limb(hX, hY - S(3), hX - S(4), hY - S(9), 0.5, pal.main); limb(hX + S(1), hY - S(3), hX + S(3), hY - S(9), 0.5, pal.main);
          eyeAt = [hX - S(1.5), hY - S(0.5), eS(1.5)];
          chest = [Math.round(bX + S(4)), Math.round(bY + S(3))];
        } else {
          for (let k = 4; k >= 0; k--) { const [x, y] = [bX + S(10 - k * 4.5), bY + S(5 - (k === 0 ? 4 : 0))]; sEll(x, y, S(k === 0 ? 5.5 : 4.5), S(k === 0 ? 5 : 4.5), k % 2 ? pal.main : MB.mix(pal.main, pal.second, 0.3), 1); ell(x, y + S(3.8), S(1), S(1), MB.shade(pal.main, 0.5)); }
          const [hX, hY] = [bX - S(8), bY + S(1)];
          limb(hX - S(1), hY - S(4), hX - S(3), hY - S(9), 0.6, pal.second); limb(hX + S(1), hY - S(4), hX + S(2), hY - S(9), 0.6, pal.second);
          ell(hX - S(3), hY - S(9), S(1.2), S(1.2), pal.accent);
          eyeAt = [hX - S(2), hY - S(0.5), eS(1.8)];
          chest = [Math.round(bX), Math.round(bY + S(4))];
        }
      }
    } else if (['plant', 'mushroom', 'tree', 'coral'].includes(body)) {
      const [bX, bY] = P(0, -9);
      if (body === 'tree') {
        limb(bX, bY + S(9), bX, bY - S(4), S(5), [130, 90, 55]);
        for (let k = 0; k < 3; k++) { limb(bX + S(-4 + k * 4), bY + S(9), bX + S(-7 + k * 7), bY + S(9), S(1.5), [110, 75, 45]); }
        const crown = MB.mix(pal.main, MB.hex(MB.TYPE_COLORS.Nature), 0.5);
        for (const [x, y, rr] of [[-7, -11, 6], [7, -11, 6], [0, -16, 7.5], [0, -8, 6]]) sEll(bX + S(x), bY + S(y), S(rr), S(rr * 0.85), crown, 1);
        if (tF('Spirit')) for (let k = 0; k < 4; k++) ell(bX + S(r.range(-9, 9)), bY + S(r.range(-20, -6)), S(1), S(1), pal.accent);
        eye(bX - S(2), bY + S(1), eS(1.4), 'sleepy'); eye(bX + S(2), bY + S(1), eS(1.4), 'sleepy');
        chest = [Math.round(bX), Math.round(bY + S(5))];
      } else if (body === 'mushroom') {
        sEll(bX, bY + S(3), S(5.5), S(6.5), pal.belly, 1);
        limb(bX - S(4), bY + S(3), bX - S(8), bY + S(6), S(1.3), pal.belly); limb(bX + S(4), bY + S(3), bX + S(8), bY + S(6), S(1.3), pal.belly);
        sEll(bX, bY - S(5), S(12), S(6.5), pal.main, 1);
        for (let k = 0; k < 5; k++) ell(bX + S(r.range(-9, 9)), bY - S(r.range(5, 9)), S(1.6), S(1.3), pal.second);
        eye(bX - S(2.2), bY + S(2), eS(1.4), eyeStyle); eye(bX + S(2.2), bY + S(2), eS(1.4), eyeStyle);
        chest = [Math.round(bX), Math.round(bY + S(5))];
      } else if (body === 'coral') {
        const cc = pal.main;
        for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.45; limb(bX, bY + S(8), bX + Math.cos(a) * S(15), bY + S(4) + Math.sin(a) * S(14), S(2), k % 2 ? cc : MB.shade(cc, 0.85)); ell(bX + Math.cos(a) * S(15), bY + S(4) + Math.sin(a) * S(14), S(2.4), S(2.4), pal.second); }
        sEll(bX, bY + S(5), S(6), S(5), cc, 1);
        eye(bX - S(2), bY + S(4), eS(1.3), 'round'); eye(bX + S(2), bY + S(4), eS(1.3), 'round');
        chest = [Math.round(bX), Math.round(bY + S(6))];
      } else {
        // flower/bulb creature
        const nPet = r.int(5, 8), petalC = sp.types[1] ? pal.second : MB.hsl(r.int(0, 359), 70, 65);
        // leaves at base
        leaf(bX - S(3), bY + S(8), S(4), Math.PI * 0.9); leaf(bX + S(3), bY + S(8), S(4), Math.PI * 0.1);
        sEll(bX, bY + S(3), S(7), S(6.5), pal.main, 1);
        ell(bX, bY + S(5), S(4.5), S(3.5), pal.belly);
        const [hX, hY] = [bX, bY - S(6)];
        if (sp.stage > 0 || r.chance(0.4)) for (let k = 0; k < nPet; k++) { const a = (k / nPet) * Math.PI * 2; sEll(hX + Math.cos(a) * S(6.5), hY + Math.sin(a) * S(6), S(3.5), S(3.5), petalC); }
        else { leaf(hX, hY - S(4), S(4.5), -Math.PI / 2 - 0.5); leaf(hX, hY - S(4), S(4.5), -Math.PI / 2 + 0.5); }
        sEll(hX, hY, S(5.5), S(5), MB.mix(pal.main, pal.belly, 0.3));
        eye(hX - S(2), hY, eS(1.3), eyeStyle); eye(hX + S(2), hY, eS(1.3), eyeStyle);
        if (tF('Venom')) for (let k = 0; k < 3; k++) ell(bX + S(-4 + k * 4), bY + S(r.range(-1, 6)), S(1), S(1), pal.second);
        chest = [Math.round(bX), Math.round(bY + S(3))];
      }
    } else if (['golem', 'mech', 'biped', 'ape', 'frog'].includes(body)) {
      const [bX, bY] = P(0, -14);
      const isG = body === 'golem', isM = body === 'mech', isA = body === 'ape', isF = body === 'frog';
      const tw = isF ? 9 : isA ? 8 : isG ? 9 : 7, th = isF ? 7 : 8;
      // legs
      const legLen = isF ? 4 : isA ? 4 : 6;
      for (const s of [-1, 1]) {
        if (isF) { sEll(bX + s * S(7), bY + S(th + 2), S(4), S(3), MB.shade(pal.main, 0.85)); ell(bX + s * S(9), bY + S(th + 4.5), S(2.5), S(1.2), MB.shade(pal.main, 0.7)); }
        else { limb(bX + s * S(3.5), bY + S(th - 2), bX + s * S(4), bY + S(th + legLen), S(isG ? 3 : 2.2), MB.shade(pal.main, 0.85)); ell(bX + s * S(4.5), bY + S(th + legLen + 0.5), S(isG ? 3.5 : 2.6), S(1.5), MB.shade(pal.main, 0.6)); }
      }
      // arms
      for (const s of [-1, 1]) {
        const ax = bX + s * S(tw), ay = bY - S(th * 0.4);
        if (isG || isA) { limb(ax, ay, ax + s * S(3), ay + S(9), S(isG ? 3 : 2.5), pal.main); sEll(ax + s * S(3.5), ay + S(10), S(3.5), S(3), MB.shade(pal.main, 0.85)); }
        else if (isM) { limb(ax, ay, ax + s * S(3), ay + S(7), S(1.8), MB.shade(pal.second, 0.9)); ell(ax + s * S(3), ay + S(8), S(2.5), S(2.5), pal.accent); }
        else if (!isF) limb(ax, ay, ax + s * S(4), ay + S(5), S(1.6), pal.main);
      }
      if (isG) { for (let k = 0; k < 5; k++) sEll(bX + S(r.range(-tw, tw) * 0.8), bY + S(r.range(-th, th) * 0.7), S(3.5), S(3), MB.mix(pal.main, [90, 80, 70], 0.2), 1); }
      sEll(bX, bY, S(tw), S(th), pal.main, 1);
      if (isG) for (let k = 0; k < 4; k++) { const x0 = bX + S(r.range(-tw * 0.6, tw * 0.6)), y0 = bY + S(r.range(-th * 0.6, th * 0.6)); g.set(x0, y0, MB.shade(pal.main, 0.5)); g.set(x0 + 1, y0 + 1, MB.shade(pal.main, 0.5)); }
      if (isM) { for (const [x, y] of [[-tw + 2, -th + 2], [tw - 2, -th + 2], [-tw + 2, th - 2], [tw - 2, th - 2]]) g.set(bX + S(x), bY + S(y), [230, 230, 240]); ell(bX, bY, S(3), S(3), pal.accent); ell(bX, bY, S(1.5), S(1.5), [255, 255, 255]); }
      else ell(bX, bY + S(2), S(tw * 0.6), S(th * 0.55), pal.belly);
      // head
      const hr = isF ? 0 : isG ? 5.5 : 5.5;
      let hX = bX, hY = bY - S(th + hr * 0.7);
      if (isF) {
        hY = bY - S(th * 0.6);
        for (const s of [-1, 1]) { sEll(bX + s * S(5), bY - S(th + 1), S(3.2), S(3.2), pal.main); }
        eye(bX - S(5), bY - S(th + 1.3), eS(1.8), eyeStyle); eye(bX + S(5), bY - S(th + 1.3), eS(1.8), eyeStyle);
        for (let k = -5; k <= 5; k++) g.set(bX + S(k), bY - S(1) + Math.abs(k) * 0.2, MB.shade(pal.main, 0.45));
      } else {
        if (isM) { const hc = MB.mix(pal.main, [200, 205, 215], 0.3); for (let j = -hr; j <= hr; j++) for (let i = -hr; i <= hr; i++) g.set(hX + S(i), hY + S(j), Math.abs(i) === hr || Math.abs(j) === hr ? MB.shade(hc, 0.7) : hc); limb(hX, hY - S(hr), hX, hY - S(hr + 4), 0.5, pal.second); ell(hX, hY - S(hr + 4.5), S(1.3), S(1.3), pal.accent); }
        else sEll(hX, hY, S(hr), S(hr * 0.9), pal.main);
        if (isA) ell(hX, hY + S(1.5), S(hr * 0.65), S(hr * 0.5), pal.belly);
        if (isG && r.chance(0.5)) ears(hX, hY, S(hr), 'horn', true);
        if (body === 'biped') ears(hX, hY, S(hr), tF('Metal') ? 'horn' : tF('Psychic') ? 'long' : r.pick(['pointy', 'round', 'horn']), true);
        if (isM) { for (const s of [-1, 1]) ell(hX + s * S(2), hY, S(1.2), S(1.2), pal.accent); }
        else { eye(hX - S(2.2), hY - S(0.5), eS(1.3), isG ? 'glow' : eyeStyle); eye(hX + S(2.2), hY - S(0.5), eS(1.3), isG ? 'glow' : eyeStyle); }
      }
      if (tF('Psychic')) ell(hX, hY - S(isF ? th : 3.5), S(1.3), S(1.3), [255, 90, 190]);
      if (tF('Ice')) { crystal(bX - S(tw * 0.7), bY - S(th * 0.6), S(2.5)); crystal(bX + S(tw * 0.7), bY - S(th * 0.6), S(2.5)); }
      if (tF('Flame')) flame(hX, hY - S(hr), S(2.4));
      chest = [Math.round(bX), Math.round(bY)];
    } else if (body === 'crab' || body === 'turtle' || body === 'shell') {
      const [bX, bY] = P(0, -9);
      if (body === 'crab') {
        for (const s of [-1, 1]) for (let k = 0; k < 3; k++) limb(bX + s * S(6), bY + S(2 + k), bX + s * S(12), bY + S(7 + k * 1.5), S(0.9), MB.shade(pal.main, 0.6));
        for (const s of [-1, 1]) { limb(bX + s * S(7), bY - S(2), bX + s * S(12), bY - S(8), S(1.6), pal.main); sEll(bX + s * S(13), bY - S(11), S(4.5), S(3.5), pal.second); tri(bX + s * S(11), bY - S(13), bX + s * S(16), bY - S(15), bX + s * S(14), bY - S(11), MB.shade(pal.second, 0.85)); }
        sEll(bX, bY, S(10), S(6.5), pal.main, 1);
        if (tF('Metal')) for (let k = -2; k <= 2; k++) g.set(bX + S(k * 3), bY - S(4), [235, 235, 245]);
        if (tF('Venom')) { limb(bX + S(8), bY - S(3), bX + S(12), bY - S(14), S(1.2), pal.second); limb(bX + S(12), bY - S(14), bX + S(8), bY - S(17), S(1), pal.second); tri(bX + S(7), bY - S(17), bX + S(9), bY - S(18), bX + S(6), bY - S(20), pal.accent); }
        limb(bX - S(2.5), bY - S(5), bX - S(3), bY - S(9), 0.5, pal.main); limb(bX + S(2.5), bY - S(5), bX + S(3), bY - S(9), 0.5, pal.main);
        eye(bX - S(3), bY - S(9.5), eS(1.4), eyeStyle); eye(bX + S(3), bY - S(9.5), eS(1.4), eyeStyle);
        chest = [Math.round(bX), Math.round(bY)];
      } else if (body === 'turtle') {
        for (const lx of [-6, 6]) { limb(bX + S(lx), bY + S(3), bX + S(lx - 1), bY + S(8), S(2.3), MB.shade(pal.belly, 0.9)); }
        const [hX, hY] = [bX - S(12), bY - S(2)];
        limb(bX - S(7), bY + S(1), hX, hY, S(2.5), pal.belly);
        sEll(hX, hY, S(4.5), S(4), pal.belly);
        const shellC = pal.second && sp.types[1] ? pal.second : MB.shade(pal.main, 0.9);
        sEll(bX + S(1), bY - S(2), S(11), S(8), shellC, 1);
        for (const [x, y] of [[-4, -4], [3, -5], [-1, 0], [6, -1]]) ell(bX + S(x), bY + S(y), S(2.2), S(1.8), MB.shade(shellC, 0.8));
        for (let i = -10; i <= 12; i++) g.set(bX + S(i), bY + S(4), MB.shade(pal.main, 0.55));
        if (tF('Nature')) { leaf(bX + S(2), bY - S(9), S(4), -Math.PI / 2 - 0.6); leaf(bX + S(2), bY - S(9), S(4), -Math.PI / 2 + 0.6); }
        if (tF('Flame')) { flame(bX - S(2), bY - S(9), S(2)); flame(bX + S(4), bY - S(9), S(2.2)); }
        if (tF('Earth') && sp.legendary) for (let k = 0; k < 4; k++) crystal(bX + S(-6 + k * 4), bY - S(9), S(2.6), MB.hex(MB.TYPE_COLORS.Earth));
        eyeAt = [hX - S(1), hY - S(1), eS(1.4)];
        chest = [Math.round(bX), Math.round(bY)];
      } else {
        sEll(bX, bY + S(3), S(11), S(6), MB.shade(pal.main, 0.85), 1);
        for (let k = -4; k <= 4; k++) for (let j = 0; j < 4; j++) g.set(bX + S(k * 2.4), bY + S(1 + j * 1.5), MB.shade(pal.main, 0.65));
        sEll(bX, bY - S(4), S(11), S(7), pal.main, 1);
        for (let k = -3; k <= 3; k++) { for (let j = -9; j < 2; j++) if (g.get(Math.round(bX + S(k * 3)), Math.round(bY + S(j))) && Math.abs(k) < 3) g.set(bX + S(k * 3), bY + S(j), MB.shade(pal.main, 0.75)); }
        ell(bX, bY + S(1), S(4.5), S(4), [250, 245, 255]);
        ell(bX - S(1), bY, S(1.5), S(1.5), [255, 255, 255]);
        eye(bX - S(5), bY + S(3), eS(1.2), 'round'); eye(bX + S(5), bY + S(3), eS(1.2), 'round');
        chest = [Math.round(bX), Math.round(bY - S(4))];
      }
    } else {
      // floaters: ghost, orb, blob, cloud, candle, star, jelly, sword, chest
      const [bX, bY] = P(0, body === 'blob' ? -8 : -16);
      if (body === 'ghost') {
        const w = 8, h = 10;
        for (const s of [-1, 1]) limb(bX + s * S(w - 1), bY - S(1), bX + s * S(w + 4), bY + S(3), S(1.8), pal.main);
        sEll(bX, bY - S(2), S(w), S(h * 0.8), pal.main, 1);
        for (let k = 0; k < 4; k++) tri(bX - S(w) + S(k * w / 2), bY + S(3), bX - S(w) + S((k + 1) * w / 2), bY + S(3), bX - S(w) + S((k + 0.5) * w / 2), bY + S(9 + (k % 2) * 2), k % 2 ? MB.shade(pal.main, 0.8) : pal.main);
        ell(bX, bY + S(1), S(w * 0.6), S(h * 0.4), pal.belly);
        if (tF('Light') || sp.legendary) { for (let i = -5; i <= 5; i++) g.set(bX + S(i), bY - S(h + 1.5) + Math.abs(i) * 0.15, [255, 240, 150]); }
        if (tF('Ice')) { crystal(bX - S(4), bY - S(h * 0.7), S(2.2)); crystal(bX + S(4), bY - S(h * 0.7), S(2.2)); }
        if (tF('Psychic')) ell(bX, bY - S(h * 0.55), S(1.3), S(1.3), [255, 90, 190]);
        if (tF('Wind')) for (let k = 0; k < 3; k++) limb(bX + S(4 + k), bY - S(7 - k * 3), bX + S(12), bY - S(9 - k * 4), 0.6, pal.second);
        eye(bX - S(3), bY - S(3), eS(1.7), eyeStyle); eye(bX + S(3), bY - S(3), eS(1.7), eyeStyle);
        chest = [Math.round(bX), Math.round(bY + S(1))];
      } else if (body === 'orb') {
        if (sp.stage > 0 || sp.legendary) { for (let i = -15; i <= 15; i++) { const y = bY + S(2) + Math.round(i * 0.25 * sz); g.set(bX + S(i), y, pal.second); g.set(bX + S(i), y + 1, MB.shade(pal.second, 0.8)); } }
        sEll(bX, bY, S(8), S(8), pal.main, 1);
        ell(bX, bY, S(4), S(4), pal.accent);
        ell(bX, bY, S(2), S(2), [255, 255, 255]);
        if (sp.stage > 0 || sp.legendary) for (const s of [-1, 1]) { sEll(bX + s * S(11), bY - S(6), S(2.4), S(2.4), pal.second); sEll(bX + s * S(9), bY + S(9), S(2), S(2), pal.second); }
        eyeAt = null;
        if (!sp.legendary) { eye(bX - S(3.5), bY - S(4), eS(1.2), 'round'); eye(bX + S(3.5), bY - S(4), eS(1.2), 'round'); }
        chest = [Math.round(bX), Math.round(bY + S(5))];
      } else if (body === 'blob') {
        const w = 10, h = 7;
        sEll(bX, bY, S(w), S(h), pal.main, 1);
        for (let i = -w; i <= w; i++) g.set(bX + S(i), bY + S(h), MB.shade(pal.main, 0.6));
        for (let k = 0; k < 3; k++) ell(bX + S(-6 + k * 6), bY + S(h + 1 + (k % 2)), S(1.3), S(1.8), pal.main);
        ell(bX - S(3), bY - S(3), S(2.5), S(1.6), MB.mix(pal.main, [255, 255, 255], 0.5));
        if (tF('Venom')) for (let k = 0; k < 3; k++) ell(bX + S(r.range(-6, 6)), bY + S(r.range(-2, 4)), S(1.3), S(1.3), pal.second);
        if (tF('Flame')) { flame(bX - S(4), bY - S(h - 1), S(2)); flame(bX + S(3), bY - S(h), S(2.4)); }
        if (tF('Earth')) for (let k = 0; k < 3; k++) sEll(bX + S(-5 + k * 5), bY - S(h - 1), S(2.4), S(2), MB.hex(MB.TYPE_COLORS.Earth));
        eye(bX - S(3), bY - S(1), eS(1.5), eyeStyle); eye(bX + S(3), bY - S(1), eS(1.5), eyeStyle);
        for (let k = -2; k <= 2; k++) g.set(bX + S(k), bY + S(3) + (Math.abs(k) === 2 ? -1 : 0), MB.shade(pal.main, 0.4));
        chest = [Math.round(bX), Math.round(bY + S(3))];
      } else if (body === 'cloud') {
        for (const [x, y, rr] of [[-7, 2, 5], [7, 2, 5], [0, -2, 7], [-4, 4, 5], [4, 4, 5]]) sEll(bX + S(x), bY + S(y), S(rr), S(rr * 0.85), pal.belly, 1);
        if (tF('Electric')) for (let k = 0; k < 2; k++) { const x0 = bX + S(-4 + k * 8); limb(x0, bY + S(8), x0 - S(2), bY + S(12), 0.6, pal.accent); limb(x0 - S(2), bY + S(12), x0 + S(1), bY + S(15), 0.6, pal.accent); }
        else if (tF('Aqua')) for (let k = 0; k < 3; k++) ell(bX + S(-5 + k * 5), bY + S(11 + (k % 2) * 2), S(0.9), S(1.5), MB.hex(MB.TYPE_COLORS.Aqua));
        eye(bX - S(3), bY, eS(1.4), eyeStyle); eye(bX + S(3), bY, eS(1.4), eyeStyle);
        chest = [Math.round(bX), Math.round(bY + S(3))];
      } else if (body === 'candle') {
        sEll(bX, bY + S(6), S(5.5), S(9), MB.mix(pal.belly, [245, 240, 230], 0.6), 1);
        for (let k = 0; k < 3; k++) ell(bX + S(-3 + k * 3), bY - S(2) + S(k * 2), S(1.2), S(2.2), MB.mix(pal.belly, [245, 240, 230], 0.4));
        limb(bX, bY - S(3), bX, bY - S(5), 0.5, [60, 50, 50]);
        const fc = tF('Spirit') ? [140, 120, 255] : [255, 120, 40];
        tri(bX - S(4), bY - S(4), bX + S(4), bY - S(4), bX, bY - S(14), fc); tri(bX - S(2), bY - S(4), bX + S(2), bY - S(4), bX, bY - S(10), [200, 220, 255]);
        eye(bX - S(2), bY + S(4), eS(1.3), 'glow'); eye(bX + S(2), bY + S(4), eS(1.3), 'glow');
        chest = [Math.round(bX), Math.round(bY + S(8))];
      } else if (body === 'star') {
        const pts = 5, ro = 11, ri = 4.5;
        for (let k = 0; k < pts; k++) { const a = -Math.PI / 2 + (k / pts) * Math.PI * 2, a1 = a - Math.PI / pts, a2 = a + Math.PI / pts; tri(bX + Math.cos(a1) * S(ri), bY + Math.sin(a1) * S(ri), bX + Math.cos(a2) * S(ri), bY + Math.sin(a2) * S(ri), bX + Math.cos(a) * S(ro), bY + Math.sin(a) * S(ro), k % 2 ? pal.main : MB.shade(pal.main, 0.85), true); }
        sEll(bX, bY, S(ri + 1), S(ri + 1), pal.main, 1);
        ell(bX, bY, S(2.5), S(2.5), pal.accent); g.set(bX - 1, bY - 1, [255, 255, 255]);
        if (tF('Ice') || tF('Light')) for (let k = 0; k < 5; k++) g.set(bX + S(r.range(-13, 13)), bY + S(r.range(-13, 13)), [255, 255, 255]);
        chest = [Math.round(bX), Math.round(bY + S(6))];
      } else if (body === 'jelly') {
        for (let k = 0; k < 5; k++) { const x0 = bX + S(-6 + k * 3); for (let j = 0; j < 12; j++) g.set(x0 + Math.sin(j * 0.7 + k) * 1.2, bY + S(4) + S(j), k % 2 ? pal.second : MB.shade(pal.main, 0.8)); }
        sEll(bX, bY, S(9), S(7), pal.main, 1);
        for (let i = -8; i <= 8; i++) g.set(bX + S(i), bY + S(5) + (i % 2 ? 1 : 0), MB.shade(pal.main, 0.6));
        ell(bX - S(3), bY - S(3), S(2.5), S(1.8), MB.mix(pal.main, [255, 255, 255], 0.55));
        if (sp.stage > 0) ell(bX, bY - S(1), S(3), S(2.5), pal.accent);
        eye(bX - S(3), bY + S(1), eS(1.3), eyeStyle); eye(bX + S(3), bY + S(1), eS(1.3), eyeStyle);
        chest = [Math.round(bX), Math.round(bY + S(2))];
      } else if (body === 'sword') {
        const bc = MB.mix([210, 215, 230], pal.main, 0.25);
        for (let j = -12; j <= 10; j++) for (let i = -2; i <= 2; i++) g.set(bX + S(i), bY + S(j), i === 2 || j < -10 ? MB.shade(bc, 0.7) : i === -1 ? MB.mix(bc, [255, 255, 255], 0.4) : bc);
        tri(bX - S(2.5), bY - S(12), bX + S(2.5), bY - S(12), bX, bY - S(17), bc, true);
        sEll(bX, bY + S(11), S(8), S(1.8), pal.second); limb(bX, bY + S(12), bX, bY + S(18), S(1.4), pal.main); ell(bX, bY + S(19), S(2), S(2), pal.accent);
        for (const s of [-1, 1]) { const sx = bX + s * S(10); limb(bX + s * S(7), bY + S(11), sx, bY + S(4), S(1.2), MB.shade(pal.main, 0.8)); }
        eye(bX, bY + S(11), eS(1.5), 'glow');
        chest = [Math.round(bX), Math.round(bY)];
      } else if (body === 'chest') {
        const cw = 11, ch = 7;
        const wood = MB.mix([150, 95, 50], pal.main, 0.25);
        for (let j = -ch; j <= ch; j++) for (let i = -cw; i <= cw; i++) g.set(bX + S(i), bY + S(j + 6), Math.abs(i) >= cw - 1 || Math.abs(j) >= ch ? MB.shade(wood, 0.6) : j % 4 === 0 ? MB.shade(wood, 0.8) : wood);
        for (let j = -5; j <= 0; j++) for (let i = -cw; i <= cw; i++) g.set(bX + S(i), bY + S(j - 3) - (i + cw) * 0.15, MB.mix(wood, [200, 170, 70], 0.3));
        for (let k = -4; k <= 4; k++) tri(bX + S(k * 2.4 - 1), bY - S(1), bX + S(k * 2.4 + 1), bY - S(1), bX + S(k * 2.4), bY + S(1.5), [255, 255, 255]);
        ell(bX, bY - S(1), S(cw - 1), S(1.2), [80, 20, 30]);
        eye(bX - S(4), bY - S(5), eS(1.4), 'glow'); eye(bX + S(4), bY - S(5), eS(1.4), 'glow');
        ell(bX, bY + S(5), S(2), S(2), [230, 200, 60]);
        chest = [Math.round(bX), Math.round(bY + S(8))];
      } else {
        sEll(bX, bY, S(8), S(8), pal.main, 1);
        eye(bX - S(3), bY - S(2), eS(1.5), eyeStyle); eye(bX + S(3), bY - S(2), eS(1.5), eyeStyle);
      }
    }
    if (eyeAt) eye(eyeAt[0], eyeAt[1], eyeAt[2], eyeStyle);

    // type-wide flourishes
    if (tF('Spirit') && !['ghost', 'candle'].includes(body)) for (let k = 0; k < 4; k++) { const x = r.int(6, 42), y = r.int(6, 30); if (!g.get(x, y)) g.set(x, y, MB.mix(pal.accent, [255, 255, 255], 0.3)); }
    if (sp.legendary) {
      // a crest / crown sigil for legendaries
      const top = (() => { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (g.get(x, y)) return [x, y]; return [24, 4]; })();
      for (let k = -2; k <= 2; k++) g.set(top[0] + k, top[1] - 2 - (Math.abs(k) % 2), pal.accent);
    }
    if (mega) {
      // tribal energy markings across the body
      const mk = MB.mix(pal.accent, [255, 255, 255], 0.15), mk2 = MB.shade(pal.accent, 0.7);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (g.mask[y * N + x] !== 1) continue;
        const v = (y + Math.round(Math.sin(x * 0.45 + (sp.seed & 7)) * 2) + 64) % 8;
        if (v === 0) g.set(x, y, mk); else if (v === 1) g.set(x, y, mk2);
      }
      // crown of spikes along the top of the silhouette
      const cols = [];
      for (let x = 0; x < N; x++) { for (let y = 0; y < N; y++) if (g.get(x, y)) { cols.push([x, y]); break; } }
      if (cols.length) {
        const sorted = cols.slice().sort((a, b) => a[1] - b[1]);
        const used = [];
        for (const [x, y] of sorted) {
          if (used.length >= 3) break;
          if (used.some((u) => Math.abs(u - x) < 5) || y < 5) continue;
          used.push(x);
          tri(x - 2, y + 2, x + 2, y + 2, x, y - 4, MB.shade(pal.accent, 0.8), true);
        }
      }
      megaMark(chest[0], chest[1]);
    }

    // outline pass
    const src = g.px.slice();
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (src[y * N + x]) continue;
      let nb = null;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + ox, yy = y + oy;
        if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
        const c = src[yy * N + xx];
        if (c && g.mask[yy * N + xx] !== 9) { nb = c; break; }
      }
      if (nb) g.px[y * N + x] = MB.shade(MB.mix(nb, [20, 15, 35], 0.6), 0.5);
    }
    if (mega) {
      const src2 = g.px.slice();
      const glow = MB.mix(pal.accent, [255, 255, 255], 0.3);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (src2[y * N + x]) continue;
        let near = false;
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + ox, yy = y + oy; if (xx >= 0 && yy >= 0 && xx < N && yy < N && src2[yy * N + xx]) near = true; }
        if (near && (x * 3 + y * 5) % 4 !== 0) g.px[y * N + x] = glow;
      }
    }
    // to canvas
    const cv = MB.makeCanvas(N, N);
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(N, N);
    for (let i = 0; i < N * N; i++) { const c = g.px[i]; if (!c) continue; img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255; }
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  function get(spKey, mega, shiny) {
    const sp = typeof spKey === 'string' ? MB.SP[spKey] : spKey;
    const k = sp.key + '|' + (mega ? 1 : 0) + '|' + (shiny ? 1 : 0);
    if (!cache[k]) {
      try { cache[k] = draw(sp, !!mega && !!sp.mega, !!shiny); }
      catch (e) { console.error('sprite fail', sp.name, e); cache[k] = MB.makeCanvas(N, N); }
    }
    return cache[k];
  }
  // mirrored (for the player's side)
  const mcache = {};
  function getBack(spKey, mega, shiny) {
    const sp = typeof spKey === 'string' ? MB.SP[spKey] : spKey;
    const k = sp.key + '|' + (mega ? 1 : 0) + '|' + (shiny ? 1 : 0);
    if (!mcache[k]) {
      const s = get(sp, mega, shiny); const c = MB.makeCanvas(N, N); const x = c.getContext('2d');
      x.translate(N, 0); x.scale(-1, 1); x.drawImage(s, 0, 0); mcache[k] = c;
    }
    return mcache[k];
  }
  // egg sprite
  let eggC = null;
  function egg() {
    if (eggC) return eggC;
    const c = MB.makeCanvas(N, N), x = c.getContext('2d');
    for (let j = 0; j < 22; j++) for (let i = 0; i < 18; i++) {
      const dx = (i - 9) / 9, dy = (j - 12) / (j < 12 ? 12 : 10);
      if (dx * dx + dy * dy > 1) continue;
      let col = '#f4f0dc'; if (dx > 0.4 || dy > 0.6) col = '#cfc7a8';
      if ((i * 3 + j * 5) % 23 === 0 || ((i - 5) ** 2 + (j - 9) ** 2 < 5) || ((i - 12) ** 2 + (j - 15) ** 2 < 4)) col = '#7fbf6a';
      x.fillStyle = col; x.fillRect(15 + i, 20 + j, 1, 1);
    }
    eggC = c; return c;
  }
  return { get, getBack, egg, N };
})();
