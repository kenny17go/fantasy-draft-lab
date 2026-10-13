// Initial league-specific calibration, not observed auction transaction data.
// Yahoo's 12x13 reference differs from this league's 14x12 format.
const key=p=>String(p.player||"").trim().toLocaleLowerCase();
// Budget-demand scaling: 14 teams x $200 vs Yahoo's 12 teams x $200.
// This is an estimated league adjustment, not an observed Yahoo Avg/Proj quote.
export function leaguePriceScale(mode="h2h"){
 return mode==="h2h"?14/12:1;
}
export function buildLeagueMarket(prices=[],mode="h2h"){
 const scale=leaguePriceScale(mode);
 const valid=prices.map(p=>{
  const rawAvg=Number(p.avg)>0?Number(p.avg):0;
  const rawProj=Number(p.proj)>0?Number(p.proj):0;
  return {...p,rawAvg,rawProj,adjustedAvg:rawAvg*scale,adjustedProj:rawProj*scale,reference:Math.max(rawAvg,rawProj)*scale};
 }).filter(p=>p.reference>0).sort((a,b)=>b.reference-a.reference);
 const ranks=new Map(valid.map((p,i)=>[key(p),i+1]));
 const avg=new Map(valid.map(p=>[key(p),p.adjustedAvg]));
 const reference=new Map(valid.map(p=>[key(p),p.reference]));
 const originalReference=new Map(valid.map(p=>[key(p),Math.max(p.rawAvg,p.rawProj)]));
 return {ranks,avg,reference,originalReference,scale};
}
export function leagueTarget(player,reference,market,mode="h2h"){
 const yahooReference=market.reference.get(key(player));
 const rank=market.ranks.get(key(player));
 const base=Number(yahooReference)>0?yahooReference:Math.max(1,Number(reference)||1);
 let factor=1;
 if(rank<=5)factor=1.32;
 else if(rank<=15)factor=1.2;
 else if(base>=25)factor=1.1;
 else if(base>5)factor=1.06;
 else factor=.8;
 const slots=mode==="roto"?9:12;
 const slotFactor=13/slots;
 return Math.max(1,Math.round(base*factor*slotFactor));
}
// An elite bargain is an invalid reference strategy, even when its nine-cat score is high.
// Yahoo reference prices are valuations, never legal minimum auction bids.
export function minimumLeagueBid(){return 1;}
export function priceReality(team,market){
 let checked=0,invalid=0,elite=0;
 for(const pick of team.players||[]){
  const reference=market.reference.get(key(pick));
  if(!(reference>5))continue;
  checked++;
  const rank=market.ranks.get(key(pick));
  if(Number(pick.price)<1){invalid++;if(rank<=5)elite++;}
 }
 return {checked,invalid,elite,credible:invalid===0};
}
