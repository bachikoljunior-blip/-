'use strict';
// クッキーゲーム 100時間プレイシミュレータ（期待値ベース・1秒刻み）
// ゲーム本体(HTML)の式を移植し、params.js の値だけで挙動が変わる。
const P = require('./params.js');

// ================= 静的データ =================
const UPGRADES = [
  { id: 'finger', type: 'click', value: 1, base: 0.0506, growth: 1.32 },
  { id: 'grandma', type: 'cps', value: 1, base: 40, growth: 1.30 },
  { id: 'oven', type: 'cps', value: 8, base: 520, growth: 1.35 },
  { id: 'factory', type: 'cps', value: 45, base: 7200, growth: 1.37 },
  { id: 'bank', type: 'cps', value: 260, base: 78000, growth: 1.39 },
  { id: 'spiceRack', type: 'cps', value: 780, base: 320000, growth: 1.40 },
  { id: 'portal', type: 'cps', value: 1600, base: 980000, growth: 1.41 },
  { id: 'moonBakery', type: 'cps', value: 9800, base: 12500000, growth: 1.43 },
  { id: 'timeOven', type: 'cps', value: 65000, base: 180000000, growth: 1.45 },
  { id: 'galaxyFactory', type: 'cps', value: 450000, base: 2800000000, growth: 1.47 },
  { id: 'blackHoleMixer', type: 'cps', value: 3300000, base: 46000000000, growth: 1.49 },
  { id: 'universeOven', type: 'cps', value: 26000000, base: 820000000000, growth: 1.51 },
  { id: 'godFinger', type: 'click', value: 2600000, base: 1500000000000, growth: 1.51 },
  { id: 'cookieSingularity', type: 'cps', value: 230000000, base: 16000000000000, growth: 1.53 },
  { id: 'quantumBakery', type: 'cps', value: 2100000000, base: 320000000000000, growth: 1.55 },
  { id: 'antimatterOven', type: 'cps', value: 22000000000, base: 7000000000000000, growth: 1.57 }
];
const UPIDX = {}; UPGRADES.forEach((u, i) => UPIDX[u.id] = i);
// 丸め規則: 設備の基礎毎秒生産を量子化(クリック「強い指」とおばあちゃんは1固定=ユーザー指定)
// ※現行の全valueは既に規則適合(8,45,260,…)。将来の調整値も自動で量子化されるようここで適用する。
//   q5 は module 後方で function 宣言(hoisting)されているためここから呼べる。
UPGRADES.forEach(u => { if (u.id !== 'finger' && u.id !== 'grandma') u.value = Math.max(1, Math.floor(q5(u.value))); });

const UPGRADE_UNLOCK_SKILLS = {
  moonBakery: 'upgrade_moon', timeOven: 'upgrade_time', galaxyFactory: 'upgrade_galaxy',
  blackHoleMixer: 'upgrade_blackhole', universeOven: 'upgrade_universe', godFinger: 'upgrade_godfinger',
  cookieSingularity: 'upgrade_singularity', quantumBakery: 'upgrade_quantum', antimatterOven: 'upgrade_antimatter'
};

const RESEARCH = [
  // 2026-07-06: 研究段1のスキルゲートを全廃。対応設備をその回で購入済みなら購入可能
  { id: 'fingerTechnique' }, { id: 'grandmaCrowd' }, { id: 'ovenBatch' },
  { id: 'factoryNetwork' }, { id: 'spiceBlend' }, { id: 'portalNetwork' },
  { id: 'bankClickDividend' }, { id: 'moonGlobalYeast' }, { id: 'portalGlobalFold' },
  { id: 'galaxyAssembly' }, { id: 'blackHoleCompression' }, { id: 'quantumProofing' },
  { id: 'antimatterRecipe' }
];

// ==== 段階式研究: 対応設備(その回で購入済みのみ表示/購入可)と段階解放スキル ====
const RES_EQUIP = {
  fingerTechnique: 'finger', grandmaCrowd: 'grandma', ovenBatch: 'oven',
  factoryNetwork: 'factory', spiceBlend: 'spiceRack', portalNetwork: 'portal',
  bankClickDividend: 'bank', moonGlobalYeast: 'moonBakery', portalGlobalFold: 'portal',
  galaxyAssembly: 'galaxyFactory', blackHoleCompression: 'blackHoleMixer',
  quantumProofing: 'quantumBakery', antimatterRecipe: 'antimatterOven'
};
const RES_STAGE2 = {
  fingerTechnique: 'click_2', grandmaCrowd: 'auto_2', ovenBatch: 'auto_3',
  factoryNetwork: 'auto_4', spiceBlend: 'golden_1', portalNetwork: 'monster_3',
  bankClickDividend: 'economy_2', moonGlobalYeast: 'upgrade_time', portalGlobalFold: 'upgrade_singularity',
  galaxyAssembly: 'upgrade_universe', blackHoleCompression: 'upgrade_singularity',
  quantumProofing: 'upgrade_antimatter', antimatterRecipe: 'research_analysis'
};
const RES_STAGE3 = {
  fingerTechnique: 'click_4', grandmaCrowd: 'auto_4', ovenBatch: 'bake_temperature',
  factoryNetwork: 'economy_2', spiceBlend: 'golden_3', portalNetwork: 'monster_4',
  bankClickDividend: 'economy_analysis', moonGlobalYeast: 'research_analysis', portalGlobalFold: 'master_final',
  galaxyAssembly: 'upgrade_singularity', blackHoleCompression: 'upgrade_quantum',
  quantumProofing: 'master_final', antimatterRecipe: 'master_final'
};

const REWARD_POOL = [
  { id: 'goldenRate', category: 'golden' },
  { id: 'goldenPower', category: 'golden' },
  { id: 'goldenAmount', category: 'golden' },
  { id: 'monsterDamage', category: 'hunt' },
  { id: 'monsterRate', category: 'hunt' },
  { id: 'monsterStay', category: 'hunt' },
  { id: 'goldenChain', category: 'golden', unlockSkill: 'unlock_reward_goldenChain' },
  { id: 'crackedFang', category: 'hunt', unlockSkill: 'unlock_reward_crackedFang' },
  { id: 'chainPrep', category: 'risk', unlockSkill: 'unlock_reward_chainPrep' },
  { id: 'huntFocus', category: 'risk', unlockSkill: 'unlock_reward_huntFocus' },
  { id: 'goldenTarget', category: 'golden', unlockSkill: 'unlock_reward_goldenTarget' },
  { id: 'goldenFirstHit', category: 'golden', unlockSkill: 'unlock_reward_goldenFirstHit' },
  { id: 'beastScent', category: 'golden', unlockSkill: 'unlock_reward_beastScent' },
  { id: 'beastHeatFerment', category: 'hunt', unlockSkill: 'unlock_reward_beastHeatFerment' },
  { id: 'biteRecovery', category: 'hunt', unlockSkill: 'unlock_reward_biteRecovery' },
  { id: 'crushedMill', category: 'equipment', unlockSkill: 'unlock_reward_crushedMill' },
  { id: 'huntingCore', category: 'hunt', unlockSkill: 'unlock_reward_huntingCore' },
  { id: 'brandHunt', category: 'hunt', unlockSkill: 'unlock_reward_brandHunt' },
  { id: 'deepPursuit', category: 'risk', unlockSkill: 'unlock_reward_deepPursuit' },
  { id: 'goldenBeastMutation', category: 'risk', unlockSkill: 'unlock_reward_goldenBeastMutation' }
];

// スキルツリー（id, cost=元値, prereqs, effects[type,target,value]）
const SKILL_NODES = [
  // 2026-07-06: 研究解放専用ノード10個(research_bank/factory/spice/moon/portal/galaxy/
  // blackhole/portalGlobal/quantum/antimatter)を削除し、後続は削除ノードの親へ配線替え。
  // 研究段1はスキルゲートなし(対応設備の購入のみ)。段2/3の解放スキルは変更なし。
  // 2026-07-06 第8次(⑲=隣接比≤10倍): 「終端への近道」辺を縦長に組み替え(ユーザー承認済みの範囲)。
  //  全辺の取得順ラング差≤5(比 1.57^5=9.53≤10)になるよう、遠距離辺を削除し直近ノードへ配線替え。
  //  QoLノード(0.35倍価格)はメインノードの子を持たない(安い親→高い子の辺比超過を防ぐ)。
  //  配線替え一覧(旧→新)は HANDOFF 6章の反映メモ参照。ノードの増減はなし。
  { id: 'core', cost: 40, prereqs: [], effects: [['unlockSystem', 'runPolicy']] },
  { id: 'click_1', cost: 40, prereqs: ['core'], effects: [['click', null, 0.06]] },
  { id: 'click_2', cost: 41, prereqs: ['click_1'], effects: [['click', null, 0.10]] },
  { id: 'click_3', cost: 43, prereqs: ['click_2', 'golden_2'], effects: [['click', null, 0.14], ['goldenAmount', null, 0.06]] },
  { id: 'click_4', cost: 58, prereqs: ['click_3', 'auto_4'], effects: [['click', null, 0.24], ['all', null, 0.02]] },
  { id: 'golden_1', cost: 41, prereqs: ['click_1'], effects: [['goldenRate', null, 0.04]] },
  { id: 'golden_2', cost: 43, prereqs: ['golden_1'], effects: [['goldenAmount', null, 0.15]] },
  { id: 'golden_3', cost: 47, prereqs: ['golden_2'], effects: [['goldenPower', null, 0.35]] },
  { id: 'golden_analysis', cost: 66, prereqs: ['golden_3'], effects: [['unlockSystem', 'goldenAnalysis']] },
  { id: 'golden_4', cost: 78, prereqs: ['golden_3'], effects: [['goldenRate', null, 0.08], ['goldenAmount', null, 0.25]] },
  { id: 'auto_1', cost: 40, prereqs: ['monster_1'], effects: [['cps', null, 0.06]] },
  { id: 'auto_2', cost: 41, prereqs: ['auto_1', 'monster_2'], effects: [['cps', null, 0.10]] },
  { id: 'auto_3', cost: 43, prereqs: ['auto_2', 'monster_2'], effects: [['cps', null, 0.14], ['monsterDamageSkill', null, 0.06]] },
  { id: 'auto_4', cost: 58, prereqs: ['auto_3'], effects: [['cps', null, 0.24], ['all', null, 0.02]] },
  { id: 'bake_temperature', cost: 69, prereqs: ['auto_3'], effects: [['unlockSystem', 'bakeTemperature']] },
  { id: 'monster_1', cost: 41, prereqs: ['golden_1'], effects: [['monsterRate', null, 0.04]] },
  { id: 'monster_2', cost: 43, prereqs: ['monster_1', 'golden_2'], effects: [['monsterDamageSkill', null, 0.16]] },
  { id: 'monster_3', cost: 47, prereqs: ['monster_2'], effects: [['monsterHpDown', null, 0.07]] },
  { id: 'hunt_analysis', cost: 69, prereqs: ['monster_3'], effects: [['unlockSystem', 'huntAnalysis']] },
  { id: 'monster_4', cost: 83, prereqs: ['monster_3', 'click_4'], effects: [['monsterStay', null, 0.10]] },
  { id: 'economy_1', cost: 41, prereqs: ['auto_1'], effects: [['upgradeDiscount', null, 0.02], ['researchDiscount', null, 0.02]] },
  { id: 'research_1', cost: 41, prereqs: ['economy_2'], effects: [['researchDiscount', null, 0.04]] },
  { id: 'research_remodel', cost: 44, prereqs: ['research_1'], effects: [['researchDiscount', null, 0.03], ['unlockSystem', 'researchRemodel']] },
  { id: 'economy_2', cost: 47, prereqs: ['economy_1'], effects: [['upgradeDiscount', null, 0.05]] },
  // 熟練(2026-07-06 ユーザー採用・第11次): スキルで解放。同じ設備を買うほど1台あたり生産が複利で伸びる
  { id: 'mastery_low', cost: 52, prereqs: ['economy_2'], effects: [['unlockSystem', 'masteryLow']] },
  { id: 'mastery_high', cost: 210, prereqs: ['mastery_low', 'upgrade_galaxy'], effects: [['unlockSystem', 'masteryHigh']] },
  { id: 'economy_analysis', cost: 62, prereqs: ['economy_2'], effects: [['unlockSystem', 'economyAnalysis']] },
  { id: 'order_board', cost: 86, prereqs: ['economy_analysis'], effects: [['unlockSystem', 'orderBoard']] },
  { id: 'upgrade_moon', cost: 52, prereqs: ['economy_2'], effects: [['unlockUpgrade', 'moonBakery']] },
  { id: 'upgrade_time', cost: 62, prereqs: ['upgrade_moon', 'research_remodel'], effects: [['unlockUpgrade', 'timeOven']] },
  { id: 'upgrade_galaxy', cost: 98, prereqs: ['upgrade_time', 'auto_4'], effects: [['unlockUpgrade', 'galaxyFactory']] },
  { id: 'upgrade_blackhole', cost: 187, prereqs: ['upgrade_galaxy'], effects: [['unlockUpgrade', 'blackHoleMixer']] },
  { id: 'research_analysis', cost: 222, prereqs: ['research_remodel'], effects: [['unlockSystem', 'researchAnalysis']] },
  { id: 'reward_1', cost: 159, prereqs: ['monster_4'], effects: [['rewardChoices', null, 1]] },
  { id: 'reward_synergy', cost: 213, prereqs: ['reward_1'], effects: [['unlockSystem', 'rewardSynergy']] },
  { id: 'reward_choice_2', cost: 357, prereqs: ['reward_synergy'], effects: [['rewardChoices', null, 1]] },
  { id: 'reward_2', cost: 238, prereqs: ['upgrade_singularity'], effects: [['upgradePerkPower', null, 0.15]] },
  { id: 'unlock_reward_crackedFang', cost: 107, prereqs: ['monster_4'], effects: [['unlockReward', 'crackedFang']] },
  { id: 'unlock_reward_chainPrep', cost: 141, prereqs: ['unlock_reward_crackedFang'], effects: [['unlockReward', 'chainPrep']] },
  { id: 'unlock_reward_huntFocus', cost: 189, prereqs: ['unlock_reward_crackedFang'], effects: [['unlockReward', 'huntFocus']] },
  { id: 'unlock_reward_biteRecovery', cost: 304, prereqs: ['unlock_reward_huntFocus'], effects: [['unlockReward', 'biteRecovery']] },
  { id: 'unlock_reward_beastHeatFerment', cost: 275, prereqs: ['unlock_reward_biteRecovery'], effects: [['unlockReward', 'beastHeatFerment']] },
  { id: 'unlock_reward_huntingCore', cost: 412, prereqs: ['unlock_reward_beastHeatFerment'], effects: [['unlockReward', 'huntingCore']] },
  { id: 'unlock_reward_brandHunt', cost: 472, prereqs: ['unlock_reward_biteRecovery'], effects: [['unlockReward', 'brandHunt']] },
  { id: 'unlock_reward_deepPursuit', cost: 808, prereqs: ['unlock_reward_huntingCore'], effects: [['unlockReward', 'deepPursuit']] },
  { id: 'unlock_reward_goldenChain', cost: 102, prereqs: ['golden_4', 'unlock_reward_crackedFang'], effects: [['unlockReward', 'goldenChain']] },
  { id: 'unlock_reward_goldenTarget', cost: 122, prereqs: ['unlock_reward_goldenChain'], effects: [['unlockReward', 'goldenTarget']] },
  { id: 'unlock_reward_goldenFirstHit', cost: 165, prereqs: ['unlock_reward_goldenTarget'], effects: [['unlockReward', 'goldenFirstHit']] },
  { id: 'unlock_reward_beastScent', cost: 174, prereqs: ['unlock_reward_goldenTarget'], effects: [['unlockReward', 'beastScent']] },
  { id: 'unlock_reward_goldenBeastMutation', cost: 1096, prereqs: ['unlock_reward_deepPursuit'], effects: [['unlockReward', 'goldenBeastMutation']] },
  { id: 'unlock_reward_crushedMill', cost: 357, prereqs: ['reward_2', 'unlock_reward_huntingCore'], effects: [['unlockReward', 'crushedMill']] },
  { id: 'start_1', cost: 139, prereqs: ['golden_4'], effects: [['startCookies', null, 50000]] },
  { id: 'offline_1', cost: 139, prereqs: ['auto_4'], effects: [['offlineHours', null, 4]] },
  { id: 'start_2', cost: 359, prereqs: ['start_1', 'offline_1'], effects: [['startCookies', null, 950000], ['offlineHours', null, 4]] },
  { id: 'upgrade_universe', cost: 359, prereqs: ['upgrade_blackhole'], effects: [['unlockUpgrade', 'universeOven']] },
  { id: 'upgrade_godfinger', cost: 748, prereqs: ['upgrade_universe'], effects: [['unlockUpgrade', 'godFinger']] },
  { id: 'upgrade_singularity', cost: 748, prereqs: ['upgrade_universe'], effects: [['unlockUpgrade', 'cookieSingularity'], ['all', null, 0.08]] },
  { id: 'upgrade_quantum', cost: 1279, prereqs: ['upgrade_singularity'], effects: [['unlockUpgrade', 'quantumBakery']] },
  { id: 'upgrade_antimatter', cost: 2518, prereqs: ['upgrade_quantum'], effects: [['unlockUpgrade', 'antimatterOven']] },
  { id: 'master_final', cost: 2440, prereqs: ['upgrade_antimatter', 'unlock_reward_goldenBeastMutation'], effects: [['all', null, 0.35], ['click', null, 0.20], ['cps', null, 0.20], ['rewardBonus', null, 0.10]] }
];
const SKILL_BY_ID = {}; SKILL_NODES.forEach(s => SKILL_BY_ID[s.id] = s);

