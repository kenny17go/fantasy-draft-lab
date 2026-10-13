import test from "node:test";
import assert from "node:assert/strict";
import {adjustedH2HPrices,auditH2HPriceSupply,H2H_PRICE_SCALE} from "../src/h2h-price-calibration.js";

test("H2H calibration preserves original Yahoo Avg and Proj",()=>{
 const original=[{player:"A",avg:30,proj:32},{player:"B",avg:0,proj:0}];
 const snapshot=structuredClone(original);
 const adjusted=adjustedH2HPrices(original);
 assert.deepEqual(original,snapshot);
 assert.equal(H2H_PRICE_SCALE,13/12);
 assert.equal(adjusted[0].adjustedAvg,30*13/12);
 assert.equal(adjusted[0].adjustedProj,32*13/12);
 assert.equal(adjusted[0].opening,35);
 assert.equal(adjusted[0].cap,41);
 assert.equal(adjusted[1].opening,1);
 assert.equal(adjusted[1].cap,1);
 assert.equal(adjustedH2HPrices([{player:"C",avg:4,proj:4}])[0].opening,1);
});
test("H2H audit detects insufficient budget supply without changing auction",()=>{
 const prices=Array.from({length:210},(_,i)=>({player:"P"+i,avg:1,proj:1}));
 const report=auditH2HPriceSupply(prices);
 assert.equal(report.required,168);
 assert.equal(report.totalBudget,2800);
 assert.equal(report.enoughPlayers,true);
 assert.equal(report.budgetReachableByCap,false);
 assert.equal(report.minimumOpeningsAffordable,true);
 assert.equal(report.incompatibleFloorCap,0);
});
test("H2H low-price players retain a legal $1 opening even after rounding",()=>{
 const prices=Array.from({length:210},(_,i)=>({player:"P"+i,avg:1.05,proj:1.05}));
 const report=auditH2HPriceSupply(prices);
 assert.equal(report.incompatibleFloorCap,0);
 assert.equal(adjustedH2HPrices(prices)[0].opening,1);
});
