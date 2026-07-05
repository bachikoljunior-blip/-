#!/usr/bin/env python3
# 第5次: 段階式研究システムを新版HTML(index.html_2)へ実装し、検証済みシミュレーション値に定数を整合させる。
import re, sys

ORI = "/root/.claude/uploads/a92ce2cf-9729-5a56-8516-f1c88d4aa619/25cbfad0-index.html"
DST = "/tmp/claude-0/-home-user-exist-debug/a92ce2cf-9729-5a56-8516-f1c88d4aa619/scratchpad/index7_test.html"

html = open(ORI, encoding="utf-8").read()
count_fail = []

def rep(old, new, n=1):
    global html
    if old not in html:
        count_fail.append(old[:110])
        return
    html = html.replace(old, new, n)

# ============ 定数をシミュレーション検証値へ整合 ============
rep('{ id: "finger", name: "強い指", type: "click", value: 1, base: 0.0506, growth: 1.32, desc: "1タップ +1" },',
    '{ id: "finger", name: "強い指", type: "click", value: 1, base: 0.0184, growth: 1.32, desc: "1タップ +1" },')
rep("""    600
    * Math.pow(u.base, 0.60)""",
    """    1100
    * Math.pow(u.base, 0.60)""")
for name, old, new in [
    ("指先の型", 30000, 2500), ("おばあちゃん連携", 120000, 12000), ("オーブン大量焼成", 300000, 30000),
    ("工場ネットワーク", 1600000, 150000), ("香料調合", 8000000, 400000), ("異世界接続網", 24000000, 1200000),
    ("銀行クリック配当", 80000000, 4000000), ("月面発酵", 800000000, 40000000),
    ("異世界増幅", 8000000000, 400000000), ("銀河分業", 120000000000, 6000000000),
    ("重力圧縮", 3200000000000, 160000000000), ("量子発酵", 64000000000000, 3200000000000),
    ("反物質配合", 1280000000000000, 64000000000000)]:
    rep('name: "%s", cost: %d,' % (name, old), 'name: "%s", cost: %d,' % (name, new))
rep('  if (u.id === "grandma" && state.research.grandmaCrowd) m *= 60;',
    '  if (u.id === "grandma" && state.research.grandmaCrowd) m *= 30;')
rep('  if (u.id === "oven" && state.research.ovenBatch) m *= 60 * ovenStageMultiplier();',
    '  if (u.id === "oven" && state.research.ovenBatch) m *= 30 * ovenStageMultiplier();')
rep('  if (u.id === "factory" && state.research.factoryNetwork) m *= 60 * factoryNetworkMultiplier();',
    '  if (u.id === "factory" && state.research.factoryNetwork) m *= 30 * factoryNetworkMultiplier();')
rep('  if (u.id === "portal" && state.research.portalNetwork) m *= 50;',
    '  if (u.id === "portal" && state.research.portalNetwork) m *= 25;')
rep('  if (state.research.moonGlobalYeast) m *= 50 * moonLayerGlobalMultiplier();',
    '  if (state.research.moonGlobalYeast) m *= 25 * moonLayerGlobalMultiplier();')
rep("  const rewardPower = state.perks.monsterDamage * 4.5;", "  const rewardPower = state.perks.monsterDamage * 3.2;")
rep("  const crackedFangBonus = (state.perks.crackedFang || 0) * 4.5;", "  const crackedFangBonus = (state.perks.crackedFang || 0) * 3.2;")
rep("  return 1 + killCount * lv * 0.20;", "  return 1 + killCount * lv * 0.12;")
rep("""    -(Math.max(0, state.perks.monsterRate) / (1 + Math.max(0, state.perks.monsterRate) / 80)) * 0.12""",
    """    -(Math.max(0, state.perks.monsterRate) / (1 + Math.max(0, state.perks.monsterRate) / 80)) * 0.09""")
rep('const baseCount = 1 + Math.floor(level / 18);', 'const baseCount = 1 + Math.floor(level / 26);')
rep("  const base = Math.max(0.055, 0.30 - index * 0.010);", "  const base = Math.max(0.055, 0.22 - index * 0.010);")
rep('desc: n => `モンスターへの最終ダメージ +${450 * n}%相当`', 'desc: n => `モンスターへの最終ダメージ +${320 * n}%相当`')
rep('desc: n => `モンスターへのダメージ +${450 * n}%`', 'desc: n => `モンスターへのダメージ +${320 * n}%`')
rep('desc: n => `モンスター撃破数に応じて毎秒生産上昇。撃破1体ごとに +${(20 * n).toFixed(1)}%`',
    'desc: n => `モンスター撃破数に応じて毎秒生産上昇。撃破1体ごとに +${(12 * n).toFixed(1)}%`')
rep('    const after = before + choice.count * 4.5;', '    const after = before + choice.count * 3.2;')

rep("    state.nextMonsterSpawnMultiplier *= Math.exp(-chainPrepLv * 0.12);",
    "    state.nextMonsterSpawnMultiplier *= Math.exp(-chainPrepLv * 0.2);")
rep("""    const spawnNow = Math.exp(-lvNow * 0.12);
    const spawnNext = Math.exp(-lvNext * 0.12);""",
    """    const spawnNow = Math.exp(-lvNow * 0.2);
    const spawnNext = Math.exp(-lvNext * 0.2);""")
