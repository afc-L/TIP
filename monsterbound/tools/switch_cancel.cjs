const {chromium}=require('playwright');const path=require('path');
(async()=>{const b=await chromium.launch();const p=await b.newPage();const e=[];p.on('pageerror',x=>e.push(x.message));p.on('console',m=>{if(m.type()==='error')e.push(m.text())});
await p.goto('file://'+path.resolve(__dirname,'../index.html'));await p.waitForTimeout(600);
await p.evaluate(()=>{ MB.debugStart({party:[['infernyx',60],['twigeet',10]]}); window.R=null; MB.Over.runScript(async()=>{ window.R=await MB.Battles.custom({name:'Tester',team:[['nibblet',3],['nibblet',3]],pay:10}); }); });
const st=()=>p.evaluate(()=>{const t=MB.Game.top(); return [t.constructor.name, t.menu&&t.menu.mode, t.opts&&t.opts.prompt, MB.Game.scenes.some(s=>s instanceof MB.BattleScene)];});
// advance to first menu, attack
for(let i=0;i<80;i++){ const s=await st(); if(s[1]==='main') break; await p.keyboard.press('x'); await p.waitForTimeout(80); }
await p.evaluate(()=>{const B=MB.Game.top(); const mv=B.mon(B.p).moves.find(m=>MB.MOVES[m.id].power>0); B.finishMenu({type:'move',id:mv.id});});
// wait for the "switch?" prompt
let got=false; for(let i=0;i<150;i++){ const s=await st(); if(s[0]==='ChoiceScene'){got=true;break;} await p.keyboard.press('x'); await p.waitForTimeout(80); }
console.log('switch prompt shown:',got, JSON.stringify(await st()));
await p.keyboard.press('Enter'); await p.waitForTimeout(300); // Yes
console.log('after yes:',JSON.stringify(await st()));
await p.keyboard.press('Escape'); await p.waitForTimeout(600);
console.log('after escape:',JSON.stringify(await st()), 'result:', await p.evaluate(()=>JSON.stringify(window.R)));
for(let i=0;i<40;i++){ const s=await st(); if(s[1]==='main') break; await p.keyboard.press('x'); await p.waitForTimeout(80); }
console.log('battle continues with menu:',JSON.stringify(await st()), 'enemy:', await p.evaluate(()=>{const B=MB.Game.scenes.find(s=>s instanceof MB.BattleScene); return B? B.e.idx+':'+B.mon(B.e).hp : 'none'}));
console.log('ERRORS', e.length? e.join('\n'):'none'); await b.close();})();
