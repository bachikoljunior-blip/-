'use strict';
// 10プレイ方針。プレイヤーから見える情報(コスト・所持・現在/次の増分・ノルマ表示・報酬プレビュー)のみで判断。
// 各方針は数値条件まで固定。全周回のクッキー合計最大化を狙う設計(シミュ条件は考慮しない)。
const G = require('./sim.js');

function branchOf(id) {
  if (id === 'core') return 'core';
  if (id.startsWith('click_')) return 'click';
  if (id.startsWith('golden_')) return 'golden';
  if (id.startsWith('auto_') || id === 'bake_temperature') return 'auto';
  if (id.startsWith('monster_') || id === 'hunt_analysis') return 'monster';
  if (id.startsWith('economy_') || id === 'order_board') return 'economy';
  if (id.startsWith('research_')) return 'research';
  if (id.startsWith('upgrade_')) return 'upgrade';
  if (id.startsWith('unlock_reward_') || id.startsWith('reward_')) return 'reward';
  if (id.startsWith('start_') || id === 'offline_1') return 'start';
  return 'master';
}

// スキル順: 系統優先→安い順。優先系統にないものも後で買う(全取得を目指す)。
// 生産・解放ノードを先に、解析系QoLノードは余りPTで後から取る
function skillOrderByBranch(priority) {
  return function (sim) {
    const nodes = G.SKILL_NODES.slice();
    nodes.sort((a, b) => {
      const ua = G.isUtilitySkill(a.id) ? 1 : 0; const ub = G.isUtilitySkill(b.id) ? 1 : 0;
      if (ua !== ub) return ua - ub;
      const pa = priority.indexOf(branchOf(a.id)); const pb = priority.indexOf(branchOf(b.id));
      const qa = pa < 0 ? 99 : pa; const qb = pb < 0 ? 99 : pb;
      if (qa !== qb) return qa - qb;
      return G.skillCostOf(a) - G.skillCostOf(b);
    });
    return nodes.map(n => n.id);
  };
}
const cheapestFirst = function (sim) {
  return G.SKILL_NODES.slice().sort((a, b) => {
    const ua = G.isUtilitySkill(a.id) ? 1 : 0; const ub = G.isUtilitySkill(b.id) ? 1 : 0;
    if (ua !== ub) return ua - ub;
    return G.skillCostOf(a) - G.skillCostOf(b);
  }).map(n => n.id);
};

function cheapestNextSkillCost(sim) {
  // プレイヤーは生産・解放に効くノードを転生目標にする(解析系QoLノードはついで取り)
  let best = Infinity, bestAny = Infinity;
  for (const n of G.SKILL_NODES) {
    if (sim.skills[n.id]) continue;
    if (!n.prereqs.every(q => sim.skills[q])) continue;
    const c = G.skillCostOf(n);
    bestAny = Math.min(bestAny, c);
    if (!G.isUtilitySkill(n.id)) best = Math.min(best, c);
  }
  if (best !== Infinity) return best;
  if (bestAny !== Infinity) return bestAny;
  return null;
}

function pickRewardByPriority(priority) {
  return function (sim, offer) {
    for (const want of priority) {
      const c = offer.find(o => o.kind === 'perk' && o.id === want);
      if (c) return c;
    }
    const up = offer.find(o => o.kind === 'upgrade');
    if (up) return up;
    return offer[0] || null;
  };
}
// 個別強化優先(最上位設備の強化を選ぶ)
function pickRewardUpgradeFirst(fallback) {
  return function (sim, offer) {
    const ups = offer.filter(o => o.kind === 'upgrade');
    if (ups.length > 0) {
      ups.sort((a, b) => (G.UPGRADES.findIndex(u => u.id === b.id)) - (G.UPGRADES.findIndex(u => u.id === a.id)));
      return ups[0];
    }
    return pickRewardByPriority(fallback)(sim, offer);
  };
}

// 研究購入枠: 段1に加え、解放済みの段2/段3カードも同じ予算基準で買う(購入対象リストが増えるだけ)
function buyResearchLine(sim, id, ratio) {
  G.tryBuyResearch(sim, id, ratio);
  G.tryBuyResearchStage(sim, id, 2, ratio);
  G.tryBuyResearchStage(sim, id, 3, ratio);
}

// 研究一括パス: 全研究ラインを予算比で購入試行
function buyAllResearch(sim, ratio) {
  for (const r of G.RESEARCH) buyResearchLine(sim, r.id, ratio);
}

