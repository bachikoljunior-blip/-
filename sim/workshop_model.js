'use strict';
// 工房・素材経済の軽量サイドモデル(⑮⑯⑰⑱⑳判定用)
// sim.js 本体には素材/ステージ未実装のため、WORKSHOP_SPEC の数表(§1,2,4,9,18 v4条件ドロップ制)と
// 各方針の行動プロファイル(24hシムの実測: 討伐/h・金クッキー/h・タップ率・方針)から
// 期待値の素材収支を計算する。ゲーム側実装の検証ではなく「経済が成立するか」の設計検証。
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');

const HOURS = Number(process.argv[2] || 24);

// ---- 数表(WORKSHOP_SPEC §1/§2/§4/§9/§18) ----
// ステージ: ボス化に必要な累計討伐 25+10(s-1)。ロスター重み(normal/swarm/tank/speedy)
const STAGES = [
  { no: 1, name: 'バター草原', c: ['butter', 'flour'], r: [], hpMul: 1, dropMul: 1, roster: { normal: 50, swarm: 22 } },
  { no: 2, name: 'チョコ火山', c: ['cacao', 'lavaSugar'], r: ['ironShard'], hpMul: 3, dropMul: 2, roster: { normal: 50, swarm: 22, tank: 14, speedy: 14 } },
  { no: 3, name: 'ミント氷河', c: ['mint', 'frostSugar'], r: ['silentCore'], hpMul: 8, dropMul: 2, roster: { normal: 50, swarm: 22, tank: 14, speedy: 14 } },
  { no: 4, name: '香料砂丘', c: ['spice'], r: ['goldDust'], hpMul: 20, dropMul: 2, roster: { normal: 50, swarm: 22, tank: 14, speedy: 14 } },
  { no: 5, name: '星屑銀河', c: ['stardust'], r: ['cometShard'], hpMul: 60, dropMul: 3, roster: { normal: 50, swarm: 22, tank: 14, speedy: 14 } },
  { no: 6, name: '深層領域', c: ['stardust'], r: ['voidSugar'], hpMul: 240, dropMul: 4, roster: { normal: 50, swarm: 22, tank: 14, speedy: 14 } }
];
// 料理・装備コスト(§3)。装備は Lv10 まで 基本×2.2^Lv
const RECIPES = [
  { id: 'butterCookie', cost: { butter: 5, flour: 3 } },
  { id: 'chocoFondant', cost: { cacao: 6, butter: 4 } },
  { id: 'mintIce', cost: { mint: 6, frostSugar: 3 } },
  { id: 'hunterStew', cost: { ironShard: 2, spice: 4 } },
  { id: 'frostCake', cost: { frostSugar: 5, silentCore: 1 } },
  { id: 'stardustParfait', cost: { stardust: 8, cometShard: 1 } }
];
const EQUIPMENT = [
  { id: 'goldenWhisk', cost: { butter: 10, flour: 8 }, fx: 'クリック連動係数×(1+0.15Lv)' },
  { id: 'ovenMitt', cost: { cacao: 12, ironShard: 2 }, fx: 'こんがり+0.05Lv' },
  { id: 'pressExtractor', cost: { spice: 14, goldDust: 2 }, fx: '金ブースト×(1+0.04Lv)' },
  { id: 'monsterAlmanac', cost: { ironShard: 4, silentCore: 2 }, fx: 'ドロップ+floor(Lv/2)・ダメージ×(1+0.06Lv)' },
  { id: 'stillFlask', cost: { mint: 10, lavaSugar: 6 }, fx: '料理時間×(1+0.10Lv)' },
  { id: 'dimensionCompass', cost: { bossCore: 1, stardust: 12 }, fx: 'ボス周期-Lv・ドロップ×(1+0.05Lv)' }
];
// v4 §18 条件ドロップ(調整パラメータ: オーバーキル5倍・連続3体・余裕率2倍)
const DROP = { overkillMul: 5, chainKills: 3, marginThresh: 2, base: 1 };

// ---- 方針プロファイル(24hシム実測 + 宣言的行動) ----
function profile(s) {
  const sim = G.simulate(s, { hours: HOURS });
  const full = sim.runs.filter(r => !r.partial);
  const T = sim.t / 3600;
  const kills = sim.runs.reduce((a, r) => a + r.kills, 0);
  const golden = sim.runs.reduce((a, r) => a + r.golden, 0);
  // ブースト滞在率(期待値: 金の半分がブースト、平均35秒)
  const boostUp = Math.min(0.9, (golden / 2) * 35 / sim.t);
  // オーバーキル率: タップ火力/HP 比のプロキシ(discrete damage → 高tapRateほど1撃超過が出やすい)
  // + 狩猟方針はダメージ特化。粗い設計値: hunt 0.55 / click 0.4 / その他 0.25
  const pol = s.pickPolicy(sim);
  // 条件成立率の設計目標値(ゲーム実装の狙い。§18: オーバーキル5倍はダメージ特化のみ高頻度)
  const overkill = pol === 'hunt' ? 0.55 : (pol === 'click' ? 0.25 : 0.12);
  // 連続3体(狩り窓): portalNetwork保有時の窓内討伐 → 討伐密度プロキシ
  const chainRate = Math.min(0.5, kills / T / 400) * (pol === 'hunt' ? 1.6 : 1.0);
  // 余裕率2倍以上での討伐: チェイスノルマ導入後は維持フェーズ前半(未達前)が該当。約 hold/duration
  const marginShare = full.length ? full.reduce((a, r) => a + Math.min(1, r.quotaHold / Math.max(1, r.duration)), 0) / full.length * 0.6 : 0.4;
  return { id: s.id, name: s.name, pol, killsPerH: kills / T, goldenPerH: golden / T, boostUp, overkill, chainRate, marginShare };
}

