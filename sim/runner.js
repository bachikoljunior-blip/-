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
function yCurve(x) { return 3600 / Math.pow(360000, 0.8) * Math.pow(x, 0.8); }

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
  // 条件: 転生後の各周回(回=転生から転生まで)が前回の100倍以上 / 獲得PTが前回の2倍以上(途中周回は除く)
  const full = sim.runs.filter(r => !r.partial);
  let doubleOk = 0, doubleAll = 0, gainOk = 0;
  for (let i = 1; i < full.length; i++) {
    doubleAll++;
    if (full[i].runCookies >= 100 * full[i - 1].runCookies) doubleOk++;
    if (full[i].gain >= 2 * full[i - 1].gain) gainOk++;
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
  console.log('ID  名称              周回数 総クッキー   100倍達成  PT2倍   解放数 ペース適合 ノルマ帯域 全解放');
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
  console.log('解放イベント (同一周回内は1解放に統合 / t, 種別, 内容, 次までy, 目標Y=3600/360000^0.8*x^0.8, 判定)');
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
  for (let k = 0; k < eR.length; k++) {
    if (eR[k].endT < firstT) continue; // 取得前の回は同一
    const j = dIdx.get(eS[k]);
    if (j === undefined) continue;
    const re = eR[k].runCookies / Math.max(1, eR[k].duration);
    const rd = dR[j].runCookies / Math.max(1, dR[j].duration);
    if (re > 0 && rd > 0 && Number.isFinite(re) && Number.isFinite(rd)) { sumLog += Math.log(re / rd); cnt++; }
  }
  if (cnt === 0) return { used: false, ratio: 1 };
  return { used: true, ratio: Math.exp(sumLog / cnt), atT: firstT, runs: cnt };
}

function runToggles(strategy, hours, kind) {
  const base = G.simulate(strategy, { hours });
  const rows = [];
  // kind 例: 'all' | 'research' | 'reward' | 'research:spiceBlend,galaxyAssembly' | 'reward:monsterDamage'
  let resFilter = null, rwFilter = null;
  let doRes = kind === 'research' || kind === 'all';
  let doRw = kind === 'reward' || kind === 'all';
  if (kind.startsWith('research:')) { doRes = true; resFilter = new Set(kind.slice(9).split(',')); }
  if (kind.startsWith('reward:')) { doRw = true; rwFilter = new Set(kind.slice(7).split(',')); }
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
  return { base, rows };
}

function printToggles(res) {
  console.log('種別      ID                         各回の獲得効率比(有効/無効, 幾何平均)   必要   判定(初取得t)');
  // 条件: 各研究 1.2倍以上 かつ 個別比が全研究平均の±10倍以内(平均/10 〜 平均x10)
  //       各報酬 1.1倍以上 かつ 個別比が全報酬平均の±10倍以内
  const avgOf = kind => {
    const rows = res.rows.filter(r => r.used && r.kind === kind);
    return rows.length ? rows.reduce((a, b) => a + b.ratio, 0) / rows.length : 0;
  };
  const avgRes = avgOf('research'), avgRw = avgOf('reward');
  for (const r of res.rows) {
    const f = x => (x >= 1000 ? x.toExponential(2) : x.toFixed(2)).padStart(10);
    let ok = '-';
    if (r.used) {
      const avg = r.kind === 'research' ? avgRes : avgRw;
      ok = (r.ratio >= r.need && r.ratio <= 10 * avg && r.ratio >= avg / 10) ? 'OK' : 'NG';
    }
    console.log(`${r.kind.padEnd(9)} ${r.id.padEnd(28)} ${!r.used ? '(未使用)'.padStart(10) : f(r.ratio)} ${r.atT ? '(t=' + Math.round(r.atT / 3600) + 'h)' : ''}  x${r.need}  ${ok}`);
  }
  for (const [kind, avg, label] of [['research', avgRes, '研究'], ['reward', avgRw, '報酬']]) {
    const rows = res.rows.filter(r => r.used && r.kind === kind);
    if (!rows.length) continue;
    const mx = Math.max(...rows.map(r => r.ratio));
    const mn = Math.min(...rows.map(r => r.ratio));
    const bandOk = mx <= 10 * avg && mn >= avg / 10;
    console.log(`${label}の有効/無効比 平均: ${avg.toFixed(2)} / 許容帯 [${(avg / 10).toFixed(2)}, ${(10 * avg).toFixed(2)}] / 実測 [${mn.toFixed(2)}, ${mx.toFixed(2)}] → ${bandOk ? '全て平均±10倍以内 OK' : 'NG'}`);
  }
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
  console.log(`合計: ${fmtN(sum.total)} / 100倍達成 ${sum.doubleOk}/${sum.doubleAll} / PT2倍 ${sum.gainOk}/${sum.doubleAll} / ペース ${sum.paceOk}/${sum.paceAll}`);
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
} else if (mode === 'skillsum') {
  let sum = 0;
  for (const n of G.SKILL_NODES) sum += G.skillCostOf(n);
  console.log('スキル総コスト:', sum, ' ノード数:', G.SKILL_NODES.length);
}

module.exports = { runBaseline, runToggles, summarize, yCurve };
