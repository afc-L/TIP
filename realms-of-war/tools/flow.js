// Campaign -> battle -> campaign flow test: node tools/flow.js outDir
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || '.';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + e.stack));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForTimeout(1000);
  console.log('step', "'.m-new'");
  await page.click('.m-new');
  console.log('step', '\'.fcard[data-f="arcane"]\'');
  await page.click('.fcard[data-f="arcane"]');
  console.log('step', "'.start'");
  await page.click('.start');
  await page.waitForTimeout(1200);
  // Attack a neighbouring rebel territory with the starting army.
  const target = await page.evaluate(() => { const cs = RW.app.campaignScene, c = cs.c; const a = c.armiesOf(c.player)[0]; cs.selectArmy(a); return c.adj(a.tid)[0]; });
  console.log('step', '(t) => RW.app.campaignScene.orderMarch(t), target');
  await page.evaluate((t) => RW.app.campaignScene.orderMarch(t), target);
  await page.waitForTimeout(400);
  await page.screenshot({ path: out + '/f1-prompt.png' });
  console.log('step', "'.modal-buttons .btn.primary'");
  await page.click('.modal-buttons .btn.primary'); // Fight
  await page.waitForTimeout(2500);
  console.log('step', "'.b-start'");
  await page.click('.b-start');
  await page.waitForTimeout(500);
  // Use the first ability on the enemy army centre.
  console.log('step', "'KeyZ'");
  await page.keyboard.press('KeyZ');
  const pt = await page.evaluate(() => { const s = RW.app.scene, b = s.battle; const e = b.units.find((u) => u.side === 1); const p = s.screenPos(e.x, b.map.heightAt(e.x, e.z), e.z); return p; });
  if (pt) await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: out + '/f2-ability.png' });
  const ab = await page.evaluate(() => RW.app.scene.battle.sides[0].abilities.map((a) => a.id + ':' + Math.round(a.cd)).join(','));
  console.log('abilities after cast', ab);
  // Let the AI fight it out for a while at 3x then retreat
  console.log('step', '() => { const s = RW.app.scene; s.setSpeed(3); for (const u ');
  await page.evaluate(() => { const s = RW.app.scene; s.setSpeed(3); for (const u of s.battle.units) if (u.side === 0) s.selected.add(u); const e = s.battle.units.find((u) => u.side === 1); s.attackOrder(e); });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: out + '/f3-melee.png' });
  console.log('step', "'.b-retreat'");
  await page.click('.b-retreat');
  await page.waitForTimeout(300);
  console.log('step', "'.modal-buttons .btn.danger'");
  await page.click('.modal-buttons .btn.danger');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: out + '/f4-results.png' });
  console.log('step', "'.modal-buttons .btn.primary'");
  await page.click('.modal-buttons .btn.primary');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: out + '/f5-back.png' });
  const st = await page.evaluate(() => { const cs = RW.app.campaignScene, c = cs.c; return { scene: RW.app.scene === cs, hud: !!document.querySelector('.camp-hud'), armies: c.armiesOf(c.player).map((a) => a.units.map((u) => u.hp.toFixed(2)).join('/')), log: c.log.slice(-2).map((l) => l.text) }; });
  console.log('after battle', JSON.stringify(st));
  // Force an AI attack on the player and auto-resolve it.
  await page.evaluate(() => {
    const cs = RW.app.campaignScene, c = cs.c;
    const cap = c.factions[c.player].capital;
    const nb = c.adj(cap).find((n) => !c.armyAt(n));
    const ai = c.addArmy('horde', nb, RW.randomCommander('horde'), RW.data.genArmy('horde', 900, 1, 3));
    window._p = cs.aiAttack(ai, cap);
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: out + '/f6-defend.png' });
  console.log('step', "'.modal-buttons .btn:not(.primary)'");
  await page.click('.modal-buttons .btn:not(.primary)'); // auto-resolve
  await page.waitForTimeout(500);
  console.log('step', "'.modal-buttons .btn.primary'");
  await page.click('.modal-buttons .btn.primary');
  await page.waitForTimeout(300);
  // End turn + save/load
  console.log('step', '() => RW.app.campaignScene.endTurn()');
  await page.evaluate(() => RW.app.campaignScene.endTurn());
  await page.waitForTimeout(5000);
  const saved = await page.evaluate(() => { const c = RW.Campaign.load(); return c && { turn: c.turn, owned: c.owned(c.player).length }; });
  console.log('saved', JSON.stringify(saved));
  console.log('step', '() => RW.app.mainMenu()');
  await page.evaluate(() => RW.app.mainMenu());
  await page.waitForTimeout(500);
  console.log('ERRSOFAR', errors.join('\n'));
  await page.screenshot({ path: out + '/f6b-menu.png' });
  console.log('step', "'.m-continue'");
  await page.click('.m-continue');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: out + '/f7-continue.png' });
  await page.setViewportSize({ width: 1024, height: 640 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: out + '/f8-small.png' });
  console.log('ERRORS:\n' + errors.join('\n'));
  await browser.close();
})();
