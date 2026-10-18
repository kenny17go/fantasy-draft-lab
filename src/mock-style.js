// Display-only H2H mock roster labels; no auction or ranking changes.
const SMALL=["three","ast","ftPct"],BIG=["fgPct","reb","blk"];
const CATS=["fgPct","ftPct","three","pts","reb","ast","stl","blk","tov"];
const LABELS={fgPct:"FG%",ftPct:"FT%",three:"3PM",pts:"PTS",reb:"REB",ast:"AST",stl:"STL",blk:"BLK",tov:"TO"};
export function classifyMockTeams(teams){
 if(!Array.isArray(teams)||teams.length<2)return new Map();
 const rankScore=(team,cat)=>{
  const v=team.stats?.[cat];
  if(!Number.isFinite(v))return .5;
  const peers=teams.filter(t=>Number.isFinite(t.stats?.[cat]));
  if(peers.length<2)return .5;
  const better=peers.filter(t=>cat==="tov"?t.stats[cat]<v:t.stats[cat]>v).length;
  const equal=peers.filter(t=>t.stats[cat]===v).length;
  return (peers.length-better-(equal+1)/2)/(peers.length-1);
 };
 return new Map(teams.map(team=>{
  const scores=Object.fromEntries(CATS.map(cat=>[cat,rankScore(team,cat)]));
  const avg=keys=>keys.reduce((sum,k)=>sum+scores[k],0)/keys.length;
  const small=avg(SMALL),big=avg(BIG);
  const style=small-big>=.15&&small>=.55?"小球型":big-small>=.15&&big>=.55?"大球型":"平衡型";
  const strengths=CATS.filter(cat=>scores[cat]>=.65).sort((a,b)=>scores[b]-scores[a]).slice(0,5).map(cat=>LABELS[cat]);
  return [team.team,{style,strengths,small,big}];
 }));
}
