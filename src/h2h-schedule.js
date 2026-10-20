// Isolated H2H schedule grid: does not touch auction, mock or roster state.
export const TEAMS=["ATL","BOS","BKN","CHA","CHI","CLE","DAL","DEN","DET","GSW","HOU","IND","LAC","LAL","MEM","MIA","MIL","MIN","NOP","NYK","OKC","ORL","PHI","PHX","POR","SAC","SAS","TOR","UTA","WAS"];
const alias={BRK:"BKN",PHO:"PHX",SA:"SAS",GS:"GSW",NO:"NOP",NY:"NYK",UTAH:"UTA"};
export const teamCode=s=>alias[String(s||"").trim().toUpperCase()]||String(s||"").trim().toUpperCase();
export function parseScheduleCsv(text){
 const lines=String(text||"").replace(/\r/g,"").split("\n").filter(x=>x.trim());
 if(!lines.length)throw Error("賽程檔案為空");
 const head=lines.shift().split(",").map(x=>x.trim().toLowerCase());
 const col=k=>head.indexOf(k);
 if(["date","home","away"].some(k=>col(k)<0))throw Error("需要 date,home,away 三個欄位（美國比賽日期）");
 const games=[],seen=new Set();
 for(const line of lines){
  const cells=line.split(",").map(x=>x.trim()),date=cells[col("date")],home=teamCode(cells[col("home")]),away=teamCode(cells[col("away")]);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+"T12:00:00Z"))||new Date(date+"T12:00:00Z").toISOString().slice(0,10)!==date||!TEAMS.includes(home)||!TEAMS.includes(away)||home===away)throw Error("賽程資料有誤："+line);
  const key=date+"|"+[home,away].sort().join("|");if(seen.has(key))throw Error("重複賽程："+line);seen.add(key);
  games.push({date,home,away});
 }
 return games.sort((a,b)=>a.date.localeCompare(b.date));
}
export function weekStart(date){
 const d=new Date(date+"T12:00:00Z");if(!Number.isFinite(d.getTime()))throw Error("日期無效");
 d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);
 return d.toISOString().slice(0,10);
}
export function scheduleGrid(games,start){
 const monday=weekStart(start),end=new Date(monday+"T12:00:00Z");end.setUTCDate(end.getUTCDate()+7);
 const dates=Array.from({length:7},(_,i)=>{const d=new Date(monday+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+i);return d.toISOString().slice(0,10);});
 const rows=TEAMS.map(team=>({team,days:dates.map(date=>games.filter(g=>g.date===date&&(g.home===team||g.away===team)).map(g=>g.home===team?g.away:"@"+g.home))}));
 return {dates,rows:rows.map(r=>({...r,count:r.days.reduce((n,d)=>n+d.length,0)})),totalByDay:dates.map(date=>games.filter(g=>g.date===date).length)};
}

