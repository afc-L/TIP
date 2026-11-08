const {chromium}=require('playwright');const path=require('path');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:960,height:720}});const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto('file://'+path.resolve(__dirname,'../index.html'));await p.waitForTimeout(600);
await p.evaluate(()=>{ MB.debugStart({party:[['emberfox',10],['twigeet',5],['nibblet',5],['buzzlet',5],['acorny',5],['sproutle',5]]}); MB.state.boxes[0].push(MB.Mon.create('sparkit',7)); MB.Over.runScript(()=>MB.Game.push(new MB.PCScene())); });
const k=async(x,n=1)=>{for(let i=0;i<n;i++){await p.keyboard.press(x);await p.waitForTimeout(110);}};
const st=()=>p.evaluate(()=>{const t=MB.Game.scenes.find(s=>s instanceof MB.PCScene); return [MB.Game.top().constructor.name,t.side,t.cx,t.cy,t.pi,t.held&&t.held.name,MB.state.party.map(m=>m.name).join(','),MB.state.boxes[0].map(m=>m.name).join(',')];});
await p.waitForTimeout(300);
// pick up Sparkit (Move), go right to party, swap with Nibblet (index 2), go back and drop
await k('Enter'); await p.waitForTimeout(250); await k('Enter'); console.log('held:',JSON.stringify(await st()));
await k('ArrowRight',6); console.log('at party:',JSON.stringify(await st()));
await k('ArrowDown',2); await k('Enter'); console.log('swapped:',JSON.stringify(await st()));
await k('ArrowLeft'); await k('Enter'); console.log('dropped:',JSON.stringify(await st()));
await p.screenshot({path:process.argv[2]});
console.log('ERRORS',e.length?e.join('\n'):'none'); await b.close();})();
