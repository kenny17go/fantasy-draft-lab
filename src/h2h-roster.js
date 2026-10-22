import {TEAMS,teamCode,weekStart} from "./h2h-schedule.js";

/** Accept pasted Yahoo-style rows. Team code must be explicit; no name guessing. */
export function parseRoster(text){
 const rows=[],seen=new Set();
 for(const raw of String(text||"").split(/\r?\n/)){
  const line=raw.trim();if(!line)continue;
  const parts=line.split(/\t|,/).map(s=>s.trim()).filter(Boolean);
  if(parts.length<2)throw Error("每列請使用：球員名稱, NBA 球隊代碼");
  const team=teamCode(parts[parts.length-1]);
  if(!TEAMS.includes(team))throw Error("無法辨識 NBA 球隊："+line);
  const name=parts.slice(0,-1).join(" ").trim();
  if(!name||/^(player|球員)$/i.test(name))continue;
  const key=name.toLowerCase();
  if(seen.has(key))throw Error("重複球員："+name);
  seen.add(key);rows.push({name,team});
 }
 return rows;
}
/** Parse copied Yahoo rows with name in first column and team in any later column.
 * Reject ambiguous lines rather than guessing the player's NBA affiliation.
 */
export function parseYahooTable(text){
 const lines=String(text||"").split(/\r?\n/).filter(x=>x.trim());
 if(!lines.length)return [];
 const split=line=>line.split("\t").map(x=>x.trim());
 const header=split(lines[0]).map(x=>x.toLowerCase());
 const nameColumn=header.findIndex(x=>/^(player|players|name|球員|球員名稱)$/.test(x));
 const teamColumn=header.findIndex(x=>/^(team|nba team|nba球隊|nba 球隊|球隊)$/.test(x));
 const hasHeader=nameColumn>=0&&teamColumn>=0;
 const rows=[],seen=new Set();
 for(const raw of lines.slice(hasHeader?1:0)){
  const cells=split(raw);
  if(cells.length<2)throw Error("Yahoo 表格需要以 Tab 分隔的欄位");
  const name=(cells[hasHeader?nameColumn:0]||"").trim();
  const candidates=hasHeader?[teamCode(cells[teamColumn])]:cells.slice(1).map(teamCode).filter(x=>TEAMS.includes(x));
  const distinct=[...new Set(candidates.filter(x=>TEAMS.includes(x)))];
  if(distinct.length!==1)throw Error("無法唯一辨識 NBA 球隊："+raw);
  if(!name||seen.has(name.toLowerCase()))throw Error("球員名稱空白或重複："+name);
  seen.add(name.toLowerCase());rows.push({name,team:distinct[0]});
 }
 return rows;
}

export function rosterWeek(games,roster,date){
 const start=weekStart(date);
 const monday=new Date(start+"T12:00:00Z");
 const end=new Date(monday);end.setUTCDate(end.getUTCDate()+7);
 const startStr=start,endStr=end.toISOString().slice(0,10);
 const counts=new Map(TEAMS.map(t=>[t,0]));
 for(const g of games)if(g.date>=startStr&&g.date<endStr){
  counts.set(g.home,counts.get(g.home)+1);
  counts.set(g.away,counts.get(g.away)+1);
 }
 return roster.map(p=>({...p,games:counts.get(p.team)||0}));
}

/** Choose tabular Yahoo paste only when the first nonempty line has 3+ tab columns.
 * Two-column tab rows are accepted by the simple name/team parser.
 */
export function parsePastedRoster(text){
 const lines=String(text||"").split(/\r?\n/).filter(x=>x.trim());
 if(!lines.length)return [];
 const first=lines[0];
 if(first.split("\t").length>=3)return parseYahooTable(text);
 return parseRoster(text);
}
/** Match projected players to an explicitly supplied NBA team roster.
 * Never guess NBA affiliation from player names or fantasy positions.
 */
export function matchProjectedPlayers(projections,roster){
 const teamByName=new Map(),conflicts=new Set();
 for(const p of roster){
  const key=p.name.trim().toLowerCase(),team=teamCode(p.team);
  if(!TEAMS.includes(team))throw Error("無法辨識 NBA 球隊："+p.name);
  if(teamByName.has(key)&&teamByName.get(key)!==team)conflicts.add(key);
  teamByName.set(key,team);
 }
 const matched=[],missing=[],ambiguous=[];
 for(const [key,p] of projections){
  if(conflicts.has(key)){ambiguous.push(p.name);continue;}
  const team=teamByName.get(key);
  if(team)matched.push({name:p.name,team});
  else missing.push(p.name);
 }
 return {matched,missing,ambiguous};
}
/** Compare scheduled games only, not 9-cat projections. */
export function compareRosterWeeks(games,mine,opponent,date){
 const a=rosterWeek(games,mine,date),b=rosterWeek(games,opponent,date);
 const sum=rows=>rows.reduce((n,p)=>n+p.games,0);
 return {mine:a,opponent:b,mineGames:sum(a),opponentGames:sum(b),
         difference:sum(a)-sum(b)};
}
