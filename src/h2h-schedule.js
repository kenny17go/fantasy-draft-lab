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
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+"T12:00:00Z"))||!TEAMS.includes(home)||!TEAMS.includes(away)||home===away)throw Error("賽程資料有誤："+line);
  const key=date+"|"+[home,away].sort().join("|");if(seen.has(key))continue;seen.add(key);
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

export function parseEspnSchedule(payload){
 const games=[],seen=new Set();
 for(const event of payload?.events||[]){
  if(event.season?.type!==2 && event.season?.type!==undefined)continue;
  const competitors=event.competitions?.[0]?.competitors||[];
  const home=teamCode(competitors.find(c=>c.homeAway==="home")?.team?.abbreviation);
  const away=teamCode(competitors.find(c=>c.homeAway==="away")?.team?.abbreviation);
  if(!TEAMS.includes(home)||!TEAMS.includes(away)||home===away)continue;
  const timestamp=event.date||event.competitions?.[0]?.date;
  if(!timestamp||!Number.isFinite(Date.parse(timestamp)))continue;
  const date=new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(timestamp));
  const key=event.id||date+"|"+[home,away].sort().join("|");
  if(seen.has(key))continue;seen.add(key);
  games.push({date,home,away});
 }
 return games.sort((a,b)=>a.date.localeCompare(b.date));
}
export async function fetchEspnWeek(start,fetcher=fetch){
 const monday=weekStart(start),s=monday.replaceAll("-","");
 const end=new Date(monday+"T12:00:00Z");end.setUTCDate(end.getUTCDate()+6);
 const e=end.toISOString().slice(0,10).replaceAll("-","");
 const url="https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates="+s+"-"+e+"&limit=150";
 const response=await fetcher(url);
 if(!response.ok)throw Error("賽程來源回應 HTTP "+response.status);
 const payload=await response.json(),games=parseEspnSchedule(payload);
 if(!games.length)throw Error("此週未取得例行賽資料；請稍後再試或使用 CSV");
 return games;
}
