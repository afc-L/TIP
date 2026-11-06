const {chromium}=require('playwright');const path=require('path');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await p.goto('file://'+path.resolve(__dirname,'../index.html')); await p.waitForTimeout(700);
  const res=await p.evaluate(async(N)=>{
    MB.debugStart({});
    const S=MB.state;
    MB.ask=async()=>0; MB.yesno=async()=>Math.random()<0.5; MB.Screens.dexEntry=async()=>{}; MB.inputText=async(a,d)=>d; MB.say=async()=>{};
    const BP=MB.BattleScene.prototype;
    BP.say=function(t){ this.msg=t; return Promise.resolve(); };
    BP.tween=function(d,fn){ fn(1); return Promise.resolve(); };
    BP.wait=function(){ return Promise.resolve(); };
    BP.showLevelStats=async function(){};
    BP.openParty=async function(forced){ const M=this.menu; this.menu=null; const i=S.party.findIndex((m,k)=>m.hp>0&&!m.egg&&(k!==this.p.idx||this.mon(this.p).hp<=0)); if(M){M.res(i>=0?{type:'switch',to:i}:{type:'move',id:this.mon(this.p).moves[0].id}); return;} return i; };
    BP.choosePlayerAction=async function(){ const r=Math.random(); const mon=this.mon(this.p);
      if(r<0.06 && S.party.some((m,k)=>k!==this.p.idx&&m.hp>0)) return {type:'switch',to:S.party.findIndex((m,k)=>k!==this.p.idx&&m.hp>0)};
      if(r<0.1) return {type:'item',id:'super_potion',target:this.p.idx};
      if(r<0.12 && this.kind==='wild') return {type:'ball',id:'great_capsule'};
      if(r<0.13 && this.kind==='wild') return {type:'run'};
      const mv=MB.pick(mon.moves.filter(m=>m.pp>0)); return {type:'move',id:mv?mv.id:'struggle',mega:this.canMega(this.p)&&Math.random()<0.5}; };
    const keys=MB.SPECIES.map(s=>s.key);
    let turns=0, done=0, outcomes={};
    for(let i=0;i<N;i++){
      S.party=[]; const n=1+Math.floor(Math.random()*6);
      for(let k=0;k<n;k++){ const sp=MB.pick(keys); const m=MB.Mon.create(sp,MB.randInt(5,90)); if(MB.SP[sp].mega&&Math.random()<0.5) m.item=MB.SP[sp].mega.stone; else if(Math.random()<0.3) m.item=MB.pick(['spring_moss','power_charm','last_stand_band','quick_feather','focus_lens','shell_plate','swift_boots','flame_sigil']); S.party.push(m);}
      S.bag={super_potion:50,great_capsule:50};
      const enemy=[]; const en=1+Math.floor(Math.random()*6);
      for(let k=0;k<en;k++){ const sp=MB.pick(keys); const m=MB.Mon.create(sp,MB.randInt(5,90)); if(MB.SP[sp].mega&&Math.random()<0.5) m.item=MB.SP[sp].mega.stone; enemy.push(m);}
      const wild=Math.random()<0.4;
      const sc=new MB.BattleScene({kind:wild?'wild':'trainer',enemy:wild?[enemy[0]]:enemy,trainer:{name:'Fuzz',title:'Ace',app:MB.Chars.randomApp('f'+i),ai:MB.randInt(1,6),items:['hyper_potion','full_restore'],mega:true,pay:10},canLose:true,weather:MB.pick([null,'rain','sun','sand','snow'])});
      sc.close=(r)=>{sc._res=r;};
      sc.enter=()=>{};
      const MAXT=400; let guard=0;
      const origRT=sc.resolveTurn.bind(sc);
      sc.resolveTurn=async(a,b)=>{ turns++; if(++guard>MAXT) { sc.result={outcome:'timeout'}; return; } return origRT(a,b); };
      try { const r=await Promise.race([sc.run().then(()=>'ok'), new Promise(res=>setTimeout(()=>res('HANG'),3000))]); if(r==='HANG') return {hang:true, i, msg:sc.msg, turn:sc.turn, menu:!!sc.menu, p:S.party.map(m=>m.sp+':'+m.hp), e:sc.e.party.map(m=>m.sp+':'+m.hp+':'+m.item), lvl:!!sc.lvlPanel, top:MB.Game.top().constructor.name}; } catch(e){ return {err:e.message, stack:e.stack, i}; }
      const o=(sc.result||{}).outcome; outcomes[o]=(outcomes[o]||0)+1; done++;
    }
    return {done, turns, outcomes, megas:S.stats.megas};
  }, +process.argv[2]||5);
  console.log(JSON.stringify(res));
  console.log('ERRORS',errs.length?[...new Set(errs)].slice(0,15).join('\n'):'none');
  await b.close();
})();
