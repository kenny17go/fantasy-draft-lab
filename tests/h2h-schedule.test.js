import test from "node:test";
import assert from "node:assert/strict";
import {parseScheduleCsv,scheduleGrid,weekStart,seasonGrid,backToBacks} from "../src/h2h-schedule.js";
const sample=["date,home,away","2026-10-20,NYK,PHI","2026-10-21,BOS,NYK"].join("\n");
test("CSV imports games",()=>{
 const games=parseScheduleCsv(sample);
 assert.equal(games.length,2);
 const grid=scheduleGrid(games,"2026-10-20");
 assert.equal(grid.rows.find(x=>x.team==="NYK").count,2);
 assert.equal(grid.rows.find(x=>x.team==="PHI").days[1][0],"@NYK");
 assert.equal(grid.totalByDay[1],1);
 assert.equal(seasonGrid(games).rows.find(x=>x.team==="NYK").total,2);
 assert.equal(backToBacks(games,"NYK"),1);
});
test("week starts Monday and rejects invalid teams",()=>{
 assert.equal(weekStart("2026-10-25"),"2026-10-19");
 assert.throws(()=>parseScheduleCsv(["date,home,away","2026-10-20,ABC,PHI"].join("\n")));
});
test("invalid dates and duplicate games are rejected",()=>{
 assert.throws(()=>parseScheduleCsv(["date,home,away","2027-02-30,NYK,PHI"].join("\n")));
 assert.throws(()=>parseScheduleCsv(["date,home,away","2026-10-20,NYK,PHI","2026-10-20,NYK,PHI"].join("\n")));
});
