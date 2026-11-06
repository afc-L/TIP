'use strict';
// Battle backgrounds (cached per environment + time of day) and weather overlays.
MB.BattleBG = (function () {
  const cache = {};
  const ENV = {
    grass: { sky: ['#88c8f0', '#d0ecff'], ground: ['#88c860', '#68a848'], plat: '#a8d878', platE: '#78b050', hills: '#70b060' },
    forest: { sky: ['#60a070', '#a0d0a0'], ground: ['#4a8a3a', '#3a6a2c'], plat: '#7ab060', platE: '#4a8040', hills: '#2a5a2a', trees: true },
    cave: { sky: ['#2a2420', '#4a4038'], ground: ['#6a5a4a', '#4a3e34'], plat: '#8a7a68', platE: '#5a4c40', hills: '#3a3028', rocks: true },
    dark: { sky: ['#100c18', '#201a2a'], ground: ['#2a2434', '#1a1622'], plat: '#3a3448', platE: '#242030', hills: '#16121e', rocks: true },
    water: { sky: ['#78b8f0', '#c8e8ff'], ground: ['#3880d0', '#2860b0'], plat: '#78b8f0', platE: '#4890e0', hills: '#5898d8', water: true },
    desert: { sky: ['#f0b070', '#ffe8b0'], ground: ['#e8c070', '#d0a050'], plat: '#f4d898', platE: '#d0a868', hills: '#d89858' },
    snow: { sky: ['#a8c0d8', '#e8f0f8'], ground: ['#e8f0f8', '#c8d8e8'], plat: '#ffffff', platE: '#c0d0e0', hills: '#b0c4d8' },
    volcano: { sky: ['#401818', '#a04020'], ground: ['#5a3a30', '#3a2420'], plat: '#7a5040', platE: '#4a2c24', hills: '#2a1414', lava: true },
    marsh: { sky: ['#506850', '#90a888'], ground: ['#5a6a40', '#404c2c'], plat: '#7a8a58', platE: '#4c5a34', hills: '#3a4a30' },
    city: { sky: ['#90b8e0', '#d8e8f8'], ground: ['#b0aca4', '#908c84'], plat: '#d0ccc4', platE: '#a09c94', hills: '#8090a8', city: true },
    ruins: { sky: ['#a08868', '#d8c8a0'], ground: ['#b0a080', '#8a7a5c'], plat: '#ccbc9c', platE: '#9c8c6c', hills: '#7a6a50', pillars: true },
    sky: { sky: ['#6890e0', '#c0d8ff'], ground: ['#c0c8b0', '#9aa088'], plat: '#e0e8d8', platE: '#a8b098', hills: '#e8f0ff', clouds: true },
    beach: { sky: ['#70c0f0', '#d0f0ff'], ground: ['#f0dca0', '#d8c080'], plat: '#fff0c0', platE: '#d8c088', hills: '#48a0e0', water2: true },
    rift: { sky: ['#201848', '#6050b0'], ground: ['#4a4088', '#302868'], plat: '#7a70c8', platE: '#4a40a0', hills: '#2a2060', stars: true },
    gym: { sky: ['#40405a', '#70708a'], ground: ['#a8a0b8', '#888098'], plat: '#d0c8e0', platE: '#9890b0', hills: '#505070', arena: true },
    champion: { sky: ['#301848', '#a06010'], ground: ['#a08850', '#806830'], plat: '#f0d080', platE: '#b09040', hills: '#4a2a60', arena: true, gold: true },
    legend: { sky: ['#100820', '#402080'], ground: ['#302050', '#1a1030'], plat: '#6050a0', platE: '#3a2a70', hills: '#20103a', stars: true },
    syndicate: { sky: ['#181020', '#3a2050'], ground: ['#3a3040', '#28202c'], plat: '#5a4868', platE: '#3a2c48', hills: '#20182a', arena: true },
    space: { sky: ['#000008', '#100830'], ground: ['#201838', '#100c20'], plat: '#403068', platE: '#281c48', hills: '#000000', stars: true },
  };
  function build(env, time) {
    const E = ENV[env] || ENV.grass;
    const c = MB.makeCanvas(MB.W, 176), x = c.getContext('2d');
    const r = new MB.RNG(env + time);
    const night = time === 'night' && !['cave', 'dark', 'gym', 'champion', 'syndicate', 'legend', 'space'].includes(env);
    const dusk = time === 'evening' && !['cave', 'dark', 'gym', 'champion', 'syndicate', 'legend', 'space'].includes(env);
    let sk = E.sky;
    if (night) sk = ['#101838', '#304070']; else if (dusk) sk = ['#e07850', '#f8c890'];
    const g = x.createLinearGradient(0, 0, 0, 100); g.addColorStop(0, sk[0]); g.addColorStop(1, sk[1]);
    x.fillStyle = g; x.fillRect(0, 0, MB.W, 110);
    if (E.stars || night) for (let i = 0; i < 70; i++) { x.fillStyle = r.pick(['#ffffff', '#c0d0ff', '#fff0c0']); x.fillRect(r.int(0, MB.W), r.int(0, 90), 1, 1); }
    if (env === 'legend' || env === 'rift') { x.fillStyle = 'rgba(200,160,255,0.25)'; x.beginPath(); x.ellipse(160, 40, 120, 30, -0.2, 0, Math.PI * 2); x.fill(); }
    if (E.clouds || env === 'grass' || env === 'beach') for (let i = 0; i < 5; i++) { x.fillStyle = 'rgba(255,255,255,0.7)'; const cx = r.int(0, MB.W), cy = r.int(10, 60); x.beginPath(); x.ellipse(cx, cy, 22, 7, 0, 0, Math.PI * 2); x.ellipse(cx + 12, cy - 4, 14, 7, 0, 0, Math.PI * 2); x.fill(); }
    // distant hills/skyline
    x.fillStyle = night ? '#1c2440' : E.hills;
    if (E.city) for (let i = 0; i < 16; i++) { const w = r.int(12, 26), h = r.int(20, 60); x.fillRect(i * 22 - 4, 100 - h, w, h); x.fillStyle = night ? '#f0e080' : '#c0d0e0'; for (let k = 0; k < 6; k++) x.fillRect(i * 22 + r.int(0, w - 3), 100 - r.int(4, h - 4), 2, 2); x.fillStyle = night ? '#1c2440' : E.hills; }
    else if (E.pillars) { for (let i = 0; i < 6; i++) { const px = 20 + i * 56; x.fillRect(px, 40, 14, 62); x.fillRect(px - 3, 36, 20, 6); } }
    else if (E.arena) { x.fillStyle = E.hills; x.fillRect(0, 50, MB.W, 50); x.fillStyle = 'rgba(255,255,255,0.08)'; for (let i = 0; i < MB.W; i += 16) x.fillRect(i, 50, 8, 50); if (E.gold) { x.fillStyle = '#f0c040'; x.fillRect(0, 48, MB.W, 3); } }
    else { x.beginPath(); x.moveTo(0, 100); for (let i = 0; i <= MB.W; i += 20) x.lineTo(i, 100 - 18 - Math.sin(i * 0.03 + r.next() * 3) * 14 - r.int(0, 8)); x.lineTo(MB.W, 100); x.fill(); }
    if (E.trees) for (let i = 0; i < 14; i++) { const tx = r.int(0, MB.W), th = r.int(30, 56); x.fillStyle = night ? '#10281a' : '#1e4a22'; x.beginPath(); x.moveTo(tx, 100 - th); x.lineTo(tx - 12, 100); x.lineTo(tx + 12, 100); x.fill(); }
    if (E.rocks) for (let i = 0; i < 8; i++) { x.fillStyle = E.hills; const rx = r.int(0, MB.W); x.beginPath(); x.moveTo(rx, 0); x.lineTo(rx + 10, r.int(20, 50)); x.lineTo(rx + 20, 0); x.fill(); }
    // ground
    const gg = x.createLinearGradient(0, 100, 0, 176); gg.addColorStop(0, E.ground[0]); gg.addColorStop(1, E.ground[1]);
    x.fillStyle = gg; x.fillRect(0, 100, MB.W, 76);
    if (E.water || E.water2) { x.fillStyle = 'rgba(255,255,255,0.25)'; for (let i = 0; i < 30; i++) x.fillRect(r.int(0, MB.W), r.int(102, 172), r.int(6, 16), 1); }
    if (E.lava) { x.fillStyle = '#e05020'; for (let i = 0; i < 6; i++) { x.beginPath(); x.ellipse(r.int(0, MB.W), r.int(108, 170), r.int(10, 30), 3, 0, 0, Math.PI * 2); x.fill(); } }
    if (env === 'grass' || env === 'forest' || env === 'marsh') for (let i = 0; i < 60; i++) { x.fillStyle = 'rgba(30,70,20,0.35)'; x.fillRect(r.int(0, MB.W), r.int(104, 175), 1, 3); }
    if (env === 'snow') for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(160,180,210,0.5)'; x.fillRect(r.int(0, MB.W), r.int(104, 175), r.int(3, 8), 1); }
    if (E.arena) { x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 1; x.beginPath(); x.ellipse(160, 140, 130, 30, 0, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.moveTo(160, 108); x.lineTo(160, 172); x.stroke(); }
    // platforms
    const plat = (cx, cy, rx, ry) => {
      x.fillStyle = E.platE; x.beginPath(); x.ellipse(cx, cy + 2, rx, ry, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = E.plat; x.beginPath(); x.ellipse(cx, cy, rx - 2, ry - 2, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.18)'; x.beginPath(); x.ellipse(cx - rx * 0.2, cy - ry * 0.25, rx * 0.5, ry * 0.35, 0, 0, Math.PI * 2); x.fill();
    };
    plat(236, 66, 58, 14);
    plat(76, 134, 70, 16);
    if (night) { x.fillStyle = 'rgba(20,30,80,0.28)'; x.fillRect(0, 0, MB.W, 176); }
    if (dusk) { x.fillStyle = 'rgba(200,90,40,0.12)'; x.fillRect(0, 0, MB.W, 176); }
    return c;
  }
  function draw(ctx, env, time) {
    const k = env + '|' + time;
    if (!cache[k]) cache[k] = build(env, time);
    ctx.drawImage(cache[k], 0, 0);
    // live layer: water shimmer
    const E = ENV[env] || ENV.grass;
    if (E.water || E.lava) { const t = performance.now() / 600; ctx.fillStyle = E.lava ? 'rgba(255,200,80,0.3)' : 'rgba(255,255,255,0.25)'; for (let i = 0; i < 8; i++) ctx.fillRect((i * 47 + t * 20) % MB.W, 110 + ((i * 13) % 60), 10, 1); }
  }
  return { draw, ENV };
})();

MB.Weather = (function () {
  const parts = [];
  function ensure(type, n) {
    while (parts.length < n) parts.push({ x: Math.random() * MB.W, y: Math.random() * MB.H, s: Math.random() });
  }
  function drawOverlay(ctx, type, dt, w, h) {
    w = w || MB.W; h = h || MB.H; dt = dt || 0.016;
    if (!type || type === 'clear') return;
    ensure(type, type === 'rain' || type === 'storm' ? 90 : type === 'snow' || type === 'blizzard' ? 70 : type === 'sand' ? 80 : type === 'ash' ? 50 : type === 'meteor' ? 6 : 40);
    if (type === 'fog') { ctx.fillStyle = 'rgba(220,225,235,0.32)'; ctx.fillRect(0, 0, w, h); const t = performance.now() / 4000; ctx.fillStyle = 'rgba(255,255,255,0.12)'; for (let i = 0; i < 5; i++) ctx.fillRect(((i * 90 + t * 40) % (w + 100)) - 100, i * 50, 120, 30); return; }
    if (type === 'sun') { ctx.fillStyle = 'rgba(255,220,120,0.10)'; ctx.fillRect(0, 0, w, h); return; }
    if (type === 'storm') { ctx.fillStyle = 'rgba(20,20,50,0.25)'; ctx.fillRect(0, 0, w, h); if (Math.random() < 0.004) MB.Weather.flash = 0.25; }
    if (MB.Weather.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${MB.Weather.flash})`; ctx.fillRect(0, 0, w, h); MB.Weather.flash -= dt; }
    for (const p of parts) {
      if (type === 'rain' || type === 'storm') { p.y += dt * (260 + p.s * 120); p.x -= dt * 50; ctx.fillStyle = 'rgba(180,200,255,0.6)'; ctx.fillRect(p.x, p.y, 1, 5); }
      else if (type === 'snow' || type === 'blizzard') { p.y += dt * (25 + p.s * 30) * (type === 'blizzard' ? 2 : 1); p.x += Math.sin(p.y * 0.05 + p.s * 6) * dt * 15 - (type === 'blizzard' ? dt * 80 : 0); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(p.x, p.y, p.s > 0.6 ? 2 : 1, p.s > 0.6 ? 2 : 1); }
      else if (type === 'sand') { p.x += dt * (180 + p.s * 120); p.y += dt * 20; ctx.fillStyle = 'rgba(220,180,110,0.6)'; ctx.fillRect(p.x, p.y, 2, 1); }
      else if (type === 'ash') { p.y += dt * (15 + p.s * 15); p.x += dt * 6; ctx.fillStyle = 'rgba(80,70,70,0.7)'; ctx.fillRect(p.x, p.y, 1.5, 1.5); }
      else if (type === 'leaves') { p.y += dt * (20 + p.s * 20); p.x += Math.sin(p.y * 0.04) * dt * 30; ctx.fillStyle = p.s > 0.5 ? '#e08030' : '#c05020'; ctx.fillRect(p.x, p.y, 2, 1.5); }
      else if (type === 'petals') { p.y += dt * (15 + p.s * 15); p.x += Math.sin(p.y * 0.04) * dt * 30 + dt * 10; ctx.fillStyle = '#f8b0d0'; ctx.fillRect(p.x, p.y, 2, 1.5); }
      else if (type === 'motes') { p.y -= dt * (8 + p.s * 10); p.x += Math.sin(p.y * 0.05 + p.s * 9) * dt * 8; ctx.fillStyle = `rgba(200,180,255,${0.4 + 0.4 * Math.sin(performance.now() / 300 + p.s * 20)})`; ctx.fillRect(p.x, p.y, 1.5, 1.5); }
      else if (type === 'meteor') { p.x += dt * 220; p.y += dt * 110; ctx.strokeStyle = 'rgba(255,250,210,0.9)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 14, p.y - 7); ctx.stroke(); }
      if (p.y > h + 5) { p.y = -5; p.x = Math.random() * (w + 60); }
      if (p.y < -6) { p.y = h + 4; p.x = Math.random() * w; }
      if (p.x > w + 10) p.x = -10; if (p.x < -60) p.x = w + 10;
    }
  }
  return {
    flash: 0,
    draw: drawOverlay,
    drawBattle(ctx, type) {
      const map = { sun: 'sun', rain: 'rain', sand: 'sand', snow: 'snow' };
      drawOverlay(ctx, map[type], 0.016, MB.W, 176);
    },
  };
})();
