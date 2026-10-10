import test from "node:test";import assert from "node:assert/strict";import {SLOT_TYPES,assignRoster,canAddToRoster,eligible,rosterForTeam} from "../src/roster.js";import {fresh,addPick} from "../src/model.js";
const p=(name,...positions)=>({player:name,positions});
test("slot layout matches Yahoo",()=>{assert.equal(SLOT_TYPES.h2h.length,12);assert.equal(SLOT_TYPES.roto.length,9);assert.equal(SLOT_TYPES.h2h.filter(x=>x==="C").length,2);});
test("PG cannot fill C, G accepts PG and SG",()=>{assert.equal(eligible(["PG"],"C"),false);assert.equal(eligible(["PG"],"G"),true);assert.equal(eligible(["SF"],"F"),true);});
test("rearranges dual-eligible players to fit roster",()=>{const roster=[p("flex","PG","SG"),p("onlyPG","PG"),p("onlySG","SG")];const assigned=assignRoster(roster,"roto");assert.ok(assigned);assert.equal(assigned.filter(Boolean).length,3);});
test("fails when constrained slots and flex are exhausted",()=>{const guards=Array.from({length:7},(_,i)=>p("guard"+i,"PG"));assert.equal(assignRoster(guards,"roto"),null);assert.equal(canAddToRoster(guards.slice(0,6),guards[6],"roto"),false);});
test("manual unknown picks flagged instead of invented eligibility",()=>{let s=addPick(fresh("roto"),{player:"Unknown",team:1,price:1});const result=rosterForTeam(s,[],1);assert.equal(result.unknown,1);assert.equal(result.known,0);});
