'use strict';
// ⑨whole軸(利息/余熱)の枝分かれ比を高速診断。judgeStageWhole と同ロジック。
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const KEYS = process.argv[3] ? process.argv[3].split(',') : ['stage:bankClickDividend:2', 'stage:bankClickDividend:3', 'stage:fingerTechnique:3'];
const H = parseInt(process.argv[2] || '24', 10);
const CAP = 1e9;
function med(a) { a = a.slice().sort((x, y) => x - y); const m = a.length >> 1; return a.length ? (a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2) : null; }
function sample(runs, k) { if (runs.length <= k) return runs; const out = [], st = (runs.length - 1) / (k - 1); for (let i = 0; i < k; i++) out.push(runs[Math.round(i * st)]); return out; }
function held(r, key) { const p = key.split(':'); const arr = p[2] === '2' ? 'stages2' : 'stages3'; return (r[arr] || []).includes(p[1]); }
const snap = {};
for (const s of STRATEGIES) snap[s.id] = G.simulate(s, { hours: H, snapshots: true });
let ok = 0;
for (const key of KEYS) {
  const p = key.split(':'); const disableVal = p[1] + ':' + p[2];
  let best = 0, bp = null, bn = 0, any = false;
  const users = STRATEGIES.map(s => {
    const sim = snap[s.id];
    const acq = sim.runs.filter(r => !r.partial && held(r, key) && r.runCookies > 0 && r.duration > 0 && sim.snapshots[r.idx]);
    return { s, sim, acq };
  }).filter(x => x.acq.length > 0).sort((a, b) => b.acq.length - a.acq.length);
  for (const { s, sim, acq } of users) {
    any = true; const ratios = [];
    for (const optRun of sample(acq, 12)) {
      const off = G.replayRun(s, sim.snapshots[optRun.idx], { hours: H, disableStage: disableVal }, optRun.duration);
      if (off && off.runCookies > 0 && Number.isFinite(off.runCookies) && Number.isFinite(optRun.runCookies)) ratios.push(Math.min(CAP, optRun.runCookies / off.runCookies));
    }
    const m = ratios.length ? med(ratios) : null;
    if (m != null && m > best) { best = m; bp = s.id; bn = ratios.length; }
    if (best >= 1.05) break;
  }
  const pass = best >= 1.05; if (pass) ok++;
  console.log(`${pass ? 'OK' : 'NG'} ${key.padEnd(28)} ${any ? `中央値比=${best.toFixed(3)} (${bp} n=${bn})` : '未取得'}`);
}
console.log(`⑨whole ${ok}/${KEYS.length}`);
