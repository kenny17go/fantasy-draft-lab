import test from "node:test";
import assert from "node:assert/strict";
import {parseYahooPage} from "../src/h2h-yahoo-page.js";
test("Yahoo copied preseason page parses NBA team and season totals",()=>{
 const input=["Players","Pre-Season","Nikola Jokić","Nikola JokićPlayer Note","DEN - C","In-and-Out","79.2","1","1","100%","-","808/1,407",".575","422/515",".819","131","2171","1019","787","119","59.6","267"].join("\n");
 const result=parseYahooPage(input);
 assert.equal(result.players.length,1);
 assert.equal(result.players[0].team,"DEN");
 assert.equal(result.players[0].gp,79.2);
 assert.ok(Math.abs(result.players[0].pts-2171/79.2)<1e-10);
 assert.ok(Math.abs(result.players[0].blk-59.6/79.2)<1e-10);
});
