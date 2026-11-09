const {chromium}=require('playwright');const path=require('path');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:960,height:720}});const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto('file://'+path.resolve(__dirname,'../index.html'));await p.waitForTimeout(600);
const k=async(x,n=1)=>{for(let i=0;i<n;i++){await p.keyboard.press(x);await p.waitForTimeout(150);}};
const setup=async(map)=>p.evaluate((map)=>{ MB.debugStart({map}); const S=MB.state; S.keyItems.town_map=true; for(const id of ['willowbrook','verdant','crystalwater','route1','route2']) S.visited[id]=true; },map);
const openMap=async()=>{ await k('m'); await p.waitForTimeout(300); };
// 1) in Verdant City (a town): pick Willowbrook and teleport
await setup('verdant'); await openMap();
const pick=async(target)=>{ for(let i=0;i<12;i++){ const cur=await p.evaluate(()=>{const s=MB.Game.top(); return s.towns? s.towns[s.idx].id : null;}); if(cur===target) break; await k('ArrowRight'); } };
await pick('willowbrook'); await p.screenshot({path:process.argv[2]+'_map.png'}); await k('Enter'); await p.waitForTimeout(1600);
console.log('from town ->', await p.evaluate(()=>[MB.state.map,MB.state.px,MB.state.py,MB.Game.top().constructor.name]));
// 2) inside a town building still counts
await setup('verdant'); await p.evaluate(()=>{ const b=MB.World.get('verdant').buildings.find(b=>b.kind==='center'); MB.Over.warpTo(b.id); });
await p.waitForTimeout(300); await openMap(); await pick('crystalwater'); await k('Enter'); await p.waitForTimeout(1600);
console.log('from inside center ->', await p.evaluate(()=>MB.state.map));
// 3) on a route without Wing Whistle: not allowed
await setup('route2'); await openMap(); await pick('willowbrook'); await k('Enter'); await p.waitForTimeout(800); await k('Escape');
console.log('from route (no whistle) ->', await p.evaluate(()=>MB.state.map));
// 4) route with Wing Whistle: allowed
await setup('route2'); await p.evaluate(()=>MB.state.keyItems.wing_whistle=true); await openMap(); await pick('willowbrook'); await k('Enter'); await p.waitForTimeout(1600);
console.log('from route (whistle) ->', await p.evaluate(()=>MB.state.map));
console.log('ERRORS',e.length?e.join('\n'):'none'); await b.close();})();
