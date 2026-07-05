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
// 帯域式(ユーザー承認済み・√型): Y(x) = 120 + 8×√x (x=経過秒)
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

// 同一周回内の解放はまとめて1解放と見なす(1回の転生で同時に取得した解放=1つ)。
// スキル取得と、それにより解放された研究/設備の初購入は同じ回に属するため統合される。
function mergeEventsByRun(sim) {
  const ev = sim.unlockEvents.slice().sort((a, b) => a.t - b.t);
  const starts = sim.runs.map(r => r.startT).sort((a, b) => a - b);
  const runIdxOf = t => {
    let k = 0;
    while (k + 1 < starts.length && starts[k + 1] <= t) k++;
    return k;
  };
  const merged = [];
  for (const e of ev) {
    const k = runIdxOf(e.t);
    const last = merged[merged.length - 1];
    if (last && last.runIdx === k) { last.id += ',' + e.id; continue; }
    merged.push({ t: e.t, kind: e.kind, id: String(e.id), runIdx: k });
  }
  return merged;
}

function summarize(sim) {
  const total = sim.runs.reduce((a, r) => a + r.runCookies, 0);
  const fullT = fullUnlockTime(sim);
  // 条件: 転生後の各周回(回=転生から転生まで)が前回の100倍以上 / 獲得PTが前回の2倍〜100倍に収まる(途中周回は除く)
  const full = sim.runs.filter(r => !r.partial);
  let doubleOk = 0, doubleAll = 0, gainOk = 0;
  for (let i = 1; i < full.length; i++) {
    doubleAll++;
    if (full[i].runCookies >= 100 * full[i - 1].runCookies) doubleOk++;
    if (full[i].gain >= 2 * full[i - 1].gain && full[i].gain <= 100 * full[i - 1].gain) gainOk++;
  }
  // 条件4: 解放ペース (全スキル解放後は無視、同一周回内の解放は1つに統合)
  const ev = mergeEventsByRun(sim);
  let paceOk = 0, paceAll = 0;
  for (let i = 0; i + 1 < ev.length; i++) {
    if (ev[i].t >= fullT) continue;
    const y = ev[i + 1].t - ev[i].t;
    const Y = yCurve(ev[i + 1].t);
    paceAll++;
    if (y >= 0.5 * Y && y <= Y) paceOk++;
  }
  // 条件5: ノルマ維持時間も同じ帯域 [0.5Y, Y] (Y は維持終了時点 x=開始+維持時間で評価。全スキル解放後の周回は無視)
  let holdOk = 0, holdAll = 0;
  for (const r of full) {
    if (r.startT >= fullT) continue;
    const y = r.quotaHold;
    const Y = yCurve(r.startT + y);
    holdAll++;
    if (y >= 0.5 * Y && y <= Y) holdOk++;
  }
  return { total, runs: sim.runs.length, doubleOk, doubleAll, gainOk, paceOk, paceAll, holdOk, holdAll, events: ev.length, fullT };
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
  console.log('ID  名称              周回数 総クッキー   100倍達成  PT2-100倍   解放数 ペース適合 ノルマ帯域 全解放');
  for (const r of results) {
    const fullT = r.sum.fullT === Infinity ? '未' : fmtT(r.sum.fullT);
    console.log(
      `${r.s.id.padEnd(3)} ${r.s.name.padEnd(14)} ${String(r.sum.runs).padStart(4)}  ${fmtN(r.sum.total).padStart(10)}  ${r.sum.doubleOk}/${r.sum.doubleAll}   ${r.sum.gainOk}/${r.sum.doubleAll}   ${String(r.sum.events).padStart(4)}  ${r.sum.paceOk}/${r.sum.paceAll}  ${r.sum.holdOk}/${r.sum.holdAll}  ${fullT}  (${r.ms}ms)`
    );
  }
}

