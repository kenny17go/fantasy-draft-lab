import {readFileSync} from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import {runFullMock,runMockBatch,settleNomination} from "../src/mock-batch.js";
import {CONFIG} from "../src/model.js";
import {rankProjections} from "../src/projections.js";
const players=Array.from({length:210},(_,i)=>({player:"Synthetic "+i,positions:["PG","SG","SF","PF","C"],gp:70,pts:30-i*.08,reb:7,ast:5,stl:1.2,blk:.8,three:2,tov:2,fgm:8,fga:16,ftm:4,fta:5}));
test("full mock evaluates 14 teams with legal budget and roster count",()=>{
 const run=runFullMock(players,[],"roto",17);
 assert.equal(run.teams.length,14);
 assert.equal(run.log.length,CONFIG.roto.teams*CONFIG.roto.slots);
 assert.equal(run.teams.filter(t=>t.rank===1).length,1);
 for(const team of run.teams){assert.equal(team.players.length,CONFIG.roto.slots);assert.ok(team.spent>=CONFIG.roto.slots&&team.spent<=200);}
});
test("seeded mock is reproducible",()=>{
 const a=runFullMock(players,[],"roto",19),b=runFullMock(players,[],"roto",19);
 assert.deepEqual(a.log,b.log);
});
test("batch produces a per-run winner",()=>{
 const batch=runMockBatch(players,[],"roto",2);
 assert.equal(batch.results.length,2);
 assert.equal(batch.ranked.length,28);
 assert.ok(batch.results.every(x=>x.winner>=1&&x.winner<=14));
});

test("multiple H2H mock seeds finish without duplicate players or budget violations",()=>{
 for(let seed=1;seed<=8;seed++){
  const run=runFullMock(players,[],"h2h",seed);
  assert.equal(run.log.length,CONFIG.h2h.teams*CONFIG.h2h.slots);
  assert.equal(new Set(run.log.map(p=>p.player)).size,run.log.length);
  for(const t of run.teams){
   assert.equal(t.players.length,CONFIG.h2h.slots);
   assert.ok(t.spent>=CONFIG.h2h.slots&&t.spent<=200);
   assert.ok(t.players.every(p=>p.price>=1));
  }
 }
});

test("100 complete H2H auctions satisfy every team budget and roster requirement",()=>{
 const scenarios=["normal","normal","aggressive","conservative","mixed"];
 for(let i=0;i<100;i++){
  const run=runFullMock(players,[],"h2h",i+1,scenarios[i%scenarios.length]);
  assert.equal(run.teams.length,14);
  assert.equal(run.log.length,168);
  assert.equal(new Set(run.log.map(p=>p.player)).size,168);
  for(const team of run.teams){
   assert.equal(team.players.length,12,`run ${i+1}, team ${team.team}`);
   assert.ok(team.spent>=CONFIG.h2h.slots&&team.spent<=200,`run ${i+1}, team ${team.team}: $${team.spent}`);
  }
 }
});

// Yahoo-like auction price distribution; synthetic identities avoid relying on live Yahoo data.
test("Yahoo-priced full auctions respect legal minimum and team budgets",()=>{
 const prices=players.map((p,i)=>({player:p.player,avg:i<5?75-i*5:i<18?49-(i-5)*2:i<65?22-(i-18)*.3:i<110?5+(110-i)*.1:1,proj:i<5?77-i*5:i<18?51-(i-5)*2:i<65?24-(i-18)*.3:i<110?6+(110-i)*.1:1}));
 for(const mode of ["h2h","roto"]){
  for(const seed of [1,7,19]){
   const run=runFullMock(players,prices,mode,seed);
   assert.equal(run.log.length,CONFIG[mode].teams*CONFIG[mode].slots);
   for(const team of run.teams)assert.ok(team.spent>=CONFIG[mode].slots&&team.spent<=200,`${mode} seed ${seed}, team ${team.team}: ${team.spent}`);
   assert.ok(run.log.every(p=>p.price>=1),"every winning bid must be at least $1");
  }
 }
});

test("missing and near-zero Yahoo price rows never remove projection players",()=>{
 const mixed=players.map((p,i)=>{
  if(i%4===0)return null;
  if(i%4===1)return {player:p.player,avg:0,proj:0};
  if(i%4===2)return {player:p.player,avg:0.2,proj:0.8};
  return {player:p.player,avg:null,proj:3};
 }).filter(Boolean);
 for(const seed of [1,7]){
  const run=runFullMock(players,mixed,"h2h",seed);
  assert.equal(run.log.length,168);
  assert.equal(new Set(run.log.map(p=>p.player)).size,168);
  assert.ok(run.log.every(p=>p.price>=1));
  assert.ok(run.log.some(p=>!mixed.some(y=>y.player===p.player)),"players with no Yahoo row must remain draftable");
  assert.ok(run.teams.every(t=>t.players.length===12&&t.spent>=CONFIG.h2h.slots&&t.spent<=200));
 }
});


test("100 H2H auctions report clearing-price and budget distributions without assuming a desired result",()=>{
 const bins={one:0,twoToFive:0,sixToNineteen:0,twentyToFortyNine:0,fiftyPlus:0};
 const spends=[],winnerSpends=[],prices=[],topPriceByRun=[];
 let duplicateCount=0,overBudgetCount=0,uniformWinnerCount=0;
 for(let seed=1;seed<=100;seed++){
  const scenario=["normal","normal","aggressive","conservative","mixed"][(seed-1)%5];
  const run=runFullMock(players,[], "h2h",seed,scenario);
  const names=run.log.map(p=>p.player);
  duplicateCount+=names.length-new Set(names).size;
  topPriceByRun.push(Math.max(...run.log.map(p=>p.price)));
  for(const p of run.log){
   prices.push(p.price);
   if(p.price===1)bins.one++;
   else if(p.price<=5)bins.twoToFive++;
   else if(p.price<20)bins.sixToNineteen++;
   else if(p.price<50)bins.twentyToFortyNine++;
   else bins.fiftyPlus++;
  }
  for(const t of run.teams){
   spends.push(t.spent);
   if(t.spent>200)overBudgetCount++;
  }
  const winner=run.teams.find(t=>t.team===run.winner);
  assert.ok(winner,"each run has a winning team");
  winnerSpends.push(winner.spent);
  if(new Set(winner.players.map(p=>p.price)).size<=2)uniformWinnerCount++;
 }
 const sorted=[...prices].sort((a,b)=>a-b);
 const percentile=p=>sorted[Math.floor((sorted.length-1)*p)];
 const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
 const report={auctions:100,picks:prices.length,bins,price:{min:sorted[0],p25:percentile(.25),median:percentile(.5),p75:percentile(.75),p95:percentile(.95),max:sorted.at(-1)},teamSpend:{min:Math.min(...spends),mean:avg(spends),max:Math.max(...spends)},winnerSpend:{min:Math.min(...winnerSpends),mean:avg(winnerSpends),max:Math.max(...winnerSpends)},highestSale:{min:Math.min(...topPriceByRun),mean:avg(topPriceByRun),max:Math.max(...topPriceByRun)},uniformWinnerCount,duplicateCount,overBudgetCount};
 console.log("MOCK_AUCTION_100_REPORT "+JSON.stringify(report));
 assert.equal(prices.length,16800);
 assert.equal(duplicateCount,0);
 assert.equal(overBudgetCount,0);
 assert.equal(Object.values(bins).reduce((a,b)=>a+b,0),16800);
 assert.ok(spends.every(n=>n>=12&&n<=200));
});


