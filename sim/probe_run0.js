'use strict';
// run0 診断: 最初の周回の毎秒(実際は debugTrace のtickごと)の総クッキー・ノルマ・比率・モンスターHP/ダメージ
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const sid = process.argv[2] || 'S1';
const s = STRATEGIES.find(x => x.id === sid);
const sim = G.simulate(s, { hours: 2, debugRunIdx: 0 });
const tr = sim.debugTrace || [];
console.log(`strategy=${sid} tapRate=${s.tapRate}  (run0)`);
console.log('el   totalCookies    quota         q/tot   tapPS       clickEV    cps        mHP        mDmg/hit   ttk(s)  stage kills');
let lastEl = -100;
for (const e of tr) {
  if (e.el - lastEl < 3 && e.el > 5) continue; // ~3秒刻み
  lastEl = e.el;
  if (e.el > 180) break;
  const f = (x)=> (x==null?'-':(Math.abs(x)>=1e6? x.toExponential(2): x.toFixed(2)));
  console.log(
    String(Math.round(e.el)).padStart(4)+' '+
    f(e.c).padStart(13)+' '+
    f(e.q).padStart(13)+' '+
    (e.qRatio*100).toFixed(1).padStart(6)+'% '+
    f(e.tapPS).padStart(11)+' '+
    f(e.clickEV).padStart(10)+' '+
    f(e.cps).padStart(10)+' '+
    f(e.mhp).padStart(10)+' '+
    f(e.mdmg).padStart(10)+' '+
    (e.ttk===Infinity?'inf':e.ttk.toFixed(1)).padStart(7)+' '+
    String(e.stage).padStart(4)+' '+
    String(e.kills).padStart(4)
  );
}
// run0 の quota/total 比を代表時刻で(ユーザー目標: 1分経過時点でノルマ≥総クッキーの5割)
function ratioAt(sec){ let best=null; for(const e of tr){ if(e.el>=sec && e.c>0){ best=e; break; } } return best; }
console.log('\n[目標] run0 quota/total (>=50% @t=60):');
for (const sec of [60,75,90,120,150,180]){ const e=ratioAt(sec); if(e) console.log(`  t=${String(sec).padStart(3)}s: quota=${e.q.toFixed(0)} total=${e.c.toFixed(0)} 比=${(e.qRatio*100).toFixed(1)}%`); }
// 周回サマリ
const r0 = sim.runs[0];
if (r0) console.log(`run0 summary: dur=${(r0.duration/60).toFixed(2)}m stage=${r0.maxStage} kills=${r0.kills} quotaFailAt=${r0.quotaFailAt} firstEscapeAt=${r0.firstEscapeAt}  [目標: firstEscapeAt < quotaFailAt]`);
