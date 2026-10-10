// Initial league-specific calibration, not observed auction transaction data.
// Yahoo's 12x13 reference differs from this league's 14x12 format.
const key=p=>String(p.player||"").trim().toLocaleLowerCase();
export function buildLeagueMarket(prices=[]){
 const valid=prices.filter(p=>Number(p.avg)>0).sort((a,b)=>Number(b.avg)-Number(a.avg));
 const ranks=new Map(valid.map((p,i)=>[key(p),i+1]));
 const avg=new Map(valid.map(p=>[key(p),Number(p.avg)]));
 return {ranks,avg};
}
export function leagueTarget(player,reference,market){
 const yahooAvg=market.avg.get(key(player));
 const rank=market.ranks.get(key(player));
 const base=Number(yahooAvg)>0?yahooAvg:Math.max(1,Number(reference)||1);
 let factor=1;
 if(rank<=5)factor=1.32;
 else if(rank<=15)factor=1.2;
 else if(base>=25)factor=1.1;
 else if(base>5)factor=1.06;
 else factor=.8;
 return Math.max(1,Math.round(base*factor));
}
// An elite bargain is an invalid reference strategy, even when its nine-cat score is high.
export function minimumLeagueBid(player,reference,market){
 const avg=market.avg.get(key(player));
 const base=Number(avg)>0?avg:Number(reference);
 if(!(base>5))return 1;
 if(base>=50)return Math.ceil(base*1.1-1e-9);
 return Math.max(2,Math.ceil(base));
}
export function priceReality(team,market){
 let checked=0,invalid=0,elite=0;
 for(const pick of team.players||[]){
  const avg=market.avg.get(key(pick));
  if(!(avg>5))continue;
  checked++;
  const rank=market.ranks.get(key(pick));
  const minimum=minimumLeagueBid(pick,avg,market);
  if(Number(pick.price)<minimum){invalid++;if(rank<=5)elite++;}
 }
 return {checked,invalid,elite,credible:invalid===0};
}
