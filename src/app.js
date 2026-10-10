import {parseYahooPrices,mergeYahooPrices} from "./yahoo-prices.js";
import {makeBackup,readBackup} from "./backup.js";
import {parseYahooMobileText,mergeProjectionPlayers} from "./yahoo-mobile.js";
import {yahooProjectedToCsv} from "./yahoo-import.js";
import {parseProjections,rankProjections} from "./projections.js";
import {auctionValues} from "./auction.js";
import {CATEGORIES,puntRankings,rotoStandings} from "./strategy.js";
import {scarcityFactors,simulateDraft} from "./simulation.js";
import {evaluateDraft} from "./evaluation.js";
import {rosterForTeam,canAddToRoster} from "./roster.js";
import {CONFIG,fresh,teamStats,addPick,validateState} from "./model.js";
const $=id=>document.getElementById(id),key=mode=>"fantasy-draft-lab:v1:"+mode;
let mode="h2h",state;
let projectionPlayers=[];
const punt=new Set();
let rankingSort={column:4,ascending:false};
function load(m){try{const raw=localStorage.getItem(key(m));return raw?validateState(JSON.parse(raw),m):fresh(m)}catch(e){console.warn("無法載入本機資料",e);return fresh(m)}}
function save(){localStorage.setItem(key(mode),JSON.stringify(state));}
function cell(row,text){const td=document.createElement("td");td.textContent=String(text);row.append(td);}
function render(){const c=CONFIG[mode];$("punt-controls").hidden=mode!=="h2h";$("roto-controls").hidden=mode!=="roto";$("mode").value=mode;$("summary").replaceChildren();for(const [label,value] of [["隊伍",c.teams],["每隊預算","$"+c.budget],["每隊名額",c.slots],["總選秀名額",c.teams*c.slots]]){const el=document.createElement("div");el.className="metric";const s=document.createElement("span"),b=document.createElement("b");s.textContent=label;b.textContent=value;el.append(s,b);$("summary").append(el);}$("roster").textContent="位置配置："+c.roster;$("team").replaceChildren();$("teams").replaceChildren();for(let n=1;n<=c.teams;n++){const opt=document.createElement("option");opt.value=n;opt.textContent="Team "+n;$("team").append(opt);const t=teamStats(state,n),tr=document.createElement("tr");for(const value of ["Team "+n,t.count+"/"+c.slots,"$"+t.spent,"$"+t.remaining,"$"+t.maxBid,projectionPlayers.length?(()=>{const r=rosterForTeam(state,projectionPlayers,n);return r.assignment===null?"位置衝突":r.unknown?"待核對 "+r.unknown:"可配置";})():"未載入"])cell(tr,value);$("teams").append(tr);}$("history").replaceChildren();state.picks.forEach((p,i)=>{const tr=document.createElement("tr");for(const value of [i+1,p.player,"Team "+p.team,"$"+p.price])cell(tr,value);$("history").append(tr);});$("undo").disabled=!state.picks.length;if(projectionPlayers.length)displayRankings(projectionPlayers);}
function checkPosition(pick){if(!projectionPlayers.length)return;const map=new Map(projectionPlayers.map(p=>[p.player.toLocaleLowerCase(),p]));const target=map.get(pick.player.trim().toLocaleLowerCase());if(!target)return;const existing=state.picks.filter(p=>p.team===Number(pick.team)).map(p=>map.get(p.player.toLocaleLowerCase())).filter(Boolean);if(!canAddToRoster(existing,target,mode))throw Error("球員位置無法排入該隊剩餘陣容");}
function feedback(message){$("feedback").textContent=message;}
$("mode").addEventListener("change",e=>{mode=e.target.value;state=load(mode);feedback("");render();});
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
 ranked.slice(start,start+25).forEach((p,j)=>{const tr=document.createElement("tr");tr.dataset.player=p.player;tr.title="點選查看 9-Cat 明細";cell(tr,start+j+1);const nameCell=cell(tr,p.player);if(sortKey!=="z"||(mode==="h2h"&&punt.size)){const original=document.createElement("small");original.className="ranking-overall-rank";original.textContent="9-Cat 總排名 #"+(overallRanks.get(p.player.trim().toLocaleLowerCase())??"—");nameCell.append(original);}for(const k of shown)cell(tr,formatValue(p,k));if(shown[0]===sortKey&&rankingFieldLabel[sortKey])tr.children[2].classList.add("ranking-category-value");tbody.append(tr);});
 table.append(tbody);wrap.append(table);details.append(wrap);groups.append(details);
}
 if(estimates){const f=scarcityFactors(players,mode);status.textContent=ranked.length+" 位球員；剩餘預算 $"+estimates.remainingCash+"；位置壓力 C "+f.demand.C+"/"+f.supply.C+"（需求/可用供給，啟發式估值）";}
}

