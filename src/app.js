import {readMockArchive,writeMockArchive,deleteMockArchive} from "./mock-storage.js";
import {recommendMockTeams} from "./mock-recommendations.js";
import {parseYahooPrices,mergeYahooPrices} from "./yahoo-prices.js";
import {makeBackup,readBackup,backupToCsv} from "./backup.js";
import {parseYahooMobileText,mergeProjectionPlayers} from "./yahoo-mobile.js";
import {yahooProjectedToCsv} from "./yahoo-import.js";
import {parseProjections,rankProjections} from "./projections.js";
import {auctionValues} from "./auction.js";
import {runFullMock} from "./mock-batch.js";
import {CATEGORIES,puntRankings,rotoStandings} from "./strategy.js";
import {scarcityFactors} from "./simulation.js";
import {evaluateDraft} from "./evaluation.js";
import {rosterForTeam,canAddToRoster} from "./roster.js";
import {CONFIG,fresh,teamStats,addPick,validateState} from "./model.js";
const $=id=>document.getElementById(id),key=mode=>"fantasy-draft-lab:v1:"+mode;
let mode="h2h",state;
let projectionPlayers=[];
const teamNamesKey="fantasy-draft-lab:v1:team-names";
let teamNames=(()=>{try{const v=JSON.parse(localStorage.getItem(teamNamesKey)||"{}");return v&&typeof v==="object"?v:{};}catch{return {};}})();
const teamLabel=n=>teamNames[n]||"Team "+n;
function renderTeamNameFields(){
 const root=$("team-name-fields");root.replaceChildren();
 for(let n=1;n<=14;n++){
  const label=document.createElement("label");label.textContent="Team "+n;
  const input=document.createElement("input");input.type="text";input.maxLength=32;input.value=teamNames[n]||"";input.placeholder="Team "+n;
  input.addEventListener("change",()=>{
   const name=input.value.trim();if(name)teamNames[n]=name;else delete teamNames[n];
   try{localStorage.setItem(teamNamesKey,JSON.stringify(teamNames));$("team-name-status").textContent="隊名已保存";render();}
   catch(e){$("team-name-status").textContent="無法儲存隊名："+e.message;}
  });label.append(input);root.append(label);
 }
}
function updatePlayerSuggestions(){
 const root=$("player-suggestions");root.replaceChildren();
 const purchased=new Set(state.picks.map(p=>p.player.toLocaleLowerCase()));
 projectionPlayers.filter(p=>!purchased.has(p.player.toLocaleLowerCase())).forEach(p=>{
  const option=document.createElement("option");option.value=p.player;root.append(option);
 });
}
function renderLiveSearch(){
 const root=$("live-search-results"),detail=$("live-search-detail"),query=$("live-search").value.trim().toLocaleLowerCase();
 root.replaceChildren();
 if(!query){detail.textContent="輸入部分姓名即可查詢；不需要登記其他隊伍成交。";return;}
 if(!projectionPlayers.length){detail.textContent="請先在球員研究匯入 Yahoo 球員預測。";return;}
 let priceData=[];try{priceData=JSON.parse(localStorage.getItem("fantasy-draft-lab:v1:prices")||"[]");}catch{}
 const prices=new Map((Array.isArray(priceData)?priceData:[]).map(p=>[p.player?.trim().toLocaleLowerCase(),p]));
 const ranks=new Map(rankProjections(projectionPlayers).map((p,i)=>[p.player.trim().toLocaleLowerCase(),i+1]));
 const sold=new Set(state.picks.map(p=>p.player.trim().toLocaleLowerCase()));
 const matches=projectionPlayers.filter(p=>p.player.toLocaleLowerCase().includes(query)).slice(0,12);
 detail.textContent=matches.length?"點選球員可帶入下方成交登記；查詢本身不會儲存成交。":"找不到符合的球員。";
 for(const p of matches){
  const k=p.player.trim().toLocaleLowerCase(),y=prices.get(k),button=document.createElement("button");
  button.type="button";button.className="secondary";button.disabled=sold.has(k);
  button.textContent=p.player+" · 9-Cat #"+(ranks.get(k)||"—")+" · Yahoo Proj "+(Number.isFinite(y?.proj)?"$"+y.proj:"—")+" · Avg "+(Number.isFinite(y?.avg)?"$"+y.avg:"—")+(sold.has(k)?" · 已成交":"");
  button.addEventListener("click",()=>{
   $("player").value=p.player;
   detail.textContent="已選擇 "+p.player+"。若要記錄成交，請在下方選隊伍並輸入成交價。";
   $("live-purchase").scrollIntoView({behavior:"smooth",block:"start"});
  });
  root.append(button);
 }
}
$("live-search").addEventListener("input",renderLiveSearch);
let activeTab="research";
function setTab(tab){
 activeTab=tab;
 document.querySelectorAll(".app-tabs [data-tab]").forEach(b=>b.setAttribute("aria-current",b.dataset.tab===tab?"page":"false"));
 document.querySelectorAll("main > section.panel").forEach(section=>{
  const id=section.id,heading=section.querySelector("h2")?.textContent||"";
  const isMock=id==="mock-archive-panel"||heading.includes("Mock Draft 模擬紀錄庫");
  const isLive=id.startsWith("live-");
  section.hidden=tab==="mock"?!isMock:tab==="live"?!isLive:isMock||isLive;
 });
 window.scrollTo({top:0,behavior:"instant"});
}
document.querySelectorAll(".app-tabs [data-tab]").forEach(b=>b.addEventListener("click",()=>setTab(b.dataset.tab)));
renderTeamNameFields();
const punt=new Set();
let rankingSort={column:4,ascending:false};
function load(m){try{const raw=localStorage.getItem(key(m));return raw?validateState(JSON.parse(raw),m):fresh(m)}catch(e){console.warn("無法載入本機資料",e);return fresh(m)}}
function save(){localStorage.setItem(key(mode),JSON.stringify(state));}
function cell(row,text){const td=document.createElement("td");td.textContent=String(text);row.append(td);return td;}
function render(){const c=CONFIG[mode];$("punt-controls").hidden=mode!=="h2h";$("roto-controls").hidden=mode!=="roto";$("mode").value=mode;$("summary").replaceChildren();for(const [label,value] of [["隊伍",c.teams],["每隊預算","$"+c.budget],["每隊名額",c.slots],["總選秀名額",c.teams*c.slots]]){const el=document.createElement("div");el.className="metric";const s=document.createElement("span"),b=document.createElement("b");s.textContent=label;b.textContent=value;el.append(s,b);$("summary").append(el);}$("roster").textContent="位置配置："+c.roster;$("team").replaceChildren();$("teams").replaceChildren();for(let n=1;n<=c.teams;n++){const opt=document.createElement("option");opt.value=n;opt.textContent=teamLabel(n);$("team").append(opt);const t=teamStats(state,n),tr=document.createElement("tr");for(const value of [teamLabel(n),t.count+"/"+c.slots,"$"+t.spent,"$"+t.remaining,"$"+t.maxBid,projectionPlayers.length?(()=>{const r=rosterForTeam(state,projectionPlayers,n);return r.assignment===null?"位置衝突":r.unknown?"待核對 "+r.unknown:"可配置";})():"未載入"])cell(tr,value);$("teams").append(tr);}$("history").replaceChildren();state.picks.forEach((p,i)=>{const tr=document.createElement("tr");for(const value of [i+1,p.player,teamLabel(p.team),"$"+p.price])cell(tr,value);$("history").append(tr);});$("undo").disabled=!state.picks.length;if(projectionPlayers.length)displayRankings(projectionPlayers);updatePlayerSuggestions();if($("live-search").value.trim())renderLiveSearch();}
function checkPosition(pick){if(!projectionPlayers.length)return;const map=new Map(projectionPlayers.map(p=>[p.player.toLocaleLowerCase(),p]));const target=map.get(pick.player.trim().toLocaleLowerCase());if(!target)return;const existing=state.picks.filter(p=>p.team===Number(pick.team)).map(p=>map.get(p.player.toLocaleLowerCase())).filter(Boolean);if(!canAddToRoster(existing,target,mode))throw Error("球員位置無法排入該隊剩餘陣容");}
function feedback(message){$("feedback").textContent=message;}
$("mode").addEventListener("change",e=>{mode=e.target.value;state=load(mode);feedback("");render();batchGeneration++;batchResult=loadArchive();showBatch();restoreMockArchive();});
$("purchase").addEventListener("submit",e=>{e.preventDefault();try{const pick={player:$("player").value,team:$("team").value,price:$("price").value};checkPosition(pick);state=addPick(state,pick);save();$("player").value="";$("price").value="1";feedback("成交已保存");render();}catch(err){feedback(err.message);}});
$("undo").addEventListener("click",()=>{if(!state.picks.length)return;state={...state,picks:state.picks.slice(0,-1)};save();feedback("已復原上一筆");render();});
$("reset").addEventListener("click",()=>{if(!confirm("確定清除目前 "+CONFIG[mode].label+" 的所有成交紀錄？"))return;state=fresh(mode);save();feedback("已清除");render();});
$("export").addEventListener("click",()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="fantasy-draft-"+mode+".json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);});
$("import").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;try{const incoming=validateState(JSON.parse(await file.text()),mode);if(!confirm("以匯入資料覆蓋目前聯盟紀錄？"))return;state=incoming;save();feedback("匯入成功");render();}catch(err){feedback("匯入失敗："+err.message);}finally{e.target.value="";}});
state=load(mode);render();
const projectionsKey="fantasy-draft-lab:v1:projections";
const rankingFields=[["positions","位置"],["gp","GP"],["z","9-Cat Z 總分"],["model","模型估價"],["avg","Yahoo Avg $"],["proj","Yahoo Proj $"],["fgPct","FG%"],["ftPct","FT%"],["three","3PM"],["pts","PTS"],["reb","REB"],["ast","AST"],["stl","STL"],["blk","BLK"],["tov","TO"],["fgm","FGM"],["fga","FGA"],["ftm","FTM"],["fta","FTA"]];
const defaultRankingFields=["positions","gp","z","model","avg","proj"];
const rankingFieldKey="fantasy-draft-lab:v1:ranking-columns";
let visibleRankingFields=(()=>{try{const saved=JSON.parse(localStorage.getItem(rankingFieldKey));return Array.isArray(saved)?rankingFields.map(x=>x[0]).filter(k=>saved.includes(k)):defaultRankingFields.slice();}catch{return defaultRankingFields.slice();}})();
const rankingFieldLabel=Object.fromEntries(rankingFields);
function displayRankings(players){
 projectionPlayers=players;
 document.querySelectorAll("[data-ranking-field]").forEach(cb=>cb.checked=visibleRankingFields.includes(cb.dataset.rankingField));
 document.querySelectorAll("[data-sort-category]").forEach(b=>{const k=b.dataset.sortCategory;const selected=k===rankingSort.column;b.setAttribute("aria-pressed",String(selected));b.textContent=(rankingFieldLabel[k]||k)+(selected?(rankingSort.ascending?" ↑":" ↓"):" ↕");});
 const groups=document.getElementById("ranking-groups"),status=document.getElementById("projection-status");
 const openGroups=new Set([...groups.querySelectorAll("details[open]")].map(d=>Number(d.dataset.group)));
 groups.replaceChildren();
 const overallRanks=new Map(rankProjections(players).map((p,i)=>[p.player.trim().toLocaleLowerCase(),i+1]));
 const ranked=mode==="h2h"&&punt.size?puntRankings(players,[...punt]):rankProjections(players);
 // Category ranking functions may return summary rows without raw per-game stats.
 const sourceByName=new Map(players.map(p=>[p.player,p]));
 for(let i=0;i<ranked.length;i++)ranked[i]={...sourceByName.get(ranked[i].player),...ranked[i]};
 let estimates=null;try{estimates=auctionValues(players,mode,state);}catch(e){status.textContent="Auction 估值尚不可用："+e.message;}
 const prices=new Map(estimates?.values.map(p=>[p.player.trim().toLocaleLowerCase(),p.price])??[]);
 let yahooPrices=[];try{yahooPrices=JSON.parse(localStorage.getItem("fantasy-draft-lab:v1:prices")||"[]");}catch(e){console.warn("Yahoo 價格資料讀取失敗",e);}
 const yahooMap=new Map(yahooPrices.map(p=>[p.player.trim().toLocaleLowerCase(),p]));
 const fieldValue=(p,k)=>{const id=p.player.trim().toLocaleLowerCase(),y=yahooMap.get(id);switch(k){case "positions":return p.positions.join("/");case "gp":return p.gp;case "z":return mode==="h2h"&&punt.size?p.puntScore:p.total;case "model":return prices.get(id)??null;case "avg":return y?.avg??null;case "proj":return y?.proj??null;case "fgPct":return p.fga?p.fgm/p.fga:null;case "ftPct":return p.fta?p.ftm/p.fta:null;default:return p[k]??null;}};
 const formatValue=(p,k)=>{const v=fieldValue(p,k);if(v===null||v===undefined||!Number.isFinite(v)&&typeof v!=="string")return "—";if(k==="positions")return v;if(["model","avg","proj"].includes(k))return "$"+v;if(["fgPct","ftPct"].includes(k))return (v*100).toFixed(1)+"%";if(k==="gp")return String(v);return Number(v).toFixed(2);};
 const sortKey=typeof rankingSort.column==="number"?({1:"name",3:"gp",4:"z",5:"model",6:"avg",7:"proj"}[rankingSort.column]||"z"):rankingSort.column;
 const sortValue=p=>sortKey==="name"?p.player:fieldValue(p,sortKey);
 ranked.sort((a,b)=>{const x=sortValue(a),y=sortValue(b);if(x==null)return y==null?0:1;if(y==null)return -1;const d=typeof x==="string"?x.localeCompare(y):x-y;return (rankingSort.ascending?d:-d)||a.player.localeCompare(b.player);});
 const shown=visibleRankingFields.slice();if(rankingFieldLabel[sortKey]&&!shown.includes(sortKey))shown.unshift(sortKey);
 const header=document.createElement("tr");
 for(const [name,key] of [["排名","rank"],["球員","name"],...shown.map(k=>[rankingFieldLabel[k],k])]){const th=document.createElement("th");th.textContent=name;th.dataset.field=key;if(key!=="rank"&&key!=="positions"){th.className="sortable";th.tabIndex=0;th.setAttribute("role","button");const selected=sortKey===key;th.setAttribute("aria-sort",selected?(rankingSort.ascending?"ascending":"descending"):"none");}header.append(th);}
 for(let start=0;start<ranked.length;start+=25){
 const details=document.createElement("details");details.className="ranking-group";details.dataset.group=String(start/25);details.open=openGroups.has(start/25);
 const summary=document.createElement("summary");summary.textContent=(start+1)+"–"+Math.min(start+25,ranked.length)+" 名球員";details.append(summary);
 const wrap=document.createElement("div");wrap.className="table-wrap ranking-wrap";
 const table=document.createElement("table");table.className="ranking-table";
 const thead=document.createElement("thead");thead.append(header.cloneNode(true));table.append(thead);
 const tbody=document.createElement("tbody");
 ranked.slice(start,start+25).forEach((p,j)=>{const tr=document.createElement("tr");tr.dataset.player=p.player;tr.title="點選查看 9-Cat 明細";cell(tr,start+j+1);const nameCell=cell(tr,p.player);{const original=document.createElement("small");original.className="ranking-overall-rank";original.textContent="9-Cat #"+(overallRanks.get(p.player.trim().toLocaleLowerCase())??"—");nameCell.append(original);}for(const k of shown)cell(tr,formatValue(p,k));if(shown[0]===sortKey&&rankingFieldLabel[sortKey])tr.children[2].classList.add("ranking-category-value");tbody.append(tr);});
 table.append(tbody);wrap.append(table);details.append(wrap);groups.append(details);
}
 if(estimates){const f=scarcityFactors(players,mode);status.textContent=ranked.length+" 位球員；剩餘預算 $"+estimates.remainingCash+"；位置壓力 C "+f.demand.C+"/"+f.supply.C+"（需求/可用供給，啟發式估值）";}
}

