// 既存JPEGを canvas で縮小再エンコード(430x780→ 幅300・q40)してファイルサイズを圧縮。
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs=require('fs'),path=require('path');
const SRC=process.env.SRC, DST=process.env.DST, W=Number(process.env.W||300), Q=Number(process.env.Q||0.4);
fs.mkdirSync(DST,{recursive:true});
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',headless:true});
  const p=await b.newPage();
  const files=fs.readdirSync(SRC).filter(f=>/\.jpg$/.test(f));
  for(const f of files){
    const data='data:image/jpeg;base64,'+fs.readFileSync(path.join(SRC,f)).toString('base64');
    const out=await p.evaluate(async({data,W,Q})=>{
      const img=new Image(); await new Promise(r=>{img.onload=r;img.src=data;});
      const h=Math.round(img.height*(W/img.width));
      const c=document.createElement('canvas'); c.width=W; c.height=h;
      const ctx=c.getContext('2d'); ctx.imageSmoothingQuality='high'; ctx.drawImage(img,0,0,W,h);
      return c.toDataURL('image/jpeg',Q);
    },{data,W,Q});
    const buf=Buffer.from(out.split(',')[1],'base64');
    fs.writeFileSync(path.join(DST,f),buf);
  }
  // copy ops.json
  fs.copyFileSync(path.join(SRC,'ops.json'),path.join(DST,'ops.json'));
  console.log('recompressed',files.length,'images to',DST);
  await b.close();
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
