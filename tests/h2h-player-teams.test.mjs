import assert from "node:assert/strict";
import {parsePlayerTeams,playerKey,fillRosterTeams} from "../src/h2h-player-teams.js";
const known=["Nikola Jokić","Victor Wembanyama","Luka Dončić","Amen Thompson","Ausar Thompson","Jalen Williams","Jaylin Williams","De'Aaron Fox"];
const pasted=`Fantasy Basketball Rankings (2026-27) | Points (Yahoo) | FantasyPros
1
N. Jokic (DEN - C)\t1\t1\t1.0\t0.0
2
V. Wembanyama (SAS - C)
3
L. Doncic (LAL - PG,SG)
21
A. Thompson (HOU - PG,SF,SG)
84
A. Thompson (DET - PF,SF,SG)
37
J. Williams (OKC - PF,SF,SG)
243
J. Williams (OKC - PF,C)
57
D. Fox (SAS - PG,SG)
136
D. Acuff Jr. (FA - G)`;
const parsed=parsePlayerTeams(pasted,known);
assert.equal(parsed.players[playerKey("Nikola Jokić")].team,"DEN");
assert.equal(parsed.players[playerKey("Victor Wembanyama")].team,"SAS");
assert.equal(parsed.players[playerKey("Luka Dončić")].team,"LAL");
assert.equal(parsed.players[playerKey("De'Aaron Fox")].team,"SAS");
assert.equal(parsed.players[playerKey("Amen Thompson")],undefined);
assert.equal(parsed.players[playerKey("Ausar Thompson")],undefined);
assert.equal(parsed.players[playerKey("Jalen Williams")],undefined);
assert.equal(parsed.players[playerKey("Jaylin Williams")],undefined);
assert.ok(parsed.ambiguous.includes("A. Thompson"));
assert.ok(parsed.ambiguous.includes("J. Williams"));
assert.equal(fillRosterTeams("Nikola Jokić",parsed.players),"Nikola Jokić, DEN");
const conflict=parsePlayerTeams("Nikola Jokic,DEN\nNikola Jokic,LAL\nNikola Jokic,DEN",known);
assert.equal(conflict.players[playerKey("Nikola Jokić")],undefined);
console.log("FantasyPros manual import tests passed");