function printDetail(sim, maxRows) {
  const fullT = fullUnlockTime(sim);
  console.log('run  開始      周回時間   ノルマ維持  帯域Y      維持判定 最高層 討伐 金  総クッキー     PT  スキル数  前周比');
  const rows = sim.runs.slice(0, maxRows || 200);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const prev = i > 0 ? sim.runs[i - 1].runCookies : null;
    const ratio = prev ? (r.runCookies / prev).toFixed(2) : '-';
    const Y = yCurve(r.startT + r.quotaHold);
    const holdJ = r.partial ? '-' : (r.startT >= fullT ? '免除' : (r.quotaHold >= 0.5 * Y && r.quotaHold <= Y ? 'OK' : (r.quotaHold > Y ? '長い' : '短い')));
    console.log(
      `${String(r.idx).padStart(3)}  ${fmtT(r.startT).padStart(8)}  ${fmtT(r.duration).padStart(8)}  ${fmtT(r.quotaHold).padStart(8)}  ${fmtT(Y).padStart(8)}  ${holdJ.padEnd(4)} ${String(r.maxStage).padStart(4)} ${String(r.kills).padStart(4)} ${String(r.golden).padStart(3)}  ${fmtN(r.runCookies).padStart(12)}  ${String(r.gain).padStart(5)}  ${String(r.skillsBought == null ? '-' : r.skillsBought).padStart(3)}   ${ratio}${r.partial ? ' (途中)' : ''}  ${(r.skillIds || []).join(',')}`
    );
  }
}

function printPacing(sim) {
  const ev = mergeEventsByRun(sim);
  console.log('解放イベント (同一周回内は1解放に統合 / t, 種別, 内容, 次までy, 目標Y=120+8√x, 判定)');
  for (let i = 0; i < ev.length; i++) {
    const next = ev[i + 1];
    const y = next ? next.t - ev[i].t : null;
    const Y = next ? yCurve(next.t) : null;
    const ok = y === null ? '-' : (y >= 0.5 * Y && y <= Y ? 'OK' : (y > Y ? '遅い' : '早い'));
    console.log(`${fmtT(ev[i].t).padStart(9)}  ${ev[i].kind.padEnd(8)} ${String(ev[i].id).slice(0, 44).padEnd(44)} y=${y === null ? '-' : fmtT(y)} Y=${Y === null ? '-' : fmtT(Y)} ${ok}`);
  }
}

// 条件1/2: 研究・報酬トグル比較
// 閾値転生では各周回の総クッキーはスキルコストに固定されるため、効果は
// 「各周回の生産速度(総クッキー/周回時間)」と「100時間の累計生産」に現れる。
// 指標: 有効側でその研究/報酬を初めて取得した時点から2時間後の総クッキー比(有効/無効)
// 指標: 各回(回=転生から転生まで)の総クッキー獲得を同じ回同士で比較する。
// 閾値転生では回ごとの到達クッキー量は両者で一致するため、差は「その量を稼ぐのに要した時間」に現れる。
// 比 = 各回の単位時間あたり総クッキー(総クッキー/周回時間)の有効/無効比 = 無効時周回時間/有効時周回時間。
// 全該当回の幾何平均を採る(初取得以降の回のみ対象)。
function skillSignatures(runs) {
  // 各周回「開始時点」の所持スキル集合の署名
  const sigs = [];
  let cur = [];
  for (const r of runs) {
    sigs.push(cur.slice().sort().join(','));
    cur = cur.concat(r.skillIds || []);
  }
  return sigs;
}
function toggleCompare(base, dis, firstT) {
  if (firstT === undefined) return { used: false, ratio: 1 };
  const eR = base.runs.filter(r => !r.partial);
  const dR = dis.runs.filter(r => !r.partial);
  const eS = skillSignatures(eR), dS = skillSignatures(dR);
  // 同じスキル状態(=同じ目標)の回同士のみ比較する
  const dIdx = new Map();
  for (let i = 0; i < dR.length; i++) if (!dIdx.has(dS[i])) dIdx.set(dS[i], i);
  let sumLog = 0, cnt = 0;
  const logs = []; // 各比較ペアのlog比(周回順。条件⑪のフェーズ三分割用)
  for (let k = 0; k < eR.length; k++) {
    if (eR[k].endT < firstT) continue; // 取得前の回は同一
    const j = dIdx.get(eS[k]);
    if (j === undefined) continue;
    const re = eR[k].runCookies / Math.max(1, eR[k].duration);
    const rd = dR[j].runCookies / Math.max(1, dR[j].duration);
    if (re > 0 && rd > 0 && Number.isFinite(re) && Number.isFinite(rd)) { sumLog += Math.log(re / rd); cnt++; logs.push(Math.log(re / rd)); }
  }
  if (cnt === 0) return { used: false, ratio: 1 };
  return { used: true, ratio: Math.exp(sumLog / cnt), atT: firstT, runs: cnt, logs };
}

