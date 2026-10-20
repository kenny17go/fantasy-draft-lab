import test from "node:test";
import assert from "node:assert/strict";
import {parseRoster,parseYahooTable,parsePastedRoster,matchProjectedPlayers,rosterWeek,compareRosterWeeks} from "../src/h2h-roster.js";
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
 const rows=parseYahooTable(["Player\tTeam\tPosition","Jayson Tatum\tBOS\tSF","Stephen Curry\tGSW\tPG"].join("\n"));
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

test("automatic roster format selection",()=>{
 assert.equal(parsePastedRoster("Player One, BOS")[0].team,"BOS");
 assert.equal(parsePastedRoster("Player\tTeam\tPos\nJayson Tatum\tBOS\tSF")[0].team,"BOS");
});

test("Yahoo named columns can appear in any order",()=>{
 const input=["Status\tNBA Team\tPlayer\tPosition","Active\tBOS\tJayson Tatum\tSF","Bench\tGSW\tStephen Curry\tPG"].join("\n");
 assert.deepEqual(parsePastedRoster(input),[{name:"Jayson Tatum",team:"BOS"},{name:"Stephen Curry",team:"GSW"}]);
});
test("Yahoo named team column rejects non-NBA team codes",()=>{
 assert.throws(()=>parsePastedRoster("Player\tNBA Team\tPosition\nSomeone\tXXX\tPG"));
});

test("Yahoo projections match only explicitly mapped NBA teams",()=>{
 const p=new Map([["alpha",{name:"Alpha"}],["beta",{name:"Beta"}]]);
 const result=matchProjectedPlayers(p,[{name:"Alpha",team:"BOS"}]);
 assert.deepEqual(result.matched,[{name:"Alpha",team:"BOS"}]);
 assert.deepEqual(result.missing,["Beta"]);
});

test("conflicting NBA affiliations are flagged, never silently overwritten",()=>{
 const p=new Map([["alpha",{name:"Alpha"}]]);
 const result=matchProjectedPlayers(p,[{name:"Alpha",team:"BOS"},{name:"Alpha",team:"NYK"}]);
 assert.deepEqual(result.matched,[]);
 assert.deepEqual(result.ambiguous,["Alpha"]);
});
