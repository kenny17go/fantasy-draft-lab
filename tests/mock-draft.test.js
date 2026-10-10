import test from "node:test";
import assert from "node:assert/strict";
import {createMock,mockAuctionStep} from "../src/mock-draft.js";
import {fresh} from "../src/model.js";
const players=Array.from({length:200},(_,i)=>({player:"Player "+(i+1),positions:["PG","SG","SF","PF","C"],gp:70,pts:30-i*.1,reb:9,ast:6,stl:1.2,blk:1,three:2,tov:2,fgm:9,fga:18,ftm:5,fta:6}));
test("mock auction stays isolated from real draft state",()=>{
 const real=fresh("h2h"),initial=createMock("h2h");
 const result=mockAuctionStep(initial,players,[],[],1);
 assert.equal(real.picks.length,0);
 assert.equal(initial.state.picks.length,0);
 assert.equal(result.mock.state.picks.length,1);
 assert.ok(result.price>=1);
 assert.ok(result.price<=200);
});
test("mock auction validates user bid",()=>{
 assert.throws(()=>mockAuctionStep(createMock("roto"),players,[],[],201),/上限/);
});
test("mock auction avoids repeat purchases",()=>{
 let mock=createMock("roto");const first=mockAuctionStep(mock,players);mock=first.mock;
 const second=mockAuctionStep(mock,players);
 assert.notEqual(first.player,second.player);
});
