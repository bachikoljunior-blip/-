'use strict';
// 自動チューナ: 周回時間 D_k を帯域 [0.5Y, Y] の中央付近(0.72Y)に合わせるよう、
// メインラング(rung)ごとのスキルコストを反復調整する。
// モデル: D_k = A(深さ) + B_k×(しきい値dec - 自然フロンティアdec)。B_k は反復間の割線で推定。
const fs = require('fs');

function decMinStep(k) { return 2.6; } // ⑤下限: コスト比2倍 ⇔ pG=0.13で2.32桁。余裕をみて2.6
const RESUME = process.argv.includes('--resume');
// 押し込み上限: ⑤上限(PT比100倍 ⇔ pG=0.5で4.0桁)内に収める(rung13の初回キャッチアップのみ例外)
function decMaxStep(k) { return 8; } // ⑤上限: コスト比100倍 ⇔ 15.4桁。周回を伸ばす余地を残して8桁
const TARGET_FRAC = 0.80;       // 周回時間の狙い(帯域上限Yの内側。維持=チェイス失敗は0.5Y〜0.75Yに来る)
const HOURS = Number(process.argv[4] || 30); // 探索は30hで十分(全解放~15h+免除)
const ITERS = Number(process.argv[2] || 8);
const STRAT_ID = process.argv[3] || 'S1';

// 帯域式(2026-07-06 確定・2段階): 初転生まで 120+8√x / 初転生後 1440+8√x。runner.js と必ず一致させること
function makeY(sim) {
  const r0 = sim.runs[0];
  const fp = (r0 && !r0.partial) ? r0.endT : Infinity;
  return x => (x >= fp ? 1440 : 120) + 8 * Math.sqrt(Math.max(0, x));
}
function dec(v) { return Math.log10(Math.max(1, v)); }
// 転生PT式は params.js から読む(pG=0.50 対応):
// gain = pB*(run/pD2)^pG >= cost*1.2  →  run = pD2*(1.2*cost/pB)^(1/pG)
const PP = require('./params.js').prestige;
const INV_PG = 1 / PP.pG;
const BUY_F = 1.2 / PP.pB; // = 3 (買付係数1.2 / pB)
function costFromRunDec(d) { return Math.pow(10, (d - Math.log10(PP.pD2)) / INV_PG) / BUY_F; }
function runDecFromCost(c) { return Math.log10(PP.pD2) + INV_PG * (Math.log10(c) + Math.log10(BUY_F)); }

function freshSim(rungCosts) {
  for (const k of Object.keys(require.cache)) {
    if (/params\.js|sim\.js|strategies\.js/.test(k)) delete require.cache[k];
  }
  const P = require('./params.js');
  if (rungCosts) P.skillCost.rungCosts = rungCosts;
  const G = require('./sim.js');
  const { STRATEGIES } = require('./strategies.js');
  return { G, P, STRATEGIES };
}

// 現在の segments からラングコスト初期ベクトルを得る
function currentRungCosts() {
  const { G } = freshSim(null);
  const mains = [];
  const seen = new Set();
  for (const n of G.SKILL_NODES) if (!G.isUtilitySkill(n.id)) mains.push(n.id);
  // hand order でのコスト
  const costs = [];
  const byCost = G.SKILL_NODES.filter(n => !G.isUtilitySkill(n.id)).map(n => G.skillCostOf(n)).sort((a, b) => a - b);
  return byCost;
}

