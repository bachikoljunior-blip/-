'use strict';
// T2診断: 各周回の解放イベント数と内訳(どの周回が1〜3件帯を外れるか)
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const H = Number(process.argv[2] || 100);
const only = process.argv[3] || 'S7';
for (const s of STRATEGIES) {
  if (only && s.id !== only) continue;
  const sim = G.simulate(s, { hours: H });
  // 同一秒統合(runner.js mergeEventsByRun と同じ)
  const raw = (sim.unlockEvents || []).slice().sort((a, b) => a.t - b.t);
  const ev = [];
  for (const e of raw) {
    const last = ev[ev.length - 1];
    if (last && last.t === e.t) { last.id += ',' + e.id; last.kind += '+' + e.kind; continue; }
    ev.push({ t: e.t, kind: String(e.kind), id: String(e.id) });
  }
  const runs = sim.runs || [];
  const full = runs.filter(r => !r.partial);
  console.log(`--- ${s.id} ${s.name} 周回=${full.length} ---`);
  for (let i = 1; i < full.length; i++) {
    const r = full[i];
    const es = ev.filter(e => e.t >= r.startT && e.t < r.endT);
    const n = es.length;
    const mark = (n >= 1 && n <= 3) ? 'OK' : 'NG';
    const kinds = es.map(e => `${e.kind}:${e.id}`).join(' ');
    console.log(`${mark} run${String(i).padStart(2)} dur=${(r.duration / 60).toFixed(0)}m n=${n}  ${kinds}`);
  }
}
