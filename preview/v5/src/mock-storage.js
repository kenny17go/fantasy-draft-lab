const DB="fantasy-draft-lab-v5-preview-mock-v1",STORE="archives";
function openDB(){
 return new Promise((resolve,reject)=>{
  if(!globalThis.indexedDB){reject(Error("此瀏覽器不支援 IndexedDB"));return;}
  const request=indexedDB.open(DB,1);
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE);};
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||Error("資料庫無法開啟"));
 });
}
async function transact(mode,key,value){
 const db=await openDB();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE);
  const request=mode==="readonly"?store.get(key):value===null?store.delete(key):store.put(value,key);
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||Error("紀錄存取失敗"));
  tx.onerror=()=>reject(tx.error||Error("紀錄交易失敗"));
 });}finally{db.close();}
}
export const readMockArchive=key=>transact("readonly",key);
export const writeMockArchive=(key,data)=>transact("readwrite",key,data);
export const deleteMockArchive=key=>transact("readwrite",key,null);
