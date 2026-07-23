// 各里程標の「現実プレイ時間」を sim から抽出(game秒=能動プレイの現実秒)。
const G=require('./sim.js'); const {STRATEGIES}=require('./strategies.js');
const sid=process.argv[2]||'S2'; const hours=Number(process.argv[3]||300);
const st=STRATEGIES.find(s=>s.id===sid);
const sim=G.simulate(st,{hours});
const full=sim.runs.filter(r=>!r.partial);
const fmtT=s=>{s=Math.round(s);const h=Math.floor(s/3600),m=Math.floor(s%3600/60),ss=s%60;return (h?h+'時間':'')+(m||h?m+'分':'')+ss+'秒';};
console.log(`=== ${sid} ${st.name} ===`);
console.log('初転生(run0終了):', full[0]?fmtT(full[0].endT):'?', ' 最高層', full[0]?full[0].maxStage:'?');
// 各周回の累積時刻と到達層
let cum=0; const stageFirst={};
for(const r of full){ if(!stageFirst[Math.min(6,Math.ceil(r.maxStage/ (full.at(-1).maxStage/6||1)))]){} }
// スキル解放時刻(kind:'skill')
const sk=(sim.unlockEvents||[]).filter(e=>e.kind==='skill').sort((a,b)=>a.t-b.t);
let cnt=0, allSkillT=null;
for(const e of sk){ cnt+=e.n||1; if(cnt>=75 && allSkillT===null){allSkillT=e.t;} }
console.log('スキル解放イベント数:', sk.length, ' 累計スキル', cnt, ' 全75到達:', allSkillT!==null?fmtT(allSkillT):'未到達(hours内)');
// 研究解放時刻(指先の型など)
const rs=(sim.unlockEvents||[]).filter(e=>e.kind==='research').sort((a,b)=>a.t-b.t);
console.log('研究解放(先頭5):', rs.slice(0,5).map(e=>e.id+'@'+fmtT(e.t)).join(', '));
// 周回数と総時間
console.log('総周回:', full.length, ' 総時間:', fmtT(full.at(-1)?full.reduce((a,r)=>a+r.duration,0):0));
// 各周回 endT(累積)先頭8
console.log('周回終了時刻(累積・先頭8):', full.slice(0,8).map((r,i)=>'run'+i+'@'+fmtT(r.endT)).join(', '));
