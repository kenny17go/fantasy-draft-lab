import {TEAMS,teamCode} from "./h2h-schedule.js";
const KEY="fantasy-draft-lab:h2h:player-teams:v1";
export const playerKey=name=>String(name||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
// Supports pasted FantasyPros Yahoo rankings (e.g. "N. Jokic (DEN - C)") and CSV.
export function parsePlayerTeams(text,knownNames=[]){
 const result={},errors=[],unresolved=[],ambiguous=[];
 const names=knownNames.map(name=>({name,key:playerKey(name),parts:String(name).normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9 ]/g,"").trim().split(/\s+/)}));
 const ranking=/^(.+?)\s*\(([A-Z]{2,4})\s*-\s*(?:PG|SG|SF|PF|C|G|F)(?:\s*,\s*(?:PG|SG|SF|PF|C|G|F))*\)/;
 for(const [i,raw] of String(text||"").split(/\r?\n/).entries()){
  const line=raw.trim();
  let name,code;
  const rank=ranking.exec(line.replace(/^\d+\s+/,""));
  if(rank){name=rank[1].trim();code=rank[2];}
  else{
   const parts=line.split(/[\t,]/).map(x=>x.trim().replace(/^["']|["']$/g,""));
   if(parts.length<2||!parts[0]||/^(player|name|球員)$/i.test(parts[0]))continue;
   name=parts[0];code=parts[1];
   if(!/^[A-Za-z]{2,4}$/.test(code))continue;
  }
  const team=teamCode(({"NOR":"NOP","UTH":"UTA","PHO":"PHX","GS":"GSW","NY":"NYK","SA":"SAS","WSH":"WAS"}[code]||code).toUpperCase());
  if(!TEAMS.includes(team)){if(code!=="FA")errors.push(i+1);continue;}
  let key=playerKey(name),fullName=name;
  if(knownNames.length){
   const exact=names.filter(p=>p.key===key);
   let matches=exact;
   if(!matches.length){
    const m=/^([A-Za-z])\.\s*(.+)$/.exec(name);
    if(m){
     const last=playerKey(m[2]);
     matches=names.filter(p=>p.parts[0]?.startsWith(m[1].toLowerCase())&&playerKey(p.parts.slice(1).join("")).endsWith(last));
    }
   }
   if(matches.length!==1){(matches.length?ambiguous:unresolved).push(name);continue;}
   key=matches[0].key;fullName=matches[0].name;
  }
  if(result[key]&&result[key].team!==team){ambiguous.push(name);delete result[key];continue;}
  result[key]={name:fullName,team};
 }
 if(!Object.keys(result).length)throw Error("沒有找到可配對球員；可貼 FantasyPros 完整排名或姓名,球隊 CSV");
 return {players:result,errors,unresolved,ambiguous};
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
