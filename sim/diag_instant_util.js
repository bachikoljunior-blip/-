'use strict';
// ③utility報酬の「同一トラジェクトリ instant lift(中央値)」診断。
// 同じ opt 周回の各tickで、報酬効果を earningPower 計算内だけで一時オフして比を取る(_md 方式=③-a と同じ)。
// トラジェクトリを変えないので軌道に鈍い。状態書き込み型(monsterStay/chainPrep/huntFocus)は1.000に張り付く見込み。
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const UTIL = ['monsterDamage', 'monsterStay', 'crackedFang', 'brandHunt', 'deepPursuit', 'chainPrep', 'huntFocus', 'biteRecovery', 'crushedMill', 'goldenBeastMutation', 'goldenChain', 'beastScent'];
const H = parseInt(process.argv[2] || '24', 10);
const map = {};
for (const s of STRATEGIES) {
  const sim = G.simulate(s, { hours: H, measure: true });
  for (const r of sim.runs.filter(r => !r.partial && r.measure)) {
    for (const [k, v] of Object.entries(r.measure.lift)) {
      if (!k.startsWith('rw:')) continue;
      const id = k.slice(3); if (!UTIL.includes(id)) continue;
      (map[id] = map[id] || {}); (map[id][s.id] = map[id][s.id] || []).push(v);
    }
  }
}
function med(a) { a = a.slice().sort((x, y) => x - y); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
let ok = 0;
for (const id of UTIL) {
  const byPol = map[id] || {}; let best = 0, bp = null;
  for (const [pol, arr] of Object.entries(byPol)) { const mm = med(arr); if (mm > best) { best = mm; bp = pol; } }
  const pass = best >= 1.1; if (pass) ok++;
  console.log((pass ? 'OK ' : 'NG '), id.padEnd(20), bp ? `instant中央値=${best.toFixed(3)} (${bp})` : '未取得');
}
console.log(`instant合格 ${ok}/${UTIL.length}`);
