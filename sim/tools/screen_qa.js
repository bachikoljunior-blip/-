// 各画面(タブ)の見た目QA harness: native 430×780で全タブを撮る。見切れ/空表示/潰れを目視で洗うための再現機構。
// 実行: OUT=/out node sim/tools/screen_qa.js  → /out に shopTab.png..(6タブ)。深部タブはdebugでunlockして描画確認。
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path=require('path'), os=require('os'), fs=require('fs');
const INDEX=process.env.GAME_INDEX||path.resolve(__dirname,'../../index.html');
const DIR=process.env.OUT||path.join(os.tmpdir(),'screen_qa'); fs.mkdirSync(DIR,{recursive:true});
(async()=>{
  const b=await chromium.launch({executablePath:process.env.PW_CHROMIUM||'/opt/pw-browsers/chromium',headless:true});
  const p=await b.newPage({viewport:{width:430,height:780}});
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.clock.install();
  await p.goto('file://'+INDEX,{waitUntil:'load',timeout:60000});
  await p.clock.runFor(1500);
  await p.click('#audioGate').catch(()=>{}); await p.clock.runFor(700);
  await p.click('#titleStartBtn').catch(()=>{}); await p.clock.runFor(1000);
  // 描画確認用に debug で各システムを解禁+資源付与(経済の真正性でなくレイアウトを見る)
  await p.evaluate(()=>{ try{
    debugMode=true; state.workshopUnlocked=true; state.skills=state.skills||{};
    ['core','economy_1','economy_analysis','order_board','monster_1','workshop_1'].forEach(id=>state.skills[id]=true);
    state.materials=state.materials||{}; state.materialsSeen=state.materialsSeen||{};
    ['butter','flour','cacao','mint','frostSugar','ironShard','spice','universal'].forEach(m=>{state.materials[m]=99;state.materialsSeen[m]=true;});
    for(let t=1;t<=6;t++)state.materials['ore_t'+t]=999;
    state.cookies=D(1e15); state.runCookies=D(1e15);
    if(typeof ensureActiveOrder==='function')ensureActiveOrder();
    if(typeof renderAllTabs==='function')renderAllTabs();
  }catch(e){console.log('SETUP',e.message);} });
  await p.clock.runFor(800);
  for(const id of ['shopTab','researchTab','prestigeTab','orderTab','workshopTab','infoTab']){
    await p.evaluate((id)=>{try{switchTab(id);}catch(e){}},id);
    await p.clock.runFor(600);
    await p.screenshot({path:DIR+'/'+id+'.png'});
    console.log('captured',id);
  }
  console.log('DONE errors:',errs.length,errs.slice(0,3).join(' | '));
  await b.close();
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
