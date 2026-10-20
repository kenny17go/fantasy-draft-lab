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

test("multiple Yahoo players remain distinct and decimal stats survive",()=>{
 const first=["Nikola Jokić","Nikola JokićPlayer Note","DEN - C","In-and-Out","79.2","1","1","100%","-","808/1,407",".575","422/515",".819","131","2171","1019","787","119","59.6","267"];
 const second=["Victor Wembanyama","Victor WembanyamaPlayer Note","SAS - C","9:30 am vs OKC","tbmaker","79.2","2","2","100%","-","717/1,376",".521","461/562",".821","151","2047","907","269","81.6","268","219"];
 const parsed=parseYahooPage(["Players","Pre-Season",...first,...second,"Previous 25 Next 25"].join("\n"));
 assert.equal(parsed.players.length,2);
 assert.deepEqual(parsed.players.map(p=>p.team),["DEN","SAS"]);
 assert.ok(Math.abs(parsed.players[1].stl-81.6/79.2)<1e-10);
 assert.equal(parsed.failures.length,0);
});
test("incomplete Yahoo row is reported, not filled with next player's stats",()=>{
 const first=["Incomplete","IncompletePlayer Note","DEN - C","owner","79.2","1","1","100%","-","808/1407",".575"];
 const second=["Valid","ValidPlayer Note","SAS - C","owner","79.2","2","2","100%","-","717/1376",".521","461/562",".821","151","2047","907","269","81.6","268","219"];
 const parsed=parseYahooPage(["Pre-Season",...first,...second].join("\n"));
 assert.deepEqual(parsed.players.map(p=>p.name),["Valid"]);
 assert.equal(parsed.failures.length,1);
});
