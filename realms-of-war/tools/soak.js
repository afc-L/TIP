// Long campaign soak test in the browser: node tools/soak.js outDir [turns]
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || '.';
const turns = +(process.argv[3] || 15);
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + e.stack));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForTimeout(800);
  await page.evaluate(() => { RW.app.startCampaign(RW.Campaign.create('valor', 'hard')); });
  // Auto-answer dialogs: prefer auto-resolve, otherwise the first enabled button.
  await page.evaluate(() => {
    setInterval(() => {
      const btns = [...document.querySelectorAll('.modal-buttons .btn')].filter((b) => !b.disabled);
      if (!btns.length) return;
      const auto = btns.find((b) => /Auto-resolve/.test(b.textContent));
      const cont = btns.find((b) => /Continue|Collect|Excellent|Accept|Study|Hire|Pay|Crush|Endure|Send/.test(b.textContent));
      (auto || cont || btns[0]).click();
    }, 150);
  });
  for (let t = 0; t < turns; t++) {
    const st = await page.evaluate(async () => {
      const cs = RW.app.campaignScene; if (!cs) return { gone: true };
      const c = cs.c;
      if (c.over) return { over: c.over };
      // Let the AI play the player's faction (auto-resolve all battles).
      const hooks = { attack: async (a, tid) => { const s = c.battleSetup(a, tid); c.applyBattle(a, s, c.autoResolve(s)); }, moved: async () => {} };
      c.factions[c.player].isPlayer = false;
      await RW.campaignAI.runFaction(c, c.player, hooks);
      c.factions[c.player].isPlayer = true;
      cs.fast = true;
      await cs.endTurn();
      return { turn: c.turn, gold: c.factions[c.player].gold, owned: ['valor', 'horde', 'arcane'].map((f) => c.owned(f).length).join('/'), armies: c.armies.length };
    });
    console.log(JSON.stringify(st));
    if (st.over || st.gone) break;
  }
  await page.screenshot({ path: out + '/soak-end.png' });
  console.log('ERRORS:\n' + errors.join('\n'));
  await browser.close();
})();
