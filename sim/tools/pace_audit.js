// F3切り分け: 各転生を「賄えるまで最大バンク」して、必要な実プレイ時間(totalPlaySec差)とcpsを記録。
// 発散(転生ごとに時間が跳ね上がる)ならBOT弱さでなく設計のゲート。強プレイ寄り(設備をmax・研究・スキル全取り)で測る。
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',headless:true});
  const p=await b.newPage({viewport:{width:430,height:780}});
  await p.clock.install();
  await p.goto('file:///home/user/exist-debug/index.html',{waitUntil:'load',timeout:60000});
  await p.clock.runFor(1500); await p.click('#audioGate').catch(()=>{}); await p.clock.runFor(700);
  await p.click('#titleStartBtn').catch(()=>{}); await p.clock.runFor(800);
  await p.evaluate(()=>{buyMode="max";for(let t=0;t<400;t++)tapCookie();});
  // 賄えるまでバンク(設備max+研究)→そのcostに必要だった実時間を測る
  const bankToAfford=async(costNum)=>p.evaluate((costNum)=>{
    const cost=D(costNum); let guard=0;
    while(state.cookies.lt(cost)&&guard<2000){ guard++;
      const bc=Math.max(1,Number(baseCps().toString()));
      // 「あと何秒でcostに届くか」を今のbaseCpsで計算し、その分だけ放置(=賄えるまで放置)
      const needMore=cost.sub(state.cookies); const sec=Math.max(3600, Math.ceil(Number(needMore.div(bc).toString())));
      earn(D(bc).mul(sec)); state.totalPlaySec=(state.totalPlaySec||0)+sec;
      for(let s=0;s<400;s++){let best=null,bR=0,bC=null;for(const u of UPGRADES){if(typeof upgradeUnlocked==='function'&&!upgradeUnlocked(u))continue;let c;try{c=costOf(u);}catch(e){continue;}const cn=Number(c.toString());if(!isFinite(cn)||cn<=0)continue;const marg=(u.type==='click')?((u.value||1)*5):(u.value||1);if(marg/cn>bR){bR=marg/cn;best=u;bC=cn;}}if(!best||!state.cookies.gte(bC))break;buyUpgrade(best.id);}
      if(typeof RESEARCH!=='undefined')for(const rr of RESEARCH){try{if(!state.research[rr.id]&&(typeof researchUnlocked!=='function'||researchUnlocked(rr))&&state.cookies.gte(D(rr.cost)))buyResearch(rr.id);}catch(e){}}
    }
    return {cps:Number(currentCps().toString()), sec:state.totalPlaySec||0};
  },costNum);
  const takeSkills=async()=>p.evaluate(()=>{if(typeof SKILLS!=='undefined'&&skillCanBuy){for(let n=0;n<80;n++){const cand=SKILLS.filter(x=>skillCanBuy(x));if(!cand.length)break;cand.sort((a,b)=>{const sc=s=>{let v=0;for(const e of(s.effects||[])){const t=e.type,val=Number(e.value)||0;if(t==='all')v+=val*1000;else if(t==='cps')v+=val*100;else v+=1;}return v;};return sc(b)-sc(a);});selectSkill(cand[0].id);takeSelectedSkill();}}try{if(state.awaitingSkillChoice)beginRunAfterSkills();}catch(e){}});
  const fmtT=s=>{s=Math.round(s);if(s>=86400)return (s/86400).toFixed(1)+'日';if(s>=3600)return (s/3600).toFixed(1)+'時間';return s+'秒';};
  let prevSec=0;
  for(let run=0; run<7; run++){
    const cost=await p.evaluate(()=>Number(String(prestigeCookieCost())));
    const r=await bankToAfford(cost);
    const dt=r.sec-prevSec; prevSec=r.sec;
    console.log(`prestige#${run}: cost=${cost.toExponential(1)} cps=${r.cps.toExponential(2)} この転生に必要な実プレイ時間=${fmtT(dt)} (累計 ${fmtT(r.sec)})`);
    const pr=await p.evaluate(()=>{try{if(prestigeUnlocked()&&prestigeGain()>0&&state.cookies.gte(D(prestigeCookieCost()))){prestigeReset();return 1;}}catch(e){}return 0;});
    if(!pr){console.log('  (prestige failed)');break;}
    await takeSkills();
  }
  await b.close();
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
