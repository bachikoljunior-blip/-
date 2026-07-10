'use strict';
// noveltyBoostのグリッド: T2第0回の中央値を全10方針で(4hシム=秒速)
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const grid = (process.argv[2] || '8,10,12,16').split(',').map(Number);
function run0med(s) {
  const sim = G.simulate(s, { hours: 4 });
  const r0 = sim.runs[0];
  if (!r0) return null;
  const raw = (sim.unlockEvents || []).filter(e => e.t < r0.endT).sort((a, b) => a.t - b.t);
  const ev = [];
  for (const e of raw) { const l = ev[ev.length - 1]; if (l && l.t === e.t) continue; ev.push(e); }
  const ratios = [];
  for (let i = 0; i + 1 < ev.length; i++) {
    const y = ev[i + 1].t - ev[i].t;
    ratios.push(y / (120 + 8 * Math.sqrt(ev[i + 1].t)));
  }
  if (!ratios.length) return null;
  ratios.sort((a, b) => a - b);
  return ratios[Math.floor(ratios.length / 2)];
}
for (const nv of grid) {
  G.P.noveltyBoost = nv;
  const out = STRATEGIES.map(s => `${s.id}=${(run0med(s) || 0).toFixed(2)}`);
  console.log(`nov=${nv}: ${out.join(' ')}`);
}
