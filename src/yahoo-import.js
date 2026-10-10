// Yahoo projected season totals -> Fantasy Draft Lab per-game projection CSV.
// This converter accepts user-provided tabular data; it does not scrape Yahoo.
import {parseProjections, FIELDS} from "./projections.js";
const aliases={player:["player","players","name"],positions:["positions","position","pos"],gp:["gp","gp*","games"],fg:["fgm/a*","fgm/a","fgm/fga"],ft:["ftm/a*","ftm/a","ftm/fta"],three:["3ptm","3pm","3pt","3ptm*"],pts:["pts"],reb:["reb"],ast:["ast"],stl:["st","stl"],blk:["blk"],tov:["to","tov"]};
function splitRow(line,separator){return line.split(separator).map(s=>s.trim());}
function key(s){return s.toLowerCase().replace(/\s+/g,"").replace(/[＊*]/g,"*");}
function pick(header,names){return header.findIndex(h=>names.some(a=>key(a)===key(h)));}
function escapeCsv(s){return '"'+String(s).replace(/"/g,'""')+'"';}
function number(raw,label){const n=Number(String(raw).replace(/,/g,""));if(!Number.isFinite(n)||n<0)throw Error(label+" 數值無效");return n;}
function makesAttempts(value,label){const m=String(value).match(/^\s*([\d,]+(?:\.\d+)?)\s*\/\s*([\d,]+(?:\.\d+)?)/);if(!m)throw Error(label+" 必須為命中/出手，例如 736/1283");return [number(m[1],label),number(m[2],label)];}
export function yahooProjectedToCsv(input){
 const lines=input.replace(/^\uFEFF/,"").trim().split(/\r?\n/).filter(Boolean);
 if(lines.length<3)throw Error("至少需要標題與兩名球員");
 const separator=lines[0].includes("\t")?"\t":",";
 const header=splitRow(lines.shift(),separator);
 const indexes=Object.fromEntries(Object.entries(aliases).map(([field,names])=>[field,pick(header,names)]));
 for(const [field,index] of Object.entries(indexes))if(index<0)throw Error("Yahoo 資料缺少欄位："+field);
 const output=[FIELDS.join(",")];
 for(const line of lines){
  const cells=splitRow(line,separator),get=k=>cells[indexes[k]]??"";
  const name=get("player").trim(),gp=number(get("gp"),name+" GP");
  if(!name||gp<=0||gp>82)throw Error("球員或 GP 無效："+name);
  const positions=get("positions").toUpperCase().replace(/[,; ]+/g,"/");
  const [fgm,fga]=makesAttempts(get("fg"),name+" FGM/A");
  const [ftm,fta]=makesAttempts(get("ft"),name+" FTM/A");
  const totalFields=["pts","reb","ast","stl","blk","three","tov"];
  const totals=Object.fromEntries(totalFields.map(k=>[k,number(get(k),name+" "+k)/gp]));
  output.push([escapeCsv(name),escapeCsv(positions),gp,...["pts","reb","ast","stl","blk","three","tov"].map(k=>totals[k]),fgm/gp,fga/gp,ftm/gp,fta/gp].join(","));
 }
 parseProjections(output.join("\n"));
 return output.join("\n");
}
