// ⑫プローブ: 周回ごとの5方針稼ぎ力(_polPow)を出し、huntが1位にどれだけ届かないかを見る
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const H = Number(process.argv[2] || 100);
const only = process.argv[3] ? process.argv[3].split(',') : null;
const agg = {};
for (const s of STRATEGIES) {
  if (only && !only.includes(s.id)) continue;
  const sim = G.simulate(s, { hours: H, measure: true });
  for (let i = 0; i < sim.runs.length; i++) {
    const r = sim.runs[i];
    const pp = r.measure && r.measure.polPow;
    if (!pp) continue;
    const n = Object.keys(pp).length ? 1 : 0;
    if (!n) continue;
    const ent = Object.entries(pp).sort((a, b) => b[1] - a[1]);
    const best = ent[0];
    agg[best[0]] = (agg[best[0]] || 0) + 1;
    // hunt の順位とトップとの差(logの総和差)
    const hIdx = ent.findIndex(e => e[0] === 'hunt');
    const hV = pp.hunt;
    const gap = best[1] - (hV == null ? -Infinity : hV);
    // サンプル数の目安: _meas の n を借りる
    let samp = 0;
    if (r._inc) samp = r._inc.n;
    const perS = samp > 0 ? gap / samp : gap;
    console.log(`${s.id} run${i} pol=${r.policy} dur=${Math.round(r.duration||0)}s best=${best[0]} hunt#${hIdx + 1} gapLog=${gap.toFixed(1)} perSamp=${perS.toFixed(4)} top3=${ent.slice(0,3).map(e=>e[0]+':'+e[1].toFixed(0)).join(' ')}`);
  }
}
console.log('argmax分布: ' + Object.entries(agg).map(([k, v]) => k + '=' + v).join(' '));
