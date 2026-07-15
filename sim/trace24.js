const G=require('./sim.js');const S=require('./strategies.js');
for(const id of ['S1','S6','S9']){
  const sim=G.simulate(S.STRATEGIES.find(s=>s.id===id),{hours:24});
  const full=sim.runs.filter(r=>!r.partial);
  let ok4=0; for(let i=1;i<full.length;i++) if(full[i].runCookies>=1e8*full[i-1].runCookies) ok4++;
  // 新6: doubling per 180s sample
  let d=0,da=0; for(const r of full){const cs=r.cpsSamples||[];for(let i=1;i<cs.length;i++){if(cs[i-1]>0){da++;if(cs[i]>=2*cs[i-1])d++;}}}
  const durs=full.map(r=>Math.round(r.duration));
  const maxCk=Math.max(...full.map(r=>r.runCookies));
  let t1=0; for(const r of full) if(r.duration>=1200&&r.duration<=7200)t1++;
  console.log(`${id}: 周回=${sim.runs.length} full=${full.length} ④=${ok4}/${Math.max(0,full.length-1)} 新⑥=${d}/${da} T1=${t1}/${full.length} maxRunCk=${maxCk.toExponential(1)} durs=[${durs.slice(0,12).join(',')}]`);
}