test("every nomination has a funded opening bid and either the nominator or a challenger wins",()=>{
 const prices=players.map((p,i)=>({player:p.player,avg:i<30?50-i:8,proj:i<30?55-i:9}));
 for(const mode of ["h2h","roto"]){
  for(const seed of [1,7,19]){
   const run=runFullMock(players,prices,mode,seed);
   const spending=Array.from({length:14},()=>0);
   const counts=Array.from({length:14},()=>0);
   for(const sale of run.log){
    const reference=prices.find(p=>p.player===sale.player);
    const calibratedProj=mode==="h2h"?Math.round(reference.proj*13/12*10)/10:reference.proj;
    const priceReference=Math.max(reference.avg,calibratedProj);
    const expected=priceReference>10?Math.floor(priceReference)+1:1;
    assert.equal(sale.opening,expected);
    assert.ok(sale.price>=sale.opening);
    if(mode==="h2h" && priceReference>10){
     assert.ok(sale.opening>reference.avg);
     assert.ok(sale.opening>calibratedProj);
    }
    assert.ok(sale.nominator>=1&&sale.nominator<=14);
    const n=sale.nominator-1;
    const remaining=CONFIG[mode].budget-spending[n];
    const open=CONFIG[mode].slots-counts[n];
    assert.ok(sale.opening<=remaining-(open-1),"nominator must afford opening bid");
    spending[sale.team-1]+=sale.price;
    counts[sale.team-1]++;
   }
   assert.ok(counts.every(c=>c===CONFIG[mode].slots));
   assert.ok(spending.every(v=>v<=200));
  }
 }
});

test("100 Yahoo-like priced H2H auctions report spending and nomination behavior",()=>{
 const prices=players.map((p,i)=>({player:p.player,avg:i<5?75-i*5:i<18?49-(i-5)*2:i<65?22-(i-18)*.3:i<110?5+(110-i)*.1:1,proj:i<5?77-i*5:i<18?51-(i-5)*2:i<65?24-(i-18)*.3:i<110?6+(110-i)*.1:1}));
 const bins={one:0,twoToFive:0,sixToNineteen:0,twentyToFortyNine:0,fiftyPlus:0};
 const spends=[],winners=[],highs=[];let nominatorWins=0,highOpenings=0,duplicates=0,overBudget=0;
 for(let seed=1;seed<=100;seed++){
  const scenario=["normal","normal","aggressive","conservative","mixed"][(seed-1)%5];
  const run=runFullMock(players,prices,"h2h",seed,scenario);
  duplicates+=run.log.length-new Set(run.log.map(x=>x.player)).size;
  highs.push(Math.max(...run.log.map(x=>x.price)));
  for(const sale of run.log){
   if(sale.team===sale.nominator)nominatorWins++;
   if(sale.opening>1)highOpenings++;
   if(sale.price===1)bins.one++;
   else if(sale.price<=5)bins.twoToFive++;
   else if(sale.price<20)bins.sixToNineteen++;
   else if(sale.price<50)bins.twentyToFortyNine++;
   else bins.fiftyPlus++;
  }
  for(const team of run.teams){spends.push(team.spent);if(team.spent>200)overBudget++;}
  winners.push(run.teams.find(x=>x.team===run.winner).spent);
 }
 const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
 console.log("YAHOO_LIKE_100_REPORT "+JSON.stringify({auctions:100,picks:16800,bins,teamSpend:{min:Math.min(...spends),mean:mean(spends),max:Math.max(...spends)},winnerSpend:{min:Math.min(...winners),mean:mean(winners),max:Math.max(...winners)},highestSale:{min:Math.min(...highs),mean:mean(highs),max:Math.max(...highs)},nominatorWins,highOpenings,duplicates,overBudget}));
 assert.equal(Object.values(bins).reduce((a,b)=>a+b,0),16800);
 assert.equal(duplicates,0);assert.equal(overBudget,0);
});

test("forced first raise mode guarantees a legal challenger when available",()=>{
 const prices=players.map((p,i)=>({player:p.player,avg:i<25?55-i:8,proj:i<25?60-i:9}));
 for(const mode of ["h2h","roto"]){
  const run=runFullMock(players,prices,mode,13,"normal","forced-first-raise");
  const spent=Array(14).fill(0),count=Array(14).fill(0);
  for(const sale of run.log){
   const eligible=Array.from({length:14},(_,i)=>i+1).filter(team=>team!==sale.nominator&&count[team-1]<CONFIG[mode].slots&&200-spent[team-1]-(CONFIG[mode].slots-count[team-1]-1)>=sale.opening+1);
   // Roster position eligibility is universal in this synthetic fixture.
   if(eligible.length)assert.ok(sale.price>=sale.opening+1,"a legal challenger must raise");
   else assert.equal(sale.team,sale.nominator,"without a challenger, nominator wins");
   assert.ok(sale.price>=sale.opening);
   spent[sale.team-1]+=sale.price;count[sale.team-1]++;
  }
  assert.ok(spent.every(v=>v<=200));assert.ok(count.every(v=>v===CONFIG[mode].slots));
 }
});
test("100 Yahoo-like forced-first-raise auctions report comparison metrics",()=>{
 const prices=players.map((p,i)=>({player:p.player,avg:i<5?75-i*5:i<18?49-(i-5)*2:i<65?22-(i-18)*.3:i<110?5+(110-i)*.1:1,proj:i<5?77-i*5:i<18?51-(i-5)*2:i<65?24-(i-18)*.3:i<110?6+(110-i)*.1:1}));
 const spends=[],winnerSpends=[],pricesPaid=[];let nominatorWins=0,overBudget=0,duplicates=0;
 for(let seed=1;seed<=100;seed++){
  const scenario=["normal","normal","aggressive","conservative","mixed"][(seed-1)%5];
  const run=runFullMock(players,prices,"h2h",seed,scenario,"forced-first-raise");
  duplicates+=168-new Set(run.log.map(x=>x.player)).size;
  for(const p of run.log){pricesPaid.push(p.price);if(p.team===p.nominator)nominatorWins++;}
  for(const t of run.teams){spends.push(t.spent);if(t.spent>200)overBudget++;}
  winnerSpends.push(run.teams.find(t=>t.team===run.winner).spent);
 }
 const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
 console.log("FORCED_RAISE_100_REPORT "+JSON.stringify({auctions:100,picks:pricesPaid.length,teamSpend:{min:Math.min(...spends),mean:mean(spends),max:Math.max(...spends)},winnerSpend:{min:Math.min(...winnerSpends),mean:mean(winnerSpends),max:Math.max(...winnerSpends)},oneDollarSales:pricesPaid.filter(x=>x===1).length,twentyPlus:pricesPaid.filter(x=>x>=20).length,fiftyPlus:pricesPaid.filter(x=>x>=50).length,maxSale:Math.max(...pricesPaid),nominatorWins,duplicates,overBudget}));
 assert.equal(pricesPaid.length,16800);assert.equal(duplicates,0);assert.equal(overBudget,0);
});