// 標準買い物: 研究(段階含む)→効率良アップグレード→(設備購入で解放された研究の即時購入)
// 最後の研究パスは「設備を買った直後に出現した研究カードをその場で買う」プレイヤー動作の再現
function standardBuy(researchRatio, upgradeRatio) {
  return function (sim, prod) {
    // 研究: 安い順に、コストが所持のresearchRatio以下なら買う(段2/段3カードも同枠)
    buyAllResearch(sim, researchRatio);
    // アップグレード: 効率最良を、コストが所持のupgradeRatio以下の間買い続ける(最大30回/秒)
    for (let i = 0; i < 30; i++) {
      const u = G.bestEfficiency(sim, prod, null);
      if (!u) break;
      if (!G.tryBuyUpgrade(sim, u, upgradeRatio)) break;
    }
    buyAllResearch(sim, researchRatio);
  };
}

function prestigeWhen(minElapsedSec, gainFactor) {
  // 「この周回の獲得予定PTだけで、次に欲しいスキルのコストに届いたら転生」
  return function (sim) {
    if (sim.t - sim.run.startT < minElapsedSec) return false;
    if (sim.run.cookies < 1000000) return false; // 転生には100万クッキー必要
    const next = cheapestNextSkillCost(sim);
    if (next === null) return false; // ツリー完了後はPTの使い道がないため転生しない
    const gain = G.prestigeGainOf(sim.run.runCookies);
    return gain >= next * gainFactor && gain >= 1;
  };
}

