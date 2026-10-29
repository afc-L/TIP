// Fast-forward a full AI-vs-AI siege in the browser and check the results screen: node tools/siegeend.js outDir
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || '.';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + e.stack));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const D = RW.data;
    RW.app.startQuickBattle({ mapType: 'siege', seed: 11, attackerSide: 0, difficulty: 'hard', quick: true, aiBoth: true,
      sides: [{ faction: 'horde', isPlayer: true, units: D.genArmy('horde', 9000).map((typeId) => ({ typeId })), commander: RW.randomCommander('horde') },
              { faction: 'valor', units: D.genArmy('valor', 5000).map((typeId) => ({ typeId })), commander: RW.randomCommander('valor') }] });
    RW.app.scene.startBattle();
  });
  for (let k = 0; k < 12; k++) {
    const st = await page.evaluate(() => { const b = RW.app.scene.battle; if (!b) return null; for (let i = 0; i < 400 && b.phase === 'battle'; i++) b.step(0.05); return { t: Math.round(b.time), phase: b.phase, gate: Math.round(b.map.gate.hp), p0: Math.round(b.sidePower(0)), p1: Math.round(b.sidePower(1)) }; });
    console.log(JSON.stringify(st));
    await page.waitForTimeout(400);
    if (k === 3) { await page.evaluate(() => { const s = RW.app.scene; s.rts.focus(0, -30, 90); }); await page.waitForTimeout(800); await page.screenshot({ path: out + '/siege-mid.png' }); }
    if (!st || st.phase !== 'battle') break;
  }
  await page.waitForTimeout(2500);
  await page.screenshot({ path: out + '/siege-end.png' });
  console.log('ERRORS:\n' + errors.join('\n'));
  await browser.close();
})();
