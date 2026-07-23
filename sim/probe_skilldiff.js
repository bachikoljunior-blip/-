const G=require('./sim.js'); const {STRATEGIES}=require('./strategies.js');
const H=Number(process.argv[2]||8);
const sets={};
for(const s of STRATEGIES){
  const sim=G.simulate(s,{hours:H});
  const set=new Set();
  for(const r of sim.runs){ if(r.skillIds) for(const id of r.skillIds) set.add(id); }
  sets[s.id]=set;
}
const ids=Object.keys(sets);
// 全方針共通(intersection)
let common=null;
for(const id of ids){ if(common==null) common=new Set(sets[id]); else common=new Set([...common].filter(x=>sets[id].has(x))); }
console.log(`全方針が取る共通スキル数=${common.size}`);
// 各方針: 他の少なくとも1方針が取っていないスキルを1つ以上取るか
let ok=0;
for(const id of ids){
  // このidが取るスキルのうち、他の少なくとも1方針が取っていないもの
  const diff=[...sets[id]].filter(sk=> ids.some(o=>o!==id && !sets[o].has(sk)) );
  const pass=diff.length>=1;
  if(pass) ok++;
  console.log(`${id.padEnd(4)} 取得${sets[id].size}個 差別化スキル(他の1方針以上が未取得)=${diff.length}個 ${diff.length?'例:'+diff.slice(0,4).join(','):''} -> ${pass?'OK':'NG'}`);
}
console.log(`\n㉜ 合計 ${ok}/${ids.length}方針`);
