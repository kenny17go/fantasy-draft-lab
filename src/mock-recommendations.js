import {buildLeagueMarket,priceReality} from "./league-market.js";
// Compare simulated teams across all runs on a common nine-category scale.
// This is a projection-based shortlist, not a real-world win probability.
const CATS=["fgPct","ftPct","three","pts","reb","ast","stl","blk","tov"];
export function recommendMockTeams(results,limit=5){
 const all=results.flatMap((run,i)=>(run.teams||[]).map(t=>({...t,run:i+1,scenario:run.scenario})));
 if(!all.length)return [];
 const moments=Object.fromEntries(CATS.map(cat=>{
  const values=all.map(t=>t.stats?.[cat]).filter(Number.isFinite);
  const mean=values.reduce((a,b)=>a+b,0)/(values.length||1);
  const sd=Math.sqrt(values.reduce((a,b)=>a+(b-mean)**2,0)/(values.length||1));
  return [cat,{mean,sd}];
 }));
 const ranked=all.map(t=>{
  const z=Object.fromEntries(CATS.map(cat=>{const m=moments[cat],v=t.stats?.[cat];return [cat,Number.isFinite(v)&&m.sd?(v-m.mean)/m.sd*(cat==="tov"?-1:1):0];}));
  const score=CATS.reduce((sum,c)=>sum+z[c],0);
  const strongest=CATS.filter(c=>z[c]>=.45).sort((a,b)=>z[b]-z[a]);
  const weakest=CATS.filter(c=>z[c]<=-.45).sort((a,b)=>z[a]-z[b]);
  return {...t,overallScore:score,strongest,weakest,reality:priceReality(t,market)};
 }).sort((a,b)=>b.overallScore-a.overallScore||a.run-b.run||a.team-b.team);
 // Avoid presenting near-identical rosters as five independent strategies.
 const picked=[];
 for(const t of ranked){
  if(!t.reality.credible)continue;
  const names=new Set(t.players.map(p=>p.player.toLowerCase()));
  const duplicate=picked.some(x=>x.players.filter(p=>names.has(p.player.toLowerCase())).length>=Math.ceil(t.players.length*.75));
  if(!duplicate)picked.push(t);
  if(picked.length>=limit)break;
 }
 return picked;
}