// QoL/解析系ノード: 生産に直接効かないノードは「直前ラングのおまけ価格」
const UTILITY_SKILLS = new Set([
  'golden_analysis', 'hunt_analysis', 'economy_analysis', 'research_analysis',
  'order_board', 'bake_temperature', 'reward_synergy', 'reward_1', 'reward_choice_2',
  'start_1', 'offline_1', 'start_2'
]);
function isUtilitySkill(id) { return UTILITY_SKILLS.has(id); }

// スキルの想定取得順(前提条件を満たす手設計順)。数値ノード・解放ノードを均等に散らす。
const SKILL_HAND_ORDER = [
  // 2026-07-06 第8次 ⑲対応v3: 取得順(=コストはしご順)。全ツリー辺のメインラング差≤5。
  // 設備解放: 月面=r12(7種設備の壁dec40を跨ぐ前)、時空=r17、以降約3ラングごとに第16種(r40)まで。
  'core', 'click_1', 'golden_1', 'monster_1', 'auto_1', 'economy_1',
  'click_2', 'golden_2', 'monster_2', 'auto_2', 'economy_2',
  'mastery_low',
  'click_3', 'upgrade_moon', 'auto_3', 'research_1', 'research_remodel', 'economy_analysis', 'order_board',
  'golden_3', 'golden_analysis', 'upgrade_time', 'research_analysis', 'monster_3', 'hunt_analysis', 'bake_temperature',
  'auto_4', 'click_4', 'offline_1',
  'upgrade_galaxy', 'mastery_high', 'golden_4', 'start_1', 'monster_4', 'reward_1', 'reward_synergy', 'reward_choice_2', 'start_2',
  'upgrade_blackhole', 'unlock_reward_crackedFang', 'unlock_reward_goldenChain',
  'upgrade_universe', 'unlock_reward_chainPrep', 'unlock_reward_huntFocus',
  'upgrade_godfinger', 'unlock_reward_goldenTarget', 'upgrade_singularity',
  'unlock_reward_goldenFirstHit', 'unlock_reward_beastScent', 'reward_2',
  'upgrade_quantum', 'unlock_reward_biteRecovery', 'unlock_reward_beastHeatFerment',
  'unlock_reward_huntingCore', 'upgrade_antimatter', 'unlock_reward_brandHunt',
  'unlock_reward_crushedMill', 'unlock_reward_deepPursuit', 'unlock_reward_goldenBeastMutation',
  'master_final'
];

// スキルコスト(2026-07-06 第8次 ⑲対応):
// - メインノードは手設計順のはしご(rungCosts / C0×rho^k)
// - 全ツリー辺で cost(子) ≤ edgeCap(=10)×cost(親) にクランプ(⑲)。再配線済みのため通常は非発動。
// - 全コストは丸め規則(有効数字3桁=5の倍数切り捨て)を内部値にも適用
let SKILL_COST_MAP = null;
let SKILL_RANK = null;
let SKILL_RIDERS = null;
function trunc2sig(c) {
  if (!(c > 0)) return 1;
  if (c < 100) return Math.max(1, Math.floor(c));
  const d = Math.pow(10, Math.floor(Math.log10(c)) - 1);
  return Math.floor(c / d) * d;
}
// ==== 丸め規則(3-2 確定・2026-07-06): 有効数字3桁が5の倍数になるよう切り捨て ====
// 例: 123,456→120,000 / 94→90 / 768.72→765
// - 10以上: 刻み = 5×10^max(0, 桁数-3) で切り捨て(94→90 の例から最小刻みは5)+小数切り捨て
// - 10未満(スキル倍率効果値など): 有効数字3桁の刻み(5×10^(桁-3))で切り捨て(整数化はしない)
// - 対象: 設備/研究/スキルコスト・設備の基礎毎秒生産・スキル倍率効果値。工房素材コストは対象外。
function q5(v) {
  if (!(v > 0) || !Number.isFinite(v)) return v;
  const e = Math.floor(Math.log10(v));
  if (v >= 10) {
    const step = 5 * Math.pow(10, Math.max(0, e - 2));
    return Math.floor(v / step + 1e-9) * step;
  }
  const step = 5 * Math.pow(10, e - 2);
  return Math.floor(v / step + 1e-9) * step;
}
// コスト用(小数切り捨て・最低1)
function q5cost(v) { return Math.max(1, Math.floor(q5(v))); }
function buildSkillCosts() {
  if (SKILL_COST_MAP) return SKILL_COST_MAP;
  SKILL_COST_MAP = {};
  SKILL_RANK = {};
  SKILL_RIDERS = new Set();
  const have = {};
  if (SKILL_HAND_ORDER.length !== SKILL_NODES.length) throw new Error('order length mismatch');
  let rank = 0, rung = 0;
  let lastRungCost = P.skillCost.C0;
  for (const id of SKILL_HAND_ORDER) {
    const n = SKILL_BY_ID[id];
    if (!n) throw new Error('unknown node ' + id);
    if (!n.prereqs.every(q => have[q])) throw new Error('infeasible order at ' + id);
    SKILL_RANK[id] = rank++;
    if (isUtilitySkill(id)) {
      // QoLノードは「前提ノードのコスト」基準のおまけ価格(解放時点でほぼ即買い可能)
      const base = n.prereqs.length ? Math.max(...n.prereqs.map(q => SKILL_COST_MAP[q] || P.skillCost.C0)) : lastRungCost;
      SKILL_COST_MAP[id] = q5cost(base * (P.skillCost.utilRatio || 0.35));
    } else {
      let tentative;
      if (P.skillCost.rungCosts && P.skillCost.rungCosts[rung] != null) {
        tentative = P.skillCost.rungCosts[rung];
      } else if (rung === 0) {
        tentative = P.skillCost.C0;
      } else {
        tentative = lastRungCost * (P.skillCost.rho || 4);
      }
      // ⑲改(2026-07-06 ユーザー承認・第9次): 「各ノードは少なくとも1本、コスト比10倍以内の辺で
      // 結ばれていればよい」へ変更。辺ごとのクランプは廃止(はしごコストがそのまま立つ・ライダーなし)。
      // 検証は runner.js の check19(⑲改判定)。関連効果どうしを結ぶ遠距離辺は距離自由。
      lastRungCost = tentative;
      rung++;
      SKILL_COST_MAP[id] = q5cost(tentative); // 丸め規則(有効数字3桁=5の倍数)を内部値にも適用
    }
    have[id] = true;
  }
  return SKILL_COST_MAP;
}
function skillRiders() { buildSkillCosts(); return SKILL_RIDERS; }
function skillRank(id) {
  buildSkillCosts();
  return SKILL_RANK[id];
}
function skillCostOf(node) {
  return buildSkillCosts()[node.id];
}

// ==== スキル効果値の再割り当て ====
// 生産系数値ノード(click/cps/all)には、取得順に「取るたび生産が約M倍」になる幾何級数値を割り当てる。
// その他の数値効果は fx タイプ倍率で従来値をスケール。
let SKILL_VALUES = null; // id -> {type -> value}
function buildSkillValues() {
  if (SKILL_VALUES) return SKILL_VALUES;
  SKILL_VALUES = {};
  const order = SKILL_NODES.slice().sort((a, b) => skillRank(a.id) - skillRank(b.id));
  let Sall = 0, Scps = 0, Sclick = 0;
  const Mall = P.nodeM ? P.nodeM.all : 2.5;
  const Mcps = P.nodeM ? P.nodeM.cps : 2.5;
  const Mclick = P.nodeM ? P.nodeM.click : 2.2;
  for (const n of order) {
    const vals = {};
    const types = n.effects.map(e => e[0]);
    const hasAll = types.includes('all');
    const hasCps = types.includes('cps');
    const hasClick = types.includes('click');
    for (const e of n.effects) {
      const t = e[0];
      if (typeof e[2] !== 'number') continue;
      if (t === 'all' && hasAll) {
        const v = q5((Mall - 1) * (1 + Scps + Sall)); // 丸め規則: スキル倍率効果値も量子化(内部値=表示値)
        vals.all = (vals.all || 0) + v;
        Sall += v;
      } else if (t === 'cps' && !hasAll) {
        const v = q5((Mcps - 1) * (1 + Scps + Sall));
        vals.cps = (vals.cps || 0) + v;
        Scps += v;
      } else if (t === 'click' && !hasAll) {
        const v = q5((Mclick - 1) * (1 + Sclick + Sall));
        vals.click = (vals.click || 0) + v;
        Sclick += v;
      } else if (t === 'cps' || t === 'click') {
        // allと同居する副次効果は元値のまま(allが主軸)
        const v = q5(e[2]);
        vals[t] = (vals[t] || 0) + v;
        if (t === 'cps') Scps += v; else Sclick += v;
      } else {
        const scale = P.fx[t] != null ? P.fx[t] : 1;
        vals[t] = (vals[t] || 0) + q5(e[2] * scale);
      }
    }
    SKILL_VALUES[n.id] = vals;
  }
  return SKILL_VALUES;
}
// ==== 2段階帯域(⑥⑦ 2026-07-06 ユーザー承認で更新): 初転生まで Y=120+8√x、初転生後 Y=1440+3√x ====
// (第10次: 初転生後の伸びの係数 8→3。24分スタートは維持)
function bandY(prestiged, x) { return prestiged ? 1440 + 3 * Math.sqrt(Math.max(0, x)) : 120 + 8 * Math.sqrt(Math.max(0, x)); }

function lg(level, rate) { return Math.pow(1 + Math.max(0, rate), Math.max(0, level)); }
// 2026-07-05 キャップ全撤廃: 所有数上限(ownCap)は撤廃(負値ガードのみ)
function capOwn(n) { return Math.max(0, n); }
function ir(level, rate) { return Math.pow(1 - Math.min(0.95, Math.max(0, rate)), Math.max(0, level)); }
// 報酬Lvの逓減: lvが大きいほど1Lvあたりの寄与が下がる(halfで半減)
function satLv(lv, half) { lv = Math.max(0, lv); return lv / (1 + lv / Math.max(1, half)); }
// ⑬タイミング: 完全放置モードの判定。idleTiming が対象キーそのもの、または全機能放置 'all' のとき真。
// 'all' は提案5(2026-07-07 承認)の全体比較用: 全タイミング機能を1本の放置ランで同時に無効化する。
function idleOn(sim, key) { const it = sim.opt.idleTiming; return it === key || it === 'all'; }

// ================= シミュレーション状態 =================
function newSim(strategy, opts) {
  return {
    strat: strategy,
    opt: Object.assign({ disableResearch: null, disableReward: null, disableStage: null, disableUpgrade: null, disableAffinity: false, idleTiming: null, trackGain: false, hours: 100 }, opts || {}),
    t: 0,                       // 総経過秒
    // 永続
    prestige: 0, prestigeTotal: 0, prestigeRuns: 0, totalCookies: 0,
    prevMaxStage: 0,            // 提案8: 前回周回の最高到達層(=再登坂の天井)。層の試練を新規開拓層基準へ相対化するのに使う。層数の表示・カウント(run.maxStage)は絶対累積のまま不変更。
    prevDuration: 0,            // 提案9(到達連動ノルマ): 前回周回の長さ(秒)。未達判定の進行比 ρ=経過秒/前回長 の分母。
    durations: [],              // 提案10: 過去周回の長さ履歴(秒)。reach の分母を直近K周回の移動中央値にする。
    skills: {},
    everUpgrade: {}, everResearch: {}, everStage: {},
    unlockEvents: [],           // {t, kind, id}
    firstResearchBuy: {}, firstPerk: {}, firstStageBuy: {},
    runs: [],                   // 各周回の結果
    // 周回内
    run: null,
    rotIdx: 0, upRotIdx: 0, goldenAlt: 0,
    _fx: {}, _fxHas: {}, _stT: -1, _stV: 1, _bkT: -1, _bkV: null
  };
}

