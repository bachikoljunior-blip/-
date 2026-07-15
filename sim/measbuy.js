const P=require('./params.js'); P.msResearch.momBuyDiv=1e12; // momentum≈1で中立化して素の購入数を測る
const G=require('./sim.js');const S=require('./strategies.js');
const fs=require('fs');const f='/tmp/claude-0/-home-user-exist-debug/58c046c8-0330-580f-85fb-88f9e367810e/scratchpad/measbuy.out';
fs.writeFileSync(f,'');
const sim=G.simulate(S.STRATEGIES.find(s=>s.id==='S1'),{hours:24});
const full=sim.runs.filter(r=>!r.partial);
const mb=full.map(r=>r.momBuys||0);
fs.appendFileSync(f,`runs=${full.length} momBuys per run: ${mb.slice(0,8).join(',')}  ... median=${mb.sort((a,b)=>a-b)[Math.floor(mb.length/2)]}\n`);
fs.appendFileSync(f,'DONE\n');
