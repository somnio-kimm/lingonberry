import {createIndexedDatabase} from './indexed-database.js';
/** Incremental progress persistence; package removal never touches this database. */
export function createLexiconStorage(indexedDB=globalThis.indexedDB,name='learn-language.progress.v2'){
 const database=createIndexedDatabase(indexedDB,name,1,db=>{
  db.createObjectStore('profiles',{keyPath:'language'});
  for(const key of ['statuses','wrongs'])db.createObjectStore(key,{keyPath:['language','id']}).createIndex('language','language');
 });
 const transact=(mode,action)=>database.runTransaction(['profiles','statuses','wrongs'],mode,action);
 return {
  initialise:(language,legacy,{allowImport=true}={})=>transact('readwrite',tx=>{
   const profiles=tx.objectStore('profiles'),request=profiles.get(language);
   request.onsuccess=()=>{
    if(request.result)return;
    if(!allowImport){tx.abort();return;}
    const {wordStatus,wrongs,...base}=legacy;profiles.put({language,state:base});
    for(const [id,value]of Object.entries(wordStatus||{}))tx.objectStore('statuses').put({language,id,value});
    for(const [id,value]of Object.entries(wrongs||{}))tx.objectStore('wrongs').put({language,id,value});
   };
  }),
  load:language=>transact('readonly',tx=>{
   const profile=tx.objectStore('profiles').get(language),statuses=tx.objectStore('statuses').index('language').getAll(language),wrongs=tx.objectStore('wrongs').index('language').getAll(language);
   return()=>{if(!profile.result)throw new Error('Progress is not initialised.');return {...profile.result.state,wordStatus:Object.fromEntries(statuses.result.map(row=>[row.id,row.value])),wrongs:Object.fromEntries(wrongs.result.map(row=>[row.id,row.value]))};};
  }),
  apply:(language,patch)=>transact('readwrite',tx=>{
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
