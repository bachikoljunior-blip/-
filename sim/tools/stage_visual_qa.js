// 各ステージの本編プレイ画面の見た目QA: ステージを解禁し、1つずつ移動してモンスター出現状態を撮る。
// ステージごとにテーマ(背景/色)/モンスター/クエスト表示が破綻なく・別物として描き分けられているかを目視で洗う再現機構。
// 実行: OUT=/out node sim/tools/stage_visual_qa.js → stage1.png..stageN.png + pageエラー数。
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path=require('path'), os=require('os'), fs=require('fs');
const INDEX=process.env.GAME_INDEX||path.resolve(__dirname,'../../index.html');
const DIR=process.env.OUT||path.join(os.tmpdir(),'stage_visual_qa'); fs.mkdirSync(DIR,{recursive:true});
(async()=>{
  const b=await chromium.launch({executablePath:process.env.PW_CHROMIUM||'/opt/pw-browsers/chromium',headless:true});
  const p=await b.newPage({viewport:{width:430,height:780}});
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.clock.install();
  await p.goto('file://'+INDEX,{waitUntil:'load',timeout:60000});
  await p.clock.runFor(1500);
  await p.click('#audioGate').catch(()=>{}); await p.clock.runFor(700);
  await p.click('#titleStartBtn').catch(()=>{}); await p.clock.runFor(1000);
  // 見た目確認用に debug で全ステージ解禁+資源付与(経済の真正性でなくテーマ描き分けを見る)
  const maxNo=await p.evaluate(()=>{ try{ debugMode=true;
    state.cookies=D(1e30); state.runCookies=D(1e30);
    state.stageUnlocked=(typeof MAX_STAGE_NO!=='undefined')?MAX_STAGE_NO:6;
    if(typeof applyStageTheme==='function')applyStageTheme();
    return state.stageUnlocked; }catch(e){return 1;} });
  const shots=[];
  for(let s=1; s<=maxNo; s++){
    const info=await p.evaluate((s)=>{ try{
      state.stage=s; if(typeof applyStageTheme==='function')applyStageTheme();
      if(typeof switchTab==='function')switchTab('shopTab');
      // 前ステージのモンスターをゲーム自身の討伐経路で消す(debug=高火力で1撃→DOM除去)→各ステージは1体だけ表示。
      if(typeof monsters!=='undefined'&&Array.isArray(monsters)&&typeof hitMonster==='function'){
        for(const m of monsters.slice())for(let z=0;z<50&&monsters.indexOf(m)>=0;z++)hitMonster(m.id);
        for(let n=0;n<8;n++){if(!(typeof rewardModalOpen==='function'&&rewardModalOpen()))break;revealRewardChoices&&revealRewardChoices();if(pendingRewardChoices&&pendingRewardChoices.length)chooseReward(pendingRewardChoices[0]);else break;}
      }
      // モンスターを出す(出現状態のテーマ+敵を撮る)
      if(typeof showMonster==='function')showMonster('normal');
      if(typeof updateTopOnly==='function')updateTopOnly();
      if(typeof renderActiveTab==='function')renderActiveTab();
      return {name:(typeof stageInfo==='function'?stageInfo(s).name:'?'), cur:(typeof currentStageNo==='function'?currentStageNo():s), mon:(typeof monsters!=='undefined'&&monsters?monsters.length:0)};
    }catch(e){return {err:e.message};} }, s);
    await p.clock.runFor(600);
    const nm='stage'+s;
    await p.screenshot({path:DIR+'/'+nm+'.png'});
    shots.push({s, ...info});
    console.log(`stage ${s}: name=${info.name} cur=${info.cur} mon=${info.mon}${info.err?' ERR '+info.err:''}`);
  }
  console.log('DONE stages='+maxNo,'pageerrors='+errs.length, errs.slice(0,3).join(' | '));
  fs.writeFileSync(DIR+'/stages.json',JSON.stringify(shots,null,1));
  await b.close();
})().catch(e=>{console.error('FATAL',e.message,e.stack);process.exit(1);});
