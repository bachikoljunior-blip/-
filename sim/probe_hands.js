// probe4(ユーザー質問): 装備以外でタップ/会心を強くすればhands_t1_v2のliftは1.5に届くか
// 仕組み: 装備外強化はON/OFF両枝に等しく効くため比では相殺。効き得るのは
// 「タップ比重が上がる→装着側だけの会心+3%の差分が拡大」の間接経路のみ。その実量を測る。
const G = require('./sim.js');
const P = require('./params.js');
const { STRATEGIES } = require('./strategies.js');
const H = 100;
const st = STRATEGIES.find(s => s.id === 'S6');
const sim = G.simulate(st, { hours: H, snapshots: true });
const acq = sim.runs.filter(r => !r.partial && (r.eq2NewEquipped || []).includes('hands_t1_v2') && r.runCookies > 0 && sim.snapshots[r.idx]);
const T = G.EQUIP2_FX_TABLE();
const oM = P.tapDirect.otherMul;
const base = oM.balanced;
for (const r of acq) {
  const snap = sim.snapshots[r.idx];
  for (const [tapMul, crit] of [[1, 0.03], [2, 0.03], [4, 0.03], [4, 0.3], [8, 0.3]]) {
    oM.balanced = base * tapMul;
    T.hands[1].up[1] = crit;
    const on = G.replayRun(st, snap, { hours: H }, r.duration);
    const off = G.replayRun(st, snap, { hours: H, noNewEquip: true }, r.duration);
    const ratio = (on && off && off.runCookies > 0) ? on.runCookies / off.runCookies : NaN;
    console.log(`run${r.idx} タップ投資x${tapMul} critAdd=${crit} lift=${ratio.toFixed(4)}`);
  }
  oM.balanced = base; T.hands[1].up[1] = 0.03;
}