function newRun(sim) {
  const upgrades = {}; UPGRADES.forEach(u => upgrades[u.id] = 0);
  const research = {}; RESEARCH.forEach(r => research[r.id] = false);
  // 段階2/3: スキル取得後に研究購入欄へ追加され、クッキーで購入して有効化(転生でリセット)
  const research2 = {}; RESEARCH.forEach(r => research2[r.id] = false);
  const research3 = {}; RESEARCH.forEach(r => research3[r.id] = false);
  const perks = {}; REWARD_POOL.forEach(r => perks[r.id] = 0);
  const upgradePerks = {}; UPGRADES.forEach(u => upgradePerks[u.id] = 0);
  return {
    startT: sim.t,
    cookies: 0, runCookies: 0,
    upgrades, research, research2, research3, perks, upgradePerks,
    rewardCategoryCounts: { golden: 0, hunt: 0, equipment: 0, risk: 0 },
    quotaFailed: false, quotaHoldSeconds: 0, quotaMonsterKills: 0,
    quotaFailAt: null, gainSeries: null,
    lastGoldenT: sim.t, spiceBurstM: 1, spiceAromaUntil: 0, bhCharge: 0, bhUses: 0, bhBoostUntil: 0, bhBoostMult: 1, bhReadyAt: null,
    blackHoleCompressionUsed: false, blackHoleQuotaMultiplier: 1,
    maxStage: 1,
    boosts: [],                // {mult, until}
    afterheats: [],
    spiceBoostUntil: -1, portalHuntUntil: -1,
    goldenTimer: 0, monsterTimer: 0,
    goldenChainReady: false, goldenFirstHitReady: false,
    nextMonsterSpawnMultiplier: 1, nextMonsterHpMultiplier: 1, nextGoldenSpawnMultiplier: 1,
    nextRewardCountBonus: 0, huntFocusLv: 0, huntFocusRewardPenalty: 0,
    nextMonsterStayMultiplier: 1,
    monster: null,             // {typeId,level,hp,maxHp,stayLeft,goldenChainMultiplier,firstHit}
    policy: 'balanced',
    kills: 0, goldenTaken: 0,
    // モンスター種類(第9次): 決定的ローテーションの蓄積器と種類別集計
    mtAcc: {}, gbAcc: 0, killsSinceBoss: 0,
    surge: {},                 // まとめ買い割増: 設備idごとの熱量 {h, t}(購入+1、halfSecで半減)
    killsByType: {}, rewardByType: {},
    critAtBuy: undefined, critNow: 0, critMax: 0,
    chainN: 0, chainLastT: -1e15, chainMax: 0 // 討伐連鎖(第12次D): 周回内変数。転生で0
  };
}

// ==== モンスター種類の決定的抽選(期待値化・第9次) ====
// 重み比例の決定的ローテーション: 各種類の蓄積器に weight/総weight を足し、最大の種類を出す。
// 黄金獣: 金ブースト中は出現枠の goldenBeastShare 分を置換(確率を蓄積し1超えで発生)。
// ボス: 討伐 bossCycle 体ごとに次の出現がボス化(ゲームと同じ周期規則の期待値版)。
function pickMonsterType(sim) {
  const r = sim.run;
  const M = P.mtype;
  if (!M) return 'normal';
  if (r.killsSinceBoss >= M.bossCycle) return 'boss';
  if (goldenBoostActive(sim)) {
    r.gbAcc += M.goldenBeastShare;
    if (r.gbAcc >= 1) { r.gbAcc -= 1; return 'goldenBeast'; }
  }
  const ids = Object.keys(M.weights);
  let totalW = 0; for (const id of ids) totalW += M.weights[id];
  let best = ids[0], bestV = -Infinity;
  for (const id of ids) {
    r.mtAcc[id] = (r.mtAcc[id] || 0) + M.weights[id] / totalW;
    if (r.mtAcc[id] > bestV) { bestV = r.mtAcc[id]; best = id; }
  }
  r.mtAcc[best] -= 1;
  return best;
}
// 種類×報酬カテゴリの相性倍率(条件㉔の「その回だけ無効」= すべて×1.0)
function affinityOf(sim, typeId, category) {
  if (sim.opt.disableAffinity) return 1;
  const M = P.mtype;
  const row = M && M.affinity && M.affinity[typeId];
  return (row && row[category] != null) ? row[category] : 1;
}