rep("    state.nextGoldenSpawnMultiplier *= Math.exp(-beastScentLv * 0.30);",
    "    state.nextGoldenSpawnMultiplier *= Math.exp(-beastScentLv * 0.5);")
rep("""    -(Math.max(0, state.perks.goldenRate) / (1 + Math.max(0, state.perks.goldenRate) / 80)) * 0.035""",
    """    -(Math.max(0, state.perks.goldenRate) / (1 + Math.max(0, state.perks.goldenRate) / 80)) * 0.05""")

# ============ 段階式研究: 定義と共通ヘルパー ============
rep("""function researchUnlocked(r) {
  if (r.advanced && !advancedResearchUnlocked()) return false;
  return !r.skill || hasSkill(r.skill) || hasSkillEffect("unlockResearch", r.id);
}""",
"""// ==== 段階式研究: 対応設備(その回で購入済みの研究のみ表示・購入可)と段階解放スキル ====
const RES_EQUIP = {
  fingerTechnique: "finger", grandmaCrowd: "grandma", ovenBatch: "oven",
  factoryNetwork: "factory", spiceBlend: "spiceRack", portalNetwork: "portal",
  bankClickDividend: "bank", moonGlobalYeast: "moonBakery", portalGlobalFold: "portal",
  galaxyAssembly: "galaxyFactory", blackHoleCompression: "blackHoleMixer",
  quantumProofing: "quantumBakery", antimatterRecipe: "antimatterOven"
};
const RES_STAGE2 = {
  fingerTechnique: "click_2", grandmaCrowd: "auto_2", ovenBatch: "auto_3",
  factoryNetwork: "auto_4", spiceBlend: "golden_1", portalNetwork: "monster_3",
  bankClickDividend: "economy_2", moonGlobalYeast: "upgrade_time", portalGlobalFold: "upgrade_singularity",
  galaxyAssembly: "upgrade_universe", blackHoleCompression: "upgrade_singularity",
  quantumProofing: "upgrade_antimatter", antimatterRecipe: "research_analysis"
};
const RES_STAGE3 = {
  fingerTechnique: "click_4", grandmaCrowd: "auto_4", ovenBatch: "bake_temperature",
  factoryNetwork: "economy_2", spiceBlend: "golden_3", portalNetwork: "monster_4",
  bankClickDividend: "economy_analysis", moonGlobalYeast: "research_analysis", portalGlobalFold: "master_final",
  galaxyAssembly: "upgrade_singularity", blackHoleCompression: "upgrade_quantum",
  quantumProofing: "master_final", antimatterRecipe: "master_final"
};
function resStage2(id) { return hasSkill(RES_STAGE2[id]); }
function resStage3(id) { return hasSkill(RES_STAGE3[id]); }
function researchStageOf(id) { return 1 + (resStage2(id) ? 1 : 0) + (resStage3(id) ? 1 : 0); }
function capv(v, cap) { return Math.min(Math.max(0, v), cap); }
// その回の最高到達ノルマ層
function maxQuotaStage() { return Math.max(1, state.maxQuotaStage || 1); }

function researchUnlocked(r) {
  if (r.advanced && !advancedResearchUnlocked()) return false;
  if (r.skill && !(hasSkill(r.skill) || hasSkillEffect("unlockResearch", r.id))) return false;
  // その回で対応設備を購入済みの研究だけ表示・購入できる
  const eq = RES_EQUIP[r.id];
  if (eq && !((state.upgrades[eq] || 0) > 0)) return false;
  return true;
}""")

# ============ 最高層の記録(50msティック) ============
rep("""setInterval(() => {
  if (titleScreenActive()) return;

  updateQuotaPauseState();
  updateSpawnTimerPauseState();
  if (!pausedForSkillChoice()) {
    earn(currentCps() / 20);
    checkQuotaState();
    if (!rewardModalOpen()) tickOrderProgress(1 / 20);
  }

  updateTopOnly();
}, 50);""",
"""setInterval(() => {
  if (titleScreenActive()) return;

  updateQuotaPauseState();
  updateSpawnTimerPauseState();
  if (!pausedForSkillChoice()) {
    earn(currentCps() / 20);
    // 最高到達ノルマ層を記録(段階式研究の変数)
    state.maxQuotaStage = Math.max(state.maxQuotaStage || 1, currentQuotaStageNumber());
    // 銀行クリック配当 段階2: 複利利息(所持クッキーに毎秒、上限は毎秒生産比)
    if (state.research.bankClickDividend && resStage2("bankClickDividend")) {
      const bank = state.upgrades.bank || 0;
      if (bank > 0 && state.cookies > 0) {
        let cap = currentCps() * 2.0;
        if (resStage3("bankClickDividend")) cap *= 1 + 0.004 * capv(maxQuotaStage(), 500);
        earn(Math.min(state.cookies * 0.0012 * Math.log10(1 + bank), cap) / 20);
      }
    }
    // 重力圧縮 段階2: 圧縮チャージ(満タン30秒で自動発動、ボタンで即発動も可)
    if (state.research.blackHoleCompression && resStage2("blackHoleCompression")) {
      const bh = state.upgrades.blackHoleMixer || 0;
      state.bhCharge = (state.bhCharge || 0) + Math.sqrt(bh) / 20;
      const maxUses = resStage3("blackHoleCompression") ? 3 : 2;
      if (state.bhCharge >= 2500 && (state.bhUses || 0) < maxUses) {
        if (!state.bhFullSince) state.bhFullSince = Date.now();
        if (Date.now() - state.bhFullSince > 30000) fireBhBoost();
      } else {
        state.bhFullSince = 0;
      }
    }
    checkQuotaState();
    if (!rewardModalOpen()) tickOrderProgress(1 / 20);
  }

  updateTopOnly();
}, 50);

// 重力圧縮 段階2: チャージ発動
function fireBhBoost() {
  const bh = state.upgrades.blackHoleMixer || 0;
  const maxUses = resStage3("blackHoleCompression") ? 3 : 2;
  if (!state.research.blackHoleCompression || !resStage2("blackHoleCompression")) return;
  if ((state.bhCharge || 0) < 2500 || (state.bhUses || 0) >= maxUses) return;
  let mult = 1 + 0.5 * Math.sqrt(bh) / 10;
  if (resStage3("blackHoleCompression")) mult *= 1 + 0.002 * capv(maxQuotaStage(), 250);
  state.bhBoostMult = mult;
  state.bhBoostUntil = Date.now() + 60000;
  state.bhCharge = 0;
  state.bhFullSince = 0;
  state.bhUses = (state.bhUses || 0) + 1;
  showMessage(`圧縮解放：60秒間 全生産 x${mult.toFixed(2)}`);
}""")