// 条件⑪: 取得済み周回を序盤/中盤/終盤に三等分し、各区間の幾何平均比を返す(3周回未満は判定不能)
function phaseGeo(logs) {
  if (!logs || logs.length < 3) return null;
  const n = logs.length, a = Math.floor(n / 3), b = Math.floor(2 * n / 3);
  const gm = arr => Math.exp(arr.reduce((s, v) => s + v, 0) / arr.length);
  return [gm(logs.slice(0, a)), gm(logs.slice(a, b)), gm(logs.slice(b))];
}

function runToggles(strategy, hours, kind) {
  const base = G.simulate(strategy, { hours });
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
      const dis = G.simulate(strategy, { hours, disableResearch: r.id });
      const c = toggleCompare(base, dis, base.firstResearchBuy[r.id]);
      rows.push(Object.assign({ kind: 'research', id: r.id, need: 1.2 }, c));
    }
  }
  if (doRw) {
    for (const rw of G.REWARD_POOL) {
      if (rwFilter && !rwFilter.has(rw.id)) continue;
      const dis = G.simulate(strategy, { hours, disableReward: rw.id });
      const c = toggleCompare(base, dis, base.firstPerk[rw.id]);
      rows.push(Object.assign({ kind: 'reward', id: rw.id, need: 1.1 }, c));
    }
  }
  // 条件⑨: 研究「段階」(段2/段3の26種)を単体で効果ゼロ化(購入行動は同一)
  if (doStage) {
    for (const r of G.RESEARCH) {
      for (const st of [2, 3]) {
        const key = r.id + ':' + st;
        if (stFilter && !stFilter.has(key) && !stFilter.has(r.id)) continue;
        const dis = G.simulate(strategy, { hours, disableStage: key });
        const c = toggleCompare(base, dis, base.firstStageBuy[key]);
        rows.push(Object.assign({ kind: 'stage', id: key, need: 1.05 }, c));
      }
    }
  }
  // 条件⑩: 設備1種の生産だけをゼロ(所持数は各計算式に残す・購入行動同一)
  if (doUp) {
    const firstUp = {};
    for (const e of base.unlockEvents) if (e.kind === 'upgrade' && firstUp[e.id] === undefined) firstUp[e.id] = e.t;
    for (const u of G.UPGRADES) {
      if (upFilter && !upFilter.has(u.id)) continue;
      const dis = G.simulate(strategy, { hours, disableUpgrade: u.id });
      const c = toggleCompare(base, dis, firstUp[u.id]);
      rows.push(Object.assign({ kind: 'upgrade', id: u.id, need: 1.2 }, c));
    }
  }
  return { base, rows };
}

function printToggles(res) {
  console.log('種別      ID                         各回の獲得効率比(有効/無効, 幾何平均)   必要   判定(初取得t)  フェーズ⑪[序/中/終](各≥1.02)');
  // 条件: 各研究(①) 1.2倍以上 / 各報酬(③) 1.1倍以上 / 各段階(⑨) 1.05倍以上 / 各設備(⑩) 1.2倍以上
  //       いずれも個別比が同種別平均の±10倍以内(平均/10 〜 平均x10)
  //       条件⑪: 取得済み周回を序盤/中盤/終盤に三等分し各区間の幾何平均比 ≥1.02
  const KINDS = [['research', '研究'], ['reward', '報酬'], ['stage', '段階'], ['upgrade', '設備']];
  const avgOf = kind => {
    const rows = res.rows.filter(r => r.used && r.kind === kind);
    return rows.length ? rows.reduce((a, b) => a + b.ratio, 0) / rows.length : 0;
  };
  const avgs = {}; for (const [k] of KINDS) avgs[k] = avgOf(k);
  for (const r of res.rows) {
    const f = x => (x >= 1000 ? x.toExponential(2) : x.toFixed(2)).padStart(10);
    let ok = '-';
    if (r.used) {
      const avg = avgs[r.kind];
      ok = (r.ratio >= r.need && r.ratio <= 10 * avg && r.ratio >= avg / 10) ? 'OK' : 'NG';
    }
    const ph = r.used ? phaseGeo(r.logs) : null;
    const phStr = ph ? ph.map(v => v.toFixed(2)).join('/') + (ph.every(v => v >= 1.02) ? ' ⑪OK' : ' ⑪NG') : '-';
    console.log(`${r.kind.padEnd(9)} ${r.id.padEnd(28)} ${!r.used ? '(未使用)'.padStart(10) : f(r.ratio)} ${r.atT ? '(t=' + Math.round(r.atT / 3600) + 'h)' : ''}  x${r.need}  ${ok}  ${phStr}`);
  }
  for (const [kind, label] of KINDS) {
    const rows = res.rows.filter(r => r.used && r.kind === kind);
    if (!rows.length) continue;
    const avg = avgs[kind];
    const mx = Math.max(...rows.map(r => r.ratio));
    const mn = Math.min(...rows.map(r => r.ratio));
    const bandOk = mx <= 10 * avg && mn >= avg / 10;
    console.log(`${label}の有効/無効比 平均: ${avg.toFixed(2)} / 許容帯 [${(avg / 10).toFixed(2)}, ${(10 * avg).toFixed(2)}] / 実測 [${mn.toFixed(2)}, ${mx.toFixed(2)}] → ${bandOk ? '全て平均±10倍以内 OK' : 'NG'}`);
  }
}