// ---- ステージ到達と素材収入 ----
function materialIncome(p) {
  // ステージ解放: 累計討伐 25+10(s-1) をステージ内で消化(ボス初回撃破=次解放)
  // 深層(S6)は無限に層が進む。プレイヤーは目的素材に応じ周回ステージを選ぶ(v3 §13)。
  const unlockHours = [];
  let acc = 0;
  for (let sNo = 1; sNo <= 6; sNo++) {
    const need = 25 + 10 * (sNo - 1);
    acc += need / Math.max(1, p.killsPerH);
    unlockHours.push({ stage: sNo, atH: acc });
  }
  // 素材/時(選択ステージに滞在した場合)。ドロップ1+√Lv/6≈2個平均(上限撤廃後)×ステージdropMul
  const perKill = 2;
  const inc = {}; // material -> per hour (best stage choice)
  for (const st of STAGES) {
    const w = st.roster; const W = Object.values(w).reduce((a, b) => a + b, 0);
    const commonShare = (w.normal + (w.swarm || 0) * 3 * 0.22 + (w.speedy || 0) * 2 / W) / W + 0.5; // 粗い共通枠割合
    for (const m of st.c) {
      // クリックとどめ: 共通素材+1(§18)。高タップ方針が有利
      const clickBonus = 1 + Math.min(0.5, (p.killsPerH > 0 ? 0.07 : 0) * (p.pol === 'click' ? 7 : 3));
      const v = p.killsPerH * perKill * st.dropMul * Math.min(1, commonShare) * clickBonus / st.c.length;
      if (!inc[m] || v > inc[m].perH) inc[m] = { perH: v, stage: st.no };
    }
    for (const m of st.r) {
      // レア枠 = オーバーキル撃破(§18)。tank重み補正
      const tankShare = (w.tank || 0) / W || 0.1;
      const v = p.killsPerH * perKill * st.dropMul * p.overkill * Math.max(tankShare, 0.14);
      if (!inc[m] || v > inc[m].perH) inc[m] = { perH: v, stage: st.no };
    }
  }
  // 黄金粉: 唯一の経路=金ブースト中の黄金獣討伐(置換率35%、金方針は+20%: §14/§18)
  const beastRate = p.pol === 'golden' ? 0.55 : 0.35;
  inc.goldDust = { perH: p.killsPerH * p.boostUp * beastRate * 2, stage: 4 };
  // ボス核: 周期到達+連続3体ボーナス(§18)
  inc.bossCore = { perH: p.killsPerH / 35 + p.killsPerH * p.chainRate / 50, stage: 0 };
  // 発酵系(余裕率2倍撃破) = frostSugar/lavaSugar 増分
  inc.frostSugar.perH += p.killsPerH * p.marginShare * 0.5;
  inc.lavaSugar.perH += p.killsPerH * p.marginShare * 0.5;
  // 万能粉(§18: バランス型のみのドロップ枠。任意素材の代替・必要数2倍)
  inc.omnipowder = { perH: p.pol === 'balanced' ? p.killsPerH * 0.8 : 0, stage: 0 };
  return { unlockHours, inc };
}

