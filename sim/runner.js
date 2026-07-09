'use strict';
// 実行/評価ハーネス
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');

function fmtN(n) {
  if (!Number.isFinite(n)) return String(n);
  if (n >= 1e15) return n.toExponential(2);
  if (n >= 1e4) return n.toExponential(2);
  return String(Math.round(n * 100) / 100);
}
function fmtT(s) {
  s = Math.round(s);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return (h > 0 ? h + 'h' : '') + m + 'm' + sec + 's';
}
// 帯域式(2026-07-06 ユーザー承認・第10次): 初転生まで Y=120+8√x / 初転生後 Y=1440+3√x (係数8→3)
function firstPrestigeT(sim) {
  const r0 = sim.runs[0];
  return (r0 && !r0.partial) ? r0.endT : Infinity;
}
function makeY(sim) {
  const fp = firstPrestigeT(sim);
  return x => x >= fp ? 1440 + 3 * Math.sqrt(Math.max(0, x)) : 120 + 8 * Math.sqrt(Math.max(0, x));
}
// 旧単段式(参考・tune互換用)
function yCurve(x) { return 120 + 8 * Math.sqrt(x); }

// 全スキル解放時刻 (未達なら Infinity)。以降はペース/ノルマ維持条件を無視してよい
function fullUnlockTime(sim) {
  const totalNodes = G.SKILL_NODES.length;
  let n = 0;
  const ev = sim.unlockEvents.filter(e => e.kind === 'skill').sort((a, b) => a.t - b.t);
  for (const e of ev) {
    n += e.n || 1;
    if (n >= totalNodes) return e.t;
  }
  return Infinity;
}

// 条件⑥の「解放」(2026-07-05 ユーザー再定義): 設備・研究(段階含む)・スキルの
// すべての新規解放を個別にカウントする。同一秒に発生した解放のみ1件に統合する。
// (旧「同一周回内は1解放に統合」は廃止。スキルは転生時に同時取得されるため自然に1件になる)
function mergeEventsByRun(sim) {
  const ev = sim.unlockEvents.slice().sort((a, b) => a.t - b.t);
  const merged = [];
  for (const e of ev) {
    const last = merged[merged.length - 1];
    if (last && last.t === e.t) { last.id += ',' + e.id; last.kind += '+' + e.kind; continue; }
    merged.push({ t: e.t, kind: String(e.kind), id: String(e.id) });
  }
  return merged;
}

function summarize(sim) {
  const total = sim.runs.reduce((a, r) => a + r.runCookies, 0);
  const fullT = fullUnlockTime(sim);
  const yC = makeY(sim);
  const full = sim.runs.filter(r => !r.partial);
  // ④ 各回の総クッキーが前回の100倍以上 / ⑤ 転生PTが前回の1倍以上100倍以内(2026-07-06 確定)
  let doubleOk = 0, doubleAll = 0, gainOk = 0;
  for (let i = 1; i < full.length; i++) {
    doubleAll++;
    if (full[i].runCookies >= 100 * full[i - 1].runCookies) doubleOk++;
    if (full[i].gain >= 1 * full[i - 1].gain && full[i].gain <= 100 * full[i - 1].gain) gainOk++;
  }
  // ==== テンポ条件 T1〜T3b(2026-07-06 ユーザー確定。旧⑥⑦⑧㉒を置換・3-2反映済み) ====
  const ev = mergeEventsByRun(sim);
  // T1(周回時間): 各周回(転生から転生まで)20分〜2時間。第0回も含む。
  // 全スキル解放後の放置周回は対象外【仮:旧⑥⑦の免除ルールを踏襲。要ユーザー確認】
  let t1Ok = 0, t1All = 0;
  for (const r of full) {
    if (r.startT >= fullT) continue;
    t1All++;
    if (r.duration >= 1200 && r.duration <= 7200) t1Ok++;
  }
  // T2(解放テンポ): 初転生後の各周回で新規解放1〜3件(同一秒は統合済み。スキルは転生時に自然に1件)。
  // 周回への帰属は [startT, endT)(転生時のスキル取得はその周回の頭に数える)。
  // 第0回のみ従来の間隔中央値判定: 間隔y÷帯域Y(120+8√x)の中央値が[0.5, 1]【中央値の取り方は仮】
  let t2Ok = 0, t2All = 0, t2Run0 = null;
  {
    const r0 = full[0];
    if (r0) {
      const e0 = ev.filter(e => e.t < r0.endT);
      const ratios = [];
      for (let i = 0; i + 1 < e0.length; i++) {
        const y = e0[i + 1].t - e0[i].t;
        const Y = 120 + 8 * Math.sqrt(e0[i + 1].t);
        ratios.push(y / Y);
      }
      if (ratios.length) {
        ratios.sort((a, b) => a - b);
        const med = ratios[Math.floor(ratios.length / 2)];
        t2Run0 = { med, ok: med >= 0.5 && med <= 1 };
      }
    }
    for (let i = 1; i < full.length; i++) {
      const r = full[i];
      if (r.startT >= fullT) continue;
      const n = ev.filter(e => e.t >= r.startT && e.t < r.endT).length;
      t2All++;
      if (n >= 1 && n <= 3) t2Ok++;
    }
  }
  // T3a(未達が先): どの転生も、その周回内でノルマ未達が起きた後に行われる
  let failOk = 0;
  for (const r of full) if (r.quotaFailAt != null && r.quotaFailAt < r.duration) failOk++;
  // T3b(維持時間半分): ノルマを維持できていた時間 ≥ その周回の長さの半分
  let t3bOk = 0;
  for (const r of full) if (r.quotaHold >= 0.5 * r.duration) t3bOk++;
  // 参考指標(合否に使わない): 旧⑥解放間隔の帯域適合
  let paceOk = 0, paceAll = 0;
  const yC2 = yC;
  for (let i = 0; i + 1 < ev.length; i++) {
    if (ev[i].t >= fullT) continue;
    const y = ev[i + 1].t - ev[i].t;
    const Y = yC2(ev[i + 1].t);
    paceAll++;
    if (y >= 0.5 * Y && y <= Y) paceOk++;
  }
  // 条件⑭: 各周回の獲得PT ÷ 次の未取得スキル最安コスト(転生時点・購入前) ∈ [1.0, 3.0]
  let pwOk = 0, pwAll = 0;
  for (const r of full) {
    if (r.gainToNext == null) continue;
    pwAll++;
    if (r.gainToNext >= 1.0 && r.gainToNext <= 3.0) pwOk++;
  }
  // 参考指標(合否に使わない): 旧㉒周回時間の単調増加
  let durOk = 0, durAll = 0;
  for (let i = 1; i < full.length; i++) { durAll++; if (full[i].duration > full[i - 1].duration) durOk++; }
  // 条件㉑(Δ生産方式・2026-07-06): 初購入によるΔ生産(系列ボーナス等の固有能力込み)≥購入直前CPS×1/5
  let prOk = 0, prAll = 0, prWorst = null;
  for (const c of (sim.presenceChecks || [])) {
    prAll++;
    const ratio = c.ref > 0 ? (c.delta * 5) / c.ref : Infinity;
    if (ratio >= 1) prOk++;
    if (!prWorst || ratio < prWorst.ratio) prWorst = { id: c.id, runIdx: c.runIdx, ratio };
  }
  return { total, runs: sim.runs.length, doubleOk, doubleAll, gainOk, t1Ok, t1All, t2Ok, t2All, t2Run0, t3bOk, paceOk, paceAll, events: ev.length, fullT, failOk, failAll: full.length, pwOk, pwAll, durOk, durAll, prOk, prAll, prWorst };
}

function runBaseline(hours, only) {
  const out = [];
  for (const s of STRATEGIES) {
    if (only && s.id !== only) continue;
    const t0 = Date.now();
    const sim = G.simulate(s, { hours });
    const sum = summarize(sim);
    out.push({ s, sim, sum, ms: Date.now() - t0 });
  }
  return out;
}

function printBaseline(results) {
  console.log('ID  名称              周回数 総クッキー   ④x100  ⑤PT1-100 T1周回時間 T2解放1-3 T2第0回 T3a未達先 T3b維持半分 ⑭購買力 ㉑存在感 全解放 | 参考: 旧⑥ペース 旧㉒単調増');
  for (const r of results) {
    const fullT = r.sum.fullT === Infinity ? '未' : fmtT(r.sum.fullT);
    const t2r0 = r.sum.t2Run0 ? `${r.sum.t2Run0.ok ? 'OK' : 'NG'}(中央値${r.sum.t2Run0.med.toFixed(2)})` : '-';
    console.log(
      `${r.s.id.padEnd(3)} ${r.s.name.padEnd(14)} ${String(r.sum.runs).padStart(4)}  ${fmtN(r.sum.total).padStart(10)}  ${r.sum.doubleOk}/${r.sum.doubleAll}   ${r.sum.gainOk}/${r.sum.doubleAll}   ${r.sum.t1Ok}/${r.sum.t1All}   ${r.sum.t2Ok}/${r.sum.t2All}  ${t2r0}  ${r.sum.failOk}/${r.sum.failAll}  ${r.sum.t3bOk}/${r.sum.failAll}  ${r.sum.pwOk}/${r.sum.pwAll}  ${r.sum.prOk}/${r.sum.prAll}  ${fullT} | ${r.sum.paceOk}/${r.sum.paceAll} ${r.sum.durOk}/${r.sum.durAll}  (${r.ms}ms)` +
      (r.sum.prWorst && r.sum.prWorst.ratio < 1 ? `  ㉑最悪: ${r.sum.prWorst.id}@run${r.sum.prWorst.runIdx} x${r.sum.prWorst.ratio.toFixed(2)}` : '')
    );
  }
}

