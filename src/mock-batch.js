import {buildLeagueMarket,leagueTarget,minimumLeagueBid} from "./league-market.js";
import {CONFIG,addPick,fresh,teamStats} from "./model.js";
import {rankProjections,teamCategories} from "./projections.js";
import {canAddToRoster} from "./roster.js";
import {evaluateDraft} from "./evaluation.js";
const key=p=>p.player.trim().toLowerCase();
const cats=["fgPct","ftPct","three","pts","reb","ast","stl","blk","tov"];
function rng(seed){let s=seed>>>0;return ()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
export function runFullMock(players,prices=[],mode="h2h",seed=1,scenario="normal",biddingMode="normal",nominationOrder="round-robin"){
 const cfg=CONFIG[mode];if(!cfg)throw Error("未知模式");
 if(players.length<cfg.teams*cfg.slots)throw Error("預測球員不足");
 if(!["normal","forced-first-raise","budget-aware","spend-target","paced-target","value-guard","top4-90","top4-100","top4-110","top4-value-100","cap-120"].includes(biddingMode))throw Error("未知競標模式");
 const random=rng(seed),ranked=rankProjections(players),yahoo=new Map(prices.map(p=>[key(p),p])),league=buildLeagueMarket(prices);
 const rosters=Array.from({length:cfg.teams},()=>[]),styles=rosters.map(()=>.85+random()*.3);
 let state=fresh(mode),log=[],nominationTurn=0;
 while(state.picks.length<cfg.teams*cfg.slots){
  const taken=new Set(state.picks.map(p=>p.player.toLowerCase()));
  const available=ranked.filter(p=>!taken.has(key(p)));
  const open=rosters.map((r,i)=>({team:i+1,stats:teamStats(state,i+1)})).filter(x=>x.stats.open);
  // These quantities are invariant across candidate players within this round.
  const progress=state.picks.length/(cfg.teams*cfg.slots);
  const scenarioFactors=new Map(open.map(({team})=>[team,scenario==="aggressive"?1.18:scenario==="conservative"?.85:scenario==="mixed"?(team%2?1.18:.85):1]));
  const categoryNeeds=new Map(open.map(({team})=>[team,1+Math.min(.22,rosters[team-1].length*.012)]));
  // Yahoo market values use max(Avg, Proj); absent values are excluded.
  const topMean=(pool,n)=>{const values=pool.map(p=>league.reference.get(key(p))).filter(v=>Number.isFinite(v)&&v>0).sort((a,b)=>b-a).slice(0,n);return values.length?values.reduce((a,b)=>a+b,0)/values.length:0;};
  const originalMarketMean=topMean(ranked,cfg.teams*cfg.slots);
  const top4Goal=({"top4-90":90,"top4-100":100,"top4-110":110,"top4-value-100":100})[biddingMode]??0;
  const top4Totals=new Map(open.map(({team})=>[team,state.picks.filter(p=>p.team===team).map(p=>p.price).sort((a,b)=>b-a).slice(0,4).reduce((a,b)=>a+b,0)]));
  const budgetFactors=new Map(open.map(({team,stats})=>{
   const discretionary=Math.max(0,stats.remaining-stats.open);
   const perOpen=stats.open>0?discretionary/stats.open:0;
   const base=biddingMode==="budget-aware"||biddingMode==="spend-target"||biddingMode==="paced-target"||(biddingMode==="value-guard"||top4Goal>0)?1+Math.min(.25,Math.max(0,perOpen-12)/40)*Math.max(0,(progress-.25)/.75):1;
   // Optional $200 goal: respond to spending shortfall while preserving player valuations.
   // Only increase willingness modestly for teams with remaining discretionary cash.
   const spent=cfg.budget-stats.remaining;
   const desired=cfg.budget*rosters[team-1].length/cfg.slots;
   const shortfall=Math.max(0,desired-spent);
   const goalBoost=(biddingMode==="spend-target"||biddingMode==="paced-target"||top4Goal>0)?1+Math.min(.2,shortfall/Math.max(1,cfg.budget)*.6):1;
   // Experimental pacing: increase early willingness for teams falling behind
   // the expected roster-fill pace, without changing auction clearing rules.
   const expectedPicks=progress*cfg.slots;
   const missedPicks=Math.max(0,expectedPicks-rosters[team-1].length);
   const pacingBoost=biddingMode==="paced-target"?1+Math.min(.25,missedPicks*.06)*Math.max(0,1-progress):1;
   const legal=available.filter(p=>canAddToRoster(rosters[team-1],p,mode));
   const remainingMean=biddingMode==="value-guard"?topMean(legal,stats.open):0;
   const valueLoss=originalMarketMean>0?Math.max(0,1-remainingMean/originalMarketMean):0;
   const valueBoost=biddingMode==="value-guard"&&valueLoss>.15&&stats.remaining/stats.open>remainingMean?1+Math.min(.25,(valueLoss-.15)*.6):1;
   const top4Sum=top4Totals.get(team);
   const top4Boost=top4Goal>0&&biddingMode!=="top4-value-100"&&top4Sum<top4Goal?1+Math.min(.3,(top4Goal-top4Sum)/top4Goal*.3)*(1-progress):1;
   return [team,base*goalBoost*pacingBoost*valueBoost*top4Boost];
  }));
  // Nomination belongs to a real team, rotating past completed rosters.
  let nominator;
  do {
   const phase=nominationTurn%(cfg.teams*2);
   const seat=nominationOrder==="snake"?(phase<cfg.teams?phase+1:cfg.teams*2-phase):nominationTurn%cfg.teams+1;
   nominationTurn++;
   nominator=open.find(x=>x.team===seat);
  } while(!nominator);
  let chosen=null;
  // Nominate the highest-ranked remaining player that this team can legally
  // nominate and roster. No random nomination window.
  for(const p of available){
   if(!canAddToRoster(rosters[nominator.team-1],p,mode))continue;
   const eligible=open.filter(x=>canAddToRoster(rosters[x.team-1],p,mode));
   const fallback=Math.max(1,Math.round(2+Math.max(0,p.total)*3));
   const reference=league.reference.get(key(p))??fallback;
   const target=leagueTarget(p,reference,league,mode);
   const yahooReference=league.reference.get(key(p));
   const opening=yahooReference>10?Math.floor(yahooReference)+1:1;
   const yahooCap=biddingMode==="cap-120"&&Number.isFinite(yahooReference)&&yahooReference>0?Math.max(1,Math.floor(yahooReference*1.2)):Infinity;
   if(opening>yahooCap)continue;
   // A nominator must be able to pay the opening bid, reserving $1 per unfilled slot.
   if(nominator.stats.maxBid<opening)continue;
   const bids=eligible.map(({team,stats})=>{
    const factor=styles[team-1]*scenarioFactors.get(team)*(.9+random()*.2);
    // Only the per-player random valuation varies across candidates.
    const fourTotal=top4Totals.get(team);
    const qualityFactor=biddingMode==="top4-value-100"&&yahooReference>=25&&fourTotal<100?1+Math.min(.3,(100-fourTotal)/100*.3)*(1-progress):1;
    const willingness=Math.max(1,Math.round(target*factor*categoryNeeds.get(team)*budgetFactors.get(team)*qualityFactor));
    return {team,bid:Math.max(1,Math.min(stats.maxBid,willingness,yahooCap))};
   }).sort((a,b)=>b.bid-a.bid||a.team-b.team);
   const affordable=bids.filter(b=>b.bid>=1);
   if(!affordable.length)continue;
   // The nominator commits to the opening bid. Other teams may outbid only
   // if their own valuation and remaining legal budget permit it.
   const challengers=affordable.filter(b=>b.team!==nominator.team&&b.bid>opening);
   const forcedEligible=eligible.filter(x=>x.team!==nominator.team&&x.stats.maxBid>=opening+1);
   // Optional stress-test: at least one other legal team must raise once,
   // even when its normal valuation is below the opening price.
   if(biddingMode==="forced-first-raise"&&challengers.length===0&&forcedEligible.length){
    const challenger=forcedEligible[Math.floor(random()*forcedEligible.length)];
    challengers.push({team:challenger.team,bid:opening+1});
   }
   challengers.sort((a,b)=>b.bid-a.bid||a.team-b.team);
   let winner=nominator.team,clearing=opening;
   if(challengers.length){
    const best=challengers[0];
    const second=Math.max(opening,challengers[1]?.bid??0,affordable.find(b=>b.team===nominator.team)?.bid??0);
    winner=best.team;
    clearing=Math.min(best.bid,second+1);
   }
   chosen={p,reference,bid:clearing,team:winner,nominator:nominator.team,opening};
   break;
  }
  if(!chosen)throw Error("無符合位置及預算限制的可競標球員");
  const price=chosen.bid;
  state=addPick(state,{player:chosen.p.player,team:chosen.team,price});
  rosters[chosen.team-1].push(chosen.p);
  log.push({player:chosen.p.player,team:chosen.team,nominator:chosen.nominator,opening:chosen.opening,price,biddingMode,reference:chosen.reference});
 }
 const teams=rosters.map((roster,i)=>{
  const picks=state.picks.filter(p=>p.team===i+1);
  const reference=log.filter(p=>p.team===i+1).reduce((s,p)=>s+p.reference,0);
  const spent=picks.reduce((s,p)=>s+p.price,0);
  const top4Spend=picks.map(p=>p.price).sort((a,b)=>b-a).slice(0,4).reduce((sum,price)=>sum+price,0);
  const dollarOneCount=picks.filter(p=>p.price===1).length;
  return {team:i+1,players:picks,stats:teamCategories(roster),spent,reference,bargain:reference-spent,top4Spend,dollarOneCount,unspent:cfg.budget-spent};
 });
 // Do not fabricate prices after an auction to make the accounting look balanced.
 // Spending $190–200 is a quality metric, not a legal auction requirement.
 if(teams.some(t=>t.spent>cfg.budget||t.players.length!==cfg.slots))throw Error("選秀預算或陣容驗證失敗");
 const evaluation=evaluateDraft(state,players);
 const order=new Map(evaluation.standings.map((x,i)=>[x.team,{rank:i+1,score:x.score}]));
 teams.forEach(t=>{t.rank=order.get(t.team).rank;t.score=order.get(t.team).score;});
 return {seed,scenario,mode,teams,log,winner:evaluation.standings[0].team,metric:evaluation.metric};
}
export function runMockBatch(players,prices=[],mode="h2h",count=100,biddingMode="normal"){
 if(!Number.isInteger(count)||count<1||count>100)throw Error("模擬次數須為 1–100");
 const scenarios=["normal","normal","aggressive","conservative","mixed"];
 const results=Array.from({length:count},(_,i)=>runFullMock(players,prices,mode,i+1,scenarios[i%scenarios.length],biddingMode));
 const all=results.flatMap((r,i)=>r.teams.map(t=>({...t,run:i+1,scenario:r.scenario})));
 const stats=Object.fromEntries(cats.map(cat=>{
  const v=all.map(t=>t.stats[cat]).filter(Number.isFinite),mean=v.reduce((a,b)=>a+b,0)/v.length;
  return [cat,{mean,sd:Math.sqrt(v.reduce((a,b)=>a+(b-mean)**2,0)/v.length)}];
 }));
 const ranked=all.map(t=>({...t,score:cats.reduce((s,k)=>s+(Number.isFinite(t.stats[k])&&stats[k].sd?(t.stats[k]-stats[k].mean)/stats[k].sd*(k==="tov"?-1:1):0),0)})).sort((a,b)=>b.score-a.score);
 return {results,ranked,stats,count};
}
