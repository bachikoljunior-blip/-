// 効果値の最適化プローブ(R17): 9選好者のchampion割れ(カテゴリごとのargmax色銘の種類数)を最大化する
// 値の組を座標上昇で探索。制約: 現行値の×0.6〜×1.6(0.05刻み)・カテゴリ内(ステータス,値)一意。
// 出力: 提案値の差分リスト+期待champion数。simは走らせない(純計算・数秒)。
const G = require('./sim.js');
const EQ2_UNIT = { cpsMul: 1, allMul: 1.2, clickMul: 0.9, dmgMul: 0.7, killValMul: 0.7, holdBonus: 0.8, goldenAmtMul: 0.9, goldenRateMul: 2.5, goldenBoostMul: 1.5, dropMul: 0.3, oreAdd: 0.1, rewardLvAdd: 0.2, critAdd: 6, upDisc: 3, resDisc: 3, spawnMul: 2, stayMul: 1, dropRateAdd: 0.05, dropLuck: 0.1 };
const EQ2_FAV = {
  bake: new Set(['cpsMul', 'allMul', 'holdBonus', 'upDisc', 'resDisc']),
  click: new Set(['clickMul', 'critAdd', 'allMul']),
  golden: new Set(['goldenAmtMul', 'goldenRateMul', 'goldenBoostMul', 'allMul']),
  hunt: new Set(['dmgMul', 'killValMul', 'rewardLvAdd', 'stayMul', 'spawnMul', 'allMul', 'oreAdd'])
};
const CF = { goldenBoost: 0.15, monster: 0.4, boss: 0.06, quotaHold: 0.8, deep: 0.3, buyUp: 0.12, buyRes: 0.10, runStart: 0.12 };
const TASTES = {
  balanced: null, click: EQ2_FAV.click, golden: EQ2_FAV.golden, hunt: EQ2_FAV.hunt, bake: EQ2_FAV.bake,
  risk: { fav: new Set(['goldenAmtMul', 'goldenBoostMul', 'critAdd', 'dmgMul']), bA: 0.5, cM: 1 },
  situ: { fav: new Set(['dmgMul', 'critAdd', 'spawnMul', 'stayMul', 'killValMul']), bA: 6, cM: 3 },
  craft: { fav: new Set(['dropMul', 'dropRateAdd', 'dropLuck', 'oreAdd', 'resDisc', 'upDisc']), bA: 6, cM: 1 },
  thrift: { fav: new Set(['upDisc', 'resDisc', 'cpsMul', 'holdBonus']), bA: 10, cM: 0.5 }
};
const WHOS = Object.keys(TASTES);
const FX0 = G.EQUIP2_FX_TABLE();
// 作業コピー(upの値だけ動かす。downは代償=設計どおり固定)
const FX = JSON.parse(JSON.stringify(FX0, (k, v) => v instanceof Set ? undefined : v));
function scoreDef(who, def) {
  const t = TASTES[who]; const isTaste = t && t.fav && t.bA !== undefined;
  const fav = isTaste ? t.fav : t;
  const rel = st => { if (isTaste) { if (st === 'cpsMul' || st === 'allMul') return fav.has(st) ? 1 : 0.8; return fav.has(st) ? 1 : 0.2; } if (st === 'cpsMul' || st === 'allMul') return 0.8; if (!fav) return 0.7; return fav.has(st) ? 1 : 0.2; };
  let s = 0; const u = def.up || [];
  for (let i = 0; i < u.length; i += 2) s += (EQ2_UNIT[u[i]] || 0.3) * u[i + 1] * rel(u[i]);
  if (def.m === 'B' && def.down) for (let i = 0; i < def.down.length; i += 2) { const st = def.down[i]; const isFav = fav && fav.has(st); s -= (EQ2_UNIT[st] || 0.3) * (1 - def.down[i + 1]) * (isFav ? (isTaste ? t.bA : 6) : (fav ? 0.3 : 1)); }
  if (def.m === 'C') s *= Math.min(1, (CF[def.cond] || 0.2) * (isTaste ? t.cM : 1));
  return s;
}
function champCount(cat) {
  const seen = new Set();
  for (const who of WHOS) { let b = -1e9, bv = 0; for (let v = 1; v <= 9; v++) { const x = scoreDef(who, FX[cat][v - 1]); if (x > b) { b = x; bv = v; } } seen.add(bv); }
  return seen.size;
}
function totalChamp() { let t = 0; for (const cat of Object.keys(FX)) t += champCount(cat); return t; }
// 一意性: カテゴリ内で (stat,value) ペアが重複しない
function uniqueOk(cat) {
  const seen = new Set();
  for (const def of FX[cat]) { const u = def.up || []; for (let i = 0; i < u.length; i += 2) { const key = u[i] + ':' + u[i + 1].toFixed(3); if (seen.has(key)) return false; seen.add(key); } }
  return true;
}
// 座標上昇: 各(cat, v, upIdx)の値を×0.6..×1.6(0.05刻み)で振り、champion合計が最大の値を採る
const base = JSON.parse(JSON.stringify(FX));
let best = totalChamp();
console.log('開始champion:', best, '/81');
for (let pass = 0; pass < 4; pass++) {
  let improved = false;
  for (const cat of Object.keys(FX)) {
    for (let v = 1; v <= 9; v++) {
      const def = FX[cat][v - 1]; const u = def.up || [];
      for (let i = 0; i < u.length; i += 2) {
        const orig = base[cat][v - 1].up[i + 1];
        let bestVal = u[i + 1], bestScore = totalChamp();
        for (let m = 0.6; m <= 1.601; m += 0.05) {
          const cand = Math.round(orig * m * 1000) / 1000;
          u[i + 1] = cand;
          if (!uniqueOk(cat)) continue;
          const sc = totalChamp();
          if (sc > bestScore) { bestScore = sc; bestVal = cand; }
        }
        u[i + 1] = bestVal;
        if (bestScore > best) { best = bestScore; improved = true; }
      }
    }
  }
  console.log(`pass${pass}: champion=${best}/81`);
  if (!improved) break;
}
// 差分出力
console.log('=== 提案値(現行と違うものだけ) ===');
for (const cat of Object.keys(FX)) {
  for (let v = 1; v <= 9; v++) {
    const u = FX[cat][v - 1].up, u0 = base[cat][v - 1].up;
    for (let i = 0; i < u.length; i += 2) if (u[i + 1] !== u0[i + 1]) console.log(`${cat} v${v} ${u[i]}: ${u0[i + 1]} → ${u[i + 1]}`);
  }
}
for (const cat of Object.keys(FX)) {
  const champ = {};
  for (const who of WHOS) { let b = -1e9, bv = 0; for (let v = 1; v <= 9; v++) { const x = scoreDef(who, FX[cat][v - 1]); if (x > b) { b = x; bv = v; } } champ[who] = bv; }
  console.log(cat.padEnd(12), Object.entries(champ).map(([k, x]) => k + '=v' + x).join(' '));
}
