import {TEAMS,parseScheduleCsv,scheduleGrid,fetchEspnWeek,weekStart} from "./h2h-schedule.js";
const get=id=>document.getElementById(id);
let games=[];
const key="fantasy-draft-lab:h2h:schedule:v1";
let loadedWeek=null;
try{games=parseScheduleCsv(localStorage.getItem(key)||"date,home,away");}catch{}
for(const team of TEAMS){const option=document.createElement("option");option.value=team;option.textContent=team;get("filter").append(option);}
function render(){
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
 get("schedule-status").textContent=games.length?"已載入 "+games.length+" 場；本週 "+grid.totalByDay.reduce((a,b)=>a+b,0)+" 場":"尚未匯入賽程資料";
}
function load(value){
 try{
  const parsed=parseScheduleCsv(value);if(!parsed.length)throw Error("沒有有效賽程");
  localStorage.setItem(key,value);games=parsed;render();
 }catch(error){get("schedule-status").textContent="匯入失敗："+error.message;}
}
get("parse-paste").addEventListener("click",()=>load(get("schedule-paste").value));
get("schedule-file").addEventListener("change",async event=>{const file=event.target.files[0];if(file)load(await file.text());});
async function refresh(){
 const button=get("fetch-schedule");button.disabled=true;get("schedule-status").textContent="正在取得 NBA 賽程…";
 try{
  const fetched=await fetchEspnWeek(get("week").value);
  const monday=weekStart(get("week").value);
  const remaining=games.filter(g=>weekStart(g.date)!==monday);
  const merged=[...remaining,...fetched].sort((a,b)=>a.date.localeCompare(b.date));
  const csv=["date,home,away",...merged.map(g=>[g.date,g.home,g.away].join(","))].join("\n");
  localStorage.setItem(key,csv);games=merged;loadedWeek=monday;render();
  get("schedule-status").textContent="已從 ESPN 更新本週 "+fetched.length+" 場；資料已保存在本機。";
 }catch(error){render();get("schedule-status").textContent="自動更新失敗："+error.message+"；既有資料已保留，可用 CSV 備援。";}
 finally{button.disabled=false;}
}
get("fetch-schedule").addEventListener("click",refresh);
get("week").addEventListener("change",()=>{render();refresh();});
get("filter").addEventListener("change",render);
render();refresh();
