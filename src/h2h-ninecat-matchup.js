import {parseScheduleCsv,weekStart} from "./h2h-schedule.js";
const $=id=>document.getElementById(id);
const rosterKey="fantasy-draft-lab:h2h:yahoo-rosters:v1",projectionKey="fantasy-draft-lab:v1:projections";
const fields=[["fg","FG%",true],["ft","FT%",true],["three","3PM"],["pts","PTS"],["reb","REB"],["ast","AST"],["stl","STL"],["blk","BLK"],["tov","TO"]];
const numbers=["fgm","fga","ftm","fta","three","pts","reb","ast","stl","blk","tov"];
const key=name=>String(name||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"").replace(/(iii|ii|iv|jr|sr)$/,"");
const aliases=new Map([["og anunoby","og anunoby"],["kel el ware","kelel ware"]].map(([a,b])=>[key(a),key(b)]));
const playerKey=name=>aliases.get(key(name))||key(name);
let games=[],loadError="";
function read(keyName){try{return JSON.parse(localStorage.getItem(keyName)||"null");}catch{return null;}}
function weekly(team,projections,counts){
 const totals=Object.fromEntries(numbers.map(n=>[n,0])),missing=[],inactive=[],included=[];
 for(const p of team.players){
  if(p.rosterSlot==="IL"){inactive.push(p.player);continue;}
  const found=projections.get(playerKey(p.player));
  if(!found){missing.push(p.player);continue;}
  const gp=counts[p.nbaTeam]||0;
  if(!gp)continue;
  for(const n of numbers)totals[n]+=Number(found[n])*gp;
  included.push(p.player);
 }
 totals.fg=totals.fga?totals.fgm/totals.fga:NaN;
 totals.ft=totals.fta?totals.ftm/totals.fta:NaN;
 return {totals,missing,inactive,included};
}
function render(){
 const status=$("ninecat-status"),root=$("ninecat-results");
 root.replaceChildren();
 const data=read(rosterKey),raw=read(projectionKey);
 if(!data?.teams?.length){status.textContent="請先載入 14 隊名單。";return;}
 if(!Array.isArray(raw)||!raw.length){status.textContent="尚未找到 Yahoo 球員預測。請先在「球員研究」匯入 Yahoo 預測，再返回本頁；不會以虛構數字代替。";return;}
 if(!games.length){status.textContent=loadError||"正在載入 NBA 賽程…";return;}
 const a=data.teams.find(t=>t.team===$("compare-a").value),b=data.teams.find(t=>t.team===$("compare-b").value);
 if(!a||!b||a===b){status.textContent="請先選擇兩支不同球隊。";return;}
 let start;try{start=weekStart($("compare-week").value);}catch{status.textContent="比較週次無效。";return;}
 const end=new Date(start+"T12:00:00Z");end.setUTCDate(end.getUTCDate()+7);const finish=end.toISOString().slice(0,10);
 const counts={};for(const g of games){if(g.date<start||g.date>=finish)continue;counts[g.home]=(counts[g.home]||0)+1;counts[g.away]=(counts[g.away]||0)+1;}
 const projections=new Map(raw.filter(p=>p?.player).map(p=>[playerKey(p.player),p]));
 const projectionCount=raw.filter(p=>p?.player).length;
 const left=weekly(a,projections,counts),right=weekly(b,projections,counts);
 const missing=[...new Set([...left.missing,...right.missing])];
 const expected=a.players.filter(p=>p.rosterSlot!=="IL").length+b.players.filter(p=>p.rosterSlot!=="IL").length;
 const matched=expected-left.missing.length-right.missing.length;
 const diagnostic="Yahoo 已儲存 "+projectionCount+" 人；本次兩隊成功配對 "+matched+"/"+expected+" 人。";

 if(missing.length){status.textContent=diagnostic+" 預測資料不足：缺少 "+missing.length+" 位球員（"+missing.slice(0,8).join("、")+(missing.length>8?" 等":"")+"）。下表僅顯示已配對球員的部分預估，不能判定完整 9-Cat 勝負。";}
 else status.textContent=diagnostic+" Yahoo 每場預測 × 本週排定場次；已排除人工 IL。數值為模型預估，非即時戰績。";
 const complete=missing.length===0;
 const wrap=document.createElement("div");wrap.className="ninecat-scroll";const table=document.createElement("table");table.className="ninecat-matchup";
 const thead=document.createElement("thead"),hr=document.createElement("tr");
 for(const label of ["項目",a.team,b.team,"優勢"]){const th=document.createElement("th");th.textContent=label;hr.append(th);}thead.append(hr);table.append(thead);
 const body=document.createElement("tbody");let winsA=0,winsB=0,ties=0;const close=[];
 for(const [field,label,pct] of fields){
  const av=left.totals[field],bv=right.totals[field],valid=Number.isFinite(av)&&Number.isFinite(bv);
  const diff=av-bv,epsilon=pct?0.0000001:0.0000001;
  const side=!valid||Math.abs(diff)<epsilon?0:((field==="tov"?-diff:diff)>0?1:-1);
  if(complete){if(side>0)winsA++;else if(side<0)winsB++;else ties++;}
  const row=document.createElement("tr"),values=[label,pct?(Number.isFinite(av)?(av*100).toFixed(2)+"%":"—"):av.toFixed(1),pct?(Number.isFinite(bv)?(bv*100).toFixed(2)+"%":"—"):bv.toFixed(1),!complete?"資料不足":!valid?"—":side===0?"平手":side>0?"A 領先":"B 領先"];
  values.forEach((v,i)=>{const td=document.createElement("td");td.textContent=v;if(i===3&&complete)td.className=side>0?"ninecat-win":side<0?"ninecat-loss":"ninecat-tie";row.append(td);});body.append(row);
  if(complete&&valid){const relative=pct?Math.abs(diff)*100:Math.abs(diff)/Math.max(1,Math.abs(av),Math.abs(bv))*100;if(relative<(pct?3:12))close.push(label);}
 }
 table.append(body);wrap.append(table);root.append(wrap);
 const score=document.createElement("p");score.className="ninecat-score";score.textContent=complete?"預估 9-Cat：A "+winsA+"－"+winsB+" B"+(ties?"（"+ties+" 平）":""):"9-Cat 總比分：資料不足，暫不判定";root.prepend(score);
 const advice=document.createElement("p");advice.className="ninecat-notice";advice.textContent=complete?(close.length?"接近的項目（可優先評估補強）："+close.join("、")+"。請搭配可用自由球員及實際上場空間判斷。":"目前沒有明顯接近的項目；可依對手優勢與剩餘場次再評估補強。"):"請先補齊缺少球員的 Yahoo 預測，再評估補強方向。";root.append(advice);
 const caution=document.createElement("p");caution.className="ninecat-notice";caution.textContent="FG% = ΣFGM/ΣFGA，FT% = ΣFTM/ΣFTA；TO 較少者領先。未扣除傷停、輪休、每日先發位置限制、已進行比賽與未排定 NBA Cup 場次；此處為整週賽前情境。";root.append(caution);
}
for(const id of ["compare-a","compare-b","compare-week"])$(id).addEventListener("change",render);
document.addEventListener("change",e=>{if(e.target.closest("#players,#import-roster"))queueMicrotask(render);});
document.addEventListener("click",e=>{if(e.target.closest("#players,#add-player,#clear"))queueMicrotask(render);});
(async()=>{try{const response=await fetch("./data/nba-2026-27.csv");if(!response.ok)throw Error("HTTP "+response.status);games=parseScheduleCsv(await response.text());}catch(e){loadError="賽程無法載入："+e.message;}render();})();
render();