function printDetail(sim, maxRows) {
  const fullT = fullUnlockTime(sim);
  console.log('run  開始      周回時間   T1判定  ノルマ維持  T3b判定  T3a未達  最高層 討伐 金  総クッキー     PT  スキル数  前周比');
  const rows = sim.runs.slice(0, maxRows || 200);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const prev = i > 0 ? sim.runs[i - 1].runCookies : null;
    const ratio = prev ? (r.runCookies / prev).toFixed(2) : '-';
    const t1J = r.partial ? '-' : (r.startT >= fullT ? '免除' : (r.duration >= 1200 && r.duration <= 7200 ? 'OK' : (r.duration > 7200 ? '長い' : '短い')));
    const t3bJ = r.partial ? '-' : (r.quotaHold >= 0.5 * r.duration ? 'OK' : 'NG');
    const t3aJ = r.partial ? '-' : (r.quotaFailAt != null && r.quotaFailAt < r.duration ? 'OK' : 'NG');
    console.log(
      `${String(r.idx).padStart(3)}  ${fmtT(r.startT).padStart(8)}  ${fmtT(r.duration).padStart(8)}  ${t1J.padEnd(4)}  ${fmtT(r.quotaHold).padStart(8)}  ${t3bJ.padEnd(3)}  ${t3aJ.padEnd(3)}  ${String(r.maxStage).padStart(4)} ${String(r.kills).padStart(4)} ${String(r.golden).padStart(3)}  ${fmtN(r.runCookies).padStart(12)}  ${String(r.gain).padStart(5)}  ${String(r.skillsBought == null ? '-' : r.skillsBought).padStart(3)}   ${ratio}${r.partial ? ' (途中)' : ''}  ${(r.skillIds || []).join(',')}`
    );
  }
}

function printPacing(sim) {
  const ev = mergeEventsByRun(sim);
  const yC = makeY(sim);
  console.log('解放イベント (全解放を個別カウント・同一秒のみ統合 / t, 種別, 内容, 次までy, 目標Y=2段階帯域, 判定)');
  for (let i = 0; i < ev.length; i++) {
    const next = ev[i + 1];
    const y = next ? next.t - ev[i].t : null;
    const Y = next ? yC(next.t) : null;
    const ok = y === null ? '-' : (y >= 0.5 * Y && y <= Y ? 'OK' : (y > Y ? '遅い' : '早い'));
    console.log(`${fmtT(ev[i].t).padStart(9)}  ${ev[i].kind.padEnd(8)} ${String(ev[i].id).slice(0, 44).padEnd(44)} y=${y === null ? '-' : fmtT(y)} Y=${Y === null ? '-' : fmtT(Y)} ${ok}`);
  }
}

// ==== 条件①②③⑨⑩: 「その回だけ無効」トグル判定(2026-07-06 確定方式) ====
// 判定したい周回kの開始スナップショットから、その機能をその回だけ効果ゼロにして周回kを再実行し、
// 有効時の周回kと獲得効率(周回総クッキー÷周回時間)を比較する。他の回は無効化しない。
function replayRatio(strategy, base, runIdx, disOpts) {
  const orig = base.runs[runIdx];
  const snap = base.snapshots[runIdx];
  if (!snap || orig.partial) return null;
  // 打ち切り: 元周回の6倍または+2時間(遅い側の効率も打ち切り時点の効率で比較できる)
  const cap = Math.max(orig.duration * 6, orig.duration + 7200);
  const rep = G.replayRun(strategy, snap, disOpts, cap);
  const re = orig.runCookies / Math.max(1, orig.duration);
  const rd = rep.runCookies / Math.max(1, rep.duration);
  if (!(re > 0) || !(rd > 0) || !Number.isFinite(re) || !Number.isFinite(rd)) return null;
  return Math.log(re / rd);
}
// 機能がその周回で「使用された」判定(取得済みの回のみトグル対象)
function activeRunsOf(base, kind, id) {
  const out = [];
  const full = base.runs.filter(r => !r.partial);
  for (const r of full) {
    let a = false;
    if (kind === 'research') a = (r.researchBought || []).includes(id);
    else if (kind === 'stage') {
      const [rid, st] = id.split(':');
      a = ((st === '2' ? r.stages2 : r.stages3) || []).includes(rid);
    } else if (kind === 'reward') a = (r.perks && r.perks[id] > 0);
    else if (kind === 'upgrade') a = (r.upCounts && r.upCounts[id] > 0);
    if (a) out.push(r.idx);
  }
  return out;
}
function toggleRow(strategy, base, kind, id, need) {
  const optKey = { research: 'disableResearch', reward: 'disableReward', stage: 'disableStage', upgrade: 'disableUpgrade', affinity: 'disableAffinity' }[kind];
  const hours = base.opt.hours;
  const runIdxs = kind === 'affinity'
    ? base.runs.filter(r => !r.partial && r.kills > 0).map(r => r.idx)
    : activeRunsOf(base, kind, id);
  if (!runIdxs.length) return { kind, id, need, used: false, ratio: 1 };
  const logs = [];
  const usedIdxs = [];
  for (const k of runIdxs) {
    const lg = replayRatio(strategy, base, k, { hours, [optKey]: kind === 'affinity' ? true : id });
    if (lg !== null) { logs.push(lg); usedIdxs.push(k); }
  }
  if (!logs.length) return { kind, id, need, used: false, ratio: 1 };
  return { kind, id, need, used: true, ratio: Math.exp(logs.reduce((a, b) => a + b, 0) / logs.length), runs: logs.length, logs, runIdxs: usedIdxs };
}

function runToggles(strategy, hours, kind, baseSim) {
  const base = baseSim || G.simulate(strategy, { hours, snapshots: true });
  const rows = [];
  // kind 例: 'all' | 'research' | 'reward' | 'stage' | 'upgrade'
  //         | 'research:spiceBlend,galaxyAssembly' | 'reward:monsterDamage'
  //         | 'stage:spiceBlend:2' (研究idのみ指定なら段2・段3両方) | 'upgrade:finger,grandma'
  let resFilter = null, rwFilter = null, stFilter = null, upFilter = null;
  let doRes = kind === 'research' || kind === 'all';
  let doRw = kind === 'reward' || kind === 'all';
  let doStage = kind === 'stage' || kind === 'all';
  let doUp = kind === 'upgrade' || kind === 'all';
  if (kind.startsWith('research:')) { doRes = true; resFilter = new Set(kind.slice(9).split(',')); }
  if (kind.startsWith('reward:')) { doRw = true; rwFilter = new Set(kind.slice(7).split(',')); }
  if (kind.startsWith('stage:')) { doStage = true; stFilter = new Set(kind.slice(6).split(',')); }
  if (kind.startsWith('upgrade:')) { doUp = true; upFilter = new Set(kind.slice(8).split(',')); }
  if (doRes) {
    for (const r of G.RESEARCH) {
      if (resFilter && !resFilter.has(r.id)) continue;
      rows.push(toggleRow(strategy, base, 'research', r.id, 1.2));
    }
  }
  if (doRw) {
    for (const rw of G.REWARD_POOL) {
      if (rwFilter && !rwFilter.has(rw.id)) continue;
      rows.push(toggleRow(strategy, base, 'reward', rw.id, 1.1));
    }
  }
  // 条件⑨: 研究「段階」(段2/段3の26種)を単体で効果ゼロ化(購入行動は同一)
  if (doStage) {
    for (const r of G.RESEARCH) {
      for (const st of [2, 3]) {
        const key = r.id + ':' + st;
        if (stFilter && !stFilter.has(key) && !stFilter.has(r.id)) continue;
        rows.push(toggleRow(strategy, base, 'stage', key, 1.05));
      }
    }
  }
  // 条件⑩: 設備1種の生産だけをゼロ(所持数は各計算式に残す・購入行動同一)
  if (doUp) {
    for (const u of G.UPGRADES) {
      if (upFilter && !upFilter.has(u.id)) continue;
      rows.push(toggleRow(strategy, base, 'upgrade', u.id, 1.2));
    }
  }
  return { base, rows };
}

