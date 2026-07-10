// 第0回転生必要クッキーの再算定用診断: 各方針の「第0回(最初の転生)の所持クッキー(コスト控除前)」を測り、
// 全方針の最小値を切り捨てた10のべき乗を出す。node diag_prestige0.js [hours]
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const H = Number(process.argv[2] || 24);
const rows = [];
let min = Infinity;
for (const s of STRATEGIES) {
  const sim = G.simulate(s, { hours: H });
  const r0 = sim.runs.find(r => !r.partial && r.idx === 0);
  const onHand = r0 ? r0.prestigeCookies : null;
  const runC = r0 ? r0.runCookies : null;
  rows.push({ id: s.id, onHand, runC });
  if (onHand != null && onHand < min) min = onHand;
}
console.log('=== 第0回転生時の所持クッキー(コスト控除前) ===');
for (const x of rows) {
  console.log(`  ${x.id.padEnd(4)} 所持=${x.onHand == null ? '第0回転生せず' : x.onHand.toExponential(3)}  (runCookies=${x.runC == null ? '-' : x.runC.toExponential(3)})`);
}
if (Number.isFinite(min)) {
  const floorExp = Math.floor(Math.log10(min));
  console.log(`\n全方針の最小 所持クッキー = ${min.toExponential(4)}`);
  console.log(`切り捨てた10のべき乗 = 10^${floorExp} = ${Math.pow(10, floorExp).toExponential(2)}`);
  console.log(`1000万(10^7)以上か: ${floorExp >= 7 ? 'YES → costExp0 を ' + floorExp + ' にする' : 'NO → 変更なし(現状維持)'}`);
} else {
  console.log('第0回転生した方針がありません');
}
