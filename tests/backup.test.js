import test from "node:test";import assert from "node:assert/strict";
import {makeBackup,readBackup,validatePrices} from "../src/backup.js";
import {fresh} from "../src/model.js";
const player={player:"Nikola Jokić",positions:["C"],gp:71,pts:27.9,reb:13.1,ast:10.1,stl:1.5,blk:.8,three:1.7,tov:3.4,fgm:10.3,fga:18.1,ftm:5.4,fta:6.6};
test("complete backup roundtrip includes both leagues and projections",()=>{const b=makeBackup(fresh("h2h"),fresh("roto"),[player],[{player:player.player,avg:81.6,proj:61}]);const restored=readBackup(JSON.stringify(b));assert.equal(restored.players[0].player,player.player);assert.equal(restored.prices[0].avg,81.6);assert.equal(restored.h2h.mode,"h2h");assert.equal(restored.roto.mode,"roto");});
test("missing Yahoo average remains null and zero remains zero",()=>{assert.deepEqual(validatePrices([{player:"A",avg:null,proj:0}]),[{player:"A",avg:null,proj:0}]);});
test("reject incompatible backups without touching local storage",()=>{assert.throws(()=>readBackup('{"format":"fantasy-draft-lab-backup","version":999}'));});
