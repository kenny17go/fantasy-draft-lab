import test from "node:test";
import {runFullMock} from "../src/mock-batch.js";
const players=Array.from({length:210},(_,i)=>({player:"Test "+i,positions:["PG","SG","SF","PF","C"],gp:70,pts:30-i*.08,reb:7,ast:5,stl:1.2,blk:.8,three:2,tov:2,fgm:8,fga:16,ftm:4,fta:5}));
const prices=players.map((p,i)=>({player:p.player,avg:i<5?75-i*5:i<18?49-(i-5)*2:i<65?22-(i-18)*.3:i<110?5+(110-i)*.1:1,proj:i<5?77-i*5:i<18?51-(i-5)*2:i<65?24-(i-18)*.3:i<110?6+(110-i)*.1:1}));
const avg=x=>x.length?x.reduce((a,b)=>a+b,0)/x.length:null;
test("compare normal and competitive AI: 30 paired seeds",()=>{
 const result={};
 for(const mode of ["normal","competitive-ai"]){
  const runs=[],failures=[];
  for(let seed=1;seed<=30;seed++){
   try{
    const scenario=["normal","normal","aggressive","conservative","mixed"][(seed-1)%5];
    const r=runFullMock(players,prices,"h2h",seed,scenario,mode);
    runs.push({spent:avg(r.teams.map(t=>t.spent)),top4:avg(r.teams.map(t=>t.top4Spend)),top8:avg(r.teams.map(t=>t.top8Spend)),dollarOne:r.log.filter(p=>p.price===1).length,highest:Math.max(...r.log.map(p=>p.price)),early:avg(r.log.slice(0,56).map(p=>p.price)),late:avg(r.log.slice(-56).map(p=>p.price))});
   }catch(e){failures.push({seed,error:e.message});}
  }
  result[mode]={completed:runs.length,failures,avgTeamSpend:avg(runs.map(r=>r.spent)),avgTop4:avg(runs.map(r=>r.top4)),avgTop8:avg(runs.map(r=>r.top8)),avgOneDollarSales:avg(runs.map(r=>r.dollarOne)),avgHighestSale:avg(runs.map(r=>r.highest)),earlyMeanPrice:avg(runs.map(r=>r.early)),lateMeanPrice:avg(runs.map(r=>r.late))};
 }
 console.log("COMPETITIVE_AI_COMPARISON "+JSON.stringify(result));
});
