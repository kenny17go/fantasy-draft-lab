import {CONFIG} from "./model.js";
export const SLOT_TYPES={
 h2h:["PG","SG","G","SF","PF","F","C","C","UTIL","UTIL","BN","BN"],
 roto:["PG","SG","SF","PF","C","UTIL","UTIL","UTIL","BN"]
};
export function eligible(positions,slot){
 if(slot==="UTIL"||slot==="BN")return true;
 if(slot==="G")return positions.includes("PG")||positions.includes("SG");
 if(slot==="F")return positions.includes("SF")||positions.includes("PF");
 return positions.includes(slot);
}
// Bipartite augmenting-path matching: players may be rearranged when a new
// eligible player is added. A failure means there is no legal assignment.
export function assignRoster(players,mode){
 const slots=SLOT_TYPES[mode];if(!slots||!CONFIG[mode])throw Error("未知聯盟");
 if(players.length>slots.length)return null;
 const assigned=Array(slots.length).fill(-1);
 function place(i,seen){
  const choices=slots.map((slot,j)=>j).filter(j=>!seen[j]&&eligible(players[i].positions,slots[j]));
  for(const j of choices){seen[j]=true;if(assigned[j]===-1||place(assigned[j],seen)){assigned[j]=i;return true;}}
  return false;
 }
 for(let i=0;i<players.length;i++)if(!place(i,new Set()))return null;
 return assigned.map((p,j)=>p<0?null:{slot:slots[j],player:players[p].player});
}
export function canAddToRoster(existing,player,mode){return assignRoster([...existing,player],mode)!==null;}
export function rosterForTeam(state,projections,team){const byName=new Map(projections.map(p=>[p.player.toLocaleLowerCase(),p]));const picks=state.picks.filter(p=>p.team===team);
 const known=picks.map(p=>byName.get(p.player.toLocaleLowerCase())).filter(Boolean);
 const unknown=picks.length-known.length;
 return {assignment:assignRoster(known,state.mode),unknown,known:known.length,remaining:CONFIG[state.mode].slots-picks.length};
}
