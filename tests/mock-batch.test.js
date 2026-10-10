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
 for(const team of run.teams){assert.equal(team.players.length,CONFIG.roto.slots);assert.ok(team.spent<=200);assert.ok(team.spent>=CONFIG.roto.slots);}
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
