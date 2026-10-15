import {CONFIG,addPick,teamStats,fresh} from "./model.js";
import {SLOT_TYPES,assignRoster,canAddToRoster} from "./roster.js";
import {rankProjections} from "./projections.js";

// Approximate scarcity: demand for mandatory base-position slots vs the number
// of available players eligible for each position. Flexible slots excluded.
// This is a heuristic, not an optimal league-wide assignment.
const BASE=["PG","SG","SF","PF","C"];
export function scarcityFactors(players,mode){
 const slots=SLOT_TYPES[mode];if(!slots)throw Error("未知聯盟");
 const demand=Object.fromEntries(BASE.map(pos=>[pos,slots.filter(s=>s===pos).length*CONFIG[mode].teams]));
 const supply=Object.fromEntries(BASE.map(pos=>[pos,players.filter(p=>p.positions.includes(pos)).length]));
 const pressure=Object.fromEntries(BASE.map(pos=>[pos,demand[pos]/Math.max(1,supply[pos])]));
 return {demand,supply,pressure};
}
export function scarcityScores(ranked,mode){
 const {pressure}=scarcityFactors(ranked,mode);
 // 0.35 z-score maximum boost at 100% mandatory-slot coverage; cap extreme shortages.
 return ranked.map(p=>({...p,adjusted:p.total+Math.min(.35,Math.max(0,Math.max(...p.positions.map(pos=>pressure[pos]??0)))*.35)}))
 .sort((a,b)=>b.adjusted-a.adjusted||a.player.localeCompare(b.player));
}
// Deterministic full-draft smoke simulation, not a market forecast.
// Round-robin fills legal rosters using first feasible player; bids are $1,
// with a final-slot bid consuming each team's remaining budget.
export function simulateDraft(players,mode){
 const cfg=CONFIG[mode];if(!cfg)throw Error("未知聯盟");
 if(players.length<cfg.teams*cfg.slots)throw Error("模擬球員不足");
 const ranked=scarcityScores(rankProjections(players),mode);
 const used=new Set(),rosters=Array.from({length:cfg.teams},()=>[]);
 let state=fresh(mode);
 for(let round=0;round<cfg.slots;round++){
  for(let t=0;t<cfg.teams;t++){
   const i=ranked.findIndex(p=>!used.has(p.player.toLocaleLowerCase())&&canAddToRoster(rosters[t],p,mode));
   if(i<0)throw Error("無法完成合法位置配置：Team "+(t+1)+"，第 "+(round+1)+" 輪");
   const player=ranked[i],stats=teamStats(state,t+1);
   const price=stats.open===1?stats.remaining:1;
   state=addPick(state,{player:player.player,team:t+1,price});
   used.add(player.player.toLocaleLowerCase());rosters[t].push(player);
  }
 }
 if(state.picks.length!==cfg.teams*cfg.slots||rosters.some(r=>assignRoster(r,mode)===null))throw Error("模擬驗證失敗");
 return {state,rosters};
}
