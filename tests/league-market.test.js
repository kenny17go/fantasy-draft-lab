import test from "node:test";
import assert from "node:assert/strict";
import {buildLeagueMarket,leagueTarget,minimumLeagueBid,priceReality} from "../src/league-market.js";
import {recommendMockTeams} from "../src/mock-recommendations.js";
const prices=Array.from({length:20},(_,i)=>({player:"Player "+(i+1),avg:80-i*3}));
test("elite five carry the highest league premiums",()=>{
 const m=buildLeagueMarket(prices);
 assert.equal(leagueTarget({player:"Player 1"},80,m),106);
 assert.equal(leagueTarget({player:"Player 10"},53,m),64);
 assert.equal(leagueTarget({player:"Player 20"},23,m),24);
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

test("only Yahoo reference $5 or below may clear at $1",()=>{
 const m=buildLeagueMarket([{player:"Low",avg:5},{player:"Mid",avg:6},{player:"High",avg:30}]);
 assert.equal(minimumLeagueBid({player:"Low"},5,m),1);
 assert.equal(minimumLeagueBid({player:"Mid"},6,m),6);
 assert.equal(minimumLeagueBid({player:"High"},30,m),30);
 assert.equal(priceReality({players:[{player:"Mid",price:1}]},m).credible,false);
});

test("fractional Yahoo reference above $5 rounds up to next dollar",()=>{
 const m=buildLeagueMarket([{player:"Fraction",avg:12.4}]);
 assert.equal(minimumLeagueBid({player:"Fraction"},12.4,m),13);
 assert.equal(priceReality({players:[{player:"Fraction",price:12}]},m).credible,false);
 assert.equal(priceReality({players:[{player:"Fraction",price:13}]},m).credible,true);
});

test("Yahoo prices at $50 or more require at least ten percent premium",()=>{
 const m=buildLeagueMarket([{player:"Below",avg:49.99},{player:"At",avg:50},{player:"Above",avg:62},{player:"Elite",avg:81.6}]);
 assert.equal(minimumLeagueBid({player:"Below"},49.99,m),50);
 assert.equal(minimumLeagueBid({player:"At"},50,m),55);
 assert.equal(minimumLeagueBid({player:"Above"},62,m),69);
 assert.equal(minimumLeagueBid({player:"Elite"},81.6,m),90);
 assert.equal(priceReality({players:[{player:"At",price:54}]},m).credible,false);
 assert.equal(priceReality({players:[{player:"At",price:55}]},m).credible,true);
});

test("higher of Yahoo Avg and Proj governs floor and price credibility",()=>{
 const m=buildLeagueMarket([{player:"Proj Higher",avg:14.9,proj:25},{player:"Avg Higher",avg:62,proj:40},{player:"Proj Elite",avg:45,proj:70},{player:"Only Proj",avg:null,proj:12.3},{player:"Low",avg:3,proj:5}]);
 assert.equal(minimumLeagueBid({player:"Proj Higher"},14.9,m),25);
 assert.equal(minimumLeagueBid({player:"Avg Higher"},62,m),69);
 assert.equal(minimumLeagueBid({player:"Proj Elite"},45,m),77);
 assert.equal(minimumLeagueBid({player:"Only Proj"},12.3,m),13);
 assert.equal(minimumLeagueBid({player:"Low"},5,m),1);
 assert.equal(priceReality({players:[{player:"Proj Higher",price:20}]},m).credible,false);
 assert.equal(priceReality({players:[{player:"Proj Higher",price:25}]},m).credible,true);
 assert.equal(priceReality({players:[{player:"Proj Elite",price:76}]},m).credible,false);
});