document.getElementById("projections-import").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;try{const players=parseProjections(await file.text());if(players.length<2)throw Error("至少需要兩位球員");displayRankings(players);localStorage.setItem(projectionsKey,JSON.stringify(players));}catch(err){document.getElementById("projection-status").textContent="匯入失敗："+err.message;}finally{e.target.value="";}});
try{const saved=localStorage.getItem(projectionsKey);if(saved){const players=JSON.parse(saved);if(Array.isArray(players)&&players.length>=2)displayRankings(players);}}catch(err){console.warn("預測資料無法恢復",err);}

document.getElementById("simulate").addEventListener("click",()=>{const output=document.getElementById("simulation-status");if(!projectionPlayers.length){output.textContent="請先匯入足量球員資料";return;}try{const result=simulateDraft(projectionPlayers,mode);const evaluation=evaluateDraft(result.state,projectionPlayers);const body=$("simulation-ranking");body.replaceChildren();evaluation.standings.forEach((t,i)=>{const tr=document.createElement("tr");for(const value of [i+1,"Team "+t.team,mode==="roto"?t.score.toFixed(1):((t.score*100).toFixed(1)+"%"),mode==="roto"?"—":t.wins+" / "+t.ties+" / "+t.losses])cell(tr,value);body.append(tr);});output.textContent="模擬完成："+result.state.picks.length+" 人；"+evaluation.metric+"。注意：目前仍為固定順序、非市場競標的測試模擬，排名不能作為選秀建議；不修改你的真實紀錄。";}catch(err){output.textContent="模擬未通過："+err.message;}});

const labels={fgPct:"FG%",ftPct:"FT%",three:"3PM",pts:"PTS",reb:"REB",ast:"AST",stl:"STL",blk:"BLK",tov:"TO"};
for(const cat of CATEGORIES){const label=document.createElement("label");label.className="punt-choice";const cb=document.createElement("input");cb.type="checkbox";cb.addEventListener("change",()=>{if(cb.checked)punt.add(cat);else punt.delete(cat);if(projectionPlayers.length)displayRankings(projectionPlayers);});label.append(cb,document.createTextNode(" Punt "+labels[cat]));$("punt-options").append(label);}
$("roto-calculate").addEventListener("click",()=>{const out=$("roto-status"),table=$("roto-standings");table.replaceChildren();if(!projectionPlayers.length){out.textContent="請先匯入球員預測資料";return;}try{const result=rotoStandings(state,projectionPlayers);if(!result.ready){out.textContent=result.reason;return;}result.standings.forEach(p=>{const tr=document.createElement("tr");for(const v of ["Team "+p.team,p.points.toFixed(1),...CATEGORIES.map(c=>p.categoryPoints[c].toFixed(1))])cell(tr,v);table.append(tr);});out.textContent="14 隊完整 ROTO 預測積分（同分平分名次積分）";}catch(err){out.textContent="計算失敗："+err.message;}});

$("yahoo-import").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;try{const csv=yahooProjectedToCsv(await file.text());const players=parseProjections(csv);localStorage.setItem(projectionsKey,JSON.stringify(players));projectionPlayers=players;render();$("projection-status").textContent="Yahoo 預測已匯入："+players.length+" 位球員（賽季總數已轉為每場數據）。";}catch(err){$("projection-status").textContent="Yahoo 匯入失敗："+err.message;}finally{e.target.value="";}});

$("yahoo-paste-import").addEventListener("click",()=>{try{const source=$("yahoo-paste").value.trim();if(!source)throw Error("請先貼上 Yahoo 預測表格");let incoming;try{incoming=parseYahooMobileText(source);}catch(mobileError){if(/^\s*Players\t/i.test(source)){incoming=parseProjections(yahooProjectedToCsv(source));}else{throw mobileError;}}const players=mergeProjectionPlayers(projectionPlayers,incoming);localStorage.setItem(projectionsKey,JSON.stringify(players));projectionPlayers=players;render();$("projection-status").textContent="Yahoo 本次解析 "+incoming.length+" 人，合併後共 "+players.length+" 人（同名球員以新資料更新）；已保存在本機。";}catch(err){$("projection-status").textContent="貼上解析失敗："+err.message;}});

