import test from "node:test";
import assert from "node:assert/strict";
import {parseYahooMobileText,mergeProjectionPlayers} from "../src/yahoo-mobile.js";
const rows=`Filters
Players
Nikola Jokić
Nikola JokićPlayer Note
DEN - C
W (Oct 10)
71
1
1
100%
-
736/1,283
.574
386/471
.820
120
1978
927
717
108
54
242
Luka Dončić
Luka DončićNew Player Note
LAL - PG,SG
W (Oct 10)
66
3
5
100%
-
675/1,431
.472
506/647
.782
248
2104
509
539
105
32
249
Previous 25 Next 25`;
test("iPhone Yahoo copy parses GP, attempts, Unicode names and positions",()=>{
 const p=parseYahooMobileText(rows);
 assert.equal(p.length,2);
 assert.equal(p[0].player,"Nikola Jokić");
 assert.equal(p[0].gp,71);
 assert.ok(Math.abs(p[0].fgm*71-736)<1e-8);
 assert.ok(Math.abs(p[0].fta*71-471)<1e-8);
 assert.deepEqual(p[1].positions,["PG","SG"]);
 assert.equal(p[1].three,248/66);
});
test("Yahoo batches update same player and preserve others",()=>{
 const a=parseYahooMobileText(rows);
 const b=mergeProjectionPlayers(a,[{...a[0],gp:70}]);
 assert.equal(b.length,2);assert.equal(b[0].gp,70);
});
test("incomplete mobile projection fails closed",()=>{
 assert.throws(()=>parseYahooMobileText(rows.replace("736/1,283","missing")),/找不到投籃預測|不完整/);
});
