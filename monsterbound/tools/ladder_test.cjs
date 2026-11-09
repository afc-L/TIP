const {chromium}=require('playwright');const path=require('path');
(async()=>{const b=await chromium.launch();const p=await b.newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto('file://'+path.resolve(__dirname,'../index.html'));await p.waitForTimeout(600);
const where=()=>p.evaluate(()=>[MB.state.map,MB.state.px,MB.state.py]);
const step=async(k)=>{await p.keyboard.down(k);await p.waitForTimeout(90);await p.keyboard.up(k);await p.waitForTimeout(900);};
// enter cave from route, then walk onto its ladder
for (const [map,target] of [['ironpeak_1','ironpeak_2'],['ironpeak_2','ironpeak_1'],['hollow_depths','ancient_hollow']]) {
  await p.evaluate(([map,target])=>{ MB.debugStart({map, flags:{hollow_done:true}}); MB.state.repel=9999; const m=MB.World.get(map); const L=m.portals.find(q=>q.to===target); const sp=[[0,1,'up'],[0,-1,'down'],[1,0,'left'],[-1,0,'right']].find(([dx,dy])=>MB.Over.isFree(L.x+dx,L.y+dy)); MB.state.px=L.x+sp[0]; MB.state.py=L.y+sp[1]; MB.state.dir=sp[2]; MB.Over.justPortaled=true; window.KEY={up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'}[sp[2]]; },[map,target]);
  const key=await p.evaluate(()=>KEY);
  await step(key); console.log(map,'-> after first step onto ladder:',JSON.stringify(await where()));
}
console.log('ERRORS',e.length?e.join('\n'):'none'); await b.close();})();
