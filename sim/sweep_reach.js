// 提案9の係数掃引: reachCoef/reachPow/reachMinSec を差し替え、全方針で T3a full/full と未達位置中央値を測る。
// 目標: T3a を全方針で満点に近づけ、位置は50〜100%を保つ。各点ごとにファイル追記。
const fs = require('fs');
const P = require('./params.js');
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const hours = Number(process.env.HOURS || 40);
const OUT = process.env.OUT || '/home/user/exist-debug/sim/results/sweep_reach.txt';
const only = process.env.STRATS ? process.env.STRATS.split(',') : null;
const strats = STRATEGIES.filter(s => !only || only.includes(s.id));
function med(a){ if(!a.length) return null; const b=a.slice().sort((x,y)=>x-y); const m=b.length>>1; return b.length%2?b[m]:(b[m-1]+b[m])/2; }
function emit(s){ fs.appendFileSync(OUT, s + '\n'); }
// 点: "coef,pow,minSec;..."。ρ*=(1/coef)^(1/pow)。
const grid = (process.argv[2] || '9,10,1200;14,10,1200;20,10,1200;20,10,600;30,12,1200').split(';').map(s=>{const [c,p,m]=s.split(',').map(Number);return {c,p,m};});
emit(`# sweep_reach hours=${hours} strats=${strats.map(s=>s.id).join(',')}`);
for (const g of grid){
  P.quota.reachCoef = g.c; P.quota.reachPow = g.p; P.quota.reachMinSec = g.m;
  const rhoStar = Math.pow(1/g.c, 1/g.p);
  const parts=[]; let totFail=0, totRun=0; const allPos=[];
  for (const s of strats){
    const sim = G.simulate(s, { hours });
    const full = sim.runs.filter(r=>!r.partial);
    let ok=0; const pos=[];
    for (const r of full){ if(r.quotaFailAt!=null && r.quotaFailAt<r.duration){ ok++; const pp=r.quotaFailAt/r.duration; pos.push(pp); allPos.push(pp);} }
    totFail+=ok; totRun+=full.length;
    const mp=med(pos);
    parts.push(`${s.id}=${ok}/${full.length}${mp==null?'':'@'+(mp*100).toFixed(0)+'%'}`);
  }
  const gmp=med(allPos);
  emit(`coef=${String(g.c).padStart(3)} pow=${String(g.p).padStart(2)} min=${String(g.m).padStart(4)} ρ*=${rhoStar.toFixed(2)} | 全体 ${totFail}/${totRun} 位置中央${gmp==null?'-':(gmp*100).toFixed(0)+'%'}`);
  emit('    ' + parts.join('  '));
}
emit('# done');
