// 批判監査(dim6 頑健性): 壊れ/部分/旧スキーマ/極端 の save を localStorage に注入して load させ、
// クラッシュ/NaN状態/softlock無しに復帰できるかを検査。cloud同期衝突・版差でありうる現実の入力。
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const KEY='cookie_game_compact_exist';
const CASES={
  empty:'{}',
  onlyCookies:'{"cookies":"5"}',
  wrongTypes:'{"cookies":"abc","upgrades":"notObj","prestige":"NaN","research":123,"skills":null,"stageUnlocked":"x"}',
  negatives:'{"cookies":"-100","prestige":-5,"upgrades":{"grandma":-3},"monstersDefeated":-9}',
  extreme:'{"cookies":"1e999","runCookies":"1e999","prestige":1e300}',
  brokenDecimal:'{"cookies":{"foo":1},"runCookies":[1,2,3]}',
  oldSchema:'{"prestige_OLD":50,"cookies":"1000","obsoleteField":true,"upgrades":{"ghostBuilding":10}}',
  nullish:'{"cookies":null,"upgrades":{},"research":{},"skills":{},"perks":null,"materials":undefined}',
  truncated:'{"cookies":"123",',
};
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',headless:true});
  const results=[];
  for(const [name,save] of Object.entries(CASES)){
    const p=await b.newPage({viewport:{width:430,height:780}});
    const errs=[]; p.on('pageerror',e=>errs.push(e.message.slice(0,90)));
    p.on('console',m=>{if(m.type()==='error'&&!/ERR_TUNNEL|Firebase|firebasejs|gstatic/.test(m.text()))errs.push('con:'+m.text().slice(0,80));});
    await p.addInitScript((s)=>{ try{localStorage.setItem('cookie_game_compact_exist',s);}catch(e){} }, save);
    await p.clock.install();
    let loaded='?';
    try{
      await p.goto('file:///home/user/exist-debug/index.html',{waitUntil:'load',timeout:30000});
      await p.clock.runFor(1500); await p.click('#audioGate').catch(()=>{}); await p.clock.runFor(400);
      await p.click('#titleStartBtn').catch(()=>{}); await p.clock.runFor(800);
      // 遊べる状態か: cookieタップ→cps/cookiesがNaNでなく数値
      loaded=await p.evaluate(()=>{ try{ for(let i=0;i<5;i++)tapCookie();
        const c=Number(state.cookies.toString()), cps=Number(currentCps().toString());
        const hud=(document.getElementById('cookieCount')||{}).textContent||'';
        const ok=Number.isFinite(c)&&Number.isFinite(cps)&&!/NaN|Infinity|undefined/.test(hud);
        return ok?('OK cookies='+c.toExponential(1)+' cps='+cps.toExponential(1)):('BAD c='+c+' cps='+cps+' hud="'+hud.slice(0,20)+'"');
      }catch(e){return 'EVAL_ERR:'+e.message.slice(0,60);} });
    }catch(e){ loaded='LOAD_ERR:'+e.message.slice(0,60); }
    results.push({name, loaded, errs:[...new Set(errs)].slice(0,2)});
    await p.close();
  }
  for(const r of results) console.log(`${r.name.padEnd(14)} ${r.loaded}${r.errs.length?'  ERRS:['+r.errs.join(' | ')+']':''}`);
  const bad=results.filter(r=>!/^OK/.test(r.loaded)||r.errs.length);
  console.log('\n'+(bad.length?('PROBLEM CASES: '+bad.map(b=>b.name).join(',')):'all recovered gracefully'));
  await b.close();
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
