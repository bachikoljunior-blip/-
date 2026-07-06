'use strict';
// 値段割り(D'・2026-07-06): 研究(段1)と段階(段2/3)の値段を「1周回に中間目標1件」になるよう
// 互い違いに再配置する。時間待ちは作らない=貯金の目標として値段を置き直すだけ(すべて調整項目)。
// - 各解放ものを周回に1件ずつ割り当て(観測された解放周回より前へは動かさない=スキル・設備ゲートを尊重)
// - 目標コスト = その周回の中盤(位相0.55)の財産 × 方針の研究予算比(S1=0.30)
// - 周回数より解放ものが多い分は同じ周回に同居させ、同じ値段帯に置いて同時解放(同一秒=1件統合)を狙う
// 使い方: node weave.js [iters=3] [S1] [hours=40]
const fs = require('fs');

const ITERS = Number(process.argv[2] || 3);
const STRAT_ID = process.argv[3] || 'S1';
const HOURS = Number(process.argv[4] || 40);
const PHASE = 0.55;        // 周回内のどこで解放させたいか(0=開始,1=転生)
const BUDGET = 0.30;       // S1の研究予算比(コスト≤所持×0.30で購入)

function freshSim() {
  for (const k of Object.keys(require.cache)) {
    if (/params\.js|sim\.js|strategies\.js|rung_costs\.json|weave_costs\.json/.test(k)) delete require.cache[k];
  }
  const G = require('./sim.js');
  const { STRATEGIES } = require('./strategies.js');
  return { G, s: STRATEGIES.find(x => x.id === STRAT_ID) };
}
function dec(v) { return Math.log10(Math.max(1, v)); }

let out = (function () { try { return JSON.parse(fs.readFileSync('weave_costs.json', 'utf8')); } catch (e) { return { resCost: {}, resStageCostEach: {} }; } })();

for (let it = 0; it < ITERS; it++) {
  const { G, s } = freshSim();
  const sim = G.simulate(s, { hours: HOURS });
  const full = sim.runs.filter(r => !r.partial);
  if (full.length < 8) { console.log('周回が少なすぎて割り当て不能'); break; }
  // 解放イベント(研究・段階)の観測: firstResearchBuy / firstStageBuy
  // 対象は「初転生後」の解放のみ(第0回は専用の細かい帯域 120+8√x で既に整っているため動かさない)
  const fpT = full[0].endT;
  const items = [];
  for (const [id, t] of Object.entries(sim.firstResearchBuy)) { if (t > fpT) items.push({ kind: 'res', id, t }); }
  for (const [key, t] of Object.entries(sim.firstStageBuy)) { if (t > fpT) items.push({ kind: 'stage', id: key, t }); }
  items.sort((a, b) => a.t - b.t);
  const runIdxOf = t => { for (let i = 0; i < full.length; i++) if (t <= full[i].endT) return i; return full.length - 1; };
  // 周回スロットへ割り当て: 観測周回より前へは動かさない。空きがなければ同居
  let slot = 0; // 初転生後の周回(run1)から割り当てる
  const assign = [];
  for (const it2 of items) {
    const obsRun = runIdxOf(it2.t);
    slot = Math.max(slot + 1, obsRun);
    if (slot >= full.length) slot = full.length - 1; // 末尾は同居
    assign.push({ ...it2, run: slot });
  }
  // 目標コスト: 周回中盤の財産×予算比(財産は前周回の終値→当周回の終値を対数補間)
  let moved = 0;
  const { G: G2 } = freshSim();
  for (const a of assign) {
    const r = full[a.run];
    const decEnd = dec(r.runCookies);
    const decStart = a.run > 0 ? dec(full[a.run - 1].runCookies) - 2.0 : 4;
    const target = Math.pow(10, decStart + (decEnd - decStart) * PHASE) * BUDGET;
    if (a.kind === 'res') {
      const cur = out.resCost[a.id] || require('./params.js').resCost[a.id];
      if (Math.abs(Math.log10(target / cur)) > 0.15) { out.resCost[a.id] = Math.round(target); moved++; }
    } else {
      const [rid, st] = a.id.split(':');
      const base = out.resCost[rid] || require('./params.js').resCost[rid];
      const mult = Math.max(2, target / base);
      out.resStageCostEach[rid] = out.resStageCostEach[rid] || {};
      const key = st === '2' ? 's2' : 's3';
      const cur = out.resStageCostEach[rid][key];
      if (!cur || Math.abs(Math.log10(mult / cur)) > 0.15) { out.resStageCostEach[rid][key] = mult; moved++; }
    }
  }
  fs.writeFileSync('weave_costs.json', JSON.stringify(out, null, 1));
  // 検証: ⑥の帯域適合(この方針)
  const { G: G3, s: s3 } = freshSim();
  const sim3 = G3.simulate(s3, { hours: HOURS });
  const ev = [];
  for (const e of sim3.unlockEvents.slice().sort((x, y) => x.t - y.t)) {
    if (ev.length && ev[ev.length - 1] === e.t) continue;
    ev.push(e.t);
  }
  const r0 = sim3.runs[0];
  const fp = (r0 && !r0.partial) ? r0.endT : Infinity;
  const Y = x => x >= fp ? 1440 + 3 * Math.sqrt(x) : 120 + 8 * Math.sqrt(x);
  let ok = 0, all = 0;
  for (let i = 0; i + 1 < ev.length; i++) {
    const gap = ev[i + 1] - ev[i]; const yy = Y(ev[i + 1]);
    all++; if (gap >= 0.5 * yy && gap <= yy) ok++;
  }
  console.log(`[weave ${it}] 対象${items.length}件 移動${moved}件 → ⑥ ${ok}/${all}`);
  if (!moved) break;
}
console.log('saved weave_costs.json');
