import {CONFIG} from "./model.js";
import {teamCategories} from "./projections.js";
import {CATEGORIES,rotoStandings} from "./strategy.js";

// Evaluates a completed draft against all 13 opponents. These are projected
// season totals, not realized results or calibrated weekly win probabilities.
export function evaluateDraft(state,players){
 const cfg=CONFIG[state?.mode];if(!cfg)throw Error("未知聯盟");
 if(state.picks.length!==cfg.teams*cfg.slots)throw Error("需要完成 14 隊完整選秀");
 const lookup=new Map(players.map(p=>[p.player.trim().toLocaleLowerCase(),p]));
 const rosters=Array.from({length:cfg.teams},()=>[]);
 for(const pick of state.picks){
  const player=lookup.get(pick.player.trim().toLocaleLowerCase());
  if(!player)throw Error("缺少球員預測："+pick.player);
  rosters[pick.team-1].push(player);
 }
 if(rosters.some(r=>r.length!==cfg.slots))throw Error("部分球隊人數不完整");
 const totals=rosters.map(teamCategories);
 if(totals.some(t=>t.fgPct===null||t.ftPct===null))throw Error("缺少 FG% 或 FT% 出手資料");
 if(state.mode==="roto"){
  const result=rotoStandings(state,players);
  if(!result.ready)throw Error(result.reason);
  return {mode:"roto",standings:result.standings.map(t=>({team:t.team,score:t.points,categoryPoints:t.categoryPoints,totals:t.totals})),metric:"預估 ROTO 積分"};
 }
 const scores=totals.map((t,i)=>({team:i+1,score:0,wins:0,ties:0,losses:0,categoryWins:0,categoryTies:0,categoryLosses:0,totals:t}));
 for(let a=0;a<scores.length;a++)for(let b=a+1;b<scores.length;b++){
  let wa=0,wb=0;
  for(const cat of CATEGORIES){
   const x=totals[a][cat],y=totals[b][cat];
   const delta=cat==="tov"?y-x:x-y;
   if(Math.abs(delta)<1e-9){scores[a].categoryTies++;scores[b].categoryTies++;}
   else if(delta>0){wa++;scores[a].categoryWins++;scores[b].categoryLosses++;}
   else{wb++;scores[b].categoryWins++;scores[a].categoryLosses++;}
  }
  if(wa>wb){scores[a].wins++;scores[b].losses++;}
  else if(wb>wa){scores[b].wins++;scores[a].losses++;}
  else{scores[a].ties++;scores[b].ties++;}
 }
 for(const t of scores)t.score=(t.wins+t.ties*.5)/13;
 return {mode:"h2h",standings:scores.sort((a,b)=>b.score-a.score||b.categoryWins-a.categoryWins||a.team-b.team),metric:"對其他 13 隊預測陣容勝率（非每週勝率）"};
}
