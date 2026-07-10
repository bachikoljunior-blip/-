// ㉘後半の設備押し上げ(第12次R続き): chain.prodCoef の削減グリッド。
// 使い方: node sweep_chain.js <prodCoef> [hours] [policies]
//   例: node sweep_chain.js 0.014 100 balanced,hunt,bake
// 出力: 方針ごとの㉘(a)合否 ok/all と ②改、周回ごとの4稼ぎ口シェア(前半/後半の中央値も)。
// 注意: prodCoefは③huntFocus(枝分かれ1.14)・⑫huntの1位周回・㉘hunt主役30%と綱引き
//       (HANDOFF 第12次R-7)。ここは㉘だけを速見する道具=採否は income100h+expect36h で最終判断。
const P = require('./params.js');
const pc = Number(process.argv[2]);
if (!(pc >= 0)) { console.error('usage: node sweep_chain.js <prodCoef> [hours] [policies]'); process.exit(1); }
P.chain.prodCoef = pc;
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const H = Number(process.argv[3] || 100);
const POLS = String(process.argv[4] || 'balanced,hunt,bake').split(',');
function med(a) { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; }
const ROLE_CHANNEL = { bake: 'equip', golden: 'golden', hunt: 'hunt', click: 'tap', balanced: null };
const ROLE_RESEARCH = {
  bake: ['ovenBatch', 'factoryNetwork', 'grandmaCrowd', 'moonGlobalYeast', 'galaxyAssembly', 'blackHoleCompression', 'quantumProofing', 'antimatterRecipe'],
  golden: ['spiceBlend'],
  hunt: ['portalNetwork', 'portalGlobalFold'],
  click: ['fingerTechnique', 'bankClickDividend'],
  balanced: null
};
const ALL_ROLE_RES = [...new Set(Object.values(ROLE_RESEARCH).filter(Boolean).flat())];
const reps = {};
for (const s of STRATEGIES) { let pol = null; try { pol = s.pickPolicy({ prestigeRuns: 1, runs: [], t: 0, run: {} }); } catch (e) { } if (pol && !reps[pol]) reps[pol] = s; }
console.log(`=== chain.prodCoef=${pc} (${H}h) ===`);
let okAll = 0, allAll = 0;
for (const pol of POLS) {
  const s = reps[pol];
  const sim = G.simulate(s, { hours: H, measure: true });
  const full = sim.runs.filter(r => !r.partial && r.measure && r.measure.income);
  let ok = 0, all = 0, c2ok = 0, c2all = 0;
  const perRun = [];
  for (const r of full) {
    const gateList = ROLE_RESEARCH[pol] || ALL_ROLE_RES;
    const gated = (r.researchBought || []).some(id => gateList.includes(id));
    const inc = r.measure.income;
    const shares = { equip: inc.equip, golden: inc.golden, hunt: inc.hunt, tap: inc.tap };
    const aPass = pol === 'balanced' ? Object.values(shares).every(v => v >= 0.10) : shares[ROLE_CHANNEL[pol]] >= 0.30;
    let c2 = true;
    if (gated && ROLE_CHANNEL[pol]) {
      const gl = ['equip', 'golden', 'hunt', 'tap'].map(k => 1 / Math.max(1e-6, 1 - Math.min(0.999, shares[k])));
      const gm = Math.exp(gl.reduce((a, b) => a + Math.log(b), 0) / gl.length);
      const spec = 1 / Math.max(1e-6, 1 - Math.min(0.999, shares[ROLE_CHANNEL[pol]]));
      c2 = spec >= gm / 1.5 && spec <= gm * 1.5;
      c2all++; if (c2) c2ok++;
    }
    if (gated) { all++; if (aPass) ok++; }
    perRun.push({ idx: r.idx, gated, shares, aPass, c2 });
  }
  okAll += ok; allAll += all;
  const gatedRuns = perRun.filter(x => x.gated);
  const half = Math.floor(gatedRuns.length / 2);
  const seg = (arr, k) => (med(arr.map(x => x.shares[k])) * 100).toFixed(0);
  const early = gatedRuns.slice(0, half), late = gatedRuns.slice(half);
  console.log(`${pol}(${s.id}) ㉘(a) ${ok}/${all} ②改 ${c2ok}/${c2all}` +
    (early.length ? ` | 前半中央値 設${seg(early, 'equip')} 金${seg(early, 'golden')} 討${seg(early, 'hunt')} 打${seg(early, 'tap')}` : '') +
    (late.length ? ` | 後半中央値 設${seg(late, 'equip')} 金${seg(late, 'golden')} 討${seg(late, 'hunt')} 打${seg(late, 'tap')}` : ''));
  for (const x of perRun) {
    console.log(`  run${String(x.idx).padStart(2)} ${x.gated ? '対象' : '  外'} 設${(x.shares.equip * 100).toFixed(0)}% 金${(x.shares.golden * 100).toFixed(0)}% 討${(x.shares.hunt * 100).toFixed(0)}% 打${(x.shares.tap * 100).toFixed(0)}%${x.gated ? ` (a)${x.aPass ? 'OK' : 'NG'} ②改${x.c2 ? 'OK' : 'NG'}` : ''}`);
  }
}
console.log(`合計(㉘(a) ${POLS.join('+')}): ${okAll}/${allAll}`);
