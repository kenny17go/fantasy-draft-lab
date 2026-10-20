import test from "node:test";
import assert from "node:assert/strict";
import {parseRoster,parseYahooTable,rosterWeek,compareRosterWeeks} from "../src/h2h-roster.js";
test("roster paste maps explicit team codes and rejects unknown codes",()=>{
 const roster=parseRoster(["Player One, NY","Player Two\tGS"].join("\n"));
 assert.deepEqual(roster.map(x=>x.team),["NYK","GSW"]);
 assert.throws(()=>parseRoster("Player Three, XXX"));
 assert.throws(()=>parseRoster("Player One, NYK\nPlayer One, BOS"));
});
test("weekly games count excludes next week",()=>{
 const roster=parseRoster("Player One, NYK\nPlayer Two, BOS");
 const games=[{date:"2026-10-20",home:"NYK",away:"BOS"},{date:"2026-10-27",home:"NYK",away:"BOS"}];
 assert.deepEqual(rosterWeek(games,roster,"2026-10-20").map(x=>x.games),[1,1]);
});

test("Yahoo tabular rows require one NBA team and preserve names",()=>{
 const rows=parseYahooTable("Player\\tTeam\\tPosition\\nJayson Tatum\\tBOS\\tSF\\nStephen Curry\\tGSW\\tPG".replaceAll("\\\\t","\\t").replaceAll("\\\\n","\\n"));
 assert.deepEqual(rows.map(x=>x.team),["BOS","GSW"]);
 assert.throws(()=>parseYahooTable("Someone\\tBOS\\tNYK"));
});
test("weekly comparison reports scheduled game difference",()=>{
 const games=[{date:"2026-10-20",home:"NYK",away:"BOS"},{date:"2026-10-21",home:"NYK",away:"PHI"}];
 const result=compareRosterWeeks(games,parseRoster("Mine, NYK"),parseRoster("Other, BOS"),"2026-10-20");
 assert.equal(result.mineGames,2);
 assert.equal(result.opponentGames,1);
 assert.equal(result.difference,1);
});
