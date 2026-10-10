import {CONFIG} from "./model.js";
import {teamCategories,rankProjections} from "./projections.js";
export const CATEGORIES=["fgPct","ftPct","three","pts","reb","ast","stl","blk","tov"];
const Z_KEYS={fgPct:"fgImpact",ftPct:"ftImpact",three:"three",pts:"pts",reb:"reb",ast:"ast",stl:"stl",blk:"blk",tov:"tov"};
export function puntRankings(players,excluded=[]){
 const skip=new Set(excluded);if([...skip].some(c=>!CATEGORIES.includes(c)))throw Error("未知的 Punt 類別");
 const ranked=rankProjections(players);return ranked.map(p=>({...p,puntScore:CATEGORIES.reduce((s,c)=>s+(skip.has(c)?0:p.z[Z_KEYS[c]]),0)})).sort((a,b)=>b.puntScore-a.puntScore||a.player.localeCompare(b.player));
}
export function rotoStandings(state,players){
 if(state.mode!=="roto")throw Error("僅支援 ROTO");
 const cfg=CONFIG.roto,byName=new Map(players.map(p=>[p.player.toLocaleLowerCase(),p]));
 const rosters=Array.from({length:cfg.teams},()=>[]);
 for(const pick of state.picks){const p=byName.get(pick.player.toLocaleLowerCase());if(!p)return {ready:false,reason:"部分已選球員沒有預測資料："+pick.player};rosters[pick.team-1].push(p);}
 if(rosters.some(r=>r.length!==cfg.slots))return {ready:false,reason:"必須先完成全部 14 隊、每隊 9 人選秀才能計算 ROTO 積分"};
 const totals=rosters.map(teamCategories);
 if(totals.some(t=>t.fgPct===null||t.ftPct===null))return {ready:false,reason:"至少一隊沒有 FG 或 FT 出手預測"};
 const scores=Array.from({length:cfg.teams},(_,i)=>({team:i+1,points:0,categoryPoints:{},totals:totals[i]}));
 for(const cat of CATEGORIES){
  const order=scores.slice().sort((a,b)=>cat==="tov"?a.totals[cat]-b.totals[cat]:b.totals[cat]-a.totals[cat]);
  for(let i=0;i<order.length;){let j=i+1;while(j<order.length&&Math.abs(order[j].totals[cat]-order[i].totals[cat])<1e-9)j++;
   const points=((cfg.teams-i)+(cfg.teams-(j-1)))/2;
   for(let k=i;k<j;k++){order[k].points+=points;order[k].categoryPoints[cat]=points;}i=j;
  }
 }
 return {ready:true,standings:scores.sort((a,b)=>b.points-a.points||a.team-b.team)};
}
