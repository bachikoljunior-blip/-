const fs=require('fs');const G=require('./sim.js');const S=require('./strategies.js');
const f='/tmp/claude-0/-home-user-exist-debug/58c046c8-0330-580f-85fb-88f9e367810e/scratchpad/diag2.out';
fs.writeFileSync(f,'');
for(const id of ['S1','S6','S9']){
  const sim=G.simulate(S.STRATEGIES.find(s=>s.id===id),{hours:24});
  const full=sim.runs.filter(r=>!r.partial);
  let ok4=0;for(let i=1;i<full.length;i++)if(full[i].runCookies>=1e8*full[i-1].runCookies)ok4++;
  let t1=0;for(const r of full)if(r.duration>=1200&&r.duration<=7200)t1++;
  fs.appendFileSync(f,`${id}: runs=${full.length} ④=${ok4}/${Math.max(0,full.length-1)} T1=${t1}/${full.length} total=${full.length?full[full.length-1].runCookies.toExponential(1):0}\n`);
}
fs.appendFileSync(f,'DONE\n');