test("paired auction diagnostics locate when bidding power disappears",()=>{
 const prices=players.map((p,i)=>({player:p.player,avg:i<5?75-i*5:i<18?49-(i-5)*2:i<65?22-(i-18)*.3:i<110?5+(110-i)*.1:1,proj:i<5?77-i*5:i<18?51-(i-5)*2:i<65?24-(i-18)*.3:i<110?6+(110-i)*.1:1}));
 const report={};
 for(const biddingMode of ["normal","forced-first-raise"]){
  const rounds=[{sales:0,spent:0,oneDollar:0,meanEligibleRaisers:0},{sales:0,spent:0,oneDollar:0,meanEligibleRaisers:0},{sales:0,spent:0,oneDollar:0,meanEligibleRaisers:0}];
  const teamSpent=[],teamRemaining=[],fullBudget=[],lowSpend=[],lastThirty=[],earlyHigh=[];
  for(let seed=1;seed<=30;seed++){
   const scenario=["normal","normal","aggressive","conservative","mixed"][(seed-1)%5];
   const run=runFullMock(players,prices,"h2h",seed,scenario,biddingMode);
   const spent=Array(14).fill(0),count=Array(14).fill(0);
   for(let i=0;i<run.log.length;i++){
    const sale=run.log[i],stage=i<56?0:i<112?1:2;
    const legal=Array.from({length:14},(_,j)=>j+1).filter(team=>team!==sale.nominator&&count[team-1]<12&&200-spent[team-1]-(12-count[team-1]-1)>=sale.opening+1).length;
    const bucket=rounds[stage];
    bucket.sales++;bucket.spent+=sale.price;bucket.oneDollar+=Number(sale.price===1);bucket.meanEligibleRaisers+=legal;
    if(i>=138)lastThirty.push(sale.price);
    if(i<30&&sale.price>=50)earlyHigh.push(sale.price);
    spent[sale.team-1]+=sale.price;count[sale.team-1]++;
   }
   for(const v of spent){teamSpent.push(v);teamRemaining.push(200-v);if(v===200)fullBudget.push(v);if(v<100)lowSpend.push(v);}
  }
  const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1);
  report[biddingMode]={teamSpendMean:mean(teamSpent),teamsBelow100:lowSpend.length,teamsAt200:fullBudget.length,remainingMean:mean(teamRemaining),last30MeanPrice:mean(lastThirty),first30HighSaleCount:earlyHigh.length,stages:rounds.map((x,i)=>({stage:i+1,meanPrice:x.spent/x.sales,oneDollarPct:100*x.oneDollar/x.sales,meanLegalRaisers:x.meanEligibleRaisers/x.sales}))};
 }
 console.log("AUCTION_STAGE_DIAGNOSTIC "+JSON.stringify(report));
 assert.equal(report.normal.stages.length,3);
 assert.equal(report["forced-first-raise"].stages.length,3);
});

test("budget-aware bidding preserves legal auctions and reports paired outcomes",()=>{
 const prices=players.map((p,i)=>({player:p.player,avg:i<5?75-i*5:i<18?49-(i-5)*2:i<65?22-(i-18)*.3:i<110?5+(110-i)*.1:1,proj:i<5?77-i*5:i<18?51-(i-5)*2:i<65?24-(i-18)*.3:i<110?6+(110-i)*.1:1}));
 const report={};
 for(const biddingMode of ["normal","budget-aware"]){
  const spends=[],late=[],winners=[];let below100=0,at200=0,duplicates=0,overBudget=0;
  for(let seed=1;seed<=30;seed++){
   const scenario=["normal","normal","aggressive","conservative","mixed"][(seed-1)%5];
   const run=runFullMock(players,prices,"h2h",seed,scenario,biddingMode);
   duplicates+=run.log.length-new Set(run.log.map(x=>x.player)).size;
   late.push(...run.log.slice(-30).map(x=>x.price));
   for(const team of run.teams){
    spends.push(team.spent);
    below100+=Number(team.spent<100);at200+=Number(team.spent===200);
    overBudget+=Number(team.spent>200);
   }
   winners.push(run.teams.find(t=>t.team===run.winner).spent);
  }
  const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
  report[biddingMode]={teamSpendMean:mean(spends),winnerSpendMean:mean(winners),last30MeanPrice:mean(late),below100,at200,duplicates,overBudget};
  assert.equal(duplicates,0);assert.equal(overBudget,0);
 }
 console.log("BUDGET_AWARE_30_REPORT "+JSON.stringify(report));
});

test("100 paired Yahoo-like auctions compare normal and budget-aware market outcomes",()=>{
 const prices=players.map((p,i)=>({player:p.player,avg:i<5?75-i*5:i<18?49-(i-5)*2:i<65?22-(i-18)*.3:i<110?5+(110-i)*.1:1,proj:i<5?77-i*5:i<18?51-(i-5)*2:i<65?24-(i-18)*.3:i<110?6+(110-i)*.1:1}));
 const report={};
 for(const biddingMode of ["normal","budget-aware"]){
  const spends=[],winners=[],last30=[];let below100=0,at200=0,duplicateCount=0,overBudgetCount=0;
  const bins={one:0,twoToFive:0,sixToNineteen:0,twentyToFortyNine:0,fiftyPlus:0};
  for(let seed=1;seed<=100;seed++){
   const scenario=["normal","normal","aggressive","conservative","mixed"][(seed-1)%5];
   const run=runFullMock(players,prices,"h2h",seed,scenario,biddingMode);
   duplicateCount+=run.log.length-new Set(run.log.map(x=>x.player)).size;
   last30.push(...run.log.slice(-30).map(x=>x.price));
   for(const p of run.log){
    if(p.price===1)bins.one++;
    else if(p.price<=5)bins.twoToFive++;
    else if(p.price<20)bins.sixToNineteen++;
    else if(p.price<50)bins.twentyToFortyNine++;
    else bins.fiftyPlus++;
   }
   for(const t of run.teams){spends.push(t.spent);below100+=Number(t.spent<100);at200+=Number(t.spent===200);overBudgetCount+=Number(t.spent>200);}
   winners.push(run.teams.find(t=>t.team===run.winner).spent);
  }
  const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
  report[biddingMode]={auctions:100,teamSpendMean:mean(spends),winnerSpendMean:mean(winners),last30MeanPrice:mean(last30),below100,at200,bins,duplicateCount,overBudgetCount};
  assert.equal(Object.values(bins).reduce((s,v)=>s+v,0),16800);
  assert.equal(duplicateCount,0);assert.equal(overBudgetCount,0);
 }
 console.log("BUDGET_AWARE_100_REPORT "+JSON.stringify(report));
});

