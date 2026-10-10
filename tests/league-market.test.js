import test from "node:test";
import assert from "node:assert/strict";
import {buildLeagueMarket,leagueTarget,priceReality} from "../src/league-market.js";
import {recommendMockTeams} from "../src/mock-recommendations.js";
const prices=Array.from({length:20},(_,i)=>({player:"Player "+(i+1),avg:80-i*3}));
test("elite five carry the highest league premiums",()=>{
 const m=buildLeagueMarket(prices);
 assert.equal(leagueTarget({player:"Player 1"},80,m),106);
 assert.equal(leagueTarget({player:"Player 10"},53,m),64);
 assert.equal(leagueTarget({player:"Player 20"},23,m),20);
});
test("underpriced elite pick is not credible",()=>{
 const m=buildLeagueMarket(prices);
 assert.equal(priceReality({players:[{player:"Player 1",price:60}]},m).credible,false);
 assert.equal(priceReality({players:[{player:"Player 1",price:110}]},m).credible,true);
});
test("top-five does not recommend an underpriced superstar",()=>{
 const stats={fgPct:.5,ftPct:.8,three:100,pts:1000,reb:400,ast:300,stl:90,blk:50,tov:100};
 const teams=[{team:1,players:[{player:"Player 1",price:50}],stats},{team:2,players:[{player:"Player 1",price:110}],stats}];
 const best=recommendMockTeams([{teams,scenario:"normal"}],5,prices);
 assert.ok(best.every(t=>t.team!==1));
});
