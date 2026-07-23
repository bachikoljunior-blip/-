'use strict';
// 自動調整ループ(2026-07-22 ユーザー指示「全部合格になるまで全調整項目を調整し続けて。止まらない仕組みで」):
// 経済パラメータを安全に山登り(hill-climb+rollback)する非停止ループ。
//  ・設計パラメータ(quota.baseCoef=0.60 / monster.hpGrowth=1.60 / reveal)はユーザー確定=触らない。
//  ・1手ごとに関連モードを再測定し、目的(合格数)が改善しかつ緑を割らない時だけ採用、でなければ即revert。
//  ・あらゆる例外/タイムアウトを握りつぶして継続。進捗は autotune.log と autotune_state.json へ。
// 使い方: node autotune.js &   (バックグラウンド非停止)
const fs = require('fs');
const { execSync } = require('child_process');
const PARAMS = __dirname + '/params.js';
const LOG = __dirname + '/results/autotune.log';
const HORIZON = 60; // idle-cut がツリー完成(~47h)で先に効くため実質 runUntilDone 相当・上限保険

function log(msg) {
  const line = `[iter] ${msg}`;
  try { fs.appendFileSync(LOG, line + '\n'); } catch (e) {}
  console.log(line);
}

// ---- params.js のテキスト編集(数値1個をユニークな正規表現で置換) ----
function readParams() { return fs.readFileSync(PARAMS, 'utf8'); }
function getNum(text, re) { const m = text.match(re); return m ? Number(m[2]) : null; }
function setNum(text, re, val) {
  return text.replace(re, (all, pre) => pre + (Number.isInteger(val) ? val : +val.toFixed(6)));
}

