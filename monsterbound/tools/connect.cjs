// Strict connectivity: one-way ledges, item-aware tiles, and world graph reachability.
const files=['js/core/util.js','js/data/types.js','js/data/moves.js','js/data/abilities.js','js/data/creatures.js','js/data/items.js','js/gfx/characters.js','js/battle/creature.js','js/data/trainers.js','js/world/mapgen.js','js/world/world.js','js/data/world_aetheria.js','js/data/world_veloria.js','js/data/story.js','js/data/quests.js','js/battle/systems.js'];
const MB=require('./load.cjs')(files); MB.injectQuestNpcs();
MB.state={flags:{},party:[],keyItems:{},bag:{},dex:{},quests:{},badges:[],vBadges:[],clock:600,day:0,settings:{}};
const PASS=MB.MapGen.PASS; const ids=Object.keys(MB.WORLD_SPECS);
for(let pass=0;pass<3;pass++) for(const id of Object.keys(MB.WORLD_SPECS)) MB.World.get(id);
const all=()=>Object.keys(MB.World.maps);
// directional flood
function reach(m,sx,sy,items){ const W=m.w,H=m.h,seen=new Uint8Array(W*H),q=[[sx,sy]]; seen[sy*W+sx]=1;
  const ok=(c,dy)=>{ if(c==='L') return dy===1; if(c==='~'||c==='D') return items.surf; if(c==='H') return items.climb; if(c==='b') return items.shears; if(c==='C') return items.hammer; if(c==='B') return items.gloves||m.freePush; if(c==='R'||c==='r') return items.rift; if(c==='x') return false; return PASS.has(c)||c==='K'||c==='v'||c==='t'; };
  while(q.length){ const [x,y]=q.pop(); for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ let nx=x+dx,ny=y+dy; if(nx<0||ny<0||nx>=W||ny>=H||seen[ny*W+nx]) continue; const c=m.tiles[ny][nx]; if(!ok(c,dy)) continue; if(c==='L'){ seen[ny*W+nx]=1; ny+=1; if(ny>=H||seen[ny*W+nx]) continue; if(!ok(m.tiles[ny][nx],1)||m.tiles[ny][nx]==='L') continue; } seen[ny*W+nx]=1; q.push([nx,ny]); } }
  if(m.teleports) for(let it=0;it<6;it++) for(const [a,b,c,d] of m.teleports) if(seen[b*W+a]&&!seen[d*W+c]){ const r=reach(Object.assign({},m,{teleports:null}),c,d,items); for(let i=0;i<r.length;i++) if(r[i]) seen[i]=1; }
  return seen; }
function points(m){ const pts=[]; for(const e of m.exits) pts.push({k:'exit '+e.side+'->'+e.to,x:e.inner[0],y:e.inner[1]});
  for(const p of m.portals){ const t=m.tiles[p.y][p.x]; pts.push({k:'portal->'+p.to,x:p.x,y:t==='>'?p.y:p.y+1}); }
  for(const b of m.buildings) pts.push({k:'door '+b.id,x:b.door.x,y:b.door.y+1});
  for(const w of m.warps.filter(w=>w.exitTo)) pts.push({k:'mat',x:w.x,y:w.y});
  if(m.leaderSpot) pts.push({k:'leader',x:m.leaderSpot[0],y:m.leaderSpot[1]+1});
  return pts; }
const FULL={surf:1,climb:1,shears:1,hammer:1,gloves:1,rift:1};
let problems=0;
// 1) every point can reach every other point in BOTH directions, with all items
for(const id of all()){ const m=MB.World.maps[id]; const pts=points(m); if(pts.length<2) continue;
  for(const a of pts){ const r=reach(m,a.x,a.y,FULL); for(const b of pts){ if(a===b) continue; if(!r[b.y*m.w+b.x]){ console.log(`ONE-WAY/BLOCKED ${id}: ${a.k} cannot reach ${b.k}`); problems++; } } } }
// 2) main-story maps must not need field items the player doesn't have yet
const NONE={}; const early={route1:NONE,verdant:NONE,route2:NONE,moonveil:NONE,route3:NONE,crystalwater:{shears:1},route4:{shears:1},ironpeak_1:{shears:1},ironpeak_2:{shears:1},ironpeak_summit:{shears:1},route5:{shears:1},sunspire:{shears:1},route6:{shears:1,hammer:1},ancient_hollow:{shears:1,hammer:1},route7:{shears:1,hammer:1},stormport:{shears:1,hammer:1},route8:{shears:1,hammer:1,surf:1},emberfall:{shears:1,hammer:1,surf:1}};
for(const [id,items] of Object.entries(early)){ const m=MB.World.maps[id]; const pts=points(m).filter(p=>p.k.startsWith('exit')||p.k.startsWith('door')||p.k==='mat'||p.k.startsWith('portal->ironpeak')); const r=reach(m,pts[0].x,pts[0].y,items); for(const b of pts) if(!r[b.y*m.w+b.x]){ console.log(`STORY-GATED ${id}: ${pts[0].k} -> ${b.k} needs an item you don't have yet`); problems++; } }
// 3) world graph from Willowbrook (exits, portals, doors, ship)
const adj={}; const add=(a,b)=>{(adj[a]=adj[a]||new Set()).add(b);};
for(const id of all()){ const m=MB.World.maps[id]; for(const e of m.exits) add(id,e.to); for(const p of m.portals) add(id,p.to); for(const b of m.buildings) add(id,b.id); if(m.parent) add(id,m.parent); }
add('sp_port','halcyon'); add('hh_port','stormport');
// two-way check for exits
for(const id of all()){ const m=MB.World.maps[id]; for(const e of m.exits){ const d=MB.World.maps[e.to]; if(!d.exits.some(x=>x.to===id&&x.side===e.toSide)){ console.log('EXIT WITH NO RETURN',id,e.side,'->',e.to); problems++; } } }
const seen=new Set(['willowbrook']), q=['willowbrook']; while(q.length){ const a=q.shift(); for(const b of adj[a]||[]) if(!seen.has(b)){ seen.add(b); q.push(b);} }
const unreached=all().filter(id=>!seen.has(id));
console.log('places in world:',all().length,'reachable from home:',seen.size, unreached.length?'UNREACHABLE: '+unreached.join(', '):'');
console.log('TOTAL PROBLEMS',problems+unreached.length);
// gyms: you must be able to get from the leader back to the exit mat
for(const id of Object.keys(MB.World.maps)){ const m=MB.World.maps[id]; if(!m.gym) continue; const mat=m.warps.find(w=>w.exitTo); const [lx,ly]=m.leaderSpot; const r=reach(m,lx,ly+1,FULL); if(!r[mat.y*m.w+mat.x]) console.log('CANNOT LEAVE GYM',id); }
console.log('gym exit check done');