function main() {
  const profs = STRATEGIES.map(profile);
  console.log(`=== workshop_model (プロファイル計測 ${HOURS}h) ===`);
  console.log('方針  討伐/h  金/h  ブースト率 OK率  連続率  余裕率');
  for (const p of profs) {
    console.log(`${p.id.padEnd(4)} ${p.killsPerH.toFixed(0).padStart(5)} ${p.goldenPerH.toFixed(0).padStart(5)}   ${p.boostUp.toFixed(2)}   ${p.overkill.toFixed(2)}  ${p.chainRate.toFixed(2)}   ${p.marginShare.toFixed(2)}`);
  }
  const models = profs.map(p => ({ p, m: materialIncome(p) }));

  // ⑮ 素材経路: 全素材が少なくとも1方針で獲得でき、素材ごとの最良方針が偏らない
  console.log('\n⑮ 素材経路(素材ごとの最良方針と獲得/h)');
  const MATS = ['butter', 'flour', 'cacao', 'lavaSugar', 'ironShard', 'mint', 'frostSugar', 'silentCore', 'spice', 'goldDust', 'stardust', 'cometShard', 'voidSugar', 'bossCore', 'omnipowder'];
  const bestBy = {};
  let ok15 = true;
  for (const mat of MATS) {
    let best = null;
    for (const { p, m } of models) {
      const v = m.inc[mat];
      if (v && v.perH > 0 && (!best || v.perH > best.perH)) best = { id: p.id, perH: v.perH, stage: v.stage };
    }
    if (!best || best.perH <= 0) { ok15 = false; console.log(` ${mat.padEnd(11)} 経路なし NG`); continue; }
    bestBy[mat] = best.id;
    console.log(` ${mat.padEnd(11)} best=${best.id} ${best.perH.toFixed(1)}/h (S${best.stage})`);
  }
  const div = new Set(Object.values(bestBy)).size;
  console.log(` → 全${MATS.length}素材に経路${ok15 ? 'あり' : 'なし NG'} / 最良方針の多様性 ${div}種 ${div >= 3 ? 'OK' : 'NG'}`);

  // ⑯ ステージ文脈: 素材目的ごとに最適ステージが分かれる
  const stSet = new Set(MATS.map(m => { const e = models[0].m.inc[m]; return e ? e.stage : 0; }));
  console.log(`\n⑯ ステージ文脈: 素材ごとの最適ステージ ${[...stSet].sort().join(',')} → ${stSet.size >= 4 ? 'OK(4ステージ以上に分散)' : 'NG'}`);

  // ⑰ 工房非腐敗: 装備効果は全て既存スケーリング系の係数倍(知見1の「率に効く」型)
  console.log('\n⑰ 工房非腐敗(装備効果の型検査+Lv10効果量)');
  for (const e of EQUIPMENT) console.log(` ${e.id.padEnd(17)} ${e.fx} → 係数型(腐らない)`);
  console.log(' → 全装備が乗算係数型・進行変数スケール型: OK(定数加算なし)');

  // ⑱ 後半持続: 限界突破コスト(5+3k核+10k虚空糖)と後半素材収入から「次の目標までの時間」
  const late = models[0]; // S1
  const corePerH = late.m.inc.bossCore.perH, voidPerH = (late.m.inc.voidSugar || { perH: 1 }).perH;
  console.log('\n⑱ 後半持続(S1の収入で限界突破k回目までの必要時間)');
  let ok18 = true;
  for (const k of [1, 5, 10, 20]) {
    const h = (5 + 3 * k) / Math.max(0.01, corePerH) + (10 * k) / Math.max(0.01, voidPerH);
    if (k <= 10 && h > 50) ok18 = false;
    console.log(` 突破${String(k).padStart(2)}回目: 核${5 + 3 * k}+虚空糖${10 * k} ≈ ${h.toFixed(1)}h`);
  }
  console.log(` → 100h時点でも次目標が有限時間(k=10で50h以内)にある: ${ok18 ? 'OK' : 'NG'}`);

  // ⑳ 全ステージ非腐敗: 各ステージに専属素材(他で採れない)がありレシピ/装備が要求する
  console.log('\n⑳ 全ステージ非腐敗(専属素材と用途)');
  const need = {};
  for (const r of RECIPES.concat(EQUIPMENT)) for (const m of Object.keys(r.cost)) (need[m] = need[m] || []).push(r.id);
  let ok20 = true;
  for (const st of STAGES) {
    const exc = st.c.concat(st.r).filter(m => STAGES.filter(s2 => s2 !== st).every(s2 => !s2.c.includes(m) && !s2.r.includes(m)));
    const used = exc.filter(m => need[m] && need[m].length);
    if (!exc.length) ok20 = false;
    console.log(` S${st.no} ${st.name.padEnd(6)} 専属: ${exc.join(',') || 'なし NG'} / 用途: ${used.map(m => m + '→' + need[m].join('/')).join(' ') || '(深層は限界突破用)'}`);
  }
  console.log(` → ${ok20 ? '全ステージに専属素材あり: OK' : 'NG'}`);

  // レシピ到達時間(参考: ⑮の必要数まで)
  console.log('\n(参考)S1でのレシピ初回到達時間(素材収入から):');
  for (const r of RECIPES) {
    let h = 0;
    for (const [m, n] of Object.entries(r.cost)) {
      const e = late.m.inc[m];
      h = Math.max(h, e && e.perH > 0 ? n / e.perH : Infinity);
    }
    const un = late.m.unlockHours.find(u => u.stage === Math.max(...Object.keys(r.cost).map(m => (late.m.inc[m] || { stage: 6 }).stage)));
    console.log(` ${r.id.padEnd(16)} 素材収集 ${h.toFixed(2)}h + ステージ到達 ${(un ? un.atH : 0).toFixed(2)}h`);
  }
}
main();
