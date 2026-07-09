// 使い捨て診断: ⑬タイミング機能の whole-run lift を3方式で比較。
// (a) 現行=全周回の (runCookies/duration) 幾何平均比  (b) 総クッキー÷総時間 比(周回分割に頑健)
// (c) 取得周回以降の (runCookies/duration) 幾何平均比。 node diag_timing.js [hours]
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const H = Number(process.argv[2] || 24);
const FEATURES = [
  { key: 'wave', label: '観測ゆらぎ', stage: 'quantumProofing' },
  { key: 'bhCharge', label: '圧縮チャージ', stage: 'blackHoleCompression' },
  { key: 'mature', label: '熟成', stage: 'spiceBlend' },
  { key: 'huntExtend', label: '延長狩り', stage: 'portalNetwork' }
];
function fullRuns(sim, minIdx) {
  return sim.runs.filter(r => !r.partial && r.idx >= (minIdx || 0) && r.runCookies > 0 && r.duration > 0 && Number.isFinite(r.runCookies));
}
function geomeanPerRun(sim, minIdx) {
  const f = fullRuns(sim, minIdx); if (!f.length) return null;
  return Math.exp(f.reduce((a, r) => a + Math.log(r.runCookies / r.duration), 0) / f.length);
}
function totalRate(sim, minIdx) {
  const f = fullRuns(sim, minIdx); if (!f.length) return null;
  let c = 0, d = 0; for (const r of f) { c += r.runCookies; d += r.duration; } // 注: runCookiesは超大なので対数和が本来だが総和比の目安として
  return d > 0 ? c / d : null;
}
function firstStage2Idx(sim, rid) {
  let best = null;
  for (const r of sim.runs) { if (!r.partial && (r.stages2 || []).includes(rid)) { if (best === null || r.idx < best) best = r.idx; } }
  return best;
}
for (const f of FEATURES) {
  console.log(`\n=== ${f.label}(${f.stage} 段2) ===`);
  for (const s of STRATEGIES) {
    const opt = G.simulate(s, { hours: H });
    const idle = G.simulate(s, { hours: H, idleTiming: f.key });
    const idx0 = firstStage2Idx(opt, f.stage);
    if (idx0 === null) { console.log(`  ${s.id}: 段2未取得`); continue; }
    const a = geomeanPerRun(opt) && geomeanPerRun(idle) ? geomeanPerRun(opt) / geomeanPerRun(idle) : null;
    const c = geomeanPerRun(opt, idx0) && geomeanPerRun(idle, idx0) ? geomeanPerRun(opt, idx0) / geomeanPerRun(idle, idx0) : null;
    const nOpt = fullRuns(opt).length, nIdle = fullRuns(idle).length;
    const fmt = v => v == null ? '—' : v.toFixed(3);
    console.log(`  ${s.id.padEnd(4)} (a)全周回geomean=${fmt(a)}  (c)取得後geomean=${fmt(c)}  [周回数 opt=${nOpt} idle=${nIdle}, 取得idx=${idx0}]`);
  }
}
