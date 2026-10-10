import {CONFIG,addPick,fresh,teamStats} from "./model.js";
import {rankProjections} from "./projections.js";
import {canAddToRoster} from "./roster.js";

// Isolated, repeatable mock draft: never writes real auction picks.
const id=p=>p.player.trim().toLocaleLowerCase();
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function createMock(mode){if(!CONFIG[mode])throw Error("未知聯盟");return {version:1,mode,state:fresh(mode),turn:0};}
export function mockCandidates(mock,players){const sold=new Set(mock.state.picks.map(p=>p.player.toLocaleLowerCase()));return rankProjections(players).filter(p=>!sold.has(id(p)));}
function estimateMarket(p,yahoo,model,turn){
 const market=yahoo.get(id(p)),m=model.get(id(p));
 // Prefer actual Yahoo auction averages; never interpret missing or $0 as a free bid.
 const basis=market?.avg>0?market.avg:market?.proj>0?market.proj:m>0?m:1;
 return Math.max(1,Math.round(basis*(1+0.06*Math.sin(turn*1.7+p.player.length))));
}
export function mockAuctionStep(mock,players,prices=[],values=[],userBid=0){
 if(mock.version!==1||!CONFIG[mock.mode])throw Error("模擬狀態錯誤");
 const cfg=CONFIG[mock.mode],candidate=mockCandidates(mock,players)[0];
 if(!candidate)throw Error("沒有可用球員");
 if(mock.state.picks.length>=cfg.teams*cfg.slots)throw Error("模擬已完成");
 const yahoo=new Map(prices.map(p=>[id(p),p])),model=new Map(values.map(p=>[id(p),p.price]));
 const target=estimateMarket(candidate,yahoo,model,mock.turn);
 const lookup=new Map(players.map(p=>[id(p),p]));
 const offers=[];
 for(let team=1;team<=cfg.teams;team++){
  const stats=teamStats(mock.state,team);
  if(!stats.open)continue;
  const roster=mock.state.picks.filter(p=>p.team===team).map(p=>lookup.get(id(p))).filter(Boolean);
  if(!canAddToRoster(roster,candidate,mock.mode))continue;
  if(team===1){if(userBid>0){if(!Number.isSafeInteger(userBid)||userBid>stats.maxBid)throw Error("你的出價超過合法上限");offers.push({team,bid:userBid});}continue;}
  // Computer teams have stable but different willingness-to-pay and reserve slots.
  const temperament=0.78+((team*17+mock.turn*7)%31)/100;
  const scarcity=stats.remaining/Math.max(1,stats.open);
  const bid=clamp(Math.round(target*temperament),1,stats.maxBid);
  if(scarcity>=1&&bid>=1)offers.push({team,bid});
 }
 if(!offers.length)throw Error("沒有球隊可以合法競標此球員");
 offers.sort((a,b)=>b.bid-a.bid||a.team-b.team);
 const winner=offers[0];
 const next={...mock,state:addPick(mock.state,{player:candidate.player,team:winner.team,price:winner.bid}),turn:mock.turn+1};
 return {mock:next,player:candidate.player,winner:winner.team,price:winner.bid,target,offers};
}
