// save/load across a real page reload + fps measurement
const {chromium}=require('playwright');const path=require('path');
(async()=>{
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1280,height:800}}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  const url='file://'+path.resolve(__dirname,'../index.html');
  await p.goto(url); await p.waitForTimeout(700);
  await p.evaluate(()=>{ MB.debugStart({map:'route2', party:[['brisquill',15],['sproutle',15]]}); MB.state.flags.test=1; MB.state.money=12345; MB.Save.save(2); });
  // fps on a big map
  const fps=await p.evaluate(()=>new Promise(res=>{let n=0;const t0=performance.now();function f(){n++; if(performance.now()-t0<2000) requestAnimationFrame(f); else res(n/2);} requestAnimationFrame(f);}));
  const cost=await p.evaluate(()=>{ const t0=performance.now(); for(let i=0;i<60;i++) MB.Game.draw(MB.ctx); return (performance.now()-t0)/60; });
  console.log('fps',fps,'draw ms',cost.toFixed(2));
  await p.reload(); await p.waitForTimeout(800);
  // title -> Continue -> slot 3
  await p.keyboard.press('ArrowDown'); await p.waitForTimeout(150); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  await p.keyboard.press('ArrowDown'); await p.waitForTimeout(100); await p.keyboard.press('ArrowDown'); await p.waitForTimeout(100); await p.keyboard.press('Enter'); await p.waitForTimeout(800);
  const r=await p.evaluate(()=>[MB.state&&MB.state.map, MB.state&&MB.state.money, MB.state&&MB.state.party.map(m=>m.name), MB.Game.scenes.map(s=>s.constructor.name)]);
  console.log('after reload',JSON.stringify(r));
  // trainer sight: put a trainer directly in front
  const t=await p.evaluate(async()=>{ const m=MB.World.get(MB.state.map); const n=m.npcs.find(n=>n.trainer); MB.state.flags['tr:'+n.id]=false; MB.state.px=n.x+MB.dirs[n.dir][0]*3; MB.state.py=n.y+MB.dirs[n.dir][1]*3; MB.Over.checkSight(); return [n.id,n.dir,n.x,n.y,MB.state.px,MB.state.py];});
  await p.waitForTimeout(2500);
  const r2=await p.evaluate(()=>MB.Game.scenes.map(s=>s.constructor.name));
  console.log('sight',JSON.stringify(t),JSON.stringify(r2));
  await p.screenshot({path:process.argv[2]+'_sight.png'});
  // evolution: give exp to sproutle so it reaches 16
  await p.evaluate(()=>{ MB.Game.scenes.filter(s=>s instanceof MB.BattleScene).forEach(s=>s.close({outcome:'win'})); const m=MB.state.party[1]; MB.Mon.gainExp(m, MB.Mon.expFor('medium',16)-m.exp+1); MB.Over.busy=false; MB.Over.runScript(()=>MB.Battles.postBattle({})); });
  await p.waitForTimeout(3500); await p.screenshot({path:process.argv[2]+'_evo.png'});
  for(let i=0;i<12;i++){ await p.keyboard.press('Enter'); await p.waitForTimeout(400); }
  const r3=await p.evaluate(()=>[MB.state.party.map(m=>m.sp+':'+m.lvl), MB.Game.scenes.map(s=>s.constructor.name), MB.state.ach]);
  console.log('evo',JSON.stringify(r3));
  console.log('ERRORS',errs.length?[...new Set(errs)].join('\n'):'none');
  await b.close();
})();