const STRATEGIES = [
  {
    id: 'S1', name: 'バランス効率型',
    // タップ4/秒。研究はコスト<=所持30%、強化は効率最良をコスト<=所持25%で購入。
    // 転生は「所持PT+獲得見込みPT >= 次スキル最安コスト×1.2」かつ経過300秒以上。
    tapRate: 4, goldenTake: 1,
    pickPolicy: sim => 'bake',
    buy: standardBuy(0.30, 0.25),
    pickReward: pickRewardByPriority(['beastHeatFerment', 'goldenAmount', 'monsterDamage', 'huntingCore', 'goldenRate', 'monsterRate', 'goldenPower', 'crackedFang', 'monsterStay']),
    shouldPrestige: prestigeWhen(120, 1.2),
    skillOrder: cheapestFirst
  },
  {
    id: 'S2', name: 'クリック会心型',
    // タップ7/秒。クリック系強化はコスト<=所持40%、その他<=10%。研究は指先の型・銀行配当を<=50%で優先。
    tapRate: 7, goldenTake: 1,
    pickPolicy: sim => 'click',
    buy: function (sim, prod) {
      buyResearchLine(sim, 'fingerTechnique', 0.50);
      buyResearchLine(sim, 'bankClickDividend', 0.50);
      for (const r of G.RESEARCH) buyResearchLine(sim, r.id, 0.20);
      for (let i = 0; i < 30; i++) {
        const clicks = G.visibleUpgrades(sim).filter(u => u.type === 'click');
        let done = false;
        for (const u of clicks) { if (G.tryBuyUpgrade(sim, u, 0.40)) { done = true; break; } }
        if (!done) {
          const u = G.bestEfficiency(sim, prod, 'cps');
          if (!u || !G.tryBuyUpgrade(sim, u, 0.10)) break;
        }
      }
      buyResearchLine(sim, 'fingerTechnique', 0.50);
      buyResearchLine(sim, 'bankClickDividend', 0.50);
      buyAllResearch(sim, 0.20);
    },
    pickReward: pickRewardByPriority(['monsterDamage', 'crackedFang', 'goldenAmount', 'goldenTarget', 'brandHunt', 'goldenRate', 'beastHeatFerment']),
    shouldPrestige: prestigeWhen(120, 1.0),
    skillOrder: skillOrderByBranch(['core', 'click', 'golden', 'economy', 'research', 'monster', 'auto', 'upgrade', 'reward', 'start', 'master'])
  },
  {
    id: 'S3', name: '金クッキー特化型',
    // タップ4/秒。香料棚はコスト<=所持35%で優先購入。研究は香料調合<=60%優先。
    tapRate: 4, goldenTake: 1,
    pickPolicy: sim => 'golden',
    buy: function (sim, prod) {
      buyResearchLine(sim, 'spiceBlend', 0.60);
      for (const r of G.RESEARCH) buyResearchLine(sim, r.id, 0.25);
      for (let i = 0; i < 30; i++) {
        const spice = G.UPGRADES.find(u => u.id === 'spiceRack');
        const vis = G.visibleUpgrades(sim);
        let done = false;
        if (vis.includes(spice)) done = G.tryBuyUpgrade(sim, spice, 0.35);
        if (!done) {
          const u = G.bestEfficiency(sim, prod, null);
          if (!u || !G.tryBuyUpgrade(sim, u, 0.20)) break;
        }
      }
      buyResearchLine(sim, 'spiceBlend', 0.60);
      buyAllResearch(sim, 0.25);
    },
    pickReward: pickRewardByPriority(['goldenRate', 'goldenPower', 'goldenAmount', 'beastScent', 'goldenChain', 'goldenTarget', 'goldenFirstHit', 'beastHeatFerment']),
    shouldPrestige: prestigeWhen(120, 1.2),
    skillOrder: skillOrderByBranch(['core', 'golden', 'click', 'economy', 'research', 'auto', 'monster', 'upgrade', 'reward', 'start', 'master'])
  },
  {
    id: 'S4', name: '狩猟特化型',
    // タップ6/秒。ノルマ比(今回/必要)が2.0未満なら効率最良強化を<=50%で購入、それ以外<=20%。
    tapRate: 6, goldenTake: 1,
    pickPolicy: sim => 'hunt',
    buy: function (sim, prod) {
      for (const r of G.RESEARCH) buyResearchLine(sim, r.id, 0.30);
      const quota = Math.max(1, G.quotaAtElapsed(sim, sim.t - sim.run.startT));
      const ratio = sim.run.runCookies / quota;
      const budget = ratio < 2.0 ? 0.50 : 0.20;
      for (let i = 0; i < 30; i++) {
        const u = G.bestEfficiency(sim, prod, null);
        if (!u || !G.tryBuyUpgrade(sim, u, budget)) break;
      }
      buyAllResearch(sim, 0.30);
    },
    pickReward: pickRewardByPriority(['monsterRate', 'monsterDamage', 'beastHeatFerment', 'huntingCore', 'crackedFang', 'monsterStay', 'chainPrep', 'biteRecovery']),
    shouldPrestige: prestigeWhen(120, 1.2),
    skillOrder: skillOrderByBranch(['core', 'monster', 'auto', 'economy', 'research', 'reward', 'click', 'golden', 'upgrade', 'start', 'master'])
  },
  {
    id: 'S5', name: '研究貯蓄型',
    // タップ3/秒。研究はコスト<=所持80%で最優先。強化はコスト<=所持8%のみ。
    tapRate: 3, goldenTake: 1,
    pickPolicy: sim => 'bake',
    buy: function (sim, prod) {
      for (const r of G.RESEARCH) buyResearchLine(sim, r.id, 0.80);
      for (let i = 0; i < 30; i++) {
        const u = G.bestEfficiency(sim, prod, null);
        if (!u || !G.tryBuyUpgrade(sim, u, 0.08)) break;
      }
      buyAllResearch(sim, 0.80);
    },
    pickReward: pickRewardUpgradeFirst(['beastHeatFerment', 'goldenAmount', 'monsterDamage', 'goldenRate']),
    shouldPrestige: prestigeWhen(180, 2.0),
    skillOrder: skillOrderByBranch(['core', 'economy', 'research', 'auto', 'upgrade', 'click', 'golden', 'monster', 'reward', 'start', 'master'])
  },
  {
    id: 'S6', name: '早回し転生型',
    // タップ5/秒。強化<=30%。転生は経過240秒以上で「PT合計>=次スキル最安×1.0」になった瞬間。
    tapRate: 5, goldenTake: 1,
    pickPolicy: sim => 'balanced',
    buy: standardBuy(0.30, 0.30),
    pickReward: pickRewardByPriority(['goldenAmount', 'monsterDamage', 'beastHeatFerment', 'goldenRate', 'monsterRate']),
    shouldPrestige: prestigeWhen(120, 1.0),
    skillOrder: cheapestFirst
  },
  {
    id: 'S7', name: '長期育成型',
    // タップ4/秒。転生は「PT合計>=次スキル最安×4.0」または経過5400秒以上で獲得PT>=1。
    tapRate: 4, goldenTake: 1,
    pickPolicy: sim => 'bake',
    buy: standardBuy(0.35, 0.25),
    pickReward: pickRewardByPriority(['huntingCore', 'beastHeatFerment', 'goldenAmount', 'monsterDamage', 'goldenPower', 'goldenRate']),
    // 転生は「次スキルコストの4倍」を貯めてから(まとめ買い派)。最短600秒。
    shouldPrestige: prestigeWhen(180, 4.0),
    skillOrder: cheapestFirst
  },
  {
    id: 'S8', name: '最新設備ラッシュ型',
    // タップ4/秒。常に可視最上位の設備を狙って貯金(それ以外はコスト<=所持5%のみ)。研究<=20%。
    tapRate: 4, goldenTake: 1,
    pickPolicy: sim => 'bake',
    buy: function (sim, prod) {
      for (const r of G.RESEARCH) buyResearchLine(sim, r.id, 0.20);
      const vis = G.visibleUpgrades(sim);
      const top = vis[vis.length - 1];
      for (let i = 0; i < 30; i++) {
        let done = false;
        if (top) done = G.tryBuyUpgrade(sim, top, 1.0);
        if (!done) {
          const u = G.bestEfficiency(sim, prod, null);
          if (!u || !G.tryBuyUpgrade(sim, u, 0.05)) break;
        }
      }
      buyAllResearch(sim, 0.20);
    },
    pickReward: pickRewardUpgradeFirst(['monsterDamage', 'beastHeatFerment', 'goldenAmount']),
    shouldPrestige: prestigeWhen(150, 1.5),
    skillOrder: skillOrderByBranch(['core', 'economy', 'auto', 'upgrade', 'research', 'monster', 'click', 'golden', 'reward', 'start', 'master'])
  },
  {
    id: 'S9', name: 'ノルマ死守型',
    // タップ5/秒。ノルマ比<1.3で効率最良強化を<=60%で即購入。ノルマ失敗したら即転生(獲得PT>=1)。
    tapRate: 5, goldenTake: 1,
    pickPolicy: sim => 'hunt',
    buy: function (sim, prod) {
      for (const r of G.RESEARCH) buyResearchLine(sim, r.id, 0.30);
      const quota = Math.max(1, G.quotaAtElapsed(sim, sim.t - sim.run.startT));
      const ratio = sim.run.runCookies / quota;
      const budget = ratio < 1.3 ? 0.60 : 0.15;
      for (let i = 0; i < 30; i++) {
        const u = G.bestEfficiency(sim, prod, null);
        if (!u || !G.tryBuyUpgrade(sim, u, budget)) break;
      }
      buyAllResearch(sim, 0.30);
    },
    pickReward: pickRewardByPriority(['monsterRate', 'beastHeatFerment', 'monsterDamage', 'huntingCore', 'monsterStay', 'goldenAmount']),
    // ノルマ失敗後は目標達成し次第すぐ転生、ノルマ維持中は1.5倍まで粘る。
    shouldPrestige: function (sim) {
      const gain = G.prestigeGainOf(sim.run.runCookies);
      const next = cheapestNextSkillCost(sim);
      if (next === null) return false;
      if ((sim.t - sim.run.startT) < 120) return false;
      if (sim.run.cookies < 1000000) return false; // 転生には100万クッキー必要
      if (sim.run.quotaFailed) return gain >= next * 1.0;
      return gain >= next * 1.5;
    },
    skillOrder: skillOrderByBranch(['core', 'monster', 'auto', 'reward', 'economy', 'research', 'click', 'golden', 'upgrade', 'start', 'master'])
  },
  {
    id: 'S10', name: 'のんびり放置型',
    // タップ1/秒。金クッキーは60%だけ取る。買い物判断は30秒ごと: 効率最良<=50%、研究<=50%。
    tapRate: 1, goldenTake: 0.6,
    pickPolicy: sim => 'golden',
    buy: function (sim, prod) {
      if (sim.t % 30 !== 0) return;
      for (const r of G.RESEARCH) buyResearchLine(sim, r.id, 0.50);
      for (let i = 0; i < 30; i++) {
        const u = G.bestEfficiency(sim, prod, null);
        if (!u || !G.tryBuyUpgrade(sim, u, 0.50)) break;
      }
      buyAllResearch(sim, 0.50);
    },
    pickReward: pickRewardByPriority(['goldenAmount', 'huntingCore', 'beastHeatFerment', 'goldenRate', 'monsterDamage']),
    shouldPrestige: prestigeWhen(600, 1.2),
    skillOrder: cheapestFirst
  }
];

module.exports = { STRATEGIES, cheapestNextSkillCost };
