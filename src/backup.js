import {validateState} from "./model.js";
const projectionFields=["player","positions","gp","pts","reb","ast","stl","blk","three","tov","fgm","fga","ftm","fta"];
export function validatePlayers(players){
 if(!Array.isArray(players))throw Error("預測資料必須是陣列");
 const names=new Set();
 return players.map(p=>{
  if(!p||typeof p.player!=="string"||!p.player.trim()||!Array.isArray(p.positions)||!p.positions.length||p.positions.some(v=>!["PG","SG","SF","PF","C"].includes(v)))throw Error("球員姓名或位置不正確");
  const id=p.player.trim().toLocaleLowerCase();if(names.has(id))throw Error("球員重複："+p.player);names.add(id);
  for(const k of projectionFields.slice(2))if(typeof p[k]!=="number"||!Number.isFinite(p[k])||p[k]<0)throw Error(p.player+" 的 "+k+" 無效");
  if(!Number.isInteger(p.gp)||p.gp<1||p.gp>82||p.fgm>p.fga||p.ftm>p.fta||p.three>p.fgm)throw Error(p.player+" 的預測不合理");
  return {...p,positions:[...p.positions]};
 });
}
export function makeBackup(h2h,roto,players,prices=[]){
 return {format:"fantasy-draft-lab-backup",version:1,exportedAt:new Date().toISOString(),leagues:{h2h:validateState(h2h,"h2h"),roto:validateState(roto,"roto")},projections:validatePlayers(players),prices:validatePrices(prices)};
}
export function validatePrices(prices){
 if(!Array.isArray(prices))throw Error("價格資料格式錯誤");
 const names=new Set();return prices.map(p=>{
  if(!p||typeof p.player!=="string"||!p.player.trim())throw Error("價格球員姓名缺漏");
  const id=p.player.trim().toLocaleLowerCase();if(names.has(id))throw Error("價格球員重複");names.add(id);
  for(const k of ["avg","proj"])if(p[k]!==null&&(!Number.isFinite(p[k])||p[k]<0))throw Error(p.player+" 的 "+k+" 無效");
  return {player:p.player,avg:p.avg,proj:p.proj};
 });
}
export function readBackup(text){
 const b=JSON.parse(text);
 if(b?.format!=="fantasy-draft-lab-backup"||b.version!==1||!b.leagues)throw Error("不是支援的完整備份格式");
 return {h2h:validateState(b.leagues.h2h,"h2h"),roto:validateState(b.leagues.roto,"roto"),players:validatePlayers(b.projections),prices:validatePrices(b.prices??[])};
}
