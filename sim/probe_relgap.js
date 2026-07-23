'use strict';
// ㉚(解放間隔)+全解放+周回数を代表戦略で高速確認(fold-in再調整の反復用・2026-07-23)
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const ids = process.argv[2] ? process.argv[2].split(',') : ['S1', 'S2', 'S3', 'S4', 'S9'];
const hours = Number(process.argv[3] || 200);
const totalNodes = G.SKILL_NODES.length;
function fullUnlockT(sim) {
  const ev = sim.unlockEvents.filter(e => e.kind === 'skill').sort((a, b) => a.t - b.t);
  let n = 0;
  for (const e of ev) { n += e.n || 1; if (n >= totalNodes) return e.t; }
  return Infinity;
}
function fmtT(s) { if (!Number.isFinite(s)) return '未'; s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return (h ? h + 'h' : '') + m + 'm'; }
let okAll = 0, cnt = 0;
for (const id of ids) {
  const s = STRATEGIES.find(x => x.id === id); if (!s) continue;
  const sim = G.simulate(s, { hours });
  const ev = (sim.unlockEvents || []).slice().sort((a, b) => a.t - b.t);
  const moments = [];
  for (const e of ev) { if (!moments.length || e.t - moments[moments.length - 1] > 1e-9) moments.push(e.t); }
  const gaps = []; for (let i = 1; i < moments.length; i++) gaps.push(moments[i] - moments[i - 1]);
  const ok = gaps.filter(g => g >= 30).length;
  const ratio = gaps.length ? ok / gaps.length : 1;
  const pass = ratio >= 0.9;
  if (pass) okAll++; cnt++;
  const full = sim.runs.filter(r => !r.partial);
  const fT = fullUnlockT(sim);
  // 30秒未満の間隔の分布(どこで密集?最初/中盤/後半)
  const under = [];
  for (let i = 1; i < moments.length; i++) if (moments[i] - moments[i - 1] < 30) under.push(moments[i]);
  const early = under.filter(t => t < fT * 0.33).length, mid = under.filter(t => t >= fT * 0.33 && t < fT * 0.66).length, late = under.filter(t => t >= fT * 0.66).length;
  console.log(`${pass ? 'OK' : 'NG'} ${id} ≥30s:${ok}/${gaps.length}(${(ratio * 100).toFixed(1)}%) 全解放${fmtT(fT)} 周回${full.length} 総${sim.runs.reduce((a, r) => a + r.runCookies, 0).toExponential(1)} 密集[早${early}中${mid}後${late}]`);
}
console.log(`㉚(部分) ${okAll}/${cnt}`);
