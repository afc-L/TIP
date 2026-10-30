// Browser test of the content update: node tools/update.js [outDir]
// Menus, Greater Realm campaign screens, a campaign battle, end turn, custom battle and survival.
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || '.';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + e.stack));
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForTimeout(2000);
  const shot = async (n) => { await page.screenshot({ path: `${out}/${n}.png` }); };
  const wait = (ms) => page.waitForTimeout(ms);
  await shot('u01-menu');
  const step = process.env.STEP || 'all';
  if (step === 'all' || step === 'campaign') {
    await page.click('.m-new'); await wait(300);
    await page.click('.mode[data-m="grand"]'); await wait(200);
    await page.click(`.fcard[data-f="${process.env.FAC || 'frost'}"]`); await wait(200);
    await page.click('.cmd[data-l]'); await wait(200);
    await shot('u02-new');
    await page.click('.start'); await wait(2500);
    if (await page.$('#modal .btn.primary')) await page.click('#modal .btn.primary');
    await wait(500);
    await shot('u03-campaign');
    for (const [sel, name] of [['.c-dip', 'u04-diplo'], ['.c-tech', 'u05-tech'], ['.act-manage', 'u06-manage'], ['.c-stat', 'u07-stats'], ['.c-enc', 'u08-encyc']]) {
      await page.click(sel); await wait(400); await shot(name);
      await page.evaluate(() => RW.ui.closeModal()); await wait(200);
    }
    // Research something and propose peace to someone.
    await page.evaluate(() => { const s = RW.app.scene, c = s.c; c.research(c.player, 'eco1'); });
    // Attack a neighbouring territory and fight the battle for a while.
    const tgt = await page.evaluate(() => { const s = RW.app.scene, c = s.c, a = c.armiesOf(c.player)[0]; const n = c.adj(a.tid).find((x) => c.canMoveTo(a, x) && c.moveKind(a, x) === 'battle'); s.selectArmy(a); if (n != null) s.orderMarch(n); return n; });
    console.log('attack target', tgt);
    await wait(500); await shot('u09-prompt');
    if (tgt != null) {
      await page.click('#modal .btn.primary'); await wait(3000);
      await page.keyboard.press('Space'); await page.keyboard.press('Digit3');
      await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
      await page.mouse.click(683, 300, { button: 'right' });
      await wait(9000); await shot('u10-battle');
      // Fast-forward the simulation to the end.
      await page.evaluate(() => { const b = RW.app.scene.battle; for (let i = 0; i < 20000 && b.phase !== 'over'; i++) b.step(0.05); });
      await wait(2500); await shot('u11-aftermath');
      if (await page.$('#modal .btn.primary')) await page.click('#modal .btn.primary');
      await wait(1500);
    }
    await page.evaluate(() => { const s = RW.app.scene; if (s.c) { s.fast = true; } });
    await page.click('.c-endturn');
    for (let i = 0; i < 60; i++) {
      await wait(1000);
      const st = await page.evaluate(() => ({ busy: RW.app.scene.busy, modal: RW.ui.modalOpen, battle: !!RW.app.scene.battle }));
      if (st.modal) { await shot('u12-turnmodal'); const b = await page.$('#modal .modal-buttons .btn:not([disabled])') || await page.$('#modal .btn:not([disabled])'); if (b) await b.click(); }
      if (st.battle) await page.evaluate(() => { const b = RW.app.scene.battle; for (let i = 0; i < 20000 && b.phase !== 'over'; i++) b.step(0.05); });
      if (!st.busy && !st.modal && !st.battle) break;
    }
    await wait(800); await shot('u13-turn2');
    console.log('campaign', JSON.stringify(await page.evaluate(() => { const c = RW.app.scene.c; return c && { turn: c.turn, gold: c.factions[c.player].gold, terr: c.owned(c.player).length, research: c.factions[c.player].research, saves: RW.Campaign.listSaves().length }; })));
  }
  if (step === 'all' || step === 'custom') {
    await page.evaluate(() => RW.app.mainMenu()); await wait(800);
    await page.click('.m-custom'); await wait(300);
    await page.click('.q-mine button[data-v="blood"]'); await page.click('.q-foe button[data-v="sylvan"]');
    await page.click('.q-map button[data-v="siege"]'); await page.click('.q-weather button[data-v="snowstorm"]');
    await page.click('.q-leg button[data-l="morvaine"]');
    await page.click('.q-rand'); await page.click('.q-edit button[data-v="foe"]'); await page.click('.q-rand');
    await wait(300); await shot('u14-custom');
    await page.click('.q-go'); await wait(3500);
    await page.keyboard.press('Space'); await wait(6000); await shot('u15-siege');
    console.log('siege', JSON.stringify(await page.evaluate(() => { const b = RW.app.scene.battle; return { gates: b.map.gates.length, units: b.units.length, equip: b.units.filter((u) => u.equip).map((u) => u.typeId) }; })));
    await page.evaluate(() => { const b = RW.app.scene.battle; for (let i = 0; i < 30000 && b.phase !== 'over'; i++) b.step(0.05); });
    await wait(2500); await shot('u16-custom-end');
    if (await page.$('#modal .btn.primary')) await page.click('#modal .btn.primary');
    await wait(800);
  }
  if (step === 'all' || step === 'survival') {
    await page.evaluate(() => RW.app.mainMenu()); await wait(800);
    await page.click('.m-surv'); await wait(300);
    await page.click('.fcard[data-f="sylvan"]'); await page.click('.start'); await wait(300);
    for (let k = 0; k < 6; k++) { const b = await page.$('.rbtn:not([disabled])'); if (b) await b.click(); }
    await shot('u17-survival');
    await page.click('.s-go'); await wait(3500);
    await page.keyboard.press('Space');
    await page.evaluate(() => { const b = RW.app.scene.battle; for (let i = 0; i < 30000 && b.phase !== 'over'; i++) b.step(0.05); });
    await wait(2500); await shot('u18-survival-end');
    if (await page.$('#modal .btn.primary')) await page.click('#modal .btn.primary');
    await wait(1500); await shot('u19-survival-camp');
  }
  console.log('errors:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
})();
