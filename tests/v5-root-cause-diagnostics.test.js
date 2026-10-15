import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runFullMock} from "../src/mock-batch.js";
import {adjustedH2HPrices} from "../src/h2h-price-calibration.js";
const snapshot=JSON.parse(readFileSync(new URL("./fixtures/yahoo-2026-10-10-snapshot.json",import.meta.url),"utf8"));
const refs=new Map(adjustedH2HPrices(snapshot.prices).map(p=>[p.player.trim().toLowerCase(),p.adjustedReference]));
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
test("V5 diagnose under-spending teams and underpriced players without changing bidding",()=>{
 const lowTeams=[],lowPlayers=[],teamStats=[],failures=[];
 for(let seed=1;seed<=30;seed++){
  const scenario=["normal","normal","aggressive","conservative","mixed"][(seed-1)%5];
  try{
   const r=runFullMock(snapshot.projections,snapshot.prices,"h2h",seed,scenario,"auction-v5");
   assert.equal(r.log.length,168);
   for(const t of r.teams){
    const won=r.log.filter(x=>x.team===t.team);
    const bids=r.log.flatMap(x=>x.bidDiagnostics.filter(b=>b.team===t.team).map(b=>({index:x.nominationIndex,player:x.player,reference:refs.get(x.player.toLowerCase())??null,won:x.team===t.team,remaining:b.remaining,maxBid:b.maxBid,open:b.open,willingness:b.willingness,price:x.price})));
    const affordableHigh=bids.filter(b=>b.reference>=20&&b.maxBid>=Math.ceil(b.reference*.8));
    const lostAffordable=affordableHigh.filter(b=>!b.won);
    const earlyAffordable=affordableHigh.filter(b=>b.index<=56);
    const record={seed,scenario,team:t.team,spent:t.spent,unspent:t.unspent,firstWin:won[0]?.nominationIndex??null,lastWin:won.at(-1)?.nominationIndex??null,earlyWins:won.filter(x=>x.nominationIndex<=56).length,earlySpend:won.filter(x=>x.nominationIndex<=56).reduce((s,x)=>s+x.price,0),highValueWins:won.filter(x=>(refs.get(x.player.toLowerCase())??0)>=20).length,highValueAffordableAuctions:affordableHigh.length,earlyHighValueAffordableAuctions:earlyAffordable.length,highValueLostWhileAffordable:lostAffordable.length,avgLostWillingness:mean(lostAffordable.map(x=>x.willingness)),firstFiveWins:won.slice(0,5).map(x=>({player:x.player,index:x.nominationIndex,price:x.price,reference:refs.get(x.player.toLowerCase())??null})),lastFiveWins:won.slice(-5).map(x=>({player:x.player,index:x.nominationIndex,price:x.price,reference:refs.get(x.player.toLowerCase())??null}))};
    teamStats.push(record);
    if(t.spent<150)lowTeams.push(record);
   }
   for(const x of r.log){
    const ref=refs.get(x.player.toLowerCase());
    if(ref>=10&&x.price/ref<.4){
     const eligible=x.bidDiagnostics;
     lowPlayers.push({seed,player:x.player,reference:ref,price:x.price,index:x.nominationIndex,eligibleTeams:x.eligibleTeams,teamsWithMaxBidAtLeastReference:eligible.filter(b=>b.maxBid>=ref).length,teamsWithMaxBidAtLeast80PctReference:eligible.filter(b=>b.maxBid>=ref*.8).length,highestWillingness:x.highestWillingness,secondWillingness:x.secondWillingness,topBidders:[...eligible].sort((a,b)=>b.willingness-a.willingness).slice(0,3)});
    }
   }
  }catch(e){failures.push({seed,error:String(e.message)});}
 }
 assert.deepEqual(failures,[]);
 const worst=teamStats.slice().sort((a,b)=>a.spent-b.spent).slice(0,15);
 const examples=lowPlayers.filter(x=>["Keyonte George","Paolo Banchero","Joel Embiid","Paul George","Zion Williamson"].includes(x.player)).slice(0,20);
 const output={completed:30,failed:0,lowSpendBelow150Count:lowTeams.length,lowSpendBelow100Count:lowTeams.filter(x=>x.spent<100).length,lowest15TeamRuns:worst,underpricedSales:lowPlayers.length,underpricedPlayerExamples:examples,diagnosticDefinitions:{affordable:"legal maxBid >= 80% of Yahoo adjusted reference",underpriced:"reference >= $10 and sale < 40% of reference"},note:"Observation only; auction V5 rules unchanged."};
 console.log("V5_ROOT_CAUSE_DIAGNOSTICS "+JSON.stringify(output));
});
