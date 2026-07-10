// (c) ㉘の討伐由来独占の調整: chain.prodCoef / breakSec を振って、hunt方針(討伐≥30%必要)と
// bake方針(設備≥30%必要・討伐が独占してないか)の㉘合否と、各稼ぎ口シェアの周回中央値を見る。
const P = require('./params.js');
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const H = Number(process.argv[2] || 40);
function med(a){ if(!a.length) return null; const b=a.slice().sort((x,y)=>x-y); const m=b.length>>1; return b.length%2?b[m]:(b[m-1]+b[m])/2; }
// 代表方針を pickPolicy から解決
const reps = {};
for (const s of STRATEGIES){ let pol=null; try{ pol=s.pickPolicy({prestigeRuns:1,runs:[],t:0,run:{}});}catch(e){} if(pol&&!reps[pol]) reps[pol]=s; }
const ROLE_CH = { bake:'equip', golden:'golden', hunt:'hunt', click:'tap', balanced:null };
const ROLE_RES = { bake:['ovenBatch','factoryNetwork','grandmaCrowd','moonGlobalYeast','galaxyAssembly','blackHoleCompression','quantumProofing','antimatterRecipe'], golden:['spiceBlend'], hunt:['portalNetwork','portalGlobalFold'], click:['fingerTechnique','bankClickDividend'], balanced:null };
const ALLR = [...new Set(Object.values(ROLE_RES).filter(Boolean).flat())];
function evalPol(pol){
  const s=reps[pol]; if(!s) return `${pol}:なし`;
  const sim=G.simulate(s,{hours:H,measure:true});
  const full=sim.runs.filter(r=>!r.partial && r.measure && r.measure.income);
  let ok=0,all=0; const eq=[],go=[],hu=[],ta=[];
  for(const r of full){
    const gate=ROLE_RES[pol]||ALLR; const gated=(r.researchBought||[]).some(id=>gate.includes(id));
    const i=r.measure.income; const sh={equip:i.equip,golden:i.golden,hunt:i.hunt,tap:i.tap};
    eq.push(sh.equip);go.push(sh.golden);hu.push(sh.hunt);ta.push(sh.tap);
    const mx=Math.max(...Object.values(sh));
    const aP= pol==='balanced'? Object.values(sh).every(v=>v>=0.10) : sh[ROLE_CH[pol]]>=0.30;
    const bP= mx<=0.90;
    if(gated){all++; if(aP&&bP)ok++;}
  }
  return `${pol} ${ok}/${all} [設${(med(eq)*100).toFixed(0)} 金${(med(go)*100).toFixed(0)} 討${(med(hu)*100).toFixed(0)} 打${(med(ta)*100).toFixed(0)}]`;
}
const orig={pc:P.chain.prodCoef, bs:P.chain.breakSec};
console.log(`hours=${H} 基準 prodCoef=${orig.pc} breakSec=${orig.bs}`);
const grid=[ {pc:0.02,bs:90},{pc:0.012,bs:90},{pc:0.006,bs:90},{pc:0.006,bs:45} ];
for(const g of grid){
  P.chain.prodCoef=g.pc; P.chain.breakSec=g.bs;
  console.log(`pc=${g.pc.toFixed(3)} bs=${g.bs} | ${evalPol('hunt')} | ${evalPol('bake')}`);
}
P.chain.prodCoef=orig.pc; P.chain.breakSec=orig.bs;
