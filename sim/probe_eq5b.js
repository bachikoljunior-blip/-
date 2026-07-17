// 装備(a) NG5件の現経済での束lift先取り測定(該当周回だけreplay)
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const H = Number(process.argv[2] || 100);
const NG = ['shoes_t1_v1', 'accB_t1_v1', 'accB_t1_v3', 'weapon_t2_v1', 'shield_t2_v1'];
const ratios = {}; // id -> [ratio,...]
for (const s of STRATEGIES) {
  const sim = G.simulate(s, { hours: H, snapshots: true });
  for (const r of sim.runs) {
    if (r.partial || !(r.runCookies > 0) || !sim.snapshots[r.idx]) continue;
    const hits = (r.eq2NewEquipped || []).filter(id => NG.includes(id));
    if (!hits.length) continue;
    const off = G.replayRun(s, sim.snapshots[r.idx], { hours: H, noNewEquip: true }, r.duration);
    if (off && off.runCookies > 0 && Number.isFinite(off.runCookies)) {
      const ratio = r.runCookies / off.runCookies;
      console.log(`${s.id} run${r.idx} dur=${Math.round(r.duration)}s 束比=${ratio.toFixed(3)} 対象=[${hits.join(',')}]`);
      for (const id of hits) (ratios[id] || (ratios[id] = [])).push(ratio);
    }
  }
}
const med = a => { const b = [...a].sort((x, y) => x - y); return b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2; };
for (const [id, rs] of Object.entries(ratios)) {
  console.log(`${id}: 中央値=${med(rs).toFixed(3)} (n=${rs.length}) ${med(rs) >= 1.5 ? 'OK' : 'NG'}`);
}
