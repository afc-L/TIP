// Close-up model screenshots + ability cast check: node tools/closeup.js outDir
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || '.';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + e.stack));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForTimeout(800);
  for (const [fa, fb] of [['valor', 'horde'], ['arcane', 'horde']]) {
    await page.evaluate(([fa, fb]) => {
      const D = RW.data;
      const all = (f) => Object.values(D.UNITS).filter((u) => u.faction === f && u.recruitable).map((u) => ({ typeId: u.id }));
      RW.app.startQuickBattle({ mapType: 'grassland', seed: 7, attackerSide: 0, difficulty: 'normal', quick: true,
        sides: [{ faction: fa, isPlayer: true, units: all(fa), commander: RW.randomCommander(fa) }, { faction: fb, units: all(fb), commander: RW.randomCommander(fb) }] });
      const s = RW.app.scene; s.rts.focus(0, 75, 30); s.rts.yaw = 0.5;
    }, [fa, fb]);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${out}/close-${fa}.png` });
  }
  // Ability cast by keyboard + ground click
  await page.evaluate(() => { const s = RW.app.scene; s.startBattle(); s.rts.focus(0, 40, 120); });
  await page.waitForTimeout(1500);
  await page.keyboard.press('KeyX');
  const pt = await page.evaluate(() => { const s = RW.app.scene; return s.screenPos(0, s.battle.map.heightAt(0, -20), -20); });
  console.log('targeting', await page.evaluate(() => RW.app.scene.targeting), JSON.stringify(pt));
  await page.mouse.move(pt.x, pt.y);
  await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(400);
  console.log('cooldowns', await page.evaluate(() => RW.app.scene.battle.sides[0].abilities.map((a) => a.id + ':' + Math.round(a.cd)).join(',')));
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/close-meteor.png` });
  console.log('ERRORS:\n' + errors.join('\n'));
  await browser.close();
})();
