import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runFullMock} from "../src/mock-batch.js";
import {adjustedH2HPrices} from "../src/h2h-price-calibration.js";

const snapshot=JSON.parse(readFileSync(new URL("./fixtures/yahoo-2026-10-10-snapshot.json",import.meta.url),"utf8"));
const prices=adjustedH2HPrices(snapshot.prices);
const references=new Map(prices.map(p=>[p.player.trim().toLowerCase(),p.adjustedReference]));
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
const median=a=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y);return (s[Math.floor((s.length-1)/2)]+s[Math.floor(s.length/2)])/2;};
const groups=[{name:"50+",min:50,max:Infinity},{name:"20-49",min:20,max:50},{name:"5-19",min:5,max:20},{name:"1-4",min:1,max:5}];
const summarize=a=>({count:a.length,avgReference:mean(a.map(x=>x.ref)),avgSale:mean(a.map(x=>x.price)),weightedSaleToReference:a.length?a.reduce((s,x)=>s+x.price,0)/a.reduce((s,x)=>s+x.ref,0):null,medianSaleToReference:median(a.map(x=>x.price/x.ref)),avgHighestWillingness:mean(a.map(x=>x.highestWillingness)),avgRunnerUpWillingness:mean(a.map(x=>x.secondWillingness)),oneDollarSales:a.filter(x=>x.price===1).length});
test("V5 price reasonableness: 30 paired seeds with Yahoo reference buckets and outliers",()=>{
 const records=[],teamRecords=[],failures=[],unmatched=new Set();
 for(let seed=1;seed<=30;seed++){
  const scenario=["normal","normal","aggressive","conservative","mixed"][(seed-1)%5];
  try{
   const run=runFullMock(snapshot.projections,snapshot.prices,"h2h",seed,scenario,"auction-v5");
   assert.equal(run.log.length,168);
   assert.equal(run.teams.length,14);
   for(const t of run.teams){
    assert.equal(t.players.length,12);
    assert.ok(t.spent<=200&&t.unspent>=0);
    teamRecords.push({seed,team:t.team,spent:t.spent,unspent:t.unspent,top4:t.top4Spend,top8:t.top8Spend,rank:t.rank,score:t.score});
   }
   for(const sale of run.log){
    const ref=references.get(sale.player.trim().toLowerCase());
    if(!Number.isFinite(ref)||ref<=0){unmatched.add(sale.player);continue;}
    records.push({...sale,seed,ref,ratio:sale.price/ref,absoluteDeviation:Math.abs(sale.price-ref)});
   }
  }catch(e){failures.push({seed,error:String(e.message)});}
 }
 assert.deepEqual(failures,[],"V5 must complete all 30 seeds");
 assert.equal(teamRecords.length,420);
 const byGroup=Object.fromEntries(groups.map(g=>[g.name,summarize(records.filter(x=>x.ref>=g.min&&x.ref<g.max))]));
 const playerMap=new Map();
 for(const r of records){
  if(!playerMap.has(r.player))playerMap.set(r.player,[]);
  playerMap.get(r.player).push(r);
 }
 const outliers=[...playerMap].map(([player,items])=>({player,appearances:items.length,reference:items[0].ref,avgSale:mean(items.map(x=>x.price)),avgDeviation:mean(items.map(x=>x.price-x.ref)),avgAbsoluteDeviation:mean(items.map(x=>x.absoluteDeviation)),avgHighestWillingness:mean(items.map(x=>x.highestWillingness)),avgRunnerUpWillingness:mean(items.map(x=>x.secondWillingness)),avgPriceRatio:mean(items.map(x=>x.ratio))})).sort((a,b)=>b.avgAbsoluteDeviation-a.avgAbsoluteDeviation).slice(0,20);
 const byTeam=Array.from({length:14},(_,i)=>{const a=teamRecords.filter(x=>x.team===i+1);return {team:i+1,avgSpent:mean(a.map(x=>x.spent)),minSpent:Math.min(...a.map(x=>x.spent)),maxSpent:Math.max(...a.map(x=>x.spent)),avgUnspent:mean(a.map(x=>x.unspent)),avgTop4:mean(a.map(x=>x.top4)),avgTop8:mean(a.map(x=>x.top8)),avgRank:mean(a.map(x=>x.rank)),avgScore:mean(a.map(x=>x.score))};});
 const output={sourceDate:snapshot.sourceDate,mode:"auction-v5",completed:30,failed:0,matchedSales:records.length,unmatchedSoldPlayers:[...unmatched],byReferenceGroup:byGroup,top20PriceDeviations:outliers,byTeam,overall:summarize(records),note:"Yahoo reference prices are NOT observed historical auction clearing prices. $1 late sales are not a failure."};
 console.log("V5_PRICE_REASONABLENESS "+JSON.stringify(output));
});
