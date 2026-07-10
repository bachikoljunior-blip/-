// ③診断: 各報酬の期待値lift(instant)を全10方針で測り、方針ごとの中央値と最良中央値、
// および「幾何平均が1.00近傍に張り付く=飽和/utility候補」を洗い出す。使い捨て。
// 使い方: node diag_rw.js [hours]
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const hours = Number(process.argv[2] || 12);
const sims = {};
for (const s of STRATEGIES) sims[s.id] = G.simulate(s, { hours, measure: true });
function med(arr) { const a = arr.slice().sort((x, y) => x - y); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
function gm(arr) { return Math.exp(arr.reduce((a, b) => a + Math.log(b), 0) / arr.length); }
// reward -> pol -> [lifts]
const map = {};
for (const s of STRATEGIES) {
  const full = sims[s.id].runs.filter(r => !r.partial && r.measure);
  for (const r of full) for (const [k, v] of Object.entries(r.measure.lift)) {
    if (!k.startsWith('rw:')) continue;
    (map[k] = map[k] || {}); (map[k][s.id] = map[k][s.id] || []).push(v);
  }
}
let ok = 0;
const pool = G.REWARD_POOL.map(r => 'rw:' + r.id);
for (const k of pool) {
  const byPol = map[k] || {};
  let bestMed = 0, bestPol = null, bestGm = 0, n = 0;
  for (const [pol, arr] of Object.entries(byPol)) {
    const m = med(arr), g = gm(arr); n += arr.length;
    if (m > bestMed) { bestMed = m; bestPol = pol; }
    if (g > bestGm) bestGm = g;
  }
  const picked = Object.keys(byPol).length > 0;
  const pass = bestMed >= 1.1;
  if (pass) ok++;
  console.log(`${pass ? 'OK' : 'NG'} ${k.slice(3).padEnd(22)} 中央値=${bestMed.toFixed(3)}(${bestPol || '-'}) 最良幾何=${bestGm.toFixed(3)} ${picked ? '取得' + n + '回' : '未取得'}`);
}
console.log(`③(instant) ${ok}/${pool.length}`);
