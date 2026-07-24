// directive A / F3: 放置生産(baseCps)と能動生産(タップ/会心)の比を、開発が進んだ状態で測る。
// 能動が支配的なら「driverが放置一辺倒=弱い/sim S1(能動)に届かない」の直接説明+修正の当て所。
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const TPS=Number(process.env.TPS||8); // 人間の連続タップ毎秒
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',headless:true});
  const p=await b.newPage({viewport:{width:430,height:780}});
  await p.clock.install();
  await p.goto('file:///home/user/exist-debug/index.html',{waitUntil:'load',timeout:60000});
  await p.clock.runFor(1500); await p.click('#audioGate').catch(()=>{}); await p.clock.runFor(700);
  await p.click('#titleStartBtn').catch(()=>{}); await p.clock.runFor(800);
  const R=await p.evaluate((TPS)=>{
    const out=[];
    // いくつかの発展段階で測る: 各設備を N 台ずつ+強い指 M
    for(const [fingers,others] of [[10,10],[25,40],[25,120],[25,300]]){
      state.upgrades={}; state.upgrades.finger=fingers;
      for(const u of UPGRADES){ if(u.type==='cps') state.upgrades[u.id]=others; }
      // 研究も少し(現実の発展)
      const base=Number(baseCps().toString());
      const click=Number((typeof currentClickPower==='function'?currentClickPower():D(0)).toString());
      const activePerSec = base + click*TPS; // タップ寄与(会心は期待値でcurrentClickPowerに含まれる想定)
      out.push({fingers,others, baseCps:base, clickPower:click, tapPerSec:click*TPS, activePerSec, ratio: base>0?(activePerSec/base):Infinity});
    }
    return out;
  },TPS);
  console.log('TPS='+TPS+'  (activePerSec = baseCps + clickPower×TPS)');
  for(const r of R) console.log(`finger=${r.fingers} cps設備=${r.others}台: baseCps=${r.baseCps.toExponential(2)} tap/s=${r.tapPerSec.toExponential(2)} active/idle比=${r.ratio.toFixed(2)}×`);
  await b.close();
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