document.getElementById("projections-import").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;try{const players=parseProjections(await file.text());if(players.length<2)throw Error("至少需要兩位球員");displayRankings(players);localStorage.setItem(projectionsKey,JSON.stringify(players));}catch(err){document.getElementById("projection-status").textContent="匯入失敗："+err.message;}finally{e.target.value="";}});
try{const saved=localStorage.getItem(projectionsKey);if(saved){const players=JSON.parse(saved);if(Array.isArray(players)&&players.length>=2)displayRankings(players);}}catch(err){console.warn("預測資料無法恢復",err);}


const labels={fgPct:"FG%",ftPct:"FT%",three:"3PM",pts:"PTS",reb:"REB",ast:"AST",stl:"STL",blk:"BLK",tov:"TO"};
for(const cat of CATEGORIES){const label=document.createElement("label");label.className="punt-choice";const cb=document.createElement("input");cb.type="checkbox";cb.addEventListener("change",()=>{if(cb.checked)punt.add(cat);else punt.delete(cat);if(projectionPlayers.length)displayRankings(projectionPlayers);});label.append(cb,document.createTextNode(" Punt "+labels[cat]));$("punt-options").append(label);}
$("roto-calculate").addEventListener("click",()=>{const out=$("roto-status"),table=$("roto-standings");table.replaceChildren();if(!projectionPlayers.length){out.textContent="請先匯入球員預測資料";return;}try{const result=rotoStandings(state,projectionPlayers);if(!result.ready){out.textContent=result.reason;return;}result.standings.forEach(p=>{const tr=document.createElement("tr");for(const v of ["Team "+p.team,p.points.toFixed(1),...CATEGORIES.map(c=>p.categoryPoints[c].toFixed(1))])cell(tr,v);table.append(tr);});out.textContent="14 隊完整 ROTO 預測積分（同分平分名次積分）";}catch(err){out.textContent="計算失敗："+err.message;}});

