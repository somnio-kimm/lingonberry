import {createIndexedDatabase} from '../shared/indexed-database.js';
const PAYLOADS='versionedPackages',METADATA='packageMetadata';
function readPackageMetadata(value){
 const {id,version,kind,targetLanguage,explanationLanguage,studyVersion,download}=value;
 return {id,version,kind,targetLanguage,explanationLanguage,studyVersion,download,entryCount:value.entries?.length};
}
/** Full payloads and their lightweight index commit or roll back together. */
export function createPackageStorage(indexedDB=globalThis.indexedDB,name='learn-language.packages.v1'){
 const database=createIndexedDatabase(indexedDB,name,3,(db,tx)=>{
  if(!db.objectStoreNames.contains(PAYLOADS))db.createObjectStore(PAYLOADS,{keyPath:['id','version']});
  if(!db.objectStoreNames.contains(METADATA)){
   const metadataStore=db.createObjectStore(METADATA,{keyPath:['id','version']}),request=tx.objectStore(PAYLOADS).openCursor();
   request.onsuccess=()=>{const cursor=request.result;if(!cursor)return;try{metadataStore.put(readPackageMetadata(cursor.value));cursor.continue();}catch{tx.abort();}};
  }
 });
 const write=action=>database.runTransaction([PAYLOADS,METADATA],'readwrite',action);
 return {
  get:(id,version)=>database.runTransaction([PAYLOADS],'readonly',tx=>tx.objectStore(PAYLOADS).get([id,version])),
  put:data=>write(tx=>{const result=tx.objectStore(PAYLOADS).put(data);tx.objectStore(METADATA).put(readPackageMetadata(data));return result;}),
  replaceMany:(records,keys=[])=>write(tx=>{
   for(const key of keys){tx.objectStore(PAYLOADS).delete(key);tx.objectStore(METADATA).delete(key);}
   for(const data of records){tx.objectStore(PAYLOADS).put(data);tx.objectStore(METADATA).put(readPackageMetadata(data));}
  }),
  list:()=>database.runTransaction([METADATA],'readonly',tx=>tx.objectStore(METADATA).getAll()),
  removeMany:keys=>write(tx=>{for(const key of keys){tx.objectStore(PAYLOADS).delete(key);tx.objectStore(METADATA).delete(key);}}),
 };
}
