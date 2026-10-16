import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runFullMock} from "../src/mock-batch.js";
const app=readFileSync(new URL("../src/app.js",import.meta.url),"utf8");
const snapshot=JSON.parse(readFileSync(new URL("./fixtures/yahoo-2026-10-10-snapshot.json",import.meta.url),"utf8"));
test("Mock Draft UI selects V5 only for H2H and records model identity",()=>{
 assert.match(app,/runFullMock\(players,prices,selectedMode,i\+1,scenarios\[i%scenarios\.length\],selectedMode==="h2h"\?"auction-v5":"normal"\)/);
 assert.match(app,/biddingModel:selectedMode==="h2h"\?"Auction V5":"Normal"/);
 assert.match(app,/biddingModel:data\.biddingModel/);
 assert.match(app,/H2H 新模擬採用 Auction V5/);
});
test("UI V5 call produces complete and budget-legal real Yahoo H2H simulation",()=>{
 const result=runFullMock(snapshot.projections,snapshot.prices,"h2h",1,"normal","auction-v5");
 assert.equal(result.log.length,168);
 assert.equal(result.teams.length,14);
 for(const team of result.teams){assert.equal(team.players.length,12);assert.ok(team.spent<=200);assert.ok(team.spent>=12);}
 assert.equal(result.log.filter(s=>s.price<1).length,0);
});
