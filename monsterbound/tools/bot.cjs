const {chromium}=require('playwright');const path=require('path');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:960,height:720}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message+' '+e.stack)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await p.goto('file://'+path.resolve(__dirname,'../index.html')); await p.waitForTimeout(700);
  await p.evaluate(()=>{
    // Bot helpers living in the page
    window.BOT={
      path(tx,ty){ const O=MB.Over,m=O.map,S=MB.state; const key=(x,y)=>x+','+y; const prev={}; const q=[[S.px,S.py]]; prev[key(S.px,S.py)]=null;
        while(q.length){ const [x,y]=q.shift(); if(x===tx&&y===ty) break; for(const d of ['up','down','left','right']){ const [dx,dy]=MB.dirs[d]; const nx=x+dx,ny=y+dy; if(nx<0||ny<0||nx>=m.w||ny>=m.h) continue; if(prev[key(nx,ny)]!==undefined) continue; const c=m.tiles[ny][nx]; const warp=m.warps.some(w=>w.x===nx&&w.y===ny&&!w.exitTo); if(!(nx===tx&&ny===ty)&&(!O.tilePassable(c,d,nx,ny)||c==='L'||warp||O.npcAt(nx,ny))) continue; if(nx===tx&&ny===ty&&!warp&&!O.tilePassable(c,d,nx,ny)) continue; prev[key(nx,ny)]=[x,y,d]; q.push([nx,ny]); } }
        if(prev[key(tx,ty)]===undefined) return null; const out=[]; let k=key(tx,ty); while(prev[k]){ const [x,y,d]=prev[k]; out.unshift(d); k=key(x,y);} return out; },
    };
  });
  await p.evaluate(()=>{ window.BLOG=[]; const r=MB.Battles.run; MB.Battles.run=async(o)=>{ const before=MB.state.party.map(m=>m.name+':'+m.lvl+':'+m.hp); const res=await r(o); BLOG.push([o.kind,o.trainer&&o.trainer.name,o.enemy.map(m=>m.sp+':'+m.lvl).join(','),before.join(','),res.outcome]); return res; }; });
  // start a new game the quick way but with the real starter flow
  await p.evaluate(()=>{ MB.debugStart({party:[], map:'wb_lab'}); const pr=MB.World.get('wb_lab').npcs.find(n=>n.id==='prof'); MB.state.px=pr.x; MB.state.py=pr.y+1; MB.state.dir='up'; MB.state.keyItems={running_shoes:true}; MB.state.bag={potion:5}; });
  const press=async(k,n=1)=>{ for(let i=0;i<n;i++){ await p.keyboard.down(k); await p.waitForTimeout(40); await p.keyboard.up(k); await p.waitForTimeout(90);} };
  const top=()=>p.evaluate(()=>MB.Game.top().constructor.name);
  // handle whatever modal is up
  async function handle(){
    const t=await top();
    if(t==='BattleScene'){ const acted=await p.evaluate(()=>{const B=MB.Game.top(); if(!B.menu) return false; const me=B.mon(B.p); const S=MB.state;
        if(me.hp/MB.Mon.maxHp(me)<0.35 && MB.Bag.count('potion')>0){ B.finishMenu({type:'item',id:'potion',target:B.p.idx}); return 'potion'; }
        let best=null,bv=-1; for(const mv of me.moves){ const M=MB.MOVES[mv.id]; if(mv.pp<=0||!M.power) continue; const v=B.estimateDamage(B.p,B.e,M)*(M.acc||100); if(v>bv){bv=v;best=M.id;} }
        B.finishMenu({type:'move',id:best||me.moves[0].id}); return best; });
      if(!acted) await press('x'); return true; }
    if(t==='StarterScene'){ await press('Enter'); return true; }
    if(t==='TextInputScene'){ await press('Escape'); return true; }
    if(t==='ChoiceScene'){ const pr=await p.evaluate(()=>MB.Game.top().opts.prompt||''); if(/nickname|Nickname/.test(pr)) { await press('ArrowDown'); } await press('Enter'); return true; }
    if(t==='PartyScene'){ await press('Enter'); await press('Enter'); return true; }
    if(t!=='Overworld'){ await press('Enter'); return true; }
    return false;
  }
  await press('z');
  for(let i=0;i<300;i++){ if(!(await handle()) && !(await p.evaluate(()=>MB.Over.busy))) break; }
  console.log('after lab:',JSON.stringify(await p.evaluate(()=>[MB.state.party.map(m=>m.name+':'+m.lvl),MB.state.flags.got_starter,MB.state.keyItems.aetherdex])));
  async function goTo(desc, targetFn, maxSteps=400){
    for(let step=0;step<maxSteps;step++){
      if(await handle()) continue;
      if(await p.evaluate(()=>MB.Over.busy||!!MB.Over.moving)) { await p.waitForTimeout(60); continue; }
      const st=await p.evaluate(targetFn);
      if(st.done) return true;
      const route=await p.evaluate(([x,y])=>BOT.path(x,y),[st.x,st.y]);
      if(!route||!route.length){ console.log('no path',desc,JSON.stringify(st), await p.evaluate(()=>[MB.state.map,MB.state.px,MB.state.py])); return false; }
      const d=route[0]; const k={up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'}[d];
      await p.keyboard.down(k); await p.waitForTimeout(70); await p.keyboard.up(k); for(let w=0;w<20 && await p.evaluate(()=>!!MB.Over.moving); w++) await p.waitForTimeout(30);
    }
    return false;
  }
  // talk to mom for shoes? skip. leave lab -> willowbrook -> route1 north exit
  const exitTarget=(side,from)=>`(()=>{const m=MB.Over.map; if(m.id!=='${from}') return {done:true}; const mat=m.warps.find(w=>w.exitTo); if(mat) return {x:mat.x,y:mat.y}; const e=m.exits.find(e=>e.side==='${side}'); const c=e.cells[1]; return {x:c[0],y:c[1],final:true,done:false};})()`;
  const leaveTo=async(fromMap,side)=>{ for(let t=0;t<6;t++){ const cur=await p.evaluate(()=>MB.state.map); if(cur!==fromMap) return true; const ok=await goTo('exit '+side, exitTarget(side,fromMap), 400); const k={n:'ArrowUp',s:'ArrowDown',e:'ArrowRight',w:'ArrowLeft'}[side]; const still=await p.evaluate((f)=>MB.state.map===f,fromMap); if(still){ await p.keyboard.down(k); await p.waitForTimeout(80); await p.keyboard.up(k); await p.waitForTimeout(600);} for(let i=0;i<30;i++) if(!(await handle())) break; } return (await p.evaluate(()=>MB.state.map))!==fromMap; };
  await leaveTo('wb_lab','s');
  console.log('map',await p.evaluate(()=>MB.state.map));
  await leaveTo('willowbrook','n');
  console.log('map',await p.evaluate(()=>[MB.state.map,MB.state.px,MB.state.py]));
  await p.screenshot({path:process.argv[2]+'_r1.png'});
  await leaveTo('route1','n');
  console.log('map',await p.evaluate(()=>[MB.state.map,MB.state.px,MB.state.py, MB.state.party.map(m=>m.name+':'+m.lvl+':'+m.hp), MB.state.stats]));
  await p.screenshot({path:process.argv[2]+'_verdant.png'});
  // walk to gym door
  const gymT=`(()=>{ if(MB.state.map!=='verdant') return {done:true}; const b=MB.Over.map.buildings.find(b=>b.kind==='gym'); return {x:b.door.x,y:b.door.y}; })()`;
  await goTo('gym',gymT,300);
  await p.waitForTimeout(800);
  console.log('map',await p.evaluate(()=>[MB.state.map,MB.state.px,MB.state.py]));
  await p.screenshot({path:process.argv[2]+'_gym.png'});
  // level up a bit (simulating grinding) and challenge the leader
  await p.evaluate(()=>{ const m=MB.state.party[0]; MB.Mon.gainExp(m, MB.Mon.expFor('medium',15)-m.exp); MB.Mon.heal(m); MB.Bag.add('potion',5); });
  const leaderT=`(()=>{ if(MB.state.map!=='gym_mira') return {done:true}; const L=MB.Over.map.npcs.find(n=>n.script&&n.script.startsWith('leader')); if(MB.state.flags.badge_mira) return {done:true}; if(MB.state.px===L.x&&MB.state.py===L.y+1) return {done:true}; return {x:L.x,y:L.y+1}; })()`;
  await goTo('leader',leaderT,1500);
  await p.evaluate(()=>{ MB.state.dir='up'; }); await press('z');
  for(let i=0;i<400;i++){ if(!(await handle()) && !(await p.evaluate(()=>MB.Over.busy))) break; }
  console.log('gym result',JSON.stringify(await p.evaluate(()=>[MB.state.badges, MB.state.keyItems.shears, MB.state.party.map(m=>m.name+':'+m.lvl), MB.state.flags])));
  await p.screenshot({path:process.argv[2]+'_badge.png'});
  console.log('BATTLES',JSON.stringify(await p.evaluate(()=>BLOG)));
  console.log('ERRORS',errs.length?[...new Set(errs)].slice(0,10).join('\n'):'none');
  await b.close();
})();
