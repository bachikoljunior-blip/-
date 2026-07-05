'use strict';
// 調整対象パラメータ。ORIG = 元コードの値。ここを書き換えて反映する。
module.exports = {
  // ---- 転生ポイント獲得量 ----
  // gain = floor( pA*(1-exp(-run/pD1)) + pB*(run/pD2)^pG ) , run>=pMin
  // pG=0.50 (2026-07-05変更): ⑤上限100倍 ⇔ 周回クッキー比 ≤ 100^(1/0.5)=1e4(4桁)。④下限2桁との窓が2桁に拡大
  prestige: { pA: 0, pD1: 200000, pB: 0.4, pD2: 10000, pG: 0.50, pMin: 10000 },

  // ---- スキルコスト: 元コスト順の等比ラダー cost_k = round(C0 * R^rank) ----
  skillCost: { mode: 'ladder', C0: 15, R: 150, segments: [ { until: 8, R: 900 }, { until: 12, R: 420 }, { until: 99, R: 210 } ], utilRatio: 0.20, rungCosts: [4,264.77607824142746,5282.9773082037145,105409.25533894598,2103191.148267315,41964180.39313905,837295477.1698643,16706241120.909187,333333333333.3361,6650874383229.665,132702390184500.62,2647760782414306.5,52829773082037900,5.282977308203747e+39,2.6477607824143067e+41,1.327023901845017e+43,6.650874383229774e+44,3.333333333333443e+46,1.6706241120909734e+48,8.372954771698986e+49,4.1964180393141115e+51,2.103191148267435e+53,1.0540925533895289e+55,5.282977308204092e+56,2.64776078241448e+58,1.327023901845104e+60,6.650874383230209e+61,3.3333333333336605e+63,1.670624112091083e+65,8.372954771699533e+66,4.196418039314386e+68,2.1031911482675725e+70,1.0540925533895979e+72,5.282977308204439e+73,2.6477607824146537e+75,1.3270239018451908e+77,6.650874383230644e+78,3.3333333333338793e+80,1.670624112091192e+82,8.372954771700081e+83,4.19641803931466e+85,2.1031911482677105e+87,1.0540925533896669e+89,5.282977308204784e+90,2.6477607824148267e+92,1.3270239018452774e+94,2.7141390690651494e+95,3.8338233363820244e+96,5.415419402090551e+97,7.649483225331512e+98,1.0805182252742861e+100,1.5262725608490963e+101,2.155917295526894e+102,3.0453141230333276e+103,4.301620533954549e+104,6.07620050693106e+105] },

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
    ctrlOven: 0.05, ctrlMoon: 0.07, ctrlBh: 0.10
  },

  // ---- 研究段階コスト倍率(確定値): 段2 = 段1コスト×s2, 段3 = 段1コスト×s3 ----
  resStageCost: { s2: 1500, s3: 2250000 },

  // ---- クリック変更 案A+C(承認済み) ----
  // 案A: クリック力 = 従来項 + 毎秒生産×cpsCoef×(1+fingerSqrt×√強い指)×(1+クリック系スキル効果)
  // 案C: 神の指1個ごとにクリック×godFingerExp(指数)
  clickLink: { cpsCoef: 0.004, fingerSqrt: 0.02, godFingerExp: 1.012 }, // 案C指数 1.02->1.012 (2026-07-05): キャップ撤廃後の最終周回プラトーがe308超(S2/S7でInfinity)となるため。全方針で約-20桁、S2/S7有限化を実測確認

  // ---- タイミング機能(条件⑬)の最適操作/完全放置モデル ----
  // waveOpt=2/π(山に活動を寄せた正相平均) / waveIdle=1/π(全周期平均)
  // bhIdleDelay=満タン後に放置プレイヤーが気づくまでの遅延秒 / matureIdleMul=放置時の熟成爆発係数
  timing: { waveOpt: 0.6366, waveIdle: 0.3183, bhIdleDelay: 240, matureIdleMul: 0.5 },

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
  // 2026-07-05 キャップ全撤廃(WORKSHOP_SPEC 15): min(変数,N)/capv 型の頭打ちを全削除。
  // 撤廃に伴う係数変更(ゲームへ反映すること):
  //  - critCpsCoef: 0.1×min(最高層,400)/400 → 0.00025×最高層(上限点で同値の傾きに変換)
  //  - comboCap(40)/critStageCap/supStageCap/factoryStageCap/spiceStageCap/matureCap(240)/
  //    huntStageCap/bankCapStageCap/foldKillCap/foldStageCap/galaxyStageCap/bhBoostStageCap/
  //    waveAmpCap(3)/antiStageCap/antiPrestigeCap(40)/res.ownCap: 削除(線形のまま無限)
  //  - 月面発酵 段2: ×(1+min(1,余裕率/10)) → ×(1+log10(1+余裕率)/10)(暴走防止の逓減式に置換)
  //  - 複利利息: min(利息, 毎秒生産×2) → 利息/(1+利息/(毎秒生産×2)) (漸近逓減式に置換)
  //  - 重力圧縮 段3: 圧縮×(1-min(0.35,0.001×最高層)) → 圧縮×e^(-0.001×最高層)(負値防止の逓減式)
  res2: {
    comboRate: 0.03, comboWindow: 30,
    critCpsCoef: 0.00025,
    supExtra: 0.008, supStageCoef: 0.001,
    ovenBakeMulBake: 1.5, ovenBakeMulOther: 1.2,
    factoryHiKind: 0.15, factoryStageCoef: 0.0012,
    matureRate: 0.006, aromaDur: 12, spiceStageCoef: 0.0015,
    huntExtendSec: 2, huntStageCoef: 0.0008,
    bankIntRate: 0.0012, bankIntCapCps: 2.0, bankCapStageCoef: 0.004,
    moonMarginDiv: 10, moonResCount: 0.05,
    foldKillCoef: 0.002, foldStageCoef: 0.001,
    galaxyBonusCoef: 0.05, galaxySat: 120, galaxyStageCoef: 0.0008,
    bhChargeFull: 2500, bhBoostCoef: 0.5, bhBoostDur: 60, bhBoostStageCoef: 0.002,
    bhCompStageCoef: 0.001,
    waveAmpBase: 0.5, waveAmpPerRes: 0.05, wavePeriod: 90, waveStageCoef: 0.001,
    antiStageCoef: 0.0008, antiPrestigeCoef: 0.03
  },

  // ---- 周回テンポ ----
  tempo: { ramp: 0.105, rampDiv: 420 },

  // ---- 報酬選択 ----
  reward: { lvPerCount: 26, choiceBase: 3 }
};
