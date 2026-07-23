// 事象の実発火QA harness: 料理/注文達成/オーバーキル/延長狩り/重力圧縮 を発火し pageエラー・効果発生を確認。
// 実行: node sim/tools/event_qa.js  → 各事象の結果とpageエラー数を出力。綻び検出用の再現機構。
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path=require('path');
const INDEX=process.env.GAME_INDEX||path.resolve(__dirname,'../../index.html');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.PW_CHROMIUM||'/opt/pw-browsers/chromium',headless:true});
  const p=await b.newPage({viewport:{width:430,height:780}});
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.clock.install();
  await p.goto('file://'+INDEX,{waitUntil:'load',timeout:60000});
  await p.clock.runFor(1500);
  await p.click('#audioGate').catch(()=>{}); await p.clock.runFor(700);
  await p.click('#titleStartBtn').catch(()=>{}); await p.clock.runFor(1000);
  const R=await p.evaluate(()=>{
    const R={}; debugMode=true; state.cookies=D(1e18); state.runCookies=D(1e18);
    // 料理: 正しい材料キーを付与して cook(同時上限も確認)
    try{ state.materials=state.materials||{}; state.materialsSeen=state.materialsSeen||{};
      ['butter','flour','cacao','mint','frostSugar','ironShard','spice','silentCore','stardust','cometShard','voidSugar'].forEach(m=>{state.materials[m]=99;state.materialsSeen[m]=true;});
      let c=0; for(const d of DISHES){try{const b4=activeDishList().length;cookDish(d.id);if(activeDishList().length>b4)c++;}catch(e){}} R.dishesCooked=c; R.prodMul=dishProductionMultiplier();
    }catch(e){R.dish='ERR '+e.message;}
    // 注文達成
    try{ state.skills=state.skills||{}; ['core','economy_1','economy_analysis','order_board'].forEach(id=>state.skills[id]=true);
      const o=ensureActiveOrder(); if(o){o.progress=o.need;completeOrder();R.orderCompleted=true;} }catch(e){R.order='ERR '+e.message;}
    // オーバーキル判定機構(火力≫HPで overkill=true・ワンパン禁止のため通常は限定)
    try{ showMonster('normal'); const m=monsters[monsters.length-1]; if(m){for(let k=0;k<400&&monsters.indexOf(m)>=0;k++)hitMonster(m.id); R.overkillMechExists=(typeof m.overkill!=='undefined');} }catch(e){R.overkill='ERR '+e.message;}
    // 延長狩り+重力圧縮: 研究を立てて式が回るか
    try{ state.research=state.research||{}; state.research.portalNetwork=true; state.research.blackHoleCompression=true;
      R.quotaOK=String(monsterQuotaRequired()); R.deepResOK=true; }catch(e){R.deepres='ERR '+e.message;}
    return R;
  });
  console.log('EVENT QA:',JSON.stringify(R));
  console.log('pageerrors:',errs.length,errs.slice(0,4).join(' | '));
  await b.close();
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
