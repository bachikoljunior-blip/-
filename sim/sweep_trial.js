// 提案8の係数掃引: params の trialCoef/trialStartLayer を実行時に差し替え、全方針で
// T3a(未達が先)の full/full と未達位置中央値を測る。目標: 全方針で T3a=満点かつ位置が50〜100%。
const P = require('./params.js');
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const hours = Number(process.env.HOURS || 40);
function med(a){ if(!a.length) return null; const b=a.slice().sort((x,y)=>x-y); const m=b.length>>1; return b.length%2?b[m]:(b[m-1]+b[m])/2; }
// 掃引点: "coef,start;coef,start;..." を引数で渡す。無指定は既定セット。
const grid = (process.argv[2] || '0.08,10;0.3,3;0.7,2;0.7,0;1.5,2;1.5,0;3,2;3,0').split(';').map(s=>{const [c,st]=s.split(',').map(Number);return {c,st};});
for (const g of grid){
  P.quota.trialCoef = g.c; P.quota.trialStartLayer = g.st;
  let line = `coef=${String(g.c).padStart(4)} start=${String(g.st).padStart(2)} | `;
  const parts=[]; let totFail=0, totRun=0; const allPos=[];
  for (const s of STRATEGIES){
    const sim = G.simulate(s, { hours });
    const full = sim.runs.filter(r=>!r.partial);
    let ok=0; const pos=[];
    for (const r of full){ if(r.quotaFailAt!=null && r.quotaFailAt<r.duration){ ok++; const p=r.quotaFailAt/r.duration; pos.push(p); allPos.push(p);} }
    totFail+=ok; totRun+=full.length;
    const mp=med(pos);
    parts.push(`${s.id}=${ok}/${full.length}${mp==null?'':'@'+(mp*100).toFixed(0)+'%'}`);
  }
  const gmp=med(allPos);
  console.log(line + `全体 ${totFail}/${totRun} 位置中央値${gmp==null?'-':(gmp*100).toFixed(0)+'%'}`);
  console.log('        ' + parts.join('  '));
}
