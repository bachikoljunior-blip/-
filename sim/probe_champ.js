// 自然カバレッジの天井プローブ: 各(カテゴリ,ティア)で方針ごとの最良色銘(argmax)を出し、
// 「誰かの最良になれる色銘」の総数=自然プレイの装着カバレッジ理論上限を数える。
const G = require('./sim.js');
const EQ2_UNIT = { cpsMul: 1, allMul: 1.2, clickMul: 0.9, dmgMul: 0.7, killValMul: 0.7, holdBonus: 0.8, goldenAmtMul: 0.9, goldenRateMul: 2.5, goldenBoostMul: 1.5, dropMul: 0.3, oreAdd: 0.1, rewardLvAdd: 0.2, critAdd: 6, upDisc: 3, resDisc: 3, spawnMul: 2, stayMul: 1, dropRateAdd: 0.05, dropLuck: 0.1 };
const EQ2_FAV = {
  bake: new Set(['cpsMul', 'allMul', 'holdBonus', 'upDisc', 'resDisc']),
  click: new Set(['clickMul', 'critAdd', 'allMul']),
  golden: new Set(['goldenAmtMul', 'goldenRateMul', 'goldenBoostMul', 'allMul']),
  hunt: new Set(['dmgMul', 'killValMul', 'rewardLvAdd', 'stayMul', 'spawnMul', 'allMul', 'oreAdd'])
};
const EQ2_CONDFREQ = { goldenBoost: 0.15, monster: 0.4, boss: 0.06, quotaHold: 0.8, deep: 0.3, buyUp: 0.12, buyRes: 0.10, runStart: 0.12 };
const rel = (pol, stat) => { if (stat === 'cpsMul' || stat === 'allMul') return 0.8; const f = EQ2_FAV[pol]; if (!f) return 0.7; return f.has(stat) ? 1 : 0.2; };
const FX = G.EQUIP2_FX_TABLE();
const CATS = ['weapon', 'shield', 'armorTop', 'armorBottom', 'hands', 'hat', 'shoes', 'accA', 'accB'];
const POLS = ['balanced', 'click', 'golden', 'hunt', 'bake'];
function score(pol, cat, v) {
  const def = FX[cat] && FX[cat][v - 1];
  if (!def) return 0;
  let s = 0;
  const u = def.up || [];
  for (let i = 0; i < u.length; i += 2) s += (EQ2_UNIT[u[i]] || 0.3) * u[i + 1] * rel(pol, u[i]);
  if (def.m === 'B' && def.down) for (let i = 0; i < def.down.length; i += 2) {
    const st = def.down[i], fav = EQ2_FAV[pol] && EQ2_FAV[pol].has(st);
    s -= (EQ2_UNIT[st] || 0.3) * (1 - def.down[i + 1]) * (fav ? 6 : (EQ2_FAV[pol] ? 0.3 : 1));
  }
  if (def.m === 'C') s *= (EQ2_CONDFREQ[def.cond] || 0.2);
  return s;
}
// argmaxはティア非依存(×1.5^tは全色銘一様)→カテゴリごとに方針別チャンピオンを見る
let champTotal = 0;
for (const cat of CATS) {
  const champ = {};
  for (const pol of POLS) {
    let best = -Infinity, bv = 0;
    for (let v = 1; v <= 9; v++) { const s = score(pol, cat, v); if (s > best) { best = s; bv = v; } }
    champ[pol] = bv;
  }
  const distinct = new Set(Object.values(champ)).size;
  champTotal += distinct;
  console.log(`${cat.padEnd(12)} ${POLS.map(p => p + '=v' + champ[p]).join(' ')} → ${distinct}色銘/9`);
}
console.log(`チャンピオン合計(方針が自然に選ぶ色銘の種類): ${champTotal}/81 → ティア6個×= 自然上限≈${champTotal * 6}/486`);
console.log('(実際は作成順・素材・ステージ経路の違いで同方針でも途中経過の品が着られる=上限より増える)');