// 条件⑥(2026-07-05 新定義): 設備・研究(段階含む)・スキルの全解放を個別カウント、
// 同一秒に発生した解放のみ1件に統合。全スキル解放後は免除。runner.js と同じ定義。
function fullUnlockTimeOf(sim, G) {
  const totalNodes = G.SKILL_NODES.length;
  let n = 0;
  const ev = sim.unlockEvents.filter(e => e.kind === 'skill').sort((a, b) => a.t - b.t);
  for (const e of ev) { n += e.n || 1; if (n >= totalNodes) return e.t; }
  return Infinity;
}
function paceCount(sim, G) {
  const ts = [];
  for (const e of sim.unlockEvents.slice().sort((a, b) => a.t - b.t)) {
    if (ts.length && ts[ts.length - 1] === e.t) continue;
    ts.push(e.t);
  }
  const fullT = fullUnlockTimeOf(sim, G);
  const yC = makeY(sim);
  let ok = 0, all = 0;
  for (let i = 0; i + 1 < ts.length; i++) {
    if (ts[i] >= fullT) continue;
    const y = ts[i + 1] - ts[i];
    const Y = yC(ts[i + 1]);
    all++;
    if (y >= 0.5 * Y && y <= Y) ok++;
  }
  return { ok, all };
}

function evalRun(rungCosts, stratId) {
  const { G, STRATEGIES } = freshSim(rungCosts);
  const s = STRATEGIES.find(x => x.id === stratId);
  const sim = G.simulate(s, { hours: HOURS });
  // メインノード id → rung index
  const rungOf = {};
  let r = 0;
  for (const id of G.SKILL_HAND_ORDER || []) { /* not exported; rebuild below */ }
  // rung index を cost 順で再構成
  const mains = G.SKILL_NODES.filter(n => !G.isUtilitySkill(n.id))
    .map(n => ({ id: n.id, c: G.skillCostOf(n) })).sort((a, b) => a.c - b.c);
  mains.forEach((m, i) => rungOf[m.id] = i);
  const runs = sim.runs.map(rr => ({
    idx: rr.idx, startT: rr.startT, dur: rr.duration, hold: rr.quotaHold,
    cookies: rr.runCookies, partial: rr.partial, gain: rr.gain,
    mains: (rr.skillIds || []).filter(id => rungOf[id] != null).map(id => rungOf[id])
  }));
  return { sim, runs, rungOf, mains, G };
}

let rungCosts = RESUME && fs.existsSync('rung_costs.json') ? JSON.parse(fs.readFileSync('rung_costs.json', 'utf8')) : currentRungCosts();
const NR = rungCosts.length;
let Bhat = new Array(NR).fill(null).map((_, i) => i <= 13 ? 700 : (i <= 20 ? 150 : 45)); // 秒/dec 初期推定
let prevState = null; // {decT:[], D:[]}

