import {parseScheduleCsv,weekStart} from "./h2h-schedule.js";
const $=id=>document.getElementById(id);
const rosterKey="fantasy-draft-lab:h2h:yahoo-rosters:v1";
let games=[],scheduleError="";
function roster(){try{const d=JSON.parse(localStorage.getItem(rosterKey)||"null");return d?.teams?.length===14?d:null;}catch{return null;}}
function options(select,teams,preferred){const before=select.value||preferred;select.replaceChildren();for(const t of teams){const o=document.createElement("option");o.value=t.team;o.textContent=t.team;select.append(o);}if(teams.some(t=>t.team===before))select.value=before;}
function countFor(team,start){const end=new Date(start+"T12:00:00Z");end.setUTCDate(end.getUTCDate()+7);const finish=end.toISOString().slice(0,10);const byTeam={};for(const g of games){if(g.date<start||g.date>=finish)continue;byTeam[g.home]=(byTeam[g.home]||0)+1;byTeam[g.away]=(byTeam[g.away]||0)+1;}return team.players.map(p=>({name:p.player,nba:p.nbaTeam||"—",games:p.rosterSlot==="IL"?0:(byTeam[p.nbaTeam]||0),slot:p.rosterSlot}));}
function render(){const d=roster();const result=$("compare-result"),status=$("compare-status");if(!d){status.textContent="尚無有效名單，請先載入 14 隊資料。";result.replaceChildren();return;}options($("compare-a"),d.teams,"kenny's Team");options($("compare-b"),d.teams,"Ben's Tip-Top Team");if(!games.length){status.textContent=scheduleError||"正在載入 2026–27 賽程…";result.replaceChildren();return;}
const a=d.teams.find(t=>t.team===$("compare-a").value),b=d.teams.find(t=>t.team===$("compare-b").value);
if(a===b){status.textContent="請選擇兩支不同的 Fantasy 隊伍。";result.replaceChildren();return;}
let start;try{start=weekStart($("compare-week").value);}catch{status.textContent="請選擇有效週次。";return;}
const ar=countFor(a,start),br=countFor(b,start);const sum=rows=>rows.reduce((n,p)=>n+p.games,0);
status.textContent="週次 "+start+" 起，依美國比賽日期計算；已排除人工 IL 場次，未扣除其他傷停、輪休、Yahoo 每週上場限制及未排定 NBA Cup 場次。";
result.replaceChildren();const stats=document.createElement("div");stats.className="compare-stats";for(const [team,rows] of [[a,ar],[b,br]]){const box=document.createElement("div"),label=document.createElement("small"),number=document.createElement("strong"),sub=document.createElement("small");label.textContent=team.team;number.textContent=sum(rows)+" 場";sub.textContent=rows.filter(p=>p.slot!=="IL").length+" 位有效球員（IL 不計場次）";box.append(label,number,sub);stats.append(box);}result.append(stats);
const table=document.createElement("table");table.className="compare-table";const thead=document.createElement("thead"),tr=document.createElement("tr");for(const h of ["球隊","球員 · NBA","本週場次"]){const th=document.createElement("th");th.textContent=h;tr.append(th);}thead.append(tr);table.append(thead);const body=document.createElement("tbody");for(const [team,rows] of [[a,ar],[b,br]])for(const [i,p] of rows.entries()){const line=document.createElement("tr");for(const v of [i===0?team.team:"",p.name+" · "+p.nba+(p.slot==="IL"?" (IL，不計場次)":""),String(p.games)]){const td=document.createElement("td");td.textContent=v;line.append(td);}body.append(line);}table.append(body);result.append(table);
}
$("compare-a").addEventListener("change",render);$("compare-b").addEventListener("change",render);$("compare-week").addEventListener("change",render);
document.addEventListener("click",event=>{if(event.target.closest("#add-player,#players,#import-roster,#clear"))queueMicrotask(render);});
document.addEventListener("change",event=>{if(event.target.closest("#players,#import-roster,#team"))queueMicrotask(render);});
window.addEventListener("fantasy-roster-updated",render);
(async()=>{try{const response=await fetch("./data/nba-2026-27.csv",{cache:"force-cache"});if(!response.ok)throw Error("HTTP "+response.status);games=parseScheduleCsv(await response.text());if(!games.length)throw Error("賽程為空");}catch(e){scheduleError="無法載入 NBA 賽程："+e.message+"；暫不顯示比較結果。";}render();})();
render();
