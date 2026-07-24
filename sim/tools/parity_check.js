const fs=require('fs');
const html=fs.readFileSync('/home/user/exist-debug/index.html','utf8');
const sim=fs.readFileSync('/home/user/exist-debug/sim/sim.js','utf8');
const game={}; let x;
const gre=/id:\s*"(\w+)",\s*name:\s*"[^"]*",\s*type:\s*"cps",\s*value:\s*([\d.]+),\s*base:\s*([\d.]+),\s*growth:\s*([\d.]+)/g;
while((x=gre.exec(html))){game[x[1]]={value:+x[2],base:+x[3],growth:+x[4]};}
const simM={};
const sre=/id:\s*'(\w+)',\s*type:\s*'cps',\s*value:\s*([\d.]+),\s*base:\s*([\d.]+),\s*growth:\s*([\d.]+)/g;
while((x=sre.exec(sim))){simM[x[1]]={value:+x[2],base:+x[3],growth:+x[4]};}
const ids=[...new Set([...Object.keys(game),...Object.keys(simM)])];
let diffs=0;
for(const id of ids){const g=game[id],s=simM[id];
  if(!g||!s){console.log('  '+id+': '+(g?'game-only':'sim-only'));continue;}
  const bd=g.base!==s.base,gd=g.growth!==s.growth,vd=g.value!==s.value;
  if(bd||gd||vd){diffs++;console.log('DIVERGE '+id+': base sim='+s.base+' game='+g.base+(bd?' ✗':'')+' | growth sim='+s.growth+' game='+g.growth+(gd?' ✗':'')+' | value sim='+s.value+' game='+g.value+(vd?' ✗':''));}
}
console.log('\ncps-buildings matched on all fields: '+(ids.length-diffs)+'/'+ids.length+', divergent: '+diffs);
