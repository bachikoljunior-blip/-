'use strict';
// 転生コストの固定テーブル生成(2026-07-11 ユーザー仕様・確定形):
// 「最終的に完成した状態での測定で、その回の転生必要クッキー=その回で転生した時点の毎秒生産×500の
//  10のべき乗切り捨て」を、基準方針(S1 バランス効率型)の100hシミュレーションから焼き込む。
// 使い方: node build_prestige_table.js [hours=100] [SID=S1]
// 出力: prestige_costs.json(params.js が prestige.costTable として自動読込)
// 注意: 生成時は既存テーブルを外して動的式で走らせる(自己参照を避ける)。
const fs = require('fs');
const P = require('./params.js');
P.prestige.costTable = []; // 動的フォールバックで測定
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const hours = Number(process.argv[2] || 100);
const sid = process.argv[3] || 'S1';
const s = STRATEGIES.find(x => x.id === sid);
const sim = G.simulate(s, { hours });
const full = sim.runs.filter(r => !r.partial && r.prestigeCps != null);
const pow10 = v => Math.max(P.prestige.firstCost || 5e6, Math.pow(10, Math.floor(Math.log10(Math.max(1, v * (P.prestige.costCpsMul || 500))))));
const table = full.map(r => pow10(r.prestigeCps));
// 測定範囲を超えた周回ぶんの延長: 末尾10回の平均桁ステップで外挿(20回ぶん)
const digits = table.map(c => Math.round(Math.log10(c)));
const tail = digits.slice(-11);
let step = 1;
if (tail.length >= 2) step = Math.max(1, Math.round((tail[tail.length - 1] - tail[0]) / (tail.length - 1)));
let last = digits[digits.length - 1] || 7;
for (let i = 0; i < 20; i++) { last += step; if (last > 300) break; table.push(Math.pow(10, last)); }
fs.writeFileSync('./prestige_costs.json', JSON.stringify(table));
console.log(`prestige_costs.json: ${table.length}本(実測${full.length}回+外挿) 先頭:`, table.slice(0, 8).map(c => c.toExponential(0)).join(','), ' 桁ステップ外挿:', step);
