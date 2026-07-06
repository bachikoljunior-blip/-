'use strict';
// 第8次: 確定した定数・機構を exist の index.html に反映するパッチスクリプト
// 対象(計画7の指定): 転生PT式 / 設備・研究・スキルコスト(丸め規則込み) / 基礎生産 /
//                     帯域由来の定数(追跡ノルマの2段階化) / スキルツリー再配線+新コスト+新効果値
// 使い方: cd sim && node gen_html8.js  (../index.html を書き換える)
const fs = require('fs');
const path = require('path');
const G = require('./sim.js');
const P = require('./params.js');

const FILE = path.join(__dirname, '..', 'index.html');
let src = fs.readFileSync(FILE, 'utf8');
let fails = 0;
function rep(old, neu, label) {
  if (!src.includes(old)) { console.log('NOT FOUND:', label || old.slice(0, 70)); fails++; return; }
  src = src.split(old).join(neu);
}

// ---- 1. 丸め規則(有効数字3桁が5の倍数になるよう切り捨て)関数を挿入 ----
const Q5_FUNC = `
// 丸め規則(2026-07-06 確定): 有効数字3桁が5の倍数になるよう切り捨て+小数切り捨て
// (例: 123,456→120,000 / 94→90 / 768.72→765)。コスト・基礎生産・スキル倍率の内部値にも適用。
function q5round(v) {
  if (!(v > 0) || !Number.isFinite(v)) return v;
  const e = Math.floor(Math.log10(v));
  if (v >= 10) {
    const step = 5 * Math.pow(10, Math.max(0, e - 2));
    return Math.floor(v / step + 1e-9) * step;
  }
  const step = 5 * Math.pow(10, e - 2);
  return Math.floor(v / step + 1e-9) * step;
}
function q5cost(v) { return Math.max(1, Math.floor(q5round(v))); }
`;
rep('function costOf(u, ownedOverride) {', Q5_FUNC + '\nfunction costOf(u, ownedOverride) {', 'q5挿入');

// ---- 2. 転生PT式: gain = 11×(run/1e4)^0.075 ----
rep(`    2.6 * Math.pow(total / 10000, 0.13)`,
  `    11 * Math.pow(total / 10000, 0.075)`, '転生PT式');

// ---- 3. 設備コスト式: ownPow 0.25→0.27 / 膝 4700・1.5 → 2600・0.72 / 丸め規則 ----
rep(`  return Math.max(1, Math.floor(
    1100
    * Math.pow(u.base, 0.60)
    * Math.pow(u.growth, owned <= 4700 ? owned * 0.25 : 4700 * 0.25 + (owned - 4700) * 1.5)
    * upgradeDiscount()
  ));`,
  `  return q5cost(
    1100
    * Math.pow(u.base, 0.60)
    * Math.pow(u.growth, owned <= 2600 ? owned * 0.27 : 2600 * 0.27 + (owned - 2600) * 0.72)
    * upgradeDiscount()
  );`, '設備コスト式');

// ---- 4. 研究コスト・段階コストに丸め規則 ----
rep(`function researchCost(r) {
  return Math.floor(r.cost * researchDiscount());
}`,
  `function researchCost(r) {
  return q5cost(r.cost * researchDiscount());
}`, '研究コスト');

const mStage = src.match(/function researchStageCost\(r, stageNo\) \{\n([\s\S]*?)\n\}/);
if (mStage) {
  src = src.replace(mStage[0],
    `function researchStageCost(r, stageNo) {
  const mult = stageNo >= 3 ? 2250000 : 1500;
  return q5cost(r.cost * mult * researchDiscount());
}`);
} else { console.log('NOT FOUND: researchStageCost'); fails++; }

// ---- 5. 追跡ノルマの2段階帯域化(初転生まで120 / 初転生後1440) ----
rep(`state.chaseTheta = Math.max(0, Number(state.chaseTheta) || 0) || (1.0 / (0.02 * (120 + 8 * Math.sqrt(state.runStartPlaySec))));`,
  `state.chaseTheta = Math.max(0, Number(state.chaseTheta) || 0) || (1.0 / (0.02 * ((state.prestigeRuns > 0 ? 1440 : 120) + 8 * Math.sqrt(state.runStartPlaySec))));`, 'chaseTheta 正規化');
rep(`  state.chaseTheta = 1.0 / (0.02 * (120 + 8 * Math.sqrt(state.runStartPlaySec)));`,
  `  state.chaseTheta = 1.0 / (0.02 * ((state.prestigeRuns > 0 ? 1440 : 120) + 8 * Math.sqrt(state.runStartPlaySec)));`, 'chaseTheta 周回開始');
rep(`function chaseActivationSec() {
  return 0.5 * (120 + 8 * Math.sqrt(Math.max(0, state.runStartPlaySec || 0)));
}`,
  `function chaseActivationSec() {
  // 2段階帯域(2026-07-06確定): 初転生まで 120+8√x / 初転生後 1440+8√x
  return 0.5 * ((state.prestigeRuns > 0 ? 1440 : 120) + 8 * Math.sqrt(Math.max(0, state.runStartPlaySec || 0)));
}`, 'chase作動時刻');