test("report every-team 180 dollar spending target across paired auction modes",()=>{
 const prices=players.map((p,i)=>({player:p.player,avg:i<5?75-i*5:i<18?49-(i-5)*2:i<65?22-(i-18)*.3:i<110?5+(110-i)*.1:1,proj:i<5?77-i*5:i<18?51-(i-5)*2:i<65?24-(i-18)*.3:i<110?6+(110-i)*.1:1}));
 const report={};
 for(const biddingMode of ["normal","forced-first-raise","budget-aware"]){
  let teamBelow180=0,allTeamsAtLeast180=0,lowest=200,total=0,teamCount=0;
  const ranges={"under100":0,"100to149":0,"150to179":0,"180to199":0,"200":0};
  for(let seed=1;seed<=30;seed++){
   const run=runFullMock(players,prices,"h2h",seed,["normal","normal","aggressive","conservative","mixed"][(seed-1)%5],biddingMode);
   const spent=run.teams.map(t=>t.spent);
   if(spent.every(v=>v>=180))allTeamsAtLeast180++;
   for(const v of spent){
    total+=v;teamCount++;lowest=Math.min(lowest,v);teamBelow180+=Number(v<180);
    if(v<100)ranges.under100++;else if(v<150)ranges["100to149"]++;else if(v<180)ranges["150to179"]++;else if(v<200)ranges["180to199"]++;else ranges["200"]++;
   }
  }
  report[biddingMode]={auctions:30,teams:teamCount,meanSpend:total/teamCount,minimumTeamSpend:lowest,teamsBelow180:teamBelow180,auctionsWithEveryTeam180:allTeamsAtLeast180,ranges};
 }
 console.log("TEAM_SPEND_180_TARGET_REPORT "+JSON.stringify(report));
 assert.equal(report.normal.teams,420);
});

test("nominations rotate through teams 1 to 14 independent of auction winners",()=>{
 const run=runFullMock(players,[],"h2h",3);
 assert.deepEqual(run.log.slice(0,14).map(p=>p.nominator),Array.from({length:14},(_,i)=>i+1));
 assert.equal(run.log[14].nominator,1);
 const counts=Array(14).fill(0);
 for(const sale of run.log){
  assert.ok(sale.nominator>=1&&sale.nominator<=14);
  counts[sale.team-1]++;
 }
 assert.ok(counts.every(n=>n===12));
});
test("nominations follow projection ranking when all players are eligible and affordable",()=>{
 const ranked=rankProjections(players);
 const run=runFullMock(players,[],"h2h",5);
 assert.deepEqual(run.log.map(x=>x.player),ranked.slice(0,168).map(x=>x.player));
});

test("ROTO 9-slot ranked nomination spending and $180 target report",()=>{
 const prices=players.map((p,i)=>({player:p.player,avg:i<5?75-i*5:i<18?49-(i-5)*2:i<65?22-(i-18)*.3:i<110?5+(110-i)*.1:1,proj:i<5?77-i*5:i<18?51-(i-5)*2:i<65?24-(i-18)*.3:i<110?6+(110-i)*.1:1}));
 const report={};
 for(const biddingMode of ["normal","budget-aware"]){
  let spent=0,below180=0,minimum=200,allTeams180=0,duplicates=0,overBudget=0;
  const rounds=20;
  for(let seed=1;seed<=rounds;seed++){
   const run=runFullMock(players,prices,"roto",seed,["normal","normal","aggressive","conservative","mixed"][(seed-1)%5],biddingMode);
   assert.equal(run.log.length,126);
   duplicates+=run.log.length-new Set(run.log.map(p=>p.player)).size;
   if(run.teams.every(t=>t.spent>=180))allTeams180++;
   for(const team of run.teams){
    assert.equal(team.players.length,9);
    spent+=team.spent;minimum=Math.min(minimum,team.spent);
    below180+=Number(team.spent<180);overBudget+=Number(team.spent>200);
   }
  }
  report[biddingMode]={auctions:rounds,teams:rounds*14,meanSpend:spent/(rounds*14),minimum,below180,allTeams180,duplicates,overBudget};
  assert.equal(duplicates,0);assert.equal(overBudget,0);
 }
 console.log("ROTO_180_TARGET_REPORT "+JSON.stringify(report));
});

test("snake nomination sequence reverses at seats 14 and 1",()=>{
 const run=runFullMock(players,[],"h2h",3,"normal","normal","snake");
 const expected=[...Array.from({length:14},(_,i)=>i+1),...Array.from({length:14},(_,i)=>14-i),1,2];
 assert.deepEqual(run.log.slice(0,14).map(p=>p.nominator),expected.slice(0,14));
 // A completed roster is skipped; therefore later nominations need not match
 // the raw seat sequence exactly. Validate that every nomination follows the
 // snake sequence after skipping teams with full rosters.
 const rosterCounts=Array(14).fill(0);
 let turn=0;
 for(const pick of run.log){
  let seat;
  do {
   const phase=turn%28;
   seat=phase<14?phase+1:28-phase;
   turn++;
  } while(rosterCounts[seat-1]===12);
  assert.equal(pick.nominator,seat);
  rosterCounts[pick.team-1]++;
 }
 assert.equal(run.log.length,168);
});
test("compare snake and round-robin spending with matched seeds",()=>{
 const prices=players.map((p,i)=>({player:p.player,avg:i<5?75-i*5:i<18?49-(i-5)*2:i<65?22-(i-18)*.3:i<110?5+(110-i)*.1:1,proj:i<5?77-i*5:i<18?51-(i-5)*2:i<65?24-(i-18)*.3:i<110?6+(110-i)*.1:1}));
 const report={};
 for(const order of ["round-robin","snake"]){
  let total=0,below180=0,min=200,all180=0;
  for(let seed=1;seed<=20;seed++){
   const run=runFullMock(players,prices,"h2h",seed,"normal","budget-aware",order);
   assert.equal(run.log.length,168);
   assert.equal(new Set(run.log.map(p=>p.player)).size,168);
   if(run.teams.every(t=>t.spent>=180))all180++;
   for(const t of run.teams){assert.equal(t.players.length,12);assert.ok(t.spent<=200);total+=t.spent;below180+=Number(t.spent<180);min=Math.min(min,t.spent);}
  }
  report[order]={auctions:20,meanSpend:total/280,below180,min,all180};
 }
 console.log("SNAKE_VS_ROUND_ROBIN_REPORT "+JSON.stringify(report));
});

