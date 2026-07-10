// (b) 早期周回の頭落ち緩和の掃引: graceSec/baseCoef を振って、頭クラスタ(位置0-10%)・T3a・位置中央値・
// 最高層中央値・平均総クッキー(経済プロキシ)を主要方針で測る。層ゲージへの影響を最高層で監視する。
const P = require('./params.js');
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const hours = Number(process.argv[2] || 60);
const ids = (process.argv[3] || 'S1,S5,S8,S10').split(',');
function med(a){ if(!a.length) return null; const b=a.slice().sort((x,y)=>x-y); const m=b.length>>1; return b.length%2?b[m]:(b[m-1]+b[m])/2; }
function log10(x){ return x>0 ? Math.log10(x) : 0; }

// 振る候補(graceSec, baseCoef)。基準は 30 / 0.22。
const orig = { graceSec: P.quota.graceSec, baseCoef: P.quota.baseCoef, basePow: P.quota.basePow };
const grid = [];
for (const g of [30, 90, 180, 300, 480]) for (const c of [0.22, 0.12, 0.06]) grid.push({ graceSec: g, baseCoef: c });

console.log(`基準 graceSec=${orig.graceSec} baseCoef=${orig.baseCoef} basePow=${orig.basePow} / hours=${hours}`);
console.log('grace  bCoef | ' + ids.map(id=>`${id}:頭/T3a@pos層`).join('  '));
for (const cfg of grid) {
  P.quota.graceSec = cfg.graceSec; P.quota.baseCoef = cfg.baseCoef;
  const cells = [];
  for (const id of ids) {
    const s = STRATEGIES.find(x=>x.id===id);
    const sim = G.simulate(s, { hours });
    const full = sim.runs.filter(r=>!r.partial);
    let ok=0, head=0; const pos=[], stages=[]; const endCk=[];
    for (const r of full) {
      stages.push(r.maxStage);
      // 各周回の最終total(=その周回でどこまで稼いだか)を経済プロキシに
      if (r.runCookies) endCk.push(log10(r.runCookies));
      if (r.quotaFailAt!=null && r.quotaFailAt<r.duration) {
        ok++; const p=r.quotaFailAt/r.duration; pos.push(p); if(p<0.10) head++;
      }
    }
    const mp=med(pos); const ms=med(stages); const mc=med(endCk);
    cells.push(`${String(head).padStart(2)}/${ok}/${full.length}@${mp==null?'--':(mp*100).toFixed(0)}%L${ms==null?'-':Math.round(ms)}c${mc==null?'-':mc.toFixed(0)}`);
  }
  console.log(`${String(cfg.graceSec).padStart(5)} ${cfg.baseCoef.toFixed(2).padStart(5)} | ${cells.join('  ')}`);
}
// 復帰
P.quota.graceSec = orig.graceSec; P.quota.baseCoef = orig.baseCoef;
