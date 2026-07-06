'use strict';
// rung_costs.json 更新後に、ゲーム(../index.html)のスキルコストだけを sim の確定値へ再同期する
const fs = require('fs');
const path = require('path');
const G = require('./sim.js');
const FILE = path.join(__dirname, '..', 'index.html');
let src = fs.readFileSync(FILE, 'utf8');
let changed = 0, bad = 0;
for (const n of G.SKILL_NODES) {
  const re = new RegExp(`(\\{ id: "${n.id}", name: "[^"]+", branchId: "[^"]+", cost: )([0-9]+)(,)`);
  const m = src.match(re);
  if (!m) { console.log('not found:', n.id); bad++; continue; }
  if (Number(m[2]) !== G.skillCostOf(n)) { src = src.replace(re, `$1${G.skillCostOf(n)}$3`); changed++; }
}
// ゲーム専用ノード(QoL規則で連動)
const c = id => G.skillCostOf(G.SKILL_BY_ID[id]);
const wk1 = G.q5cost(c('monster_1') * 1.57), wk2 = G.q5cost(c('monster_1') * 1.57 * 1.57);
const eo = G.q5cost(c('start_2') * 0.35);
src = src.replace(/(\{ id: "workshop_1",[^\n]*cost: )[0-9]+(,)/, `$1${wk1}$2`);
src = src.replace(/(\{ id: "workshop_2",[^\n]*cost: )[0-9]+(,)/, `$1${wk2}$2`);
src = src.replace(/(\{ id: "endless_oven",[^\n]*cost: )[0-9]+(,)/, `$1${eo}$2`);
fs.writeFileSync(FILE, src);
console.log(`resynced: ${changed} changed, ${bad} missing (workshop_1=${wk1} workshop_2=${wk2} endless_oven=${eo})`);
