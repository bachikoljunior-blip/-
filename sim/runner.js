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
// 帯域式(2026-07-06 確定・2段階): 初転生まで Y=120+8√x / 初転生後 Y=1440+8√x (x=経過秒)
function firstPrestigeT(sim) {
  const r0 = sim.runs[0];
  return (r0 && !r0.partial) ? r0.endT : Infinity;
}
function makeY(sim) {
  const fp = firstPrestigeT(sim);
  return x => (x >= fp ? 1440 : 120) + 8 * Math.sqrt(Math.max(0, x));
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
  // ⑥ 解放ペース: 2段階帯域・厳密判定 (全スキル解放後は対象外)
  const ev = mergeEventsByRun(sim);
  let paceOk = 0, paceAll = 0;
  for (let i = 0; i + 1 < ev.length; i++) {
    if (ev[i].t >= fullT) continue;
    const y = ev[i + 1].t - ev[i].t;
    const Y = yC(ev[i + 1].t);
    paceAll++;
    if (y >= 0.5 * Y && y <= Y) paceOk++;
  }
  // ⑦ ノルマ維持時間の帯域 [0.5Y, Y]: Y は転生した時点の経過時間 x=endT で評価(2026-07-06 確定)
  let holdOk = 0, holdAll = 0;
  for (const r of full) {
    if (r.startT >= fullT) continue;
    const Y = yC(r.endT);
    holdAll++;
    if (r.quotaHold >= 0.5 * Y && r.quotaHold <= Y) holdOk++;
  }
  // 条件⑧: 全ての転生がノルマ未達の後に起きる
  let failOk = 0;
  for (const r of full) if (r.quotaFailAt != null && r.quotaFailAt < r.duration) failOk++;
  // 条件⑭: 各周回の獲得PT ÷ 次の未取得スキル最安コスト(転生時点・購入前) ∈ [1.0, 3.0]
  let pwOk = 0, pwAll = 0;
  for (const r of full) {
    if (r.gainToNext == null) continue;
    pwAll++;
    if (r.gainToNext >= 1.0 && r.gainToNext <= 3.0) pwOk++;
  }
  // 条件㉒(新): 各回の周回時間が前回より長い(全ペア・厳密)
  let durOk = 0, durAll = 0;
  for (let i = 1; i < full.length; i++) { durAll++; if (full[i].duration > full[i - 1].duration) durOk++; }
  // 条件㉑(新): 各設備の周回内初購入時に「1個の基礎毎秒生産」≥「実CPS」×1/5
  let prOk = 0, prAll = 0, prWorst = null;
  for (const c of (sim.presenceChecks || [])) {
    prAll++;
    const ratio = c.ref > 0 ? (c.base * 5) / c.ref : Infinity;
    if (ratio >= 1) prOk++;
    if (!prWorst || ratio < prWorst.ratio) prWorst = { id: c.id, runIdx: c.runIdx, ratio };
  }
  return { total, runs: sim.runs.length, doubleOk, doubleAll, gainOk, paceOk, paceAll, holdOk, holdAll, events: ev.length, fullT, failOk, failAll: full.length, pwOk, pwAll, durOk, durAll, prOk, prAll, prWorst };
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
  console.log('ID  名称              周回数 総クッキー   ④x100   ⑤PT1-100  ⑥ペース   ⑦帯域   ⑧未達後転生 ⑭購買力 ㉑存在感 ㉒単調増 全解放');
  for (const r of results) {
    const fullT = r.sum.fullT === Infinity ? '未' : fmtT(r.sum.fullT);
    console.log(
      `${r.s.id.padEnd(3)} ${r.s.name.padEnd(14)} ${String(r.sum.runs).padStart(4)}  ${fmtN(r.sum.total).padStart(10)}  ${r.sum.doubleOk}/${r.sum.doubleAll}   ${r.sum.gainOk}/${r.sum.doubleAll}   ${r.sum.paceOk}/${r.sum.paceAll}  ${r.sum.holdOk}/${r.sum.holdAll}  ${r.sum.failOk}/${r.sum.failAll}  ${r.sum.pwOk}/${r.sum.pwAll}  ${r.sum.prOk}/${r.sum.prAll}  ${r.sum.durOk}/${r.sum.durAll}  ${fullT}  (${r.ms}ms)` +
      (r.sum.prWorst && r.sum.prWorst.ratio < 1 ? `  ㉑最悪: ${r.sum.prWorst.id}@run${r.sum.prWorst.runIdx} x${r.sum.prWorst.ratio.toFixed(2)}` : '')
    );
  }
}

