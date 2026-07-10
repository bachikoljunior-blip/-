'use strict';
// ㉑診断: 各設備の初購入Δ生産チェックの全件(どの設備が・どの周回で・何倍足りないか)
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const H = Number(process.argv[2] || 100);
const only = process.argv[3] || '';
for (const s of STRATEGIES) {
  if (only && s.id !== only) continue;
  const sim = G.simulate(s, { hours: H });
  const rows = (sim.presenceChecks || []).map(c => {
    const ratio = c.ref > 0 ? (c.delta * 5) / c.ref : Infinity;
    return `${ratio >= 1 ? 'OK' : 'NG'} ${c.id.padEnd(18)} run${String(c.runIdx).padStart(2)} t=${(c.t / 60).toFixed(0)}m x${ratio.toFixed(2)} (Δ=${c.delta.toExponential(2)} 直前CPS=${c.ref.toExponential(2)})`;
  });
  console.log(`--- ${s.id} ${s.name} ---`);
  rows.forEach(x => console.log(x));
}
