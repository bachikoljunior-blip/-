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
  // rungCosts: tune.js の出力(rung_costs.json)を自動読込(なければ C0×rho^k)
  skillCost: { mode: 'ladder', C0: 13, rho: 1.57, edgeCap: 10, utilRatio: 0.35, segments: [],
    rungCosts: (function () { try { return require('./rung_costs.json'); } catch (e) { return []; } })() },

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
    // ノルマ層ゲージ(2026-07-06 ユーザー確定仕様・第9次): ゲージは「現時点のその回の総クッキーが
    // 何秒先のノルマまで達成できるか」の先行秒数 L のみを変数として貯まる。
    // 層kの必要ゲージ秒 = gaugeSec × gaugeGrow^(k-1)(層進行式。gaugeSec/gaugeGrow は調整項目)
    gaugeSec: 45, gaugeGrow: 1.45,
    // 層の上限(オーバーフロー防止・第9次): 通常の転生周回は最大でも約190層で到達しないため
    // 遊びには一切影響しない。ツリー完成後の超長時間放置(総クッキーが浮動小数上限に近づく)でのみ作用。
    gaugeMaxLayer: 400
    // 追跡ノルマ(旧⑧)は廃止(2026-07-06 ユーザー決定)。未達(T3a/T3b)は本来のノルマ係数
    // (baseCoef/basePow/base2Coef/base2Pow/w1〜w3P/ctrlMul/ctrlDiv)+後半成長の減速で作る。
  },

  // ---- 研究効果 ----
  // 2026-07-06 第8次: ①(各研究の有効性)で弱かった5研究の「所持数指数」(垂直吸収されない動的項)を強化:
  //  spiceGoldOwn .010→.014(.020はS3金特化が⑤上限超えで暴走: e218/周回16に崩壊) / bankOwn .028→.040, bankSaved 8→10 / galaxyOwn .019→.032 /
  //  quantumRes .30→.38, quantumOwn .019→.032 / antimatterOwn .002→.012, antimatterSkill .032→.045
  res: {
    // 会心1%開始(2026-07-06 ユーザー承認・第9次): score = 0.01 + 0.045×√強い指 + 0.002×最高到達層。
    // 取得直後(指0個・層0)でちょうど会心率1.0%。層項は周回内で会心が育つ動的項(①対策も兼ねる)
    fingerBase: 0.01, fingerSqrt: 0.045, fingerStage: 0.002, fingerCritBase: 2.0, fingerCritGrow: 10.0,
    grandmaSelf: 30, grandmaSup: [0.007, 0.008, 0.009],
    // 2026-07-06 第8次: ⑫(設備の文脈依存性)用に所持数指数を再配分。
    // factory一強(全方針の最効率=工場固定)を解消: oven 0.060→0.067 / spice 0.062→0.071 / factory 0.060→0.057
    // → 12h実測で最効率設備が factory 7方針 / oven 3方針 に分岐
    ovenSelf: 30, ovenOwn: 0.067, ovenStage: 0.012,
    factorySelf: 30, factoryLow: 0.006, factoryOwn: 0.057,
    spiceOwn: 0.071, spiceGold: 15, spiceGoldOwn: 0.014, spiceGoldDur: 30000,
    portalSelf: 25, portalHuntDur: 20000, portalHuntGrow: 0.0042, portalHuntSpawn: 0.010,
    bankOwn: 0.040, bankSaved: 10.0,
    moonBase: 25, moonStage: 0.003, moonOwn: 0.001,
    foldPortal: 0.002, foldMonster: 2.5, foldGold: 8,
    galaxyTypes: 0.5, galaxyOwn: 0.032,
    bhGlobal: 5, bhCompress: 0.0018,
    quantumRes: 0.38, quantumOwn: 0.032,
    antimatterOwn: 0.012, antimatterSkill: 0.045,
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
  // 第11次(値段割り・D'): weave.js が「1周回に中間目標1件」になるよう再配置した値を
  // weave_costs.json に保存し、ここで上書き読込する(研究コスト=調整項目・ユーザー確認済み)
  resCost: Object.assign({
    fingerTechnique: 2500, grandmaCrowd: 12000, ovenBatch: 30000,
    factoryNetwork: 150000, spiceBlend: 400000, portalNetwork: 1200000,
    bankClickDividend: 4000000, moonGlobalYeast: 40000000,
    portalGlobalFold: 400000000, galaxyAssembly: 6000000000,
    blackHoleCompression: 160000000000, quantumProofing: 3200000000000,
    antimatterRecipe: 64000000000000
  }, (function () { try { return require('./weave_costs.json').resCost || {}; } catch (e) { return {}; } })()),

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

  // ---- モンスター種類×報酬相性(2026-07-06 ユーザー承認・第9次) ----
  // 討伐した種類が報酬Lvの増分を決める: 増分 = max(1, floor(基本量 × 相性倍率))。
  // 出現はゲームと同じ重み(標準50/こつぶ22/鉄焼き14/はやて14)を決定的ローテーションで期待値化。
  // 黄金獣=金ブースト中に出現枠の35%を置換 / ボス=討伐25体ごと(+選択肢+1)。数値はすべて調整対象。
  mtype: {
    weights: { normal: 50, swarm: 22, tank: 14, speedy: 14 },
    hpMul: { normal: 1, swarm: 0.66, tank: 6, speedy: 0.45, goldenBeast: 2.5, boss: 12 }, // swarm=3体×0.22
    stayMul: { normal: 1, swarm: 1, tank: 1.5, speedy: 0.55, goldenBeast: 1, boss: 3.75 },
    rewardEvents: { normal: 1, swarm: 3, tank: 1, speedy: 1, goldenBeast: 1, boss: 1 }, // こつぶは3体分の報酬
    rewardLvAdd: { tank: 18 },
    goldenBeastShare: 0.35,
    bossCycle: 25,
    speedyGoldenCut: 0.5, // はやて撃破で次の金クッキー間隔×0.5
    bossChoiceBonus: 1,
    affinity: {
      normal: { golden: 1.0, hunt: 1.0, equipment: 1.0, risk: 1.0 },
      swarm: { golden: 0.5, hunt: 0.5, equipment: 0.5, risk: 0.5 }, // 1体あたり(3体で計1.5)
      tank: { golden: 0.5, hunt: 2.0, equipment: 3.5, risk: 1.0 },
      speedy: { golden: 3.0, hunt: 0.5, equipment: 0.5, risk: 1.5 },
      goldenBeast: { golden: 3.5, hunt: 1.0, equipment: 0.5, risk: 2.0 },
      boss: { golden: 4.0, hunt: 4.0, equipment: 4.0, risk: 4.0 }
    }
  },

  // ---- 熟練(2026-07-06 ユーザー採用・第11次。スキルで解放) ----
  // 職人の手(mastery_low)=下位7種 / 工程の極み(mastery_high)=上位9種。
  // 同じ設備を買うほど1台あたり生産が複利で伸びる(研究不要): ×(1+rate)^所持数。rateは調整項目
  mastery: { low: 0.003, high: 0.005 },

  // ---- 系列ボーナス(2026-07-06 ユーザー採用・第11次) ----
  // スキルで解放する上位設備(月面〜反物質)の固有能力(研究不要):
  // 1台につき「自分より下位の設備の直接生産の合計×coef」を追加生産(系列ぶんの又取りなし)。
  // 神の指(クリック型)は1台につきクリック力×(1+coef)相当の線形倍率。
  // → 初購入の瞬間に生産の約coef分をその1台が担う=㉑(基礎生産≥実CPS/5)を全方針で満たす設計
  lineage: { coef: 0.25 },

  // ---- 段階コストの研究別倍率(第11次・値段割り用) ----
  // 研究ごとに {s2, s3} を指定(なければ resStageCost の共通倍率)。研究コスト=調整項目(ユーザー確認済み)
  resStageCostEach: (function () { try { return require('./weave_costs.json').resStageCostEach || {}; } catch (e) { return {}; } })(),

  // ---- まとめ買い割増(2026-07-06 ユーザー採用・第10次) ----
  // 同じ設備を短時間に連続購入するほど値段に割増がつき、時間で元に戻る。
  // 割増倍率 = (1+perBuy)^熱量、熱量は購入ごとに+1、halfSec 秒ごとに半減(式・係数とも調整項目)。
  // 目的: 周回終盤の駆け込み買い(谷)を引き伸ばしつつ、待てば必ず買える=16時間の壁を作らない。
  upSurge: { perBuy: 0.25, halfSec: 75 },

  // ---- アップグレードコスト式 ----  cost = coef * base^basePow * growth^(owned*ownPow)
  // 2026-07-06 第8次: 新帯域(周回25〜90分)へ向けownPow 0.25→0.27(再登坂・開拓の全体減速)、
  // 膝4300/1.0→900/0.55(深部の周回短縮を抑制。㉒単調増加と⑦後半帯域用)
  upCost: { coef: 1100, basePow: 0.60, ownPow: 0.27, knee: 2600, ownPow2: 0.72 },

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
