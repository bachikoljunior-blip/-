'use strict';
// スキル解放研究(msk_/msk2_)の固定コストを「≥2倍間隔のティア階段」に焼き直す(2026-07-16 ユーザー指示
// 「スキル解放研究は全てコストが二倍以上違うこと」)。
// 背景: 旧・焼き込み表は全msk_を100に潰していた(スキルは転生直後=毎秒生産が低い時に解放されるため
//   コスト=max(100, cps×costSec)が下限100に張り付く)→全て同額=「二倍以上違う」に反する。
// 方針: スキル解放研究のコストはスキルの深さ(=はしごコスト順位)で6ティアに割り、隣接ティアは比3(≥2倍)。
//   同ティア内は同額(74スキル×2種を全て相互≥2倍にするのは天文学的桁になり非現実的=ティア階段が妥当解)。
//   msk2_(奥義)は対応msk_の1段上。深いスキルほど応用/奥義研究も高い=直感的な単調増加。
// 出力: ms_costs.json(sim用)と index.html の MS_COST_TABLE(ゲーム用)の msk_/msk2_ 値のみ差し替え。
//   他(ms_* 実績研究)の値・キー順序は一切変更しない。
const fs = require('fs');
const path = require('path');
const G = require('./sim.js');

// ティア階段(クッキー): 比3=隣接≥2倍。応用(msk_)は深さ0..5、奥義(msk2_)は常に1段上(=最大ティア6)。
// 7段用意することで、最深スキルでも 奥義(72900) > 応用(24300) を保ち「同一スキルの応用<奥義」を常に満たす。
const LADDER = [100, 300, 900, 2700, 8100, 24300, 72900];
const BASE_TIERS = 6; // 応用の割当は0..5の6段

// スキルを はしごコスト昇順で順位付け→6ティアに等分(cheapest群→ティア0)。
const nodes = G.SKILL_NODES.slice().sort((a, b) => G.skillCostOf(a) - G.skillCostOf(b));
const N = nodes.length;
const tierOf = {};
nodes.forEach((n, rank) => { tierOf[n.id] = Math.min(BASE_TIERS - 1, Math.floor(rank * BASE_TIERS / N)); });

function mskCost(id) {
  if (id.startsWith('msk2_')) {
    const sid = id.slice(5);
    const t = tierOf[sid]; if (t == null) return null;
    return LADDER[t + 1];   // 奥義=常に1段上(t max5 → +1=6)
  }
  if (id.startsWith('msk_')) {
    const sid = id.slice(4);
    const t = tierOf[sid]; if (t == null) return null;
    return LADDER[t];
  }
  return null;
}

// 1) ms_costs.json を差し替え
const jsonPath = path.join(__dirname, 'ms_costs.json');
const table = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
let n1 = 0;
for (const id of Object.keys(table)) {
  const c = mskCost(id);
  if (c != null) { table[id] = c; n1++; }
}
fs.writeFileSync(jsonPath, JSON.stringify(table));
console.log(`ms_costs.json: msk ${n1}本を階段コストに差し替え`);

// 2) index.html の MS_COST_TABLE を差し替え(既存行をパース→msk値のみ上書き→同順序で再直列化)
const htmlPath = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
const m = html.match(/const MS_COST_TABLE = (\{.*?\});/);
if (!m) throw new Error('MS_COST_TABLE not found in index.html');
const gt = JSON.parse(m[1]);
let n2 = 0;
for (const id of Object.keys(gt)) {
  const c = mskCost(id);
  if (c != null) { gt[id] = c; n2++; }
}
const newLine = 'const MS_COST_TABLE = ' + JSON.stringify(gt) + ';';
html = html.replace(m[0], newLine);
fs.writeFileSync(htmlPath, html);
console.log(`index.html MS_COST_TABLE: msk ${n2}本を階段コストに差し替え`);

// 3) 検証: 使われた distinct 値が全て ≥2倍間隔か
const used = new Set();
for (const id of Object.keys(table)) if (id.startsWith('msk')) used.add(table[id]);
const arr = [...used].sort((a, b) => a - b);
let ok = true;
for (let k = 1; k < arr.length; k++) if (arr[k] / arr[k - 1] < 2) { ok = false; console.log('VIOLATION', arr[k - 1], arr[k]); }
console.log('distinct msk cost tiers:', arr.join(', '), ok ? '=> ALL >=2x OK' : '=> HAS VIOLATION');
