const files=['js/core/util.js','js/data/types.js','js/data/moves.js','js/data/abilities.js','js/data/creatures.js','js/data/items.js','js/gfx/characters.js','js/battle/creature.js','js/data/trainers.js','js/world/mapgen.js','js/world/world.js','js/data/world_aetheria.js','js/data/world_veloria.js','js/data/story.js','js/data/quests.js','js/battle/systems.js'];
const MB=require('./load.cjs')(files);
MB.injectQuestNpcs();
MB.state=MB.newState?MB.newState():{flags:{},party:[],keyItems:{},bag:{},dex:{},quests:{},badges:[],vBadges:[],clock:600,day:0,settings:{}};
const probs=[];const P=(s)=>probs.push(s);
// species refs
const spRef=(k,w)=>{ if(!MB.SP[k]) P('bad species '+k+' in '+w); };
for(const [k,B] of Object.entries(MB.BOSSES)) for(const t of B.team||[]) spRef(t[0],'boss '+k);
for(const st of [0,1,2,3,4,5,6,7]) for(const s of ['emberfox','aquaphin','leafling']) for(const t of MB.rivalTeam(st,s)) spRef(t[0],'rival');
for(const q of MB.QUESTS){ const ds=q.type==='stages'?q.stages:[{type:q.type,p:q.p}]; for(const d of ds){ if(d.p&&d.p.sp) spRef(d.p.sp,'quest '+q.id); if(d.p&&d.p.id&&!MB.ITEMS[d.p.id]) P('quest item '+d.p.id); if(d.p&&d.p.map&&!MB.WORLD_SPECS[d.p.map]) P('quest map '+d.p.map); if(d.p&&d.p.key&&!MB.BOSSES[d.p.key]) P('quest boss '+d.p.key);} for(const [id] of (q.reward&&q.reward.items)||[]) if(!MB.ITEMS[id]) P('quest reward '+id); }
for(const [k,l] of Object.entries(MB.SHOPS)) for(const id of l) if(!MB.ITEMS[id]) P('shop item '+id+' in '+k);
// scripts referenced
const scriptOk=(s)=>{ const [n,a]=s.split(':'); if(n==='q') return !!MB.QUESTS.find(q=>q.id===a); if(n==='qt') return true; if(n==='facility'||n==='shop') return true; if(n==='leader') return !!MB.BOSSES[a]; return !!MB.SCRIPTS[n]; };
const ids=Object.keys(MB.WORLD_SPECS);
const usedQuests=new Set();
for(const id of ids){ const s=MB.WORLD_SPECS[id];
  for(const n of s.npcs||[]){ if(n.script&&!scriptOk(n.script)) P('script '+n.script+' in '+id); if(n.script&&n.script.startsWith('q:')) usedQuests.add(n.script.slice(2)); if(n.legend) spRef(n.legend,'legend '+id); }
  for(const b of s.buildings||[]) for(const n of b.npcs||[]){ if(n.script&&!scriptOk(n.script)) P('script '+n.script+' in '+id+'/'+b.id); if(n.script&&n.script.startsWith('q:')) usedQuests.add(n.script.slice(2)); }
  for(const it of s.items||[]) if(!MB.ITEMS[it.item]) P('item '+it.item+' in '+id);
  for(const g of s.gates||[]) if(g.item&&!MB.ITEMS[g.item]) P('gate item '+g.item+' in '+id);
  for(const e of s.exits||[]) { if(!MB.WORLD_SPECS[e.to]) P('exit to missing '+e.to); }
  for(const t of s.triggers||[]) if(!MB.SCRIPTS[t.script]) P('trigger script '+t.script);
}
for(const q of MB.QUESTS) if(!usedQuests.has(q.id)) P('quest without giver '+q.id);
// generate all maps (including interiors created on the fly)
const PASS=MB.MapGen.PASS; let built=0;
const seen=new Set();
const queue=ids.slice();
while(queue.length){ const id=queue.shift(); if(seen.has(id)) continue; seen.add(id);
  let m; try{ m=MB.World.get(id);}catch(e){ P('BUILD FAIL '+id+': '+e.message+' '+e.stack.split('\n')[1]); continue; }
  built++;
  for(const b of m.buildings) if(!seen.has(b.id)) queue.push(b.id);
  // connectivity: from first target to all others
  const pts=[]; for(const e of m.exits) pts.push(['exit '+e.side,e.inner]);
  for(const p of m.portals) pts.push(['portal '+p.to,[p.x,p.y+ (m.tiles[p.y][p.x]==='>'?0:1)]]);
  for(const b of m.buildings) pts.push(['door '+b.id,[b.door.x,b.door.y+1]]);
  if(m.leaderSpot) pts.push(['leader',[m.leaderSpot[0],m.leaderSpot[1]+1]]);
  if(m.entry) pts.unshift(['entry',m.entry]);
  for(const w of m.warps.filter(w=>w.exitTo)) pts.unshift(['mat',[w.x,w.y]]);
  if(pts.length<2) continue;
  const passFn=(c)=>PASS.has(c)||c==='K'||c==='~'||c==='D'||c==='H'||c==='b'||c==='C'||c==='B'||c==='v'||c==='x'&&false||c==='R'||c==='r'||c==='i'||c==='t';
  const [n0,[sx,sy]]=pts[0];
  if(!passFn(m.tiles[sy][sx])) P(`${id}: start ${n0} on solid ${m.tiles[sy][sx]}`);
  let reach=MB.MapGen.flood(m.tiles,sx,sy,passFn);
  if(m.teleports){ for(let it=0;it<8;it++){ for(const [a,b,c,d] of m.teleports){ if(reach[b*m.w+a]&&!reach[d*m.w+c]){ const r2=MB.MapGen.flood(m.tiles,c,d,passFn); for(let i=0;i<r2.length;i++) if(r2[i]) reach[i]=1; } } } }
  for(const [n,[x,y]] of pts.slice(1)){ if(!reach[y*m.w+x]) P(`${id}: ${n} unreachable from ${n0} (tile ${m.tiles[y][x]})`); }
  for(const n of m.npcs){ const c=m.tiles[n.y]&&m.tiles[n.y][n.x]; if(c===undefined) P(`${id}: npc off map ${n.id}`); }
}
console.log('maps built',built,'specs',ids.length);
console.log(probs.length?probs.join('\n'):'NO PROBLEMS');
// ---- obtainability ----
const wild=new Set();
for(const clock of [600,1300]){ MB.state.clock=clock; for(const d of [0,7,14,21]){ MB.state.day=d; for(const id of ids){ const m=MB.World.get(id); if(!m.wild) continue; for(const kind of ['grass','water']) for(const e of MB.World.table(m,kind)) wild.add(e.sp);} } }
const legendNpc=new Set(); for(const id of ids) for(const n of MB.WORLD_SPECS[id].npcs||[]) if(n.legend) legendNpc.add(n.legend);
['solarion','noctyrr','wispette','omnirift'].forEach(k=>legendNpc.add(k));
const ok=new Set([...wild]);
for(const s of MB.SPECIES){ if(s.starter&&s.stage===0) ok.add(s.key); if(s.fossil&&s.stage===0) ok.add(s.key); if(s.legendary&&legendNpc.has(s.key)) ok.add(s.key); }
let changed=true; while(changed){ changed=false; for(const s of MB.SPECIES){ if(ok.has(s.key)) continue; if(s.prev&&ok.has(s.prev)){ok.add(s.key);changed=true;continue;} if(s.eggOnly&&s.evo.some(e=>ok.has(e.to))){ok.add(s.key);changed=true;} // breed down
 if(s.stage===0&&!s.legendary){ const desc=MB.evoChain(s.key).map(c=>c.sp.key); if(desc.some(k=>ok.has(k)&&k!==s.key)){ok.add(s.key);changed=true;} } } }