// ================= 新判定 ⑧⑫⑬ =================
// 条件⑧: ノルマ未達後にPT獲得効率が落ちる
// e(t)=「いま転生した場合の獲得PT」の毎秒増加量。未達のまま60秒以上続いた全周回で、
// 未達後300秒の平均e ≤ 未達直前300秒の平均e×0.5、かつ以後増加に転じない、かつ未達後も e>0。
// 「増加に転じない」は 未達後の60秒バケット平均が常に 直前平均×0.5 を超えないこと、と解釈。
function checkQuotaDecay(sim) {
  const out = [];
  for (const r of sim.runs) {
    if (r.quotaFailAt == null || !r.gainSeries) continue;
    if (r.duration - r.quotaFailAt < 60) continue; // 未達のまま60秒未満は対象外
    const g = r.gainSeries;
    const jf = Math.min(g.length - 1, Math.max(1, Math.round(r.quotaFailAt)));
    const avgE = (from, to) => {
      let s = 0, c = 0;
      for (let i = Math.max(1, from); i < Math.min(to, g.length); i++) { s += g[i] - g[i - 1]; c++; }
      return c > 0 ? s / c : null;
    };
    const pre = avgE(jf - 300, jf);
    const post = avgE(jf, jf + 300);
    if (pre == null || post == null) continue;
    let noRise = true;
    for (let b = jf; b < g.length - 1; b += 60) {
      const m = avgE(b, Math.min(b + 60, g.length));
      if (m != null && m > 0.5 * pre + 1e-9) { noRise = false; break; }
    }
    const halfOk = post <= 0.5 * pre + 1e-9;
    const posOk = post > 0;
    out.push({ idx: r.idx, startT: r.startT, failT: r.quotaFailAt, pre, post, halfOk, noRise, posOk, ok: halfOk && noRise && posOk });
  }
  return out;
}
function printQuotaDecay(stratId, rows) {
  if (!rows.length) { console.log(`${stratId}: ⑧ 対象周回なし(未達のまま60秒以上続いた周回がない)`); return true; }
  console.log(`${stratId}: ⑧ ノルマ未達後のPT獲得効率 (e=獲得見込みPTの毎秒増分)`);
  console.log(' run  未達el     直前300s平均e   未達後300s平均e   半減   増加に転じない  e>0   判定');
  let allOk = true;
  for (const r of rows) {
    if (!r.ok) allOk = false;
    console.log(` ${String(r.idx).padStart(3)}  ${fmtT(r.failT).padStart(8)}  ${r.pre.toExponential(3).padStart(12)}  ${r.post.toExponential(3).padStart(12)}   ${r.halfOk ? 'OK' : 'NG'}    ${r.noRise ? 'OK' : 'NG'}          ${r.posOk ? 'OK' : 'NG'}   ${r.ok ? 'OK' : 'NG'}`);
  }
  console.log(` → ${stratId} ⑧: ${rows.filter(r => r.ok).length}/${rows.length} ${allOk ? 'OK' : 'NG'}`);
  return allOk;
}

