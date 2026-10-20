import test from "node:test";
import assert from "node:assert/strict";
import {parseScheduleCsv,scheduleGrid,weekStart} from "../src/h2h-schedule.js";
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

