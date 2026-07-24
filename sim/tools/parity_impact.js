// F6のsim先行measurement: 設備base乖離(oven/factory/spiceRack)がsim経済にどれだけ効くかを、
// sim値 vs game値で同一戦略を回して比較(初転生時刻・30h内の周回数・最終cookies)。ゲームは触らない・in-memoryパッチのみ。
const G=require('../sim.js');
const { STRATEGIES }=require('../strategies.js');
const GAME_BASE={oven:520, factory:7200, spiceRack:215000}; // 実ゲーム値(index.html)
const SIM_BASE={}; for(const id of Object.keys(GAME_BASE)){const u=G.UPGRADES.find(x=>x.id===id); SIM_BASE[id]=u?u.base:null;}
function setBases(map){ for(const id of Object.keys(map)){const u=G.UPGRADES.find(x=>x.id===id); if(u&&map[id]!=null)u.base=map[id];} }
const HOURS=Number(process.env.HOURS||30);
const SIDS=(process.env.SIDS||'S1,S2,S3,S4').split(',');
function measure(label){
  const out=[];
  for(const sid of SIDS){ const s=STRATEGIES.find(x=>x.id===sid); if(!s){out.push(sid+'=?');continue;}
    let sim; try{ sim=G.simulate(s,{hours:HOURS}); }catch(e){ out.push(sid+'=ERR:'+e.message.slice(0,40)); continue; }
    const runs=sim.runs.filter(r=>!r.partial);
    const fp=runs[0]?Math.round(runs[0].endT):-1;
    const nRuns=runs.length;
    out.push(`${sid}: 初転生=${fp>=0?(fp/60).toFixed(1)+'分':'未'} 周回数=${nRuns}`);
  }
  console.log(label+':'); out.forEach(o=>console.log('  '+o));
}
console.log(`SIM base: ${JSON.stringify(SIM_BASE)}  |  GAME base: ${JSON.stringify(GAME_BASE)}  |  ${HOURS}h ${SIDS.join(',')}`);
setBases(SIM_BASE); measure('A) sim値(現状=安い)');
setBases(GAME_BASE); measure('B) game値(実際=高い)');
