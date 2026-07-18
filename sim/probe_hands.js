// probe3: accA v4 goldenAmtMul の必要増分を特定(S6 run3束lift 1.351→1.5)
const G = require('./sim.js');
const { STRATEGIES } = require('./strategies.js');
const H = 100;
const st = STRATEGIES.find(s => s.id === 'S6');
const sim = G.simulate(st, { hours: H, snapshots: true });
const acq = sim.runs.filter(r => !r.partial && (r.eq2NewEquipped || []).includes('hands_t1_v2') && r.runCookies > 0 && sim.snapshots[r.idx]);
const T = G.EQUIP2_FX_TABLE();
for (const r of acq) {
  const snap = sim.snapshots[r.idx];
  for (const v of [1.6, 1.7, 1.8, 1.9, 2.0]) {
    T.accA[3].up[1] = v;
    const on = G.replayRun(st, snap, { hours: H }, r.duration);
    const off = G.replayRun(st, snap, { hours: H, noNewEquip: true }, r.duration);
    const ratio = (on && off && off.runCookies > 0) ? on.runCookies / off.runCookies : NaN;
    console.log(`run${r.idx} accA_v4 goldenAmtMul=${v} lift=${ratio.toFixed(4)}`);
  }
  T.accA[3].up[1] = 1.6;
}
