// Diagnostic only: no auction rules or production behavior are changed.
// Run: node --test tests/mock-diagnostic-v1.test.js
import test from "node:test";
import {runFullMock} from "../src/mock-batch.js";
import {adjustedH2HPrices} from "../src/h2h-price-calibration.js";
const players=Array.from({length:210},(_,i)=>({player:"Diagnostic "+i,positions:["PG","SG","SF","PF","C"],gp:70,pts:30-i*.08,reb:7,ast:5,stl:1.2,blk:.8,three:2,tov:2,fgm:8,fga:16,ftm:4,fta:5}));
const prices=players.map((p,i)=>({player:p.player,avg:i<5?75-i*5:i<18?49-(i-5)*2:i<65?22-(i-18)*.3:i<110?5+(110-i)*.1:1,proj:i<5?77-i*5:i<18?51-(i-5)*2:i<65?24-(i-18)*.3:i<110?6+(110-i)*.1:1}));
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
test("read-only H2H diagnostic: 30 seeds, synthetic Yahoo-like prices",()=>{
 const calibrated=adjustedH2HPrices(prices);
 const refs=calibrated.map(p=>p.adjustedReference).sort((a,b)=>b-a);
 const baseline={totalBudget:2800,requiredPlayers:168,priceRows:prices.length,top168ReferenceSum:refs.slice(0,168).reduce((a,b)=>a+b,0),allReferenceSum:refs.reduce((a,b)=>a+b,0),floorAboveCapCount:calibrated.filter(p=>p.opening>p.cap).length};
 const output={baseline,modes:{}};
 for(const mode of ["normal","budget-aware","cap-120"]){
  const runs=[],failures=[];
  for(let seed=1;seed<=30;seed++){
   try{
    const scenario=["normal","normal","aggressive","conservative","mixed"][(seed-1)%5];
    const run=runFullMock(players,prices,"h2h",seed,scenario,mode);
    const spend=run.teams.map(t=>t.spent),sales=run.log;
    runs.push({seed,spentMean:mean(spend),unspentMean:mean(run.teams.map(t=>t.unspent)),nominationWins:sales.filter(p=>p.team===p.nominator).length,openingAboveOne:sales.filter(p=>p.opening>1).length,oneDollar:sales.filter(p=>p.price===1).length,first56Price:mean(sales.slice(0,56).map(p=>p.price)),last56Price:mean(sales.slice(-56).map(p=>p.price)),saleToReference:mean(sales.filter(p=>p.reference>0).map(p=>p.price/p.reference)),top4SpendMean:mean(run.teams.map(t=>t.top4Spend)),top8SpendMean:mean(run.teams.map(t=>t.top8Spend)),totalSpent:spend.reduce((a,b)=>a+b,0)});
   }catch(e){failures.push({seed,error:String(e.message)});}
  }
  output.modes[mode]={completed:runs.length,failed:failures.length,failures:failures.slice(0,10),teamSpendMean:mean(runs.map(x=>x.spentMean)),teamUnspentMean:mean(runs.map(x=>x.unspentMean)),nominatorWinsMean:mean(runs.map(x=>x.nominationWins)),openingAboveOneMean:mean(runs.map(x=>x.openingAboveOne)),oneDollarMean:mean(runs.map(x=>x.oneDollar)),first56MeanPrice:mean(runs.map(x=>x.first56Price)),last56MeanPrice:mean(runs.map(x=>x.last56Price)),saleToReferenceMean:mean(runs.map(x=>x.saleToReference)),top4SpendMean:mean(runs.map(x=>x.top4SpendMean)),top8SpendMean:mean(runs.map(x=>x.top8SpendMean)),accountingValid:runs.every(x=>x.totalSpent>=168&&x.totalSpent<=2800)};
 }
 console.log("MOCK_DIAGNOSTIC_V1 "+JSON.stringify(output));
});
