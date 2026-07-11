'use strict';
// 転生必要クッキー(10のべき乗・初回含む)のチューナー(2026-07-11 ユーザー許可「周回時間の調整は
// 値段梯子もいいんだけど、必要転生クッキーは10のべきじょうで初回も含めて調整していい。実装方法は任せる」)。
// 各周回indexの必要量(桁)を、対象方針の周回時間の中央値がT1帯[20分, 2時間]に入るよう反復調整する:
//   短すぎ(<1200s)→+1桁(貯めるのに時間がかかる=周回が伸びる) / 長すぎ(>7200s)→−1桁。
// 桁は周回indexに対して単調非減少へ丸める(必要量が前の回より下がらない)。
// 使い方: node tune_prestige.js [iters=5] [hours=100] [SIDs=S1,S3,S4,S9]
// 出力: prestige_costs.json を上書き(sim/ゲーム共通の焼き込み表)
const fs = require('fs');
const P = require('./params.js');
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const iters = Number(process.argv[2] || 5);
const hours = Number(process.argv[3] || 100);
const sids = String(process.argv[4] || 'S1,S3,S4,S9').split(',');
let table = (P.prestige.costTable && P.prestige.costTable.slice()) || [];
if (!table.length) { console.log('prestige_costs.json がありません。先に build_prestige_table.js を実行'); process.exit(1); }
const exps = table.map(c => Math.round(Math.log10(c)));
const T1LO = 1200, T1HI = 7200;
for (let it = 0; it < iters; it++) {
  P.prestige.costTable = exps.map(e => Math.pow(10, e));
  const byIdx = [];
  let t1ok = 0, t1all = 0;
  for (const sid of sids) {
    const s = STRATEGIES.find(x => x.id === sid);
    const sim = G.simulate(s, { hours });
    const full = sim.runs.filter(r => !r.partial);
    full.forEach((r, i) => { (byIdx[i] = byIdx[i] || []).push(r.duration); });
    for (const r of full) { t1all++; if (r.duration >= T1LO && r.duration <= T1HI) t1ok++; }
  }
  let changed = 0;
  for (let i = 0; i < byIdx.length && i < exps.length; i++) {
    const a = byIdx[i].slice().sort((x, y) => x - y);
    const med = a[a.length >> 1];
    if (med < T1LO) { exps[i] += 1; changed++; }
    else if (med > T1HI) { exps[i] = Math.max(6, exps[i] - 1); changed++; }
  }
  // 単調非減少へ(必要量が前の回より下がらない)
  for (let i = 1; i < exps.length; i++) if (exps[i] < exps[i - 1]) exps[i] = exps[i - 1];
  console.log(`iter${it + 1}: T1 ${t1ok}/${t1all} (${Math.round(100 * t1ok / t1all)}%) 変更${changed}件 先頭桁: ${exps.slice(0, 10).join(',')}`);
  if (!changed) break;
}
fs.writeFileSync('./prestige_costs.json', JSON.stringify(exps.map(e => Math.pow(10, e))));
console.log('prestige_costs.json 上書き(桁列):', exps.join(','));
