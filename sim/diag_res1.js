'use strict';
// ①診断: 指定研究の各周回lift(期待値方式)を方針別に一覧(どの方針のどの周回が下限割れか)
// 使い方: node diag_res1.js <hours> <researchId> [S2,S5]
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const hours = Number(process.argv[2] || 24);
const rid = process.argv[3] || 'bankClickDividend';
const only = (process.argv[4] || '').split(',').filter(Boolean);
const key = 'res:' + rid;
for (const s of STRATEGIES) {
  if (only.length && !only.includes(s.id)) continue;
  const sim = G.simulate(s, { hours, measure: true });
  const rows = [];
  for (const r of sim.runs) {
    if (r.partial || !r.measure || r.measure.lift[key] == null) continue; // lift記録あり=取得周回
    rows.push(`  run${String(r.idx).padStart(2)} lift=${r.measure.lift[key].toFixed(3)}${r.measure.lift[key] < 1.2 ? '  <-- NG' : ''}`);
  }
  if (rows.length) { console.log(`--- ${s.id} ${s.name} (${rows.length}周回取得)`); rows.forEach(x => console.log(x)); }
}
