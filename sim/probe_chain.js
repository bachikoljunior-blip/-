// 装備(b)鎖プローブ: 各方針の担当レーン鎖(t→t+1の斜め)がティアアップ50%規則で着装可能かを全リンク検査
// リンク条件: score(t+1のlane変種) >= 0.5 × score(tのlane変種)。切れているリンクを列挙する。
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
// equip2Score相当をここで再実装(sim内部は非公開のため、同じ式で計算)
const EQ2_UNIT = { cpsMul: 1, allMul: 1.2, clickMul: 0.9, dmgMul: 0.7, killValMul: 0.7, holdBonus: 0.8, goldenAmtMul: 0.9, goldenRateMul: 2.5, goldenBoostMul: 1.5, dropMul: 0.3, oreAdd: 0.1, rewardLvAdd: 0.2, critAdd: 6, upDisc: 3, resDisc: 3, spawnMul: 2, stayMul: 1, dropRateAdd: 0.05, dropLuck: 0.1 };
const EQ2_FAV = {
  bake: new Set(['cpsMul', 'allMul', 'holdBonus', 'upDisc', 'resDisc']),
  click: new Set(['clickMul', 'critAdd', 'allMul']),
  golden: new Set(['goldenAmtMul', 'goldenRateMul', 'goldenBoostMul', 'allMul']),
  hunt: new Set(['dmgMul', 'killValMul', 'rewardLvAdd', 'stayMul', 'spawnMul', 'allMul', 'oreAdd'])
};
const EQ2_CONDFREQ = { goldenBoost: 0.15, monster: 0.4, boss: 0.06, quotaHold: 0.8, deep: 0.3, buyUp: 0.12, buyRes: 0.10, runStart: 0.12 };
const rel = (pol, stat) => { if (stat === 'cpsMul' || stat === 'allMul') return 0.8; const f = EQ2_FAV[pol]; if (!f) return 0.7; return f.has(stat) ? 1 : 0.2; };
const CATS = ['weapon', 'shield', 'armorTop', 'armorBottom', 'hands', 'hat', 'shoes', 'accA', 'accB'];
const FX = G.EQUIP2_FX_TABLE ? G.EQUIP2_FX_TABLE() : null;
if (!FX) { console.log('EQUIP2_FXがexportされていない → sim.jsにexport追加が必要'); process.exit(1); }
function score(pol, cat, variant, tier) {
  const def = FX[cat] && FX[cat][variant - 1];
  if (!def) return 0;
  const scale = Math.pow(1.5, tier - 1);
  let s = 0;
  const u = def.up || [];
  for (let i = 0; i < u.length; i += 2) s += (EQ2_UNIT[u[i]] || 0.3) * u[i + 1] * scale * rel(pol, u[i]);
  if (def.m === 'B' && def.down) for (let i = 0; i < def.down.length; i += 2) {
    const st = def.down[i], fav = EQ2_FAV[pol] && EQ2_FAV[pol].has(st);
    s -= (EQ2_UNIT[st] || 0.3) * (1 - def.down[i + 1]) * (fav ? 6 : (EQ2_FAV[pol] ? 0.3 : 1));
  }
  if (def.m === 'C') s *= (EQ2_CONDFREQ[def.cond] || 0.2);
  return s;
}
const POL = { S1: 'balanced', S2: 'click', S3: 'golden', S4: 'hunt', S5: 'bake', S6: 'balanced', S7: 'bake', S8: 'bake', S9: 'hunt' };
let broken = 0, total = 0;
for (let si = 0; si < 9; si++) {
  const sid = 'S' + (si + 1), pol = POL[sid];
  for (let ci = 0; ci < CATS.length; ci++) {
    const cat = CATS[ci];
    const laneOf = t => ((si + t + ci) % 9) + 1;
    for (let t = 1; t <= 5; t++) {
      const vA = laneOf(t), vB = laneOf(t + 1);
      const sA = score(pol, cat, vA, t), sB = score(pol, cat, vB, t + 1);
      total++;
      const ok = sB >= 0.5 * sA && sB > 0;
      if (!ok) { broken++; console.log(`${sid}(${pol}) ${cat}: t${t}_v${vA}(${sA.toFixed(3)}) → t${t + 1}_v${vB}(${sB.toFixed(3)}) 比=${sA > 0 ? (sB / sA).toFixed(2) : '-'} NG`); }
    }
  }
}
console.log(`切断リンク: ${broken}/${total}`);
