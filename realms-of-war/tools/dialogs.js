// Screenshot the menus' dialogs: node tools/dialogs.js outDir
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
  const shot = async (name, fn) => { await page.evaluate(fn); await page.waitForTimeout(500); await page.screenshot({ path: `${out}/dlg-${name}.png` }); };
  await shot('help', () => RW.menus.help());
  await shot('settings', () => RW.menus.settings());
  await page.evaluate(() => { RW.ui.closeModal(); RW.app.startCampaign(RW.Campaign.create('horde', 'normal')); });
  await page.waitForTimeout(1000);
  await shot('objectives', () => RW.app.campaignScene.showObjectives());
  await shot('armoury', () => RW.app.campaignScene.showArmoury());
  await shot('factions', () => RW.app.campaignScene.showFactions());
  await shot('raise', () => { const cs = RW.app.campaignScene; cs.c.factions.horde.gold = 5000; RW.ui.closeModal(); cs.selectTerritory(cs.c.armiesOf('horde')[0].tid); const c = cs.c; const t = c.owned('horde')[0]; c.armies[0].tid = c.adj(t.id)[0]; cs.raiseArmyDialog(t.id); });
  await shot('event', () => { const cs = RW.app.campaignScene; RW.ui.closeModal(); let e; for (let i = 0; i < 50 && !e; i++) { cs.c.turn = 5; e = cs.c.rollEvent(); } cs.showEvent(e); });
  console.log('ERRORS:\n' + errors.join('\n'));
  await browser.close();
})();
