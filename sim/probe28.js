// probe28: S2(click) run6-9のタップ収入の内訳診断(_incD)と多レバー感度
// タップシェア = tap0(生クリックclickEV) + tapD(タップ直送)。どちらが主成分かで効くレバーが決まる。
const P = require('./params.js');
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const s2 = STRATEGIES.find(s => s.id === 'S6');
const show = (tag) => {
  const r = G.simulate(s2, { hours: 100, measure: true, partsDetail: true });
  const rows = [];
  for (const run of r.runs) {
    if (run.partial || !run.measure || !run.measure.incomeDetail || !run.measure.income) continue;
    const d = run.measure.incomeDetail, n = 1, i = run.measure.income, m = 1;
    rows.push(`run${run.idx} 討伐${(i.hunt / m * 100).toFixed(1)}% [報酬${(d.killT / n * 100).toFixed(1)}% 直送${(d.huntD / n * 100).toFixed(1)}%] 金${(i.golden / m * 100).toFixed(1)}% タップ${(i.tap / m * 100).toFixed(1)}% 設備${(i.equip / m * 100).toFixed(1)}%`);
  }
  console.log(`=== ${tag} ===`);
  rows.slice(0, 6).forEach(x => console.log(x));
};
show('現状 kvM.balanced=' + P.monster.killValMul.balanced);
for (const v of [6.8, 7.0, 7.2]) { P.monster.killValMul.balanced = v; show('kvM.balanced=' + v); }
