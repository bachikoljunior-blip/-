const G=require('./sim.js'); const {STRATEGIES}=require('./strategies.js');
const H=Number(process.argv[2]||8);
console.log('スキル総数(SKILL_NODES)='+G.SKILL_NODES.length);
const sets={};
for(const s of STRATEGIES){
  const sim=G.simulate(s,{hours:H});
  const set=new Set();
  for(const r of sim.runs){ if(r.skillIds) for(const id of r.skillIds) set.add(id); }
  sets[s.id]=set;
}
const ids=Object.keys(sets);
let common=null;
for(const id of ids){ if(common==null) common=new Set(sets[id]); else common=new Set([...common].filter(x=>sets[id].has(x))); }
console.log('全方針共通='+common.size+'個: '+[...common].join(' '));
console.log('\n各方針の取得数(少ない順=共通を縛る方針):');
ids.map(id=>[id,sets[id].size]).sort((a,b)=>a[1]-b[1]).forEach(([id,n])=>console.log(`  ${id}: ${n}個`));
