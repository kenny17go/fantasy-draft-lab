import test from "node:test";
import assert from "node:assert/strict";
import {buildLeagueMarket,leagueTarget,minimumLeagueBid,priceReality} from "../src/league-market.js";
const prices=Array.from({length:20},(_,i)=>({player:"Player "+(i+1),avg:80-i*3}));
test("Yahoo prices remain valuation references",()=>{
 const m=buildLeagueMarket(prices);
 assert.equal(leagueTarget({player:"Player 1"},80,m),106);
 assert.equal(leagueTarget({player:"Player 10"},53,m),64);
});
test("every player can legally clear at $1 regardless of Yahoo reference",()=>{
 const m=buildLeagueMarket([{player:"Low",avg:0,proj:0},{player:"Mid",avg:12.4},{player:"Elite",avg:80}]);
 for(const p of [{player:"Low"},{player:"Mid"},{player:"Elite"}]){
  assert.equal(minimumLeagueBid(p,80,m),1);
  assert.equal(priceReality({players:[{player:p.player,price:1}]},m).credible,true);
 }
 assert.equal(priceReality({players:[{player:"Elite",price:0}]},m).credible,false);
});
test("missing and fractional prices are preserved as market references",()=>{
 const m=buildLeagueMarket([{player:"Zero",avg:0,proj:0},{player:"Fractional",avg:0.2,proj:0.8},{player:"Only Proj",avg:null,proj:3}]);
 assert.equal(m.reference.has("zero"),false);
 assert.equal(m.reference.get("fractional"),0.8);
 assert.equal(m.reference.get("only proj"),3);
});