$("yahoo-import").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;try{const csv=yahooProjectedToCsv(await file.text());const players=parseProjections(csv);localStorage.setItem(projectionsKey,JSON.stringify(players));projectionPlayers=players;render();$("projection-status").textContent="Yahoo 預測已匯入："+players.length+" 位球員（賽季總數已轉為每場數據）。";}catch(err){$("projection-status").textContent="Yahoo 匯入失敗："+err.message;}finally{e.target.value="";}});

$("yahoo-paste-import").addEventListener("click",()=>{try{const source=$("yahoo-paste").value.trim();if(!source)throw Error("請先貼上 Yahoo 預測表格");let incoming;try{incoming=parseYahooMobileText(source);}catch(mobileError){if(/^\s*Players\t/i.test(source)){incoming=parseProjections(yahooProjectedToCsv(source));}else{throw mobileError;}}const players=mergeProjectionPlayers(projectionPlayers,incoming);localStorage.setItem(projectionsKey,JSON.stringify(players));projectionPlayers=players;render();$("projection-status").textContent="Yahoo 本次解析 "+incoming.length+" 人，合併後共 "+players.length+" 人（同名球員以新資料更新）；已保存在本機。";}catch(err){$("projection-status").textContent="貼上解析失敗："+err.message;}});

const fullBackupKey="fantasy-draft-lab:v1:prices";
function downloadJson(data,name){const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$("export-all-csv").addEventListener("click",()=>{try{const prices=JSON.parse(localStorage.getItem(fullBackupKey)||"[]");const csv=backupToCsv(makeBackup(load("h2h"),load("roto"),projectionPlayers,prices));const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="fantasy-draft-lab-full-data.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);feedback("CSV 已匯出；完整還原請使用 JSON 備份");}catch(e){feedback("CSV 匯出失敗："+e.message);}});
$("export-all").addEventListener("click",()=>{try{const prices=JSON.parse(localStorage.getItem(fullBackupKey)||"[]");downloadJson(makeBackup(load("h2h"),load("roto"),projectionPlayers,prices),"fantasy-draft-lab-full-backup.json");feedback("完整備份已產生：H2H、ROTO、球員預測及價格。");}catch(err){feedback("備份失敗："+err.message);}});
$("import-all").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;try{const data=readBackup(await file.text());if(!confirm("將以完整備份覆蓋本機兩個聯盟、預測及價格資料。確定還原？"))return;
 const before=[key("h2h"),key("roto"),projectionsKey,fullBackupKey].map(k=>[k,localStorage.getItem(k)]);
 try{localStorage.setItem(key("h2h"),JSON.stringify(data.h2h));localStorage.setItem(key("roto"),JSON.stringify(data.roto));localStorage.setItem(projectionsKey,JSON.stringify(data.players));localStorage.setItem(fullBackupKey,JSON.stringify(data.prices));}catch(err){for(const [k,v] of before){if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v);}throw err;}
 state=load(mode);projectionPlayers=data.players;render();feedback("完整還原成功："+data.players.length+" 位預測球員、"+data.prices.length+" 筆價格，H2H 與 ROTO 紀錄均已還原。");
 }catch(err){feedback("完整還原失敗："+err.message);}finally{e.target.value="";}});
function showPlayerDetail(player,row){
 const existing=document.querySelector(".inline-player-detail");
 if(existing){
  const same=existing.dataset.player===player;
  existing.remove();
  if(same)return;
 }
 const p=projectionPlayers.find(x=>x.player===player);if(!p||!row)return;
 const detailRow=document.createElement("tr");detailRow.className="inline-player-detail";detailRow.dataset.player=player;
 const td=document.createElement("td");td.colSpan=row.children.length;
 const card=document.createElement("div");card.className="inline-player-card";
 const header=document.createElement("div");header.className="inline-player-header";
 const title=document.createElement("h3");title.textContent=p.player+" · "+p.positions.join("/")+" · GP "+p.gp;
 const close=document.createElement("button");close.type="button";close.className="secondary inline-detail-close";close.textContent="收合 ×";close.addEventListener("click",()=>detailRow.remove());
 header.append(title,close);card.append(header);
 const grid=document.createElement("div");grid.className="detail-grid";
 const fields=[["FG%",p.fga?(100*p.fgm/p.fga).toFixed(1)+"%":"—"],["FT%",p.fta?(100*p.ftm/p.fta).toFixed(1)+"%":"—"],["3PM",p.three.toFixed(2)],["PTS",p.pts.toFixed(2)],["REB",p.reb.toFixed(2)],["AST",p.ast.toFixed(2)],["STL",p.stl.toFixed(2)],["BLK",p.blk.toFixed(2)],["TO",p.tov.toFixed(2)],["FGM/FGA",p.fgm.toFixed(2)+"/"+p.fga.toFixed(2)],["FTM/FTA",p.ftm.toFixed(2)+"/"+p.fta.toFixed(2)]];
 for(const [label,value] of fields){const item=document.createElement("div");item.className="metric";const small=document.createElement("span"),strong=document.createElement("b");small.textContent=label;strong.textContent=value;item.append(small,strong);grid.append(item);}
 card.append(grid);td.append(card);detailRow.append(td);row.after(detailRow);
}
$("ranking-groups").addEventListener("click",e=>{const tr=e.target.closest("tbody tr[data-player]");if(tr&&!tr.classList.contains("inline-player-detail"))showPlayerDetail(tr.dataset.player,tr);});

$("yahoo-prices-import").addEventListener("click",()=>{try{
 const incoming=parseYahooPrices($("yahoo-prices-paste").value);
 const existing=JSON.parse(localStorage.getItem(fullBackupKey)||"[]");
 const merged=mergeYahooPrices(existing,incoming);
 localStorage.setItem(fullBackupKey,JSON.stringify(merged));
 $("price-status").textContent="Yahoo 價格本次 "+incoming.length+" 人，累積 "+merged.length+" 人，已保存在本機。";
 if(projectionPlayers.length)displayRankings(projectionPlayers);
 }catch(err){$("price-status").textContent="Yahoo 價格解析失敗："+err.message;}});

// Compact category sort buttons, without a duplicate dropdown.
document.querySelectorAll("[data-sort-category]").forEach(button=>button.addEventListener("click",()=>{const column=button.dataset.sortCategory;rankingSort={column,ascending:rankingSort.column===column?!rankingSort.ascending:column==="tov"};if(projectionPlayers.length)displayRankings(projectionPlayers);}));

// Inline detail is dismissed by its close button or by tapping the same player again.

// Persist column preferences locally; do not change projection or pricing data.
document.querySelectorAll("[data-ranking-field]").forEach(cb=>cb.addEventListener("change",()=>{visibleRankingFields=rankingFields.map(x=>x[0]).filter(k=>document.querySelector('[data-ranking-field="'+k+'"]').checked);localStorage.setItem(rankingFieldKey,JSON.stringify(visibleRankingFields));if(projectionPlayers.length)displayRankings(projectionPlayers);}));
document.getElementById("ranking-columns-all").addEventListener("click",()=>{visibleRankingFields=rankingFields.map(x=>x[0]);localStorage.setItem(rankingFieldKey,JSON.stringify(visibleRankingFields));if(projectionPlayers.length)displayRankings(projectionPlayers);});
document.getElementById("ranking-columns-default").addEventListener("click",()=>{visibleRankingFields=defaultRankingFields.slice();localStorage.setItem(rankingFieldKey,JSON.stringify(visibleRankingFields));if(projectionPlayers.length)displayRankings(projectionPlayers);});

// Sort from any expanded group's header.
$("ranking-groups").addEventListener("click",e=>{const th=e.target.closest("th.sortable");if(!th)return;const k=th.dataset.field;const current=typeof rankingSort.column==="number"?({1:"name",3:"gp",4:"z",5:"model",6:"avg",7:"proj"}[rankingSort.column]||"z"):rankingSort.column;rankingSort={column:k==="name"?1:({gp:3,z:4,model:5,avg:6,proj:7}[k]??k),ascending:current===k?!rankingSort.ascending:k==="name"||k==="tov"};displayRankings(projectionPlayers);});
$("ranking-groups").addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.matches("th.sortable")){e.preventDefault();e.target.click();}});


