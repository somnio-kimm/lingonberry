/** Incremental progress persistence; package removal never touches this database. */
export function createLexiconStorage(indexedDB=globalThis.indexedDB,name='learn-language.progress.v2'){
 let connection;
 function open(){
  if(!connection)connection=new Promise((resolve,reject)=>{
   const request=indexedDB.open(name,1);let abandoned=false;
   request.onupgradeneeded=()=>{
    const db=request.result;db.createObjectStore('profiles',{keyPath:'language'});
    for(const key of ['statuses','wrongs'])db.createObjectStore(key,{keyPath:['language','id']}).createIndex('language','language');
   };
   request.onerror=()=>reject(request.error);
   request.onblocked=()=>{abandoned=true;reject(new Error('Close other app windows and retry.'));};
   request.onsuccess=()=>{const db=request.result;if(abandoned){db.close();return;}db.onversionchange=()=>{db.close();connection=undefined;};resolve(db);};
  }).catch(error=>{connection=undefined;throw error;});
  return connection;
 }
 async function transaction(mode,action){
  const db=await open();return new Promise((resolve,reject)=>{
   const tx=db.transaction(['profiles','statuses','wrongs'],mode);let result;
   tx.oncomplete=()=>{try{resolve(typeof result==='function'?result():result?.result);}catch(error){reject(error);}};
   tx.onabort=()=>reject(tx.error||new Error('Progress transaction aborted.'));tx.onerror=()=>reject(tx.error||new Error('Progress storage failed.'));
   try{result=action(tx);}catch(error){tx.abort();reject(error);}
  });
 }
 return {
  initialise:(language,legacy)=>transaction('readwrite',tx=>{
   const profiles=tx.objectStore('profiles'),request=profiles.get(language);
   request.onsuccess=()=>{
    if(request.result)return;
    const {wordStatus,wrongs,...base}=legacy;profiles.put({language,state:base});
    for(const [id,value]of Object.entries(wordStatus||{}))tx.objectStore('statuses').put({language,id,value});
    for(const [id,value]of Object.entries(wrongs||{}))tx.objectStore('wrongs').put({language,id,value});
   };
  }),
  load:language=>transaction('readonly',tx=>{
   const profile=tx.objectStore('profiles').get(language),statuses=tx.objectStore('statuses').index('language').getAll(language),wrongs=tx.objectStore('wrongs').index('language').getAll(language);
   return()=>{if(!profile.result)throw new Error('Progress is not initialised.');return {...profile.result.state,wordStatus:Object.fromEntries(statuses.result.map(row=>[row.id,row.value])),wrongs:Object.fromEntries(wrongs.result.map(row=>[row.id,row.value]))};};
  }),
  apply:(language,patch)=>transaction('readwrite',tx=>{
   const write=()=>{
    if(patch.base)tx.objectStore('profiles').put({language,state:patch.base.value});
    for(const key of ['statuses','wrongs'])for(const [id,change]of Object.entries(patch[key]||{})){
     const store=tx.objectStore(key);if(change.value===null)store.delete([language,id]);else store.put({language,id,value:change.value});
    }
   };
   if(!patch.resetRevision){write();return;}
   let remaining=2;
   for(const key of ['statuses','wrongs']){
    const store=tx.objectStore(key),request=store.index('language').getAllKeys(language);
    request.onsuccess=()=>{for(const id of request.result)store.delete(id);if(!--remaining)write();};
   }
  }),
 };
}