# ============ 周回リセット時に新変数を初期化 ============
rep("""function resetRunLimitedEffects() {
  state.blackHoleCompressionUsed = false;""",
"""function resetRunLimitedEffects() {
  state.maxQuotaStage = 1;
  state.critCombo = 0;
  state.lastCritAt = 0;
  state.lastGoldenAt = Date.now();
  state.spiceBurstM = 1;
  state.spiceAromaUntil = 0;
  state.bhCharge = 0;
  state.bhUses = 0;
  state.bhFullSince = 0;
  state.bhBoostUntil = 0;
  state.bhBoostMult = 1;
  state.blackHoleCompressionUsed = false;""")

# ============ 指先の型: 段階2コンボ / 段階3 層ボーナス ============
rep("""  let tapPower = currentClickPower();
  let critical = false;

  if (Math.random() < fingerCritChance()) {
    tapPower *= fingerCritMultiplier();
    critical = true;
  }

  const gained = earn(tapPower);""",
"""  let tapPower = currentClickPower();
  let critical = false;

  if (Math.random() < fingerCritChance()) {
    tapPower *= fingerCritMultiplier();
    critical = true;
    // 段階2: 会心コンボ(30秒途切れでリセット、上限40)
    if (resStage2("fingerTechnique")) {
      if (Date.now() - (state.lastCritAt || 0) > 30000) state.critCombo = 0;
      state.critCombo = Math.min(40, (state.critCombo || 0) + 1);
      state.lastCritAt = Date.now();
    }
    // 段階3: 会心の余熱(会心のたびに毎秒生産×最高到達層比の追加獲得)
    if (resStage3("fingerTechnique")) {
      earn(currentCps() * 0.1 * (capv(maxQuotaStage(), 400) / 400));
    }
  }

  const gained = earn(tapPower);""")
rep("""function fingerCritMultiplier() {
  if (!state.research.fingerTechnique) return 2;

  const f = state.upgrades.finger || 0;
  const policy = runPolicyIs("click") ? 0.010 : 0;
  const score = 0.30 + Math.sqrt(f) * 0.09 + policy;
  return 2 + score * 10;
}""",
"""function fingerCritMultiplier() {
  if (!state.research.fingerTechnique) return 2;

  const f = state.upgrades.finger || 0;
  const policy = runPolicyIs("click") ? 0.010 : 0;
  const score = 0.30 + Math.sqrt(f) * 0.09 + policy;
  let m = 2 + score * 10;
  // 段階2: 会心コンボで倍率上昇
  if (resStage2("fingerTechnique")) {
    const combo = (Date.now() - (state.lastCritAt || 0) > 30000) ? 0 : (state.critCombo || 0);
    m *= 1 + 0.03 * Math.min(40, combo);
  }
  return m;
}""")

# ============ おばあちゃん連携: 段階2 支援先追加 / 段階3 最高層 ============
rep("""  if (state.research.grandmaCrowd) {
    const g = state.upgrades.grandma || 0;

    if (u.id === "finger") {
      m *= levelGrowth(g, 0.007);
    }

    if (u.id === "oven") {
      m *= levelGrowth(g, 0.008);
    }

    if (u.id === "factory") {
      m *= levelGrowth(g, 0.009);
    }
  }""",
"""  if (state.research.grandmaCrowd) {
    const g = state.upgrades.grandma || 0;

    if (u.id === "finger") {
      m *= levelGrowth(g, 0.007);
    }

    if (u.id === "oven") {
      m *= levelGrowth(g, 0.008);
    }

    if (u.id === "factory") {
      m *= levelGrowth(g, 0.009);
    }

    // 段階2: 支援先に銀行・香料棚を追加
    if (resStage2("grandmaCrowd") && (u.id === "bank" || u.id === "spiceRack")) {
      m *= levelGrowth(g, 0.008);
    }

    // 段階3: 最高到達ノルマ層で全支援が伸びる
    if (m > 1 && resStage3("grandmaCrowd")) {
      m *= 1 + 0.001 * capv(maxQuotaStage(), 350);
    }
  }""")