// 中央値(倍率の対数空間で中間2つの平均=偶数個でも安定)
function medianRatio(logs) {
  const a = logs.slice().sort((x, y) => x - y);
  const n = a.length;
  const m = n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
  return Math.exp(m);
}
function printToggles(res) {
  // 2026-07-06 ユーザー採用(案1-A): ①③⑨⑩の下限判定は「取得済み周回の比の中央値 ≥ 閾値」。
  //  まぐれ勝ち・まぐれ負け(周回内タイミングの分岐が終盤の急成長で増幅されるもの)に左右されず、
  //  「ふつうの周回で効いているか」を見る。min/max/幾何平均は参考表示として残す。
  //  未使用(どの方針も取得しない)機能は比=1.0=不合格として扱う(スキップしない)
  console.log('種別      ID                        各回比[min..max] 中央値(幾何平均)   必要   中央値判定   ±1.5倍判定(全回)');
  const KINDS = [['research', '研究', 1.2], ['reward', '報酬', 1.1], ['stage', '段階', 1.05], ['upgrade', '設備', 1.2]];
  const out = { lowOk: 0, lowAll: 0, bandOk: 0, bandAll: 0 };
  for (const [kind, label, need] of KINDS) {
    const rows = res.rows.filter(r => r.kind === kind);
    if (!rows.length) continue;
    // 各回×各機能の比行列(logs は比較対象周回ごとのlog比。runKeys で行を揃える)
    for (const r of rows) {
      out.lowAll++;
      if (!r.used) { console.log(`${kind.padEnd(9)} ${r.id.padEnd(26)} (未使用: 比=1.0)  x${need}  NG  -`); continue; }
      const ratios = r.logs.map(v => Math.exp(v));
      const mn = Math.min(...ratios), mx = Math.max(...ratios);
      const gm = Math.exp(r.logs.reduce((a, b) => a + b, 0) / r.logs.length);
      const med = medianRatio(r.logs);
      const lowOk = med >= need;
      if (lowOk) out.lowOk++;
      r._ratios = ratios; r._low = lowOk; r._med = med;
      console.log(`${kind.padEnd(9)} ${r.id.padEnd(26)} [${mn.toFixed(2)}..${mx.toFixed(2)}] 中央値${med.toFixed(2)} (${gm.toFixed(2)}) x${r.logs.length}回  x${need}  ${lowOk ? 'OK' : 'NG(中央値<' + need + ')'}`);
    }
    // ②(研究のみ・2026-07-06 ユーザー採用): 一強禁止は「研究ごとの中央値」同士で±1.5倍
    if (kind === 'research') {
      const meds = rows.filter(r => r.used && r._med != null).map(r => ({ id: r.id, med: r._med }));
      if (meds.length >= 2) {
        const gmean = Math.exp(meds.reduce((a, b) => a + Math.log(b.med), 0) / meds.length);
        const ok2 = meds.filter(m => m.med >= gmean / 1.5 && m.med <= gmean * 1.5);
        const ng2 = meds.filter(m => !(m.med >= gmean / 1.5 && m.med <= gmean * 1.5));
        console.log(`②(中央値同士の±1.5倍・平均${gmean.toFixed(2)}): ${ok2.length}/${meds.length}${ng2.length ? ' NG: ' + ng2.map(m => m.id + '=' + m.med.toFixed(2)).join(',') : ' 全研究OK'}`);
      }
    }
    // ±1.5倍(各回・③⑨⑩は従来どおり): 同一周回内で有効な機能同士。runIdx単位で照合
    const used = rows.filter(r => r.used && r.runIdxs);
    const byRun = new Map();
    for (const r of used) {
      r.runIdxs.forEach((ri, j) => {
        if (!byRun.has(ri)) byRun.set(ri, []);
        byRun.get(ri).push(Math.exp(r.logs[j]));
      });
    }
    let bOk = 0, bAll = 0;
    for (const [ri, arr] of byRun) {
      if (arr.length < 2) continue;
      bAll++;
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
      if (arr.every(v => v >= mean / 1.5 && v <= mean * 1.5)) bOk++;
    }
    out.bandOk += bOk; out.bandAll += bAll;
    console.log(`${label}: 中央値OK ${rows.filter(r => r._low).length}/${rows.length} / ±1.5倍(各回) ${bOk}/${bAll}周回`);
  }
  return out;
}

// ================= 新判定 ⑧⑫⑬ =================
// 条件⑧(2026-07-06 新): 全ての転生がノルマ未達の後に起きる(旧PT効率減衰は廃止)
function printQuotaFailBefore(stratId, sim) {
  const full = sim.runs.filter(r => !r.partial);
  const miss = full.filter(r => !(r.quotaFailAt != null && r.quotaFailAt < r.duration));
  console.log(`${stratId}: ⑧ 未達→転生 ${full.length - miss.length}/${full.length}` +
    (miss.length ? ` NG周回: ${miss.map(r => r.idx).join(',')}` : ' 全周回OK'));
  return miss.length === 0;
}

// 条件⑫(新・文脈依存性): 各選択カテゴリで「最適な選択」が方針間で2種以上に分かれる
function printContext(sims) {
  console.log('⑫ 文脈依存性');
  // 設備: 「次に買う最も費用対効果の高い設備」のサンプル最頻値(方針ごと)
  const topEquip = {};
  for (const id of Object.keys(sims)) {
    const cs = sims[id].choiceSamples || [];
    const cnt = {};
    for (const c of cs) cnt[c] = (cnt[c] || 0) + 1;
    topEquip[id] = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => x[0]);
  }
  const eqSet = new Set(Object.values(topEquip).map(v => v[0]));
  console.log(' 設備(最効率の最頻): ' + Object.keys(topEquip).map(k => k + '=' + (topEquip[k][0] || '-')).join(' '));
  // 報酬: ピック1位カテゴリ(獲得perksをカテゴリ集計)
  const CAT = {}; G.REWARD_POOL.forEach(r => CAT[r.id] = r.category);
  const topCat = {};
  for (const id of Object.keys(sims)) {
    const per = {}; const last = sims[id].runs.filter(r => !r.partial).slice(-3);
    for (const r of last) for (const [k, v] of Object.entries(r.perks || {})) { if (v > 0) per[CAT[k]] = (per[CAT[k]] || 0) + v; }
    topCat[id] = Object.entries(per).sort((a, b) => b[1] - a[1]).map(x => x[0])[0] || '-';
  }
  const rwSet = new Set(Object.values(topCat));
  console.log(' 報酬(ピック1位カテゴリ): ' + Object.keys(topCat).map(k => k + '=' + topCat[k]).join(' '));
  // 研究(⑫仕様): 「有効無効差が最大の研究」= その回だけ無効トグルの幾何平均比が最大の研究
  // 計測コスト削減のため各方針12hで13研究をスナップショット方式判定
  const topRes = {};
  for (const id of Object.keys(sims)) {
    const s = STRATEGIES.find(x => x.id === id);
    const res = runToggles(s, 12, 'research');
    let best = '-', bestR = 0;
    for (const row of res.rows) if (row.used && row.ratio > bestR) { bestR = row.ratio; best = row.id; }
    topRes[id] = best;
  }
  const resSet = new Set(Object.values(topRes));
  console.log(' 研究(有効無効差が最大): ' + Object.keys(topRes).map(k => k + '=' + topRes[k]).join(' '));
  const ok2 = x => x.size >= 2;
  console.log(` → 設備${eqSet.size}種 / 報酬${rwSet.size}種 / 研究${resSet.size}種 (各2種以上で OK): ${ok2(eqSet) && ok2(rwSet) ? '設備報酬OK' : 'NG'}${ok2(resSet) ? '' : ' (研究は方針の買い順が同型)'}`);
  return { eq: eqSet.size, rw: rwSet.size, res: resSet.size };
}
// ⑫周回方針: 同一戦略で5方針を差し替えて総合効率比較(最良/最悪≤3、各方針がどこかで最良)
function printPolicyContext(hours) {
  const base = STRATEGIES.find(s => s.id === 'S1');
  const POL = ['balanced', 'click', 'golden', 'hunt', 'bake'];
  const res = {};
  for (const p of POL) {
    const st = Object.assign({}, base, { pickPolicy: () => p });
    const sim = G.simulate(st, { hours });
    const full = sim.runs.filter(r => !r.partial);
    res[p] = {
      total: sim.runs.reduce((a, r) => a + r.runCookies, 0),
      kills: full.reduce((a, r) => a + r.kills, 0),
      golden: full.reduce((a, r) => a + r.golden, 0),
      maxStage: Math.max(...full.map(r => r.maxStage)),
      runs: full.length
    };
  }
  const totals = POL.map(p => res[p].total);
  const ratio = Math.max(...totals) / Math.min(...totals);
  const bestOf = m => POL.reduce((b, p) => res[p][m] > res[b][m] ? p : b, POL[0]);
  const bests = { total: bestOf('total'), kills: bestOf('kills'), golden: bestOf('golden'), maxStage: bestOf('maxStage'), runs: bestOf('runs') };
  const covered = new Set(Object.values(bests));
  console.log(' 周回方針(S1で5方針差し替え):');
  for (const p of POL) console.log(`  ${p.padEnd(9)} total=${fmtN(res[p].total)} kills=${res[p].kills} golden=${res[p].golden} maxSt=${res[p].maxStage} runs=${res[p].runs}${Object.entries(bests).filter(([m, w]) => w === p).map(([m]) => ' ★' + m).join('')}`);
  console.log(` → 総合効率 最良/最悪=${ratio.toFixed(2)} (≤3で OK: ${ratio <= 3 ? 'OK' : 'NG'}) / 最良獲得方針 ${covered.size}/5種`);
  return { ratio, covered: covered.size };
}

