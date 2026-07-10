'use strict';
// ③utility「短い枝分かれ比べ」の高速診断。指定した報酬id(引数, カンマ区切り。既定=全12)について
// 各方針の取得周回サンプルから branch-off 中央値比を出す。judgeUtilityRewards と同じロジックの単体版。
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const ALL = ['monsterDamage', 'monsterStay', 'crackedFang', 'brandHunt', 'deepPursuit', 'chainPrep', 'huntFocus', 'biteRecovery', 'crushedMill', 'goldenBeastMutation', 'goldenChain', 'beastScent'];
const H = parseInt(process.argv[2] || '24', 10);
const ids = (process.argv[3] ? process.argv[3].split(',') : ALL);
const CAP = 1e9;
function med(a) { a = a.slice().sort((x, y) => x - y); const m = a.length >> 1; return a.length ? (a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2) : null; }
function sample(runs, k) { if (runs.length <= k) return runs; const out = [], st = (runs.length - 1) / (k - 1); for (let i = 0; i < k; i++) out.push(runs[Math.round(i * st)]); return out; }
const snapSim = {};
for (const s of STRATEGIES) snapSim[s.id] = G.simulate(s, { hours: H, snapshots: true });
let ok = 0;
for (const rid of ids) {
  let best = 0, bp = null, bn = 0, any = false;
  const users = STRATEGIES.map(s => {
    const sim = snapSim[s.id];
    const acq = sim.runs.filter(r => !r.partial && r.perks && r.perks[rid] > 0 && r.runCookies > 0 && r.duration > 0 && sim.snapshots[r.idx]);
    return { s, sim, acq };
  }).filter(x => x.acq.length > 0).sort((a, b) => b.acq.length - a.acq.length);
  for (const { s, sim, acq } of users) {
    any = true; const ratios = [];
    for (const optRun of sample(acq, 12)) {
      const off = G.replayRun(s, sim.snapshots[optRun.idx], { hours: H, disableReward: rid }, optRun.duration);
      if (off && off.runCookies > 0 && Number.isFinite(off.runCookies) && Number.isFinite(optRun.runCookies)) ratios.push(Math.min(CAP, optRun.runCookies / off.runCookies));
    }
    const m = ratios.length ? med(ratios) : null;
    if (m != null && m > best) { best = m; bp = s.id; bn = ratios.length; }
    if (best >= 1.1) break;
  }
  const pass = best >= 1.1; if (pass) ok++;
  console.log(`${pass ? 'OK' : 'NG'} ${rid.padEnd(20)} ${any ? `中央値比=${best.toFixed(3)} (${bp} n=${bn})` : '未取得'}`);
}
console.log(`③utility ${ok}/${ids.length}`);
