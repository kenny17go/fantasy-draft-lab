import test from "node:test";
import {readFileSync} from "node:fs";
import {runFullMock} from "../src/mock-batch.js";
import {adjustedH2HPrices} from "../src/h2h-price-calibration.js";
const snapshot=JSON.parse(readFileSync(new URL("./fixtures/yahoo-2026-10-10-snapshot.json",import.meta.url),"utf8"));
const players=snapshot.projections,prices=snapshot.prices;
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
test("real Yahoo 2026-10-10 snapshot: 30 paired seeds per mode",()=>{
 const pmap=new Map(prices.map(p=>[p.player.toLowerCase(),p]));
 const matched=players.filter(p=>pmap.has(p.player.toLowerCase())).length;
 const refs=adjustedH2HPrices(prices).map(p=>p.adjustedReference).filter(Number.isFinite).sort((a,b)=>b-a);
 const output={source:"User Yahoo export backup",sourceDate:snapshot.sourceDate,projections:players.length,prices:prices.length,matched,unmatched:players.length-matched,referenceTop168Sum:refs.slice(0,168).reduce((a,b)=>a+b,0),modes:{}};
 for(const mode of ["normal","competitive-ai","competitive-balanced","adaptive-ai","adaptive-v4"]){
  const runs=[],failures=[];
  for(let seed=1;seed<=30;seed++){
   try{
    const scenario=["normal","normal","aggressive","conservative","mixed"][(seed-1)%5];
    const r=runFullMock(players,prices,"h2h",seed,scenario,mode);
    const sale=r.log,spent=r.teams.map(t=>t.spent);
    runs.push({spent:mean(spent),unspent:mean(r.teams.map(t=>t.unspent)),top4:mean(r.teams.map(t=>t.top4Spend)),top8:mean(r.teams.map(t=>t.top8Spend)),one:sale.filter(x=>x.price===1).length,max:Math.max(...sale.map(x=>x.price)),first:mean(sale.slice(0,56).map(x=>x.price)),middle:mean(sale.slice(56,112).map(x=>x.price)),last:mean(sale.slice(112,168).map(x=>x.price)),saleToRef:mean(sale.filter(x=>x.reference>0).map(x=>x.price/x.reference)),picks:sale.length});
   }catch(e){failures.push({seed,error:String(e.message)});}
  }
  output.modes[mode]={completed:runs.length,failed:failures.length,failures:failures.slice(0,10),avgTeamSpend:mean(runs.map(x=>x.spent)),avgUnspent:mean(runs.map(x=>x.unspent)),avgTop4:mean(runs.map(x=>x.top4)),avgTop8:mean(runs.map(x=>x.top8)),avgOneDollarSales:mean(runs.map(x=>x.one)),avgHighestSale:mean(runs.map(x=>x.max)),first56Price:mean(runs.map(x=>x.first)),middle56Price:mean(runs.map(x=>x.middle)),last56Price:mean(runs.map(x=>x.last)),saleToReference:mean(runs.map(x=>x.saleToRef)),allCompleted168:runs.every(x=>x.picks===168)};
 }
 console.log("REAL_YAHOO_2026_COMPARISON "+JSON.stringify(output));
});