# ============ オーブン大量焼成: 最高層化 / 段階2 焼き加減 / 段階3 個別強化Lv ============
rep("""function ovenStageMultiplier() {
  if (!state.research.ovenBatch) return 1;

  const owned = state.upgrades.oven || 0;
  const stage = currentQuotaStageNumber();
  const policyBonus = runPolicyIs("bake") ? 1.10 : 1;

  return levelGrowth(owned, 0.060) * levelGrowth(Math.max(0, stage - 1), 0.012) * policyBonus;
}""",
"""function ovenStageMultiplier() {
  if (!state.research.ovenBatch) return 1;

  const owned = state.upgrades.oven || 0;
  const stage = maxQuotaStage(); // その回の最高到達ノルマ層
  const policyBonus = runPolicyIs("bake") ? 1.10 : 1;

  let m = levelGrowth(owned, 0.060) * levelGrowth(Math.max(0, stage - 1), 0.012) * policyBonus;
  // 段階2: 焼き加減連動(「香ばしい」の間x1.5、その他x1.2)
  if (resStage2("ovenBatch")) m *= state.bakeStateId === "crispy" ? 1.5 : 1.2;
  // 段階3: オーブンの個別強化Lvが研究倍率にも乗る
  if (resStage3("ovenBatch")) m *= 1 + 0.05 * ((state.upgradePerks || {}).oven || 0);
  return m;
}""")

# ============ 工場ネットワーク: 段階2 上位設備種類 / 段階3 最高層 ============
rep("""  const factory = state.upgrades.factory || 0;

  return levelGrowth(low, 0.006) * levelGrowth(factory, 0.060);
}""",
"""  const factory = state.upgrades.factory || 0;

  let m = levelGrowth(low, 0.006) * levelGrowth(factory, 0.060);
  // 段階2: 銀行以上の上位設備の所持種類数で伸びる
  if (resStage2("factoryNetwork")) {
    let hi = 0;
    for (let j = 4; j < UPGRADES.length; j++) if ((state.upgrades[UPGRADES[j].id] || 0) > 0) hi++;
    m *= 1 + 0.15 * hi;
  }
  // 段階3: 最高到達ノルマ層
  if (resStage3("factoryNetwork")) m *= 1 + 0.0012 * capv(maxQuotaStage(), 300);
  return m;
}""")

# ============ 香料調合: 段階2 風味の熟成 / 段階3 最高層 ============
rep("""  if (state.research.spiceBlend) {
    state.spiceBoostUntil = Date.now() + 30000 + Math.log1p(state.upgrades.spiceRack || 0) * 1800;
    goldEffects.push("香料棚");
  }""",
"""  if (state.research.spiceBlend) {
    state.spiceBoostUntil = Date.now() + 30000 + Math.log1p(state.upgrades.spiceRack || 0) * 1800;
    // 段階2: 風味の熟成(前回の金からの経過秒で、12秒間の全生産バーストが決まる)
    if (resStage2("spiceBlend")) {
      const mature = capv((Date.now() - (state.lastGoldenAt || Date.now())) / 1000, 240);
      let burst = 1 + 0.006 * mature;
      if (resStage3("spiceBlend")) burst *= 1 + 0.0015 * capv(maxQuotaStage(), 300);
      state.spiceBurstM = burst;
      state.spiceAromaUntil = Date.now() + 12000;
    }
    goldEffects.push("香料棚");
  }
  state.lastGoldenAt = Date.now();""")
rep("""  if (goldenActive) {
    m *= 25 * levelGrowth(owned, 0.010);
  }""",
"""  if (goldenActive) {
    m *= 15 * levelGrowth(owned, 0.010);
  }""")

# ============ 異世界接続網: 段階2 延長狩り / 段階3 最高層 ============
rep("""function portalHuntSpawnMultiplier() {
  if (!state.research.portalNetwork) return 1;
  if (Date.now() >= (state.portalHuntUntil || 0)) return 1;

  const portal = state.upgrades.portal || 0;
  return intervalReduction(portal, 0.010);
}""",
"""function portalHuntSpawnMultiplier() {
  if (!state.research.portalNetwork) return 1;
  if (Date.now() >= (state.portalHuntUntil || 0)) return 1;

  const portal = state.upgrades.portal || 0;
  let m = intervalReduction(portal, 0.010);
  // 段階3: 最高到達ノルマ層で窓中の出現がさらに早く
  if (resStage3("portalNetwork")) m *= Math.exp(-0.0008 * capv(maxQuotaStage(), 300));
  return m;
}""")

