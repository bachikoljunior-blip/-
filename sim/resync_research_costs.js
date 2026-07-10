'use strict';
// weave_costs.json 更新後に、ゲーム(../index.html)の研究コストと段階倍率を sim の確定値へ再同期する
const fs = require('fs');
const path = require('path');
const P = require('./params.js');
const G = require('./sim.js');
const FILE = path.join(__dirname, '..', 'index.html');
let src = fs.readFileSync(FILE, 'utf8');
let changed = 0;
for (const r of G.RESEARCH) {
  const cost = G.q5cost(P.resCost[r.id]);
  const re = new RegExp(`(\\{ id: "${r.id}", name: "[^"]+", cost: )([0-9]+)(,)`);
  const m = src.match(re);
  if (!m) { console.log('not found:', r.id); continue; }
  if (Number(m[2]) !== cost) { src = src.replace(re, `$1${cost}$3`); changed++; }
}
// 段階倍率(研究別): RESEARCH_STAGE_MULT テーブルを更新
const table = {};
for (const r of G.RESEARCH) {
  const each = P.resStageCostEach[r.id] || {};
  table[r.id] = { s2: each.s2 || P.resStageCost.s2, s3: each.s3 || P.resStageCost.s3 };
}
const tableSrc = 'const RESEARCH_STAGE_MULT = ' + JSON.stringify(table) + ';';
if (src.includes('const RESEARCH_STAGE_MULT = ')) {
  src = src.replace(/const RESEARCH_STAGE_MULT = \{[^;]*\};/, tableSrc);
} else {
  src = src.replace('function researchStageCost(r, stageNo) {',
    '// 段階コストの研究別倍率(値段割りD\'・sim weave_costs.json と同期)\n' + tableSrc + '\n\nfunction researchStageCost(r, stageNo) {');
}
src = src.replace(`function researchStageCost(r, stageNo) {
  const mult = stageNo >= 3 ? 2250000 : 1500;
  return q5cost(r.cost * mult * researchDiscount());
}`,
`function researchStageCost(r, stageNo) {
  const t = RESEARCH_STAGE_MULT[r.id] || { s2: 1500, s3: 2250000 };
  const mult = stageNo >= 3 ? t.s3 : t.s2;
  return q5cost(r.cost * mult * researchDiscount());
}`);
fs.writeFileSync(FILE, src);
console.log('research costs resynced:', changed, 'changed');
