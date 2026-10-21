import {TEAMS,teamCode} from "./h2h-schedule.js";
const KEY="fantasy-draft-lab:h2h:player-teams:v1";
export const playerKey=name=>String(name||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
export function parsePlayerTeams(text){
 const result={};const errors=[];
 for(const [i,line] of String(text||"").split(/\r?\n/).entries()){
  const parts=line.split(/[\t,]/).map(x=>x.trim().replace(/^["']|["']$/g,""));
  if(parts.length<2||!parts[0])continue;
  if(i===0&&/^(player|name|球員)/i.test(parts[0]))continue;
  const team=teamCode(parts[1].toUpperCase());
  if(!TEAMS.includes(team)){errors.push(i+1);continue;}
  const key=playerKey(parts[0]);if(key)result[key]={name:parts[0],team};
 }
 if(!Object.keys(result).length)throw Error("沒有找到有效的球員、球隊資料（每行：球員名稱,球隊代碼）");
 return {players:result,errors};
}
export function savedTeams(){
 try{return JSON.parse(localStorage.getItem(KEY)||"{}");}catch{return {};}
}
export function saveTeams(players){
 const merged={...savedTeams(),...players};
 localStorage.setItem(KEY,JSON.stringify(merged));
 return Object.keys(merged).length;
}
export async function loadOnlineTeams(){
 const response=await fetch("./data/nba-player-teams.json",{cache:"no-store"});
 if(!response.ok)throw Error("線上球隊資料尚未建立");
 const data=await response.json();
 if(!data.players||Object.keys(data.players).length<150)throw Error("線上球隊資料不足");
 return data;
}
export function fillRosterTeams(text,lookup){
 return String(text||"").split(/\r?\n/).map(line=>{
  const name=line.trim();
  if(!name||/[\t,]/.test(name))return line;
  const entry=lookup[playerKey(name)];
  return entry?name+", "+entry.team:line;
 }).join("\n");
}