# ============ 月面発酵: 最高層化 / 段階2 ノルマ余裕率 / 段階3 研究数 ============
rep("""function moonLayerGlobalMultiplier() {
  if (!state.research.moonGlobalYeast) return 1;

  const stage = currentQuotaStageNumber();
  if (stage < 3) return 1;

  const moon = state.upgrades.moonBakery || 0;
  return levelGrowth(Math.max(0, stage - 2), 0.003) * levelGrowth(moon, 0.001);
}""",
"""function moonLayerGlobalMultiplier() {
  if (!state.research.moonGlobalYeast) return 1;

  const stage = maxQuotaStage(); // その回の最高到達ノルマ層
  if (stage < 3) return 1;

  const moon = state.upgrades.moonBakery || 0;
  let m = levelGrowth(Math.max(0, stage - 2), 0.003) * levelGrowth(moon, 0.001);
  // 段階2: ノルマ余裕率(今回クッキー/必要ノルマ)で発酵が進む
  if (resStage2("moonGlobalYeast")) {
    const q = monsterQuotaRequired();
    const margin = (q && q > 0) ? state.runCookies / q : 1;
    m *= 1 + Math.min(1, margin / 10);
  }
  // 段階3: 取得済み研究数
  if (resStage3("moonGlobalYeast")) {
    const rc = RESEARCH.filter(r => state.research[r.id]).length;
    m *= 1 + 0.05 * rc;
  }
  return m;
}""")

# ============ 異世界増幅: 段階2 討伐数 / 段階3 最高層 ============
rep("""  const goldenM = goldenBoostActive() ? 12 : 1;

  return levelGrowth(portal, 0.002) * levelGrowth(activeMonsterCount, 2.5) * goldenM;
}""",
"""  const goldenM = goldenBoostActive() ? 8 : 1;

  let m = levelGrowth(portal, 0.002) * levelGrowth(activeMonsterCount, 2.5) * goldenM;
  // 段階2: その回のノルマ中討伐数「魂の蓄積」
  if (resStage2("portalGlobalFold")) m *= 1 + 0.002 * capv(state.quotaMonsterKills || 0, 300);
  // 段階3: 最高到達ノルマ層
  if (resStage3("portalGlobalFold")) m *= 1 + 0.001 * capv(maxQuotaStage(), 350);
  return m;
}""")

# ============ 銀河分業: 段階2 分業ボーナス(全生産) / 段階3 最高層 ============
rep("""function galaxyAssemblyMultiplier() {
  if (!state.research.galaxyAssembly) return 1;

  const types = ownedUpgradeTypeCount();
  const galaxy = state.upgrades.galaxyFactory || 0;

  return levelGrowth(types, 0.8) * levelGrowth(galaxy, 0.019);
}""",
"""function galaxyAssemblyMultiplier() {
  if (!state.research.galaxyAssembly) return 1;

  const types = ownedUpgradeTypeCount();
  const galaxy = state.upgrades.galaxyFactory || 0;

  return levelGrowth(types, 0.5) * levelGrowth(galaxy, 0.019);
}

// 銀河分業 段階2: 編成ボーナス(全生産)。バランス係数 = 所持数の幾何平均 / 算術平均
function galaxyDivisionBonus() {
  if (!state.research.galaxyAssembly || !resStage2("galaxyAssembly")) return 1;
  const counts = [];
  for (const u of UPGRADES) { const c = state.upgrades[u.id] || 0; if (c > 0) counts.push(c); }
  if (counts.length < 2) return 1;
  let logSum = 0, sum = 0;
  for (const c of counts) { logSum += Math.log(c); sum += c; }
  const balance = Math.exp(logSum / counts.length) / (sum / counts.length);
  const galaxy = state.upgrades.galaxyFactory || 0;
  let bonus = 0.05 * counts.length * balance * (1 - Math.exp(-galaxy / 120));
  if (resStage3("galaxyAssembly")) bonus *= 1 + 0.0008 * capv(maxQuotaStage(), 300);
  return 1 + bonus;
}""")

# ============ 量子発酵: 基礎縮小 + 段階2 観測ゆらぎ / 段階3 最高層 ============
rep("""  const researchCount = RESEARCH.filter(r => state.research[r.id]).length;
  const quantum = state.upgrades.quantumBakery || 0;

  return levelGrowth(researchCount, 1.6) * levelGrowth(quantum, 0.019);
}""",
"""  const researchCount = RESEARCH.filter(r => state.research[r.id]).length;
  const quantum = state.upgrades.quantumBakery || 0;

  let m = levelGrowth(researchCount, 0.30) * levelGrowth(quantum, 0.019);
  // 段階2: 観測ゆらぎ(90秒周期の波。山でのみ増幅、谷はx1)
  if (resStage2("quantumProofing")) {
    let amp = 0.5 + 0.05 * researchCount;
    if (resStage3("quantumProofing")) amp *= 1 + 0.001 * capv(maxQuotaStage(), 300);
    amp = Math.min(3, amp);
    const phase = Math.sin(2 * Math.PI * (quotaElapsedSeconds() % 90) / 90);
    m *= 1 + amp * Math.max(0, phase);
  }
  return m;
}""")

