// 装備(a) NG5件の診断: どの戦略・どの周回で装着され、同じ束に何が入っているか
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const H = Number(process.argv[2] || 100);
const NG = ['shoes_t1_v1', 'accB_t1_v1', 'accB_t1_v3', 'weapon_t2_v1', 'shield_t2_v1'];
for (const s of STRATEGIES) {
  const sim = G.simulate(s, { hours: H });
  for (let i = 0; i < sim.runs.length; i++) {
    const r = sim.runs[i];
    const eq = r.eq2NewEquipped || [];
    const hits = eq.filter(id => NG.includes(id));
    if (hits.length) {
      console.log(`${s.id} run${i} dur=${Math.round(r.duration || 0)}s NG束内=[${hits.join(',')}] 束全体(${eq.length}): ${eq.join(',')}`);
    }
  }
}
