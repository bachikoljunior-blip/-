// probe_crit: 低会心率カーブ(critHalf)×強烈会心(fingerCritBase)のグリッド
// 判定: ①fingerTechniqueのlift(全周回min・基準1.2)と、S2総クッキー(経済規模の変化)
const P = require('./params.js');
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const s2 = STRATEGIES.find(s => s.id === 'S2');
const R = P.res;
for (const [half, base] of [[1, 2.2], [8, 2.2], [8, 8], [12, 8], [12, 12], [16, 12], [16, 16]]) {
  R.critHalf = half; R.fingerCritBase = base;
  const sim = G.simulate(s2, { hours: 100, measure: true });
  const lifts = sim.runs.filter(r => !r.partial && r.measure && r.measure.lift && r.measure.lift['res:fingerTechnique'] != null)
    .map(r => r.measure.lift['res:fingerTechnique']);
  const min = lifts.length ? Math.min(...lifts).toFixed(3) : 'n/a';
  console.log(`critHalf=${half} critBase=${base} ①finger min lift=${min} (n=${lifts.length}) total=${sim.totalCookies.toExponential(2)} runs=${sim.runs.length}`);
}
