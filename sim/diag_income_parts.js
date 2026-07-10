// ㉘後半の設備押し上げ(第12次R続き): 周回ごとの earningPower 項別内訳を実測する診断。
// 使い方: node diag_income_parts.js [hours] [S6]
// 4稼ぎ口シェアに加え、その中身(cps/タップ素点/各直送/金項/kill項)の周回平均シェアを出す。
// sim.js の opt.partsDetail(診断専用の細分計測)を使う。
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const H = Number(process.argv[2] || 100);
const SID = process.argv[3] || 'S6';
const s = STRATEGIES.find(x => x.id === SID);
if (!s) { console.error('strategy not found: ' + SID); process.exit(1); }
const sim0 = G.simulate(s, { hours: H, measure: true, partsDetail: true });
const full = sim0.runs.filter(r => !r.partial && r.measure && r.measure.income);
console.log(`=== ${SID} ${H}h 周回別: 4稼ぎ口シェアと項別内訳(周回平均%) ===`);
console.log(`  凡例: 設=cps+設直+銀 / 金=金項+金直 / 討=kill項+討直 / 打=タップ素点+タップ直`);
for (const r of full) {
  const i = r.measure.income;
  const d = r.measure.incomeDetail;
  const kps = r.duration > 0 ? ((r.kills || 0) / r.duration).toFixed(2) : '-';
  let line = `run${String(r.idx).padStart(2)} dur${String((r.duration / 60).toFixed(0)).padStart(3)}m kills${String(r.kills || 0).padStart(6)} kps${kps} ` +
    `設${(i.equip * 100).toFixed(0)}% 金${(i.golden * 100).toFixed(0)}% 討${(i.hunt * 100).toFixed(0)}% 打${(i.tap * 100).toFixed(0)}%`;
  if (d) line += ` | cps${(d.cps * 100).toFixed(1)} 設直${(d.eqD * 100).toFixed(1)} 銀${(d.bkD * 100).toFixed(1)} 金項${(d.gRate * 100).toFixed(1)} 金直${(d.gD * 100).toFixed(1)} kill${(d.killT * 100).toFixed(1)} 討直${(d.huntD * 100).toFixed(1)} 打素${(d.tap0 * 100).toFixed(1)} 打直${(d.tapD * 100).toFixed(1)}`;
  console.log(line);
}
