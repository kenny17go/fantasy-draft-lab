// Experimental H2H price calibration. Does not mutate Yahoo Avg/Proj or auction outcomes.
// Yahoo benchmark: 12 teams x 13 slots, $200/team. Target: 14 teams x 12 slots, $200/team.
export const H2H_PRICE_SCALE=(200/12)/(200/13); // 13/12, per-roster-slot budget
export function adjustedH2HPrices(prices=[]){
 return prices.map(p=>{
  const avg=Number(p.avg)>0?Number(p.avg):0;
  const proj=Number(p.proj)>0?Number(p.proj):0;
  const adjustedAvg=avg*H2H_PRICE_SCALE,adjustedProj=proj*H2H_PRICE_SCALE;
  const reference=Math.max(adjustedAvg,adjustedProj);
  return {...p,adjustedAvg,adjustedProj,adjustedReference:reference,
   opening:reference>0?Math.max(1,Math.ceil(reference)):1,
   cap:reference>0?Math.max(1,Math.floor(reference*1.2)):1};
 });
}
export function auditH2HPriceSupply(prices=[],teams=14,slots=12,budget=200){
 const adjusted=adjustedH2HPrices(prices);
 const required=teams*slots;
 const caps=adjusted.map(p=>p.cap).sort((a,b)=>b-a);
 const maxSupply=caps.slice(0,required).reduce((a,b)=>a+b,0);
 const minOpeningSupply=adjusted.map(p=>p.opening).sort((a,b)=>a-b).slice(0,required).reduce((a,b)=>a+b,0);
 const incompatibleFloorCap=adjusted.filter(p=>p.opening>p.cap).length;
 return {required,available:adjusted.length,totalBudget:teams*budget,maxSupply,minOpeningSupply,
  enoughPlayers:adjusted.length>=required,budgetReachableByCap:maxSupply>=teams*budget,
  minimumOpeningsAffordable:minOpeningSupply<=teams*budget,incompatibleFloorCap};
}