for (let it = 0; it < ITERS; it++) {
  const { runs, sim, G } = evalRun(rungCosts, STRAT_ID);
  const pace = paceCount(sim, G);
  const yC = makeY(sim);
  const full = runs.filter(r => !r.partial);
  // 帯域判定+表示(⑦: Yは転生した時点 x=startT+dur で評価)
  let ok = 0, all = 0;
  const rows = [];
  for (const r of full) {
    const x = r.startT + r.dur;
    const Y = yC(x);
    const inBand = r.hold >= 0.5 * Y && r.hold <= Y;
    all++; if (inBand) ok++;
    rows.push({ r, x, Y, inBand });
  }
  // ラングごとの実測: このrunで買った最小rung
  // 新しいdecしきい値の決定
  const decT = rungCosts.map(c => runDecFromCost(c));
  const newDecT = decT.slice();
  const obsD = new Array(NR).fill(null);
  const obsDec = new Array(NR).fill(null);
  for (let i = 0; i < full.length; i++) {
    const r = full[i];
    if (!r.mains.length) continue;
    const rung = Math.min(...r.mains);
    if (rung === 0) continue; // core は run0 (帯域対象外扱い: 序盤)
    obsD[rung] = r.dur; // 2026-07-06: 狙いは「周回時間」。維持時間はチェイスノルマ側で帯域に合わせる
    obsDec[rung] = dec(r.cookies);
    const target = TARGET_FRAC * yC(r.startT + r.dur);
    const err = target - r.dur; // 正: 伸ばす必要
    if (rung <= 0) continue;
    let B = Bhat[rung];
    // 割線更新
    if (prevState && prevState.obsD[rung] != null && obsD[rung] != null) {
      const dT = decT[rung] - prevState.decT[rung];
      const dD = obsD[rung] - prevState.obsD[rung];
      if (Math.abs(dT) > 0.05 && dD * dT > 0) {
        B = Math.min(3000, Math.max(15, dD / dT));
        Bhat[rung] = 0.5 * Bhat[rung] + 0.5 * B;
      }
    }
    // 実測クッキーdecを基準に、必要な押し込み量を加算
    if (RESUME) {
      // ポリッシュ: しきい値基準の小刻み更新(実測ベースのラチェットを防ぐ)
      const stepDec = Math.max(-1.5, Math.min(1.2, err / Bhat[rung]));
      newDecT[rung] = decT[rung] + stepDec;
    } else {
      const stepDec = Math.max(-10, Math.min(2, err / Bhat[rung]));
      newDecT[rung] = dec(r.cookies) + stepDec - 0.15; // 0.15: 買付係数1.2ぶんの粗い戻し
      // ×100の実測保護: 前の周回の実測クッキー+2.05decを下限にする
      const prevRun = full[i - 1];
      if (prevRun) newDecT[rung] = Math.max(newDecT[rung], dec(prevRun.cookies) + 2.05);
    }
  }
  // 単調性 + ×100 間隔 + 暴走防止
  for (let k = 1; k < NR; k++) {
    if (newDecT[k] < newDecT[k - 1] + decMinStep(k)) newDecT[k] = newDecT[k - 1] + decMinStep(k);
    if (k >= 13 && newDecT[k] > newDecT[k - 1] + decMaxStep(k)) newDecT[k] = newDecT[k - 1] + decMaxStep(k);
  }
  const newCosts = newDecT.map((d, i) => i === 0 ? rungCosts[0] : costFromRunDec(d));
  // 収束レポート
  const holdOkPct = (100 * ok / all).toFixed(0);
  const total = full.reduce((a, r) => a + r.cookies, 0);
  let x100 = 0, x100all = 0, pt2 = 0; const fails = [];
  for (let i = 1; i < full.length; i++) { x100all++; if (full[i].cookies >= 100 * full[i - 1].cookies) x100++; else fails.push(`${full[i-1].idx}->${full[i].idx}(x${(full[i].cookies/full[i-1].cookies).toFixed(0)})`); if (full[i].gain >= 1 * full[i - 1].gain && full[i].gain <= 100 * full[i - 1].gain) pt2++; }
  console.log(`[iter ${it}] runs=${runs.length} band ${ok}/${all} (${holdOkPct}%) x100 ${x100}/${x100all} pt2-100 ${pt2}/${x100all} pace ${pace.ok}/${pace.all} total=${total.toExponential(2)} ${fails.length?'FAIL:'+fails.join(' '):''}`);
  const score = (x100 === x100all ? 1000 : 0) + ok + pace.ok * 0.5 + pt2 * 0.5 - fails.length * 2;
  if (!globalThis.__best || score > globalThis.__best.score) globalThis.__best = { score, costs: rungCosts.slice(), ok, x100, x100all };
  if (it === ITERS - 1) {
    for (const { r, x, Y, inBand } of rows) {
      const j = inBand ? 'OK' : (r.hold > Y ? '長' : '短');
      console.log(` run${String(r.idx).padStart(2)} x=${(x / 3600).toFixed(2)}h D=${Math.round(r.hold)}s Y=${Math.round(Y)}s ${j} dec=${dec(r.cookies).toFixed(1)} rung=${r.mains.length ? Math.min(...r.mains) : '-'}`);
    }
  }
  prevState = { decT, obsD, obsDec };
  rungCosts = newCosts;
}
const best = globalThis.__best;
fs.writeFileSync('rung_costs.json', JSON.stringify(best ? best.costs : rungCosts, null, 1));
console.log(`saved rung_costs.json (best: band=${best && best.ok}, x100=${best && best.x100}/${best && best.x100all})`);
