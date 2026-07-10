'use strict';
// T1診断: 各周回の時間と、下限(20分)/上限(2時間)からの距離。どの周回帯が谷か。
// 使い方: node diag_t1.js <hours> <SID>
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const hours = Number(process.argv[2] || 100);
const only = process.argv[3] || 'S3';
for (const s of STRATEGIES) {
  if (only && s.id !== only) continue;
  const sim = G.simulate(s, { hours });
  const full = sim.runs.filter(r => !r.partial);
  let ok = 0;
  const bad = [];
  for (const r of full) {
    const m = r.duration / 60;
    const pass = r.duration >= 1200 && r.duration <= 7200;
    if (pass) ok++; else bad.push(r);
    console.log(`${pass ? 'OK' : 'NG'} run${String(r.idx).padStart(2)} ${m.toFixed(1)}m gain=${(r.gain || 0).toExponential(1)} 目標到達=${r.gainToNext != null ? r.gainToNext.toFixed(2) : '-'} maxStage=${r.maxStage}`);
  }
  console.log(`${s.id}: T1 ${ok}/${full.length}  NG周回=${bad.map(r => r.idx).join(',')}`);
}
