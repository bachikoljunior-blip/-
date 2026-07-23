const G=require('./sim.js'); const {STRATEGIES}=require('./strategies.js');
const sets={};
for(const s of STRATEGIES){
  const sim=G.simulate(s,{hours:8});
  // 生涯で取得したスキルの順序(最初の20個)
  const order=[];
  for(const r of sim.runs){ if(r.skillIds) for(const id of r.skillIds) if(!order.includes(id)) order.push(id); }
  sets[s.id]=order;
  console.log(`${s.id.padEnd(4)} 序盤取得順(先頭12): ${order.slice(0,12).join(' ')}`);
}
// 序盤12個の一致度を数える(S1基準)
console.log('\n=== S1と先頭12個が何個一致するか(少ないほど多様) ===');
const base=sets['S1'].slice(0,12);
for(const id in sets){ const o=sets[id].slice(0,12); const same=o.filter(x=>base.includes(x)).length; console.log(`${id}: ${same}/12 一致`); }