test("round-robin $200 spending goal compared with budget-aware baseline",()=>{
 const prices=players.map((p,i)=>({player:p.player,avg:i<5?75-i*5:i<18?49-(i-5)*2:i<65?22-(i-18)*.3:i<110?5+(110-i)*.1:1,proj:i<5?77-i*5:i<18?51-(i-5)*2:i<65?24-(i-18)*.3:i<110?6+(110-i)*.1:1}));
 const report={};
 for(const mode of ["h2h","roto"]){
  report[mode]={};
  for(const strategy of ["budget-aware","spend-target"]){
   let total=0,below180=0,minimum=200,all180=0;
   for(let seed=1;seed<=20;seed++){
    const run=runFullMock(players,prices,mode,seed,"normal",strategy,"round-robin");
    assert.equal(run.log.length,14*CONFIG[mode].slots);
    assert.equal(new Set(run.log.map(p=>p.player)).size,run.log.length);
    if(run.teams.every(t=>t.spent>=180))all180++;
    for(const team of run.teams){
     assert.equal(team.players.length,CONFIG[mode].slots);
     assert.ok(team.spent<=200);
     total+=team.spent;below180+=Number(team.spent<180);minimum=Math.min(minimum,team.spent);
    }
   }
   report[mode][strategy]={auctions:20,meanSpend:total/280,below180,minimum,all180};
  }
 }
 console.log("SPEND_TARGET_200_COMPARISON "+JSON.stringify(report));
});

test("diagnose under-$180 rosters without altering auction prices",()=>{
 const prices=players.map((p,i)=>({player:p.player,avg:i<5?75-i*5:i<18?49-(i-5)*2:i<65?22-(i-18)*.3:i<110?5+(110-i)*.1:1,proj:i<5?77-i*5:i<18?51-(i-5)*2:i<65?24-(i-18)*.3:i<110?6+(110-i)*.1:1}));
 const report={};
 for(const mode of ["h2h","roto"]){
  const samples=[];
  for(let seed=1;seed<=20;seed++){
   const run=runFullMock(players,prices,mode,seed,"normal","spend-target","round-robin");
   for(const team of run.teams){
    if(team.spent>=180)continue;
    const picks=run.log.map((pick,index)=>({...pick,index})).filter(p=>p.team===team.team);
    const third=Math.ceil(run.log.length/3);
    const early=picks.filter(p=>p.index<third);
    const middle=picks.filter(p=>p.index>=third&&p.index<2*third);
    const late=picks.filter(p=>p.index>=2*third);
    samples.push({seed,team:team.team,spent:team.spent,unspent:200-team.spent,
     earlySpend:early.reduce((v,p)=>v+p.price,0),
     middleSpend:middle.reduce((v,p)=>v+p.price,0),
     lateSpend:late.reduce((v,p)=>v+p.price,0),
     earlyPicks:early.length,middlePicks:middle.length,latePicks:late.length,
     openingWins:picks.filter(p=>p.price===p.opening).length,
     minimumPriceWins:picks.filter(p=>p.price===1).length,
     firstPickIndex:picks[0]?.index,lastPickIndex:picks.at(-1)?.index});
   }
  }
  const avg=k=>samples.reduce((v,x)=>v+x[k],0)/Math.max(1,samples.length);
  report[mode]={under180:samples.length,meanEarlySpend:avg("earlySpend"),meanMiddleSpend:avg("middleSpend"),
   meanLateSpend:avg("lateSpend"),meanEarlyPicks:avg("earlyPicks"),meanLatePicks:avg("latePicks"),
   meanOpeningWins:avg("openingWins"),meanOneDollarWins:avg("minimumPriceWins"),
   lowest:samples.toSorted((a,b)=>a.spent-b.spent).slice(0,5)};
  assert.ok(samples.every(x=>x.earlySpend+x.middleSpend+x.lateSpend===x.spent));
 }
 console.log("UNDERSPEND_DIAGNOSTIC_REPORT "+JSON.stringify(report));
});

test("compare early pacing experiment with $200 goal on matched seeds",()=>{
 const prices=players.map((p,i)=>({player:p.player,avg:i<5?75-i*5:i<18?49-(i-5)*2:i<65?22-(i-18)*.3:i<110?5+(110-i)*.1:1,proj:i<5?77-i*5:i<18?51-(i-5)*2:i<65?24-(i-18)*.3:i<110?6+(110-i)*.1:1}));
 const report={};
 for(const mode of ["h2h","roto"]){
  report[mode]={};
  for(const strategy of ["spend-target","paced-target"]){
   let below180=0,min=200,total=0,lateFirst=0;
   for(let seed=1;seed<=20;seed++){
    const run=runFullMock(players,prices,mode,seed,"normal",strategy,"round-robin");
    assert.equal(run.log.length,14*CONFIG[mode].slots);
    assert.equal(new Set(run.log.map(p=>p.player)).size,run.log.length);
    for(const team of run.teams){
     assert.equal(team.players.length,CONFIG[mode].slots);
     assert.ok(team.spent<=200);
     total+=team.spent;below180+=Number(team.spent<180);min=Math.min(min,team.spent);
     lateFirst+=Number(run.log.findIndex(p=>p.team===team.team)>=run.log.length/3);
    }
   }
   report[mode][strategy]={meanSpend:total/280,below180,min,lateFirst};
  }
 }
 console.log("PACING_200_COMPARISON "+JSON.stringify(report));
});

test("Yahoo max Avg/Proj value guard versus $200 spend target",()=>{
 const prices=players.map((p,i)=>({player:p.player,avg:i<5?75-i*5:i<18?49-(i-5)*2:i<65?22-(i-18)*.3:i<110?5+(110-i)*.1:1,proj:i<5?77-i*5:i<18?51-(i-5)*2:i<65?24-(i-18)*.3:i<110?6+(110-i)*.1:1}));
 const report={};
 for(const mode of ["h2h","roto"]){
  report[mode]={};
  for(const strategy of ["spend-target","value-guard"]){
   let below180=0,min=200,total=0,all180=0;
   for(let seed=1;seed<=20;seed++){
    const run=runFullMock(players,prices,mode,seed,"normal",strategy,"round-robin");
    assert.equal(run.log.length,14*CONFIG[mode].slots);
    assert.equal(new Set(run.log.map(p=>p.player)).size,run.log.length);
    all180+=Number(run.teams.every(t=>t.spent>=180));
    for(const team of run.teams){
     assert.equal(team.players.length,CONFIG[mode].slots);
     assert.ok(team.spent<=200);
     total+=team.spent;below180+=Number(team.spent<180);min=Math.min(min,team.spent);
    }
   }
   report[mode][strategy]={meanSpend:total/280,below180,min,all180};
  }
 }
 console.log("YAHOO_VALUE_GUARD_COMPARISON "+JSON.stringify(report));
});

