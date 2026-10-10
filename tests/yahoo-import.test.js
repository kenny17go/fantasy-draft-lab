import test from "node:test";import assert from "node:assert/strict";import {yahooProjectedToCsv} from "../src/yahoo-import.js";import {parseProjections} from "../src/projections.js";
const data="Players\tPosition\tGP*\tFGM/A*\tFTM/A*\t3PTM\tPTS\tREB\tAST\tST\tBLK\tTO\nNikola Jokic\tC\t71\t736/1283\t386/471\t130\t2100\t900\t700\t100\t55\t240\nLuka Doncic\tPG,SG\t66\t675/1431\t506/647\t240\t2000\t550\t550\t85\t30\t220";
test("Yahoo season totals convert to per-game stats and preserve attempts",()=>{const players=parseProjections(yahooProjectedToCsv(data));assert.equal(players.length,2);assert.equal(players[0].gp,71);assert.ok(Math.abs(players[0].fgm*71-736)<1e-8);assert.ok(Math.abs(players[1].fta*66-647)<1e-8);assert.deepEqual(players[1].positions,["PG","SG"]);});
test("Yahoo import rejects incomplete data",()=>{assert.throws(()=>yahooProjectedToCsv(data.replace("3PTM\t","")),/缺少欄位|欄數|無效/);});

test("rejects truncated Yahoo rows",()=>{assert.throws(()=>yahooProjectedToCsv(data.replace("100\\t55\\t240","100\\t55")),/欄數不符/);});