// ---- モード実行(子プロセス・例外/タイムアウトは null を返す) ----
function runMode(mode, timeoutMs) {
  try {
    const out = execSync(`node runner.js ${mode} "" ${HORIZON}`, { cwd: __dirname, timeout: timeoutMs || 900000, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return out;
  } catch (e) { return (e.stdout ? e.stdout.toString() : '') || null; }
}
// 「... 合計 X/Y方針」や「X/Y」を拾う汎用パーサ。condKey ごとに評価関数を持つ。
function pass(out, re) { const m = out && out.match(re); return m ? [Number(m[1]), Number(m[2])] : null; }

// 評価対象(mode→そのmodeから読む合格指標)。重い順に必要な時だけ呼ぶ。
function scoreExpect() {
  const out = runMode('expect'); if (!out) return null;
  const s = {};
  const p12 = pass(out, /⑫[^\n]*?\((\d+)\/(\d+)\)/); if (p12) s['12'] = p12;
  // ③報酬 合計 / ⑨段階 合計 / ①・⑬ は行から
  const p3 = pass(out, /③ 報酬 合計 (\d+)\/(\d+)/); if (p3) s['3'] = p3;
  const p9 = pass(out, /⑨ 段階 合計 (\d+)\/(\d+)/); if (p9) s['9'] = p9;
  return { out, s };
}
function scoreIncome() {
  const out = runMode('income'); if (!out) return null;
  const s = {};
  const p28 = pass(out, /㉘合計[:：]\s*(\d+)\/(\d+)/); if (p28) s['28'] = p28;
  s['2'] = /②[^\n]*→\s*OK/.test(out) ? [1, 1] : [0, 1];
  return { out, s };
}
function scoreBaseline() {
  // ④前周回超(列0)と T1周回時間(列4)が全方針で満杯(a==b)かを数える=緑を守る門番。
  const out = runMode('baseline'); if (!out) return null;
  let n = 0, ok4 = 0, okT1 = 0;
  for (const line of out.split('\n')) {
    if (!/^S\d+\s/.test(line)) continue; n++;
    const fr = [...line.matchAll(/(\d+)\/(\d+)/g)].map(x => [Number(x[1]), Number(x[2])]);
    if (fr.length >= 5) {
      if (fr[0][0] === fr[0][1]) ok4++;      // ④前周回超
      if (fr[4][0] === fr[4][1]) okT1++;     // T1周回時間
    }
  }
  if (n < 15) return null; // 走り切っていない=不採用
  return { out, s: { '4': [ok4, n], 'T1': [okT1, n] } };
}

function totalScore(parts) {
  let sc = 0, detail = {}, per = {};
  for (const part of parts) if (part && part.s) for (const k in part.s) { sc += part.s[k][0]; per[k] = part.s[k][0]; detail[k] = part.s[k].join('/'); }
  return { sc, detail, per };
}
// 候補が「合計改善 かつ どの条件も現状未満にしない」= 安全な改善か
function isSafeImprovement(cand, base) {
  if (!cand || cand.sc <= base.sc) return false;
  for (const k in base.per) if ((cand.per[k] != null ? cand.per[k] : 0) < base.per[k]) return false;
  return true;
}
function gitCommitPush(msg) {
  try {
    execSync(`git -C ${__dirname}/.. add sim/params.js sim/results/autotune_state.json`, { encoding: 'utf8' });
    execSync(`git -C ${__dirname}/.. commit -q -m ${JSON.stringify(msg)} --author="Claude <noreply@anthropic.com>"`, { encoding: 'utf8' });
    execSync(`git -C ${__dirname}/.. push -q origin claude/game-tuning-gate-tap-oiwogx`, { encoding: 'utf8', timeout: 120000 });
  } catch (e) { log('git push失敗(継続): ' + (e && e.message || '').slice(0, 120)); }
}

// ---- 調整手(cond→param→候補)。ハンドオフ由来のヒューリスティック。設計paramは含めない。 ----
const MOVES = [
  // ⑫click/golden 1位: 金の序盤支配を抑える / タップ主役を押し上げる
  { name: 'goldenDirect.coef', re: /(goldenDirect:\s*\{\s*coef:\s*)([0-9.]+)/, cands: d => [d * 0.8, d * 1.15] },
  { name: 'golden.instantCoef', re: /(instantCoef:\s*)([0-9.]+)/, cands: d => [d * 0.8, d * 1.1] },
  { name: 'tapDirect.clickBonus', re: /(tapDirect:[^}]*?clickBonus:\s*)([0-9.]+)/, cands: d => [d * 1.2, d * 0.85] },
  { name: 'tapDirect.satMax', re: /(tapDirect:[^}]*?\bsatMax:\s*)([0-9.]+)/, cands: d => [d * 1.25, d * 0.8] },
  // ㉘: 討伐/設備の主役押し上げ
  { name: 'killValMul.balanced', re: /(killValMul:\s*\{\s*balanced:\s*)([0-9.]+)/, cands: d => [d * 1.1, d * 0.9] },
  { name: 'equipDirect.coef', re: /(equipDirect:\s*\{\s*coef:\s*)([0-9.]+)/, cands: d => [d * 1.2, d * 0.85] },
  { name: 'huntDirect.coef', re: /(huntDirect:\s*\{\s*coef:\s*)([0-9.]+)/, cands: d => [d * 1.2, d * 0.85] },
];

function evalAll() {
  // 重い評価: baseline(④/T1)+expect(⑫③⑨)+income(②㉘)。いずれか実行不能なら null(=不採用)。
  const bl = scoreBaseline(); if (!bl) return null;
  const ex = scoreExpect(); if (!ex) return null;
  const inc = scoreIncome(); if (!inc) return null;
  return totalScore([bl, ex, inc]);
}

function main() {
  log('=== autotune 開始 ' + new Date().toISOString() + ' ===');
  try { fs.copyFileSync(PARAMS, PARAMS + '.autotune.bak'); } catch (e) {}
  let base = evalAll();
  if (!base) { log('初期 baseline 門番NG。中断。'); return; }
  log(`初期スコア=${base.sc} detail=${JSON.stringify(base.detail)}`);
  let round = 0;
  while (true) {
    round++;
    let improvedAny = false;
    for (const mv of MOVES) {
      const cur = getNum(readParams(), mv.re);
      if (cur == null) { log(`SKIP ${mv.name}(未検出)`); continue; }
      let bestVal = cur, best = base;
      for (const cand of mv.cands(cur)) {
        fs.writeFileSync(PARAMS, setNum(readParams(), mv.re, cand));
        const sc = evalAll();
        if (isSafeImprovement(sc, best)) { best = sc; bestVal = cand; }
      }
      fs.writeFileSync(PARAMS, setNum(readParams(), mv.re, bestVal));
      if (best.sc > base.sc) {
        base = best; improvedAny = true;
        fs.writeFileSync(__dirname + '/results/autotune_state.json', JSON.stringify({ round, score: base.sc, detail: base.detail, at: new Date().toISOString() }, null, 2));
        log(`採用 ${mv.name}: ${cur}→${bestVal} スコア→${base.sc} ${JSON.stringify(base.detail)}`);
        gitCommitPush(`autotune: ${mv.name} ${cur}→${bestVal} (score ${base.sc}・${JSON.stringify(base.detail)})`);
      } else {
        log(`据置 ${mv.name}=${cur}(安全な改善なし)`);
      }
    }
    log(`--- round ${round} 終了 スコア=${base.sc} ${JSON.stringify(base.detail)} ---`);
    if (!improvedAny) { log('巡回で改善ゼロ=局所最適。300秒待機後に再巡回。'); try { execSync('sleep 300'); } catch (e) {} }
  }
}
try { main(); } catch (e) { log('FATAL: ' + (e && e.message)); }
