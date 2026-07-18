// probe28: S2(click) run6-9のタップ収入の内訳診断(_incD)と多レバー感度
// タップシェア = tap0(生クリックclickEV) + tapD(タップ直送)。どちらが主成分かで効くレバーが決まる。
const P = require('./params.js');
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const s2 = STRATEGIES.find(s => s.id === 'S2');
const show = (tag) => {
  const r = G.simulate(s2, { hours: 100, measure: true, partsDetail: true });
  const rows = [];
  for (const run of r.runs) {
    if (run.partial || !run.measure || !run.measure.incomeDetail || !run.measure.income) continue;
    const d = run.measure.incomeDetail, n = 1, i = run.measure.income, m = 1;
    rows.push(`run${run.idx} タップ${(i.tap / m * 100).toFixed(1)}% [生クリ${(d.tap0 / n * 100).toFixed(1)}% 直送${(d.tapD / n * 100).toFixed(1)}%] 設備${(i.equip / m * 100).toFixed(1)}% [cps${(d.cps / n * 100).toFixed(1)}% 設直${(d.eqD / n * 100).toFixed(1)}% 銀行${(d.bkD / n * 100).toFixed(1)}%]`);
  }
  console.log(`=== ${tag} ===`);
  rows.slice(-5).forEach(x => console.log(x));
};
for (const v of [2000, 2400, 3000]) { P.tapDirect.satMaxLate = v; show('satL=' + v); }
