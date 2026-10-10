import {CONFIG,teamStats} from "./model.js";
import {rankProjections} from "./projections.js";
import {scarcityScores} from "./simulation.js";

// $1 is reserved for each open slot. Above-minimum dollars are distributed by
// positive surplus over the replacement-level player in the draftable pool.
// Prices are estimates, not legal maximum bids or Yahoo market prices.
export function auctionValues(players,mode,state){const cfg=CONFIG[mode];if(!cfg)throw Error("未知聯盟");if(state.mode!==mode)throw Error("聯盟模式不一致");const totalSlots=cfg.teams*cfg.slots;if(players.length<totalSlots)throw Error("球員資料不足：至少需要 "+totalSlots+" 位球員");
 const ranks=scarcityScores(rankProjections(players),mode),sold=new Set(state.picks.map(p=>p.player.toLocaleLowerCase())),available=ranks.filter(p=>!sold.has(p.player.toLocaleLowerCase()));
 const open=Array.from({length:cfg.teams},(_,i)=>teamStats(state,i+1).open).reduce((a,b)=>a+b,0);
 const remainingCash=Array.from({length:cfg.teams},(_,i)=>teamStats(state,i+1).remaining).reduce((a,b)=>a+b,0);
 if(remainingCash<open)throw Error("剩餘預算不足以滿足最低出價");
 if(available.length<open)throw Error("剩餘球員不足以填滿聯盟名額");
 if(!open)return {values:[],replacement:null,open,remainingCash,excessCash:0};
 const eligible=available.slice(0,open),replacement=eligible.at(-1).adjusted;
 const weights=eligible.map(p=>Math.max(0,p.adjusted-replacement));
 const sum=weights.reduce((a,b)=>a+b,0),excessCash=remainingCash-open;
 const raw=weights.map(w=>sum>0?excessCash*w/sum:excessCash/open);
 const extras=raw.map(Math.floor);let leftover=excessCash-extras.reduce((a,b)=>a+b,0);
 const order=raw.map((v,i)=>({i,frac:v-Math.floor(v)})).sort((a,b)=>b.frac-a.frac||a.i-b.i);
 for(let i=0;i<leftover;i++)extras[order[i].i]++;
 const prices=new Map(eligible.map((p,i)=>[p.player.toLocaleLowerCase(),1+extras[i]]));
 return {values:available.map(p=>({...p,price:prices.get(p.player.toLocaleLowerCase())??0,draftable:prices.has(p.player.toLocaleLowerCase())})),replacement,open,remainingCash,excessCash};
}
export function maxLegalBid(state,team){return teamStats(state,team).maxBid;}