test("compare pacing versus Yahoo value guard on auction prices and draft quality",()=>{
 const prices=players.map((p,i)=>({player:p.player,avg:i<5?75-i*5:i<18?49-(i-5)*2:i<65?22-(i-18)*.3:i<110?5+(110-i)*.1:1,proj:i<5?77-i*5:i<18?51-(i-5)*2:i<65?24-(i-18)*.3:i<110?6+(110-i)*.1:1}));
 const refs=new Map(prices.map(p=>[p.player,Math.max(p.avg,Math.round(p.proj*13/12*10)/10)]));
 const report={};
 for(const mode of ["h2h","roto"]){
  report[mode]={};
  for(const strategy of ["spend-target","value-guard","paced-target"]){
   let count=0,below180=0,overReference=0,aboveTwiceReference=0,totalRatio=0,quality=0,rankSum=0;
   for(let seed=1;seed<=20;seed++){
    const run=runFullMock(players,prices,mode,seed,"normal",strategy,"round-robin");
    for(const team of run.teams){below180+=Number(team.spent<180);quality+=team.score;rankSum+=team.rank;}
    for(const pick of run.log){
     const ref=refs.get(pick.player);
     if(ref>0){
      count++;
      const ratio=pick.price/ref;
      totalRatio+=ratio;
      overReference+=Number(ratio>1.5);
      aboveTwiceReference+=Number(ratio>2);
     }
    }
   }
   report[mode][strategy]={below180,meanPriceToYahoo:totalRatio/count,over150pct:overReference,over200pct:aboveTwiceReference,meanTeamScore:quality/280,meanRank:rankSum/280};
  }
 }
 console.log("PACING_PRICE_QUALITY_COMPARISON "+JSON.stringify(report));
});

test("top-four strategies complete legal H2H auctions",()=>{
 for(const strategy of ["top4-90","top4-100","top4-110","top4-value-100"]){
  const run=runFullMock(players,[],"h2h",17,"normal",strategy);
  assert.equal(run.log.length,168);
  assert.ok(run.teams.every(t=>t.players.length===12&&t.spent<=200));
 }
});

test("top-four goals matched-seed spending report",()=>{
 const report={};
 for(const strategy of ["spend-target","paced-target","top4-90","top4-100","top4-110","top4-value-100"]){
  let spent=0,below=0,top4=0;
  for(let seed=1;seed<=10;seed++){
   const run=runFullMock(players,[],"h2h",seed,"normal",strategy);
   for(const team of run.teams){
    spent+=team.spent;below+=Number(team.spent<180);
    const best=run.log.filter(p=>p.team===team.team).map(p=>p.price).sort((a,b)=>b-a).slice(0,4);
    top4+=Number(best.reduce((a,b)=>a+b,0)>100);
   }
  }
  report[strategy]={meanSpend:spent/140,below180:below,top4Above100:top4};
 }
 console.log("TOP4_REPORT "+JSON.stringify(report));
});

test("top-four Yahoo-priced comparison",()=>{
 const prices=players.map((p,i)=>({player:p.player,avg:i<5?75-i*5:i<18?49-(i-5)*2:i<65?22-(i-18)*.3:i<110?5+(110-i)*.1:1,proj:i<5?77-i*5:i<18?51-(i-5)*2:i<65?24-(i-18)*.3:i<110?6+(110-i)*.1:1}));
 const report={};
 for(const strategy of ["spend-target","paced-target","top4-90","top4-100","top4-110","top4-value-100"]){
  let spent=0,below=0,top4=0,late=0;
  for(let seed=1;seed<=10;seed++){
   const run=runFullMock(players,prices,"h2h",seed,"normal",strategy);
   for(const team of run.teams){
    spent+=team.spent;below+=Number(team.spent<180);
    const best=run.log.filter(p=>p.team===team.team).map(p=>p.price).sort((a,b)=>b-a).slice(0,4);
    top4+=Number(best.reduce((a,b)=>a+b,0)>100);
    late+=Number(run.log.findIndex(p=>p.team===team.team)>=56);
   }
  }
  report[strategy]={meanSpend:spent/140,below180:below,top4Above100:top4,lateFirst:late};
 }
 console.log("TOP4_YAHOO_REPORT "+JSON.stringify(report));
});

test("top-four spending versus Yahoo value and overpay audit",()=>{
 const prices=players.map((p,i)=>({player:p.player,avg:i<5?75-i*5:i<18?49-(i-5)*2:i<65?22-(i-18)*.3:i<110?5+(110-i)*.1:1,proj:i<5?77-i*5:i<18?51-(i-5)*2:i<65?24-(i-18)*.3:i<110?6+(110-i)*.1:1}));
 const yahoo=new Map(prices.map(p=>[p.player,Math.max(p.avg,p.proj)]));
 const report={};
 for(const strategy of ["spend-target","paced-target","top4-90","top4-100","top4-110","top4-value-100"]){
  let teams=0,top4Above100=0,top4YahooValue=0,top4Paid=0,over150=0,over200=0;
  for(let seed=1;seed<=10;seed++){
   const run=runFullMock(players,prices,"h2h",seed,"normal",strategy);
   for(const team of run.teams){
    const top=run.log.filter(p=>p.team===team.team).sort((a,b)=>b.price-a.price).slice(0,4);
    teams++;
    const paid=top.reduce((sum,p)=>sum+p.price,0);
    const value=top.reduce((sum,p)=>sum+(yahoo.get(p.player)??0),0);
    top4Paid+=paid;top4YahooValue+=value;top4Above100+=Number(paid>100);
    for(const p of top){const v=yahoo.get(p.player);if(v>0){over150+=Number(p.price>1.5*v);over200+=Number(p.price>2*v);}}
   }
  }
  report[strategy]={top4Above100,meanTop4Paid:top4Paid/teams,meanTop4YahooValue:top4YahooValue/teams,top4Over150:over150,top4Over200:over200};
 }
 console.log("TOP4_VALUE_AUDIT "+JSON.stringify(report));
});

test("value-gated top-four boost requires actual Yahoo prices",()=>{
 for(const seed of [1,7]){
  const baseline=runFullMock(players,[],"h2h",seed,"normal","spend-target");
  const guarded=runFullMock(players,[],"h2h",seed,"normal","top4-value-100");
  assert.deepEqual(guarded.log.map(p=>[p.player,p.team,p.price]),baseline.log.map(p=>[p.player,p.team,p.price]));
 }
});

test("audit full-roster Yahoo value versus auction spend",()=>{
 const prices=players.map((p,i)=>({player:p.player,avg:i<5?75-i*5:i<18?49-(i-5)*2:i<65?22-(i-18)*.3:i<110?5+(110-i)*.1:1,proj:i<5?77-i*5:i<18?51-(i-5)*2:i<65?24-(i-18)*.3:i<110?6+(110-i)*.1:1}));
 const refs=new Map(prices.map(p=>[p.player,Math.max(p.avg,Math.round(p.proj*13/12*10)/10)]));
 const out={};
 for(const mode of ["spend-target","paced-target","top4-90","top4-100","top4-110","top4-value-100"]){
  let paid=0,value=0,teams=0,over150=0,over200=0;
  for(let seed=1;seed<=10;seed++){
   const run=runFullMock(players,prices,"h2h",seed,"normal",mode);
   for(const t of run.teams){
    teams++;
    for(const p of run.log.filter(p=>p.team===t.team)){
     const ref=refs.get(p.player)??0;paid+=p.price;value+=ref;
     if(ref>0){over150+=Number(p.price>ref*1.5);over200+=Number(p.price>ref*2);}
    }
   }
  }
  out[mode]={meanSpend:paid/teams,meanYahooValue:value/teams,over150,over200};
 }
 console.log("FULL_ROSTER_VALUE_AUDIT "+JSON.stringify(out));
});