# ============ 反物質配合: 段階2 最高層 / 段階3 転生回数 ============
rep("""  const antimatter = state.upgrades.antimatterOven || 0;
  return levelGrowth(antimatter, 0.002) * levelGrowth(boughtSkillCount(), 0.045);
}""",
"""  const antimatter = state.upgrades.antimatterOven || 0;
  let m = levelGrowth(antimatter, 0.002) * levelGrowth(boughtSkillCount(), 0.032);
  // 段階2: 最高到達ノルマ層
  if (resStage2("antimatterRecipe")) m *= 1 + 0.0008 * capv(maxQuotaStage(), 350);
  // 段階3: 対消滅(転生回数で恒久的に伸びる)
  if (resStage3("antimatterRecipe")) m *= 1 + 0.03 * capv(state.prestigeRuns || 0, 40);
  return m;
}""")

# ============ 重力圧縮: 固定部縮小 + 発動ブースト + 段階3 追加圧縮 ============
rep("""  if (state.research.moonGlobalYeast) m *= 25 * moonLayerGlobalMultiplier();
  if (state.research.portalGlobalFold) m *= portalGlobalFoldMultiplier();
  if (state.research.blackHoleCompression) m *= 50;
  if (state.research.antimatterRecipe) m *= antimatterRecipeMultiplier();

  return m;
}""",
"""  if (state.research.moonGlobalYeast) m *= 25 * moonLayerGlobalMultiplier();
  if (state.research.portalGlobalFold) m *= portalGlobalFoldMultiplier();
  // 香料調合 段階2: 熟成の香り(金取得から12秒間、全生産バースト)
  if (state.research.spiceBlend && resStage2("spiceBlend") && Date.now() < (state.spiceAromaUntil || 0)) {
    m *= state.spiceBurstM || 1;
  }
  if (state.research.blackHoleCompression) {
    m *= 5;
    if (Date.now() < (state.bhBoostUntil || 0)) m *= state.bhBoostMult || 1; // 段階2: 圧縮解放中
  }
  if (state.research.antimatterRecipe) m *= antimatterRecipeMultiplier();
  m *= galaxyDivisionBonus(); // 銀河分業 段階2: 編成ボーナス

  return m;
}""")
rep("""  const blackHole = state.upgrades.blackHoleMixer || 0;
  if (blackHole <= 0) return 1;

  return intervalReduction(blackHole, 0.0018);
}""",
"""  const blackHole = state.upgrades.blackHoleMixer || 0;
  if (blackHole <= 0) return 1;

  let c = intervalReduction(blackHole, 0.0018);
  // 段階3: 最高到達ノルマ層が深いほど追加圧縮(最大35%)
  if (resStage3("blackHoleCompression")) c *= 1 - Math.min(0.35, 0.001 * maxQuotaStage());
  return c;
}""")

# ============ 研究カードに段階表示+重力圧縮の発動ボタン ============
rep("""    btn.classList.toggle("canBuy", !done && state.cookies >= cost && !pausedForSkillChoice());
    btn.classList.toggle("done", done);
    btn.innerHTML = `
      <b>${r.name}</b>
      <div class="price">${done ? "解放済み" : fmt(cost) + " クッキー"}</div>
      <div class="desc">${r.desc}</div>
      ${done && r.detail ? `<div class="desc">詳細：${r.detail}</div>` : ""}
    `;
  });""",
"""    btn.classList.toggle("canBuy", !done && state.cookies >= cost && !pausedForSkillChoice());
    btn.classList.toggle("done", done);
    const stg = researchStageOf(r.id);
    const stageInfo = done
      ? `<div class="desc">段階 ${stg}/3${stg < 3 ? `(次: スキル『${getSkill(stg === 1 ? RES_STAGE2[r.id] : RES_STAGE3[r.id]) ? getSkill(stg === 1 ? RES_STAGE2[r.id] : RES_STAGE3[r.id]).name : "?"}』で解放)` : "(最大)"}</div>`
      : "";
    let extra = "";
    if (r.id === "blackHoleCompression" && done && resStage2("blackHoleCompression")) {
      const full = (state.bhCharge || 0) >= 2500;
      const uses = state.bhUses || 0;
      const maxUses = resStage3("blackHoleCompression") ? 3 : 2;
      extra = `<div class="desc">圧縮ゲージ ${Math.min(100, Math.floor((state.bhCharge || 0) / 25))}% / 発動 ${uses}/${maxUses}回${full && uses < maxUses ? " — タップで発動!" : ""}</div>`;
    }
    btn.innerHTML = `
      <b>${r.name}</b>
      <div class="price">${done ? "解放済み" : fmt(cost) + " クッキー"}</div>
      <div class="desc">${r.desc}</div>
      ${stageInfo}${extra}
      ${done && r.detail ? `<div class="desc">詳細：${r.detail}</div>` : ""}
    `;
  });""")

