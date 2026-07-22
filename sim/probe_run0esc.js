const G = require('./sim.js'); const { STRATEGIES } = require('./strategies.js');
let ok=0,tot=0;
for (const s of STRATEGIES) {
  const sim = G.simulate(s, { hours: 2 });
  const r = sim.runs.find(r=>!r.partial); if(!r) continue; tot++;
  const fe=r.firstEscapeAt, qf=r.quotaFailAt;
  const pass = fe!=null && qf!=null && fe<qf;
  if(pass) ok++;
  console.log(`${s.id.padEnd(4)} run0 dur=${(r.duration/60).toFixed(1)}m firstEscape=${fe==null?'null':Math.round(fe)} quotaFail=${qf==null?'null':Math.round(qf)} kills=${r.kills} -> ${pass?'OK':'NG'}`);
}
console.log(`\nrun0 「先に倒せなくなる」: ${ok}/${tot}`);
