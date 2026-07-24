// 転生タイミング修正の検証: 各周回でcpsを cost/500(校正の意図値)まで積んでから転生する。
// これで cps成長が~1e8×/回(設計意図)へ寄るか、深部が正当な時間で到達するかを測る。
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',headless:true});
  const p=await b.newPage({viewport:{width:430,height:780}});
  await p.clock.install();
  await p.goto('file:///home/user/exist-debug/index.html',{waitUntil:'load',timeout:60000});
  await p.clock.runFor(1500); await p.click('#audioGate').catch(()=>{}); await p.clock.runFor(700);
  await p.click('#titleStartBtn').catch(()=>{}); await p.clock.runFor(800);
  await p.evaluate(()=>{buyMode="max";for(let t=0;t<400;t++)tapCookie();});
  // cpsが target に届くまで「放置→設備max→研究」を繰り返す(idle-skipでbaseCps分を稼ぐ)
  const buildToCps=async(target)=>p.evaluate((target)=>{
    let guard=0;
    while(Number(currentCps().toString())<target && guard<400){ guard++;
      const bc=Math.max(1,Number(baseCps().toString())); const sec=Math.max(600,3600*4);
      earn(D(bc).mul(sec)); state.totalPlaySec=(state.totalPlaySec||0)+sec;
      for(let s=0;s<400;s++){let best=null,bR=0,bC=null;for(const u of UPGRADES){if(typeof upgradeUnlocked==='function'&&!upgradeUnlocked(u))continue;let c;try{c=costOf(u);}catch(e){continue;}const cn=Number(c.toString());if(!isFinite(cn)||cn<=0)continue;const marg=(u.type==='click')?((u.value||1)*5):(u.value||1);if(marg/cn>bR){bR=marg/cn;best=u;bC=cn;}}if(!best||!state.cookies.gte(bC))break;buyUpgrade(best.id);}
      if(typeof RESEARCH!=='undefined')for(const rr of RESEARCH){try{if(!state.research[rr.id]&&(typeof researchUnlocked!=='function'||researchUnlocked(rr))&&state.cookies.gte(D(rr.cost)))buyResearch(rr.id);}catch(e){}}
    }
    return {cps:Number(currentCps().toString()), rc:Number(state.runCookies.toString()), sec:state.totalPlaySec||0};
  },target);
  const takeSkills=async()=>p.evaluate(()=>{if(typeof SKILLS!=='undefined'&&skillCanBuy){for(let n=0;n<80;n++){const cand=SKILLS.filter(x=>skillCanBuy(x));if(!cand.length)break;cand.sort((a,b)=>{const sc=s=>{let v=0;for(const e of(s.effects||[])){const t=e.type,val=Number(e.value)||0;if(t==='all')v+=val*1000;else if(t==='cps')v+=val*100;else v+=1;}return v;};return sc(b)-sc(a);});selectSkill(cand[0].id);takeSelectedSkill();}}try{if(state.awaitingSkillChoice)beginRunAfterSkills();}catch(e){}});
  const fmtT=s=>{s=Math.round(s);if(s>=86400)return (s/86400).toFixed(1)+'日';if(s>=3600)return (s/3600).toFixed(1)+'時間';return s+'秒';};
  let prevSec=0, prevCps=0;
  for(let run=0; run<7; run++){
    const cost=await p.evaluate(()=>Number(String(prestigeCookieCost())));
    const target=cost/500; // 校正の意図cps
    const r=await buildToCps(target);
    const dt=r.sec-prevSec; prevSec=r.sec; const growth=prevCps?(r.cps/prevCps):0; prevCps=r.cps;
    console.log(`run#${run}: 目標cps=${target.toExponential(1)} 到達cps=${r.cps.toExponential(2)} 成長=${growth?growth.toExponential(1)+'×':'-'} この周回=${fmtT(dt)} (累計${fmtT(r.sec)})`);
    const pr=await p.evaluate(()=>{try{const c=D(prestigeCookieCost());if(state.cookies.lt(c)){const bc=Math.max(1,Number(baseCps().toString()));const need=c.mul(1.2).sub(state.cookies);const sec=Math.max(0,Number(need.div(bc).toString()));earn(D(bc).mul(Math.ceil(sec)));state.totalPlaySec=(state.totalPlaySec||0)+Math.ceil(sec);}if(prestigeUnlocked()&&prestigeGain()>0&&state.cookies.gte(D(prestigeCookieCost()))){prestigeReset();return 1;}}catch(e){}return 0;});
    if(!pr){console.log('  (prestige failed)');break;}
    await takeSkills();
  }
  await b.close();
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
