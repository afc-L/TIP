// Mouse interaction test for battles: node tools/mouse.js outDir
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
    RW.app.startQuickBattle({ mapType: 'grassland', seed: 5, attackerSide: 0, difficulty: 'easy', quick: true,
      sides: [{ faction: 'valor', isPlayer: true, units: ['valor_swords', 'valor_swords', 'valor_bows', 'valor_knights'].map((typeId) => ({ typeId })), commander: RW.randomCommander('valor') },
              { faction: 'horde', units: ['horde_grunts', 'horde_grunts', 'horde_chuckers'].map((typeId) => ({ typeId })), commander: RW.randomCommander('horde') }] });
    const s = RW.app.scene; s.rts.tx = 0; s.rts.tz = 60; s.rts.dist = s.rts.targetDist = 110; s.rts.yaw = 0;
  });
  await page.waitForTimeout(1500);
  const proj = (x, z) => page.evaluate(([x, z]) => { const s = RW.app.scene; return s.screenPos(x, s.battle.map.heightAt(x, z), z); }, [x, z]);
  // Box-select everything in the deployment zone
  const a = await proj(-70, 58), b = await proj(70, 104);
  await page.mouse.move(Math.min(a.x, b.x) - 40, Math.min(a.y, b.y) - 20);
  await page.mouse.down();
  await page.mouse.move(Math.max(a.x, b.x) + 40, Math.max(a.y, b.y) + 20, { steps: 5 });
  await page.mouse.up();
  console.log('selected', await page.evaluate(() => RW.app.scene.selected.size));
  // Right-drag a line facing north, at z=70 from x=-50 to x=50
  const l0 = await proj(-50, 70), l1 = await proj(50, 70);
  await page.mouse.move(l0.x, l0.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(l1.x, l1.y, { steps: 6 });
  await page.screenshot({ path: out + '/mouse-ghost.png' });
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(300);
  console.log('positions', await page.evaluate(() => RW.app.scene.battle.units.filter((u) => u.side === 0).map((u) => `${u.name.slice(0, 6)}@${u.x.toFixed(0)},${u.z.toFixed(0)} f=${u.facing.toFixed(2)}`).join(' | ')));
  await page.click('.b-start');
  await page.waitForTimeout(300);
  // Click first card, then right-click an enemy soldier
  await page.click('.ucard:nth-child(2)');
  await page.evaluate(() => { const s = RW.app.scene, u = s.battle.units.find((x) => x.side === 1 && !x.isGeneral); s.rts.tx = u.x; s.rts.tz = u.z + 30; s.rts.dist = s.rts.targetDist = 60; s.rts.anim = null; });
  await page.waitForTimeout(800);
  const e = await page.evaluate(() => { const s = RW.app.scene, b = s.battle; const u = b.units.find((x) => x.side === 1 && !x.isGeneral); const i = u.sa.findIndex((v) => v); return s.screenPos(u.sx[i], u.sy[i] + 0.3, u.sz[i]); });
  await page.mouse.click(e.x, e.y, { button: 'right' });
  await page.waitForTimeout(300);
  console.log('order', await page.evaluate(() => { const u = [...RW.app.scene.selected][0]; return u.name + ' -> ' + u.order.type + (u.order.target ? ':' + u.order.target.name : ''); }));
  // Formation hotkey + hold
  await page.keyboard.press('KeyY');
  await page.keyboard.press('KeyG');
  console.log('formation', await page.evaluate(() => { const u = [...RW.app.scene.selected][0]; return u.formation + ' hold=' + u.hold; }));
  await page.keyboard.press('Space');
  console.log('paused', await page.evaluate(() => RW.app.scene.paused));
  await page.keyboard.press('Space');
  await page.keyboard.press('Digit2');
  console.log('speed', await page.evaluate(() => RW.app.scene.speed));
  // Minimap click recentres camera
  const mm = await page.evaluate(() => { const r = document.querySelector('.b-mini canvas').getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.2 }; });
  await page.mouse.click(mm.x, mm.y);
  await page.waitForTimeout(800);
  console.log('camera', await page.evaluate(() => { const r = RW.app.scene.rts; return r.tx.toFixed(0) + ',' + r.tz.toFixed(0); }));
  // Escape menu
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  console.log('menu open', await page.evaluate(() => RW.ui.modalOpen));
  await page.screenshot({ path: out + '/mouse-menu.png' });
  console.log('ERRORS:\n' + errors.join('\n'));
  await browser.close();
})();
