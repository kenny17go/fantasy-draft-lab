import {CONFIG,addPick,fresh,teamStats} from "./model.js";
import {rankProjections,teamCategories} from "./projections.js";
import {canAddToRoster} from "./roster.js";
const key=p=>p.player.trim().toLowerCase();
const cats=["fgPct","ftPct","three","pts","reb","ast","stl","blk","tov"];
function rng(seed){let s=seed>>>0;return ()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
export function runFullMock(players,prices=[],mode="h2h",seed=1,scenario="normal"){
 const cfg=CONFIG[mode];if(!cfg)throw Error("未知模式");
 if(players.length<cfg.teams*cfg.slots)throw Error("預測球員不足");
 const random=rng(seed),ranked=rankProjections(players),yahoo=new Map(prices.map(p=>[key(p),p]));
 const rosters=Array.from({length:cfg.teams},()=>[]),styles=rosters.map(()=>.85+random()*.3);
 let state=fresh(mode),log=[];
 while(state.picks.length<cfg.teams*cfg.slots){
  const taken=new Set(state.picks.map(p=>p.player.toLowerCase()));
  const available=ranked.filter(p=>!taken.has(key(p)));
  const open=rosters.map((r,i)=>({team:i+1,stats:teamStats(state,i+1)})).filter(x=>x.stats.open);
  let choices=[];
  // Search all candidates to avoid dead ends caused by rigid nomination order.
  for(const p of available){
   const eligible=open.filter(x=>canAddToRoster(rosters[x.team-1],p,mode));
   if(!eligible.length)continue;
   const market=yahoo.get(key(p)),fallback=Math.max(1,Math.round(2+Math.max(0,p.total)*3));
   const reference=market?.avg>0?market.avg:market?.proj>0?market.proj:fallback;
   const bids=eligible.map(({team,stats})=>{
    const scenarioFactor=scenario==="aggressive"?1.18:scenario==="conservative"?.85:scenario==="mixed"?(team%2?1.18:.85):1;
    const factor=styles[team-1]*scenarioFactor*(.9+random()*.2);
    return {team,bid:Math.max(1,Math.min(stats.maxBid,Math.round(reference*factor)))};
   }).sort((a,b)=>b.bid-a.bid||a.team-b.team);
   choices.push({p,reference,bid:bids[0].bid,team:bids[0].team});
   if(choices.length>=16)break;
  }
  if(!choices.length)throw Error("無合法球員可填滿隊伍；請檢查位置供給");
  const chosen=choices[Math.floor(random()*Math.min(choices.length,8))];
  const stats=teamStats(state,chosen.team);
  const price=stats.open===1?stats.remaining:chosen.bid;
  state=addPick(state,{player:chosen.p.player,team:chosen.team,price});
  rosters[chosen.team-1].push(chosen.p);
  log.push({player:chosen.p.player,team:chosen.team,price,reference:chosen.reference});
 }
 const teams=rosters.map((roster,i)=>{
  const picks=state.picks.filter(p=>p.team===i+1);
  const reference=log.filter(p=>p.team===i+1).reduce((s,p)=>s+p.reference,0);
  const spent=picks.reduce((s,p)=>s+p.price,0);
  return {team:i+1,players:picks,stats:teamCategories(roster),spent,reference,bargain:reference-spent};
 });
 return {seed,scenario,mode,teams,log};
}
export function runMockBatch(players,prices=[],mode="h2h",count=100){
 if(!Number.isInteger(count)||count<1||count>100)throw Error("模擬次數須為 1–100");
 const scenarios=["normal","normal","aggressive","conservative","mixed"];
 const results=Array.from({length:count},(_,i)=>runFullMock(players,prices,mode,i+1,scenarios[i%scenarios.length]));
 const all=results.flatMap((r,i)=>r.teams.map(t=>({...t,run:i+1,scenario:r.scenario})));
 const stats=Object.fromEntries(cats.map(cat=>{
  const v=all.map(t=>t.stats[cat]).filter(Number.isFinite),mean=v.reduce((a,b)=>a+b,0)/v.length;
  return [cat,{mean,sd:Math.sqrt(v.reduce((a,b)=>a+(b-mean)**2,0)/v.length)}];
 }));
 const ranked=all.map(t=>({...t,score:cats.reduce((s,k)=>s+(Number.isFinite(t.stats[k])&&stats[k].sd?(t.stats[k]-stats[k].mean)/stats[k].sd*(k==="tov"?-1:1):0),0)})).sort((a,b)=>b.score-a.score);
 return {results,ranked,stats,count};
}
