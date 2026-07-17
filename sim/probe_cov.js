const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const H = Number(process.argv[2] || 100);
const equipped = new Set();
for (const s of STRATEGIES) {
  const sim = G.simulate(s, { hours: H });
  const mine = new Set();
  for (const r of sim.runs) for (const id of (r.eq2NewEquipped || [])) { equipped.add(id); mine.add(id); }
  console.log(`${s.id}: own=${mine.size} cum=${equipped.size} last=${((sim.runs.filter(r=>!r.partial).slice(-1)[0]||{}).runCookies||0).toExponential(1)}`);
}
console.log(`COVERAGE ${H}h: ${equipped.size}/486`);
