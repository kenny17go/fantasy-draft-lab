import test from "node:test";
import assert from "node:assert/strict";
import {simulateDraft} from "../src/simulation.js";
import {evaluateDraft} from "../src/evaluation.js";
import {CONFIG} from "../src/model.js";
const pool=()=>Array.from({length:210},(_,i)=>({player:"Test "+i,positions:[["PG","SG","SF","PF","C"][i%5]],gp:70,pts:12+i%19,reb:3+i%9,ast:2+i%8,stl:1+i%3*.2,blk:.5+i%4*.2,three:1+i%3*.4,tov:1+i%4*.3,fgm:5+i%5,fga:12+i%5,ftm:3,fta:4}));
for(const mode of ["h2h","roto"])test(mode+" evaluates all 14 completed teams",()=>{
 const players=pool(),draft=simulateDraft(players,mode),result=evaluateDraft(draft.state,players);
 assert.equal(result.standings.length,14);
 assert.equal(new Set(result.standings.map(t=>t.team)).size,14);
 assert.ok(result.standings.every(t=>Number.isFinite(t.score)));
 if(mode==="h2h"){
  assert.equal(result.standings.reduce((s,t)=>s+t.wins,0)+result.standings.reduce((s,t)=>s+t.ties,0)/2,91);
  assert.ok(result.standings.every(t=>t.wins+t.ties+t.losses===13));
 }else assert.equal(result.standings.reduce((s,t)=>s+t.score,0),945);
});
test("evaluation refuses partial drafts",()=>assert.throws(()=>evaluateDraft({mode:"h2h",picks:[]},pool()),/完整/));