test("Yahoo 120 percent cap never overpays known references",()=>{
 const prices=players.map((p,i)=>({player:p.player,avg:i<5?75-i*5:i<18?49-(i-5)*2:i<65?22-(i-18)*.3:i<110?5+(110-i)*.1:1,proj:i<5?77-i*5:i<18?51-(i-5)*2:i<65?24-(i-18)*.3:i<110?6+(110-i)*.1:1}));
 const refs=new Map(prices.map(p=>[p.player,Math.max(p.avg,Math.round(p.proj*13/12*10)/10)]));
 for(const seed of [1,2,3]){
  const run=runFullMock(players,prices,"h2h",seed,"normal","cap-120");
  assert.equal(run.log.length,168);
  for(const pick of run.log){
   const ref=refs.get(pick.player);
   if(ref>0)assert.ok(pick.price<=Math.max(1,Math.floor(ref*1.2)),pick.player+" exceeds Yahoo cap");
  }
 }
});

test("final team calibration metrics use four costliest players regardless of nomination order",()=>{
 for(const mode of ["spend-target","paced-target","top4-100","cap-120"]){
  const prices=players.map((p,i)=>({player:p.player,avg:i<5?75-i*5:i<18?49-(i-5)*2:i<65?22-(i-18)*.3:i<110?5+(110-i)*.1:1,proj:i<5?77-i*5:i<18?51-(i-5)*2:i<65?24-(i-18)*.3:i<110?6+(110-i)*.1:1}));
  const result=runFullMock(players,prices,"h2h",3,"normal",mode);
  for(const team of result.teams){
   const costs=team.players.map(p=>p.price);
   const expected=costs.slice().sort((a,b)=>b-a).slice(0,4).reduce((a,b)=>a+b,0);
   assert.equal(team.top4Spend,expected);
   assert.equal(team.dollarOneCount,costs.filter(x=>x===1).length);
   assert.equal(team.unspent,200-team.spent);
   assert.ok(team.top4Spend<=team.spent);
  }
 }
});

test("calibrate team spending concentration and dollar-one distribution across strategies",()=>{
 const prices=players.map((p,i)=>({player:p.player,avg:i<5?75-i*5:i<18?49-(i-5)*2:i<65?22-(i-18)*.3:i<110?5+(110-i)*.1:1,proj:i<5?77-i*5:i<18?51-(i-5)*2:i<65?24-(i-18)*.3:i<110?6+(110-i)*.1:1}));
 const report={};
 for(const mode of ["spend-target","paced-target","top4-100","top4-value-100","cap-120","integrated-120"]){
  let teams=0,top4=0,top8=0,above100=0,above170=0,both=0,oneDollar=0,unspent=0,below180=0;
  for(let seed=1;seed<=10;seed++){
   const run=runFullMock(players,prices,"h2h",seed,"normal",mode);
   for(const t of run.teams){
    teams++;top4+=t.top4Spend;top8+=t.top8Spend;above100+=Number(t.top4Spend>100);above170+=Number(t.top8Spend>170);both+=Number(t.top4Spend>100&&t.top8Spend>170);
    oneDollar+=t.dollarOneCount;unspent+=t.unspent;below180+=Number(t.spent<180);
   }
  }
  report[mode]={meanTop4:top4/teams,meanTop8:top8/teams,above100,above170,both,meanDollarOne:oneDollar/teams,meanUnspent:unspent/teams,below180};
 }
 const real=JSON.parse(readFileSync(new URL("./fixtures/yahoo-mock-auction-12x13.json",import.meta.url),"utf8"));
 const realTop4=real.pricesByTeam.map(costs=>costs.slice().sort((a,b)=>b-a).slice(0,4).reduce((sum,x)=>sum+x,0));
 const realTop8=real.pricesByTeam.map(costs=>costs.slice().sort((a,b)=>b-a).slice(0,8).reduce((sum,x)=>sum+x,0));
 const realOneDollar=real.pricesByTeam.flat().filter(x=>x===1).length;
 const benchmark={source:"Yahoo mock 12 teams x 13 slots, price-only; not nomination order",meanSpend:real.pricesByTeam.flat().reduce((a,b)=>a+b,0)/real.teams,meanTop4:realTop4.reduce((a,b)=>a+b,0)/real.teams,meanTop8:realTop8.reduce((a,b)=>a+b,0)/real.teams,top8Above170Share:realTop8.filter(x=>x>170).length/real.teams,bothTargetsShare:realTop8.filter((x,i)=>x>170&&realTop4[i]>100).length/real.teams,top4Above100Share:realTop4.filter(x=>x>100).length/real.teams,oneDollarShare:realOneDollar/(real.teams*real.slots)};
 const comparison=Object.fromEntries(Object.entries(report).map(([mode,r])=>[mode,{...r,top4Above100Share:r.above100/140,top8Above170Share:r.above170/140,bothTargetsShare:r.both/140,oneDollarShare:r.meanDollarOne/12,meanSpend:200-r.meanUnspent}]));
 console.log("MOCK_MARKET_CALIBRATION "+JSON.stringify({benchmark,comparison,warning:"12x13 real vs 14x12 synthetic: directional comparison only; Yahoo references not available for real auction"}));
});

test("real Yahoo mock benchmark is a 12-by-13 price-only reference, not nomination order",()=>{
 const fixture=JSON.parse(readFileSync(new URL("./fixtures/yahoo-mock-auction-12x13.json",import.meta.url),"utf8"));
 assert.equal(fixture.teams,12);
 assert.equal(fixture.slots,13);
 const totals=fixture.pricesByTeam.map(costs=>{
  assert.equal(costs.length,13);
  assert.ok(costs.every(x=>Number.isInteger(x)&&x>=1));
  return costs.reduce((a,b)=>a+b,0);
 });
 assert.equal(totals.reduce((a,b)=>a+b,0),2392);
 assert.equal(totals.filter(x=>x===200).length,10);
 const top4=fixture.pricesByTeam.map(costs=>costs.slice().sort((a,b)=>b-a).slice(0,4).reduce((a,b)=>a+b,0));
 assert.equal(top4.filter(x=>x>100).length,11);
 const oneDollar=fixture.pricesByTeam.flat().filter(x=>x===1).length;
 console.log("REAL_YAHOO_MOCK_BENCHMARK "+JSON.stringify({teams:12,slots:13,meanSpend:2392/12,meanTop4:top4.reduce((a,b)=>a+b,0)/12,top4Above100:11,oneDollar,oneDollarShare:oneDollar/156}));
});

