// トーストメッセージの実幅QA: #message は nowrap+ellipsis。討伐チェイン等の複合文が
// 実機430px幅で見切れて末尾情報(連鎖ボーナス/マイルストーン)を失わないか実測する。
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path=require('path');
const INDEX=process.env.GAME_INDEX||path.resolve(__dirname,'../../index.html');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.PW_CHROMIUM||'/opt/pw-browsers/chromium',headless:true});
  const p=await b.newPage({viewport:{width:430,height:780}});
  await p.clock.install();
  await p.goto('file://'+INDEX,{waitUntil:'load',timeout:60000});
  await p.clock.runFor(1500);
  await p.click('#audioGate').catch(()=>{}); await p.clock.runFor(700);
  await p.click('#titleStartBtn').catch(()=>{}); await p.clock.runFor(1000);
  const samples=[
    "撃破",
    "狩猟集中成功：報酬Lv+1",
    "撃破 / 討伐記録 100体達成！",
    "撃破 / 深層 第2層に到達",
    "金獣変異：報酬Lv+1 / 討伐記録 100体達成！ / 深層 第2層に到達 / 連鎖 ×5(全生産+25%)",
    "撃破 / 討伐記録 130体達成！ / 連鎖 ×8(全生産+40%)",
  ];
  const R=await p.evaluate((samples)=>{
    const el=document.getElementById('message');
    const cs=getComputedStyle(el);
    const box=el.getBoundingClientRect();
    const out=[];
    for(const s of samples){
      el.textContent=s;
      // scrollWidth > clientWidth = ellipsisで見切れ
      const clipped=el.scrollWidth>el.clientWidth+1;
      out.push({s, scrollW:el.scrollWidth, clientW:el.clientWidth, clipped});
    }
    el.textContent='';
    return {avail:Math.round(box.width), whiteSpace:cs.whiteSpace, overflow:cs.overflow, out};
  },samples);
  console.log('avail width:',R.avail,'white-space:',R.whiteSpace,'overflow:',R.overflow);
  for(const o of R.out) console.log((o.clipped?'CLIP':'ok  '),`scroll=${o.scrollW} client=${o.clientW}`,'|',o.s);
  await b.close();
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
