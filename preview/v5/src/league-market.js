// Initial league-specific calibration, not observed auction transaction data.
// Yahoo's 12x13 reference differs from this league's 14x12 format.
const key=p=>String(p.player||"").trim().toLocaleLowerCase();
export function buildLeagueMarket(prices=[]){
 const valid=prices.map(p=>({...p,reference:Math.max(Number(p.avg)>0?Number(p.avg):0,Number(p.proj)>0?Number(p.proj):0)})).filter(p=>p.reference>0).sort((a,b)=>b.reference-a.reference);
 const ranks=new Map(valid.map((p,i)=>[key(p),i+1]));
 const avg=new Map(valid.map(p=>[key(p),Number(p.avg)>0?Number(p.avg):0]));
 const reference=new Map(valid.map(p=>[key(p),p.reference]));
 return {ranks,avg,reference};
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
