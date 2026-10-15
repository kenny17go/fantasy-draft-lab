import test from "node:test";
import assert from "node:assert/strict";
import {makeBackup as makeProductionBackup} from "../src/backup.js";
import {makeBackup as makePreviewBackup,readBackup as readPreviewBackup} from "../preview/v5/src/backup.js";
import {fresh} from "../src/model.js";

test("V5 Preview accepts production full JSON backup and preserves both leagues",()=>{
 const prod=makeProductionBackup(fresh("h2h"),fresh("roto"),[],[]);
 const parsed=readPreviewBackup(JSON.stringify(prod));
 assert.equal(parsed.h2h.mode,"h2h");
 assert.equal(parsed.roto.mode,"roto");
 assert.deepEqual(parsed.players,[]);
 assert.deepEqual(parsed.prices,[]);
});

test("V5 Preview also accepts its own full JSON backup",()=>{
 const preview=makePreviewBackup(fresh("h2h"),fresh("roto"),[],[]);
 assert.equal(readPreviewBackup(JSON.stringify(preview)).h2h.mode,"h2h");
});

test("V5 Preview rejects unrelated backup formats",()=>{
 const prod=makeProductionBackup(fresh("h2h"),fresh("roto"),[],[]);
 assert.throws(()=>readPreviewBackup(JSON.stringify({...prod,format:"other-backup"})),/不是支援的完整備份格式/);
});