test("integrated Yahoo auction combines nomination rotation, floor, cap and final top-four metrics",()=>{
 const prices=players.map((p,i)=>({player:p.player,avg:i<5?75-i*5:i<18?49-(i-5)*2:i<65?22-(i-18)*.3:i<110?5+(110-i)*.1:1,proj:i<5?77-i*5:i<18?51-(i-5)*2:i<65?24-(i-18)*.3:i<110?6+(110-i)*.1:1}));
 const refs=new Map(prices.map(p=>[p.player,Math.max(p.avg,Math.round(p.proj*13/12*10)/10)]));
 const result=runFullMock(players,prices,"h2h",2,"normal","integrated-120");
 assert.equal(result.log.length,168);
 for(const pick of result.log){
  const ref=refs.get(pick.player);
  if(ref>10)assert.ok(pick.price>=Math.floor(ref)+1,pick.player+" below Yahoo reference floor");
  assert.ok(pick.price<=Math.max(1,Math.floor(ref*1.2)),pick.player+" above Yahoo 120% cap");
 }
 for(const t of result.teams){
  assert.equal(t.players.length,12);
  assert.equal(t.top4Spend,t.players.map(p=>p.price).sort((a,b)=>b-a).slice(0,4).reduce((a,b)=>a+b,0));
  assert.equal(t.top8Spend,t.players.map(p=>p.price).sort((a,b)=>b-a).slice(0,8).reduce((a,b)=>a+b,0));
 }
});

test("diagnose integrated Yahoo auction clearing prices without changing auction outcomes",()=>{
 const prices=players.map((p,i)=>({player:p.player,avg:i<5?75-i*5:i<18?49-(i-5)*2:i<65?22-(i-18)*.3:i<110?5+(110-i)*.1:1,proj:i<5?77-i*5:i<18?51-(i-5)*2:i<65?24-(i-18)*.3:i<110?6+(110-i)*.1:1}));
 const refs=new Map(prices.map(p=>[p.player,Math.max(p.avg,Math.round(p.proj*13/12*10)/10)]));
 let picks=0,atOpening=0,atCap=0,above10=0,below10=0,highAtOpening=0,nominationWins=0,highReferenceSpend=0,lowReferenceSpend=0;
 for(let seed=1;seed<=10;seed++){
  const result=runFullMock(players,prices,"h2h",seed,"normal","integrated-120");
  for(const pick of result.log){
   const ref=refs.get(pick.player);
   picks++;
   if(pick.price===pick.opening)atOpening++;
   if(pick.price===Math.max(1,Math.floor(ref*1.2)))atCap++;
   if(pick.team===pick.nominator)nominationWins++;
   if(ref>10){above10++;highReferenceSpend+=pick.price;if(pick.price===pick.opening)highAtOpening++;}
   else {below10++;lowReferenceSpend+=pick.price;}
  }
 }
 const report={picks,atOpening,atOpeningShare:atOpening/picks,atCap,atCapShare:atCap/picks,nominationWins,nominationWinShare:nominationWins/picks,highReferencePicks:above10,highAtOpeningShare:above10?highAtOpening/above10:0,highReferenceSpend,lowReferencePicks:below10,lowReferenceSpend};
 console.log("INTEGRATED_CLEARING_DIAGNOSTIC "+JSON.stringify(report));
 assert.equal(picks,1680);
 assert.equal(above10+below10,picks);
});

test("audit Yahoo 120% price-cap supply against league budget before tuning boosts",()=>{
 const prices=players.map((p,i)=>({player:p.player,avg:i<5?75-i*5:i<18?49-(i-5)*2:i<65?22-(i-18)*.3:i<110?5+(110-i)*.1:1,proj:i<5?77-i*5:i<18?51-(i-5)*2:i<65?24-(i-18)*.3:i<110?6+(110-i)*.1:1}));
 const cap=p=>Math.max(1,Math.floor(Math.max(p.avg,Math.round(p.proj*13/12*10)/10)*1.2));
 const slots=14*12,budget=14*200;
 const caps=prices.map(cap).sort((a,b)=>b-a);
 const maximumUnconstrainedRevenue=caps.slice(0,slots).reduce((a,b)=>a+b,0);
 const result=runFullMock(players,prices,"h2h",1,"normal","integrated-120");
 const realizedRevenue=result.teams.reduce((a,t)=>a+t.spent,0);
 const realizedCaps=result.log.reduce((a,p)=>{
  const reference=prices.find(q=>q.player===p.player);
  return a+cap(reference);
 },0);
 const report={slots,budget,maximumUnconstrainedRevenue,maximumUnconstrainedMeanSpend:maximumUnconstrainedRevenue/14,realizedRevenue,realizedMeanSpend:realizedRevenue/14,realizedCaps,realizedCapMeanSpend:realizedCaps/14,unselectedCapSupply:maximumUnconstrainedRevenue-realizedCaps};
 console.log("YAHOO_CAP_SUPPLY_AUDIT "+JSON.stringify(report));
 assert.ok(realizedRevenue<=realizedCaps);
 assert.ok(realizedCaps<=maximumUnconstrainedRevenue);
 assert.ok(maximumUnconstrainedRevenue>=realizedRevenue);
 // This synthetic price curve has insufficient 120% cap supply to spend $200 per team.
 // Guard the fixture assumption explicitly; never interpret under-spending as weak bidding.
 assert.ok(maximumUnconstrainedRevenue<budget,"synthetic fixture no longer has a structural cap shortfall; revisit calibration interpretation");
 assert.ok(realizedRevenue<=maximumUnconstrainedRevenue,"realized revenue cannot exceed maximum theoretical cap supply");
});

test("nomination settlement: uncontested, outbid, counterbid and tied max",()=>{
 assert.deepEqual(settleNomination(43,1,80,[]),{team:1,price:43,raised:false});
 assert.deepEqual(settleNomination(43,1,50,[{team:2,bid:60}]),{team:2,price:51,raised:true});
 assert.deepEqual(settleNomination(43,1,80,[{team:2,bid:60}]),{team:1,price:61,raised:true});
 assert.deepEqual(settleNomination(43,1,60,[{team:2,bid:60}]),{team:1,price:60,raised:true});
 assert.deepEqual(settleNomination(1,1,1,[]),{team:1,price:1,raised:false});
 assert.throws(()=>settleNomination(43,1,42,[]));
});

test("H2H capped auction records no cap violation",()=>{
 const prices=players.map((p,i)=>({player:p.player,avg:i<20?60-i:Math.max(1,18-i*.07),proj:i<20?62-i:Math.max(1,19-i*.07)}));
 for(const seed of [1,7,19]){
  const run=runFullMock(players,prices,"h2h",seed,"normal","integrated-120");
  assert.equal(run.log.length,168);
  for(const sale of run.log){
   assert.ok(sale.price>=sale.opening);
   if(sale.yahooCap!==null)assert.ok(sale.price<=sale.yahooCap);
  }
 }
});
