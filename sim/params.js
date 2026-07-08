'use strict';
// 調整対象パラメータ。ORIG = 元コードの値。ここを書き換えて反映する。
module.exports = {
  // ---- 転生ポイント獲得量 ----
  // gain = floor( pA*(1-exp(-run/pD1)) + pB*(run/pD2)^pG ) , run>=pMin
  // pG=0.08 (2026-07-06 第8次): ⑲隣接10倍×④100倍×⑭[1,3]の整合。
  //  1ラング=コスト比1.62 ⇔ クッキー比 1.62^(1/0.08)=10^2.6(④の2.0桁+ノイズ余裕0.6桁)
  //  ⑤: クッキー×100 ⇔ PT×100^0.08=1.44(帯域[1,100]内で平坦寄り=ユーザー確認済みの逓減形)
  // pB=11: 第0回(±2e6クッキー)の獲得PT≈16 → core(コスト13)が⑭帯[1,3]で買える水準
  // costExp0/costStep(2026-07-08 ユーザー・ゲーム仕様変更): 転生に必要な所持クッキーは「10のべき乗」かつ
  // 「転生するたびに前回より大きくなる」。必要量 = 10^(costExp0 + costStep×これまでの転生回数)。
  // costStep≥1 で毎回きっちり10のべき乗ぶん増える(前回より必ず大)。costStep は調整項目。
  prestige: { pA: 0, pD1: 200000, pB: 11, pD2: 10000, pG: 0.075, pMin: 10000, costExp0: 6, costStep: 1 },

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
    gaugeMaxLayer: 400,
    // 追跡ノルマ(旧⑧)は廃止(2026-07-06 ユーザー決定)。未達(T3a/T3b)は本来のノルマ係数
    // (baseCoef/basePow/base2Coef/base2Pow/w1〜w3P/ctrlMul/ctrlDiv)+後半成長の減速で作る。
    // 層の試練(2026-07-07 ユーザー採用・0-2提案4 / 第12次H 提案8で新規開拓層基準へ相対化): 発火せず無害の resting 値。
    trialCoef: 0.08, trialStartLayer: 10,
    // ---- 到達連動ノルマ(第12次H・提案9・ユーザー承認) ----
    // T3a を全周回・後半に置くための機構。層ゲージ(quotaAtElapsed=時間関数)には一切触れず、未達判定にだけ
    // 「到達項」を足す: 未達 = runCookies < max(従来ノルマ, runCookies×reachCoef×ρ^reachPow)。
    // ρ = 今回の周回内経過秒 ÷ max(前回周回の長さ prevDuration, reachMinSec)(=各周回の進行を前回長で正規化)。
    // runCookies が両辺で相殺 → 実質「ρ が ρ*=(1/reachCoef)^(1/reachPow) を越えたら未達」。絶対クッキー桁に非依存。
    // 層比でなく時間比にした理由: 未達で層が凍結するため層比は序盤に寄る&層が崩壊する(第12次H実測)。
    // reachCoef=20, reachPow=10 → ρ*≈0.74(前回周回長の約7.4割の時点で未達)。序盤は runCookies<従来ノルマ側が勝ち従来挙動。
    // minSec=600 は掃引で確定(1200だと周回の短い方針=S3が ρ* に届かず取りこぼす。600で S3 21→44/47)。第12次H実測。
    // reachMaxSec=denom の上限クランプ(0=無効)。直前が極端に長い→短い周回で reach が未発火=T3a取りこぼし、を防ぐ。
    // 6000 で確定(sweep_maxsec.js で T3a と T3b を同時掃引): T3a全体 86→88%・S10 18/23@34% → 25/26@62%、
    // かつ T3b を維持(5000だと reach が早発して S8/S10 の T3b が落ちる。6000で S8 T3b40・S10 T3b17 を回復)。4000以下は位置が頭へ崩れる。
    reachCoef: 20, reachPow: 10, reachMinSec: 600, reachMaxSec: 6000
  },

  // ---- 設備直送生産(第12次J・提案A・ユーザー承認 2026-07-07) ----
  // ㉘(a)対策: 設備収入(cps)は後半に自前の複利倍率を持たず、金クッキー・討伐報酬の複利成長に
  // 追い越されて設備シェアが0%へ減衰する(bake が主役30%を保てない)。そこで生産設備に
  // 「最高層に比例した直接クッキー収入」を新設する。この収入は金ブースト・討伐報酬の乗算対象外の
  // 独立加算項=設備固有の稼ぎ口。全生産倍率ではないので㉘の独占も再発しない。
  // 【第12次J-3・対称の直送収入(ユーザー2026-07-08「オーブンが強すぎるなら他も強く」)】
  //   直送 = coef × base(cps+タップ) × (ジャンル投資量/ref)^countPow × (最高層-startStage)^stagePow
  // 各稼ぎ口に、そのジャンルへ投資したプレイヤーだけ強く効く独立収入を用意し、各方針の主役を後半も≥30%に立たせる。
  // すべて skill→research→効果 でゲート(設備=ovenBatch段2/金=spiceBlend段2/討伐=portalNetwork段2/タップ=fingerTechnique段2)。
  // coef=0 で各無効。tune で全体最良点を掃引(㉘の各主役≥30%と経済/テンポ非破綻の両立)。調整項目。
  equipDirect:  { coef: 0.02, stagePow: 0.5, countPow: 2, ref: 100, startStage: 5 }, // 投資量=オーブン所持数
  goldenDirect: { coef: 0.012, stagePow: 0.5, countPow: 2, ref: 30,  startStage: 5 }, // 投資量=金perk合計
  huntDirect:   { coef: 0.012, stagePow: 0.5, countPow: 2, ref: 30,  startStage: 5 }, // 投資量=討伐perk合計
  tapDirect:    { coef: 0.01, stagePow: 0.5, countPow: 2, ref: 20,  startStage: 5 }, // 投資量=神の指+強い指/10
  // 銀行配当(直送・第12次J-3 腐り解消): bankClickDividend研究の独立収入。クリック方針で厚く効かせ①の各回minを満たす。
  // 全体cps倍率をやめ加算収入へ(他機能のlift希釈を回避)。所持数はlog10で床あり=早い周回でも効く。増加方向のみ。
  bankDirect:   { coef: 0.22, ownRate: 0.5, savedCoef: 0.05, clickBonus: 1.5, countCoef: 0.9, countPow: 1.5, ref: 150 }, // 投資量=銀行所持数+貯蓄(総クッキー桁)

  // ---- 討伐連鎖(2026-07-07 ユーザー採用・0-2提案1) ----
  // 最後の討伐から breakSec 以内に次を倒すと連鎖+1(こつぶ群れは3体分)。過ぎたら0、転生でも0。上限なし。
  // 効果はすべて連鎖数Nに線形(共鳴のような雪だるまにならない):
  //  prodCoef=全生産×(1+prodCoef×N) / dropCoef=素材ドロップ量×(1+dropCoef×N)(素材は現状ゲームのみ) /
  //  rewardCoef=報酬レベル+floor(rewardCoef×N)
  chain: { prodCoef: 0.02, dropCoef: 0.02, rewardCoef: 0.05, breakSec: 90 },

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
    categoryBonusRate: 0.003, categoryHalf: 400,
    // 第12次K(2026-07-08 ③再テーマ・増加方向のみ): 金報酬トリオ+獣の匂いを飽和しない金の稼ぎ(金即時獲得量=amount)へ
    // 再テーマ。従来のダメージ/初撃/金出現間隔効果は残置(削除しない)し、金amount倍率への加算を新設(所持Lvに線形=非飽和)。
    // これで金特化方針で instant lift が立つ(ダメージ飽和次元・通し比較のゆらぎに埋もれない)。
    goldenChainAmount: 0.30, goldenTargetAmount: 0.30, goldenFirstHitAmount: 0.35, beastScentAmount: 0.30
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
    ovenS3Flat: 0.06, ovenStageCoef: 0.004,
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