// 条件⑫: 使用カバレッジ。全研究・全26段階・全設備・全報酬・全スキルが
// 10方針の少なくとも1つで100時間内に取得/発動されるかを列挙・判定。
function printCoverage(sims) {
  const cats = [
    ['研究(13)', G.RESEARCH.map(r => r.id), s => Object.keys(s.everResearch)],
    ['段階(26)', G.RESEARCH.reduce((a, r) => a.concat([r.id + ':2', r.id + ':3']), []), s => Object.keys(s.everStage)],
    ['設備(' + G.UPGRADES.length + ')', G.UPGRADES.map(u => u.id), s => Object.keys(s.everUpgrade)],
    ['報酬(' + G.REWARD_POOL.length + ')', G.REWARD_POOL.map(r => r.id), s => Object.keys(s.firstPerk)],
    ['スキル(' + G.SKILL_NODES.length + ')', G.SKILL_NODES.map(n => n.id), s => Object.keys(s.skills).filter(k => s.skills[k])]
  ];
  console.log('⑫ 使用カバレッジ (全方針の和集合)');
  let allOk = true;
  for (const [label, all, getter] of cats) {
    const got = new Set();
    for (const id of Object.keys(sims)) for (const k of getter(sims[id])) got.add(k);
    const missing = all.filter(x => !got.has(x));
    if (missing.length) allOk = false;
    console.log(` ${label.padEnd(10)} 取得 ${all.length - missing.length}/${all.length} ${missing.length ? 'NG 未使用: ' + missing.join(',') : 'OK'}`);
  }
  console.log(` → ⑫: ${allOk ? 'OK' : 'NG'}`);
  return allOk;
}

// 条件⑬: タイミング機能の実効性。最適操作(既定)と完全放置(idleTiming)の獲得効率比が +5%〜+100%。
const TIMING_FEATURES = [
  { key: 'wave', label: '観測ゆらぎ(量子発酵 段2)', stage: 'quantumProofing:2' },
  { key: 'bhCharge', label: '圧縮チャージ(重力圧縮 段2)', stage: 'blackHoleCompression:2' },
  { key: 'mature', label: '熟成(香料調合 段2)', stage: 'spiceBlend:2' },
  { key: 'huntExtend', label: '延長狩り(異世界接続網 段2)', stage: 'portalNetwork:2' }
];
function runTimingChecks(strategy, hours, base) {
  base = base || G.simulate(strategy, { hours });
  const rows = [];
  for (const f of TIMING_FEATURES) {
    const idle = G.simulate(strategy, { hours, idleTiming: f.key });
    const c = toggleCompare(base, idle, base.firstStageBuy[f.stage]);
    rows.push(Object.assign({ f }, c));
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
    const sim = G.simulate(s, { hours, trackGain: true });
    printQuotaDecay(s.id, checkQuotaDecay(sim));
  }
} else if (mode === 'coverage') {
  // ⑫ 単体: node runner.js coverage "" [hours] (全10方針を実行して和集合を判定)
  const sims = {};
  for (const s of STRATEGIES) sims[s.id] = G.simulate(s, { hours });
  printCoverage(sims);
} else if (mode === 'timing') {
  // ⑬ 単体: node runner.js timing S1 [hours]
  const s = STRATEGIES.find(x => x.id === arg) || STRATEGIES[0];
  printTiming(s.id, runTimingChecks(s, hours));
} else if (mode === 'checks') {
  // まとめ実行: node runner.js checks S1 [hours]
  // ⑧=全方針 / ⑫=全方針の和集合 / ⑬=指定方針。⑨⑩⑪は toggles で実行(下記案内)。
  const sims = {};
  for (const s of STRATEGIES) {
    const t0 = Date.now();
    sims[s.id] = G.simulate(s, { hours, trackGain: true });
    console.log(`sim ${s.id} ${s.name} done (${Date.now() - t0}ms)`);
  }
  console.log('');
  for (const s of STRATEGIES) printQuotaDecay(s.id, checkQuotaDecay(sims[s.id]));
  console.log('');
  printCoverage(sims);
  console.log('');
  const s = STRATEGIES.find(x => x.id === arg) || STRATEGIES[0];
  printTiming(s.id, runTimingChecks(s, hours, sims[s.id]));
  console.log('');
  console.log('⑨(段階トグル)/⑩(設備トグル)/⑪(フェーズ三分割)は toggles で実行:');
  console.log('  node runner.js toggles S1 100 stage    # ⑨ 26段階 (⑪も同時出力)');
  console.log('  node runner.js toggles S1 100 upgrade  # ⑩ 全設備 (⑪も同時出力)');
  console.log('  node runner.js toggles S1 100 all      # ①②③⑨⑩⑪ 全部');
} else if (mode === 'skillsum') {
  let sum = 0;
  for (const n of G.SKILL_NODES) sum += G.skillCostOf(n);
  console.log('スキル総コスト:', sum, ' ノード数:', G.SKILL_NODES.length);
}

module.exports = { runBaseline, runToggles, summarize, yCurve, checkQuotaDecay, runTimingChecks };