# ============ 研究の説明文を段階式仕様に更新 ============
for old_desc, new_desc in [
    ('detail: "会心率は強い指数で上がり、会心倍率はlogで永久に伸びる。", desc: "タップ時、会心が発生するようになる。強い指が多いほど会心率と会心倍率が伸びる"',
     'detail: "式：会心率=1-e^-score、倍率=2+score×10。段階2(連打修行II):会心コンボ(上限40)で倍率×(1+0.03×コンボ)。段階3(神指の権能):会心のたびに毎秒生産×10%×(最高到達層/400)を追加獲得(会心の余熱)。", desc: "タップ時、会心が発生。段階解放でコンボと層ボーナスが追加"'),
    ('detail: "おばあちゃん数の平方根で、強い指・オーブン・工場を補助する。", desc: "おばあちゃんが強い指・オーブン・工場を支援する"',
     'detail: "式：支援=1.007〜1.009^おばあちゃん。段階2(自動化II):支援先に銀行・香料棚を追加(1.008^婆)。段階3(自動化IV):全支援×(1+0.001×最高到達層、上限350)。", desc: "おばあちゃんが設備を支援。段階解放で支援先と層効果が追加"'),
    ('detail: "現在ノルマ層が高いほど、オーブン倍率がlogで伸びる。", desc: "ノルマ層が進んでいる周回ほどオーブンが安定して強くなる"',
     'detail: "式：30×1.060^オーブン×1.012^(最高到達層-1)。段階2(自動化III):焼き加減が香ばしいの間×1.5(他×1.2)。段階3(焼き加減の心得):オーブン個別強化Lv×5%が倍率に乗る。", desc: "最高到達ノルマ層が高い周回ほどオーブンが強い。段階解放で焼き加減・個別強化と連動"'),
    ('detail: "強い指・おばあちゃん・オーブンの所持数と工場数で、工場倍率が伸びる。", desc: "強い指・おばあちゃん・オーブンの所持数に応じて工場が強化される"',
     'detail: "式：30×1.006^(指+婆+炉)×1.060^工場。段階2(自動化IV):銀行以上の所持種類×15%。段階3(経済II):×(1+0.0012×最高到達層、上限300)。", desc: "下位設備の数で工場が強化。段階解放で上位ラインと層効果が追加"'),
    ('detail: "金クッキー取得後しばらく香料棚が強化される。金色型と自動型をつなぐ研究。", desc: "金クッキー取得後、一定時間だけ香料棚の生産倍率が上がる"',
     'detail: "式：金取得後30秒 香料棚×15×1.010^棚。段階2(金色I):風味の熟成=金取得から12秒間、全生産×(1+0.6%×前回の金からの経過秒、上限240秒)。段階3(金色III):熟成倍率×(1+0.0015×最高到達層、上限300)。", desc: "金取得後に香料棚が強化。段階解放で「待つほど大きい」熟成爆発が追加"'),
    ('detail: "金クッキー取得後、異世界クッキー炉の数に応じて一定時間モンスター出現間隔を短縮する。", desc: "金クッキー取得後、一定時間だけモンスター出現が少し早くなる"',
     'detail: "式：金取得後、出現間隔×0.990^異世界炉。段階2(狩猟III):窓中の討伐1体ごとに窓+2秒(延長狩り)。段階3(狩猟IV):窓中の出現×e^(-0.0008×最高到達層、上限300)。", desc: "金取得後の狩り窓。段階解放で討伐による延長と層短縮が追加"'),
    ('detail: "銀行数と所持クッキー量でクリックが強くなる。買うか貯めるかの判断材料になる。", desc: "銀行数と所持クッキー量に応じてクリックが強化される"',
     'detail: "式：クリック×1.028^銀行×(1+log(貯蓄)×8)。段階2(経済II):複利利息=min(所持×0.12%×log10(1+銀行), 毎秒生産×2)を毎秒獲得。段階3(経済分析):利息上限×(1+0.004×最高到達層、上限500)。", desc: "銀行でクリック強化。段階解放で「貯めるほど増える」複利利息が追加"'),
    ('detail: "第3層以降のノルマ層と月面ベーカリー数に応じて全体生産が伸び、ノルマ上昇も少し抑える。", desc: "ノルマ第3層以降で全体生産が少し伸び、ノルマ上昇も少し抑える"',
     'detail: "式：25×1.003^(最高到達層-2)×1.001^月面 ※第3層以降。段階2(時間許可):ノルマ余裕率/10(上限+100%)で発酵が進む。段階3(研究解析):×(1+5%×取得研究数)。", desc: "最高到達層で全体生産が伸びる。段階解放で余裕率・研究数と連動"'),
    ('detail: "異世界炉数、金ブースト、出現中モンスター数に応じて全体生産が伸びる。", desc: "異世界炉・金ブースト・モンスター数がかみ合うほど全体生産が伸びる"',
     'detail: "式：1.002^異世界炉×3.5^出現中モンスター×金ブースト中×8。段階2(特異点):魂の蓄積=ノルマ中討伐×0.2%(上限300)。段階3(超越体):×(1+0.001×最高到達層、上限350)。", desc: "異世界炉・金・モンスターの連動。段階解放で討伐蓄積と層効果が追加"'),
    ('detail: "所持している設備種類数と銀河工場数に応じて銀河工場倍率が伸びる。", desc: "所持設備の種類数が多いほど銀河工場が強くなる"',
     'detail: "式：銀河工場×1.5^種類数×1.019^銀河工場。段階2(宇宙炉心):全生産×(1+5%×種類数×バランス係数×(1-e^(-銀河工場/120)))。バランス係数=所持数の幾何平均/算術平均。段階3(特異点):ボーナス×(1+0.0008×最高到達層、上限300)。", desc: "設備種類で銀河工場が強化。段階解放で「まんべんなく揃える」編成ボーナスが全生産に追加"'),
    ('detail: "ノルマ未達寸前で、周回中1回だけブラックホール数に応じて必要ノルマを圧縮する。全体生産も上げる。", desc: "ノルマ未達寸前で一度だけ必要ノルマを圧縮し、全体生産も強化する"',
     'detail: "式：全生産×5。圧縮=必要ノルマ×0.9982^BH数(未達寸前に1回)。段階2(特異点):圧縮ゲージ(√BH/秒、2500で満タン)を発動で60秒 全生産×(1+0.5×√BH/10)、周回2回。段階3(量子炉):3回+倍率×(1+0.002×最高到達層、上限250)+圧縮×(1-min(35%, 0.1%×最高到達層))。", desc: "ノルマ圧縮と全生産強化。段階解放でゲージ発動ブーストが追加"'),
    ('detail: "取得済み研究数と量子ベーカリー数に応じて量子ベーカリーが伸びる。", desc: "研究数が多いほど量子ベーカリーの生産が伸びる"',
     'detail: "式：量子ベーカリー×1.30^研究数×1.019^量子。段階2(反物質炉):観測ゆらぎ=90秒周期の波×(1+振幅×max(0,sin))、振幅=0.5+0.05×研究数(上限3)。段階3(超越体):振幅×(1+0.001×最高到達層、上限300)。", desc: "研究数で量子ベーカリーが伸びる。段階解放で90秒周期の波(山に行動を合わせる)が追加"'),
    ('detail: "反物質オーブン数と取得スキル数に応じて全体生産が伸びる。", desc: "反物質オーブンと取得スキル数が多いほど全体生産が伸びる"',
     'detail: "式：全生産×1.002^反物質×1.032^取得スキル数。段階2(研究解析):×(1+0.0008×最高到達層、上限350)。段階3(超越体):対消滅=×(1+3%×転生回数、上限40回)。周回をまたいで恒久成長する唯一の研究。", desc: "反物質とスキル数で全体生産が伸びる。段階解放で層効果と転生回数の恒久成長が追加"'),
]:
    rep(old_desc, new_desc)

