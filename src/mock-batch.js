import {buildLeagueMarket,leagueTarget,minimumLeagueBid} from "./league-market.js";
import {CONFIG,addPick,fresh,teamStats} from "./model.js";
import {rankProjections,teamCategories} from "./projections.js";
import {canAddToRoster} from "./roster.js";
import {evaluateDraft} from "./evaluation.js";
const key=p=>p.player.trim().toLowerCase();
const cats=["fgPct","ftPct","three","pts","reb","ast","stl","blk","tov"];
function rng(seed){let s=seed>>>0;return ()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
export function runFullMock(players,prices=[],mode="h2h",seed=1,scenario="normal"){
 const cfg=CONFIG[mode];if(!cfg)throw Error("未知模式");
 if(players.length<cfg.teams*cfg.slots)throw Error("預測球員不足");
 const random=rng(seed),ranked=rankProjections(players),yahoo=new Map(prices.map(p=>[key(p),p])),league=buildLeagueMarket(prices);
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
   const target=leagueTarget(p,reference,league);
   const floor=minimumLeagueBid(p,reference,league);
   const bids=eligible.map(({team,stats})=>{
    const scenarioFactor=scenario==="aggressive"?1.18:scenario==="conservative"?.85:scenario==="mixed"?(team%2?1.18:.85):1;
    const factor=styles[team-1]*scenarioFactor*(.9+random()*.2);
    // Managers with excess unspent cash bid more aggressively while there are still choices.
    const cashPerSlot=stats.remaining/stats.open;
    const pace=Math.max(1,Math.min(3,cashPerSlot/(cfg.budget/cfg.slots)));
    return {team,bid:Math.max(1,Math.min(stats.maxBid,Math.round(target*factor*pace)))};
   }).sort((a,b)=>b.bid-a.bid||a.team-b.team);
   const affordable=bids.filter(b=>b.bid>=floor);
   if(!affordable.length)continue;
   const clearing=affordable.length>1?Math.min(affordable[0].bid,Math.max(floor,affordable[1].bid+1)):floor;
   choices.push({p,reference,bid:clearing,team:affordable[0].team});
   if(choices.length>=16)break;
  }
  if(!choices.length)throw Error("無法在真實溢價與剩餘預算下填滿陣容；請檢查 Yahoo 價格及競標設定，不能降價硬湊");
  const chosen=choices[Math.floor(random()*Math.min(choices.length,8))];
  const stats=teamStats(state,chosen.team);
  const price=chosen.bid;
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
 // Do not fabricate prices after an auction to make the accounting look balanced.
 // A full-budget league is valid only when every bid genuinely clears during the simulation.
 if(teams.some(t=>t.spent!==cfg.budget))throw Error("預算驗證失敗：14 隊未全部花滿 $"+cfg.budget+"；本場結果不列入推薦，需改善競價節奏");
 const evaluation=evaluateDraft(state,players);
 const order=new Map(evaluation.standings.map((x,i)=>[x.team,{rank:i+1,score:x.score}]));
 teams.forEach(t=>{t.rank=order.get(t.team).rank;t.score=order.get(t.team).score;});
 return {seed,scenario,mode,teams,log,winner:evaluation.standings[0].team,metric:evaluation.metric};
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
