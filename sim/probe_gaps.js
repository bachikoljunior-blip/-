const G = require('./sim.js'); const { STRATEGIES } = require('./strategies.js');
const s = STRATEGIES.find(x=>x.id===(process.argv[2]||'S1'));
const sim = G.simulate(s, { hours: Number(process.argv[3]||3) });
const ev = (sim.unlockEvents||[]).slice().sort((a,b)=>a.t-b.t);
let prev=null;
console.log('--- <30s gap のみ列挙 ---');
for (let i=0;i<ev.length;i++){
  const g = prev==null?null:ev[i].t-prev;
  if(g!=null && g<30) console.log(`${String(Math.round(ev[i].t)).padStart(5)}s gap=${Math.round(g)}s  ${ev[i].kind}:${ev[i].id}  (前=${ev[i-1].kind}:${ev[i-1].id})`);
  prev=ev[i].t;
}