# ============ 研究解析の表示式も新値に ============
rep('return `式：オーブン研究倍率 = 60 × 1.060^オーブン数', 'return `式：オーブン研究倍率 = 30 × 1.060^オーブン数')
rep('倍率 x${(60 * ovenStageMultiplier()).toFixed(3)}`;', '倍率 x${(30 * ovenStageMultiplier()).toFixed(3)}`;')
rep('return `式：工場倍率 = 60 × 1.006^(強い指+おばあちゃん+オーブン)', 'return `式：工場倍率 = 30 × 1.006^(強い指+おばあちゃん+オーブン)')
rep('x${(60 * factoryNetworkMultiplier()).toFixed(3)}`;', 'x${(30 * factoryNetworkMultiplier()).toFixed(3)}`;')
rep('金クッキー後補正 = 25 × 1.010^香料棚数', '金クッキー後補正 = 15 × 1.010^香料棚数')
rep('return `式：異世界炉生産 = 基礎x50', 'return `式：異世界炉生産 = 基礎x25')
rep('return `式：全体倍率 = 50 × 1.003^(ノルマ層 - 2)', 'return `式：全体倍率 = 25 × 1.003^(最高到達層 - 2)')
rep('return `式：銀河工場倍率 = 1.8^所持設備種類数', 'return `式：銀河工場倍率 = 1.5^所持設備種類数')
rep('全体生産は固定でx50', '全体生産は固定でx5(+圧縮ゲージ発動で60秒ブースト)')
rep('return `式：量子ベーカリー倍率 = 2.6^取得済み研究数', 'return `式：量子ベーカリー倍率 = 1.30^取得済み研究数 × 観測ゆらぎ波')
rep('× 1.045^取得済みスキル数', '× 1.032^取得済みスキル数')

# ============ 第7次: 転生指数・コスト膝の整合 ============
rep("""    0.4 * Math.pow(total / 10000, 0.60)""",
    """    0.4 * Math.pow(total / 10000, 0.80)""")
rep("""    * Math.pow(u.growth, owned <= 5500 ? owned * 0.25 : 5500 * 0.25 + (owned - 5500) * 0.60)""",
    """    * Math.pow(u.growth, owned <= 4300 ? owned * 0.25 : 4300 * 0.25 + (owned - 4300) * 1.0)""")

# ============ 第7次: スキルコストをチューニング済みの値へ再割り当て ============
import json as _json, re as _re
_costs = _json.load(open("/tmp/claude-0/-home-user-exist-debug/a92ce2cf-9729-5a56-8516-f1c88d4aa619/scratchpad/skillcosts7.json", encoding="utf-8"))
for _id, _c in _costs.items():
    pat = _re.compile(r'(\{ id: "' + _re.escape(_id) + r'", name: "[^"]+", branchId: "[^"]+", cost: )([0-9.e+]+)')
    html, n = pat.subn(lambda m: m.group(1) + _c, html)
    if n != 1:
        count_fail.append("skillcost:" + _id + " n=" + str(n))

out = html
open(DST, "w", encoding="utf-8").write(out)
if count_fail:
    print("FAILED replacements:")
    for f in count_fail: print(" -", f)
    sys.exit(1)
print("OK — index.html generated:", len(out), "bytes")
