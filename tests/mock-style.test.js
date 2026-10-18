import test from "node:test";
import assert from "node:assert/strict";
import {classifyMockTeams} from "../src/mock-style.js";
const cats=["fgPct","ftPct","three","pts","reb","ast","stl","blk","tov"];
const team=(n,stats)=>({team:n,stats:Object.fromEntries(cats.map(k=>[k,stats[k]??10]))});
test("small ball, big ball and balanced labels are based on nine category ranks",()=>{
 const teams=Array.from({length:14},(_,i)=>team(i+1,{fgPct:.45+i*.005,ftPct:.7+i*.01,three:5+i,ast:10+i,reb:100-i*4,blk:20-i,pts:100+i,stl:20+i,tov:30+i}));
 const result=classifyMockTeams(teams);
 assert.equal(result.get(14).style,"小球型");
 assert.equal(result.get(1).style,"大球型");
});
test("uniform categories remain balanced",()=>{
 const teams=Array.from({length:14},(_,i)=>team(i+1,{}));
 assert.ok([...classifyMockTeams(teams).values()].every(x=>x.style==="平衡型"));
});

test("Top 5 UI replaces Z-score with roster style without changing ranking",async()=>{
 const {readFileSync}=await import("node:fs");
 const app=readFileSync(new URL("../src/app.js",import.meta.url),"utf8");
 assert.match(app,/const style=mode==="h2h"&&run\?classifyMockTeams\(run\.teams\)\.get\(t\.team\)\?\.style:null/);
 assert.match(app,/button\.textContent="Top "/);
 assert.doesNotMatch(app,/button\.textContent=[^;]*九項 Z/);
 assert.match(app,/renderRun\(t\.run-1\)/);
});
