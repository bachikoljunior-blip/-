// utility軸の個別報酬だけを通し比較で測る(iterate用・使い捨て)。
// 使い方: node diag_util.js <hours> <rid1,rid2,...>
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const hours = Number(process.argv[2] || 24);
const ids = (process.argv[3] || 'chainPrep,huntFocus,beastScent,biteRecovery,crushedMill,goldenBeastMutation').split(',');
function firstAcqIdx(sim, rid) { let b = null; for (const r of sim.runs) if (!r.partial && r.perks && r.perks[rid] > 0) { if (b === null || r.idx < b) b = r.idx; } return b; }
function gmFrom(sim, minIdx) { const f = sim.runs.filter(r => !r.partial && r.idx >= minIdx && r.runCookies > 0 && r.duration > 0 && Number.isFinite(r.runCookies)); if (!f.length) return null; return Math.exp(f.reduce((a, r) => a + Math.log(r.runCookies / r.duration), 0) / f.length); }
const sims = {};
for (const s of STRATEGIES) sims[s.id] = G.simulate(s, { hours });
for (const rid of ids) {
  const rows = [];
  let best = 0, bestPol = null;
  for (const s of STRATEGIES) {
    const idx0 = firstAcqIdx(sims[s.id], rid);
    if (idx0 === null) continue;
    const optEff = gmFrom(sims[s.id], idx0);
    const dis = G.simulate(s, { hours, disableReward: rid });
    const disEff = gmFrom(dis, idx0);
    const lift = (optEff && disEff && disEff > 0) ? optEff / disEff : null;
    if (lift != null) { rows.push(`${s.id}=${lift.toFixed(3)}(idx0=${idx0},n=${sims[s.id].runs.filter(r => !r.partial && r.idx >= idx0).length})`); if (lift > best) { best = lift; bestPol = s.id; } }
  }
  console.log(`${best >= 1.1 ? 'OK' : 'NG'} ${rid.padEnd(20)} best=${best.toFixed(3)}(${bestPol || '-'})  ${rows.join(' ')}`);
}