function printDetail(sim, maxRows) {
  const fullT = fullUnlockTime(sim);
  const yC = makeY(sim);
  console.log('run  開始      周回時間   ノルマ維持  帯域Y      維持判定 最高層 討伐 金  総クッキー     PT  スキル数  前周比');
  const rows = sim.runs.slice(0, maxRows || 200);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const prev = i > 0 ? sim.runs[i - 1].runCookies : null;
    const ratio = prev ? (r.runCookies / prev).toFixed(2) : '-';
    const Y = yC(r.endT);
    const holdJ = r.partial ? '-' : (r.startT >= fullT ? '免除' : (r.quotaHold >= 0.5 * Y && r.quotaHold <= Y ? 'OK' : (r.quotaHold > Y ? '長い' : '短い')));
    console.log(
      `${String(r.idx).padStart(3)}  ${fmtT(r.startT).padStart(8)}  ${fmtT(r.duration).padStart(8)}  ${fmtT(r.quotaHold).padStart(8)}  ${fmtT(Y).padStart(8)}  ${holdJ.padEnd(4)} ${String(r.maxStage).padStart(4)} ${String(r.kills).padStart(4)} ${String(r.golden).padStart(3)}  ${fmtN(r.runCookies).padStart(12)}  ${String(r.gain).padStart(5)}  ${String(r.skillsBought == null ? '-' : r.skillsBought).padStart(3)}   ${ratio}${r.partial ? ' (途中)' : ''}  ${(r.skillIds || []).join(',')}`
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
  const optKey = { research: 'disableResearch', reward: 'disableReward', stage: 'disableStage', upgrade: 'disableUpgrade' }[kind];
  const hours = base.opt.hours;
  const runIdxs = activeRunsOf(base, kind, id);
  if (!runIdxs.length) return { kind, id, need, used: false, ratio: 1 };
  const logs = [];
  const usedIdxs = [];
  for (const k of runIdxs) {
    const lg = replayRatio(strategy, base, k, { hours, [optKey]: id });
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

function printToggles(res) {
  // 2026-07-06 新判定:
  //  ①研究≥1.2 / ③報酬≥1.1 / ⑨段階≥1.05 / ⑩設備≥1.2 — 取得済みの「各回」で比≥閾値(幾何平均条件は廃止)
  //  ②③⑨⑩の一強禁止: 各回において、その回で有効な同種機能の比が「その回の平均±3倍」以内
  //  未使用(どの方針も取得しない)機能は比=1.0=不合格として扱う(スキップしない)
  console.log('種別      ID                        各回比[min..max](幾何平均)   必要   下限判定(全回)   ±3倍判定(全回)');
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
      const lowOk = mn >= need;
      if (lowOk) out.lowOk++;
      r._ratios = ratios; r._low = lowOk;
      console.log(`${kind.padEnd(9)} ${r.id.padEnd(26)} [${mn.toFixed(2)}..${mx.toFixed(2)}] (${gm.toFixed(2)}) x${r.logs.length}回  x${need}  ${lowOk ? 'OK' : 'NG(min<' + need + ')'}`);
    }
    // ±3倍(各回): 同一周回内で有効な機能同士。runIdx単位で照合
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
      if (arr.every(v => v >= mean / 3 && v <= mean * 3)) bOk++;
    }
    out.bandOk += bOk; out.bandAll += bAll;
    console.log(`${label}: 下限(各回)OK ${rows.filter(r => r._low).length}/${rows.length} / ±3倍(各回) ${bOk}/${bAll}周回`);
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
  // 研究: 各方針の最優先研究(初回購入が最も早い研究)
  const topRes = {};
  for (const id of Object.keys(sims)) {
    const fr = Object.entries(sims[id].firstResearchBuy).sort((a, b) => a[1] - b[1]);
    topRes[id] = fr.length ? fr[0][0] : '-';
  }
  const resSet = new Set(Object.values(topRes));
  console.log(' 研究(最優先): ' + Object.keys(topRes).map(k => k + '=' + topRes[k]).join(' '));
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
  base = base || G.simulate(strategy, { hours, snapshots: true });
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
  // ⑬ 単体: node runner.js timing S1 [hours]
  const s = STRATEGIES.find(x => x.id === arg) || STRATEGIES[0];
  printTiming(s.id, runTimingChecks(s, hours));
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
  // ⑲(2026-07-06 確定): ツリー全辺のコスト比≤10倍 + 丸め規則(有効数字3桁=5の倍数)検証
  const cap = G.P.skillCost.edgeCap || 10;
  let bad = 0;
  for (const n of G.SKILL_NODES) {
    for (const q of n.prereqs) {
      const r = G.skillCostOf(n) / G.skillCostOf(G.SKILL_BY_ID[q]);
      if (r > cap * 1.0001) { bad++; console.log(`NG ${q}(${fmtN(G.skillCostOf(G.SKILL_BY_ID[q]))}) -> ${n.id}(${fmtN(G.skillCostOf(n))}) x${r.toExponential(1)}`); }
    }
    const c = G.skillCostOf(n);
    if (c !== G.q5cost(c)) { bad++; console.log(`NG 丸め違反 ${n.id}=${c}`); }
  }
  console.log(`⑲: 辺コスト比≤${cap}倍+丸め規則 → ${bad === 0 ? '全edge OK' : bad + '件NG'} (ライダー: ${[...G.skillRiders()].join(',') || 'なし'})`);
} else if (mode === 'skillsum') {
  let sum = 0;
  for (const n of G.SKILL_NODES) sum += G.skillCostOf(n);
  console.log('スキル総コスト:', sum, ' ノード数:', G.SKILL_NODES.length);
}

module.exports = { runBaseline, runToggles, summarize, yCurve, runTimingChecks };
