import {TEAMS,parseScheduleCsv,scheduleGrid,seasonGrid,backToBacks} from "./h2h-schedule.js";
const get=id=>document.getElementById(id);
let games=[];\nlet source="none";
const key="fantasy-draft-lab:h2h:schedule:v1";
try{games=parseScheduleCsv(localStorage.getItem(key)||"date,home,away");if(games.length)source="local";}catch{}
for(const team of TEAMS){const option=document.createElement("option");option.value=team;option.textContent=team;get("filter").append(option);}
function render(){
 const season=seasonGrid(games);
 const seasonHead=get("season-table").tHead,seasonBody=get("season-table").tBodies[0];
 seasonHead.replaceChildren();seasonBody.replaceChildren();
 const header=document.createElement("tr");for(const value of ["球隊","已排場次","B2B",...season.weeks.map((_,i)=>"W"+(i+1))]){const th=document.createElement("th");th.textContent=value;header.append(th);}seasonHead.append(header);
 for(const item of season.rows.filter(x=>!get("filter").value||x.team===get("filter").value)){
  const tr=document.createElement("tr");for(const value of [item.team,item.total,backToBacks(games,item.team),...item.counts]){const td=document.createElement("td");td.textContent=value;tr.append(td);}seasonBody.append(tr);
 }

 const grid=scheduleGrid(games,get("week").value);
 const head=get("schedule-table").tHead,body=get("schedule-table").tBodies[0];
 head.replaceChildren();body.replaceChildren();
 const addRow=(parent,values,tag)=>{const tr=document.createElement("tr");for(const value of values){const cell=document.createElement(tag);cell.textContent=value;tr.append(cell);}parent.append(tr);return tr;};
 addRow(head,["NBA 隊伍","場次",...grid.dates.map(d=>d.slice(5))],"th");
 addRow(body,["每日總場次","—",...grid.totalByDay],"td");
 for(const row of grid.rows.filter(x=>!get("filter").value||x.team===get("filter").value)){
  const tr=addRow(body,[row.team,row.count,...row.days.map(x=>x.join(" / ")||"—")],"td");
  tr.cells[1].className=row.count>=4?"count4":row.count<=2?"count2":"";
 }
 get("schedule-status").textContent=games.length?"資料來源："+(source==="official"?"官方內建 CSV":source==="local"?"本機匯入（備援）":"未知")+"；已載入 "+games.length+" 場；本週 "+grid.totalByDay.reduce((a,b)=>a+b,0)+" 場":"尚未匯入賽程資料";
}
function load(value){
 try{
  const parsed=parseScheduleCsv(value);if(!parsed.length)throw Error("沒有有效賽程");
  localStorage.setItem(key,value);games=parsed;source="local";render();
 }catch(error){get("schedule-status").textContent="匯入失敗："+error.message;}
}
get("parse-paste").addEventListener("click",()=>load(get("schedule-paste").value));
get("schedule-file").addEventListener("change",async event=>{const file=event.target.files[0];if(file)load(await file.text());});
get("week").addEventListener("change",render);
get("filter").addEventListener("change",render);
render();
(async()=>{try{const response=await fetch("./data/nba-2026-27.csv",{cache:"force-cache"});if(!response.ok)throw Error("尚未提供整季賽程");const csv=await response.text();const parsed=parseScheduleCsv(csv);if(!parsed.length)throw Error("整季資料為空");games=parsed;source="official";render();}catch(error){get("schedule-status").textContent=games.length?"官方 CSV 載入失敗，目前顯示本機備援資料（"+games.length+" 場），請勿視為最新官方賽程。":"官方 CSV 載入失敗，尚無可用賽程。";}})();
