// Headless playtest driver. Usage: node tools/play.cjs script.json outPrefix
const {chromium}=require('playwright');
const path=require('path');
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:960,height:720}});
  const errs=[];
  p.on('console',m=>{ if(m.type()==='error'||m.type()==='warning') errs.push(m.type()+': '+m.text()); });
  p.on('pageerror',e=>errs.push('PAGEERROR '+e.message+'\n'+e.stack));
  await p.goto('file://'+path.resolve(__dirname,'../index.html'));
  await p.waitForTimeout(800);
  const steps=JSON.parse(require('fs').readFileSync(process.argv[2],'utf8'));
  const out=process.argv[3]||'/tmp/shot';
  let n=0;
  for(const s of steps){
    if(s.key){ for(let i=0;i<(s.times||1);i++){ await p.keyboard.down(s.key); await p.waitForTimeout(s.hold||60); await p.keyboard.up(s.key); await p.waitForTimeout(s.gap||120);} }
    if(s.type){ await p.keyboard.type(s.type,{delay:50}); }
    if(s.until){ for(let i=0;i<(s.max||60);i++){ const ok=await p.evaluate(s.until); if(ok) break; await p.keyboard.down(s.press||'Enter'); await p.waitForTimeout(50); await p.keyboard.up(s.press||'Enter'); await p.waitForTimeout(s.gap||110);} }
    if(s.wait) await p.waitForTimeout(s.wait);
    if(s.eval){ const r=await p.evaluate(s.eval); if(r!==undefined) console.log('eval:',JSON.stringify(r).slice(0,2000)); }
    if(s.shot){ await p.screenshot({path:`${out}_${s.shot}.png`}); }
  }
  const u=[...new Set(errs)]; console.log('ERRORS:',u.length?u.slice(0,12).join('\n'):'none');
  await b.close();
})();
