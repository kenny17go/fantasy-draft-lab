import test from "node:test";
import assert from "node:assert/strict";
import {makeBackup,backupToCsv} from "../src/backup.js";
import {fresh,addPick} from "../src/model.js";
const player={player:'Nikola "Jokić", Jr',positions:["C"],gp:71,pts:27.9,reb:13.1,ast:10.1,stl:1.5,blk:0.8,three:1.7,tov:3.4,fgm:10.3,fga:18.1,ftm:5.4,fta:6.6};
test("full CSV exports both leagues, projection, prices, BOM and escaped names",()=>{
 const h2h=addPick(fresh("h2h"),{player:"Player A",team:1,price:22});
 const roto=addPick(fresh("roto"),{player:"Player B",team:2,price:4});
 const csv=backupToCsv(makeBackup(h2h,roto,[player],[{player:player.player,avg:81.6,proj:61}]));
 assert.ok(csv.startsWith("\uFEFFdataset,mode,team,player,price,"));
 assert.match(csv,/sale,h2h,1,Player A,22/);
 assert.match(csv,/sale,roto,2,Player B,4/);
 assert.match(csv,/projection,,,"Nikola ""Jokić"", Jr"/);
 assert.match(csv,/yahoo_price,,,"Nikola ""Jokić"", Jr"/);
 assert.match(csv,/,81.6,61(?:\r\n|$)/);
});
