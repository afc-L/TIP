// Screenshot each battlefield type mid-battle: node tools/maps.js outDir
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || '.';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  if (process.env.QUALITY) await page.addInitScript((q) => localStorage.setItem('realmsOfWar.settings.v1', JSON.stringify({ quality: q })), process.env.QUALITY);
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + e.stack));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForTimeout(1200);
  const maps = (process.env.MAPS || 'grassland,forest,hills,river,pass,siege').split(',');
  for (const m of maps) {
    await page.evaluate(([m, fx]) => {
      const D = RW.data; const process_weather = fx[2];
      const fa = fx[0] || ['valor', 'horde', 'arcane'][Math.floor(Math.random() * 3)], fb = fx[1] || ['valor', 'horde', 'arcane'][Math.floor(Math.random() * 3)];
      RW.app.startQuickBattle({ mapType: m, seed: 42, attackerSide: 0, difficulty: 'normal', quick: true, aiBoth: true, weather: process_weather || D.weatherFor(m),
        sides: [{ faction: fa, isPlayer: true, units: D.genArmy(fa, 8000).map((typeId) => ({ typeId })), commander: RW.randomCommander(fa) },
                { faction: fb, units: D.genArmy(fb, 8000).map((typeId) => ({ typeId })), commander: RW.randomCommander(fb) }] });
    }, [m, (process.env.FACTIONS || '').split(',').concat([process.env.WEATHER])]);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${out}/map-${m}-deploy.png` });
    await page.evaluate(() => { const s = RW.app.scene; s.startBattle(); s.setSpeed(3); s.rts.targetDist = 160; });
    await page.waitForTimeout(+(process.env.WAIT || 9000));
    await page.screenshot({ path: `${out}/map-${m}-fight.png` });
    const st = await page.evaluate(() => { const b = RW.app.scene.battle; return { t: Math.round(b.time), phase: b.phase, gate: b.map.gate && Math.round(b.map.gate.hp) }; });
    console.log(m, JSON.stringify(st));
  }
  console.log('ERRORS:\n' + errors.join('\n'));
  await browser.close();
})();