const fullBackupKey="fantasy-draft-lab:v1:prices";
function downloadJson(data,name){const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$("export-all").addEventListener("click",()=>{try{const prices=JSON.parse(localStorage.getItem(fullBackupKey)||"[]");downloadJson(makeBackup(load("h2h"),load("roto"),projectionPlayers,prices),"fantasy-draft-lab-full-backup.json");feedback("完整備份已產生：H2H、ROTO、球員預測及價格。");}catch(err){feedback("備份失敗："+err.message);}});
$("import-all").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;try{const data=readBackup(await file.text());if(!confirm("將以完整備份覆蓋本機兩個聯盟、預測及價格資料。確定還原？"))return;
 const before=[key("h2h"),key("roto"),projectionsKey,fullBackupKey].map(k=>[k,localStorage.getItem(k)]);
 try{localStorage.setItem(key("h2h"),JSON.stringify(data.h2h));localStorage.setItem(key("roto"),JSON.stringify(data.roto));localStorage.setItem(projectionsKey,JSON.stringify(data.players));localStorage.setItem(fullBackupKey,JSON.stringify(data.prices));}catch(err){for(const [k,v] of before){if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v);}throw err;}
 state=load(mode);projectionPlayers=data.players;render();feedback("完整還原成功："+data.players.length+" 位預測球員、"+data.prices.length+" 筆價格，H2H 與 ROTO 紀錄均已還原。");
 }catch(err){feedback("完整還原失敗："+err.message);}finally{e.target.value="";}});
function showPlayerDetail(player){
 const p=projectionPlayers.find(x=>x.player===player);if(!p)return;
 const details=$("player-detail");details.replaceChildren();const close=document.createElement("button");close.type="button";close.className="detail-close";close.textContent="關閉 ×";close.addEventListener("click",()=>{details.hidden=true;});details.append(close);const title=document.createElement("h3");title.textContent=p.player+" · "+p.positions.join("/")+" · GP "+p.gp;details.append(title);
 const grid=document.createElement("div");grid.className="detail-grid";
 const fields=[["FG%",p.fga?(100*p.fgm/p.fga).toFixed(1)+"%":"—"],["FT%",p.fta?(100*p.ftm/p.fta).toFixed(1)+"%":"—"],["3PM",p.three.toFixed(2)],["PTS",p.pts.toFixed(2)],["REB",p.reb.toFixed(2)],["AST",p.ast.toFixed(2)],["STL",p.stl.toFixed(2)],["BLK",p.blk.toFixed(2)],["TO",p.tov.toFixed(2)],["FGM/FGA",p.fgm.toFixed(2)+"/"+p.fga.toFixed(2)],["FTM/FTA",p.ftm.toFixed(2)+"/"+p.fta.toFixed(2)]];
 for(const [label,value] of fields){const item=document.createElement("div");item.className="metric";const small=document.createElement("span"),strong=document.createElement("b");small.textContent=label;strong.textContent=value;item.append(small,strong);grid.append(item);}details.append(grid);details.hidden=false;details.scrollTop=0;close.focus();
}
$("ranking-groups").addEventListener("click",e=>{const tr=e.target.closest("tbody tr");if(tr?.dataset.player)showPlayerDetail(tr.dataset.player);});

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

// Dismiss the detail overlay without scrolling through 200 rows.
document.getElementById("player-detail").addEventListener("click",e=>{if(e.target.id==="player-detail")e.currentTarget.hidden=true;});
document.addEventListener("keydown",e=>{if(e.key==="Escape")document.getElementById("player-detail").hidden=true;});

// Persist column preferences locally; do not change projection or pricing data.
document.querySelectorAll("[data-ranking-field]").forEach(cb=>cb.addEventListener("change",()=>{visibleRankingFields=rankingFields.map(x=>x[0]).filter(k=>document.querySelector('[data-ranking-field="'+k+'"]').checked);localStorage.setItem(rankingFieldKey,JSON.stringify(visibleRankingFields));if(projectionPlayers.length)displayRankings(projectionPlayers);}));
document.getElementById("ranking-columns-all").addEventListener("click",()=>{visibleRankingFields=rankingFields.map(x=>x[0]);localStorage.setItem(rankingFieldKey,JSON.stringify(visibleRankingFields));if(projectionPlayers.length)displayRankings(projectionPlayers);});
document.getElementById("ranking-columns-default").addEventListener("click",()=>{visibleRankingFields=defaultRankingFields.slice();localStorage.setItem(rankingFieldKey,JSON.stringify(visibleRankingFields));if(projectionPlayers.length)displayRankings(projectionPlayers);});

// Sort from any expanded group's header.
$("ranking-groups").addEventListener("click",e=>{const th=e.target.closest("th.sortable");if(!th)return;const k=th.dataset.field;const current=typeof rankingSort.column==="number"?({1:"name",3:"gp",4:"z",5:"model",6:"avg",7:"proj"}[rankingSort.column]||"z"):rankingSort.column;rankingSort={column:k==="name"?1:({gp:3,z:4,model:5,avg:6,proj:7}[k]??k),ascending:current===k?!rankingSort.ascending:k==="name"||k==="tov"};displayRankings(projectionPlayers);});
$("ranking-groups").addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.matches("th.sortable")){e.preventDefault();e.target.click();}});
