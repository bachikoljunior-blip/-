// (b)候補の全方針検証: base(graceSec=30) vs 候補(graceSec=引数) を全10方針で並べ、
// 頭(位置<10%)・T3a・位置中央・T3b・最高層中央・log10総クッキー中央 を比較する。
const P = require('./params.js');
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const hours = Number(process.argv[2] || 60);
const candGrace = Number(process.argv[3] || 300);
const candCoef = Number(process.argv[4] || 0.22);
function med(a){ if(!a.length) return null; const b=a.slice().sort((x,y)=>x-y); const m=b.length>>1; return b.length%2?b[m]:(b[m-1]+b[m])/2; }
function l10(x){ return x>0?Math.log10(x):0; }
function run(){
  let H=0,OK=0,RUN=0,T3B=0; const rows=[];
  for (const s of STRATEGIES){
    const sim=G.simulate(s,{hours});
    const full=sim.runs.filter(r=>!r.partial);
    let ok=0,head=0,t3b=0; const pos=[],st=[],ck=[];
    for (const r of full){
      st.push(r.maxStage); if(r.runCookies) ck.push(l10(r.runCookies));
      const hold = r.quotaHold != null ? r.quotaHold : (r.quotaHoldSeconds||0);
      if (hold >= 0.5*r.duration) t3b++;
      if (r.quotaFailAt!=null && r.quotaFailAt<r.duration){ ok++; const p=r.quotaFailAt/r.duration; pos.push(p); if(p<0.10) head++; }
    }
    H+=head; OK+=ok; RUN+=full.length; T3B+=t3b;
    const mp=med(pos);
    rows.push(`${s.id.padEnd(3)} 頭${String(head).padStart(2)} T3a${String(ok).padStart(2)}/${String(full.length).padStart(2)}@${mp==null?'--':(mp*100).toFixed(0)}% T3b${String(t3b).padStart(2)}/${String(full.length).padStart(2)} L${String(Math.round(med(st))).padStart(3)} c${Math.round(med(ck))}`);
  }
  return {H,OK,RUN,T3B,rows};
}
const origG=P.quota.graceSec, origC=P.quota.baseCoef;
console.log(`hours=${hours}`);
console.log(`=== BASE graceSec=${origG} baseCoef=${origC} ===`);
let r=run(); r.rows.forEach(x=>console.log('  '+x));
console.log(`  合計 頭${r.H} T3a${r.OK}/${r.RUN}(${(r.OK/r.RUN*100).toFixed(0)}%) T3b${r.T3B}/${r.RUN}(${(r.T3B/r.RUN*100).toFixed(0)}%)`);
P.quota.graceSec=candGrace; P.quota.baseCoef=candCoef;
console.log(`=== CAND graceSec=${candGrace} baseCoef=${candCoef} ===`);
r=run(); r.rows.forEach(x=>console.log('  '+x));
console.log(`  合計 頭${r.H} T3a${r.OK}/${r.RUN}(${(r.OK/r.RUN*100).toFixed(0)}%) T3b${r.T3B}/${r.RUN}(${(r.T3B/r.RUN*100).toFixed(0)}%)`);
P.quota.graceSec=origG; P.quota.baseCoef=origC;
