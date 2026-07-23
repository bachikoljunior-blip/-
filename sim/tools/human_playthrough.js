// 実プレイ実況(一般的な人間プレイヤー・実プレイと同じ結果を短時間で):
//  ・能動セッション=通常刻みでタップ/討伐/報酬/金/購入/研究(=手を動かす所は本物どおり)
//  ・放置区間=ゲーム自身のoffline式 earn(baseCps×秒) を直呼びで一発適用(reload不要=激安)
//    →「遊ぶ→離れる→戻る」の実プレイと同じ結果に、実時間の数百分の一のwallで到達する。
//  各操作を発生順に記録(連続同操作まとめ・画像は最後の場面・累積現実プレイ時間+回数)。native 430x780。
// 実行: OUT=/out node sim/tools/human_playthrough.js → 001.jpg.. + ops.json
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path=require('path'), os=require('os');
const now=()=>Number(require('process').hrtime.bigint())/1e6;
const INDEX=process.env.GAME_INDEX||path.resolve(__dirname,'../../index.html');
const DIR=process.env.OUT||path.join(os.tmpdir(),'human_playthrough');
const MAXBLK=Number(process.env.MAXBLK||150);
const WALLCAP=Number(process.env.WALLCAP||1200)*1000;
const TPS=Number(process.env.TPS||5);            // 人間の連続タップ(毎秒)
const IDLE_MIN=Number(process.env.IDLE_MIN||30); // 1回の放置=分
const fs=require('fs'); try{fs.mkdirSync(DIR,{recursive:true});}catch(e){}
(async()=>{
  const b=await chromium.launch({executablePath:process.env.PW_CHROMIUM||'/opt/pw-browsers/chromium',headless:true});
  const p=await b.newPage({viewport:{width:430,height:780}});
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.clock.install();
  await p.goto('file://'+INDEX,{waitUntil:'load',timeout:60000});
  await p.clock.runFor(1500);
  await p.click('#audioGate').catch(()=>{}); await p.clock.runFor(700);
  await p.click('#titleStartBtn').catch(()=>{}); await p.clock.runFor(800);
  await p.evaluate(()=>{try{buyMode="1";}catch(e){}});

  const L=[]; let shotN=0;
  const gt=async()=>p.evaluate(()=>{try{return Math.round(state.totalPlaySec||0);}catch(e){return 0;}});
  const fmtT=s=>{s=Math.round(s);const h=Math.floor(s/3600),m=Math.floor(s%3600/60),ss=s%60;return (h?h+'時間':'')+((m||h)?m+'分':'')+ss+'秒';};
  const rec=async(op,inc)=>{ inc=(inc==null?1:inc); const t=await gt(); const last=L[L.length-1];
    if(last&&last.op===op){ last.count+=inc; last.t=fmtT(t); await p.screenshot({path:DIR+'/'+last.n+'.jpg',type:'jpeg',quality:50}); return; }
    shotN++; const nm=String(shotN).padStart(3,'0'); await p.screenshot({path:DIR+'/'+nm+'.jpg',type:'jpeg',quality:50}); L.push({n:nm,t:fmtT(t),op,count:inc}); };
  const recRaw=async(op)=>{ const t=await gt(); shotN++; const nm=String(shotN).padStart(3,'0'); await p.screenshot({path:DIR+'/'+nm+'.jpg',type:'jpeg',quality:50}); L.push({n:nm,t:fmtT(t),op,count:0}); };

  await rec('タイトルから開始',0);
  for(let i=0;i<12;i++)await p.click('#cookie').catch(()=>{});
  await rec('クッキーをタップ',12);

  const snap=async()=>p.evaluate(()=>({sec:Math.round(state.totalPlaySec||0),cookies:Number(state.cookies.toString()),cps:Number(currentCps().toString()),
    unlocked:!!(prestigeUnlocked&&prestigeUnlocked()),gain:(prestigeGain?Number(prestigeGain()):0),cost:(prestigeCookieCost?Number(prestigeCookieCost()):0),
    runs:state.prestigeRuns||0,skills:Object.values(state.skills||{}).filter(Boolean).length,
    stage:state.stageUnlocked||1,kills:state.monstersDefeated||0,qfail:!!state.quotaFailed}));

  // 能動1刻み(発生順): 討伐→報酬→金→研究→設備→タップ。bank=貯蓄中は設備を買わない。
  const stepActions=async(tapN,bank)=>p.evaluate(({tapN,bank})=>{
    const out=[]; const add=(l,c)=>{ if(c>0)out.push([l,c]); };
    if(typeof monsters!=='undefined'&&monsters&&monsters.length&&hitMonster){ const b4=state.monstersDefeated||0; for(const m of monsters.slice())for(let k=0;k<200&&monsters.indexOf(m)>=0;k++)hitMonster(m.id); add('モンスターを討伐',(state.monstersDefeated||0)-b4); }
    { let c=0; for(let n=0;n<12;n++){ if(!(rewardModalOpen&&rewardModalOpen()))break; revealRewardChoices&&revealRewardChoices(); if(pendingRewardChoices&&pendingRewardChoices.length){chooseReward(pendingRewardChoices[0]);c++;}else break; } add('討伐報酬を選択',c); }
    if(typeof goldenVisible!=='undefined'&&goldenVisible&&collectGoldenCookie){collectGoldenCookie();add('金クッキーを回収',1);}
    if(typeof RESEARCH!=='undefined')for(const r of RESEARCH){try{ if(!state.research[r.id]&&(typeof researchUnlocked!=='function'||researchUnlocked(r))&&state.cookies.gte(D(r.cost))){ buyResearch(r.id); add('研究「'+r.name+'」を購入',1);} }catch(e){}}
    if(!bank){ const agg={},order=[]; for(let step=0;step<400;step++){ let best=null,bestR=0,bestC=null;
        for(const u of UPGRADES){ if(typeof upgradeUnlocked==='function'&&!upgradeUnlocked(u))continue; let c;try{c=costOf(u);}catch(e){continue;} const cn=Number(c.toString()); if(!isFinite(cn)||cn<=0)continue; const r=(u.value||1)/cn; if(r>bestR){bestR=r;best=u;bestC=cn;} }
        if(!best||!state.cookies.gte(bestC))break; const b4=state.upgrades[best.id]||0; buyUpgrade(best.id); const bt=(state.upgrades[best.id]||0)-b4; if(bt<=0)break; if(agg[best.id]===undefined){agg[best.id]=[best.name,0];order.push(best.id);} agg[best.id][1]+=bt; }
      for(const id of order)add(agg[id][0]+'を購入',agg[id][1]); }
    if(tapCookie&&tapN>0){for(let k=0;k<tapN;k++)tapCookie();add('クッキーをタップ',tapN);}
    return out;
  },{tapN,bank});

  // 放置スキップ: ゲーム自身のoffline挙動を忠実に再現。放置生産 earn(baseCps×秒) を一発適用し、
  // 放置中は「ノルマ時計を止める」(=game loadGameが quotaPausedMs += offlineMs する挙動)ので runStart は動かさない。
  // これによりノルマ経過は能動プレイ時間だけで進み、放置で貯めた runCookies で戻ったとき討伐が続く=ステージ進行が生きる。
  // クロックは進めない=Date.now基準の quotaElapsed は据え置き(=ノルマ時計が放置中は止まる、というゲーム挙動と一致)。
  const idleSkip=async(sec)=>p.evaluate((sec)=>{ const before=state.cookies; earn(D(baseCps()).mul(sec)); state.totalPlaySec=(state.totalPlaySec||0)+sec; const g=state.cookies.sub(before); return (typeof fmt==='function')?fmt(g):String(g); },sec);
  const takeSkills=async()=>{ const names=await p.evaluate(()=>{ const got=[];
      // 実プレイヤの購入判断: 生産を伸ばすスキル(全生産>毎秒>タップ>開始クッキー>放置)を優先して取る。
      const score=(s)=>{ let v=0; for(const e of (s.effects||[])){ const t=e.type, val=Number(e.value)||0; if(t==='all')v+=val*1000; else if(t==='cps'||t==='cpsMul')v+=val*100; else if(t==='click')v+=val*40; else if(t==='startCookies')v+=Math.log10(Math.max(10,val))*30; else if(t==='offlineHours')v+=val*20; else if(t==='goldenAmount'||t==='goldenMul')v+=val*15; else v+=1; } return v; };
      if(typeof SKILLS!=='undefined'&&skillCanBuy){ for(let n=0;n<80;n++){ const cand=SKILLS.filter(x=>skillCanBuy(x)); if(!cand.length)break; cand.sort((a,b)=>score(b)-score(a)); const s=cand[0]; selectSkill(s.id); takeSelectedSkill(); got.push(s.name||s.id);} }
      // 「この構成でスタート」= 周回を開始してスキル選択の一時停止を解除(=次周回の建て直しが動く)
      try{ if(typeof beginRunAfterSkills==='function' && state.awaitingSkillChoice) beginRunAfterSkills(); }catch(e){}
      return got; }); for(const nm of names)await rec('スキル「'+nm+'」を取得',1); return names.length; };

  const wall0=now(); let reason='blkcap', banking=false, runStartSec=0;
  for(let i=0;i<3000;i++){
    let s=await snap();
    // 転生: 貯蓄が実って cookies>=cost なら転生→スキル。転生後は新しい周回の頭出し(能動で建て直す)。
    if(s.unlocked&&s.gain>0&&s.cookies>=s.cost){ const pr=await p.evaluate(()=>{try{if(state.cookies.gte(prestigeCookieCost())&&prestigeGain()>0){prestigeReset();return 1;}}catch(e){}return 0;}); if(pr){ await rec('転生(スキルツリー解放)',1); await takeSkills(); banking=false; s=await snap(); runStartSec=s.sec; } }
    if(!banking&&s.gain>0&&(s.cookies+s.cps*(IDLE_MIN*60))>=s.cost) banking=true;

    // 能動(通常刻み)= 周回頭の5分 or 生産がまだ立ち上がってない間(放置しても+0の区間)。それ以外は放置スキップ。
    const activePhase = (s.sec - runStartSec) < 300 || s.cps <= 0;
    if(activePhase){
      // 序盤(最初の5分)=能動を通常刻みで丁寧に(初出の一手ずつ)
      await p.clock.runFor(8000);
      const acts=await stepActions(Math.round(8*TPS),false);
      for(const [label,cnt] of acts) await rec(label,cnt);
    } else {
      // 以降=人間の「放置→戻ってプレイ」: 放置スキップ(一発) → 能動1セッション
      // 周回が進むほど放置を長めに(=繰り返しの周回を可視範囲に圧縮。人間も慣れると長く離れる)
      const idleMin = IDLE_MIN * (s.runs>=2 ? 8 : s.runs>=1 ? 3 : 1);
      const g=await idleSkip(idleMin*60);
      const lbl = idleMin>=120 ? `放置 ${Math.round(idleMin/60)}時間（+${g}）` : `放置 ${idleMin}分（+${g}）`;
      await recRaw(lbl);
      // 戻ってきてプレイ: まず設備/研究/タップ(通常刻み)。
      await p.clock.runFor(6000);
      const acts=await stepActions(Math.round(6*TPS),banking);
      for(const [label,cnt] of acts) await rec(label,cnt);
      // ステージ未踏破なら「戻ってきた分の討伐」: 放置で貯めた runCookies でノルマ済みのモンスターを狩る。
      // 能動時間(quotaElapsed)は伸びるが runCookies>>quota の間は湧き続ける=ステージ進行が動く。
      if(s.stage<6){ let killedAny=0;
        for(let h=0;h<12;h++){ await p.clock.runFor(4000);
          const k=await p.evaluate(()=>{ for(let n=0;n<10;n++){if(!(rewardModalOpen&&rewardModalOpen()))break;revealRewardChoices&&revealRewardChoices();if(pendingRewardChoices&&pendingRewardChoices.length)chooseReward(pendingRewardChoices[0]);else break;}
              let c=0; if(typeof monsters!=='undefined'&&monsters&&monsters.length&&hitMonster){const b4=state.monstersDefeated||0;for(const m of monsters.slice())for(let z=0;z<300&&monsters.indexOf(m)>=0;z++)hitMonster(m.id);c=(state.monstersDefeated||0)-b4;} return c; });
          killedAny+=k; if(k===0&&h>=3)break; }
        if(killedAny)await rec('モンスターを討伐',killedAny);
        const rw=await p.evaluate(()=>{let c=0;for(let n=0;n<20;n++){if(!(rewardModalOpen&&rewardModalOpen()))break;revealRewardChoices&&revealRewardChoices();if(pendingRewardChoices&&pendingRewardChoices.length){chooseReward(pendingRewardChoices[0]);c++;}else break;}return c;});
        if(rw)await rec('討伐報酬を選択',rw);
      }
    }
    const s2=await gt();
    if(L.length>=MAXBLK){reason='blkcap';break;}
    if((now()-wall0)>WALLCAP){reason='wallcap';break;}
    if(i%5===0){ try{fs.writeFileSync(DIR+'/ops.json',JSON.stringify(L,null,1));}catch(e){}
      console.log(`i=${i} ${fmtT(s2)} blk=${L.length} bank=${banking} runs=${s.runs} sk=${s.skills} cps=${s.cps.toExponential(1)} stg=${s.stage} kills=${s.kills} qf=${s.qfail} wall=${((now()-wall0)/1000).toFixed(0)}s`); }
  }
  fs.writeFileSync(DIR+'/ops.json',JSON.stringify(L,null,1));
  const fin=await snap();
  console.log('DONE reason='+reason,'blocks='+L.length,'runs='+fin.runs,'skills='+fin.skills,'lastT='+(L.length?L[L.length-1].t:'-'),'errors='+errs.length);
  await b.close();
})().catch(e=>{console.error('FATAL',e.message,e.stack);process.exit(1);});
