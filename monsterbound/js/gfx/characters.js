'use strict';
// 16x16 overworld character sprites from pixel templates + appearance palettes.
// Legend: o outline, h hair, H hair shade, s skin, S skin shade, e eye, c top, C top shade,
// p bottoms, P bottoms shade, b shoes, a hat/accessory, A accessory shade, w white
MB.Chars = (function () {
  const HEAD = {
    down: [
      '................',
      '.....oooooo.....',
      '....ohhhhhho....',
      '...ohhhhhhhho...',
      '...ohHhhhhHho...',
      '...ohssssssho...',
      '...oseSssSeso...',
      '...osssssssso...',
      '....oSssssSo....',
    ],
    up: [
      '................',
      '.....oooooo.....',
      '....ohhhhhho....',
      '...ohhhhhhhho...',
      '...ohhhhhhhho...',
      '...ohhHhhHhho...',
      '...ohhhhhhhho...',
      '...oShhhhhhSo...',
      '....oSsssssSo...',
    ],
    left: [
      '................',
      '.....oooooo.....',
      '....ohhhhhho....',
      '...ohhhhhhhho...',
      '...ohhhhhHhho...',
      '...osssshhhho...',
      '...oessshhhho...',
      '...osssssshho...',
      '....oSssssso....',
    ],
  };
  const BODY = {
    down: [
      ['...occcccccco...', '..oscCccccCcso..', '..oSccccccccSo..', '...oCCCCCCCCo...', '....opppppppo...', '....opPo.oPpo...', '....obbo.obbo...'],
      ['...occcccccco...', '..oscCccccCcso..', '..oSccccccccSo..', '...oCCCCCCCCo...', '....opppppppo...', '....opPo.obbo...', '....obbo.......'],
      ['...occcccccco...', '..oscCccccCcso..', '..oSccccccccSo..', '...oCCCCCCCCo...', '....opppppppo...', '....obbo.oPpo...', '.........obbo...'],
    ],
    up: [
      ['...occcccccco...', '..osCccccccCso..', '..oSccccccccSo..', '...oCCCCCCCCo...', '....opppppppo...', '....opPo.oPpo...', '....obbo.obbo...'],
      ['...occcccccco...', '..osCccccccCso..', '..oSccccccccSo..', '...oCCCCCCCCo...', '....opppppppo...', '....opPo.obbo...', '....obbo.......'],
      ['...occcccccco...', '..osCccccccCso..', '..oSccccccccSo..', '...oCCCCCCCCo...', '....opppppppo...', '....obbo.oPpo...', '.........obbo...'],
    ],
    left: [
      ['....occcccco....', '...occccCCcso...', '...ocsccCCcSo...', '....oCCCCCCo....', '....oppppppo....', '.....oPppPo.....', '.....obbbbo.....'],
      ['....occcccco....', '...occccCCcso...', '...ocsccCCcSo...', '....oCCCCCCo....', '....oppppppo....', '...oPpo..oPpo...', '...obbo...obbo..'],
      ['....occcccco....', '...occccCCcso...', '...occsCCccSo...', '....oCCCCCCo....', '....oppppppo....', '....oPpoPpo.....', '....obbobbo.....'],
    ],
  };
  const SKINS = ['#f8d8b8', '#e8b890', '#c08860', '#8a5a3a'];
  const HAIRS = ['#3a2818', '#6a4020', '#c89040', '#e8d070', '#c03828', '#3050a0', '#7040a0', '#e0e0e8', '#208868', '#f080b0'];
  const OUTFITS = ['#d04040', '#3070d0', '#40a050', '#e0a020', '#8040c0', '#303038', '#e070a0', '#40b0c0', '#f0f0f0', '#a06030'];
  const cache = {};
  function build(app) {
    // app: {skin, hair, hairStyle, top, bottom, hat, style}
    const pal = {
      o: '#20182a', h: app.hair, H: MB.rgbStr(MB.shade(MB.hex(app.hair), 0.72)), s: app.skin, S: MB.rgbStr(MB.shade(MB.hex(app.skin), 0.85)),
      e: '#201828', c: app.top, C: MB.rgbStr(MB.shade(MB.hex(app.top), 0.78)), p: app.bottom, P: MB.rgbStr(MB.shade(MB.hex(app.bottom), 0.75)), b: app.shoes || '#40302a',
      a: app.hat || app.top, A: MB.rgbStr(MB.shade(MB.hex(app.hat || app.top), 0.7)), w: '#ffffff',
    };
    const frames = {};
    for (const dir of ['down', 'up', 'left', 'right']) {
      const d = dir === 'right' ? 'left' : dir;
      frames[dir] = [];
      for (let f = 0; f < 3; f++) {
        const c = MB.makeCanvas(16, 18), x = c.getContext('2d');
        let rows = HEAD[d].map((r) => r.padEnd(16, '.').slice(0, 16)).concat(BODY[d][f].map((r) => r.padEnd(16, '.').slice(0, 16)));
        rows = rows.map((r) => r.split(''));
        // hairstyles
        if (app.hairStyle === 'long') { for (const yy of [8, 9, 10]) { if (d !== 'left') { rows[yy][3] = 'h'; rows[yy][12] = 'h'; rows[yy][2] = 'o'; rows[yy][13] = 'o'; } else { rows[yy][10] = 'h'; rows[yy][11] = 'h'; rows[yy][12] = 'o'; } } }
        if (app.hairStyle === 'spiky') { rows[0][5] = 'o'; rows[0][8] = 'o'; rows[0][11] = 'o'; rows[1][5] = 'h'; rows[1][8] = 'h'; rows[1][10] = 'h'; }
        if (app.hairStyle === 'cap' || app.hairStyle === 'hat') {
          for (let i = 4; i <= 11; i++) { rows[2][i] = 'a'; rows[3][i] = i === 4 || i === 11 ? 'A' : 'a'; }
          rows[2][4] = 'o'; rows[2][11] = 'o';
          if (d === 'down') for (let i = 3; i <= 12; i++) rows[4][i] = i === 3 || i === 12 ? 'o' : 'A';
          if (d === 'left') for (let i = 1; i <= 7; i++) rows[4][i] = i === 1 ? 'o' : 'A';
        }
        if (app.hairStyle === 'bun') { rows[0][7] = 'o'; rows[0][8] = 'o'; rows[1][7] = 'h'; rows[1][8] = 'h'; }
        if (app.coat) { for (let yy = 9; yy <= 12; yy++) for (let xx = 0; xx < 16; xx++) if (rows[yy][xx] === 'c') rows[yy][xx] = (xx === 7 || xx === 8) && d !== 'up' ? 'c' : 'w'; }
        if (app.dress) { for (let yy = 13; yy <= 14; yy++) for (let xx = 0; xx < 16; xx++) if (rows[yy][xx] === 'p' || rows[yy][xx] === 'P') rows[yy][xx] = 'C'; }
        if (app.emblem) { if (d === 'down') { rows[10][7] = 'a'; rows[10][8] = 'a'; rows[11][7] = 'A'; } }
        for (let yy = 0; yy < rows.length; yy++) for (let xx = 0; xx < 16; xx++) {
          const ch = rows[yy][xx]; if (ch === '.' || ch === ' ') continue;
          x.fillStyle = pal[ch] || '#ff00ff'; x.fillRect(dir === 'right' ? 15 - xx : xx, yy + 2, 1, 1);
        }
        frames[dir].push(c);
      }
    }
    return frames;
  }
  function get(app) {
    const k = JSON.stringify(app);
    if (!cache[k]) cache[k] = build(app);
    return cache[k];
  }
  function randomApp(seed, kind) {
    const r = new MB.RNG(seed);
    const app = { skin: r.pick(SKINS), hair: r.pick(HAIRS), hairStyle: r.pick(['short', 'long', 'spiky', 'cap', 'bun', 'short']), top: r.pick(OUTFITS), bottom: r.pick(['#3a4a6a', '#4a3a2a', '#2a2a30', '#6a6a70', '#304a30']), shoes: '#40302a' };
    if (r.chance(0.3)) app.dress = true;
    if (kind === 'old') { app.hair = '#d8d8e0'; app.hairStyle = 'bun'; }
    if (kind === 'prof') { app.coat = true; app.hair = '#806040'; app.top = '#506080'; app.hairStyle = 'short'; }
    if (kind === 'nurse') { app.top = '#f080a0'; app.hair = '#f0a0c0'; app.hairStyle = 'cap'; app.hat = '#ffffff'; app.dress = true; }
    if (kind === 'clerk') { app.top = '#3070d0'; app.hairStyle = 'cap'; app.hat = '#3070d0'; }
    if (kind === 'grunt') { app.top = '#2a2430'; app.bottom = '#2a2430'; app.hairStyle = 'cap'; app.hat = '#8040c0'; app.emblem = true; }
    if (kind === 'commander') { app.top = '#402858'; app.bottom = '#201828'; app.emblem = true; app.hat = '#e0c040'; }
    if (kind === 'sailor') { app.top = '#ffffff'; app.bottom = '#2040a0'; app.hairStyle = 'cap'; app.hat = '#2040a0'; }
    if (kind === 'hiker') { app.top = '#a06030'; app.bottom = '#5a4a30'; app.hairStyle = 'cap'; app.hat = '#6a5a30'; }
    if (kind === 'kid') { app.hairStyle = r.pick(['spiky', 'short', 'cap']); }
    if (kind === 'ranger') { app.top = '#40804a'; app.bottom = '#5a4a30'; app.hairStyle = 'hat'; app.hat = '#806a40'; }
    if (kind === 'researcher') { app.coat = true; app.hairStyle = r.pick(['short', 'long', 'bun']); }
    if (kind === 'ace') { app.top = r.pick(['#d04040', '#3070d0', '#202028']); app.bottom = '#ffffff'; }
    return app;
  }
  // type-themed outfits for gym leaders etc.
  function typedApp(type, seed, extra) {
    const app = randomApp(seed, 'ace');
    app.top = MB.TYPE_COLORS[type]; app.bottom = MB.rgbStr(MB.shade(MB.hex(MB.TYPE_COLORS[type]), 0.5));
    return Object.assign(app, extra || {});
  }
  return { get, randomApp, typedApp, SKINS, HAIRS, OUTFITS };
})();
