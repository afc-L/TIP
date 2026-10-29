// Browser smoke test: node tools/smoke.js [outDir]. Opens the game from file://, drives menus, a quick battle and a campaign turn.
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || '.';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + e.stack));
  const url = 'file://' + path.resolve(__dirname, '..', 'index.html');
  await page.goto(url);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: out + '/01-menu.png' });
  const step = process.env.STEP || 'all';
  if (step === 'all' || step === 'quick') {
    await page.click('.m-quick');
    await page.waitForTimeout(300);
    await page.screenshot({ path: out + '/02-quick.png' });
    await page.click('.q-go');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: out + '/03-deploy.png' });
    await page.keyboard.press('Space');
    await page.keyboard.press('Digit3');
    await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
    await page.mouse.click(683, 300, { button: 'right' });
    await page.waitForTimeout(8000);
    await page.screenshot({ path: out + '/04-battle.png' });
    await page.waitForTimeout(8000);
    await page.screenshot({ path: out + '/05-battle.png' });
    const st = await page.evaluate(() => { const b = RW.app.scene.battle; return b ? { t: b.time, phase: b.phase, units: b.units.map((u) => u.state + ':' + u.alive).join(' ') } : null; });
    console.log('battle', JSON.stringify(st));
  }
  if (step === 'all' || step === 'campaign') {
    await page.evaluate(() => RW.app.mainMenu());
    await page.waitForTimeout(500);
    await page.click('.m-new');
    await page.waitForTimeout(300);
    await page.screenshot({ path: out + '/06-new.png' });
    await page.click('.start');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: out + '/07-campaign.png' });
    await page.click('.modal-buttons .btn.primary'); // close the welcome briefing
    await page.click('.c-endturn');
    await page.waitForTimeout(6000);
    await page.screenshot({ path: out + '/08-turn2.png' });
    const st = await page.evaluate(() => { const c = RW.app.campaignScene && RW.app.campaignScene.c; return c ? { turn: c.turn, gold: c.factions[c.player].gold, armies: c.armies.length } : null; });
    console.log('campaign', JSON.stringify(st));
  }
  console.log('ERRORS:\n' + errors.join('\n'));
  await browser.close();
})();
