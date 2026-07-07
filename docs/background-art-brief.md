# 背景制作指示書(注文ボード / 工房)

新規スクリーン背景 2 枚(**注文ボード** タブ と **工房** タブ)の制作指示です。
現在この 2 タブは専用背景を持たず、既定の暗いグラデーションのみで表示されています。
既存背景(`images/screen_play.webp`〜`screen_info.webp`)と世界観・画風をそろえてください。

---

## 共通仕様(全背景に共通)

| 項目 | 指定 |
| --- | --- |
| 向き / サイズ | 縦長ポートレート **720 × 1280px**(既存スクリーン背景と同一) |
| 形式 | **WebP**(不透明、品質 80 前後)。`images/` に配置 |
| 画風 | 既存背景と同じ **重厚なスチームパンク × ファンタジー・ベーカリー**の一枚絵。没入型の室内シーン(額縁ではなく空間そのものを描く) |
| ライティング | ランタン/炉の暖色を主光源に、奥に神秘的な差し色(紫の銀河・魔法陣の発光など)。温かいゴールド〜アンバー基調 |
| 構図 | **画面中央〜下寄りを開けた広い床/面**にする。ここに UI(カード・ボタン・リスト)が重なるため、装飾は周縁に寄せ、中央は情報が読める明度に保つ |
| 明度設計 | 実装側で上端に暗幕グラデーションを重ねる前提(見出し用)。**上端は装飾を置きつつ文字が埋もれない**構図に |
| モチーフ | クッキー、チョコチップ、焼き菓子、真鍮の機械。ロゴ・実在ブランド・読める文字は入れない |

> 実装側の暗幕例(見出しの視認性確保):
> `linear-gradient(180deg, rgba(14,8,4,0.78), rgba(8,4,2,0.42) 26%, rgba(8,4,2,0.58))`

---

## 1. 注文ボード背景(`images/screen_order.webp`)

**用途:** 「注文ボード」タブ。制限時間つきの短期目標(注文)カードと進捗・残り時間バーが中央に並ぶ。

**シーン:** ベーカリー工房に併設された**受注ディスパッチ室**。

- 中央奥に、真鍮と木でできた大きな**受注掲示板(オーダーボード)**。
  盤面には**羊皮紙の注文票が複数ピン留め**(文字は判読不能なダミー、飾りのスタンプや封蝋)。
  麻ひも・真鍮ピン・番号タグでにぎやかに。
- 掲示板まわりに、時間制限を象徴する**真鍮のサービスベル・砂時計・大きな柱時計**を配置。
- 手前左右の作業台に、伝票束・インク壺と羽根ペン・焼き上がりクッキーを盛った皿・木箱・秤。
- 奥にアーチ窓やランタンで暖色の奥行き。壁際にはクッキーの瓶詰め棚。
- **中央〜下部の床/カウンター面は広く開け**、やや明るめ・装飾控えめにして注文カードが読めるように。

**組み込み手順(実装):**
1. `images/screen_order.webp` を配置。
2. `ASSETS.screens` に `order: "images/screen_order.webp"` を追加。
3. 初期化で `root.style.setProperty("--screen-order", url(...))` を設定(既存 screen 群と同じ書式)。
4. CSS に追記:
   `#orderTab { background-image: linear-gradient(180deg, rgba(14,8,4,0.78), rgba(8,4,2,0.42) 26%, rgba(8,4,2,0.58)), var(--screen-order) !important; }`

---

## 2. 工房背景(`images/screen_workshop.webp`)

**用途:** 「工房」タブ。モンスター素材を使った**料理(消費バフ)・素材庫・作成(永続装備)**を行う画面。素材アイコンや作成カードが中央に並ぶ。

**シーン:** クッキーを焼き、素材を加工する**魔法仕掛けのベーカリー工房(厨房兼クラフト場)**。

- 中央奥に**大きな石窯・真鍮のオーブン**。焚き口からオレンジの熱光が漏れ、湯気と火の粉が舞う。
- 左右の作業台に、ミキシングボウル・麺棒・天板のクッキー・泡立て器・計量器。歯車やパイプでスチームパンク感。
- **素材庫**を思わせる要素:壁面の**引き出し棚・ガラス瓶に入った素材**(小麦粉、結晶、黄金粉、鉱石片など)、ラベル付きの木箱。
- **作成(装備)**を思わせる要素:飾り台に置かれた**真鍮の調理器具(泡立て器・ヘラ)** をアーティファクト風に。
- 天井付近のランタンと炉の光で暖色の奥行き。差し色に魔法陣や淡い発光を少量。
- **中央の作業カウンター面を広く開け**、料理・素材・作成カードが乗る明度に保つ。

**組み込み手順(実装):**
1. `images/screen_workshop.webp` を配置。
2. `ASSETS.screens` に `workshop: "images/screen_workshop.webp"` を追加。
3. 初期化で `root.style.setProperty("--screen-workshop", url(...))` を設定。
4. CSS に追記:
   `#workshopTab { background-image: linear-gradient(180deg, rgba(14,8,4,0.78), rgba(8,4,2,0.42) 26%, rgba(8,4,2,0.58)), var(--screen-workshop) !important; }`

---

## 生成 AI 向け英語プロンプト(参考)

**注文ボード:**
> Immersive steampunk-fantasy bakery order-dispatch room interior, portrait
> 720x1280, large brass-and-wood commission notice board with pinned aged
> parchment order slips, brass service bell, hourglass and grandfather clock,
> ink pot and quill, plates of cookies, jars on shelves, warm golden lantern
> light, open uncluttered brighter counter/floor area in the lower center for UI
> cards, hand-painted game background, no readable text, no logos.

**工房:**
> Immersive steampunk-fantasy magical bakery workshop and crafting room interior,
> portrait 720x1280, large brass oven with glowing orange firelight and steam,
> workbenches with mixing bowls, rolling pins, whisks and trays of cookies,
> material storehouse with labeled drawers and glass jars of ingredients and
> crystals, brass baking tools displayed like artifacts, gears and pipes, warm
> golden light with faint magical glow, open brighter central counter for UI,
> hand-painted game background, no readable text, no logos.
