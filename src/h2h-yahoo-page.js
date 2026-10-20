import {TEAMS,teamCode} from "./h2h-schedule.js";

/** Parse Yahoo's plain-text page copy, preserving NBA team and season-total projections. */
export function parseYahooPage(text){
 const lines=String(text||"").replace(/\r/g,"").split("\n").map(x=>x.trim()).filter(Boolean);
 const players=[],seen=new Set(),failures=[];
 const teamPattern=/^([A-Z]{2,3})\s*-\s*(PG|SG|SF|PF|C)(?:\s*,\s*(?:PG|SG|SF|PF|C))*$/;
 const statsPattern=/^([\d,.]+)\/([\d,.]+)$/;
 const number=s=>Number(s.replace(/,/g,""));
 for(let i=0;i<lines.length;i++){
  const match=lines[i].match(teamPattern);if(!match)continue;
  const team=teamCode(match[1]);if(!TEAMS.includes(team))continue;
  const positions=lines[i].split(" - ")[1].split(",").map(x=>x.trim());
  const nameLine=lines[i-2]||"";
  const name=nameLine.replace(/(?:New )?Player Note.*$/,"").trim();
  if(!name||seen.has(name.toLowerCase())){failures.push("球員名稱重複或缺漏："+name);continue;}
  // Roster owner and opponent are variable; locate GP followed by two ranking columns.
  let found=null;
  for(let j=i+1;j<Math.min(i+15,lines.length-15);j++){
   const gp=number(lines[j]);
   if(!/^\d+(?:\.\d+)?$/.test(lines[j])||gp<=0||gp>82)continue;
   if(!/^\d+$/.test(lines[j+1]||"")||!/^\d+$/.test(lines[j+2]||""))continue;
   const tail=lines.slice(j+3,j+18);
   const shotIndex=tail.findIndex(x=>statsPattern.test(x));
   if(shotIndex<1||!/^\d+(?:\.\d+)?%$/.test(tail[shotIndex-2]||""))continue;
   const shot=tail[shotIndex].match(statsPattern),ft=tail[shotIndex+2]?.match(statsPattern);
   if(!ft)continue;
   const values=tail.slice(shotIndex+4,shotIndex+11);
   if(values.length!==7||values.some(v=>!/^[\d,.]+$/.test(v)))continue;
   const [three,pts,reb,ast,stl,blk,tov]=values.map(number);
   if([three,pts,reb,ast,stl,blk,tov].some(x=>!Number.isFinite(x)))continue;
   const [fgm,fga]=shot.slice(1).map(number),[ftm,fta]=ft.slice(1).map(number);
   if(fgm>fga||ftm>fta)continue;
   found={name,team,positions,gp,fgm:fgm/gp,fga:fga/gp,ftm:ftm/gp,fta:fta/gp,three:three/gp,pts:pts/gp,reb:reb/gp,ast:ast/gp,stl:stl/gp,blk:blk/gp,tov:tov/gp};
   break;
  }
  if(found){players.push(found);seen.add(name.toLowerCase());}else failures.push("無法讀取預估數據："+name);
 }
 if(!players.length)throw Error("找不到完整 Yahoo 球員預估資料；請複製 Pre-Season 預估頁面");
 return {players,failures};
}