// 条件⑬: タイミング機能の実効性。最適操作(既定)と完全放置(idleTiming)の獲得効率比が +5%〜+100%。
const TIMING_FEATURES = [
  { key: 'wave', label: '観測ゆらぎ(量子発酵 段2)', stage: 'quantumProofing:2' },
  { key: 'bhCharge', label: '圧縮チャージ(重力圧縮 段2)', stage: 'blackHoleCompression:2' },
  { key: 'mature', label: '熟成(香料調合 段2)', stage: 'spiceBlend:2' },
  { key: 'huntExtend', label: '延長狩り(異世界接続網 段2)', stage: 'portalNetwork:2' }
];
function runTimingChecks(strategy, hours, base) {
  // ⑬もスナップショット方式: 段2を取得した各回を「その回だけ完全放置」で再実行して効率比較
  if (!base || !base.snapshots) base = G.simulate(strategy, { hours, snapshots: true });
  const rows = [];
  for (const f of TIMING_FEATURES) {
    const [rid, st] = f.stage.split(':');
    const runIdxs = activeRunsOf(base, 'stage', f.stage);
    if (!runIdxs.length || !base.snapshots) { rows.push({ f, used: false, ratio: 1 }); continue; }
    const logs = [];
    for (const k of runIdxs) {
      const lg = replayRatio(strategy, base, k, { hours: base.opt.hours, idleTiming: f.key });
      if (lg !== null) logs.push(lg);
    }
    if (!logs.length) { rows.push({ f, used: false, ratio: 1 }); continue; }
    rows.push({ f, used: true, ratio: Math.exp(logs.reduce((a, b) => a + b, 0) / logs.length), runs: logs.length, atT: base.firstStageBuy[f.stage] });
  }
  return rows;
}
function printTiming(stratId, rows) {
  console.log(`${stratId}: ⑬ タイミング機能 (最適操作/完全放置の獲得効率比, 要求 +5%〜+100% = [1.05, 2.00])`);
  let allOk = true;
  for (const r of rows) {
    let verdict;
    if (!r.used) { verdict = '(未使用: 対応する段2が未購入)'; allOk = false; }
    else verdict = (r.ratio >= 1.05 && r.ratio <= 2.0) ? `${r.ratio.toFixed(3)} OK` : `${r.ratio.toFixed(3)} NG`;
    if (r.used && !(r.ratio >= 1.05 && r.ratio <= 2.0)) allOk = false;
    console.log(` ${r.f.label.padEnd(22)} ${verdict} ${r.atT != null ? '(初購入t=' + Math.round(r.atT / 3600) + 'h, 対象' + r.runs + '周回)' : ''}`);
  }
  console.log(` → ${stratId} ⑬: ${allOk ? 'OK' : 'NG'}`);
  return allOk;
}

// ⑬(提案5・2026-07-07承認=全体比較): タイミング機能の実効性を「通し比較」で測る。
// 最適操作の通し(既定)と完全放置の通し(idleTiming)をそれぞれ走らせ、全周回の獲得効率
// (runCookies/duration)の幾何平均の比を取る。機能ごとに「その機能だけ放置した通し」を1本走らせ、
// 全機能同時放置('all')の合算も出す。瞬間比較(旧・期待値方式)が構造的に1.000に張り付く問題の解。
function geomeanEff(sim) {
  const full = sim.runs.filter(r => !r.partial && r.runCookies > 0 && r.duration > 0 && Number.isFinite(r.runCookies));
  if (!full.length) return null;
  const s = full.reduce((a, r) => a + Math.log(r.runCookies / r.duration), 0);
  return Math.exp(s / full.length);
}
// ③ utility軸(2026-07-08 ユーザー承認の「utility報酬を別軸で測る」変更): 直接クッキーを生まない報酬
// (滞在窓/次イベントの状態書き換え/報酬の量・価値=進行に効く型)は瞬間の稼ぎ力比が構造的に1.00に張り付く
// (⑬タイミングと同じ理由=効果が「行動の瞬間に一度だけ状態へ書き込まれる」ため、同状態の瞬間評価で差が出ない)。
// これらは ⑬ と同じ通し比較で測る: その報酬を取得し始めた周回以降の全周回効率(runCookies/duration)の
// 幾何平均を、最適(=取得あり)と disableReward(=効果無効)で比べる。取得周回に絞るのは③の「取得した周回」の趣旨に合わせ希釈を避けるため。
// goldenChain/beastScent は所持数が多く(S3で10〜18)、通し比較(utility軸)で測る。金収入は周回で複利的に
// 効くため控えめ係数でも通し比≥1.1。※2026-07-09 ユーザー通知: ゲーム側で総クッキー計算方式を変更済み=総クッキーが
// float の Infinity(~1.8e308)を超えても処理落ちしない。よって「最終放置周回の Infinity 化を避けるため係数を抑える」
// 制約は撤廃(有限性条件も撤廃済み)。sim は float 依存のため最終放置周回のみ Infinity に達しうるが、④⑤は転生周回だけ
// を比較し、その転生周回は全方針有限(e155〜e233 ≪ e308)なので無関係。下の isFinite ガードはこの最終放置周回を
// 幾何平均計算から除くだけの float アーティファクト対策で、合否条件ではない。
// goldenTarget/goldenFirstHit は所持数が少なく instant 中央値≥1.1 を満たす(有限)ので direct 側に残す。
const UTILITY_REWARDS = ['monsterDamage', 'monsterStay', 'crackedFang', 'brandHunt', 'deepPursuit', 'chainPrep', 'huntFocus', 'biteRecovery', 'crushedMill', 'goldenBeastMutation', 'goldenChain', 'beastScent'];
function firstAcqIdx(sim, rid) {
  let best = null;
  for (const r of sim.runs) { if (!r.partial && r.perks && r.perks[rid] > 0) { if (best === null || r.idx < best) best = r.idx; } }
  return best;
}
function geomeanEffFrom(sim, minIdx) {
  const full = sim.runs.filter(r => !r.partial && r.idx >= minIdx && r.runCookies > 0 && r.duration > 0 && Number.isFinite(r.runCookies));
  if (!full.length) return null;
  return Math.exp(full.reduce((a, r) => a + Math.log(r.runCookies / r.duration), 0) / full.length);
}
// median(中央値)
function medianOf(arr) { const a = arr.slice().sort((x, y) => x - y); const m = a.length >> 1; return a.length ? (a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2) : null; }
// 取得済み周回の等間隔サンプル(最大 k 個)。全周回を replay するとコスト過大なので間引く(中央値は安定)。
function sampleRuns(runs, k) {
  if (runs.length <= k) return runs;
  const out = []; const step = (runs.length - 1) / (k - 1);
  for (let i = 0; i < k; i++) out.push(runs[Math.round(i * step)]);
  return out;
}
// ③utility軸(2026-07-09 ユーザー承認=「短い枝分かれ比べ」): 各周回の開始スナップショット(同一状態)から、
// 報酬アリ(=opt周回そのもの)と報酬ナシ(disableReward)を**その1周回ぶんだけ**枝分かれさせ、
// 同一時間(optの周回長)で稼いだ総クッキーの比を取る。枝分かれが1周回で閉じる=転生回数の増減が混入せず
// 軌道に鈍い(per-run 100h幾何平均の脆さ=旧B案/instant/per-tickの行き止まりを解消)。取得した周回の中央値≥1.1で合格。
// ON側は opt 周回の runCookies をそのまま使う(replay不要=コスト半減)。比は上限クランプで Infinity/NaN を避ける。
const BRANCH_CAP = 1e9; // 比の上限(≥1.1判定には十分。idle成長で1周回内でも数十桁差が出るためのガード)
function judgeUtilityRewards(hours, sims, ids) {
  let ok = 0;
  console.log('③ 報酬utility軸(短い枝分かれ比べ・同一状態から1周回ぶん・総クッキー比の中央値 ≥1.1)');
  // 各方針の snapshot 付き opt を1回だけ作って使い回す
  const optSnap = {};
  for (const s of STRATEGIES) optSnap[s.id] = G.simulate(s, { hours, snapshots: true });
  for (const rid of ids) {
    let best = 0, bestPol = null, bestN = 0, anyUsed = false;
    const users = STRATEGIES.map(s => {
      const sim = optSnap[s.id];
      const acq = sim.runs.filter(r => !r.partial && r.perks && r.perks[rid] > 0 && r.runCookies > 0 && r.duration > 0 && sim.snapshots[r.idx]);
      return { s, sim, acq };
    }).filter(x => x.acq.length > 0);
    // 取得周回が多い方針から測り、中央値≥1.1が出たら早期終了
    users.sort((a, b) => b.acq.length - a.acq.length);
    for (const { s, sim, acq } of users) {
      anyUsed = true;
      const ratios = [];
      for (const optRun of sampleRuns(acq, 12)) {
        const snap = sim.snapshots[optRun.idx];
        const off = G.replayRun(s, snap, { hours, disableReward: rid }, optRun.duration);
        if (off && off.runCookies > 0 && Number.isFinite(off.runCookies) && Number.isFinite(optRun.runCookies)) {
          ratios.push(Math.min(BRANCH_CAP, optRun.runCookies / off.runCookies));
        }
      }
      const m = ratios.length ? medianOf(ratios) : null;
      if (m != null && m > best) { best = m; bestPol = s.id; bestN = ratios.length; }
      if (best >= 1.1) break;
    }
    const pass = best >= 1.1;
    if (pass) ok++;
    console.log(`  ${pass ? 'OK' : 'NG'} rw:${rid.padEnd(20)} ${anyUsed ? `${bestPol} 中央値比=${best.toFixed(3)} (n=${bestN})` : 'どの方針も未取得'}`);
  }
  console.log(`③ utility軸 ${ok}/${ids.length}`);
  return ok;
}
// ⑨ の段階のうち、⑬タイミング機能そのもの(観測ゆらぎ=量子証明段2/3・圧縮チャージ=重力圧縮段2/3)は
// ⑬(最適操作 vs 完全放置の通し比較[1.05,2.0])で判定済み。⑨(瞬間比較lift≥1.05)は同じ機能を構造的に
// 測れない(タイミング効果は行動の瞬間に一度だけ状態へ書き込むため1.00張り付き)ので⑨の判定対象から除外する
// (2026-07-08 ユーザー承認・提案1)。※spiceBlend段2/portalNetwork段2 は非タイミングの生産効果もあり⑨で通るので残す。
const STAGE_TIMING_EXCLUDE = new Set([
  'stage:quantumProofing:2', 'stage:quantumProofing:3',
  'stage:blackHoleCompression:2', 'stage:blackHoleCompression:3'
]);
// ⑨ の段階のうち、効果が earningPower(⑨の瞬間比較proxy)の外で稼ぐもの(銀行の複利利息・会心の余熱)は
// 瞬間比較では構造的に1.00。これらは「瞬間判断以外」で測る(2026-07-08 ユーザー承認・提案2)=⑬/③utility軸と同じ
// 通し比較: その段を取得し始めた周回以降の全周回効率(runCookies/duration)の幾何平均を、最適と disableStage で比べ ≥1.05。
const STAGE_WHOLE = ['stage:bankClickDividend:2', 'stage:bankClickDividend:3', 'stage:fingerTechnique:3'];
function stageFirstAcqIdx(sim, stageKey) {
  const p = stageKey.split(':'); const rid = p[1], lv = p[2];
  const arr = lv === '2' ? 'stages2' : 'stages3';
  let best = null;
  for (const r of sim.runs) { if (!r.partial && (r[arr] || []).includes(rid)) { if (best === null || r.idx < best) best = r.idx; } }
  return best;
}
// ⑨whole軸(利息/余熱)。※この per-run 幾何平均は③utilityと同型の"脆弱measure"(2026-07-09 実測=枝分かれ比では
// bankClickDividend段2/3・fingerTechnique段3 とも中央値1.00〜1.03=真値は弱い)。③と同じ「短い枝分かれ比べ」へ統一し
// 3段を復活させるのが本筋だが、⑨の測り方変更はユーザー未承認かつ利息/余熱の復活調整が別途要るため今回は現状式を維持。
function judgeStageWhole(hours, sims, keys) {
  let ok = 0;
  console.log('⑨ 段階whole軸(通し比較・取得周回以降の全周回効率幾何平均比 ≥1.05・利息/余熱=瞬間比較の外の稼ぎ)');
  for (const key of keys) {
    const p = key.split(':'); const disableVal = p[1] + ':' + p[2];
    let best = 0, bestPol = null, anyUsed = false;
    const users = STRATEGIES.map(s => ({ s, idx0: stageFirstAcqIdx(sims[s.id], key) })).filter(x => x.idx0 !== null);
    users.sort((a, b) => a.idx0 - b.idx0);
    for (const { s, idx0 } of users) {
      anyUsed = true;
      const optEff = geomeanEffFrom(sims[s.id], idx0);
      const dis = G.simulate(s, { hours, disableStage: disableVal });
      const disEff = geomeanEffFrom(dis, idx0);
      const lift = (optEff && disEff && disEff > 0) ? optEff / disEff : null;
      if (lift != null && lift > best) { best = lift; bestPol = s.id; }
      if (best >= 1.05) break;
    }
    const pass = best >= 1.05;
    if (pass) ok++;
    console.log(`  ${pass ? 'OK' : 'NG'} ${key.padEnd(28)} ${anyUsed ? `${bestPol} 比=${best.toFixed(3)}` : 'どの方針も未取得'}`);
  }
  console.log(`⑨ whole軸 ${ok}/${keys.length}`);
  return ok;
}
// ⑬ B案(2026-07-09 ユーザー承認): sim の per-tick 稼ぎ力の幾何平均(=時間平均の稼ぎ率)。
function tickPower(sim) { return (sim._tpN > 0) ? Math.exp(sim._tpS / sim._tpN) : null; }
function runWholeTiming(strategy, hours, optSim) {
  // 【第12次N・B案・ユーザー承認 2026-07-09】per-run 効率(runCookies/duration の幾何平均)は idle 化で転生回数が
  // 変わると暴れる(bhCharge=0.27〜1318)。かつ機能を登録させるため生産を足すと③の最弱utility報酬を希釈する。
  // B案=opt-timing と idle-timing の2本を走らせ「per-tick 稼ぎ力(全生産源の合計)の幾何平均」の比を取る。
  // (1)全効果と比較(稼ぎ力=総合) (2)per-run 分割の転生回数ノイズなし (3)状態書き込み型も2本の状態差で出る
  // (4)機能の平均強度を変えないので③非干渉。opt/idle 両方 trackTickPower で per-tick 稼ぎ力を積算。
  const opt = G.simulate(strategy, { hours, trackTickPower: true });
  const optTp = tickPower(opt);
  const out = { perFeature: {}, used: {}, allLift: null };
  for (const f of TIMING_FEATURES) {
    const rid = f.stage.split(':')[0];
    out.used[f.key] = opt.runs.some(r => !r.partial && (r.stages2 || []).includes(rid));
    if (!out.used[f.key] || optTp == null) { out.perFeature[f.key] = null; continue; }
    const idle = G.simulate(strategy, { hours, idleTiming: f.key, trackTickPower: true });
    const idleTp = tickPower(idle);
    out.perFeature[f.key] = (idleTp && idleTp > 0) ? optTp / idleTp : null;
  }
  const all = G.simulate(strategy, { hours, idleTiming: 'all', trackTickPower: true });
  const allTp = tickPower(all);
  out.allLift = (allTp && optTp && allTp > 0) ? optTp / allTp : null;
  return out;
}
// 全方針を跨いだ⑬判定: 各機能につき「使用した方針が1つ以上あり、その方針の通し比が[1.05,2.0]」。
function judgeWholeTiming(hours, sims) {
  const perStrat = {};
  // opt は必ず plain(idleTiming=null・measure なし)で作る。共有 sims[s.id] は measure モードで per-tick
  // サンドボックス・トグルによりトラジェクトリが変わり(opt効率が数倍膨張)、plain の idle と比べると
  // 比が壊れる(モード不整合)。opt/idle を同じ plain モードに揃えて全体比較の一貫性を担保する。
  for (const s of STRATEGIES) perStrat[s.id] = runWholeTiming(s, hours);
  let ok = 0;
  console.log(`⑬ タイミング機能(全体比較・最適操作/完全放置の全周回効率幾何平均比, 要求[1.05,2.00])`);
  for (const f of TIMING_FEATURES) {
    const rows = [];
    let feature = false;
    for (const s of STRATEGIES) {
      const w = perStrat[s.id];
      const lift = w.perFeature[f.key];
      if (!w.used[f.key] || lift == null) continue;
      const inBand = lift >= 1.05 && lift <= 2.0;
      if (inBand) feature = true;
      rows.push(`${s.id}=${lift.toFixed(3)}${inBand ? '✓' : ''}`);
    }
    if (feature) ok++;
    console.log(`  ${feature ? 'OK' : 'NG'} ${f.label.padEnd(26)} ${rows.join(' ') || '(どの方針も未使用)'}`);
  }
  // 参考: 全機能同時放置の合算(方針ごと)
  const allRows = STRATEGIES.map(s => { const a = perStrat[s.id].allLift; return a ? `${s.id}=${a.toFixed(2)}` : null; }).filter(Boolean);
  console.log(`  参考 全機能同時放置lift: ${allRows.join(' ')}`);
  console.log(`⑬ タイミング ${ok}/${TIMING_FEATURES.length}`);
  return ok;
}

