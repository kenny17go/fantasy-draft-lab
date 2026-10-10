// Parse Yahoo iPhone copied, line-per-cell projected season totals.
// User-provided text only; no network or Yahoo credentials.
import {yahooProjectedToCsv} from "./yahoo-import.js";
import {parseProjections} from "./projections.js";
const ignored=/^(?:Filters|Rankings|Rosters|Time|Field Goals|Free Throws|3PT|Miscellaneous|Players|Roster Status|Pre-Season|Current|% Ros|MPG|FG%|FT%|Previous \d+ Next \d+|Add Player|Drop Player|Trade|On Watch List|Not Watching|Opp:.*|GP\*|FGM\/A\*|FTM\/A\*|3PTM|PTS|REB|AST|ST|BLK|TO)$/i;
const number=/^\d[\d,]*(?:\.\d+)?$/;
const ratio=/^\d[\d,]*\/\d[\d,]*$/;
const position=/^([A-Z]{2,3}) - (PG|SG|SF|PF|C)(?:,(?:PG|SG|SF|PF|C))*$/;
function clean(s){return s.replace(/[\uE000-\uF8FF]/g,"").trim();}
function normalizeName(s){return s.replace(/(?:Q|O|DTD|INJ)?(?:New Player Note|Player Note|No new player Notes?).*$/i,"").trim();}
export function parseYahooMobileText(text){
 const lines=String(text).split(/\r?\n/).map(clean).filter(Boolean);
 const records=[],errors=[];
 for(let i=0;i<lines.length;i++){
  const match=lines[i].match(position);if(!match)continue;
  const name=normalizeName(lines[i-1]||"");
  if(!name||ignored.test(name)||!/[A-Za-zÀ-ÿ\u00C0-\u024F]/.test(name)){errors.push("位置行前找不到球員姓名："+lines[i]);continue;}
  // Yahoo copied rows: position, opponent, GP, pre-season rank, current rank,
  // roster %, MPG, FGM/A, FG%, FTM/A, FT%, 3PM, PTS, REB, AST, ST, BLK, TO.
  const ahead=lines.slice(i+1,i+21);
  const fgAt=ahead.findIndex(x=>ratio.test(x));
  if(fgAt<0||fgAt<3){errors.push(name+"：找不到投籃預測");continue;}
  const gp=Number((ahead[fgAt-5]||"").replace(/,/g,""));
  // Offset relative to FGM/A: GP -5, preseason -4, current -3, roster% -2, MPG -1.
  if(!Number.isInteger(gp)||gp<1||gp>82){errors.push(name+"：GP 無法辨識");continue;}
  const stats=ahead.slice(fgAt,fgAt+11);
  if(stats.length!==11||!ratio.test(stats[0])||!ratio.test(stats[2])||!stats[1].startsWith(".")||!stats[3].startsWith(".")||!stats.slice(4).every(x=>number.test(x))){errors.push(name+"：九項預測欄位不完整");continue;}
  records.push({name,positions:lines[i].split(" - ")[1],gp,fg:stats[0],ft:stats[2],three:stats[4],pts:stats[5],reb:stats[6],ast:stats[7],stl:stats[8],blk:stats[9],tov:stats[10]});
  i+=fgAt+10;
 }
 if(errors.length)throw Error(errors.slice(0,3).join("；"));
 if(!records.length)throw Error("未找到 Yahoo 逐行球員資料，請確認複製範圍包含球員、位置、GP 與完整預測");
 const header="Players\tPosition\tGP*\tFGM/A*\tFTM/A*\t3PTM\tPTS\tREB\tAST\tST\tBLK\tTO";
 const rows=records.map(r=>[r.name,r.positions,r.gp,r.fg,r.ft,r.three,r.pts,r.reb,r.ast,r.stl,r.blk,r.tov].join("\t"));
 return parseProjections(yahooProjectedToCsv([header,...rows].join("\n")));
}
export function mergeProjectionPlayers(existing,incoming){
 const result=new Map(existing.map(p=>[p.player.trim().toLocaleLowerCase(),p]));
 for(const p of incoming)result.set(p.player.trim().toLocaleLowerCase(),p);
 return [...result.values()];
}
