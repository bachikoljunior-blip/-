'use strict';
// ⑬タイミングの枝分かれ比を機能・方針を絞って高速診断。
// node diag_t13.js [hours] [featureKey] [S4,S3,...]
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const FEATURES = { wave: 'quantumProofing', bhCharge: 'blackHoleCompression', mature: 'spiceBlend', huntExtend: 'portalNetwork' };
const H = parseInt(process.argv[2] || '24', 10);
const fkey = process.argv[3] || 'huntExtend';
const rid = FEATURES[fkey];
const only = process.argv[4] ? process.argv[4].split(',') : null;
const CAP = 1e9;
function med(a) { a = a.slice().sort((x, y) => x - y); const m = a.length >> 1; return a.length ? (a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2) : null; }
function sample(runs, k) { if (runs.length <= k) return runs; const out = [], st = (runs.length - 1) / (k - 1); for (let i = 0; i < k; i++) out.push(runs[Math.round(i * st)]); return out; }
for (const s of STRATEGIES) {
  if (only && !only.includes(s.id)) continue;
  const sim = G.simulate(s, { hours: H, snapshots: true });
  const acq = sim.runs.filter(r => !r.partial && (r.stages2 || []).includes(rid) && r.runCookies > 0 && r.duration > 0 && sim.snapshots[r.idx]);
  if (!acq.length) { console.log(s.id, '未取得'); continue; }
  const ratios = [];
  for (const optRun of sample(acq, 12)) {
    const idle = G.replayRun(s, sim.snapshots[optRun.idx], { hours: H, idleTiming: fkey }, optRun.duration);
    if (idle && idle.runCookies > 0 && Number.isFinite(idle.runCookies) && Number.isFinite(optRun.runCookies)) ratios.push(Math.min(CAP, optRun.runCookies / idle.runCookies));
  }
  const m = med(ratios);
  console.log(s.id, fkey, '中央値比=' + (m == null ? '-' : m.toFixed(3)), 'n=' + ratios.length, m != null && m >= 1.05 && m <= 2.0 ? '✓帯内' : '');
}
