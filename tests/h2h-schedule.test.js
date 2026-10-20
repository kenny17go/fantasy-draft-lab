import test from "node:test";
import assert from "node:assert/strict";
import {parseScheduleCsv,scheduleGrid,weekStart,parseEspnSchedule,fetchEspnWeek} from "../src/h2h-schedule.js";
test("CSV imports games and avoids duplicate rows",()=>{
 const games=parseScheduleCsv("date,home,away\n2026-10-20,NYK,PHI\n2026-10-20,NYK,PHI\n2026-10-21,BOS,NYK");
 assert.equal(games.length,2);
 const grid=scheduleGrid(games,"2026-10-20");
 assert.equal(grid.rows.find(x=>x.team==="NYK").count,2);
 assert.equal(grid.rows.find(x=>x.team==="PHI").days[1][0],"@NYK");
 assert.equal(grid.totalByDay[1],1);
});
test("week starts Monday and rejects invalid teams",()=>{
 assert.equal(weekStart("2026-10-25"),"2026-10-19");
 assert.throws(()=>parseScheduleCsv("date,home,away\n2026-10-20,ABC,PHI"));
});

test("ESPN regular-season events map to US Eastern game dates",async()=>{
 const payload={events:[{id:"1",date:"2026-10-21T00:00:00Z",season:{type:2},competitions:[{competitors:[{homeAway:"home",team:{abbreviation:"NY"}},{homeAway:"away",team:{abbreviation:"PHI"}}]}]},{id:"2",date:"2026-10-21T00:00:00Z",season:{type:1},competitions:[{competitors:[{homeAway:"home",team:{abbreviation:"NYK"}},{homeAway:"away",team:{abbreviation:"PHI"}}]}]}]};
 assert.deepEqual(parseEspnSchedule(payload),[{date:"2026-10-20",home:"NYK",away:"PHI"}]);
 const games=await fetchEspnWeek("2026-10-20",async url=>{assert.match(url,/20261019-20261025/);return {ok:true,json:async()=>payload};});
 assert.equal(games.length,1);
});
