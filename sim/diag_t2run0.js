'use strict';
// T2第0回診断: run0の解放イベント列と間隔/帯域比(どこが疎か)
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const H = Number(process.argv[2] || 6);
const only = process.argv[3] || '';
for (const s of STRATEGIES) {
  if (only && s.id !== only) continue;
  const sim = G.simulate(s, { hours: H });
  const full = sim.runs.filter(r => !r.partial);
  const r0 = full[0];
  if (!r0) { console.log(`${s.id}: run0なし`); continue; }
  // runner.js mergeEventsByRun 相当: 同一秒统合
  const evs = sim.unlockEvents.filter(e => e.t < r0.endT).sort((a, b) => a.t - b.t);
  const merged = [];
  for (const e of evs) {
    if (merged.length && merged[merged.length - 1].t === e.t) { merged[merged.length - 1].ids.push(e.kind + ':' + e.id); continue; }
    merged.push({ t: e.t, ids: [e.kind + ':' + e.id] });
  }
  console.log(`--- ${s.id} ${s.name} run0 dur=${(r0.duration / 60).toFixed(1)}m events=${merged.length} ---`);
  const ratios = [];
  for (let i = 0; i < merged.length; i++) {
    const gap = i > 0 ? merged[i].t - merged[i - 1].t : null;
    const Y = 120 + 8 * Math.sqrt(merged[i].t);
    const ratio = gap != null ? gap / Y : null;
    if (ratio != null) ratios.push(ratio);
    console.log(`  t=${(merged[i].t / 60).toFixed(1).padStart(6)}m gap=${gap != null ? (gap / 60).toFixed(1).padStart(5) : '    -'}m 帯域=${(Y / 60).toFixed(1)}m 比=${ratio != null ? ratio.toFixed(2) : '-'}  ${merged[i].ids.join(',')}`);
  }
  ratios.sort((a, b) => a - b);
  const med = ratios.length ? ratios[Math.floor(ratios.length / 2)] : null;
  console.log(`  中央値=${med != null ? med.toFixed(2) : '-'} (要[0.5,1])`);
}
