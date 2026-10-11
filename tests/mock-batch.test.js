import test from "node:test";
import assert from "node:assert/strict";
import {runFullMock,runMockBatch} from "../src/mock-batch.js";
import {CONFIG} from "../src/model.js";
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
