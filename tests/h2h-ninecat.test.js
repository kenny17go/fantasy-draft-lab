import test from "node:test";
import assert from "node:assert/strict";
import {parseNineCatCsv,compareNineCat} from "../src/h2h-ninecat.js";
const csv=["name,fgm,fga,ftm,fta,threes,pts,reb,ast,stl,blk,to","Alpha,5,10,3,4,2,15,8,5,1,2,3","Beta,4,10,4,5,1,13,5,6,2,1,1"].join("\n");
const games=[{date:"2026-10-20",home:"NYK",away:"BOS"},{date:"2026-10-22",home:"NYK",away:"PHI"}];
test("9-cat weighted FG% and FT% use total makes/attempts",()=>{
 const p=parseNineCatCsv(csv);
 const r=compareNineCat(games,[{name:"Alpha",team:"NYK"}],[{name:"Beta",team:"BOS"}],"2026-10-20",p);
 assert.equal(r.mine.fgPct,0.5);
 assert.equal(r.mine.totals.pts,30);
 assert.equal(r.categories.find(x=>x.category==="TO").result,"opponent");
 assert.equal(r.complete,true);
});
test("missing projections never silently become zero estimates",()=>{
 const r=compareNineCat(games,[{name:"Unknown",team:"NYK"}],[{name:"Beta",team:"BOS"}],"2026-10-20",parseNineCatCsv(csv));
 assert.equal(r.complete,false);
 assert.deepEqual(r.mine.missing,["Unknown"]);
 assert.ok(r.categories.every(x=>x.result==="N/A"));
});
test("reject impossible shooting inputs",()=>{
 assert.throws(()=>parseNineCatCsv(csv.replace("Alpha,5,10","Alpha,11,10")));
});
