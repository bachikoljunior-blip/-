'use strict';
// ㉘診断: S4(hunt)/S3(golden)の run27-36 で何が変わるか(スキル取得・周回長・perk投資・research)
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const H = Number(process.argv[2] || 24);
const sid = process.argv[3] || 'S4';
const s = STRATEGIES.find(x => x.id === sid);
const sim = G.simulate(s, { hours: H, measure: true });
for (const r of sim.runs) {
  if (r.partial) continue;
  const inc = r.measure && r.measure.income;
  const huntInv = (r.perks.monsterDamage||0)+(r.perks.crackedFang||0)+(r.perks.beastHeatFerment||0)+(r.perks.huntingCore||0);
  const goldInv = (r.perks.goldenAmount||0)+(r.perks.goldenPower||0)+(r.perks.goldenRate||0);
  const line = `run${String(r.idx).padStart(2)} dur=${(r.duration/60).toFixed(1)}m stage=${r.maxStage} kills=${r.kills} golden=${r.golden} huntInv=${huntInv} goldInv=${goldInv}`
    + ` res2=[${(r.stages2||[]).join(',')}]`
    + (inc ? ` inc(設${(inc.equip*100).toFixed(0)}/金${(inc.golden*100).toFixed(0)}/討${(inc.hunt*100).toFixed(0)}/タ${(inc.tap*100).toFixed(0)})` : '')
    + ` skills+${r.skillsBought}${r.skillIds && r.skillIds.length ? '=' + r.skillIds.join('+') : ''}`;
  console.log(line);
}
