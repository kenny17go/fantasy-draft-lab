import test from "node:test";
import assert from "node:assert/strict";
import {parseRoster,rosterWeek} from "../src/h2h-roster.js";
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
