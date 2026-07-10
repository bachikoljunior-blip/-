// ㉘後半の設備押し上げ(第12次R続き): 任意パラメータ上書きで income 判定を速見する実験ツール。
// 使い方: node tune_r.js '<JSONオーバーライド>' [hours] [policies]
//   例: node tune_r.js '{"huntDirect":{"otherMul":0.15}}' 100 balanced,bake,click
// オーバーライドは params.js へ深いマージ(既存オブジェクトの指定キーだけ差し替え)。
// 出力は sweep_chain.js と同じ(㉘(a)+②改+前半/後半中央値+周回別)。採否は income100h+expect36h で最終判断。
const P = require('./params.js');
const ov = JSON.parse(process.argv[2] || '{}');
(function merge(dst, src) {
  for (const k of Object.keys(src)) {
    if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && dst[k] && typeof dst[k] === 'object') merge(dst[k], src[k]);
    else dst[k] = src[k];
  }
})(P, ov);
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
console.log(`=== override=${JSON.stringify(ov)} (${H}h) ===`);
let okAll = 0, allAll = 0, c2okA = 0, c2allA = 0;
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
  okAll += ok; allAll += all; c2okA += c2ok; c2allA += c2all;
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
console.log(`合計(㉘(a) ${POLS.join('+')}): ${okAll}/${allAll} ②改 ${c2okA}/${c2allA}`);
