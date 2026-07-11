'use strict';
// 実績研究・スキル解放研究の固定コスト表の生成(2026-07-11 ユーザー指示「コストはゲーム内で固定して」):
// 10方針×指定時間を動的コスト(毎秒×costSec)で走らせ、各研究の「初回購入時に支払った額」の
// 方針間中央値を丸め規則(q5cost)で量子化して ms_costs.json に焼き込む。
// どの方針も買わなかった研究は表に載せない(ゲーム/シムは動的式へフォールバック)。
// 使い方: node build_ms_costs.js [hours=100]
const fs = require('fs');
const P = require('./params.js');
P.msResearch = { costTable: null }; // 生成時は動的で測定
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const hours = Number(process.argv[2] || 100);
const logs = {};
for (const s of STRATEGIES) {
  const sim = G.simulate(s, { hours });
  for (const [id, cost] of Object.entries(sim.msCostLog || {})) {
    (logs[id] = logs[id] || []).push(cost);
  }
  process.stdout.write(s.id + ' ');
}
console.log('');
const table = {};
for (const [id, arr] of Object.entries(logs)) {
  arr.sort((a, b) => a - b);
  const med = arr[arr.length >> 1];
  table[id] = G.q5cost(med);
}
fs.writeFileSync('./ms_costs.json', JSON.stringify(table));
console.log(`ms_costs.json: ${Object.keys(table).length}本を焼き込み(全${G.P ? '' : ''}研究のうち未購入ぶんは動的フォールバック)`);
