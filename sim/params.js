'use strict';
// 調整対象パラメータ。ORIG = 元コードの値。ここを書き換えて反映する。
module.exports = {
  // ---- 転生ポイント獲得量 ----
  // gain = floor( pA*(1-exp(-run/pD1)) + pB*(run/pD2)^pG ) , run>=pMin
  // pG=0.08 (2026-07-06 第8次): ⑲隣接10倍×④100倍×⑭[1,3]の整合。
  //  1ラング=コスト比1.62 ⇔ クッキー比 1.62^(1/0.08)=10^2.6(④の2.0桁+ノイズ余裕0.6桁)
  //  ⑤: クッキー×100 ⇔ PT×100^0.08=1.44(帯域[1,100]内で平坦寄り=ユーザー確認済みの逓減形)
  // pB=11: 第0回(±2e6クッキー)の獲得PT≈16 → core(コスト13)が⑭帯[1,3]で買える水準
  prestige: { pA: 0, pD1: 200000, pB: 11, pD2: 10000, pG: 0.075, pMin: 10000 },

  // ---- スキルコスト: 手設計順の等比ラダー cost_k = C0 * rho^k ----
  // 2026-07-06 第8次: ⑲=隣接ノード比≤10倍(edgeCap)。rho=1.57(1ラング=クッキー1.57^(1/0.075)≈2.6桁)。
  // ツリー再配線(sim.js)で全辺のラング差≤5 → 最大辺比 1.57^5=9.53 ≤ 10(クランプ非発動=ライダーなし)。
  // rungCosts はチューナ(tune.js)が焼き込む。空なら C0×rho^k を使う。
  // C0=13: coreの子ノード群(≤10×core=130)がチューナの序盤閾値(dec≈21-26)を収容できる水準
  skillCost: { mode: 'ladder', C0: 13, rho: 1.57, edgeCap: 10, utilRatio: 0.35, segments: [], rungCosts: [] },

  // ---- 生産系数値ノードの1ノードあたり目標倍率 ----
  nodeM: { all: 4, cps: 4, click: 3 }, // 14/14/9->4/4/3 (2026-07-06: 安価⑲ラダー下で周回時間を帯域スケールへ減速)

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
    gaugeR: 1.9,
    // 追跡ノルマ(⑧): chase=runCookies×10^-m を下限に毎秒10^θ倍で追い上げ。θ=m/(c×(120+8√総経過秒))
    chase: { m: 1.0, c: 0.02, act: 0.5 } // 発動遅延型: 経過>act×(120+8√総経過)で作動、θ=m/(c×同)。維持=帯域中盤で未達→押し込み→転生(⑦⑧)
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
  // 2026-07-06 第8次: 新帯域(周回25〜90分)へ向けownPow 0.25→0.27(再登坂・開拓の全体減速)、
  // 膝4300/1.0→900/0.55(深部の周回短縮を抑制。㉒単調増加と⑦後半帯域用)
  upCost: { coef: 1100, basePow: 0.60, ownPow: 0.27, knee: 900, ownPow2: 0.55 },

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
