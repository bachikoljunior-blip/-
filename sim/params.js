'use strict';
// 調整対象パラメータ。ORIG = 元コードの値。ここを書き換えて反映する。
module.exports = {
  // ---- 転生ポイント獲得量 ----
  // gain = floor( pA*(1-exp(-run/pD1)) + pB*(run/pD2)^pG ) , run>=pMin
  prestige: { pA: 0, pD1: 200000, pB: 0.4, pD2: 10000, pG: 0.80, pMin: 10000 },

  // ---- スキルコスト: 元コスト順の等比ラダー cost_k = round(C0 * R^rank) ----
  skillCost: { mode: 'ladder', C0: 15, R: 150, segments: [ { until: 8, R: 900 }, { until: 12, R: 420 }, { until: 99, R: 210 } ], utilRatio: 0.20, rungCosts: [15,13500.00000000002,12149999.999999976,10935000000.000032,9841499999999.955,8857349999999967,7971614999999976000,7.174453499999984e+21,6.457008149999937e+24,2.71194342300002e+27,1.1390162376599999e+30,4.783868198171964e+32,2.0092246432322264e+35,2.175104139966328e+53,1.3643709084928149e+56,3.479363566606232e+58,5.276604323974015e+60,6.343873714262287e+62,7.627013744361661e+64,1.3463129354266957e+67,1.7150122970171982e+69,2.173083908782642e+71,2.612961664977987e+73,3.141470878821721e+75,4.584650639496054e+77,5.511962409012063e+79,6.839271897175666e+81,1.2998124869348498e+84,1.780697888554487e+86,3.351096704778869e+88,6.600101404086949e+90,1.9529400027822504e+93,9.725740742023831e+95,1.541426029367537e+99,1.8532016937021182e+101,2.2280384865108005e+103,3.531203029812238e+106,1.134697912236968e+109,1.3642069439171317e+111,1.6401374901296727e+113,1.971878972265501e+115,2.9114997446391703e+117,3.50039259437734e+119,4.208397523418035e+121,5.0596066691373193e+123,6.082985151456848e+125,7.313356703902357e+127,8.79258866277231e+129,1.057101663747173e+132,1.270915734098075e+134,1.5279767865018404e+136,1.837032147332099e+138,2.2085984159861574e+140,2.6553193258925876e+142,3.1923959880728247e+144,3.8381041576753826e+146] },

  // ---- 生産系数値ノードの1ノードあたり目標倍率 ----
  nodeM: { all: 14, cps: 14, click: 9 },

  // ---- スキル効果スケール(effect typeごとの倍率) ----
  fx: {
    click: 14, cps: 8, all: 8, goldenRate: 6, goldenAmount: 5, goldenPower: 6,
    monsterRate: 6, monsterDamageSkill: 10, monsterHpDown: 10, monsterStay: 5,
    upgradeDiscount: 12, researchDiscount: 12, upgradePerkPower: 8,
    rewardBonus: 8, startCookies: 15
  },

  // ---- 金クッキー ----
  golden: {
    spawnMin: 50000, spawnMax: 80000,
    visibleMs: 10000,
    instantCoef: 4,
    multBase: 2.6,
    powerPerLv: 0.25, powerLvHalf: 60, rateLvHalf: 80,
    amountPerLv: 0.45, amountLvHalf: 45,
    boostBase: 9000,
    boostExtraCap: 26000, boostExtraHalf: 60000,
    ratePerLv: 0.05
  },

  // ---- モンスター ----
  monster: {
    spawnMin: 42000, spawnMax: 60000,
    stayBase: 16000,
    stayPerLv: 0.04, rateLvHalf: 80,
    hpBase: 30,
    hpGrowth: 1.235,
    hpPressureDiv: 430, hpPressurePow: 1.95,
    lvEarlyDiv: 92,
    lvLateDiv: 320, lvLatePow: 1.22,
    dmgSqrtCoef: 0.45,
    ratePerLv: 0.09
  },

  // ---- ノルマ ----
  quota: {
    graceSec: 30,
    baseCoef: 0.22, basePow: 1.55,
    base2Coef: 0.00002, base2Pow: 2.40,
    w1: 0.60, w1T: 480, w1D: 180, w1P: 2,
    w2: 2.20, w2T: 600, w2D: 240, w2P: 2.25,
    w3: 9.00, w3T: 840, w3D: 300, w3P: 2.65,
    ctrlMul: 3.0, ctrlDiv: 1.8,
    gaugeR: 1.9
  },

  // ---- 研究効果 ----
  res: {
    fingerBase: 0.30, fingerSqrt: 0.09, fingerCritBase: 2.0, fingerCritGrow: 10.0,
    grandmaSelf: 30, grandmaSup: [0.007, 0.008, 0.009],
    ovenSelf: 30, ovenOwn: 0.060, ovenStage: 0.012,
    factorySelf: 30, factoryLow: 0.006, factoryOwn: 0.060,
    spiceOwn: 0.062, spiceGold: 15, spiceGoldOwn: 0.010, spiceGoldDur: 30000,
    portalSelf: 25, portalHuntDur: 20000, portalHuntGrow: 0.0042, portalHuntSpawn: 0.010,
    bankOwn: 0.028, bankSaved: 8.0,
    moonBase: 25, moonStage: 0.003, moonOwn: 0.001,
    foldPortal: 0.002, foldMonster: 2.5, foldGold: 8,
    galaxyTypes: 0.5, galaxyOwn: 0.019,
    bhGlobal: 5, bhCompress: 0.0018,
    quantumRes: 0.30, quantumOwn: 0.019,
    antimatterOwn: 0.002, antimatterSkill: 0.032,
    ownCap: 100000000,
    ctrlOven: 0.05, ctrlMoon: 0.07, ctrlBh: 0.10
  },

  // ---- 研究コスト ----
  resCost: {
    fingerTechnique: 2500, grandmaCrowd: 12000, ovenBatch: 30000,
    factoryNetwork: 150000, spiceBlend: 400000, portalNetwork: 1200000,
    bankClickDividend: 4000000, moonGlobalYeast: 40000000,
    portalGlobalFold: 400000000, galaxyAssembly: 6000000000,
    blackHoleCompression: 160000000000, quantumProofing: 3200000000000,
    antimatterRecipe: 64000000000000
  },

  // ---- モンスター報酬効果 ----
  rw: {
    monsterDamage: 3.2,
    crackedFang: 3.2,
    goldenTarget: 2.2,
    goldenChain: 2.0,
    goldenFirstHit: 2.5,
    brandHunt: 0.45,
    beastHeatFerment: 0.05,
    huntingCore: 0.12,
    biteRecovery: 0.5,
    crushedMill: 1.5,
    chainPrepSpawn: 0.2, chainPrepHp: 1.032,
    beastScent: 0.5,
    deepPursuitSpawn: 0.045, deepPursuitHp: 1.035, deepPursuitReward: 1.6,
    mutationBase: 0.5, mutationPerLv: 0.1,
    categoryBonusRate: 0.003, categoryHalf: 400
  },

  // ---- アップグレードコスト式 ----  cost = coef * base^basePow * growth^(owned*ownPow)
  upCost: { coef: 1100, basePow: 0.60, ownPow: 0.25, knee: 4300, ownPow2: 1.0 },

  // ---- 個別強化(報酬) ----
  upPerk: { base: 0.22, slope: 0.010, floor: 0.055 },

  // ---- 焼き加減(スキル解放機能)の式係数 ----
  bake: { powerOwn: 0.0018, powerStage: 0.004, burntCps: 0.008, burntOwn: 0.0014, softGold: 0.0010, crispyStay: 0.0012, burntHp: 0.006 },

  // ---- 段階式研究(第5次実装) ----
  res2: {
    comboRate: 0.03, comboCap: 40, comboWindow: 30,
    critCpsCoef: 0.1, critStageCap: 400,
    supExtra: 0.008, supStageCoef: 0.001, supStageCap: 350,
    ovenBakeMulBake: 1.5, ovenBakeMulOther: 1.2,
    factoryHiKind: 0.15, factoryStageCoef: 0.0012, factoryStageCap: 300,
    matureRate: 0.006, matureCap: 240, aromaDur: 12, spiceStageCoef: 0.0015, spiceStageCap: 300,
    huntExtendSec: 2, huntStageCoef: 0.0008, huntStageCap: 300,
    bankIntRate: 0.0012, bankIntCapCps: 2.0, bankCapStageCoef: 0.004, bankCapStageCap: 500,
    moonMarginDiv: 10, moonResCount: 0.05,
    foldKillCoef: 0.002, foldKillCap: 300, foldStageCoef: 0.001, foldStageCap: 350,
    galaxyBonusCoef: 0.05, galaxySat: 120, galaxyStageCoef: 0.0008, galaxyStageCap: 300,
    bhChargeFull: 2500, bhBoostCoef: 0.5, bhBoostDur: 60, bhBoostStageCoef: 0.002, bhBoostStageCap: 250,
    bhCompStageCoef: 0.001, bhCompStageMax: 0.35,
    waveAmpBase: 0.5, waveAmpPerRes: 0.05, waveAmpCap: 3, wavePeriod: 90, waveStageCoef: 0.001, waveStageCap: 300,
    antiStageCoef: 0.0008, antiStageCap: 350, antiPrestigeCoef: 0.03, antiPrestigeCap: 40
  },

  // ---- 周回テンポ ----
  tempo: { ramp: 0.105, rampDiv: 420 },

  // ---- 報酬選択 ----
  reward: { lvPerCount: 26, choiceBase: 3 }
};
