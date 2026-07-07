// 深い周回で「クッキー vs ノルマ」の差(桁)を、最高層が前回天井を越える前後で見る。
// trial は既定(0.08/10)で測る=素の差を見たいので P はいじらない。
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const id = process.argv[2] || 'S1';
const runIdx = Number(process.argv[3] || 40);
const s = STRATEGIES.find(x => x.id === id);
const sim = G.simulate(s, { hours: 40, debugRunIdx: runIdx });
const tr = sim.debugTrace || [];
if (!tr.length) { console.log('no trace (runIdx too big?)'); process.exit(0); }
const ceil = tr[0].ceil;
const dur = tr[tr.length - 1].el;
console.log(`${id} run${runIdx}: 前回天井ceil=${ceil} 周回長=${Math.round(dur)}s 最終最高層=${tr[tr.length-1].ms}`);
console.log('el%   最高層  ノルマ log10  クッキー log10  余裕(桁)  越境?');
for (const p of tr) {
  const frac = p.el / dur;
  // 10%刻みで代表点だけ
  if (Math.round(frac * 100) % 10 !== 0) continue;
  const lc = p.c > 0 ? Math.log10(p.c) : -99;
  const lq = p.q > 0 ? Math.log10(p.q) : -99;
  const over = p.ms > ceil ? `越(+${p.ms - ceil})` : '';
  console.log(`${String(Math.round(frac*100)).padStart(3)}%  ${String(p.ms).padStart(5)}   ${lq.toFixed(1).padStart(8)}     ${lc.toFixed(1).padStart(8)}     ${(lc-lq).toFixed(1).padStart(6)}   ${over}`);
}
