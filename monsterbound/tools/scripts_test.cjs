const {chromium}=require('playwright');const path=require('path');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await p.goto('file://'+path.resolve(__dirname,'../index.html')); await p.waitForTimeout(700);
  const res=await p.evaluate(async()=>{
    MB.debugStart({party:[['infernyx',70,{item:'infernyx_stone'}],['leviaphin',70],['arborix',70],['wyvernox',70],['mentalord',70],['glacielle',70]]});
    const S=MB.state; S.starter='emberfox';
    // auto-resolve UI
    MB.say=async()=>{}; MB.sayAll=async()=>{}; let askN=0; MB.ask=async(p,c)=> (++askN % 9 === 0 ? -1 : 0); MB.yesno=async()=>true; MB.inputText=async(p,d)=>d||'T';
    MB.fadeOut=async()=>{}; MB.fadeIn=async()=>{};
    const realRun=MB.Battles.run;
    let battles=0;
    MB.Battles.run=async(opts)=>{ battles++; // validate enemy team builds & scene constructs
      new MB.BattleScene(opts); return {outcome: opts.kind==='wild'?'caught':'win'}; };
    MB.Screens.evolve=async()=>true; MB.Screens.hallOfFame=async()=>{}; MB.Screens.starterSelect=async()=>'emberfox'; MB.Screens.dexEntry=async()=>{}; MB.Screens.hatch=async(m)=>{delete m.egg}; MB.Screens.pickPartyMon=async()=>0;
    MB.Game.wait=async()=>{};
    const pushOrig=MB.Game.push; MB.Game.push=async(sc)=>{ return sc instanceof MB.BagScene? null : sc instanceof MB.PartyScene? 0 : null; };
    const out=[];
    const order=['prof_talk','mom_talk','mom_talk','lab_aide','moonveil_event','rival_2','hollow_event','fossil_revive','hollow_mural','rival_3','plant_rook','caldera_lab','rival_4','obs_nyx','obs_lyra','obs_lyra','capital_sable','rival_5','summit_valen','rival_6','league_gate','prof_talk','ship_veloria','veloria_prof','neo_sable','v_league_gate','final_boss','aldric','wish_shrine','wispette_girl','omnirift_altar','daycare','move_tutor','move_reminder','name_rater','ability_swap','rival_rematch','nurse','merchant','star_shard_grove','star_shard_throne','star_shard_summit','star_shard_starfall','star_shard_gloam','star_shard_dunes','star_shard_tundra','star_shard_verdigris','legend_lunelle','grove_hint','plant_engineer','r1_hint','gate_badge','gate_flag','wb_guard'];
    // give badges required for league
    for(const k of ['mira','voltan','brutus','marina','cinder','selene','frost','darius']){ try{ await MB.SCRIPTS.leader({npc:{}},k); }catch(e){ out.push('leader '+k+': '+e.message); } }
    for(const id of order){ try{ await MB.SCRIPTS[id]({npc:{talk:['x'],legend:'lunelle',lvl:50},map:MB.World.get(S.map)}); }catch(e){ out.push(id+': '+e.message+' '+(e.stack||'').split('\n')[1]); } }
    for(const k of ['w_bram','w_orla','w_quill','w_tempest','w_ysolde','w_ignatius','mira']) { try{ await MB.SCRIPTS.leader({npc:{}},k); }catch(e){ out.push('vleader '+k+': '+e.message); } }
    try { await MB.SCRIPTS.v_league_gate(); } catch(e){ out.push('vleague '+e.message); }
    // legends
    for(const sp of MB.SPECIES.filter(s=>s.legendary)) { try{ await MB.SCRIPTS.legend_generic({npc:{legend:sp.key,lvl:60}}); }catch(e){ out.push('legend '+sp.key+': '+e.message); } }
    // quests: accept & complete every quest by force
    for(const q of MB.QUESTS){ try{ S.quests[q.id]=undefined; delete S.quests[q.id]; await MB.Quests.talk(q.id); const st=S.quests[q.id]; if(st&&!st.done){ st.count=99; st.visited=true; st.delivered=true; if(q.type==='stages') st.stage=q.stages.length-1; await MB.Quests.complete(q,st);} MB.Quests.progressText(q,st||{}); }catch(e){ out.push('quest '+q.id+': '+e.message+' '+(e.stack||'').split('\n')[1]); } }
    // facilities
    MB.Facilities.battleWith=async()=>true;
    for(const f of ['tower','arena','gauntlet','challenge','shop']){ try{ if(f==='tower'){ let n=0; MB.yesno=async()=> (n++<4); } await MB.Facilities.talk(f); MB.yesno=async()=>true; }catch(e){ out.push('facility '+f+': '+e.message+' '+(e.stack||'').split('\n')[1]); } }
    MB.Battles.run=async(o)=>{ new MB.BattleScene(o); return {outcome:'win'}; };
    try{ await MB.Facilities.talk('trial'); }catch(e){ out.push('trial '+e.message); }
    // breeding
    try{ const a=MB.Mon.create('pupwick',20),c=MB.Mon.create('pupwick',20); a.gender='F'; c.gender='M'; S.daycare.mons=[a,c]; for(let i=0;i<50;i++){ MB.Breeding.step(10);} const egg=MB.Breeding.makeEgg(a,c); out.push('egg '+egg.sp+' steps '+egg.egg.steps+' moves '+egg.moves.map(m=>m.id).join('/')); }catch(e){ out.push('breed '+e.message); }
    MB.Achievements.check();
    return {out, battles, flags:Object.keys(S.flags).length, badges:S.badges, vb:S.vBadges, shards:S.starShards, ach:Object.keys(S.ach).length, completion:MB.Achievements.completion(), quests:Object.values(S.quests).filter(q=>q&&q.done).length};
  });
  console.log(JSON.stringify(res,null,1));
  console.log('ERRORS',errs.length?[...new Set(errs)].slice(0,15).join('\n'):'none');
  await b.close();
})();
