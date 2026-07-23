const G=require('./sim.js'); const {STRATEGIES}=require('./strategies.js');
for(const sid of (process.argv.slice(2).length?process.argv.slice(2):['S1','S6','S8','S12'])){
  const s=STRATEGIES.find(x=>x.id===sid);
  const sim=G.simulate(s,{hours:8});
  const seq=sim.runs.filter(r=>!r.partial).map(r=>r.skillsBought||0);
  const marks=seq.map(c=>c>5?`[${c}]`:`${c}`);
  console.log(`${sid}: 転生ごとのスキル取得数 = ${marks.join(' → ')}   (>5は[ ]・PT総額はrun長で増加)`);
}
