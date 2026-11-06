'use strict';
// Procedural 16x16 tile art. The same map char renders differently per theme
// (meadow / desert / snow / cave / marsh / volcano / city / ruins / beach / rift / interior)
// and per season, so a handful of glyphs can build very different looking places.
MB.Tiles = (function () {
  const T = 16;
  const cache = {};
  const SEASON_GRASS = {
    spring: ['#78c850', '#68b848', '#90d860', '#5ba040'], summer: ['#5cb040', '#4ea038', '#70c450', '#3f8a30'],
    autumn: ['#b8a048', '#a88a3c', '#cfb85a', '#8a6e30'], winter: ['#d8e4ec', '#c4d4e0', '#eef4f8', '#a8bccc'],
  };
  const THEME_GROUND = {
    desert: ['#e8c878', '#d8b464', '#f4dc94', '#c09850'], snow: ['#e8f0f8', '#d4e0ec', '#ffffff', '#b8c8dc'],
    cave: ['#7a6a5a', '#6a5a4c', '#8a7a68', '#54473c'], marsh: ['#6a7a48', '#5a6a3c', '#7c8c58', '#48552f'],
    volcano: ['#6a4a42', '#5a3c36', '#7c5a50', '#40282a'], ruins: ['#b0a080', '#9c8c6c', '#c4b494', '#7c6c54'],
    beach: ['#f0dca0', '#e4cc8c', '#fff0bc', '#ccb070'], rift: ['#5a5890', '#4c4a80', '#6c6aa8', '#3a3866'], dark: ['#3a3448', '#2e2a3c', '#46405a', '#221e2c'],
    ice: ['#d0f0f8', '#b8e0f0', '#eefcff', '#90c0d8'], sky: ['#c8d0b8', '#b8c0a8', '#d8e0c8', '#a0a890'], obsidian: ['#3a3040', '#2c2434', '#4a3e52', '#1e1824'],
  };
  function px(ctx, x, y, c) { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); }
  function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
  function noiseFill(ctx, pal, seed, density) {
    const r = new MB.RNG(seed);
    rect(ctx, 0, 0, T, T, pal[0]);
    for (let i = 0; i < density; i++) px(ctx, r.int(0, 15), r.int(0, 15), r.pick([pal[1], pal[2], pal[1]]));
  }
  function groundPal(theme, season) {
    if (THEME_GROUND[theme]) return THEME_GROUND[theme];
    if (theme === 'city' || theme === 'interior') return SEASON_GRASS[season === 'winter' ? 'winter' : 'summer'];
    return SEASON_GRASS[season] || SEASON_GRASS.summer;
  }
  function draw(ch, theme, season, frame, variant) {
    const c = MB.makeCanvas(T, T), x = c.getContext('2d');
    const gp = groundPal(theme, season);
    const seed = MB.hash(ch + theme + variant);
    const ground = () => noiseFill(x, gp, seed, 18);
    switch (ch) {
      case '.': case 'X': ground();
        if (theme !== 'cave' && theme !== 'dark' && variant % 3 === 0) { const r = new MB.RNG(seed + 1); for (let i = 0; i < 3; i++) { const a = r.int(1, 13), b = r.int(2, 13); px(x, a, b, gp[3]); px(x, a + 1, b - 1, gp[3]); px(x, a + 2, b, gp[3]); } }
        if ((theme === 'cave' || theme === 'dark') && variant % 4 === 0) { px(x, 4, 5, gp[3]); px(x, 5, 5, gp[2]); px(x, 11, 10, gp[3]); }
        break;
      case ',': { // tall grass (encounter tile)
        ground();
        let blade = season === 'autumn' ? ['#c89838', '#a07020', '#e0b850'] : season === 'winter' ? ['#a8c4b0', '#88a490', '#d8ece0'] : ['#3c9c30', '#2a7a22', '#58b840'];
        if (theme === 'desert') blade = ['#b89a4c', '#8e7234', '#d4bc6a'];
        if (theme === 'marsh') blade = ['#5a7a3a', '#3e5a28', '#7a9a4a'];
        if (theme === 'snow') blade = ['#b0ccd8', '#8aaabb', '#e4f2f8'];
        if (theme === 'cave' || theme === 'dark') blade = ['#5a5048', '#463c36', '#6e6258'];
        if (theme === 'rift') blade = ['#8a70d0', '#6a50b0', '#b098f0'];
        if (theme === 'volcano') blade = ['#7a5040', '#5a382c', '#9a6a50'];
        const sway = frame % 2;
        for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
          const bx = i * 4 + (j ? 2 : 0), by = j * 8 + 7;
          rect(x, bx, by - 5, 1, 6, blade[1]); rect(x, bx + 1 + sway * (j ? 0 : 1) - (j ? 0 : 1) * 0, by - 7, 1, 8, blade[0]); rect(x, bx + 2, by - 4, 1, 5, blade[1]);
          px(x, bx + 1, by - 7, blade[2]);
        }
        break;
      }
      case ':': { // path
        const pp = theme === 'snow' ? ['#c8ccd8', '#b4b8c8', '#dcdee8'] : theme === 'cave' || theme === 'dark' ? ['#8c7c68', '#7c6c5a', '#9c8c78'] : theme === 'desert' ? ['#d0a868', '#c09458', '#dcb878'] : ['#d8bc88', '#c8a874', '#e8d09c'];
        noiseFill(x, pp, seed, 14);
        break;
      }
      case '=': { // paved
        const pv = theme === 'ruins' ? ['#c0b090', '#a89878', '#d4c4a4'] : theme === 'rift' ? ['#8a88c0', '#7270a8', '#a4a2d8'] : ['#b8b4ac', '#a4a098', '#ccc8c0'];
        rect(x, 0, 0, T, T, pv[0]); rect(x, 0, 7, T, 1, pv[1]); rect(x, 0, 15, T, 1, pv[1]); rect(x, 7, 0, 1, 7, pv[1]); rect(x, 15, 8, 1, 7, pv[1]); px(x, 3, 3, pv[2]); px(x, 11, 11, pv[2]);
        break;
      }
      case 's': noiseFill(x, THEME_GROUND.beach, seed, 16); break;
      case 'F': { ground(); const r = new MB.RNG(seed); const cols = season === 'winter' ? ['#e8f0ff', '#c8d8f0'] : [r.pick(['#f05050', '#f0d040', '#f080c0', '#ffffff', '#a070f0']), '#f8f0a0'];
        for (const [a, b] of [[3, 4], [11, 3], [7, 10], [13, 12], [2, 12]]) { px(x, a, b, cols[0]); px(x, a - 1, b, cols[0]); px(x, a + 1, b, cols[0]); px(x, a, b - 1, cols[0]); px(x, a, b + 1, cols[0]); px(x, a, b, cols[1]); px(x, a, b + 2, '#3a8a30'); }
        break; }
      case 'T': { // tree / theme obstacle
        ground();
        if (theme === 'desert') { // cactus
          rect(x, 6, 2, 4, 13, '#4a9a40'); rect(x, 7, 2, 1, 13, '#6ac060'); rect(x, 2, 6, 3, 2, '#4a9a40'); rect(x, 2, 3, 2, 4, '#4a9a40'); rect(x, 11, 8, 3, 2, '#4a9a40'); rect(x, 12, 4, 2, 5, '#4a9a40'); rect(x, 9, 2, 1, 13, '#3a7a30');
          rect(x, 5, 15, 6, 1, '#c09850');
        } else if (theme === 'cave' || theme === 'dark' || theme === 'volcano' || theme === 'obsidian') { // rock pillar
          const rc = theme === 'volcano' ? ['#5a3c34', '#3e2824', '#7a5448'] : theme === 'obsidian' ? ['#2a2232', '#1a1420', '#4a3c58'] : ['#6a5c50', '#4c4038', '#8a7a6a'];
          rect(x, 1, 2, 14, 14, rc[0]); rect(x, 1, 2, 14, 2, rc[2]); rect(x, 12, 4, 3, 12, rc[1]); rect(x, 3, 7, 4, 1, rc[1]); rect(x, 6, 11, 5, 1, rc[1]); rect(x, 0, 15, 16, 1, rc[1]);
        } else if (theme === 'beach') { // palm
          rect(x, 7, 6, 2, 10, '#a07848'); rect(x, 8, 6, 1, 10, '#c09868');
          for (const [a, b, w] of [[1, 3, 7], [8, 2, 7], [3, 1, 10]]) rect(x, a, b, w, 2, '#3c9c30'); rect(x, 0, 5, 3, 1, '#2a7a22'); rect(x, 13, 4, 3, 1, '#2a7a22'); px(x, 7, 4, '#6a4020'); px(x, 9, 4, '#6a4020');
        } else if (theme === 'marsh') { // dead tree
          rect(x, 6, 4, 4, 12, '#5a4a3a'); rect(x, 2, 3, 5, 2, '#5a4a3a'); rect(x, 9, 1, 5, 2, '#5a4a3a'); rect(x, 7, 4, 1, 12, '#7a6a52'); rect(x, 2, 6, 12, 4, '#4a6a3a'); rect(x, 3, 5, 10, 1, '#5a7a48');
        } else if (theme === 'rift') { // crystal spire
          rect(x, 5, 3, 6, 13, '#8a70d0'); rect(x, 6, 1, 4, 3, '#b098f0'); rect(x, 6, 3, 2, 12, '#d0c0ff'); rect(x, 9, 4, 2, 12, '#5a40a0'); rect(x, 1, 9, 3, 7, '#7a60c0'); rect(x, 12, 8, 3, 8, '#6a50b0');
        } else {
          const snow = season === 'winter' || theme === 'snow';
          const leaf = season === 'autumn' && theme !== 'city' ? ['#d07a30', '#a85a20', '#e8a048'] : snow ? ['#3a7a50', '#2a5a3c', '#e8f0f8'] : ['#3c8c34', '#2a6a28', '#58a848'];
          if (snow || theme === 'mountain') { // pine
            rect(x, 7, 12, 2, 4, '#6a4a2a');
            for (let i = 0; i < 4; i++) rect(x, 6 - i * 1.5, 1 + i * 3, 4 + i * 3, 3, i % 2 ? leaf[0] : leaf[1]);
            if (snow) { rect(x, 6, 1, 4, 1, leaf[2]); rect(x, 4, 4, 3, 1, leaf[2]); rect(x, 10, 7, 3, 1, leaf[2]); rect(x, 2, 10, 4, 1, leaf[2]); }
          } else {
            rect(x, 6, 11, 4, 5, '#7a5230'); rect(x, 7, 11, 1, 5, '#9a7248');
            rect(x, 1, 2, 14, 10, leaf[0]); rect(x, 3, 0, 10, 2, leaf[0]); rect(x, 0, 4, 16, 6, leaf[0]);
            rect(x, 2, 9, 12, 3, leaf[1]); rect(x, 11, 3, 4, 7, leaf[1]);
            rect(x, 4, 2, 4, 2, leaf[2]); rect(x, 2, 4, 2, 2, leaf[2]); px(x, 9, 5, leaf[2]);
            rect(x, 0, 15, 16, 1, 'rgba(0,0,0,0.2)');
          }
        }
        break;
      }
      case '#': case 'H': { // cliff / rock wall (H = climbable)
        const rc = theme === 'snow' ? ['#a8b4c4', '#8894a8', '#e8eef4'] : theme === 'desert' ? ['#c09060', '#a07448', '#dcb07c'] : theme === 'volcano' ? ['#5a3c34', '#3e2824', '#7a5448'] : theme === 'rift' ? ['#5a4a90', '#40306e', '#7a6ab0'] : theme === 'obsidian' ? ['#2a2232', '#1a1420', '#4a3c58'] : theme === 'ruins' ? ['#9c8a6a', '#7c6c50', '#b8a888'] : ['#9a8a70', '#7a6a54', '#b4a48a'];
        rect(x, 0, 0, T, T, rc[0]);
        if (['cave', 'dark', 'volcano', 'obsidian', 'rift'].includes(theme) || ch === 'H') {
          // natural rock: lumpy boulders with highlights and cracks
          const rr = new MB.RNG(seed + variant);
          for (let k = 0; k < 4; k++) {
            const bx = rr.int(0, 12), by = rr.int(0, 12), bw = rr.int(5, 9), bh = rr.int(4, 7);
            rect(x, bx, by, bw, bh, rc[1]); rect(x, bx, by, bw - 1, bh - 1, rc[0]); rect(x, bx + 1, by, bw - 3, 1, rc[2]);
          }
          px(x, rr.int(2, 13), rr.int(2, 13), rc[1]); px(x, rr.int(2, 13), rr.int(2, 13), rc[2]);
        } else {
          rect(x, 0, 0, T, 2, rc[2]); rect(x, 0, 7, T, 1, rc[1]); rect(x, 0, 14, T, 2, rc[1]);
          rect(x, (variant % 2) * 6 + 3, 2, 1, 5, rc[1]); rect(x, (variant % 2) * -4 + 10, 8, 1, 6, rc[1]);
        }
        if (ch === 'H') { for (const [a, b] of [[3, 4], [10, 6], [5, 10], [12, 12]]) { rect(x, a, b, 3, 2, '#5a4a38'); px(x, a, b, '#c8b898'); } }
        break;
      }
      case '~': case 'D': { // water / deep water
        const deep = ch === 'D';
        let wc = deep ? ['#2850a8', '#1e4090', '#4070c0'] : theme === 'marsh' ? ['#4a7a6a', '#3a6458', '#6a9a88'] : theme === 'volcano' ? ['#d05020', '#a83810', '#f09040'] : theme === 'rift' ? ['#6a60d0', '#5048b0', '#9a90f0'] : ['#4890e0', '#3878c8', '#78b8f0'];
        if (theme === 'snow' && season === 'winter' && !deep) wc = ['#78b0e0', '#6098c8', '#a8d4f0'];
        rect(x, 0, 0, T, T, wc[0]);
        const f = frame % 4;
        for (let i = 0; i < 3; i++) { const yy = (i * 6 + f * 2 + (variant % 3)) % 16; rect(x, (i * 5 + f) % 12, yy, 4, 1, wc[2]); rect(x, (i * 5 + f + 6) % 14, (yy + 3) % 16, 3, 1, wc[1]); }
        break;
      }
      case 'x': { // lava
        rect(x, 0, 0, T, T, '#c83818'); const f = frame % 4;
        for (let i = 0; i < 4; i++) rect(x, (i * 4 + f) % 16, (i * 5 + f * 3) % 16, 3, 2, '#f8a030');
        px(x, (f * 5) % 16, 8, '#fff080');
        break;
      }
      case 'L': { // ledge (jump down south)
        ground(); const lc = theme === 'desert' ? '#a07448' : theme === 'snow' ? '#8894a8' : '#5a8a3a';
        rect(x, 0, 10, T, 3, lc); rect(x, 0, 13, T, 1, 'rgba(0,0,0,0.3)'); rect(x, 0, 9, T, 1, 'rgba(255,255,255,0.25)');
        break;
      }
      case 'f': { ground(); const fc = theme === 'ruins' ? '#9c8a6a' : '#e8e0d0'; rect(x, 0, 5, T, 2, fc); rect(x, 0, 10, T, 2, fc); rect(x, 2, 3, 2, 11, fc); rect(x, 12, 3, 2, 11, fc); rect(x, 0, 12, T, 1, 'rgba(0,0,0,0.25)'); break; }
      case 'B': { ground(); rect(x, 2, 3, 12, 12, '#8a8070'); rect(x, 1, 5, 14, 8, '#8a8070'); rect(x, 3, 4, 5, 3, '#b0a890'); rect(x, 10, 10, 4, 4, '#6a6050'); rect(x, 2, 14, 12, 1, '#504840'); break; }
      case 'C': { ground(); rect(x, 2, 3, 12, 12, '#a08a6a'); rect(x, 1, 5, 14, 8, '#a08a6a'); rect(x, 4, 5, 1, 6, '#5a4a38'); rect(x, 5, 8, 5, 1, '#5a4a38'); rect(x, 9, 4, 1, 5, '#5a4a38'); rect(x, 10, 11, 3, 1, '#5a4a38'); rect(x, 2, 14, 12, 1, '#504030'); break; }
      case 'b': { ground(); rect(x, 2, 4, 12, 10, '#3a6a30'); rect(x, 1, 6, 14, 6, '#3a6a30'); for (const [a, b] of [[3, 5], [8, 4], [12, 7], [5, 10], [10, 11]]) { px(x, a, b, '#e8e0b0'); px(x, a + 1, b - 1, '#2a4a20'); } rect(x, 4, 6, 3, 2, '#5a8a48'); break; }
      case 'S': { ground(); rect(x, 7, 9, 2, 7, '#7a5230'); rect(x, 2, 3, 12, 7, '#a07848'); rect(x, 3, 4, 10, 5, '#d8c098'); rect(x, 4, 5, 8, 1, '#7a6040'); rect(x, 4, 7, 6, 1, '#7a6040'); rect(x, 2, 10, 12, 1, '#5a3a20'); break; }
      case 'l': { ground(); rect(x, 7, 4, 2, 12, '#404858'); rect(x, 5, 1, 6, 4, '#505868'); rect(x, 6, 2, 4, 2, frame >= 0 ? '#fff0a0' : '#aaa'); rect(x, 5, 15, 6, 1, '#303040'); break; }
      case 'i': { rect(x, 0, 0, T, T, '#c0ecf8'); rect(x, 2, 3, 5, 1, '#ffffff'); rect(x, 9, 10, 4, 1, '#ffffff'); rect(x, 0, 15, T, 1, '#a0d0e8'); px(x, 12, 4, '#ffffff'); break; }
      case 'K': { // bridge
        const wc = ['#4890e0', '#3878c8'];
        rect(x, 0, 0, T, T, wc[0]); rect(x, 0, 2, T, 12, '#a87c4c'); for (let i = 0; i < 4; i++) rect(x, i * 4, 2, 1, 12, '#7a5430'); rect(x, 0, 2, T, 1, '#5a3a20'); rect(x, 0, 13, T, 1, '#5a3a20');
        break;
      }
      case 'P': { ground(); rect(x, 2, 6, 12, 10, '#a8a0c0'); rect(x, 3, 4, 10, 3, '#c8c0e0'); rect(x, 6, 1, 4, 4, '#80e0ff'); px(x, 7, 2, '#ffffff'); rect(x, 2, 15, 12, 1, '#605878'); break; }
      case 'E': { // cave entrance
        ground(); rect(x, 1, 2, 14, 14, '#2a2420'); rect(x, 3, 1, 10, 2, '#2a2420'); rect(x, 0, 4, 2, 12, '#7a6a54'); rect(x, 14, 4, 2, 12, '#7a6a54'); rect(x, 2, 0, 12, 1, '#7a6a54'); break;
      }
      case '>': { // ladder / stairs
        rect(x, 0, 0, T, T, theme === 'cave' || theme === 'dark' ? '#3a2e26' : '#8a7a66');
        rect(x, 3, 0, 2, T, '#a07848'); rect(x, 11, 0, 2, T, '#a07848'); for (let i = 1; i < 16; i += 4) rect(x, 3, i, 10, 2, '#c09868');
        break;
      }
      case 'e': { // interior stairs
        rect(x, 0, 0, T, T, '#8a6a4a'); for (let i = 0; i < 4; i++) { rect(x, 0, i * 4, T, 3, i % 2 ? '#a88660' : '#b89670'); rect(x, 0, i * 4 + 3, T, 1, '#5a4030'); } break;
      }
      case 'R': case 'r': { // rift phase tiles: R solid in gloam phase, r solid in bright phase. variant: 1 when active(solid)
        noiseFill(x, THEME_GROUND.rift, seed, 10);
        const solid = variant === 1;
        if (solid) { rect(x, 1, 1, 14, 14, ch === 'R' ? '#c0a8ff' : '#402868'); rect(x, 3, 3, 10, 10, ch === 'R' ? '#e8dcff' : '#2a1848'); rect(x, 1, 14, 14, 1, 'rgba(0,0,0,0.4)'); }
        else { rect(x, 2, 2, 12, 12, 'rgba(255,255,255,0.08)'); for (let i = 0; i < 4; i++) px(x, 3 + i * 3, 3 + ((i * 7) % 10), ch === 'R' ? '#c0a8ff' : '#2a1848'); }
        break;
      }
      // ---------------- interior ----------------
      case '_': { rect(x, 0, 0, T, T, theme === 'gym' ? '#c8c0b0' : '#d8b888'); if (theme !== 'gym') { rect(x, 0, 7, T, 1, '#c0a070'); rect(x, 0, 15, T, 1, '#c0a070'); rect(x, variant % 2 ? 4 : 11, 0, 1, 7, '#c0a070'); rect(x, variant % 2 ? 9 : 2, 8, 1, 7, '#c0a070'); } else { rect(x, 0, 0, T, 1, '#b0a898'); rect(x, 0, 0, 1, T, '#b0a898'); } break; }
      case 'W': { rect(x, 0, 0, T, T, theme === 'lab' ? '#e0e4ec' : '#e8dcc0'); rect(x, 0, 12, T, 4, theme === 'lab' ? '#a8b0c0' : '#a8906c'); rect(x, 0, 11, T, 1, '#7a6a54'); if (variant % 3 === 0) { rect(x, 4, 2, 8, 6, '#88c0e8'); rect(x, 4, 2, 8, 1, '#ffffff'); rect(x, 7, 2, 1, 6, '#ffffff'); rect(x, 3, 8, 10, 1, '#7a6a54'); } break; }
      case 'k': { rect(x, 0, 0, T, T, '#d8b888'); rect(x, 0, 2, T, 12, '#b07848'); rect(x, 0, 2, T, 3, '#d09868'); rect(x, 0, 13, T, 1, '#6a4428'); break; }
      case 'Y': { rect(x, 0, 0, T, T, '#d8b888'); rect(x, 1, 3, 14, 9, '#a06838'); rect(x, 1, 3, 14, 2, '#c08858'); rect(x, 2, 12, 2, 4, '#704828'); rect(x, 12, 12, 2, 4, '#704828'); break; }
      case 'Q': { rect(x, 0, 0, T, T, '#8a5a30'); for (let i = 0; i < 3; i++) { rect(x, 1, 1 + i * 5, 14, 4, '#5a3818'); const r = new MB.RNG(seed + i); for (let j = 0; j < 6; j++) rect(x, 2 + j * 2, 2 + i * 5, 2, 3, r.pick(['#c04040', '#4060c0', '#40a050', '#d0b040', '#8050a0'])); } break; }
      case 'p': { rect(x, 0, 0, T, T, '#d8b888'); rect(x, 2, 2, 12, 11, '#505868'); rect(x, 3, 3, 10, 7, frame % 2 ? '#60d0ff' : '#50c0f0'); rect(x, 4, 4, 4, 1, '#ffffff'); rect(x, 1, 13, 14, 3, '#606878'); break; }
      case 'h': { rect(x, 0, 0, T, T, '#d8b888'); rect(x, 1, 3, 14, 12, '#e8e8f0'); rect(x, 2, 4, 12, 4, '#f06080'); for (let i = 0; i < 3; i++) rect(x, 3 + i * 4, 9, 2, 2, frame % 2 && i === 1 ? '#ffffff' : '#ff90a8'); rect(x, 1, 14, 14, 1, '#9090a0'); break; }
      case 'u': { rect(x, 0, 0, T, T, '#c04848'); rect(x, 1, 1, 14, 14, '#d86060'); rect(x, 3, 3, 10, 10, '#c04848'); rect(x, 5, 5, 6, 6, '#e8c060'); break; }
      case 'o': { rect(x, 0, 0, T, T, '#d8b888'); rect(x, 4, 9, 8, 6, '#b06040'); rect(x, 3, 9, 10, 2, '#c87850'); rect(x, 3, 2, 10, 7, '#3c9c30'); rect(x, 5, 1, 6, 2, '#58b840'); break; }
      case 'z': { rect(x, 0, 0, T, T, '#d8b888'); rect(x, 1, 0, 14, 16, '#7a5232'); rect(x, 2, 1, 12, 14, '#f0f0f8'); rect(x, 2, 6, 12, 9, '#5080d0'); rect(x, 3, 2, 10, 3, '#ffffff'); break; }
      case 'G': { const gc = ['#c8c0d8', '#b0a8c4']; rect(x, 0, 0, T, T, gc[(variant + (variant >> 4)) % 2]); rect(x, 0, 0, T, 1, '#e0d8f0'); break; }
      case 'q': { rect(x, 0, 0, T, T, '#c8c0d8'); rect(x, 3, 3, 10, 10, variant ? '#50d070' : '#d05050'); rect(x, 5, 5, 6, 6, variant ? '#90f0a8' : '#f09090'); break; }
      case 'v': { if (variant) { rect(x, 0, 0, T, T, '#c8c0d8'); rect(x, 0, 6, T, 4, '#9088a0'); } else { rect(x, 0, 0, T, T, '#605878'); for (let i = 1; i < 16; i += 3) rect(x, i, 0, 1, T, '#d0c060'); rect(x, 0, 0, T, 2, '#403850'); } break; }
      case 't': { rect(x, 0, 0, T, T, '#c8c0d8'); const f = frame % 4; rect(x, 2, 2, 12, 12, '#7050c0'); rect(x, 4, 4, 8, 8, f % 2 ? '#a080ff' : '#c0a8ff'); rect(x, 7 - f, 7 - f, 2 + f * 2, 2 + f * 2, 'rgba(255,255,255,0.4)'); break; }
      case 'd': { rect(x, 0, 0, T, T, '#1a1626'); px(x, variant % 16, (variant * 7) % 16, '#2a2640'); break; }
      case 'w': { rect(x, 0, 0, T, T, '#283040'); rect(x, 0, 0, T, 2, '#384858'); break; } // void / dark wall
      default: ground();
    }
    return c;
  }
  function get(ch, theme, season, frame, variant) {
    const animated = ch === '~' || ch === 'D' || ch === 'x' || ch === ',' || ch === 't' || ch === 'p' || ch === 'h';
    const f = animated ? frame : 0;
    const v = variant || 0;
    const k = ch + theme + season + f + '|' + v;
    let c = cache[k];
    if (!c) { c = cache[k] = draw(ch, theme, season, f, v); }
    return c;
  }
  // ---------------- buildings ----------------
  const bcache = {};
  const KINDS = {
    center: { roof: '#d84848', wall: '#f4ece0', sign: 'HEAL', signC: '#d84848' },
    shop: { roof: '#4870d0', wall: '#f4ece0', sign: 'SHOP', signC: '#4870d0' },
    house: { roof: null, wall: '#ece0c8' },
    lab: { roof: '#707888', wall: '#f0f0f4', sign: 'LAB', signC: '#405060' },
    gym: { roof: '#a07830', wall: '#e8d8b0', sign: 'GYM', signC: '#a07830' },
    daycare: { roof: '#e89850', wall: '#f8ecd8', sign: 'CARE', signC: '#c87030' },
    tower: { roof: '#8050b0', wall: '#e0d8ec', sign: 'TOWER', signC: '#603890' },
    hq: { roof: '#302838', wall: '#4a4058', sign: 'ECLIPSE', signC: '#a060e0' },
    league: { roof: '#d0a830', wall: '#f0ece0', sign: 'LEAGUE', signC: '#a08020' },
    museum: { roof: '#6a8a70', wall: '#ece4d0', sign: 'MUSEUM', signC: '#4a6a50' },
    port: { roof: '#3a6a90', wall: '#e8e0d0', sign: 'PORT', signC: '#2a5070' },
    hut: { roof: '#8a6a40', wall: '#c8a878' },
    igloo: { roof: '#e8f0f8', wall: '#d0e0ec' },
    observatory: { roof: '#6870a0', wall: '#e0e0ec', sign: 'STARS', signC: '#404880' },
    facility: { roof: '#c04080', wall: '#f0e0ec', sign: 'BATTLE', signC: '#a02060' },
    temple: { roof: '#b0a070', wall: '#d8d0b8', sign: '', signC: '#807050' },
  };
  function building(b, season) {
    const k = b.kind + b.w + 'x' + b.h + (b.roof || '') + season + (b.label || '');
    if (bcache[k]) return bcache[k];
    const W = b.w * T, H = b.h * T;
    const c = MB.makeCanvas(W, H), x = c.getContext('2d');
    const kd = KINDS[b.kind] || KINDS.house;
    const roofC = MB.hex(b.roof || kd.roof || '#b05040');
    const wallC = MB.hex(kd.wall);
    const roofH = Math.floor(H * (b.kind === 'igloo' ? 0.7 : 0.48));
    if (b.kind === 'igloo') {
      x.fillStyle = MB.rgbStr(wallC); x.beginPath(); x.ellipse(W / 2, H, W / 2, H * 0.95, 0, Math.PI, 0); x.fill();
      x.fillStyle = '#a8bccc'; for (let i = 0; i < 4; i++) x.fillRect(0, H - 6 - i * 8, W, 1);
      x.fillStyle = '#3a4050'; x.fillRect(W / 2 - 6, H - 14, 12, 14);
      return (bcache[k] = c);
    }
    // walls
    x.fillStyle = MB.rgbStr(wallC); x.fillRect(1, roofH - 2, W - 2, H - roofH + 2);
    x.fillStyle = MB.rgbStr(MB.shade(wallC, 0.8)); x.fillRect(1, H - 3, W - 2, 3);
    x.fillStyle = MB.rgbStr(MB.shade(wallC, 0.88)); for (let i = roofH + 6; i < H - 3; i += 6) x.fillRect(1, i, W - 2, 1);
    // roof
    for (let j = 0; j < roofH; j++) {
      const inset = Math.max(0, 3 - j);
      x.fillStyle = MB.rgbStr(j % 4 === 3 ? MB.shade(roofC, 0.75) : j < 2 ? MB.mix(roofC, [255, 255, 255], 0.25) : roofC);
      x.fillRect(inset, j, W - inset * 2, 1);
    }
    x.fillStyle = MB.rgbStr(MB.shade(roofC, 0.6)); x.fillRect(0, roofH - 2, W, 2);
    if (season === 'winter' && b.kind !== 'hq') { x.fillStyle = '#f4f8ff'; x.fillRect(2, 0, W - 4, 3); for (let i = 3; i < W - 3; i += 5) x.fillRect(i, 3, 2, 2); }
    // windows
    const doorX = (b.door !== undefined ? b.door : Math.floor(b.w / 2)) * T;
    for (let wx = 6; wx < W - 12; wx += 20) {
      if (Math.abs(wx + 5 - (doorX + 8)) < 14) continue;
      x.fillStyle = '#6a5a48'; x.fillRect(wx - 1, roofH + 5, 12, 11);
      x.fillStyle = b.kind === 'hq' ? '#a060e0' : '#90c8f0'; x.fillRect(wx, roofH + 6, 10, 9);
      x.fillStyle = '#ffffff'; x.fillRect(wx + 1, roofH + 7, 3, 1); x.fillStyle = '#6a5a48'; x.fillRect(wx + 4, roofH + 6, 1, 9);
    }
    // door
    x.fillStyle = '#4a3020'; x.fillRect(doorX + 2, H - 15, 12, 15);
    x.fillStyle = b.kind === 'center' || b.kind === 'shop' || b.kind === 'lab' || b.kind === 'league' || b.kind === 'facility' ? '#a0d8f0' : '#8a5a38';
    x.fillRect(doorX + 3, H - 14, 10, 14);
    if (x.fillStyle === '#a0d8f0') { x.fillStyle = '#ffffff'; x.fillRect(doorX + 4, H - 13, 2, 6); x.fillStyle = '#6090a8'; x.fillRect(doorX + 7, H - 14, 1, 14); }
    else { x.fillStyle = '#e0c060'; x.fillRect(doorX + 11, H - 8, 1, 2); }
    // sign
    const label = b.label || kd.sign;
    if (label) {
      x.font = 'bold 7px monospace'; const tw = x.measureText(label).width + 6;
      const sx = Math.floor(W / 2 - tw / 2), sy = roofH - 11;
      x.fillStyle = '#ffffff'; x.fillRect(sx, sy, tw, 9); x.fillStyle = kd.signC; x.fillRect(sx, sy, tw, 1); x.fillRect(sx, sy + 8, tw, 1);
      x.fillText(label, sx + 3, sy + 7);
    }
    if (b.kind === 'gym' && b.emblem) { x.fillStyle = MB.TYPE_COLORS[b.emblem]; x.beginPath(); x.arc(W / 2, roofH / 2 - 3, 5, 0, Math.PI * 2); x.fill(); x.strokeStyle = '#fff'; x.stroke(); }
    if (b.kind === 'observatory') { x.fillStyle = '#c8cce0'; x.beginPath(); x.arc(W / 2, roofH - 2, roofH - 2, Math.PI, 0); x.fill(); x.fillStyle = '#404870'; x.fillRect(W / 2 - 2, 2, 4, roofH - 4); }
    return (bcache[k] = c);
  }
  return { get, building, T, KINDS };
})();
