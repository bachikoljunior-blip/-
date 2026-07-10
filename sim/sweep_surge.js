'use strict';
// upSurge(まとめ買い割増)のグリッド: T1(20分-2時間)への効果と副作用(④⑤/T3)を横断
// 使い方: node sweep_surge.js <hours> <SIDs comma>
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const hours = Number(process.argv[2] || 100);
const ids = (process.argv[3] || 'S3,S1,S8,S10').split(',');
const grid = [
  { perBuy: 0.40, halfSec: 95 },
  { perBuy: 0.36, halfSec: 110 },
  { perBuy: 0.45, halfSec: 75 },
  { perBuy: 0.32, halfSec: 130 }
];
for (const g of grid) {
  G.P.upSurge.perBuy = g.perBuy; G.P.upSurge.halfSec = g.halfSec;
  const out = [];
  for (const sid of ids) {
    const s = STRATEGIES.find(x => x.id === sid);
    const sim = G.simulate(s, { hours });
    const full = sim.runs.filter(r => !r.partial);
    let t1 = 0, x100 = 0, pt = 0, t3a = 0, t3b = 0, pairs = 0;
    for (let i = 0; i < full.length; i++) {
      const r = full[i];
      if (r.duration >= 1200 && r.duration <= 7200) t1++;
      if (r.quotaFailAt != null && r.quotaFailAt < r.duration) t3a++;
      if (r.quotaHold >= 0.5 * r.duration) t3b++;
      if (i > 0) {
        pairs++;
        if (r.runCookies >= 100 * full[i - 1].runCookies) x100++;
        if (r.gain >= full[i - 1].gain && r.gain <= 100 * full[i - 1].gain) pt++;
      }
    }
    const durs = full.map(r => r.duration / 60);
    const medDur = durs.slice().sort((a, b) => a - b)[durs.length >> 1];
    out.push(`${sid}: T1 ${t1}/${full.length} 中央${medDur.toFixed(0)}m ④${x100}/${pairs} ⑤${pt}/${pairs} T3a${t3a} T3b${t3b} 総=${sim.totalCookies.toExponential(1)}`);
  }
  console.log(`perBuy=${g.perBuy} halfSec=${g.halfSec}`);
  out.forEach(x => console.log('  ' + x));
}
