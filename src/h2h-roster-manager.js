const KEY="fantasy-draft-lab:h2h:roster-manager:v1";
const $=id=>document.getElementById(id);
let data=null;
try{const saved=JSON.parse(localStorage.getItem(KEY)||"null");if(saved?.format==="fantasy-draft-lab-h2h-draft-results"&&Array.isArray(saved.teams))data=saved;}catch{}
function validate(raw){
 if(!raw||raw.format!=="fantasy-draft-lab-h2h-draft-results"||!Array.isArray(raw.teams)||raw.teams.length!==14)throw Error("不是預期的 14 隊 Yahoo 名單 JSON");
 const names=new Set(),players=new Set();
 for(const t of raw.teams){
  if(typeof t.team!=="string"||!t.team.trim()||names.has(t.team)||!Array.isArray(t.players))throw Error("隊伍格式或名稱重複");
  names.add(t.team);
  for(const p of t.players){if(typeof p.player!=="string"||!p.player.trim()||players.has(p.player))throw Error("球員名稱缺漏或重複："+p.player);players.add(p.player);}
 }
 return players.size;
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(data));}catch(e){$("status").textContent="儲存失敗："+e.message;}}
function render(){
 $("team").replaceChildren();$("players").replaceChildren();$("export").disabled=!data;
 if(!data)return;
 for(const t of data.teams){const o=document.createElement("option");o.value=t.team;o.textContent=t.team;$("team").append(o);}
 const previous=render.selected;if(previous&&data.teams.some(t=>t.team===previous))$("team").value=previous;
 draw();
}
function draw(){
 if(!data)return;
 const team=data.teams.find(t=>t.team===$("team").value);if(!team)return;
 render.selected=team.team;$("players").replaceChildren();
 const il=team.players.filter(p=>p.rosterSlot==="IL").length;
 $("count").textContent=team.team+"：共 "+team.players.length+" 人，ACTIVE "+(team.players.length-il)+" 人／IL "+il+" 人（可自行調整）";
 for(const p of team.players){
  const div=document.createElement("div");div.className="player";
  const cb=document.createElement("input");cb.type="checkbox";cb.checked=p.rosterSlot==="IL";cb.id="il-"+p.rank;
  const label=document.createElement("label");label.htmlFor=cb.id;label.textContent=p.player+"（#"+p.rank+"）";
  const mark=document.createElement("span");mark.textContent=cb.checked?"IL":"ACTIVE";
  cb.addEventListener("change",()=>{p.rosterSlot=cb.checked?"IL":"ACTIVE";save();draw();});
  div.append(cb,label,mark);$("players").append(div);
 }
}
$("file").addEventListener("change",async e=>{
 const f=e.target.files[0];if(!f)return;
 try{
  const parsed=JSON.parse(await f.text());const count=validate(parsed);
  if(data&&!confirm("匯入會取代本頁已保存的名單與 IL 標記，是否繼續？"))return;
  data=parsed;for(const t of data.teams)for(const p of t.players)p.rosterSlot=p.rosterSlot==="IL"?"IL":"ACTIVE";
  render.selected=data.teams[0].team;save();render();
  $("status").textContent="已匯入 "+count+" 位球員／14 隊；可人工勾選 IL。";
 }catch(err){$("status").textContent="匯入失敗："+err.message;}
 e.target.value="";
});
$("team").addEventListener("change",draw);
$("export").addEventListener("click",()=>{
 if(!data)return;
 const blob=new Blob([JSON.stringify({...data,ilEditedAt:new Date().toISOString()},null,2)],{type:"application/json"});
 const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="h2h-2026-27-rosters-with-il.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$("clear").addEventListener("click",()=>{if(!confirm("清除本頁保存的名單與 IL 標記？不影響其他選秀資料。"))return;data=null;localStorage.removeItem(KEY);render();$("count").textContent="";$("status").textContent="本頁名單已清除";});
if(data){try{validate(data);render();$("status").textContent="已讀取本機保存的 14 隊名單";}catch{data=null;localStorage.removeItem(KEY);}}
