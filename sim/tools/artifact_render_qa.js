// 公開アーティファクトHTMLの描画QA: 公開時ラッパ(body)を模して読み込み、横はみ出し/要素はみ出し/pageエラーを検査し、
// ヘッダ・金payoff・ボスの各ブロックを撮って構図(暖色トークン/チップ/長ラベルの折返し)を目視確認する再現機構。
// 実行: HTML=/path.html OUT=/out node sim/tools/artifact_render_qa.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs=require('fs'), path=require('path'), os=require('os');
const HTML=process.env.HTML||path.join(os.tmpdir(),'stage_jikkyo.html');
const OUT=process.env.OUT||path.join(os.tmpdir(),'artifact_render');
fs.mkdirSync(OUT,{recursive:true});
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',headless:true});
  const p=await b.newPage({viewport:{width:600,height:900}});
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  // 公開時のラッパ(reset css+body)を模して読み込む
  const inner=fs.readFileSync(HTML,'utf8');
  await p.setContent(`<!doctype html><html><head><meta charset=utf8></head><body>${inner}</body></html>`,{waitUntil:'load'});
  await p.waitForTimeout(400);
  // 横スクロール(はみ出し)検査
  const overflow=await p.evaluate(()=>({bodyScrollW:document.body.scrollWidth,winW:window.innerWidth,
    anyWide:[...document.querySelectorAll('.op,.what,.head')].some(e=>e.scrollWidth>e.clientWidth+2)}));
  // ヘッダ+金payoffブロック+ボスブロックの位置を撮る
  await p.screenshot({path:OUT+'/top.png'});
  // 金payoffブロックへスクロール
  await p.evaluate(()=>{const el=[...document.querySelectorAll('.what')].find(e=>/全生産x/.test(e.textContent));if(el)el.scrollIntoView({block:'center'});});
  await p.waitForTimeout(200); await p.screenshot({path:OUT+'/golden.png'});
  await p.evaluate(()=>{const el=[...document.querySelectorAll('.what')].find(e=>/ボスを撃破/.test(e.textContent));if(el)el.scrollIntoView({block:'center'});});
  await p.waitForTimeout(200); await p.screenshot({path:OUT+'/boss.png'});
  console.log('overflow:',JSON.stringify(overflow),'pageerrors:',errs.length);
  await b.close();
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
