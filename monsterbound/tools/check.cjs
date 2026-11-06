const MB=require('./load.cjs')(['js/core/util.js','js/data/types.js','js/data/moves.js','js/data/abilities.js','js/data/creatures.js','js/data/items.js']);
console.log('moves',MB.MOVE_LIST.length,'species',MB.SPECIES.length,'A end',MB.DEX_AETHERIA_END,'megas',MB.MEGA_SPECIES.length,'items',Object.keys(MB.ITEMS).length);
const names=MB.SPECIES.map(s=>s.name);const d=names.filter((n,i)=>names.indexOf(n)!==i);console.log('dupes',d);
console.log(JSON.stringify(MB.SP.emberfox.learn), MB.SP.emberfox.base, MB.SP.infernyx.mega);
const bad=[];for(const s of MB.SPECIES){for(const [l,id] of s.learn) if(!MB.MOVES[id]) bad.push(s.name+':'+id); for(const a of s.abilities) if(!MB.ABILITIES[a]) bad.push(s.name+' ab '+a); if(s.mega&&!MB.ABILITIES[s.mega.ability]) bad.push('mega ab '+s.name);}
console.log('bad',bad);
console.log(MB.SPECIES.filter(s=>s.types.some(t=>!MB.TYPES.includes(t))).map(s=>s.name));
console.log(MB.SPECIES.filter(s=>s.evo.some(e=>e.m==='item'&&!MB.ITEMS[e.v])).map(s=>s.name));
