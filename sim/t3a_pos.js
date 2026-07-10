// 提案8(第12次H)検証: 方針別に T3a(未達が先)の件数と、未達位置(quotaFailAt/duration)の中央値を出す。
// 旧実測(絶対最高層基準)では速い方針=0/47、遅い方針=位置1%(頭)だった。相対化で位置が後半へ動くかを見る。
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const hours = Number(process.argv[3] || 100);
const only = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2] : null;
function med(a) { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; }
console.log('ID  名称           周回  T3a    未達位置中央値  位置分布(10分位のヒスト)  最高層中央値');
for (const s of STRATEGIES) {
  if (only && s.id !== only) continue;
  const sim = G.simulate(s, { hours });
  const full = sim.runs.filter(r => !r.partial);
  let ok = 0; const pos = []; const stages = [];
  const hist = new Array(10).fill(0);
  for (const r of full) {
    stages.push(r.maxStage);
    if (r.quotaFailAt != null && r.quotaFailAt < r.duration) {
      ok++;
      const p = r.quotaFailAt / r.duration;
      pos.push(p);
      hist[Math.min(9, Math.floor(p * 10))]++;
    }
  }
  const mp = med(pos);
  const histStr = hist.map(h => h).join(' ');
  console.log(
    `${s.id.padEnd(3)} ${s.name.padEnd(12)} ${String(full.length).padStart(3)}  ${String(ok).padStart(2)}/${String(full.length).padStart(2)}  ` +
    `${(mp == null ? '   -   ' : (mp * 100).toFixed(0).padStart(3) + '%   ')}      [${histStr}]   ${med(stages)}`
  );
}
