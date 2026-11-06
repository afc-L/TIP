const {chromium}=require('playwright');const path=require('path');
(async()=>{const b=await chromium.launch();const p=await b.newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto('file://'+path.resolve(__dirname,'../index.html'));await p.waitForTimeout(600);
const r=await p.evaluate(async()=>{
  MB.debugStart({party:[['emberfox',18],['twigeet',18],['nibblet',15]]}); const S=MB.state; S.party[2].hp=0;
  const BP=MB.BattleScene.prototype; BP.say=function(){return Promise.resolve()}; BP.tween=function(d,f){f(1);return Promise.resolve()}; BP.wait=()=>Promise.resolve(); BP.showLevelStats=async()=>{}; MB.ask=async()=>4; MB.yesno=async()=>false; MB.Screens.dexEntry=async()=>{}; BP.openParty=async function(){ const M=this.menu; this.menu=null; const i=S.party.findIndex((m,k)=>m.hp>0&&k!==this.p.idx); if(M){M.res({type:'switch',to:i});return;} return i; };
  let turn=0; BP.choosePlayerAction=async function(){ turn++; if(turn===2) return {type:'switch',to:1}; return {type:'move',id:this.mon(this.p).moves.find(m=>MB.MOVES[m.id].power>0).id}; };
  const before=S.party.map(m=>m.exp);
  const sc=new MB.BattleScene({kind:'trainer',enemy:[MB.Mon.create('nibblet',12),MB.Mon.create('acorny',12)],trainer:{name:'T',app:MB.Chars.randomApp('t'),ai:1,items:[]},canLose:true}); sc.close=()=>{}; sc.enter=()=>{}; await sc.run();
  return {out:sc.result.outcome, dmg:sc.dmgDone, gained:S.party.map((m,i)=>[m.name,m.exp-before[i],m.hp])};
});
console.log(JSON.stringify(r), e); await b.close();})();