const missing=MB.SPECIES.filter(s=>!ok.has(s.key));
console.log('obtainable',ok.size,'/',MB.SPECIES.length,'wild',wild.size);
console.log('UNOBTAINABLE:',missing.map(s=>s.name+'('+s.region+','+s.habitats.join('/')+')').join(', '));
// mega stones placed?
const stoneSrc=new Set();
const scan=(o)=>{ const j=JSON.stringify(o); for(const sp of MB.MEGA_SPECIES) if(j.includes(sp.mega.stone)) stoneSrc.add(sp.mega.stone); };
scan(MB.WORLD_SPECS); scan(MB.QUESTS); scan(MB.Dex.MILESTONES); 
const storySrc=require('fs').readFileSync(__dirname+'/../js/data/story.js','utf8'); for(const sp of MB.MEGA_SPECIES) if(storySrc.includes(sp.mega.stone)) stoneSrc.add(sp.mega.stone);
console.log('stones with explicit source',stoneSrc.size,'/',MB.MEGA_SPECIES.length,' missing:',MB.MEGA_SPECIES.filter(s=>!stoneSrc.has(s.mega.stone)).map(s=>s.key).join(','));
// ---- gyms: leader reachable with trainers standing as obstacles ----
for(const id of ids){ const sp=MB.WORLD_SPECS[id]; for(const b of sp.buildings||[]){ if(b.kind!=='gym') continue; const m=MB.World.get(b.id);
  const block=new Set(m.npcs.filter(n=>!n.script||!n.script.startsWith('leader')).map(n=>n.x+','+n.y));
  const g=m.tiles.map((r,y)=>r.map((c,x)=>block.has(x+','+y)?'#':c));
  const passFn=(c)=>PASS.has(c)||c==='B'||c==='v'||c==='i'||c==='t';
  const [ex,ey]=m.entry; let reach=MB.MapGen.flood(g,ex,ey,passFn);
  if(m.teleports){ for(let it=0;it<8;it++) for(const [a,bb,c,d] of m.teleports) if(reach[bb*m.w+a]&&!reach[d*m.w+c]){ const r2=MB.MapGen.flood(g,c,d,passFn); for(let i=0;i<r2.length;i++) if(r2[i]) reach[i]=1; } }
  const [lx,ly]=m.leaderSpot; if(!reach[(ly+1)*m.w+lx]) console.log('GYM BLOCKED by trainers:',b.id, m.npcs.map(n=>[n.x,n.y]).join(' '));
}}
console.log('gym check done');
let blockedMaps=0;
for(const id of Object.keys(MB.World.maps)){ const m=MB.World.maps[id]; if(m.gym) continue;
  const block=new Set(m.npcs.filter(n=>!(n.script||'').startsWith('gate')&&n.script!=='wb_guard'&&!(n.at||'').toString().startsWith('exit:')&&!n.cond).map(n=>n.x+','+n.y));
  const g=m.tiles.map((r,y)=>r.map((c,x)=>block.has(x+','+y)?'#':c));
  const passFn=(c)=>PASS.has(c)||c==='K'||c==='~'||c==='D'||c==='H'||c==='b'||c==='C'||c==='B'||c==='R'||c==='r'||c==='i';
  const pts=[]; for(const e of m.exits) pts.push(e.inner); for(const b of m.buildings) pts.push([b.door.x,b.door.y+1]); for(const w of m.warps.filter(w=>w.exitTo)) pts.push([w.x,w.y]);
  if(pts.length<2) continue; const reach=MB.MapGen.flood(g,pts[0][0],pts[0][1],passFn);
  for(const [x,y] of pts.slice(1)) if(!reach[y*m.w+x]){ console.log('NPC-BLOCKED',id,x,y); blockedMaps++; break; }
}
console.log('npc block check done',blockedMaps);
// ---- every portal/ladder leads to a matching portal with a free landing tile ----
let portalProblems=0, portalCount=0;
for(const id of Object.keys(MB.WORLD_SPECS)){ const sp=MB.WORLD_SPECS[id]; if(!(sp.portals||[]).length) continue; const m=MB.World.get(id);
  if(m.portals.length!==sp.portals.length){ console.log('PORTAL MISSING on map',id,m.portals.length,'/',sp.portals.length); portalProblems++; }
  for(const p of m.portals){ portalCount++; const d=MB.World.get(p.to); const back=d.portals.find(q=>q.id===p.toPortal);
    if(!back){ console.log('NO RETURN PORTAL',id,'->',p.to); portalProblems++; continue; }
    const t=m.tiles[p.y][p.x]; if(!['>','E','D'].includes(t)){ console.log('PORTAL TILE WRONG',id,t); portalProblems++; }
    const land=[[back.x,back.y+1],[back.x,back.y-1],[back.x+1,back.y],[back.x-1,back.y]].some(([x,y])=>{const c=d.tiles[y]&&d.tiles[y][x]; return c&&PASS.has(c)&&c!=='>';});
    if(!land){ console.log('NO LANDING',p.to,'from',id); portalProblems++; } } }
console.log('portals checked',portalCount,'problems',portalProblems);
