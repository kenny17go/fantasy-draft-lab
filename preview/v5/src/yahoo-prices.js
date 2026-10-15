// Yahoo Fantasy Basic Auction copied text; user-provided only.
const position=/^[A-Z]{2,3} - (?:PG|SG|SF|PF|C)(?:,(?:PG|SG|SF|PF|C))*$/;
const integer=/^\d+$/;
const pct=/^\d+(?:\.\d+)?%$/;
const avg=/^(?:-|\d+(?:\.\d+)?)$/;
export function parseYahooPrices(source){
 const lines=String(source).split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 const result=[],errors=[];
 for(let i=0;i<lines.length;i++){
  if(!position.test(lines[i]))continue;
  const name=lines[i-1];if(!name||name.startsWith("Photo of "))continue;
  let j=i+1;
  if(["Q","O","DTD","INJ"].includes(lines[j]))j++;
  if(!integer.test(lines[j]||"")){errors.push(name+"：缺少 Rank");continue;}j++;
  if(!pct.test(lines[j]||"")&&lines[j]!=="-"){errors.push(name+"：缺少 %Drafted");continue;}j++;
  if(!avg.test(lines[j]||"")||!avg.test(lines[j+1]||"")){errors.push(name+"：價格不完整");continue;}
  const value=x=>x==="-"?null:Number(x);
  result.push({player:name,avg:value(lines[j]),proj:value(lines[j+1])});i=j+1;
 }
 if(errors.length)throw Error(errors.slice(0,3).join("；"));
 if(!result.length)throw Error("未找到 Yahoo 價格資料；請複製含姓名、球隊位置、Rank、%Drafted、Avg $、Proj $ 的清單");
 return result;
}
export function mergeYahooPrices(oldPrices,newPrices){
 const m=new Map(oldPrices.map(p=>[p.player.trim().toLocaleLowerCase(),p]));
 for(const p of newPrices)m.set(p.player.trim().toLocaleLowerCase(),p);
 return [...m.values()];
}