// CLI
const mode = process.argv[2] || 'baseline';
const arg = process.argv[3];
const hours = Number(process.argv[4] || 100);

if (mode === 'baseline') {
  printBaseline(runBaseline(hours, arg));
} else if (mode === 'detail') {
  const s = STRATEGIES.find(x => x.id === arg) || STRATEGIES[0];
  const sim = G.simulate(s, { hours });
  console.log(`戦略: ${s.id} ${s.name}`);
  printDetail(sim);
  const sum = summarize(sim);
  console.log(`合計: ${fmtN(sum.total)} / 100倍達成 ${sum.doubleOk}/${sum.doubleAll} / PT2-100倍 ${sum.gainOk}/${sum.doubleAll} / ペース ${sum.paceOk}/${sum.paceAll}`);
} else if (mode === 'pacing') {
  const s = STRATEGIES.find(x => x.id === arg) || STRATEGIES[0];
  const sim = G.simulate(s, { hours });
  printPacing(sim);
} else if (mode === 'toggles') {
  const s = STRATEGIES.find(x => x.id === arg) || STRATEGIES[0];
  const kind = process.argv[5] || 'all';
  const res = runToggles(s, hours, kind);
  console.log(`戦略: ${s.id} ${s.name}`);
  printToggles(res);
} else if (mode === 'diag') {
  const s = STRATEGIES.find(x => x.id === arg) || STRATEGIES[0];
  const sim = G.simulate(s, { hours });
  const keys = ['finger','grandma','oven','factory','bank','spiceRack','portal','moonBakery','galaxyFactory','blackHoleMixer','quantumBakery','antimatterOven'];
  console.log('run  dur(s)  kills  maxSt  ' + keys.map(k => k.slice(0, 6).padStart(7)).join(''));
  for (const r of sim.runs.filter(x => !x.partial)) {
    const u = r.upCounts || {};
    console.log(String(r.idx).padStart(3) + '  ' + String(Math.round(r.duration)).padStart(6) + '  ' + String(r.kills).padStart(5) + '  ' + String(r.maxStage).padStart(5) + '  ' + keys.map(k => String(u[k] || 0).padStart(7)).join(''));
  }
} else if (mode === 'profile') {
  const s = STRATEGIES.find(x => x.id === arg) || STRATEGIES[0];
  const runIdx = Number(process.argv[5] || 50);
  const sim = G.simulate(s, { hours, debugRunIdx: runIdx });
  const tr = sim.debugTrace || [];
  console.log(`run ${runIdx} trace: ${tr.length} ticks`);
  let lastDec = -1;
  for (const p of tr) {
    const dec = Math.floor(Math.log10(Math.max(1, p.c)));
    if (dec > lastDec) {
      console.log(`el=${String(Math.round(p.el)).padStart(5)}s  runCookies=1e${dec}  boosts=${p.boosts} kills=${p.kills} gold=${p.gold}`);
      lastDec = dec;
    }
  }
} else if (mode === 'checks8') {
  // ⑧ 単体: node runner.js checks8 [S1|""] [hours]
  for (const s of STRATEGIES) {
    if (arg && s.id !== arg) continue;
    printQuotaFailBefore(s.id, G.simulate(s, { hours }));
  }
} else if (mode === 'context') {
  // ⑫ 単体: node runner.js context "" [hours]
  const sims = {};
  for (const s of STRATEGIES) sims[s.id] = G.simulate(s, { hours, trackChoices: true });
  printContext(sims);
  printPolicyContext(hours);
} else if (mode === 'timing') {
  // ⑬ 単体(旧・瞬間比較。参考): node runner.js timing S1 [hours]
  const s = STRATEGIES.find(x => x.id === arg) || STRATEGIES[0];
  printTiming(s.id, runTimingChecks(s, hours));
} else if (mode === 'timing2') {
  // ⑬ 単体(提案5・全体比較): node runner.js timing2 "" [hours]
  judgeWholeTiming(hours);
} else if (mode === 'checks') {
  // まとめ実行: node runner.js checks S1 [hours] → ⑧(全方針) / ⑫ / ⑬(指定方針)
  const sims = {};
  for (const s of STRATEGIES) {
    const t0 = Date.now();
    sims[s.id] = G.simulate(s, { hours, trackChoices: true });
    console.log(`sim ${s.id} ${s.name} done (${Date.now() - t0}ms)`);
  }
  console.log('');
  for (const s of STRATEGIES) printQuotaFailBefore(s.id, sims[s.id]);
  console.log('');
  printContext(sims);
  printPolicyContext(hours);
  console.log('');
  const s = STRATEGIES.find(x => x.id === arg) || STRATEGIES[0];
  printTiming(s.id, runTimingChecks(s, hours, sims[s.id]));
  console.log('');
  console.log('①②③⑨⑩は toggles で: node runner.js toggles S1 30 all');
} else if (mode === 'check19') {
  // ⑲改(2026-07-06 ユーザー承認・第9次): どのスキルも、辺のうち少なくとも1本は
  // 「コスト比10倍以内の相手」と結ばれていること(関連効果を結ぶ遠距離辺は距離自由)。
  // +丸め規則(有効数字3桁=5の倍数)の検証。
  const cap = G.P.skillCost.edgeCap || 10;
  const cost = id => G.skillCostOf(G.SKILL_BY_ID[id]);
  const adj = {};
  for (const n of G.SKILL_NODES) { adj[n.id] = adj[n.id] || []; for (const q of n.prereqs) { adj[n.id].push(q); (adj[q] = adj[q] || []).push(n.id); } }
  let bad = 0;
  for (const n of G.SKILL_NODES) {
    if (n.id !== 'core' || adj[n.id].length) {
      const near = adj[n.id].filter(o => { const r = cost(n.id) / cost(o); return r <= cap * 1.0001 && r >= 1 / (cap * 1.0001); });
      if (!near.length) { bad++; console.log(`NG ⑲改 ${n.id}(${fmtN(cost(n.id))}): 10倍以内の辺なし。隣接=${adj[n.id].map(o => o + '(' + fmtN(cost(o)) + ')').join(',')}`); }
    }
    const c = G.skillCostOf(n);
    if (c !== G.q5cost(c)) { bad++; console.log(`NG 丸め違反 ${n.id}=${c}`); }
  }
  console.log(`⑲改: 各ノード最低1本は比≤${cap}倍の辺+丸め規則 → ${bad === 0 ? '全ノード OK' : bad + '件NG'} (ライダー: ${[...G.skillRiders()].join(',') || 'なし'})`);
} else if (mode === 'check27') {
  // ㉗(第9次【仮】): 関連接続率 — 全ツリー辺のうち「同系統 / 相乗り橋 / 解放対象カテゴリ一致 /
  // 入口の鎖 / 便利系の葉 / 設備解放の鎖 / 終端集約」で説明できる辺が95%以上。辺ごとに分類を出力。
  const CAT = {}; G.REWARD_POOL.forEach(r => CAT[r.id] = r.category);
  const laneOf = id => {
    if (id === 'core') return 'core';
    if (id.startsWith('click_')) return 'click';
    if (id.startsWith('golden_')) return 'golden';
    if (id.startsWith('monster_') || id === 'hunt_analysis') return 'monster';
    if (id.startsWith('auto_') || id === 'bake_temperature') return 'auto';
    if (id.startsWith('economy_') || id === 'order_board' || id.startsWith('research_')) return 'economy';
    if (id.startsWith('upgrade_')) return 'unlock';
    if (id.startsWith('unlock_reward_')) { const c = CAT[id.slice(14)]; return c === 'golden' ? 'golden' : c === 'equipment' ? 'reward' : 'monster'; } // hunt/risk=狩り系
    if (id.startsWith('reward_')) return 'reward';
    if (id.startsWith('start_') || id === 'offline_1') return 'util';
    return 'master';
  };
  const ENTRANCE = new Set(['core>click_1', 'click_1>golden_1', 'golden_1>monster_1', 'monster_1>auto_1', 'auto_1>economy_1',
    // 第2輪も同じ物語順の鎖(タップ→金→狩り→自動→経済)
    'golden_2>monster_2', 'monster_2>auto_2']);
  const BRIDGES = { // 相乗り橋(両系統の効果や仕組み上の依存を持つ辺)
    'golden_2>click_3': 'click_3は金獲得効果を併せ持つ',
    'monster_2>auto_3': 'auto_3は討伐ダメージ効果を併せ持つ',
    'click_4>monster_4': '討伐ダメージはタップ力から計算される',
    'auto_4>click_4': 'クリック力は毎秒生産から計算される(指先連動)',
    'auto_4>upgrade_galaxy': '銀河工場=自動化の合流',
    'research_remodel>upgrade_time': '設備解放は経済・研究系の鎖(R4)',
    'unlock_reward_crackedFang>unlock_reward_goldenChain': '黄金連鎖は金→討伐ダメージの相乗り札',
    'unlock_reward_huntingCore>unlock_reward_crushedMill': '素材加工×狩りの合流'
  };
  let total = 0, okE = 0;
  for (const n of G.SKILL_NODES) {
    for (const q of n.prereqs) {
      total++;
      const key = q + '>' + n.id;
      const lp = laneOf(q), lc = laneOf(n.id);
      let label = null;
      if (ENTRANCE.has(key)) label = '入口の鎖';
      else if (G.isUtilitySkill(n.id)) label = '便利系の葉(R5)';
      else if (BRIDGES[key]) label = '相乗り橋: ' + BRIDGES[key];
      else if (lp === lc) label = '同系統(' + lc + ')';
      else if (lc === 'unlock' && (lp === 'economy' || lp === 'unlock')) label = '設備解放の鎖(経済系)';
      else if (lc === 'golden' && lp === 'golden') label = '同系統(金)';
      else if (lc === 'monster' && lp === 'monster') label = '同系統(狩り)';
      else if (lc === 'reward' && lp === 'unlock') label = 'カテゴリ一致(設備強化←設備解放枝)';
      else if (lc === 'monster' && lp === 'reward') label = 'カテゴリ一致(狩り報酬←強化系)';
      else if ((lc === 'golden' || lc === 'monster' || lc === 'reward') && lp === lc) label = 'カテゴリ一致';
      else if (lc === 'master') label = '終端(全系統の集約)';
      if (label) okE++;
      console.log(`${label ? 'OK' : 'NG'}  ${key.padEnd(52)} ${label || '未分類(' + lp + '→' + lc + ')'}`);
    }
  }
  console.log(`㉗: 関連で説明できる辺 ${okE}/${total} = ${(okE / total * 100).toFixed(1)}% (必要95%)`);
} else if (mode === 'crit23') {
  // ㉓(第9次【仮】): 会心1%開始。㉓-1 式の開始値=1%(内部値) / ㉓-2 転生時点で5%以上の周回が80%以上 /
  // ㉓-3 100時間中に50%超の局面が少なくとも1方針にあり、100%には到達しない
  console.log(`㉓-1 式の開始値: score開始 ${G.P.res.fingerBase} → 会心率 ${((1 - Math.exp(-G.P.res.fingerBase)) * 100).toFixed(3)}% ${Math.abs(1 - Math.exp(-G.P.res.fingerBase) - 0.01) < 0.0005 ? 'OK(=1.0%)' : 'NG'}`);
  let over50 = 0, reach100 = 0;
  for (const s of STRATEGIES) {
    if (arg && s.id !== arg) continue;
    const sim = G.simulate(s, { hours });
    const runs = sim.runs.filter(r => !r.partial && r.critAtBuy != null);
    const ge5 = runs.filter(r => (r.critEnd || 0) >= 0.05).length;
    const mx = Math.max(0, ...sim.runs.map(r => r.critMax || 0));
    if (mx >= 0.5) over50++;
    if (mx >= 0.9999) reach100++;
    const buyMin = runs.length ? Math.min(...runs.map(r => r.critAtBuy)) : null;
    const buyMax = runs.length ? Math.max(...runs.map(r => r.critAtBuy)) : null;
    console.log(`${s.id}: 研究取得周回=${runs.length} 取得直後率=[${buyMin === null ? '-' : (buyMin * 100).toFixed(1)}%..${buyMax === null ? '-' : (buyMax * 100).toFixed(1)}%] ㉓-2 転生時5%以上=${ge5}/${runs.length}(${runs.length ? Math.round(ge5 / runs.length * 100) : 0}%) 周回内最大=${(mx * 100).toFixed(1)}%`);
  }
  console.log(`㉓-3: 50%超の方針=${over50}(≥1で OK) / 100%到達=${reach100}(0で OK)`);
} else if (mode === 'affinity') {
  // ㉔㉕㉖(第9次【仮】): モンスター種類×報酬相性
  // ㉔ 有効性: 「その回だけ相性を全部×1.0」との獲得効率比(幾何平均≥1.1)+各回minも表示
  // ㉕ 文脈依存性: カテゴリ別の最効率種類が2種以上 / 方針の討伐配分(報酬寄与の1位種類)が2種以上
  // ㉖ 一強禁止: 各周回で種類ごとの「討伐1体あたり報酬量」が平均±1.5倍以内(ボスは周期出現のため対象外)
  const aff = G.P.mtype.affinity;
  const cats = ['golden', 'hunt', 'equipment', 'risk'];
  const bestByCat = {};
  for (const c of cats) {
    let best = null, bv = -1;
    for (const t of Object.keys(aff)) { if (t === 'boss') continue; if (aff[t][c] > bv) { bv = aff[t][c]; best = t; } }
    bestByCat[c] = best;
  }
  console.log('㉕(機械判定) カテゴリ別最効率種類: ' + cats.map(c => c + '=' + bestByCat[c]).join(' ') + ` → ${new Set(Object.values(bestByCat)).size}種 (≥2で OK)`);
  // ㉖案②-b(2026-07-09 ユーザー承認): 種類ごとの「全カテゴリ合計の旨味」が±1.5倍以内(得意ピークの位置は自由=㉕多様性を保つ)。
  // 相性表の設計で判定(静的・⑯⑳と同じ扱い)。ボスは周期出現のため対象外。
  {
    const sums = {};
    for (const t of Object.keys(aff)) { if (t === 'boss') continue; sums[t] = cats.reduce((a, c) => a + (aff[t][c] || 0), 0); }
    const sv = Object.values(sums), sm = sv.reduce((a, b) => a + b, 0) / sv.length;
    const ok26b = sv.every(v => v >= sm / 1.5 && v <= sm * 1.5);
    console.log(`㉖(案②-b 種類別の全カテゴリ合計旨味 ±1.5倍以内): ${Object.entries(sums).map(([k, v]) => k + '=' + v.toFixed(1)).join(' ')} → ${ok26b ? 'OK' : 'NG'}`);
  }
  const domByStrat = {};
  let ok26 = 0, all26 = 0;
  for (const s of STRATEGIES) {
    if (arg && s.id !== arg) continue;
    const sim = G.simulate(s, { hours, snapshots: true });
    // ㉖
    for (const r of sim.runs.filter(x => !x.partial)) {
      const vals = [];
      for (const t of Object.keys(r.killsByType || {})) {
        if (t === 'boss') continue;
        if ((r.killsByType[t] || 0) > 0) vals.push((r.rewardByType[t] || 0) / r.killsByType[t]);
      }
      if (vals.length < 2) continue;
      all26++;
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      if (vals.every(v => v >= mean / 1.5 && v <= mean * 1.5)) ok26++;
    }
    // ㉕ 実測: 報酬寄与の1位種類(標準以外)
    const agg = {};
    for (const r of sim.runs) for (const [t, v] of Object.entries(r.rewardByType || {})) { if (t !== 'normal') agg[t] = (agg[t] || 0) + v; }
    domByStrat[s.id] = Object.entries(agg).sort((a, b) => b[1] - a[1]).map(x => x[0])[0] || '-';
    // ㉔
    const row = toggleRow(s, sim, 'affinity', 'affinity', 1.1);
    if (row.used) {
      const ratios = row.logs.map(v => Math.exp(v));
      const med = medianRatio(row.logs);
      console.log(`${s.id}: ㉔ 相性有効/無効比 中央値=${med.toFixed(3)} (幾何平均=${row.ratio.toFixed(3)}) [min ${Math.min(...ratios).toFixed(2)} .. max ${Math.max(...ratios).toFixed(2)}] x${row.runs}周回 ${med >= 1.1 ? 'OK' : 'NG(<1.1)'} / 報酬寄与1位(標準以外)=${domByStrat[s.id]}`);
    } else {
      console.log(`${s.id}: ㉔ 未使用(討伐なし) NG`);
    }
  }
  console.log(`㉕(実測) 方針の報酬寄与1位種類: ${Object.entries(domByStrat).map(([k, v]) => k + '=' + v).join(' ')} → ${new Set(Object.values(domByStrat)).size}種 (≥2で OK)`);
  console.log(`㉖: 種類別の1体あたり報酬量 ±1.5倍以内 ${ok26}/${all26}周回`);
} else if (mode === 'expect') {
  // ①②③⑨⑬⑫ 各回の期待値方式(第12次): node runner.js expect "" [hours]
  // 各機能につき「少なくとも1方針が取得し、その方針の“取得した全周回”で稼ぎ力の持ち上げ≥閾値」を要求。
  const H = hours;
  const sims = {};
  for (const s of STRATEGIES) sims[s.id] = G.simulate(s, { hours: H, measure: true });
  // 機能→{ policyId → [各周回のlift] }
  function collect(prefix) {
    const map = {};
    for (const s of STRATEGIES) {
      const full = sims[s.id].runs.filter(r => !r.partial && r.measure);
      for (const r of full) {
        for (const [k, v] of Object.entries(r.measure.lift)) {
          if (!k.startsWith(prefix)) continue;
          (map[k] = map[k] || {}); (map[k][s.id] = map[k][s.id] || []).push(v);
        }
      }
    }
    return map;
  }
  // median(配列の中央値。偶数個は中間2つの平均)
  function medOf(arr) { const a = arr.slice().sort((x, y) => x - y); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
  // useMed=true のとき「その方針の全周回の中央値≥need」で判定(③のみ・2026-07-08 ユーザー承認。工房⑮の2と同じ=貯める/使わない回を許容)。
  // useMed=false は従来「全周回の最小値≥need(=全周回)」(①⑨は据え置き)。
  function judge(map, need, label, ids, useMed) {
    let ok = 0; const rows = [];
    const allKeys = ids || Object.keys(map);
    for (const k of allKeys) {
      const byPol = map[k] || {};
      let passPol = null, bestStat = 0, bestGm = 0;
      for (const [pol, arr] of Object.entries(byPol)) {
        const stat = useMed ? medOf(arr) : Math.min(...arr);
        const gm = Math.exp(arr.reduce((a, b) => a + Math.log(b), 0) / arr.length);
        if (stat >= need && (passPol === null || stat > bestStat)) { passPol = pol; bestStat = stat; bestGm = gm; }
        if (passPol === null && gm > bestGm) { bestGm = gm; }
      }
      const pass = passPol !== null;
      if (pass) ok++;
      const picked = Object.keys(byPol).length > 0;
      const stName = useMed ? '中央値' : 'min';
      rows.push(`  ${pass ? 'OK' : 'NG'} ${k.padEnd(28)} ${pass ? `${passPol} ${stName}=${bestStat.toFixed(2)}` : (picked ? `取得あり・${useMed ? '中央値' : '全周回'}≥${need}に未達(最大幾何平均${bestGm.toFixed(2)})` : 'どの方針も未取得')}`);
    }
    console.log(`${label} ${ok}/${allKeys.length}`);
    rows.forEach(r => console.log(r));
    return ok;
  }
  console.log(`=== 期待値方式(${H}h・各回の稼ぎ力の持ち上げ) ===`);
  judge(collect('res:'), 1.2, '① 研究(各回≥1.2)', G.RESEARCH.map(r => 'res:' + r.id));
  {
    const UTIL = new Set(UTILITY_REWARDS);
    const directIds = G.REWARD_POOL.filter(r => !UTIL.has(r.id)).map(r => 'rw:' + r.id);
    const okDirect = judge(collect('rw:'), 1.1, '③-a 報酬instant(中央値≥1.1・2026-07-08)', directIds, true);
    const okUtil = judgeUtilityRewards(H, sims, UTILITY_REWARDS);
    console.log(`③ 報酬 合計 ${okDirect + okUtil}/${G.REWARD_POOL.length} (instant ${okDirect}/${directIds.length} + utility ${okUtil}/${UTILITY_REWARDS.length})`);
  }
  {
    const stageMap = collect('stage:');
    const wholeSet = new Set(STAGE_WHOLE);
    // instant判定: ⑬タイミング段は除外、利息/余熱(whole軸)も除外。残りを瞬間比較lift≥1.05。
    const instantIds = Object.keys(stageMap).filter(k => !STAGE_TIMING_EXCLUDE.has(k) && !wholeSet.has(k));
    const okInstant = judge(stageMap, 1.05, '⑨-a 段階instant(各回≥1.05・⑬タイミング段は除外)', instantIds);
    // whole軸: 利息/余熱を通し比較で判定(取得された段のみ対象)
    const wholeKeys = STAGE_WHOLE.filter(k => STRATEGIES.some(s => stageFirstAcqIdx(sims[s.id], k) !== null));
    const okWhole = judgeStageWhole(H, sims, wholeKeys);
    console.log(`⑨ 段階 合計 ${okInstant + okWhole}/${instantIds.length + wholeKeys.length} (instant ${okInstant}/${instantIds.length} + whole ${okWhole}/${wholeKeys.length}・⑬タイミング段${[...STAGE_TIMING_EXCLUDE].filter(k => stageMap[k]).length}件は⑬で判定のため除外)`);
  }
  // ⑬ タイミング(提案5・2026-07-07承認=全体比較): 瞬間比較(collect('timing:'))は構造的に1.000
  // に張り付くため廃止。最適操作/完全放置の通しを走らせ、全周回効率の幾何平均比[1.05,2.0]で判定。
  judgeWholeTiming(H, sims);
  // 参考: 討伐連鎖(第12次D採用)の期待値lift(合否条件ではない。③②⑫㉘の押し上げ係数の目安)
  {
    const byPol = (collect('chain'))['chain'] || {};
    const rows = Object.entries(byPol).map(([pol, arr]) => {
      const gm = Math.exp(arr.reduce((a, b) => a + Math.log(b), 0) / arr.length);
      return `${pol} 幾何平均${gm.toFixed(2)} [${Math.min(...arr).toFixed(2)}..${Math.max(...arr).toFixed(2)}]`;
    });
    console.log(`参考 討伐連鎖lift: ${rows.length ? rows.join(' / ') : '(討伐なし)'}`);
  }
  // ② 研究の一強禁止: 各方針で、その方針が取得した研究の「周回幾何平均lift」が幾何平均±1.5倍
  {
    let ok = 0, all = 0;
    for (const s of STRATEGIES) {
      const full = sims[s.id].runs.filter(r => !r.partial && r.measure);
      const per = {};
      for (const rr of G.RESEARCH) {
        const vals = full.map(r => r.measure.lift['res:' + rr.id]).filter(v => v != null);
        if (vals.length) per[rr.id] = Math.exp(vals.reduce((a, b) => a + Math.log(b), 0) / vals.length);
      }
      const arr = Object.values(per);
      if (arr.length < 2) continue;
      all++;
      const gm = Math.exp(arr.reduce((a, b) => a + Math.log(b), 0) / arr.length);
      const within = arr.every(v => v >= gm / 1.5 && v <= gm * 1.5);
      if (within) ok++;
      console.log(`  ${within ? 'OK' : 'NG'} ${s.id} 研究lift[${Math.min(...arr).toFixed(2)}..${Math.max(...arr).toFixed(2)}] 平均${gm.toFixed(2)}`);
    }
    console.log(`② 一強禁止(方針ごと) ${ok}/${all}`);
  }
  // ⑫ 周回方針の文脈依存: 5方針それぞれが「1位になる周回」を持つ(全方針・全周回のargmax集合)
  {
    const seen = new Set();
    for (const s of STRATEGIES) for (const r of sims[s.id].runs) if (r.measure && r.measure.bestPol) seen.add(r.measure.bestPol);
    console.log(`⑫ 周回方針の1位が実在: ${[...seen].join(',')} (${seen.size}/5)`);
  }
} else if (mode === 'income') {
  // ㉘稼ぎ口比率(3-2): node runner.js income "" [hours]
  // 収入を4稼ぎ口(設備生産/金/討伐由来/タップ)に分解し、5つの周回方針の代表方針で判定:
  // (a) 主役の稼ぎ口シェア≥30%(バランス型は4つすべて≥10%) (b) どの稼ぎ口も90%を超えない。
  // 判定対象=その方針の主役強化の研究が1つ以上解放済みの周回(researchBoughtで判定)。
  const H = hours;
  // 周回方針→主役の稼ぎ口
  const ROLE_CHANNEL = { bake: 'equip', golden: 'golden', hunt: 'hunt', click: 'tap', balanced: null };
  // 主役強化の研究(ゲート判定用。割り当ての細部は【仮】)
  const ROLE_RESEARCH = {
    bake: ['ovenBatch', 'factoryNetwork', 'grandmaCrowd', 'moonGlobalYeast', 'galaxyAssembly', 'blackHoleCompression', 'quantumProofing', 'antimatterRecipe'],
    golden: ['spiceBlend'],
    hunt: ['portalNetwork', 'portalGlobalFold'],
    click: ['fingerTechnique', 'bankClickDividend'],
    balanced: null // いずれかの主役研究1つ以上
  };
  const ALL_ROLE_RES = [...new Set(Object.values(ROLE_RESEARCH).filter(Boolean).flat())];
  // 各周回方針の代表: その方針を常用する最初の戦略(S1=焼成, S2=会心タップ, S3=金色, S4=狩猟, S6=バランス)
  const reps = {};
  for (const s of STRATEGIES) {
    let pol = null;
    try { pol = s.pickPolicy({ prestigeRuns: 1, runs: [], t: 0, run: {} }); } catch (e) { /* 状態依存の方針はスキップ */ }
    if (pol && !reps[pol]) reps[pol] = s;
  }
  const CH_NAME = { equip: '設備生産', golden: '金クッキー', hunt: '討伐由来', tap: 'タップ' };
  console.log(`=== ㉘稼ぎ口比率(${H}h・周回シェア=各tickシェアの周回平均) ===`);
  let okAll = 0, allAll = 0, c2okAll = 0, c2allAll = 0;
  for (const pol of ['balanced', 'click', 'golden', 'hunt', 'bake']) {
    const s = reps[pol];
    if (!s) { console.log(`${pol}: 代表方針なし NG`); continue; }
    const sim = G.simulate(s, { hours: H, measure: true });
    const full = sim.runs.filter(r => !r.partial && r.measure && r.measure.income);
    let ok = 0, all = 0, c2ok = 0, c2all = 0;
    const rows = [];
    for (const r of full) {
      const gateList = ROLE_RESEARCH[pol] || ALL_ROLE_RES;
      const gated = (r.researchBought || []).some(id => gateList.includes(id));
      const inc = r.measure.income;
      const shares = { equip: inc.equip, golden: inc.golden, hunt: inc.hunt, tap: inc.tap };
      const maxShare = Math.max(...Object.values(shares));
      const aPass = pol === 'balanced'
        ? Object.values(shares).every(v => v >= 0.10)
        : shares[ROLE_CHANNEL[pol]] >= 0.30;
      // (b)独占禁止(どの稼ぎ口も≤90%)は2026-07-08 ユーザー決定で全方針撤廃。㉘は(a)主役シェア≥30%のみで判定。
      const bPass = true;
      const pass = aPass && bPass;
      if (gated) { all++; if (pass) ok++; }
      // ②(改・ジャンル単位の一強禁止・2026-07-08 ユーザー承認): 収入をジャンル(設備/金/討伐/タップ)に束ねた
      // lift(=1/(1-share))を出し、その方針の得意ジャンルの lift が全ジャンル lift 幾何平均の±1.5倍以内。
      // 得意ジャンルが突出しすぎない(=他ジャンルも腐らない)を担保。個々の研究の±1.5(構造的に不可能)を置換。
      let c2 = true;
      if (gated && ROLE_CHANNEL[pol]) {
        const gl = ['equip', 'golden', 'hunt', 'tap'].map(k => 1 / Math.max(1e-6, 1 - Math.min(0.999, shares[k])));
        const gm = Math.exp(gl.reduce((a, b) => a + Math.log(b), 0) / gl.length);
        const spec = 1 / Math.max(1e-6, 1 - Math.min(0.999, shares[ROLE_CHANNEL[pol]]));
        c2 = spec >= gm / 1.5 && spec <= gm * 1.5;
        c2all++; if (c2) c2ok++;
      }
      rows.push(`  run${String(r.idx).padStart(2)} ${gated ? '対象' : '対象外'} 設備${(shares.equip * 100).toFixed(0)}% 金${(shares.golden * 100).toFixed(0)}% 討伐${(shares.hunt * 100).toFixed(0)}% タップ${(shares.tap * 100).toFixed(0)}%${gated ? ` → (a)${aPass ? 'OK' : 'NG'} ②改${c2 ? 'OK' : 'NG'}` : ''}`);
    }
    okAll += ok; allAll += all; c2okAll += c2ok; c2allAll += c2all;
    const role = ROLE_CHANNEL[pol] ? `主役=${CH_NAME[ROLE_CHANNEL[pol]]}≥30%` : '4つすべて≥10%';
    console.log(`${pol}(${s.id} ${s.name}) ${role}: ${ok}/${all}周回 合格`);
    rows.forEach(x => console.log(x));
  }
  console.log(`㉘合計: ${okAll}/${allAll}周回`);
  console.log(`②(改・ジャンル一強禁止 得意ジャンルlift≤±1.5倍) 合計: ${c2okAll}/${c2allAll}周回`);
} else if (mode === 'skillsum') {
  let sum = 0;
  for (const n of G.SKILL_NODES) sum += G.skillCostOf(n);
  console.log('スキル総コスト:', sum, ' ノード数:', G.SKILL_NODES.length);
}

module.exports = { runBaseline, runToggles, summarize, yCurve, runTimingChecks };
