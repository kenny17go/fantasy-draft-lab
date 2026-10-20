import {rosterWeek} from "./h2h-roster.js";
export const CATEGORIES=["FG%","FT%","3PM","PTS","REB","AST","STL","BLK","TO"];
const fields=["name","fgm","fga","ftm","fta","threes","pts","reb","ast","stl","blk","to"];
function number(value,label){const n=Number(value);if(value===""||!Number.isFinite(n)||n<0)throw Error("無效數值："+label);return n;}
/** Daily per-game projections; shooting percentages must be reconstructed from makes/attempts. */
export function parseNineCatCsv(text){
 const lines=String(text||"").replace(/\r/g,"").split("\n").filter(x=>x.trim());
 if(!lines.length)throw Error("預測 CSV 為空");
 const header=lines.shift().split(",").map(x=>x.trim().toLowerCase());
 if(fields.some(f=>!header.includes(f)))throw Error("CSV 必須包含："+fields.join(","));
 const map=new Map();
 for(const line of lines){
  const cells=line.split(",").map(x=>x.trim()),name=cells[header.indexOf("name")];
  if(!name)throw Error("缺少球員名稱");
  const key=name.toLowerCase();if(map.has(key))throw Error("重複球員："+name);
  const stats={name};for(const f of fields.slice(1))stats[f]=number(cells[header.indexOf(f)]??"",name+" "+f);
  if(stats.fgm>stats.fga||stats.ftm>stats.fta)throw Error("命中數不能大於出手數："+name);
  if(stats.threes>stats.fgm)throw Error("三分命中不能大於投籃命中："+name);
  map.set(key,stats);
 }
 return map;
}
export function projectRoster(games,roster,date,projections){
 const players=rosterWeek(games,roster,date),totals=Object.fromEntries(fields.slice(1).map(f=>[f,0]));
 const missing=[];
 for(const p of players){
  const stats=projections.get(p.name.toLowerCase());
  if(!stats){missing.push(p.name);continue;}
  for(const f of fields.slice(1))totals[f]+=stats[f]*p.games;
 }
 return {players,missing,totals,fgPct:totals.fga?totals.fgm/totals.fga:null,ftPct:totals.fta?totals.ftm/totals.fta:null,complete:missing.length===0};
}
export function compareNineCat(games,mine,opponent,date,projections){
 const a=projectRoster(games,mine,date,projections),b=projectRoster(games,opponent,date,projections);
 const keys=["fgPct","ftPct","threes","pts","reb","ast","stl","blk","to"];
 const complete=a.complete&&b.complete;
 const categories=keys.map((key,i)=>{
  const left=key.endsWith("Pct")?a[key]:a.totals[key],right=key.endsWith("Pct")?b[key]:b.totals[key];
  const result=!complete||left===null||right===null?"N/A":left===right?"tie":(key==="to"?left<right:left>right)?"mine":"opponent";
  return {category:CATEGORIES[i],mine:left,opponent:right,result};
 });
 return {mine:a,opponent:b,categories,complete};
}
