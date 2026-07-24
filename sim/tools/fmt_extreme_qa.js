// 批判監査(dim4/6): 数値フォーマッタと実HUDを極大値で叩く。NaN/Infinity/[object]/undefined/空/壊れ表示を洗う。
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',headless:true});
  const p=await b.newPage({viewport:{width:430,height:780}});
  const issues=[]; p.on('console',m=>{const t=m.type();if(t==='error'||t==='warning')issues.push(t+':'+m.text().slice(0,120));});
  p.on('pageerror',e=>issues.push('PAGEERR:'+e.message.slice(0,120)));
  await p.clock.install();
  await p.goto('file:///home/user/exist-debug/index.html',{waitUntil:'load',timeout:60000});
  await p.clock.runFor(1500); await p.click('#audioGate').catch(()=>{}); await p.clock.runFor(700);
  await p.click('#titleStartBtn').catch(()=>{}); await p.clock.runFor(800);
  const R=await p.evaluate(()=>{
    const bad=[]; const isBad=s=>{ s=String(s); return /NaN|Infinity|undefined|\[object|null/.test(s)||s.trim()===''; };
    // 1) 全フォーマッタを 1e0..1e308 で叩く
    const fmts=['fmt','fmtShort','fmtShortJapaneseUnitNumber','fmtSixSigMantissa','spaceAfterDecimalPoint','fmtTime'];
    const mags=[0,1,3,6,9,12,15,30,60,100,150,200,250,300,308];
    let tested=0;
    for(const fn of fmts){ if(typeof window[fn]!=='function')continue;
      for(const m of mags)for(const mant of [1.23456,4.759,9.9999,1.0001,3.14159]){ const v=mant*Math.pow(10,m);
        let out; try{ out = (fn==='fmt'||fn==='fmtShort'||fn.startsWith('fmtShort')||fn==='fmtSixSigMantissa')? window[fn](typeof D==='function'?D(v):v) : window[fn](fn==='fmtTime'?v: (fn==='spaceAfterDecimalPoint'?String(v):v)); }catch(e){ out='ERR:'+e.message; }
        tested++; if(isBad(out)||/ERR:/.test(String(out))) bad.push(`${fn}(1e${m})=${out}`);
      }
    }
    // 2) 実HUDを極大state で描画→表示文字列を検査
    try{ debugMode=true; state.cookies=D('1e250'); state.runCookies=D('1e250'); state.totalCookies=D('1e250');
      for(const u of UPGRADES){state.upgrades[u.id]=200;} state.prestige=1e9; state.prestigeTotal=1e9; state.stageUnlocked=6;
      if(typeof updateTopOnly==='function')updateTopOnly(); if(typeof renderAllTabs==='function')renderAllTabs();
    }catch(e){bad.push('SETUP:'+e.message);}
    const ids=['cookieCount','cps','message'];
    for(const id of ids){ const el=document.getElementById(id); if(el&&isBad(el.textContent)) bad.push(`#${id}="${el.textContent.slice(0,40)}"`); }
    // 強化カード/研究カードの表示文字列
    const cards=[...document.querySelectorAll('#shopTab, #researchTab, #prestigeTab')].map(e=>e.textContent).join(' ');
    if(/NaN|Infinity|undefined|\[object/.test(cards)) bad.push('CARD text has bad token');
    return {tested, badCount:bad.length, bad:bad.slice(0,20)};
  });
  console.log('formatter/HUD tests:',R.tested,'| BAD:',R.badCount);
  R.bad.forEach(x=>console.log('  BAD:',x));
  console.log('console/page issues:',[...new Set(issues)].length, [...new Set(issues)].slice(0,4).join(' | '));
  await b.close();
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
