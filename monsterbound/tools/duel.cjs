// win-rate simulator: node tools/duel.cjs mySp myLvl foeSp foeLvl [n]
const {chromium}=require('playwright');const path=require('path');
(async()=>{
  const [a,al,f,fl,n]=process.argv.slice(2);
  const b=await chromium.launch(); const p=await b.newPage();
  await p.goto('file://'+path.resolve(__dirname,'../index.html')); await p.waitForTimeout(600);
  const r=await p.evaluate(async([a,al,f,fl,n])=>{
    MB.debugStart({}); const S=MB.state; MB.ask=async()=>0; MB.yesno=async()=>false; MB.Screens.dexEntry=async()=>{};
    const BP=MB.BattleScene.prototype; BP.say=function(t){this.msg=t; if(this.log) this.log.push(t); return Promise.resolve();}; BP.tween=function(d,fn){fn(1);return Promise.resolve();}; BP.wait=()=>Promise.resolve(); BP.showLevelStats=async()=>{};
    BP.choosePlayerAction=async function(){ const me=this.mon(this.p); let best=null,bv=-1; for(const mv of me.moves){const M=MB.MOVES[mv.id]; if(mv.pp<=0||!M.power) continue; const v=this.estimateDamage(this.p,this.e,M)*(M.acc||100); if(v>bv){bv=v;best=M.id;}} return {type:'move',id:best||me.moves[0].id}; };
    let wins=0, log=null;
    for(let i=0;i<+n;i++){ const me=MB.Mon.create(a,+al,{ivs:{hp:20,atk:20,def:20,spa:20,spd:20,spe:20}}); S.party=[me]; const foe=MB.Mon.create(f,+fl);
      const sc=new MB.BattleScene({kind:'trainer',enemy:[foe],trainer:{name:'T',app:MB.Chars.randomApp('x'),ai:1,items:[]},canLose:true}); if(i===0){sc.log=[]; log=sc.log;} sc.close=()=>{}; sc.enter=()=>{}; await sc.run(); if(sc.result.outcome==='win') wins++; }
    const me=MB.Mon.create(a,+al), foe=MB.Mon.create(f,+fl);
    return {wins, n:+n, me:[MB.Mon.stats(me), me.moves.map(m=>m.id)], foe:[MB.Mon.stats(foe), foe.moves.map(m=>m.id)], log:log.slice(0,40)};
  },[a,al,f,fl,n||100]);
  console.log(JSON.stringify(r,null,0));
  await b.close();
})();