// ================= 効果計算(ゲーム式の移植) =================
function hasSkill(sim, id) { return !!sim.skills[id]; }
function skillEffect(sim, type, target) {
  const key = type + '|' + (target || '');
  if (sim._fx[key] !== undefined) return sim._fx[key];
  const values = buildSkillValues();
  let total = 0;
  for (const s of SKILL_NODES) {
    if (!sim.skills[s.id]) continue;
    if (target) {
      for (const e of s.effects) {
        if (e[0] !== type || e[1] !== target) continue;
        total += (typeof e[2] === 'number' ? e[2] : 0);
      }
    } else {
      const v = values[s.id][type];
      if (v) total += v;
    }
  }
  sim._fx[key] = total;
  return total;
}
function hasSkillEffect(sim, type, target) {
  const key = type + '|' + (target || '');
  if (sim._fxHas[key] !== undefined) return sim._fxHas[key];
  const v = SKILL_NODES.some(s => sim.skills[s.id] && s.effects.some(e => e[0] === type && (!target || e[1] === target)));
  sim._fxHas[key] = v;
  return v;
}
function upgradeUnlocked(sim, u) {
  const need = UPGRADE_UNLOCK_SKILLS[u.id];
  return !need || hasSkill(sim, need);
}
function researchUnlocked(sim, r) {
  // 2026-07-06: スキルゲート撤廃。その回で対応設備を購入済みなら購入可能
  const eq = RES_EQUIP[r.id];
  if (eq && !(sim.run.upgrades[eq] > 0)) return false;
  return true;
}
function rewardUnlockedFn(sim, r) {
  // 無効化(disableReward)でも選択肢には残る: 効果だけがゼロになる
  return !r.unlockSkill || hasSkill(sim, r.unlockSkill);
}
function resActive(sim, id) {
  if (sim._md === 'res:' + id) return false; // 期待値測定の一時無効(①)
  if (sim._mdSet && sim._mdSet.has('res:' + id)) return false; // ㉘稼ぎ口分解の一括無効
  return sim.run.research[id] && sim.opt.disableResearch !== id;
}
function policyIs(sim, id) {
  return hasSkillEffect(sim, 'unlockSystem', 'runPolicy') && sim.run.policy === id;
}
function rewardCategoryBonus(sim, cat) {
  if (!hasSkillEffect(sim, 'unlockSystem', 'rewardSynergy')) return 0;
  return lg(satLv(sim.run.rewardCategoryCounts[cat] || 0, P.rw.categoryHalf), P.rw.categoryBonusRate) - 1;
}
function elapsed(sim) { return sim.t - sim.run.startT; }
// 提案10: reach の分母の基礎値=直近K周回の長さの移動中央値(reachMinSec/reachMaxSec 適用前)。
// 履歴が空(初周回)なら prevDuration にフォールバック=旧挙動。中央値は1周回の外れ値に強い。
function reachDenomBase(sim) {
  const K = P.quota.reachDenomK || 1;
  const hist = sim.durations || [];
  if (K <= 1 || hist.length === 0) return sim.prevDuration || 0;
  const win = hist.slice(-K);
  const a = win.slice().sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function quotaControlMultiplier(sim) {
  let raw = 0;
  if (resActive(sim, 'ovenBatch')) raw += P.res.ctrlOven;
  if (resActive(sim, 'moonGlobalYeast')) raw += P.res.ctrlMoon;
  if (resActive(sim, 'blackHoleCompression')) raw += P.res.ctrlBh;
  return 1 + Math.log1p(Math.max(0, raw) * P.quota.ctrlMul) / P.quota.ctrlDiv;
}
function quotaAtElapsed(sim, s) {
  const q = P.quota;
  if (s < q.graceSec) return 0;
  const x = s - q.graceSec;
  const base = q.baseCoef * Math.pow(x, q.basePow) + q.base2Coef * Math.pow(x, q.base2Pow);
  const wall = 1
    + q.w1 * Math.pow(Math.max(0, (s - q.w1T) / q.w1D), q.w1P)
    + q.w2 * Math.pow(Math.max(0, (s - q.w2T) / q.w2D), q.w2P)
    + q.w3 * Math.pow(Math.max(0, (s - q.w3T) / q.w3D), q.w3P);
  // 層の試練(第12次D・提案4採用 / 第12次H・提案8で新規開拓層基準へ相対化): 層が深いほどノルマが重い。
  // 提案8: 「絶対の最高層」ではなく「前回周回の天井(prevMaxStage)+trialStartLayer を超えて新しく潜った分」に
  // だけ効かせる。再登坂(前回天井までの登り直し)は試練ゼロ=タダで、新フロンティア開拓(周回後半)で初めて
  // 試練が立ち上がる → 未達位置が後半へ移り、速い方針も後半に新層を開けば未達する。層数の表示(run.maxStage)は
  // 絶対累積のまま(前回基準で1から数え直さない・ユーザー指示)。相対化するのはこの指数計算だけ。
  const trialFloor = (sim.prevMaxStage || 0) + (q.trialStartLayer || 0);
  const trial = q.trialCoef
    ? Math.pow(1 + q.trialCoef, Math.max(0, sim.run.maxStage - trialFloor))
    : 1;
  return Math.max(1, Math.floor((base * wall * trial) / quotaControlMultiplier(sim)));
}
function monsterQuotaRequired(sim) {
  const r = sim.run;
  if (r.quotaFailed) return null;
  const baseQuota = quotaAtElapsed(sim, elapsed(sim));
  if (!baseQuota || baseQuota <= 0) return baseQuota;
  if (!r.blackHoleCompressionUsed && resActive(sim, 'blackHoleCompression')) {
    const bh = r.upgrades.blackHoleMixer || 0;
    let compression = bh > 0 ? ir(bh, P.res.bhCompress) : 1;
    // キャップ撤廃: 1-min(0.35, 0.001×最高層) → e^(-0.001×最高層) (負値防止の逓減式・上限なし)
    if (resStage3(sim, 'blackHoleCompression')) compression *= Math.exp(-P.res2.bhCompStageCoef * r.maxStage);
    const ratio = r.runCookies / baseQuota;
    if (compression < 1 && ratio < 1.03 && ratio >= compression) {
      r.blackHoleCompressionUsed = true;
      r.blackHoleQuotaMultiplier = compression;
    }
  }
  return Math.max(1, Math.floor(baseQuota * (r.blackHoleQuotaMultiplier || 1)));
}
// ==== ノルマ層ゲージ(2026-07-06 ユーザー確定仕様・第9次) ====
// ゲージは「現時点のその回の総クッキー数が、何秒先のノルマまで達成できるか」の先行秒数 L で貯まる。
// L = (ノルマ曲線が今の総クッキーに達する将来時刻 s*) − 現在の経過秒。
// 層進行の式は秒数のみを変数とする: 層kの必要ゲージ秒 = gaugeSec × gaugeGrow^(k-1)(調整項目)。
function quotaLeadSeconds(sim) {
  const r = sim.run;
  const el = elapsed(sim);
  const total = r.runCookies;
  if (!(total > 0)) return 0;
  // s* をギャロップ+二分探索(quotaAtElapsed は s について単調非減少、runCookies も単調増加なので
  // 前回の s* から前進のみで探索できる。研究購入等でノルマ係数が下がった場合も s* は増える方向)
  let lo = Math.max(el, r._leadS || 0);
  if (quotaAtElapsed(sim, lo) > total) lo = el;
  if (quotaAtElapsed(sim, lo) > total) return 0;
  let hi = Math.max(lo * 2, lo + 64), guard = 0;
  while (hi < 1e62 && quotaAtElapsed(sim, hi) <= total && guard++ < 250) { lo = hi; hi *= 2; }
  while (hi - lo > Math.max(1, lo * 1e-6)) {
    const mid = lo + (hi - lo) / 2;
    if (quotaAtElapsed(sim, mid) <= total) lo = mid; else hi = mid;
  }
  r._leadS = lo;
  return Math.max(0, lo - el);
}
// 先行秒数 L → 層進行(小数)。満たした層数+現在層の端数。
// 層は「秒数のみの関数」。ただし総クッキーが浮動小数上限(~1e308)に近づく放置周回では
// 先行秒数が天文学的(~1e300)になり層が青天井に伸びるため、層の上限 gaugeMaxLayer で頭打ちにする
// (=先行秒数の実効上限。通常の転生周回は最大でも約190層で、上限には決して届かない=遊びに影響なし)。
function quotaLayerProgress(leadSec) {
  const g = Math.max(1, P.quota.gaugeSec), r = P.quota.gaugeGrow;
  const cap = P.quota.gaugeMaxLayer || Infinity;
  if (!(leadSec > 0)) return 0;
  let pr;
  if (r <= 1.0001) pr = leadSec / g;
  else {
    const k = Math.max(0, Math.floor(Math.log(leadSec * (r - 1) / g + 1) / Math.log(r)));
    const used = g * (Math.pow(r, k) - 1) / (r - 1);
    pr = k + Math.max(0, leadSec - used) / (g * Math.pow(r, k));
  }
  return Math.min(cap, pr);
}
function currentStage(sim) {
  if (sim._stT === sim.t) return sim._stV;
  const v = currentStageRaw(sim);
  sim._stT = sim.t; sim._stV = v;
  return v;
}
function currentStageRaw(sim) {
  const quota = monsterQuotaRequired(sim);
  if (quota === null || quota <= 0) return Math.max(1, sim.run._stFrozen || 1);
  const pr = quotaLayerProgress(quotaLeadSeconds(sim));
  if (pr <= 0) return 1;
  const whole = Math.floor(pr);
  const frac = pr - whole;
  const v = (frac <= 0.0001 && whole > 0) ? whole : whole + 1;
  sim.run._stFrozen = v; // 未達後(quota=null)は最後の層で凍結(層1へ落とさない)
  return v;
}

function runTempoRamp(sim) {
  const s = elapsed(sim);
  return 1 - P.tempo.ramp * (1 - Math.exp(-s / P.tempo.rampDiv));
}

// --- 焼き加減(期待値) ---
const BAKE_NEUTRAL = { cps: 1, golden: 1, dmg: 1, stay: 1, hp: 1 };
function bakeEV(sim) {
  if (sim._bkT === sim.t && sim._bkV) return sim._bkV;
  const v = bakeEVRaw(sim);
  sim._bkT = sim.t; sim._bkV = v;
  return v;
}
function bakeEVRaw(sim) {
  if (!hasSkillEffect(sim, 'unlockSystem', 'bakeTemperature')) return BAKE_NEUTRAL;
  const stage = currentStage(sim);
  const oven = sim.run.upgrades.oven || 0;
  const w = { soft: 1, good: 1, crispy: 1, burnt: stage >= 3 ? 0.72 : 0.34 };
  if (policyIs(sim, 'golden')) w.soft += 0.85;
  if (policyIs(sim, 'bake')) w.good += 0.85;
  if (policyIs(sim, 'hunt')) w.crispy += 0.85;
  if (stage >= 4) w.burnt += 0.30;
  const W = w.soft + w.good + w.crispy + w.burnt;
  const B = P.bake || { powerOwn: 0.0018, powerStage: 0.004, burntCps: 0.008, burntOwn: 0.0014, softGold: 0.0010, crispyStay: 0.0012, burntHp: 0.006 };
  const powerMul = lg(oven, B.powerOwn) * lg(Math.max(0, stage - 1), B.powerStage);
  const goodCps = 1.06 * powerMul;
  const burntCps = lg(stage, B.burntCps) * lg(oven, B.burntOwn);
  const softGold = ir(oven + Math.max(0, stage - 1) * 10, B.softGold);
  const crispyDmg = 1.08 * powerMul;
  const crispyStay = lg(oven, B.crispyStay);
  const burntHp = lg(stage, B.burntHp);
  return {
    cps: (w.soft * 1 + w.good * goodCps + w.crispy * 1 + w.burnt * burntCps) / W,
    golden: (w.soft * softGold + (W - w.soft) * 1) / W,
    dmg: (w.crispy * crispyDmg + (W - w.crispy) * 1) / W,
    stay: (w.crispy * crispyStay + (W - w.crispy) * 1) / W,
    hp: (w.burnt * burntHp + (W - w.burnt) * 1) / W
  };
}

function purgeBoosts(sim) {
  const r = sim.run;
  r.boosts = r.boosts.filter(b => b.until > sim.t);
  r.afterheats = r.afterheats.filter(b => b.until > sim.t);
}
function goldenBoostMultiplier(sim) {
  let m = 1; for (const b of sim.run.boosts) m *= b.mult; return m;
}
function goldenBoostActive(sim) { return sim.run.boosts.length > 0; }
function afterheatMultiplier(sim) {
  let m = 1; for (const b of sim.run.afterheats) m *= b.mult; return m;
}

// --- 生産計算 ---
function computeProd(sim) {
  const r = sim.run;
  const R = P.res;
  const stage = currentStage(sim);
  const bake = bakeEV(sim);

  const allSkill = skillEffect(sim, 'all');
  const clickSkillMul = 1 + skillEffect(sim, 'click') + allSkill + (policyIs(sim, 'click') ? 0.12 : 0);
  const cpsSkillMul = 1 + skillEffect(sim, 'cps') + allSkill + (policyIs(sim, 'bake') ? 0.12 : 0);
  const prestigeMul = 1 + allSkill;

  // 研究: グローバル
  let globalRes = 1;
  if (resActive(sim, 'moonGlobalYeast')) {
    const moon = r.upgrades.moonBakery || 0;
    const mStage = r.maxStage; // 最高到達ノルマ層
    const layer = mStage < 3 ? 1 : lg(Math.max(0, mStage - 2), R.moonStage) * lg(capOwn(moon), R.moonOwn);
    let moonM = R.moonBase * layer;
    if (resStage2(sim, 'moonGlobalYeast')) {
      // 段階2: ノルマ余裕率(今回クッキー/必要ノルマ)で発酵が進む
      // キャップ撤廃: min(1,余裕率/10) → log10(1+余裕率)/10 (上限なし・暴走防止の逓減式)
      const q = monsterQuotaRequired(sim);
      const margin = (q && q > 0) ? r.runCookies / q : 1;
      moonM *= 1 + Math.log10(1 + Math.max(0, margin)) / P.res2.moonMarginDiv;
    }
    if (resStage3(sim, 'moonGlobalYeast')) {
      const rc0 = RESEARCH.filter(x => r.research[x.id]).length;
      moonM *= 1 + P.res2.moonResCount * rc0;
    }
    globalRes *= moonM;
  }
  if (resActive(sim, 'portalGlobalFold')) {
    const portal = r.upgrades.portal || 0;
    const mcount = r.monster ? 1 : 0;
    const goldM = goldenBoostActive(sim) ? R.foldGold : 1;
    let foldM = lg(capOwn(portal), R.foldPortal) * lg(mcount, R.foldMonster) * goldM;
    if (resStage2(sim, 'portalGlobalFold')) foldM *= 1 + P.res2.foldKillCoef * Math.max(0, r.quotaMonsterKills);
    if (resStage3(sim, 'portalGlobalFold')) foldM *= 1 + P.res2.foldStageCoef * r.maxStage;
    globalRes *= foldM;
  }
  // 香料調合 段階2: 熟成の香り(金取得から12秒間、全生産バースト)
  if (resActive(sim, 'spiceBlend') && resStage2(sim, 'spiceBlend') && sim.t < (r.spiceAromaUntil || 0)) {
    globalRes *= r.spiceBurstM || 1;
  }
  if (resActive(sim, 'blackHoleCompression')) {
    globalRes *= R.bhGlobal;
    if (sim.t < (r.bhBoostUntil || 0)) globalRes *= r.bhBoostMult || 1; // 段階2: 圧縮チャージ発動中
  }
  if (resActive(sim, 'antimatterRecipe')) {
    const anti = r.upgrades.antimatterOven || 0;
    const skillCount = Object.keys(sim.skills).filter(k => sim.skills[k]).length;
    let antiM = lg(capOwn(anti), R.antimatterOwn) * lg(skillCount, R.antimatterSkill);
    if (resStage2(sim, 'antimatterRecipe')) antiM *= 1 + P.res2.antiStageCoef * r.maxStage;
    if (resStage3(sim, 'antimatterRecipe')) antiM *= 1 + P.res2.antiPrestigeCoef * sim.prestigeRuns;
    globalRes *= antiM;
  }

  // 銀河分業 段階2: 編成ボーナス(全生産)。バランス係数=所持数の幾何平均/算術平均
  if (resActive(sim, 'galaxyAssembly') && resStage2(sim, 'galaxyAssembly')) {
    const counts = [];
    for (const u of UPGRADES) { const c = r.upgrades[u.id]; if (c > 0) counts.push(c); }
    if (counts.length > 1) {
      let logSum = 0, sum = 0;
      for (const c of counts) { logSum += Math.log(c); sum += c; }
      const balance = Math.exp(logSum / counts.length) / (sum / counts.length);
      const gal = r.upgrades.galaxyFactory || 0;
      let bonus = P.res2.galaxyBonusCoef * counts.length * balance * (1 - Math.exp(-gal / P.res2.galaxySat));
      if (resStage3(sim, 'galaxyAssembly')) bonus *= 1 + P.res2.galaxyStageCoef * r.maxStage;
      globalRes *= 1 + bonus;
    }
  }

  const killMulAll = 1 + (r.quotaMonsterKills || 0) * (r.perks.beastHeatFerment * effRw(sim, 'beastHeatFerment'));
  const killMulCps = 1 + (r.quotaMonsterKills || 0) * (r.perks.huntingCore * effRw(sim, 'huntingCore'));

  // 個別強化倍率・研究倍率・支援倍率
  const grandma = r.upgrades.grandma || 0;
  const upPerkPower = 1 + skillEffect(sim, 'upgradePerkPower')
    + (r.perks.crushedMill * effRw(sim, 'crushedMill'))
    + rewardCategoryBonus(sim, 'equipment');

  let clickRaw = 1;
  let cpsRaw = 0;
  const directContrib = [];
  for (let i = 0; i < UPGRADES.length; i++) {
    const u = UPGRADES[i];
    const owned = r.upgrades[u.id];
    if (!owned) continue;
    // 設備トグル(条件⑩): この設備の生産だけをゼロ化(所持数は他の計算式に残す・購入行動同一)
    if (sim.opt.disableUpgrade === u.id) continue;
    const boostRate = Math.max(P.upPerk.floor, P.upPerk.base - i * P.upPerk.slope) * upPerkPower;
    const personal = 1 + (r.upgradePerks[u.id] || 0) * boostRate;
    let resM = 1;
    if (u.id === 'grandma' && resActive(sim, 'grandmaCrowd')) resM *= R.grandmaSelf;
    if (u.id === 'oven' && resActive(sim, 'ovenBatch')) {
      resM *= R.ovenSelf * lg(capOwn(owned), R.ovenOwn) * lg(Math.max(0, r.maxStage - 1), R.ovenStage) * (policyIs(sim, 'bake') ? 1.10 : 1);
      // 段階2: 焼き加減連動(こんがり運用で×1.5、それ以外は期待値×1.2)
      if (resStage2(sim, 'ovenBatch')) resM *= policyIs(sim, 'bake') ? P.res2.ovenBakeMulBake : P.res2.ovenBakeMulOther;
      // 段階3: オーブンの個別強化Lvが研究倍率にも乗る
      if (resStage3(sim, 'ovenBatch')) resM *= 1 + 0.05 * (r.upgradePerks.oven || 0);
    }
    if (u.id === 'factory' && resActive(sim, 'factoryNetwork')) {
      const low = (r.upgrades.finger || 0) + (r.upgrades.grandma || 0) + (r.upgrades.oven || 0);
      resM *= R.factorySelf * lg(capOwn(low), R.factoryLow) * lg(capOwn(owned), R.factoryOwn);
      // 段階2: 銀行以上の上位設備の所持種類数で伸びる
      if (resStage2(sim, 'factoryNetwork')) {
        let hi = 0;
        for (let j = UPIDX.bank; j < UPGRADES.length; j++) if ((r.upgrades[UPGRADES[j].id] || 0) > 0) hi++;
        resM *= 1 + P.res2.factoryHiKind * hi;
      }
      // 段階3: 最高到達ノルマ層
      if (resStage3(sim, 'factoryNetwork')) resM *= 1 + P.res2.factoryStageCoef * r.maxStage;
    }
    if (u.id === 'spiceRack' && resActive(sim, 'spiceBlend')) {
      let m = lg(capOwn(owned), R.spiceOwn) * (policyIs(sim, 'golden') ? 1.08 : 1);
      if (sim.t < r.spiceBoostUntil) {
        m *= R.spiceGold * lg(capOwn(owned), R.spiceGoldOwn);
      }
      resM *= m;
    }
    if (u.id === 'portal' && resActive(sim, 'portalNetwork')) resM *= R.portalSelf;
    if (u.id === 'galaxyFactory' && resActive(sim, 'galaxyAssembly')) {
      const types = UPGRADES.filter(x => (r.upgrades[x.id] || 0) > 0).length;
      resM *= lg(types, R.galaxyTypes) * lg(capOwn(owned), R.galaxyOwn);
    }
    if (u.id === 'quantumBakery' && resActive(sim, 'quantumProofing')) {
      const rc = RESEARCH.filter(x => r.research[x.id]).length;
      resM *= lg(rc, R.quantumRes) * lg(capOwn(owned), R.quantumOwn);
      // 段階2: 観測ゆらぎ(90秒周期の波。山でのみ増幅、谷は×1)
      if (resStage2(sim, 'quantumProofing')) {
        let amp = P.res2.waveAmpBase + P.res2.waveAmpPerRes * rc;
        if (resStage3(sim, 'quantumProofing')) amp *= 1 + P.res2.waveStageCoef * r.maxStage;
        // タイミング(条件⑬): 最適操作=山に活動を寄せる(正相平均2/π) / 完全放置=全周期平均(1/π)
        const wf = idleOn(sim, 'wave') ? P.timing.waveIdle : P.timing.waveOpt;
        resM *= 1 + amp * wf;
      }
    }
    let supM = 1;
    if (resActive(sim, 'grandmaCrowd')) {
      if (u.id === 'finger') supM *= lg(capOwn(grandma), R.grandmaSup[0]);
      if (u.id === 'oven') supM *= lg(capOwn(grandma), R.grandmaSup[1]);
      if (u.id === 'factory') supM *= lg(capOwn(grandma), R.grandmaSup[2]);
      // 段階2: 支援先に銀行・香料棚を追加
      if (resStage2(sim, 'grandmaCrowd') && (u.id === 'bank' || u.id === 'spiceRack')) supM *= lg(capOwn(grandma), P.res2.supExtra);
      // 段階3: 最高到達ノルマ層で全支援が伸びる
      if (supM > 1 && resStage3(sim, 'grandmaCrowd')) supM *= 1 + P.res2.supStageCoef * r.maxStage;
    }
    // 熟練(スキル解放・研究不要): 下位7種=職人の手 / 上位9種=工程の極み。×(1+rate)^所持数
    let mastMul = 1;
    if (i <= UPIDX.portal) {
      if (hasSkillEffect(sim, 'unlockSystem', 'masteryLow')) mastMul = Math.pow(1 + P.mastery.low, owned);
    } else if (hasSkillEffect(sim, 'unlockSystem', 'masteryHigh')) {
      mastMul = Math.pow(1 + P.mastery.high, owned);
    }
    const contrib = owned * u.value * personal * resM * supM * mastMul;
    directContrib[i] = contrib; // 系列ボーナスの参照元(この設備の直接生産。系列ぶんは含まない)
    if (u.type === 'click') clickRaw += contrib; else cpsRaw += contrib;
  }
  // 系列ボーナス(2026-07-06 ユーザー採用・第11次): スキル解放の上位設備の固有能力(研究不要)。
  // 1台につき「自分より下位の設備の直接生産(毎秒)の合計×coef」を追加生産。直接生産のみを参照する
  // ため掛け算の連鎖(又取り)にはならない。神の指はクリック型なので、クリック力×(1+coef×台数)の線形倍率。
  let godFingerLineageMul = 1;
  if (P.lineage && P.lineage.coef > 0) {
    let lowerCps = 0;
    for (let i = 0; i < UPGRADES.length; i++) {
      const u = UPGRADES[i];
      const owned = r.upgrades[u.id];
      if (owned > 0 && UPGRADE_UNLOCK_SKILLS[u.id] && sim.opt.disableUpgrade !== u.id) {
        if (u.id === 'godFinger') godFingerLineageMul = 1 + P.lineage.coef * owned;
        else cpsRaw += owned * P.lineage.coef * lowerCps;
      }
      if (u.type === 'cps' && sim.opt.disableUpgrade !== u.id) lowerCps += directContrib[i] || 0;
    }
  }

  // 銀行クリック配当
  let bankM = 1;
  if (resActive(sim, 'bankClickDividend')) {
    const bank = r.upgrades.bank || 0;
    const saved = Math.log10(r.cookies + 10);
    bankM = lg(capOwn(bank), R.bankOwn) * (1 + Math.log1p(saved) * R.bankSaved) * (policyIs(sim, 'click') ? 1.08 : 1);
  }

  let click = clickRaw * bankM * clickSkillMul * prestigeMul * globalRes * killMulAll;
  let cps = cpsRaw * cpsSkillMul * prestigeMul * globalRes * killMulAll * killMulCps * bake.cps;

  // クリック変更 案A(指先連動): クリック力 = 従来項 + 毎秒生産×係数×(1+0.02×√強い指)×(1+クリック系スキル効果)
  const CL = P.clickLink;
  click += cps * CL.cpsCoef * (1 + CL.fingerSqrt * Math.sqrt(r.upgrades.finger || 0)) * clickSkillMul;
  // クリック変更 案C(神の指=クリックの上位段): 1個ごとにクリック×godFingerExp(指数)
  click *= Math.pow(CL.godFingerExp, r.upgrades.godFinger || 0);
  // 系列ボーナス(神の指): クリック力×(1+coef×台数)
  click *= godFingerLineageMul;

  // 討伐連鎖(第12次D・提案1採用): 倒し続けている間だけ全生産×(1+prodCoef×連鎖数)。
  // 連鎖数は討伐数に線形でしか増えない(共鳴型の雪だるまにならない)。途切れ・転生で0。
  const chainM = 1 + (P.chain ? P.chain.prodCoef * chainCount(sim) : 0);
  click *= chainM; cps *= chainM;

  // 会心(期待値)
  let critEV = 1;
  let critChanceOut = 0;
  if (resActive(sim, 'fingerTechnique')) {
    const f = r.upgrades.finger || 0;
    const policyC = policyIs(sim, 'click') ? 0.010 : 0;
    // 会心1%開始(第9次): 開始値0.01(=会心率1.0%)+設備√+最高到達層(周回内で育つ動的項)
    const score = R.fingerBase + Math.sqrt(f) * R.fingerSqrt + (R.fingerStage || 0) * r.maxStage + policyC;
    const chance = 1 - Math.exp(-score);
    critChanceOut = chance;
    let critMul = R.fingerCritBase + score * R.fingerCritGrow;
    // 段階2: 会心コンボ(期待値: 直近30秒の会心回数。キャップ撤廃済み)
    if (resStage2(sim, 'fingerTechnique')) {
      const combo = chance * sim.strat.tapRate * P.res2.comboWindow;
      critMul *= 1 + P.res2.comboRate * combo;
    }
    critEV = 1 + chance * (critMul - 1);
  }

  const boostM = goldenBoostMultiplier(sim) * afterheatMultiplier(sim);
  return {
    baseClick: click, clickEV: click * critEV * boostM, cps: cps * boostM,
    baseCps: cps, boostM, bake, stage, prestigeMul, critChance: critChanceOut
  };
}

// 報酬の無効化判定(恒久 disableReward + 期待値測定の一時 _md + ㉘一括無効 _mdSet の対応)
function rwOff(sim, id) { return sim.opt.disableReward === id || sim._md === 'rw:' + id || (sim._mdSet ? sim._mdSet.has('rw:' + id) : false); }
// 討伐連鎖(第12次D・提案1採用): 最後の討伐から breakSec 以内なら連鎖が生きている。
// 討伐系機能として一時無効(_md/_mdSet 'chain')に対応=期待値方式・㉘討伐由来分解の対象
function chainOff(sim) { return sim.opt.disableChain || sim._md === 'chain' || (sim._mdSet ? sim._mdSet.has('chain') : false); }
function chainCount(sim) {
  if (!P.chain || chainOff(sim)) return 0;
  const r = sim.run;
  return (sim.t - r.chainLastT) <= P.chain.breakSec ? r.chainN : 0;
}
// 報酬効果値(無効化対応)
function effRw(sim, id) {
  if (rwOff(sim, id)) return 0;
  return P.rw[id] != null ? P.rw[id] : 0;
}

function monsterDamage(sim, prod) {
  const r = sim.run;
  const p = Math.max(1, prod.baseClick * prod.boostM);
  const base = Math.max(1, Math.floor(1 + Math.sqrt(p) * P.monster.dmgSqrtCoef));
  const goldTarget = goldenBoostActive(sim) ? (r.perks.goldenTarget || 0) * effRw(sim, 'goldenTarget') : 0;
  const chain = r.monster ? ((r.monster.goldenChainMultiplier || 1) - 1) : 0;
  const clickOwned = (r.upgrades.finger || 0) + (r.upgrades.godFinger || 0);
  const mult = (1
    + (rwOff(sim, 'monsterDamage') ? 0 : r.perks.monsterDamage * P.rw.monsterDamage)
    + skillEffect(sim, 'monsterDamageSkill')
    + (r.perks.crackedFang || 0) * effRw(sim, 'crackedFang')
    + goldTarget + chain
    + Math.sqrt(clickOwned) * (r.perks.brandHunt || 0) * effRw(sim, 'brandHunt')
    + rewardCategoryBonus(sim, 'hunt')
    + (policyIs(sim, 'hunt') ? 0.14 : 0)
  ) * prod.bake.dmg;
  return Math.max(1, Math.ceil(base * mult));
}

function goldenSpawnFactor(sim) {
  const r = sim.run;
  const rateLv = satLv(rwOff(sim, 'goldenRate') ? 0 : (r.perks.goldenRate || 0), P.golden.rateLvHalf);
  return Math.exp(
    -Math.max(0, rateLv) * P.golden.ratePerLv
    - Math.max(0, skillEffect(sim, 'goldenRate')) * 1.8
    - rewardCategoryBonus(sim, 'golden') * 1.2
    - (policyIs(sim, 'golden') ? 0.12 : 0)
  ) * runTempoRamp(sim) * bakeEV(sim).golden;
}
function monsterSpawnFactor(sim) {
  const r = sim.run;
  const rateLv = satLv(rwOff(sim, 'monsterRate') ? 0 : (r.perks.monsterRate || 0), P.monster.rateLvHalf);
  const deep = Math.exp(-(rwOff(sim, 'deepPursuit') ? 0 : (r.perks.deepPursuit || 0)) * P.rw.deepPursuitSpawn);
  let portalHunt = 1;
  if (resActive(sim, 'portalNetwork') && sim.t < r.portalHuntUntil) {
    portalHunt = ir(r.upgrades.portal || 0, P.res.portalHuntSpawn);
    if (resStage3(sim, 'portalNetwork')) portalHunt *= Math.exp(-P.res2.huntStageCoef * r.maxStage);
  }
  return Math.exp(
    -Math.max(0, rateLv) * P.monster.ratePerLv
    - Math.max(0, skillEffect(sim, 'monsterRate')) * 1.8
    - rewardCategoryBonus(sim, 'hunt') * 1.0
    - (policyIs(sim, 'hunt') ? 0.10 : 0)
  ) * deep * portalHunt * runTempoRamp(sim);
}
function monsterLevel(sim) {
  const s = elapsed(sim);
  const early = Math.floor(Math.max(0, s - 45) / P.monster.lvEarlyDiv);
  const late = Math.floor(Math.pow(Math.max(0, s - 720) / P.monster.lvLateDiv, P.monster.lvLatePow));
  return Math.max(1, 1 + early + late);
}
function monsterHpValue(sim, level) {
  const s = elapsed(sim);
  const M = P.monster;
  const timePressure = 1 + Math.pow(Math.max(0, s - 45) / M.hpPressureDiv, M.hpPressurePow);
  let hp = M.hpBase * Math.pow(M.hpGrowth, Math.max(0, level - 1)) * timePressure;
  hp *= Math.exp(-Math.max(0, skillEffect(sim, 'monsterHpDown')));
  hp *= Math.pow(P.rw.deepPursuitHp, rwOff(sim, 'deepPursuit') ? 0 : (sim.run.perks.deepPursuit || 0));
  hp *= bakeEV(sim).hp;
  return Math.floor(hp);
}
function monsterStayMs(sim) {
  const r = sim.run;
  const rewardLv = rwOff(sim, 'monsterStay') ? 0 : Math.max(0, r.perks.monsterStay || 0);
  const mult = Math.exp(rewardLv * P.monster.stayPerLv + Math.max(0, skillEffect(sim, 'monsterStay')) * 0.12
    + (policyIs(sim, 'hunt') ? 0.10 : 0) + rewardCategoryBonus(sim, 'hunt'))
    * (r.nextMonsterStayMultiplier || 1) * bakeEV(sim).stay;
  r.nextMonsterStayMultiplier = 1;
  return Math.max(4000, P.monster.stayBase * mult);
}
function goldenAmountMultiplier(sim) {
  const r = sim.run;
  const lv = satLv(rwOff(sim, 'goldenAmount') ? 0 : r.perks.goldenAmount, P.golden.amountLvHalf);
  return 1 + lv * P.golden.amountPerLv + skillEffect(sim, 'goldenAmount')
    + rewardCategoryBonus(sim, 'golden') + (policyIs(sim, 'golden') ? 0.10 : 0);
}
function goldenMultiplierVal(sim) {
  const r = sim.run;
  const lv = satLv(rwOff(sim, 'goldenPower') ? 0 : r.perks.goldenPower, P.golden.powerLvHalf);
  return P.golden.multBase + lv * P.golden.powerPerLv + skillEffect(sim, 'goldenPower')
    + rewardCategoryBonus(sim, 'golden') + (policyIs(sim, 'golden') ? 0.18 : 0);
}
function goldenBoostDurationMs(sim) {
  const r = sim.run;
  const gp = rwOff(sim, 'goldenPower') ? 0 : r.perks.goldenPower;
  const ga = rwOff(sim, 'goldenAmount') ? 0 : r.perks.goldenAmount;
  const perkRaw = Math.max(0, gp) * 260 + Math.max(0, ga) * 65;
  const skillRaw = Math.max(0, skillEffect(sim, 'goldenPower') * 900 + skillEffect(sim, 'goldenRate') * 1800 + skillEffect(sim, 'goldenAmount') * 700);
  const runRaw = 900 * (1 - Math.exp(-elapsed(sim) / 420));
  const policyRaw = policyIs(sim, 'golden') ? 900 : 0;
  const categoryRaw = rewardCategoryBonus(sim, 'golden') * 2400;
  const rawExtra = perkRaw + skillRaw + runRaw + policyRaw + categoryRaw;
  // 逓減式: rawExtraが伸びても追加時間はboostExtraCapに漸近する
  return P.golden.boostBase + P.golden.boostExtraCap * rawExtra / (rawExtra + P.golden.boostExtraHalf);
}

// ==== 各回の期待値方式(第12次・2026-07-06 ユーザー採用): 同一周回内で「稼ぎ力」を測る ====
// やり直し比較(replay)を廃止し、各tickで「機能込みの瞬間稼ぎ力 ÷ 機能抜きの瞬間稼ぎ力」を測って
// 周回平均(対数平均)を取る。同じ状態を2通り評価するだけなので、分かれ道のズレが原理的に発生しない。
// 稼ぎ力 = 直接生産 + 金クッキー収入率 + 討伐報酬(投資)価値率 の合成。すべて現在状態から式で算出。
const KILL_VALUE_SEC = 6;   // 討伐1体の価値を「生産◯秒ぶん」で近似(投資=将来の報酬・強化。channel重み)
// earningPower は副作用のある関数(monsterStayMs 等が next*Multiplier をリセット)を呼ぶため、
// 揮発フィールドを退避・復元して純粋化する(測定が実シミュの状態を壊さないように)
function earningPowerSafe(sim) {
  const r = sim.run;
  const a = r.nextMonsterStayMultiplier, b = r.nextMonsterSpawnMultiplier, c = r.nextGoldenSpawnMultiplier, d = r.nextMonsterHpMultiplier;
  const v = earningPower(sim);
  r.nextMonsterStayMultiplier = a; r.nextMonsterSpawnMultiplier = b; r.nextGoldenSpawnMultiplier = c; r.nextMonsterHpMultiplier = d;
  return v;
}
function earningPower(sim) {
  const r = sim.run;
  const prod = computeProd(sim);
  const tapRate = sim.strat.tapRate;
  const base = prod.cps + prod.clickEV * (r.monster ? 0 : tapRate); // 直接生産(モンスター中はタップは討伐へ)
  let power = base;
  // 金クッキー収入率(期待値/秒): 間隔は spawnFactor、1回の価値は即時+ブーストの平均
  if (!(sim._mdChan && sim._mdChan.golden)) {
    const mean = (P.golden.spawnMin + P.golden.spawnMax) / 2;
    const interval = Math.max(1, mean * goldenSpawnFactor(sim) / 1000);
    const instant = Math.max(prod.baseCps, prod.baseClick) * P.golden.instantCoef * goldenAmountMultiplier(sim);
    const boostVal = Math.max(0, goldenMultiplierVal(sim) - 1) * prod.cps * (goldenBoostDurationMs(sim) / 1000);
    power += (instant + boostVal) / 2 / interval;
  }
  // 討伐報酬(投資)価値率: 討伐/秒 × 生産KILL_VALUE_SEC秒ぶん。ダメージ・出現・滞在の報酬がここに効く
  if (!(sim._mdChan && sim._mdChan.hunt)) {
    const mean = (P.monster.spawnMin + P.monster.spawnMax) / 2;
    const interval = Math.max(1, mean * monsterSpawnFactor(sim) / 1000);
    const level = monsterLevel(sim);
    const hp = Math.max(1, monsterHpValue(sim, level));
    const dmg = Math.max(1, monsterDamage(sim, prod));
    const ttk = hp / Math.max(1e-9, dmg * tapRate); // 撃破所要秒
    const stay = monsterStayMs(sim) / 1000;
    const killable = ttk <= stay ? 1 : 0;             // 滞在内に倒せるか(滞在報酬が効く)
    const killsPerSec = killable / (interval + ttk);
    power += killsPerSec * base * KILL_VALUE_SEC;
  }
  return power;
}
// 測定対象の機能一覧(_md キー)。取得済みのものだけ測る
function measureFeatureKeys(sim) {
  const keys = [];
  for (const rr of RESEARCH) if (sim.run.research[rr.id]) keys.push('res:' + rr.id);
  for (const rw of REWARD_POOL) if (sim.run.perks[rw.id] > 0) keys.push('rw:' + rw.id);
  for (const rr of RESEARCH) { if (sim.run.research2[rr.id]) keys.push('stage:' + rr.id + ':2'); if (sim.run.research3[rr.id]) keys.push('stage:' + rr.id + ':3'); }
  if (P.chain && sim.run.kills > 0) keys.push('chain'); // 討伐連鎖(参考計測。合否は③②⑫㉘経由)
  return keys;
}
const MEASURE_POLICIES = ['balanced', 'click', 'golden', 'hunt', 'bake'];

// ==== ㉘稼ぎ口比率(2026-07-06 採用・3-2反映済み): 収入の4分解(設備生産/金/討伐由来/タップ) ====
// 討伐由来=「討伐系の機能(報酬・素材・連鎖・狩り研究)を全部無効にしたとき消える収入」(ユーザー定義)。
// 金由来=さらに金系機能を無効にしたとき消える収入。残りをタップ(クリック分)と設備生産に分ける。
// 機能の割り当て(細部は【仮】・3-2-5): hunt=報酬カテゴリhunt/risk+crushedMill(素材系)+狩り研究
// (portalNetwork・portalGlobalFold)とその段階 / golden=報酬カテゴリgolden+金研究(spiceBlend)とその段階。
const HUNT_FEATURE_SET = new Set([
  ...REWARD_POOL.filter(r => r.category === 'hunt' || r.category === 'risk' || r.id === 'crushedMill').map(r => 'rw:' + r.id),
  'res:portalNetwork', 'res:portalGlobalFold',
  'stage:portalNetwork:2', 'stage:portalNetwork:3', 'stage:portalGlobalFold:2', 'stage:portalGlobalFold:3',
  'chain' // 討伐連鎖(第12次D): 討伐系機能=㉘の討伐由来に計上
]);
const GOLDEN_FEATURE_SET = new Set([
  ...REWARD_POOL.filter(r => r.category === 'golden').map(r => 'rw:' + r.id),
  'res:spiceBlend', 'stage:spiceBlend:2', 'stage:spiceBlend:3'
]);
const HUNT_GOLDEN_FEATURE_SET = new Set([...HUNT_FEATURE_SET, ...GOLDEN_FEATURE_SET]);
function incomeParts(sim, pAll) {
  const r = sim.run;
  const clear = () => { sim._bkT = -1; sim._stT = -1; };
  // 討伐由来: 討伐系機能+討伐チャネルを無効にして消える分
  sim._mdSet = HUNT_FEATURE_SET; sim._mdChan = { hunt: true };
  clear();
  const pNoHunt = earningPowerSafe(sim);
  // 金由来: さらに金系機能+金チャネルを無効にして消える分
  sim._mdSet = HUNT_GOLDEN_FEATURE_SET; sim._mdChan = { hunt: true, golden: true };
  clear();
  const pCore = earningPowerSafe(sim);
  const prodCore = computeProd(sim);
  const tapRaw = prodCore.clickEV * (r.monster ? 0 : sim.strat.tapRate);
  sim._mdSet = null; sim._mdChan = null; clear();
  if (!(pAll > 0) || !Number.isFinite(pAll) || !(pCore >= 0) || !Number.isFinite(pCore)) return null;
  const tap = Math.max(0, Math.min(tapRaw, pCore));
  return {
    hunt: Math.max(0, pAll - pNoHunt),
    golden: Math.max(0, pNoHunt - pCore),
    tap,
    equip: Math.max(0, pCore - tap)
  };
}
// 1サンプル: 各機能の「稼ぎ力の持ち上げ幅」を対数で積算。周回内キャッシュは都度クリアして正しく再計算
function measureTick(sim) {
  const r = sim.run;
  if (!r._meas) r._meas = {};
  const clearCaches = () => { sim._bkT = -1; sim._stT = -1; };
  clearCaches();
  const pOn = earningPowerSafe(sim);
  if (!(pOn > 0) || !Number.isFinite(pOn)) return;
  for (const key of measureFeatureKeys(sim)) {
    sim._md = key;
    clearCaches();
    const pOff = earningPowerSafe(sim);
    sim._md = null;
    clearCaches();
    if (pOff > 0 && Number.isFinite(pOff)) {
      const m = r._meas[key] || (r._meas[key] = { s: 0, n: 0 });
      m.s += Math.log(pOn / pOff); m.n++;
    }
  }
  // ⑬タイミング: idleTiming を opt で一時切替(最適操作=既定 / 放置=idle)して稼ぎ力比
  for (const tf of TIMING_KEYS) {
    const [rid, st] = tf.stage.split(':');
    const active = st === '2' ? r.research2[rid] : r.research3[rid];
    if (!active) continue;
    const savedIdle = sim.opt.idleTiming;
    sim.opt.idleTiming = tf.key; clearCaches();
    const pIdle = earningPowerSafe(sim);
    sim.opt.idleTiming = savedIdle; clearCaches();
    if (pIdle > 0 && Number.isFinite(pIdle)) {
      const m = r._meas['timing:' + tf.key] || (r._meas['timing:' + tf.key] = { s: 0, n: 0 });
      m.s += Math.log(pOn / pIdle); m.n++;
    }
  }
  // ㉘稼ぎ口比率: 各tickの収入シェアを積算し周回平均を取る(絶対量で足すと垂直成長の終盤が
  // 支配するため、シェアの単純平均=周回を通した「時間平均の稼ぎ口構成」で見る【集計方法は仮】)
  {
    const parts = incomeParts(sim, pOn);
    if (parts) {
      const tot = parts.equip + parts.golden + parts.hunt + parts.tap;
      if (tot > 0 && Number.isFinite(tot)) {
        const inc = r._inc || (r._inc = { equip: 0, golden: 0, hunt: 0, tap: 0, n: 0 });
        inc.equip += parts.equip / tot; inc.golden += parts.golden / tot;
        inc.hunt += parts.hunt / tot; inc.tap += parts.tap / tot; inc.n++;
      }
    }
  }
  // ⑫文脈依存性: 5方針それぞれの稼ぎ力(この周回の中身に対して)。argmax を後で集計
  if (!r._polPow) r._polPow = {};
  const savedPol = r.policy;
  for (const pol of MEASURE_POLICIES) {
    r.policy = pol; clearCaches();
    const pp = earningPowerSafe(sim);
    if (pp > 0 && Number.isFinite(pp)) r._polPow[pol] = (r._polPow[pol] || 0) + Math.log(pp);
  }
  r.policy = savedPol; clearCaches();
}
// 周回終了時に _meas / _polPow を平均して記録に落とす
function finalizeMeasure(run) {
  const lift = {};
  if (run._meas) for (const [k, m] of Object.entries(run._meas)) if (m.n > 0) lift[k] = Math.exp(m.s / m.n);
  let bestPol = null, bestV = -Infinity;
  if (run._polPow) for (const [pol, v] of Object.entries(run._polPow)) if (v > bestV) { bestV = v; bestPol = pol; }
  let income = null;
  if (run._inc && run._inc.n > 0) {
    const i = run._inc;
    income = { equip: i.equip / i.n, golden: i.golden / i.n, hunt: i.hunt / i.n, tap: i.tap / i.n };
  }
  return { lift, bestPol, income };
}
// タイミング機能(⑬)の測定: idleTiming を _md ではなく opt で切替えるため別扱い
const TIMING_KEYS = [
  { key: 'wave', stage: 'quantumProofing:2' },
  { key: 'bhCharge', stage: 'blackHoleCompression:2' },
  { key: 'mature', stage: 'spiceBlend:2' },
  { key: 'huntExtend', stage: 'portalNetwork:2' }
];

// まとめ買い割増(2026-07-06 ユーザー採用): 現在の熱量(時間減衰込み)
function surgeHeat(sim, id) {
  const sg = sim.run.surge && sim.run.surge[id];
  if (!sg || !(sg.h > 0)) return 0;
  return sg.h * Math.pow(0.5, (sim.t - sg.t) / Math.max(1, P.upSurge.halfSec));
}
function upgradeCost(sim, u) {
  const owned = sim.run.upgrades[u.id];
  const disc = Math.exp(-Math.max(0, skillEffect(sim, 'upgradeDiscount')));
  // 所有数指数: knee以降は急勾配(大量買い占め抑制)
  const knee = P.upCost.knee || Infinity;
  const e = owned <= knee ? owned * P.upCost.ownPow : knee * P.upCost.ownPow + (owned - knee) * (P.upCost.ownPow2 || P.upCost.ownPow);
  // まとめ買い割増: (1+perBuy)^熱量。時間経過で元に戻る(=壁ができない)
  const surge = Math.pow(1 + (P.upSurge ? P.upSurge.perBuy : 0), surgeHeat(sim, u.id));
  // 丸め規則: 設備コストは有効数字3桁=5の倍数+小数切り捨て(表示も内部値もこの値)
  return q5cost(P.upCost.coef * Math.pow(u.base, P.upCost.basePow) * Math.pow(u.growth, e) * surge * disc);
}
function researchCostOf(sim, id) {
  const disc = Math.exp(-Math.max(0, skillEffect(sim, 'researchDiscount')));
  return q5cost(P.resCost[id] * disc);
}
// 研究の段階 (1=購入 / 2,3=対応スキル取得後に購入欄へカード追加→クッキーで購入して有効化)
// disableStage='研究id:2' 等で単体効果ゼロ化(購入行動は同一。条件⑨用)
function resStage2(sim, id) { return !!sim.run.research2[id] && sim.opt.disableStage !== id + ':2' && sim._md !== 'stage:' + id + ':2' && !(sim._mdSet && sim._mdSet.has('stage:' + id + ':2')); }
function resStage3(sim, id) { return !!sim.run.research3[id] && sim.opt.disableStage !== id + ':3' && sim._md !== 'stage:' + id + ':3' && !(sim._mdSet && sim._mdSet.has('stage:' + id + ':3')); }
// 段階カードの表示条件: 前段階を購入済み かつ 対応スキルを取得済み
function researchStageUnlocked(sim, id, stage) {
  const r = sim.run;
  if (!r.research[id]) return false;
  if (stage === 2) return !!sim.skills[RES_STAGE2[id]];
  return !!r.research2[id] && !!sim.skills[RES_STAGE3[id]];
}
// 段階コスト: 段1コスト×倍率。研究ごとの個別倍率(resStageCostEach: 値段割りD'用)があれば優先、
// なければ共通倍率(resStageCost)。researchDiscountは段1と同様に効く
function researchStageCostOf(sim, id, stage) {
  const disc = Math.exp(-Math.max(0, skillEffect(sim, 'researchDiscount')));
  const each = P.resStageCostEach && P.resStageCostEach[id];
  const mult = stage === 2 ? ((each && each.s2) || P.resStageCost.s2) : ((each && each.s3) || P.resStageCost.s3);
  return q5cost(P.resCost[id] * mult * disc);
}
// capv(効果キャップ)は2026-07-05のキャップ全撤廃で削除済み

function prestigeGainOf(runCookies) {
  const t = Math.max(0, Math.floor(runCookies));
  const pp = P.prestige;
  if (t < pp.pMin) return 0;
  return Math.max(1, Math.floor(pp.pA * (1 - Math.exp(-t / pp.pD1)) + pp.pB * Math.pow(t / pp.pD2, pp.pG)));
}
function prestigeUnlockedFn(sim) {
  return sim.totalCookies >= 1000000 || sim.prestigeTotal > 0 || sim.prestigeRuns > 0;
}

// 可視アップグレード(店に並ぶもの)
function visibleUpgrades(sim) {
  let hi = -1;
  UPGRADES.forEach((u, i) => { if (sim.run.upgrades[u.id] > 0) hi = Math.max(hi, i); });
  const limit = Math.min(UPGRADES.length - 1, Math.max(1, hi + 1));
  return UPGRADES.filter((u, i) => i <= limit && upgradeUnlocked(sim, u));
}

// ================= イベント処理 =================
// クッキー数の上限: 2026-07-06 ユーザー許可「上限は超えてもよい」。クランプはしない。
// ツリー完成後の超長時間放置では浮動小数の上限(~1.8e308)を超えて Infinity 表示になり得るが許容。
// 有限性の判定は「転生する周回」のみを対象とする(転生周回の最大は ~e155 で十分収まる)。
function earn(sim, amount) {
  if (!(amount > 0)) return 0;
  sim.run.cookies += amount;
  sim.run.runCookies += amount;
  sim.totalCookies += amount;
  return amount;
}

function collectGolden(sim, prod) {
  const r = sim.run;
  r.goldenTaken++;
  // 香料調合 段階2: 風味の熟成(前回の金からの経過秒で、全生産の短時間バーストが決まる)
  if (resActive(sim, 'spiceBlend') && resStage2(sim, 'spiceBlend')) {
    const mature = Math.max(0, sim.t - (r.lastGoldenT || r.startT)); // キャップ撤廃(旧min 240s)
    // タイミング(条件⑬): 完全放置は爆発窓に行動を寄せられないため係数を減衰
    const matureEff = idleOn(sim, 'mature') ? P.timing.matureIdleMul : 1;
    let burst = 1 + P.res2.matureRate * mature * matureEff;
    if (resStage3(sim, 'spiceBlend')) burst *= 1 + P.res2.spiceStageCoef * r.maxStage;
    r.spiceBurstM = burst;
    r.spiceAromaUntil = sim.t + P.res2.aromaDur;
  }
  r.lastGoldenT = sim.t;
  if ((r.perks.goldenChain || 0) > 0 && sim.opt.disableReward !== 'goldenChain') r.goldenChainReady = true;
  if ((r.perks.goldenFirstHit || 0) > 0 && sim.opt.disableReward !== 'goldenFirstHit') r.goldenFirstHitReady = true;
  if (resActive(sim, 'spiceBlend')) r.spiceBoostUntil = sim.t + (P.res.spiceGoldDur + Math.log1p(r.upgrades.spiceRack || 0) * 1800) / 1000;
  if (resActive(sim, 'portalNetwork')) r.portalHuntUntil = sim.t + (P.res.portalHuntDur * lg(r.upgrades.portal || 0, P.res.portalHuntGrow)) / 1000;

  // 期待値: 交互に即時獲得/ブースト
  sim.goldenAlt ^= 1;
  if (sim.goldenAlt === 1) {
    earn(sim, Math.max(100, prod.cps * P.golden.instantCoef, prod.clickEV * P.golden.instantCoef) * goldenAmountMultiplier(sim));
  } else {
    const mult = goldenMultiplierVal(sim);
    const dur = goldenBoostDurationMs(sim) / 1000;
    r.boosts.push({ mult, until: sim.t + dur });
    const timeOven = r.upgrades.timeOven || 0;
    if (timeOven > 0) {
      r.afterheats.push({
        mult: 1 + Math.sqrt(timeOven) * 0.018,
        from: sim.t + dur,
        until: sim.t + dur + (3000 + Math.log1p(timeOven) * 1400) / 1000
      });
    }
  }
}

function buildRewardOffer(sim, level, typeId) {
  const r = sim.run;
  // 鉄焼きガード等: 種類による報酬レベル加算(ゲームの rewardLvAdd と同じ)
  const lvAdd = (P.mtype && P.mtype.rewardLvAdd && P.mtype.rewardLvAdd[typeId]) || 0;
  // 討伐連鎖(第12次D): 報酬レベル +floor(rewardCoef×連鎖数)
  const chainLv = P.chain ? Math.floor(P.chain.rewardCoef * chainCount(sim)) : 0;
  const baseCount = 1 + Math.floor((level + lvAdd + chainLv) / P.reward.lvPerCount);
  const deepBonus = Math.pow(P.rw.deepPursuitReward, rwOff(sim, 'deepPursuit') ? 0 : (r.perks.deepPursuit || 0));
  const penalty = Math.max(0, r.huntFocusRewardPenalty || 0);
  const count = Math.max(1,
    Math.floor(baseCount * (1 + skillEffect(sim, 'rewardBonus')) * deepBonus)
    + Math.max(0, Math.floor(r.nextRewardCountBonus || 0)) - penalty);
  r.huntFocusRewardPenalty = 0;
  // ステージボス: 選択肢+1(種類仕様・第9次)
  const bossBonus = typeId === 'boss' ? ((P.mtype && P.mtype.bossChoiceBonus) || 0) : 0;
  const choiceLimit = P.reward.choiceBase + bossBonus + Math.max(0, Math.floor(skillEffect(sim, 'rewardChoices')));

  const unlockedPerks = REWARD_POOL.filter(x => rewardUnlockedFn(sim, x));
  const ownedUps = UPGRADES.filter(u => r.upgrades[u.id] > 0 && upgradeUnlocked(sim, u));
  const offer = [];
  if (ownedUps.length > 0) {
    const u = ownedUps[sim.upRotIdx % ownedUps.length]; sim.upRotIdx++;
    offer.push({ kind: 'upgrade', id: u.id, count });
  }
  // 残りは決定的ローテーションで選ぶ(期待値近似)
  const pool = unlockedPerks.map(x => ({ kind: 'perk', id: x.id, category: x.category, count }));
  for (let k = 0; k < pool.length && offer.length < choiceLimit; k++) {
    const c = pool[(sim.rotIdx + k) % pool.length];
    if (!offer.some(o => o.kind === c.kind && o.id === c.id)) offer.push(c);
  }
  sim.rotIdx = (sim.rotIdx + 3) % Math.max(1, pool.length);
  return offer;
}

function applyReward(sim, choice, typeId) {
  const r = sim.run;
  const cat = choice.kind === 'perk'
    ? (REWARD_POOL.find(x => x.id === choice.id) || {}).category || 'equipment'
    : 'equipment';
  // モンスター種類×報酬相性(第9次): 増分 = max(1, floor(基本量 × 相性倍率))
  const aff = affinityOf(sim, typeId || 'normal', cat);
  const count = Math.max(1, Math.floor(choice.count * aff));
  if (choice.kind === 'perk') {
    if (sim.firstPerk[choice.id] === undefined) sim.firstPerk[choice.id] = sim.t;
    r.perks[choice.id] += count;
    if (choice.id === 'huntFocus') r.huntFocusLv = (r.huntFocusLv || 0) + count;
  } else {
    r.upgradePerks[choice.id] += count;
  }
  r.rewardCategoryCounts[cat] = (r.rewardCategoryCounts[cat] || 0) + count;
  r.rewardByType[typeId || 'normal'] = (r.rewardByType[typeId || 'normal'] || 0) + count;
}

function defeatMonster(sim, mon) {
  const r = sim.run;
  const typeId = mon.typeId || 'normal';
  const M = P.mtype;
  // こつぶ群れ=3体分(討伐数・報酬イベントとも)。ボスは討伐周期をリセット
  const units = (M && M.rewardEvents && M.rewardEvents[typeId]) || 1;
  r.kills += units;
  r.killsByType[typeId] = (r.killsByType[typeId] || 0) + units;
  if (typeId === 'boss') r.killsSinceBoss = 0; else r.killsSinceBoss += units;
  // はやての運び屋: 撃破すると次の金クッキーが早く来る
  if (typeId === 'speedy' && M) r.nextGoldenSpawnMultiplier *= M.speedyGoldenCut;
  // 異世界接続網 段階2: 狩り窓中の討伐で窓を延長(完全放置は窓中に討伐を寄せられず延長なし: 条件⑬)
  if (resActive(sim, 'portalNetwork') && resStage2(sim, 'portalNetwork') && sim.t < r.portalHuntUntil
    && !idleOn(sim, 'huntExtend')) {
    r.portalHuntUntil += P.res2.huntExtendSec;
  }
  if (!r.quotaFailed) r.quotaMonsterKills += units;
  // 討伐連鎖(第12次D): breakSec以内の連続討伐で+units(こつぶ群れ=3体分)、途切れたら振出し
  if (P.chain) {
    r.chainN = (sim.t - r.chainLastT) <= P.chain.breakSec ? r.chainN + units : units;
    r.chainLastT = sim.t;
    if (r.chainN > r.chainMax) r.chainMax = r.chainN;
  }
  const chainPrepLv = rwOff(sim, 'chainPrep') ? 0 : (r.perks.chainPrep || 0);
  if (chainPrepLv > 0) {
    r.nextMonsterSpawnMultiplier *= Math.exp(-chainPrepLv * P.rw.chainPrepSpawn);
    r.nextMonsterHpMultiplier *= Math.pow(P.rw.chainPrepHp, chainPrepLv);
  }
  const beastScentLv = rwOff(sim, 'beastScent') ? 0 : (r.perks.beastScent || 0);
  if (beastScentLv > 0) r.nextGoldenSpawnMultiplier *= Math.exp(-beastScentLv * P.rw.beastScent);

  const focusLv = r.huntFocusLv || 0;
  let bonus = 0;
  if (focusLv > 0) { bonus += 1; r.huntFocusLv = 0; }
  const mutationLv = rwOff(sim, 'goldenBeastMutation') ? 0 : (r.perks.goldenBeastMutation || 0);
  if (mutationLv > 0 && goldenBoostActive(sim)) {
    // 期待値: 確率を蓄積して1超えで+1
    const chance = 1 - Math.exp(-(P.rw.mutationBase + mutationLv * P.rw.mutationPerLv));
    r.nextRewardCountBonus += chance;
  }
  r.nextRewardCountBonus += bonus;

  // 種類ごとの報酬イベント(こつぶ群れは1体ずつ×3回。相性は1体あたりで適用)
  r.lastKillType = typeId; // 報酬選択画面に「種類と相性倍率」が表示される(方針はこれを見て選べる)
  for (let ev = 0; ev < units; ev++) {
    const offer = buildRewardOffer(sim, mon.level, typeId);
    if (ev === 0) r.nextRewardCountBonus = 0;
    const pick = sim.strat.pickReward(sim, offer);
    if (pick) applyReward(sim, pick, typeId);
  }
}

// ================= 転生処理 =================
function cheapestUnownedSkillCost(sim) {
  // 前提を満たす購入可能ノードの最安(生産系優先、なければQoL含む)。⑭の分母
  let best = Infinity, bestAny = Infinity;
  for (const n of SKILL_NODES) {
    if (sim.skills[n.id]) continue;
    if (!n.prereqs.every(q => sim.skills[q])) continue;
    const c = skillCostOf(n);
    bestAny = Math.min(bestAny, c);
    if (!isUtilitySkill(n.id)) best = Math.min(best, c);
  }
  if (best !== Infinity) return best;
  if (bestAny !== Infinity) return bestAny;
  return null;
}
function doPrestige(sim) {
  const r = sim.run;
  // 転生には所持クッキー100万の消費が必要
  if (r.cookies < 1000000) return false;
  const gain = prestigeGainOf(r.runCookies);
  if (gain <= 0) return false;
  const nextCostAt = cheapestUnownedSkillCost(sim); // ⑭: 購入前の次スキル最安
  r.cookies -= 1000000;
  sim.prestige += gain;
  sim.prestigeTotal += gain;
  sim.prestigeRuns++;

  // 周回記録
  sim.runs.push({
    idx: sim.runs.length,
    startT: r.startT, endT: sim.t,
    duration: sim.t - r.startT,
    runCookies: r.runCookies,
    quotaHold: r.quotaHoldSeconds,
    maxStage: r.maxStage,
    kills: r.kills, golden: r.goldenTaken, chainMax: r.chainMax,
    gain,
    researchBought: Object.keys(r.research).filter(k => r.research[k]),
    stages2: Object.keys(r.research2).filter(k => r.research2[k]),
    stages3: Object.keys(r.research3).filter(k => r.research3[k]),
    quotaFailAt: r.quotaFailAt,
    gainSeries: (sim.opt.trackGain && r.quotaFailAt != null) ? r.gainSeries : undefined,
    perks: Object.assign({}, r.perks),
    upgradePerkTotal: Object.values(r.upgradePerks).reduce((a, b) => a + b, 0),
    upCounts: Object.assign({}, r.upgrades),
    nextSkillCost: nextCostAt, gainToNext: nextCostAt ? gain / nextCostAt : null,
    critAtBuy: r.critAtBuy, critEnd: r.critNow, critMax: r.critMax,
    killsByType: Object.assign({}, r.killsByType), rewardByType: Object.assign({}, r.rewardByType),
    measure: finalizeMeasure(r)
  });

  // スキル購入(戦略の優先順で、買えるだけ)
  const bought = [];
  let progress = true;
  while (progress) {
    progress = false;
    const order = sim.strat.skillOrder(sim);
    for (const id of order) {
      const node = SKILL_BY_ID[id];
      if (!node || sim.skills[id]) continue;
      if (!node.prereqs.every(q => sim.skills[q])) continue;
      const cost = skillCostOf(node);
      if (sim.prestige >= cost) {
        sim.prestige -= cost;
        sim.skills[id] = true;
        bought.push(id);
        progress = true;
        break;
      }
    }
  }
  if (bought.length > 0) sim.unlockEvents.push({ t: sim.t, kind: 'skill', id: bought.join('+'), n: bought.length });
  sim.runs[sim.runs.length - 1].skillsBought = bought.length;
  sim.runs[sim.runs.length - 1].skillIds = bought;
  sim._fx = {}; sim._fxHas = {}; sim._stT = -1; sim._bkT = -1;

  // 提案8: 今周回の天井を持ち越す(次周回の層の試練の相対基準)。表示層数は絶対累積のまま。
  sim.prevMaxStage = r.maxStage;
  // 提案9: 今周回の長さを持ち越す(次周回の到達連動ノルマの進行比の分母)。
  sim.prevDuration = sim.t - r.startT;
  // 提案10: 周回長の履歴に追加(reach の分母=直近K周回の移動中央値に使う)。
  sim.durations.push(sim.prevDuration);
  if (P.quota.reachDenomK > 0 && sim.durations.length > P.quota.reachDenomK) {
    sim.durations.splice(0, sim.durations.length - P.quota.reachDenomK);
  }

  // 新周回
  sim.run = newRun(sim);
  sim.run.policy = sim.strat.pickPolicy(sim);
  const sc = Math.floor(skillEffect(sim, 'startCookies'));
  if (sc > 0) earn(sim, sc);
  scheduleGolden(sim);
  scheduleMonster(sim);
  return true;
}

function scheduleGolden(sim) {
  const r = sim.run;
  const mean = (P.golden.spawnMin + P.golden.spawnMax) / 2;
  const raw = mean * goldenSpawnFactor(sim) * (r.nextGoldenSpawnMultiplier || 1);
  r.nextGoldenSpawnMultiplier = 1;
  r.goldenTimer = (1000 + raw) / 1000; // protectedWait floor 1000ms
}
function scheduleMonster(sim) {
  const r = sim.run;
  const level = monsterLevel(sim);
  const levelFactor = 1 - 0.10 * (1 - Math.exp(-level / 8));
  const mean = (P.monster.spawnMin + P.monster.spawnMax) / 2;
  const raw = mean * levelFactor * monsterSpawnFactor(sim) * (r.nextMonsterSpawnMultiplier || 1);
  r.nextMonsterSpawnMultiplier = 1;
  r.monsterTimer = (1000 + raw) / 1000;
}

// ================= メインループ =================
// 1秒ぶん進める。転生が起きたら true を返す(スナップショット/1周回分岐再実行の境界検出用)
function advanceTick(sim, strategy) {
  const dt = 1;
  {
    sim.t += dt;
    if (sim.hourly && sim.t % 60 === 0) sim.hourly.push(sim.totalCookies);
    if (sim.debugTrace && sim.runs.length === sim.opt.debugRunIdx) {
      const rr = sim.run;
      sim.debugTrace.push({ t: sim.t, el: sim.t - rr.startT, c: rr.runCookies, boosts: rr.boosts.length, bm: goldenBoostMultiplier(sim), mon: !!rr.monster, kills: rr.kills, gold: rr.goldenTaken });
    }
    const r = sim.run;
    purgeBoosts(sim);
    // afterheat 有効化(fromを過ぎたものだけ乗せる)
    r.afterheats = r.afterheats.filter(a => a.until > sim.t);
    const prod = computeProd(sim);
    sim._lastProd = prod; // ㉑判定用: 直近の生産値
    // ㉓(会心1%開始)用: 研究取得直後/転生時点/周回最大の会心率を記録
    if (prod.critChance > 0) {
      if (r.critAtBuy === undefined) r.critAtBuy = prod.critChance;
      r.critNow = prod.critChance;
      if (prod.critChance > r.critMax) r.critMax = prod.critChance;
    }
    // 各回の期待値測定(①②③⑨⑫⑬): 3秒ごとにサンプル。機能込み÷機能抜きの稼ぎ力を対数平均
    if (sim.opt.measure && sim.t % 3 === 0) measureTick(sim);
    let ahM = 1;
    for (const a of r.afterheats) if (sim.t >= a.from) ahM *= a.mult;

    const cpsNow = prod.cps * ahM;
    const clickNow = prod.clickEV * ahM;

    // タップとモンスター
    const tapRate = strategy.tapRate;
    let tapsForCookies = tapRate;
    if (r.monster) {
      const dmg = monsterDamage(sim, prod);
      let firstBonus = 0;
      if (r.monster.goldenFirstHitReady && !r.monster.firstHitUsed) {
        firstBonus = dmg * ((r.perks.goldenFirstHit || 0) * effRw(sim, 'goldenFirstHit'));
        r.monster.firstHitUsed = true;
      }
      let hits = tapRate * dt;
      let dealt = hits * dmg * (1 + (r.huntFocusLv || 0)) + firstBonus;
      // 甘噛み回収
      const biteLv = rwOff(sim, 'biteRecovery') ? 0 : (r.perks.biteRecovery || 0);
      if (biteLv > 0) {
        const rawRec = dmg * clickNow * P.rw.biteRecovery * biteLv * hits;
        const softLine = Math.max(1, cpsNow * 2);
        earn(sim, rawRec / (1 + rawRec / softLine) + Math.log1p(rawRec / softLine) * softLine * 0.08);
      }
      r.monster.hp -= dealt;
      tapsForCookies = 0;
      if (r.monster.hp <= 0) {
        defeatMonster(sim, r.monster);
        r.monster = null;
        scheduleMonster(sim);
      } else {
        r.monster.stayLeft -= dt;
        if (r.monster.stayLeft <= 0) {
          // 逃した
          if ((r.huntFocusLv || 0) > 0) {
            r.nextMonsterHpMultiplier *= 0.75;
            r.huntFocusRewardPenalty = Math.max(r.huntFocusRewardPenalty || 0, 1);
            r.huntFocusLv = 0;
          }
          r.monster = null;
          scheduleMonster(sim);
        }
      }
    }

    // 収入
    earn(sim, cpsNow * dt + clickNow * tapsForCookies * dt);

    // 銀行クリック配当 段階2: 複利利息。キャップ撤廃: 硬い min(利息, 毎秒生産×2) を
    // 漸近逓減式 raw/(1+raw/soft) に置換(暴走防止。softは段3で最高層に応じ無限に伸びる)
    if (resActive(sim, 'bankClickDividend') && resStage2(sim, 'bankClickDividend')) {
      const bank = r.upgrades.bank || 0;
      if (bank > 0 && r.cookies > 0) {
        let soft = cpsNow * P.res2.bankIntCapCps;
        if (resStage3(sim, 'bankClickDividend')) soft *= 1 + P.res2.bankCapStageCoef * r.maxStage;
        const raw = r.cookies * P.res2.bankIntRate * Math.log10(1 + bank);
        if (soft > 0 && raw > 0) earn(sim, raw / (1 + raw / soft) * dt);
      }
    }

    // 指先の型 段階3: 会心の余熱(会心のたびに毎秒生産×0.00025×最高層の追加獲得。キャップ撤廃)
    if (tapsForCookies > 0 && resActive(sim, 'fingerTechnique') && resStage3(sim, 'fingerTechnique') && prod.critChance > 0) {
      earn(sim, tapsForCookies * prod.critChance * cpsNow * P.res2.critCpsCoef * r.maxStage * dt);
    }

    // 重力圧縮 段階2: 圧縮チャージ(満タンで発動、期待値=即時発動)
    if (resActive(sim, 'blackHoleCompression') && resStage2(sim, 'blackHoleCompression')) {
      const bh = r.upgrades.blackHoleMixer || 0;
      r.bhCharge += Math.sqrt(bh) * dt;
      const maxUses = resStage3(sim, 'blackHoleCompression') ? 3 : 2;
      if (r.bhCharge >= P.res2.bhChargeFull && r.bhUses < maxUses && sim.t >= r.bhBoostUntil) {
        // タイミング(条件⑬): 最適操作は満タンで即発動 / 完全放置は気づくまで遅延
        if (r.bhReadyAt == null) r.bhReadyAt = sim.t + (idleOn(sim, 'bhCharge') ? P.timing.bhIdleDelay : 0);
        if (sim.t >= r.bhReadyAt) {
          let mult = 1 + P.res2.bhBoostCoef * Math.sqrt(bh) / 10;
          if (resStage3(sim, 'blackHoleCompression')) mult *= 1 + P.res2.bhBoostStageCoef * r.maxStage;
          r.bhBoostMult = mult;
          r.bhBoostUntil = sim.t + P.res2.bhBoostDur;
          r.bhCharge = 0;
          r.bhUses++;
          r.bhReadyAt = null;
        }
      }
    }

    // 金クッキー
    r.goldenTimer -= dt;
    if (r.goldenTimer <= 0) {
      if (strategy.goldenTake >= 1 || (sim.t % Math.ceil(1 / Math.max(0.01, strategy.goldenTake))) < 1) {
        collectGolden(sim, prod);
      }
      scheduleGolden(sim);
    }

    // モンスター出現
    if (!r.monster) {
      r.monsterTimer -= dt;
      if (r.monsterTimer <= 0) {
        const quota = monsterQuotaRequired(sim);
        const met = quota !== null && r.runCookies >= quota;
        if (met && !r.quotaFailed) {
          const level = monsterLevel(sim);
          const typeId = pickMonsterType(sim);
          const tHp = (P.mtype && P.mtype.hpMul && P.mtype.hpMul[typeId]) || 1;
          const tStay = (P.mtype && P.mtype.stayMul && P.mtype.stayMul[typeId]) || 1;
          const maxHp = Math.max(40, Math.floor(monsterHpValue(sim, level) * tHp * (r.nextMonsterHpMultiplier || 1)));
          r.nextMonsterHpMultiplier = 1;
          r.monster = {
            typeId, level, hp: maxHp, maxHp,
            stayLeft: monsterStayMs(sim) * tStay / 1000,
            goldenChainMultiplier: r.goldenChainReady ? 1 + (r.perks.goldenChain || 0) * effRw(sim, 'goldenChain') : 1,
            goldenFirstHitReady: r.goldenFirstHitReady,
            firstHitUsed: !r.goldenFirstHitReady
          };
          r.goldenChainReady = false;
          r.goldenFirstHitReady = false;
        }
        scheduleMonster(sim);
      }
    }

    // ノルマ判定(本来のノルマのみ。追跡ノルマは廃止=2026-07-06 ユーザー決定、T3a/T3bはノルマ係数で作る)
    if (!r.quotaFailed) {
      let quota = monsterQuotaRequired(sim);
      const el = elapsed(sim);
      // 到達連動ノルマ(提案9): 進行比 ρ=周回内経過秒/max(前回周回長,reachMinSec) が ρ* を越えたら未達。
      // 層ゲージ(quotaAtElapsed)には触れず、ここでの未達判定にだけ到達項を上乗せする(max)。
      // runCookies×reachCoef×ρ^reachPow と runCookies を比べる=クッキー桁に依存せず ρ で未達位置が決まる。
      // 進行を層比でなく時間比にする(未達で層が凍結するため層比は序盤に寄る=第12次H実測)。
      if (quota !== null && quota > 0 && P.quota.reachCoef) {
        // 提案10: 分母は直近K周回の長さの移動中央値(履歴が空なら直前1周回=旧挙動へフォールバック)。
        let denom = Math.max(reachDenomBase(sim), P.quota.reachMinSec || 0);
        // reachMaxSec>0 のとき denom を上限クランプ(直前が極端に長い→短い周回で reach 未発火を防ぐ)。
        if (P.quota.reachMaxSec) denom = Math.min(denom, P.quota.reachMaxSec);
        if (denom > 0) {
          const rho = el / denom;
          const reach = r.runCookies * P.quota.reachCoef * Math.pow(rho, P.quota.reachPow);
          if (reach > quota) quota = reach;
        }
      }
      if (quota !== null && quota > 0 && r.runCookies < quota) {
        r.quotaFailed = true;
        r.quotaFailAt = el; // 未達に転じた経過秒(条件⑧用)
        if (r.monster) { r.monster = null; }
      } else {
        r.quotaHoldSeconds = Math.max(r.quotaHoldSeconds, el);
      }
    }
    const st = currentStage(sim);
    if (st > r.maxStage) r.maxStage = st;

    // 条件⑧用: 「いま転生した場合の獲得PT」の毎秒系列を記録
    if (sim.opt.trackGain) {
      if (!r.gainSeries) r.gainSeries = [];
      r.gainSeries.push(prestigeGainOf(r.runCookies));
    }

    // ⑫(文脈依存性)用: 「次に買う最も費用対効果の高い設備」を定期サンプリング
    if (sim.opt.trackChoices && sim.t % 300 === 0) {
      const b = bestEfficiency(sim, prod, null);
      if (b) { sim.choiceSamples = sim.choiceSamples || []; sim.choiceSamples.push(b.id); }
    }

    // 購入(戦略)
    strategy.buy(sim, prod);

    // 転生判断
    if (prestigeUnlockedFn(sim) && strategy.shouldPrestige(sim)) {
      return doPrestige(sim);
    }
  }
  return false;
}

// ==== 周回境界スナップショット(3-2 無効化テストの方式・2026-07-06) ====
// 「その回だけ無効」判定: 周回kの開始状態から、その機能をその回だけ効果ゼロにして
// 周回kを再実行し、有効時の周回kと獲得効率(周回総クッキー÷周回時間)を比較する。
// 他の回は無効化しない(前後の周回の軌道ずれが混入しない)。
function takeSnapshot(sim) {
  return structuredClone({
    t: sim.t, prestige: sim.prestige, prestigeTotal: sim.prestigeTotal,
    prestigeRuns: sim.prestigeRuns, totalCookies: sim.totalCookies,
    prevMaxStage: sim.prevMaxStage, prevDuration: sim.prevDuration, durations: sim.durations,
    skills: sim.skills, rotIdx: sim.rotIdx, upRotIdx: sim.upRotIdx, goldenAlt: sim.goldenAlt,
    firstResearchBuy: sim.firstResearchBuy, firstPerk: sim.firstPerk, firstStageBuy: sim.firstStageBuy,
    run: sim.run
  });
}
// スナップショットから1周回だけ再実行(転生した時点で終了)。opts に disableResearch 等を渡す。
// capSec: 再実行の打ち切り(周回開始からの秒数)。打ち切り時は partial の効率で比較する。
function replayRun(strategy, snap, opts, capSec) {
  const sim = newSim(strategy, opts);
  const s = structuredClone(snap);
  sim.t = s.t; sim.prestige = s.prestige; sim.prestigeTotal = s.prestigeTotal;
  sim.prestigeRuns = s.prestigeRuns; sim.totalCookies = s.totalCookies;
  sim.prevMaxStage = s.prevMaxStage || 0;
  sim.prevDuration = s.prevDuration || 0;
  sim.durations = (s.durations || []).slice();
  sim.skills = s.skills; sim.rotIdx = s.rotIdx; sim.upRotIdx = s.upRotIdx; sim.goldenAlt = s.goldenAlt;
  sim.firstResearchBuy = s.firstResearchBuy; sim.firstPerk = s.firstPerk; sim.firstStageBuy = s.firstStageBuy;
  sim.run = s.run;
  const horizonAbs = sim.run.startT + (capSec != null ? capSec : sim.opt.hours * 3600);
  while (sim.t < horizonAbs) {
    if (advanceTick(sim, strategy)) break; // この周回の転生で終了
  }
  if (sim.runs.length > 0) return sim.runs[sim.runs.length - 1];
  const r = sim.run;
  return {
    startT: r.startT, endT: sim.t, duration: sim.t - r.startT,
    runCookies: r.runCookies, quotaHold: r.quotaHoldSeconds, maxStage: r.maxStage,
    kills: r.kills, golden: r.goldenTaken, quotaFailAt: r.quotaFailAt, partial: true
  };
}

function simulate(strategy, opts) {
  const sim = newSim(strategy, opts);
  sim.run = newRun(sim);
  sim.run.policy = strategy.pickPolicy(sim);
  scheduleGolden(sim);
  scheduleMonster(sim);
  const horizon = sim.opt.hours * 3600;
  sim.hourly = [];
  if (sim.opt.debugRunIdx != null) sim.debugTrace = [];
  if (sim.opt.snapshots) sim.snapshots = [takeSnapshot(sim)];
  while (sim.t < horizon) {
    const prestiged = advanceTick(sim, strategy);
    if (prestiged && sim.opt.snapshots) sim.snapshots.push(takeSnapshot(sim));
  }

  // 終了時の進行中周回も記録
  const r = sim.run;
  sim.runs.push({
    idx: sim.runs.length, startT: r.startT, endT: sim.t,
    duration: sim.t - r.startT, runCookies: r.runCookies,
    quotaHold: r.quotaHoldSeconds, maxStage: r.maxStage,
    kills: r.kills, golden: r.goldenTaken,
    gain: prestigeGainOf(r.runCookies), partial: true,
    researchBought: Object.keys(r.research).filter(k => r.research[k]),
    stages2: Object.keys(r.research2).filter(k => r.research2[k]),
    stages3: Object.keys(r.research3).filter(k => r.research3[k]),
    quotaFailAt: r.quotaFailAt,
    gainSeries: (sim.opt.trackGain && r.quotaFailAt != null) ? r.gainSeries : undefined,
    perks: Object.assign({}, r.perks),
    upgradePerkTotal: Object.values(r.upgradePerks).reduce((a, b) => a + b, 0),
    critAtBuy: r.critAtBuy, critEnd: r.critNow, critMax: r.critMax,
    killsByType: Object.assign({}, r.killsByType), rewardByType: Object.assign({}, r.rewardByType),
    skillsBought: 0, skillIds: []
  });
  return sim;
}

// 購入ヘルパー(unlockイベント記録込み)
function tryBuyUpgrade(sim, u, budgetRatio) {
  const cost = upgradeCost(sim, u);
  if (cost > sim.run.cookies * budgetRatio) return false;
  if (cost > sim.run.cookies) return false;
  sim.run.cookies -= cost;
  sim.run.upgrades[u.id]++;
  // まとめ買い割増: 熱量を減衰させてから+1
  {
    const r2 = sim.run;
    const sg = r2.surge[u.id] || (r2.surge[u.id] = { h: 0, t: sim.t });
    sg.h = sg.h * Math.pow(0.5, (sim.t - sg.t) / Math.max(1, P.upSurge.halfSec)) + 1;
    sg.t = sim.t;
  }
  if (!sim.everUpgrade[u.id]) {
    sim.everUpgrade[u.id] = true;
    sim.unlockEvents.push({ t: sim.t, kind: 'upgrade', id: u.id });
    // 条件㉑(新設備の存在感): 初めて買った瞬間の「その1台の実生産(系列・熟練など固有能力込み、
    // 研究・スキル倍率も自然に通る)」を、購入直前の実CPSと比較する。Δ生産方式(2026-07-06 解釈更新):
    // Δ = 購入後の生産 − 購入直前の生産。判定は Δ ≥ 購入直前CPS × 1/5(runner側)
    if (sim._lastProd) {
      if (!sim.presenceChecks) sim.presenceChecks = [];
      const before = u.type === 'click' ? sim._lastProd.baseClick : sim._lastProd.baseCps;
      const after = computeProd(sim);
      const av = u.type === 'click' ? after.baseClick : after.baseCps;
      sim.presenceChecks.push({ runIdx: sim.runs.length, t: sim.t, id: u.id, delta: Math.max(0, av - before), ref: before });
    }
  }
  return true;
}
function tryBuyResearch(sim, id, budgetRatio) {
  const r = sim.run;
  if (r.research[id]) return false;
  // 無効化(disableResearch)でも購入行動は同じ: 効果だけがゼロになる
  const def = RESEARCH.find(x => x.id === id);
  if (!def || !researchUnlocked(sim, def)) return false;
  const cost = researchCostOf(sim, id);
  if (cost > r.cookies * budgetRatio) return false;
  r.cookies -= cost;
  r.research[id] = true;
  if (sim.firstResearchBuy[id] === undefined) sim.firstResearchBuy[id] = sim.t;
  if (!sim.everResearch[id]) {
    sim.everResearch[id] = true;
    sim.unlockEvents.push({ t: sim.t, kind: 'research', id });
  }
  return true;
}
// 研究段階(段2/段3)の購入。研究購入枠の延長として同じ予算基準で買う
function tryBuyResearchStage(sim, id, stage, budgetRatio) {
  const r = sim.run;
  if (stage === 2 ? r.research2[id] : r.research3[id]) return false;
  // 無効化(disableStage)でも購入行動は同じ: 効果だけがゼロになる
  if (!researchStageUnlocked(sim, id, stage)) return false;
  const cost = researchStageCostOf(sim, id, stage);
  if (cost > r.cookies * budgetRatio) return false;
  r.cookies -= cost;
  if (stage === 2) r.research2[id] = true; else r.research3[id] = true;
  const key = id + ':' + stage;
  if (sim.firstStageBuy[key] === undefined) sim.firstStageBuy[key] = sim.t;
  if (!sim.everStage[key]) {
    sim.everStage[key] = true;
    // 段階購入も「解放イベント」として記録(帯域判定⑥の対象)
    sim.unlockEvents.push({ t: sim.t, kind: 'stage', id: key });
  }
  return true;
}
// 1個あたりの研究・支援・個別強化込み倍率(ショップの「次 +N」相当)
function upgradeUnitMult(sim, u) {
  const r = sim.run;
  const R = P.res;
  const i = UPIDX[u.id];
  const owned = r.upgrades[u.id];
  const upPerkPower = 1 + skillEffect(sim, 'upgradePerkPower')
    + (r.perks.crushedMill * (rwOff(sim, 'crushedMill') ? 0 : P.rw.crushedMill))
    + rewardCategoryBonus(sim, 'equipment');
  const boostRate = Math.max(P.upPerk.floor, P.upPerk.base - i * P.upPerk.slope) * upPerkPower;
  const personal = 1 + (r.upgradePerks[u.id] || 0) * boostRate;
  let resM = 1;
  const stage = currentStage(sim);
  if (u.id === 'grandma' && resActive(sim, 'grandmaCrowd')) resM *= R.grandmaSelf;
  if (u.id === 'oven' && resActive(sim, 'ovenBatch')) resM *= R.ovenSelf * lg(owned, R.ovenOwn) * lg(Math.max(0, stage - 1), R.ovenStage);
  if (u.id === 'factory' && resActive(sim, 'factoryNetwork')) {
    const low = (r.upgrades.finger || 0) + (r.upgrades.grandma || 0) + (r.upgrades.oven || 0);
    resM *= R.factorySelf * lg(low, R.factoryLow) * lg(owned, R.factoryOwn);
  }
  if (u.id === 'spiceRack' && resActive(sim, 'spiceBlend')) resM *= lg(owned, R.spiceOwn);
  if (u.id === 'portal' && resActive(sim, 'portalNetwork')) resM *= R.portalSelf;
  if (u.id === 'galaxyFactory' && resActive(sim, 'galaxyAssembly')) {
    const types = UPGRADES.filter(x => (r.upgrades[x.id] || 0) > 0).length;
    resM *= lg(types, R.galaxyTypes) * lg(owned, R.galaxyOwn);
  }
  if (u.id === 'quantumBakery' && resActive(sim, 'quantumProofing')) {
    const rc = RESEARCH.filter(x => r.research[x.id]).length;
    resM *= lg(rc, R.quantumRes) * lg(owned, R.quantumOwn);
  }
  let supM = 1;
  if (resActive(sim, 'grandmaCrowd')) {
    const g = r.upgrades.grandma || 0;
    if (u.id === 'finger') supM *= lg(g, R.grandmaSup[0]);
    if (u.id === 'oven') supM *= lg(g, R.grandmaSup[1]);
    if (u.id === 'factory') supM *= lg(g, R.grandmaSup[2]);
  }
  return personal * resM * supM;
}

// 効率最良アップグレード(次の1個の増分/コスト、ショップ表示と同じ情報)
function bestEfficiency(sim, prod, typeFilter) {
  let best = null, bestVal = 0;
  for (const u of visibleUpgrades(sim)) {
    if (typeFilter && u.type !== typeFilter) continue;
    const cost = upgradeCost(sim, u);
    const val = (u.value * upgradeUnitMult(sim, u)) / cost;
    if (val > bestVal) { bestVal = val; best = u; }
  }
  return best;
}

module.exports = {
  P, UPGRADES, RESEARCH, REWARD_POOL, SKILL_NODES, SKILL_BY_ID,
  simulate, prestigeGainOf, skillCostOf, upgradeCost, researchCostOf,
  tryBuyUpgrade, tryBuyResearch, bestEfficiency, visibleUpgrades, quotaAtElapsed,
  isUtilitySkill, buildSkillValues, skillRank, skillRiders, trunc2sig, q5, q5cost,
  tryBuyResearchStage, researchStageCostOf, researchStageUnlocked,
  replayRun, takeSnapshot, bandY
};
