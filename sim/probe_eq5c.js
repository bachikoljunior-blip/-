// 序盤の全着装イベント履歴: どの周回で何を着たか(全戦略・run0-5)+方針適合スコア
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const H = Number(process.argv[2] || 100);
for (const s of STRATEGIES) {
  const sim = G.simulate(s, { hours: H });
  const pol = { S1: 'balanced', S2: 'click', S3: 'golden', S4: 'hunt', S5: 'bake', S6: 'balanced', S7: 'bake', S8: 'bake', S9: 'hunt' }[s.id];
  for (let i = 0; i < Math.min(6, sim.runs.length); i++) {
    const r = sim.runs[i];
    const eq = r.eq2NewEquipped || [];
    if (eq.length) console.log(`${s.id}(${pol}) run${i}: ${eq.join(' ')}`);
  }
}
