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
