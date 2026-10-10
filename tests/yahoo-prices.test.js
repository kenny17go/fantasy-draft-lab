import test from "node:test";import assert from "node:assert/strict";import {parseYahooPrices,mergeYahooPrices} from "../src/yahoo-prices.js";
test("Yahoo auction prices parse with optional injury status and missing average",()=>{
 const text="Fantasy\nBasic\nPhoto of Nikola Jokić\nNikola Jokić\nDEN - C\n1\n100%\n81.6\n61\nPhoto of Yves Missi\nYves Missi\nNOP - C\nQ\n131\n-\n-\n0";
 const rows=parseYahooPrices(text);assert.equal(rows.length,2);assert.deepEqual(rows[0],{player:"Nikola Jokić",avg:81.6,proj:61});assert.deepEqual(rows[1],{player:"Yves Missi",avg:null,proj:0});
});
test("merging duplicate players replaces old price",()=>{const a=[{player:"A",avg:2,proj:4}];assert.deepEqual(mergeYahooPrices(a,[{player:"a",avg:0,proj:0}]),[{player:"a",avg:0,proj:0}]);});
