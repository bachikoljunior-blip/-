// 頭クラスタ診断: 各失敗周回の idx/長さ/未達秒/位置%/その周回の denom(=前回長 or reachMinSec)を出し、
// 未達が「reach(=el≈ρ*×denom)」由来か「基礎ノルマ」由来かを推定する。
const P = require('./params.js');
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const id = process.argv[2] || 'S10';
const hours = Number(process.argv[3] || 60);
const s = STRATEGIES.find(x => x.id === id);
const sim = G.simulate(s, { hours });
const full = sim.runs.filter(r => !r.partial);
const rhoStar = Math.pow(1 / P.quota.reachCoef, 1 / P.quota.reachPow);
console.log(`${id}: reachMinSec=${P.quota.reachMinSec} ρ*=${rhoStar.toFixed(3)} 周回数=${full.length}`);
console.log('idx  長さ    未達秒  位置%  前回長   denom   reach予測秒  由来');
let prevDur = 0;
for (const r of full) {
  const denom = Math.max(prevDur, P.quota.reachMinSec);
  const reachSec = rhoStar * denom;
  const failAt = r.quotaFailAt;
  const pos = failAt != null ? (failAt / r.duration * 100).toFixed(0) : '-';
  let cause = '-';
  if (failAt != null && failAt < r.duration) {
    cause = Math.abs(failAt - reachSec) < 0.15 * reachSec ? 'reach' : (failAt < reachSec ? '基礎(早)' : 'その他');
  }
  const flag = (failAt != null && failAt < r.duration && (failAt / r.duration) < 0.4) ? ' <<頭' : '';
  console.log(`${String(r.idx).padStart(3)} ${String(Math.round(r.duration)).padStart(6)} ${String(failAt==null?'-':Math.round(failAt)).padStart(7)} ${String(pos).padStart(5)}  ${String(Math.round(prevDur)).padStart(6)} ${String(Math.round(denom)).padStart(6)} ${String(Math.round(reachSec)).padStart(9)}   ${cause}${flag}`);
  prevDur = r.duration;
}