const mockArchiveKey=m=>"fantasy-draft-lab:v1:mock-archive:"+m;
let batchGeneration=0;
let batchResult=null;
function loadArchive(){try{const x=JSON.parse(localStorage.getItem(mockArchiveKey(mode))||"null");return normalizeArchive(x);}catch{return null;}}
async function storeArchive(data){
 // Save each roster once; recompute cross-run recommendations from stored stats.
 const compact={version:3,modelVersion:2,biddingModel:data.biddingModel,results:data.results.map(r=>({
  seed:r.seed,scenario:r.scenario,mode:r.mode,winner:r.winner,metric:r.metric,
  teams:r.teams.map(t=>({
   team:t.team,rank:t.rank,score:t.score,spent:t.spent,bargain:t.bargain,
   stats:t.stats,players:t.players.map(p=>[p.player,p.price])
  }))
 }))};
 try{await writeMockArchive(mockArchiveKey(mode),compact);return true;}
 catch(e){console.warn("Mock archive IndexedDB save failed",e);return false;}
}
function normalizeArchive(data){
 if(!data||!Array.isArray(data.results))return null;
 if(data.version!==3)return data;
 return {...data,results:data.results.map(r=>({...r,teams:r.teams.map(t=>({
  ...t,players:t.players.map(p=>Array.isArray(p)?{player:p[0],price:p[1]}:p)
 }))}))};
}
const batchSection=document.createElement("section");batchSection.className="panel";batchSection.id="mock-archive-panel";
batchSection.innerHTML='<h2>Mock Draft 模擬紀錄庫</h2><p class="hint">H2H 新模擬採用 Auction V5；ROTO 維持原模型。舊模擬紀錄不會自動改成 V5，請重新產生 100 場。</p><p class="hint">每場 14 隊完整模擬；按場次查看最佳球隊、排名與陣容。結果是模型產生，並非 Yahoo 真實成交紀錄。僅保存在目前瀏覽器。</p><div class="actions"><button type="button" id="batch-run">產生 100 場 Mock Draft</button><button type="button" id="batch-clear" class="secondary">清除本機模擬紀錄</button></div><p id="batch-status" role="status"></p><div id="batch-top"><h3>跨場最佳策略 Top 5</h3><p class="hint">跨場九項預測比較，前三名優先參考；非實際勝率。</p><div id="batch-top-list"></div></div><label>選擇模擬場次 <select id="batch-select"></select></label><div class="table-wrap"><table><thead><tr><th>場內排名</th><th>隊伍</th><th>預估分數</th><th>花費</th><th>與 Yahoo 價差</th></tr></thead><tbody id="batch-results"></tbody></table></div><details id="batch-details"><summary>球隊完整陣容與成交價</summary><div id="batch-detail"></div></details>';
document.querySelector("#live-names").before(batchSection);setTab(activeTab);
function showBatch(){
 const select=$("batch-select"),body=$("batch-results");select.replaceChildren();body.replaceChildren();$("batch-detail").replaceChildren();$("batch-top-list").replaceChildren();
 if(!batchResult){$("batch-status").textContent="目前沒有保存的模擬紀錄";return;}
 batchResult.results.forEach((run,i)=>{const o=document.createElement("option");o.value=i;o.textContent="模擬 #"+(i+1)+" · 最佳 Team "+run.winner+" · "+run.scenario;select.append(o);});
 renderTopTeams();
 renderRun(0);
 $("batch-status").textContent="已保存 "+batchResult.results.length+" 場模擬，點選場次及球隊查看結果。";
}
function renderTopTeams(){
 const root=$("batch-top-list");
 let prices=[];try{prices=JSON.parse(localStorage.getItem("fantasy-draft-lab:v1:prices")||"[]");}catch{}
 const best=batchResult?.modelVersion===2?recommendMockTeams(batchResult.results,5,Array.isArray(prices)?prices:[]):[];
 if(batchResult?.modelVersion!==2){const note=document.createElement("p");note.className="hint";note.textContent="既有紀錄為舊版價格模型；請重新產生 100 場，才能取得 V2 推薦。";root.append(note);}else if(!best.length){const note=document.createElement("p");note.className="hint";note.textContent="目前沒有通過明星價格合理性檢查的推薦球隊。";root.append(note);}
 best.forEach((t,i)=>{
  const button=document.createElement("button");
  button.type="button";button.className="secondary";
  button.style.cssText="display:block;width:100%;text-align:left;white-space:normal;margin:8px 0";
  button.textContent="Top "+(i+1)+" · 模擬 #"+t.run+" · Team "+t.team+" · 九項 Z "+t.overallScore.toFixed(2);
  button.addEventListener("click",()=>{
   $("batch-select").value=String(t.run-1);
   renderRun(t.run-1);
   const row=[...$("batch-results").rows].find(r=>r.cells[1]?.textContent==="Team "+t.team);
   if(row)row.click();
   $("batch-details").scrollIntoView({block:"start",behavior:"smooth"});
  });
  root.append(button);
 });
}
function renderRun(index){
 const run=batchResult?.results[index];if(!run)return;
 const body=$("batch-results");body.replaceChildren();$("batch-detail").replaceChildren();
 [...run.teams].sort((a,b)=>a.rank-b.rank).forEach(t=>{
  const tr=document.createElement("tr");for(const v of [t.rank===1?"🏆 第 1 名":t.rank,"Team "+t.team,Number(t.score).toFixed(2),"$"+t.spent,"$"+Math.round(t.bargain)])cell(tr,v);
  tr.tabIndex=0;tr.setAttribute("role","button");
  const open=()=>{const detail=$("batch-detail");detail.replaceChildren();const title=document.createElement("h3");title.textContent="模擬 #"+(index+1)+" · Team "+t.team+" · 場內第 "+t.rank+" 名";detail.append(title);const summary=document.createElement("p");summary.textContent="預估分數 "+Number(t.score).toFixed(2)+"｜花費 $"+t.spent+"｜與 Yahoo 價差 $"+Math.round(t.bargain);detail.append(summary);t.players.forEach(p=>{const row=document.createElement("p");row.textContent=p.player+" — $"+p.price;detail.append(row);});$("batch-details").open=true;};
  tr.addEventListener("click",open);tr.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open();}});body.append(tr);
 });
}
$("batch-select").addEventListener("change",e=>renderRun(Number(e.target.value)));
$("batch-run").addEventListener("click",()=>{
 const btn=$("batch-run"),generation=++batchGeneration,selectedMode=mode,players=projectionPlayers.slice();
 btn.disabled=true;$("batch-status").textContent="準備模擬…";
 let prices=[];
 try{const stored=JSON.parse(localStorage.getItem("fantasy-draft-lab:v1:prices")||"[]");if(!Array.isArray(stored))throw Error("Yahoo 價格資料格式錯誤");prices=stored;}
 catch(e){$("batch-status").textContent="無法讀取 Yahoo 價格："+e.message;btn.disabled=false;return;}
 if(players.length<CONFIG[selectedMode].teams*CONFIG[selectedMode].slots){$("batch-status").textContent="球員預測不足，無法模擬";btn.disabled=false;return;}
 const results=[],scenarios=["normal","normal","aggressive","conservative","mixed"];
 const next=async()=>{
  if(generation!==batchGeneration||mode!==selectedMode){btn.disabled=false;return;}
  try{
   for(let j=0;j<2&&results.length<100;j++){
    const i=results.length;
    results.push(runFullMock(players,prices,selectedMode,i+1,scenarios[i%scenarios.length],selectedMode==="h2h"?"auction-v5":"normal"));
   }
   $("batch-status").textContent="已完成 "+results.length+" / 100 場…";
   if(results.length<100){setTimeout(next,0);return;}
   batchResult={results,ranked:[],count:100,modelVersion:2,biddingModel:selectedMode==="h2h"?"Auction V5":"Normal"};
   const saved=await storeArchive(batchResult);
   try{showBatch();}catch(renderError){console.error("Mock result display failed",renderError);$("batch-status").textContent="100 場已完成"+(saved?"並保存":"（尚未保存）")+"，但推薦顯示失敗："+renderError.message;return;}
   if(!saved)$("batch-status").textContent="100 場完成，但本機儲存空間不足；本次結果僅暫存。";
  }catch(e){$("batch-status").textContent="模擬中止（已完成 "+results.length+" 場）："+e.message;}
  finally{if(results.length===100||generation!==batchGeneration||$("batch-status").textContent.startsWith("模擬中止"))btn.disabled=false;}
 };
 setTimeout(next,0);
});
$("batch-clear").addEventListener("click",async()=>{if(!confirm("確定清除目前模式的 Mock Draft 紀錄？"))return;batchGeneration++;$("batch-run").disabled=false;try{await deleteMockArchive(mockArchiveKey(mode));}catch(e){console.warn("Mock archive delete failed",e);}localStorage.removeItem(mockArchiveKey(mode));batchResult=null;showBatch();});
batchResult=loadArchive();showBatch();restoreMockArchive();

async function restoreMockArchive(){const currentMode=mode;try{const saved=await readMockArchive(mockArchiveKey(currentMode));if(currentMode===mode&&saved?.results?.length){batchResult=normalizeArchive(saved);showBatch();}}catch(e){console.warn("Mock archive load failed",e);}}