// ---- 6. スキルツリー: 新コスト・再配線・新効果値(sim.js の確定値から生成) ----
G.buildSkillValues();
const V = G.buildSkillValues();
const fmtNum = n => {
  if (n >= 1e15) return n.toExponential(2);
  return String(n);
};
// 効果値→表示テキスト(何が伸びるかを先頭に)
function descFor(id, vals, oldDesc) {
  const parts = [];
  if (vals.click != null && vals.click >= 1) parts.push(`タップ生産 x${1 + vals.click}`);
  else if (vals.click != null) parts.push(`タップ生産 +${Math.round(vals.click * 100)}%`);
  if (vals.cps != null && vals.cps >= 1) parts.push(`毎秒生産 x${1 + vals.cps}`);
  else if (vals.cps != null) parts.push(`毎秒生産 +${Math.round(vals.cps * 100)}%`);
  if (vals.all != null && vals.all >= 1) parts.push(`全生産 x${1 + vals.all}`);
  else if (vals.all != null) parts.push(`全生産 +${Math.round(vals.all * 100)}%`);
  return parts;
}
// ゲーム側のノード行を正規表現で1行ずつ書き換え(cost / prereqs / 数値効果)
const gameNodeRe = /\{ id: "([a-zA-Z0-9_]+)", name: "([^"]+)", branchId: "[^"]+", cost: [0-9]+,/g;
let m2;
const simIds = new Set(G.SKILL_NODES.map(n => n.id));
const gameOnly = [];
while ((m2 = gameNodeRe.exec(src)) !== null) if (!simIds.has(m2[1])) gameOnly.push(m2[1]);

for (const n of G.SKILL_NODES) {
  const re = new RegExp(`(\\{ id: "${n.id}", name: "[^"]+", branchId: "[^"]+", cost: )([0-9]+)(,)`);
  if (!re.test(src)) { console.log('game node not found:', n.id); fails++; continue; }
  src = src.replace(re, `$1${G.skillCostOf(n)}$3`);
  // prereqs 差し替え
  const preRe = new RegExp(`(\\{ id: "${n.id}",[^\\n]*prereqs: )\\[[^\\]]*\\]`);
  if (preRe.test(src)) {
    src = src.replace(preRe, `$1[${n.prereqs.map(q => `"${q}"`).join(', ')}]`);
  } else { console.log('prereqs not found:', n.id); fails++; }
  // 数値効果(click/cps/all/その他fx系)の value を sim の確定値へ
  const vals = V[n.id] || {};
  const lineRe = new RegExp(`\\{ id: "${n.id}",[^\\n]*\\}`);
  const lm = src.match(lineRe);
  if (lm) {
    let line = lm[0];
    for (const [t, v] of Object.entries(vals)) {
      const evRe = new RegExp(`(\\{ type: "${t}"(?:, target: "[^"]*")?, value: )[-0-9.e+]+( \\})`);
      if (evRe.test(line)) line = line.replace(evRe, `$1${v}$2`);
    }
    src = src.replace(lm[0], line);
  }
}
// ゲーム専用ノード(工房・無限オーブン)のコスト位置を新はしごに追随
// workshop_1/2 = monster_1 の次ラング相当(HANDOFF 3-2-5)、endless_oven = start_2×0.35(QoL規則)
const c = id => G.skillCostOf(G.SKILL_BY_ID[id]);
const q5c = v => { const q = G.q5cost(v); return q; };
const wk1 = q5c(c('monster_1') * 1.57), wk2 = q5c(c('monster_1') * 1.57 * 1.57);
const eo = q5c(c('start_2') * 0.35);
src = src.replace(/(\{ id: "workshop_1",[^\n]*cost: )[0-9]+(,)/, `$1${wk1}$2`);
src = src.replace(/(\{ id: "workshop_2",[^\n]*cost: )[0-9]+(,)/, `$1${wk2}$2`);
src = src.replace(/(\{ id: "endless_oven",[^\n]*cost: )[0-9]+(,)/, `$1${eo}$2`);
console.log('game-only nodes:', gameOnly.join(','), `workshop_1=${wk1} workshop_2=${wk2} endless_oven=${eo}`);

// ---- 7. 説明文中の効果数値を新値に更新(情報量は変えない) ----
const DESC_FIX = [
  ['タップ生産 x19、金獲得量 +30%。', `タップ生産 x${1 + V.click_3.click}、金獲得量 +${Math.round(V.click_3.goldenAmount * 100)}%。`],
  ['タップ生産 +24%、全生産 x193。', `タップ生産 +${Math.round(V.click_4.click * 100)}%、全生産 x${1 + V.click_4.all}。`],
  ['毎秒生産 x13。', `毎秒生産 x${1 + V.auto_2.cps}。`],
  ['毎秒生産 x49、モンスターダメージ +60%。', `毎秒生産 x${1 + V.auto_3.cps}、モンスターダメージ +${Math.round(V.auto_3.monsterDamageSkill * 100)}%。`],
  ['毎秒生産 +24%、全生産 x769.7。', `毎秒生産 +${Math.round(V.auto_4.cps * 100)}%、全生産 x${1 + V.auto_4.all}。`],
  ['クッキー特異点を解放、全生産 x3075.9。', `クッキー特異点を解放、全生産 x${1 + V.upgrade_singularity.all}。`],
  ['全生産 x12300.5、タップ +20%、毎秒 +20%、報酬選択肢数の期待値 +80%。',
    `全生産 x${1 + V.master_final.all}、タップ +${Math.round(V.master_final.click * 100)}%、毎秒 +${Math.round(V.master_final.cps * 100)}%、報酬選択肢数の期待値 +${Math.round(V.master_final.rewardBonus * 100)}%。`],
  ['転生後に合計15,000,000クッキーから開始、放置上限 +4時間。',
    `転生後に合計${(750000 + V.start_2.startCookies).toLocaleString('en-US')}クッキーから開始、放置上限 +4時間。`]
];
for (const [o, nn] of DESC_FIX) rep(o, nn, 'desc: ' + o.slice(0, 22));

fs.writeFileSync(FILE, src);
console.log(fails === 0 ? 'ALL PATCHES APPLIED' : fails + ' patches FAILED');
