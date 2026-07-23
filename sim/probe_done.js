// 各方針が「全スキル取得(=やること無し)」に到達する周回/時刻を測る(大きめhorizonで観測)
const G=require('./sim.js'); const {STRATEGIES}=require('./strategies.js');
const H=Number(process.argv[2]||300);
for(const sid of (process.argv.slice(3).length?process.argv.slice(3):['S1','S4','S7','S9'])){
  const s=STRATEGIES.find(x=>x.id===sid);
  const sim=G.simulate(s,{hours:H});
  const full=sim.runs.filter(r=>!r.partial);
  // 全74スキル取得済みか(署名撤去後)
  const allSkills = G.SKILL_NODES.every(n=>sim.skills[n.id]);
  const lastFull = full[full.length-1];
  const endH = (sim.runs[sim.runs.length-1].endT/3600).toFixed(1);
  console.log(`${sid}: 完了周回数=${full.length} 総スキル=${Object.keys(sim.skills).filter(k=>sim.skills[k]).length}/74 全取得=${allSkills} sim終了=${endH}h(horizon${H}h)`);
}
