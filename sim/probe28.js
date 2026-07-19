// probe28b: 新会心経済(critHalf12/critBase8)下での㉘再校正
// (1) S2 click後半: satMaxLate グリッド (2) S6 balanced run2: kvM.balanced グリッド
const P = require('./params.js');
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const S2 = STRATEGIES.find(s => s.id === 'S2');
const S6 = STRATEGIES.find(s => s.id === 'S6');
const shares = (st) => {
  const r = G.simulate(st, { hours: 100, measure: true });
  return r.runs.filter(x => !x.partial && x.measure && x.measure.income).map(x => ({ idx: x.idx, i: x.measure.income }));
};
console.log('--- S2 (cBL, satL) ペアグリッド (run7/8含む後半全部≥25%狙い) ---');
for (const [cbl, satl] of [[55, 2800], [60, 2800], [65, 2800], [60, 3200]]) {
  P.tapDirect.clickBonusLate = cbl; P.tapDirect.satMaxLate = satl;
  const rows = shares(S2);
  console.log(`cBL=${cbl} satL=${satl}: ` + rows.slice(-5).map(x => `run${x.idx}=${(x.i.tap * 100).toFixed(1)}%`).join(' '));
}
