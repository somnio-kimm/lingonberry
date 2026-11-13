import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
import {fixture,explanationFixture} from '../tests/package-fixture.js';
const server=await startServer();let browser;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready');
 const core=fixture().data,pair=explanationFixture(core).data;
 const result=await page.evaluate(async({core,pair})=>{
  const {createPackageStorage}=await import('/js/packages/storage.js'),{createIndexedDatabase}=await import('/js/shared/indexed-database.js');
  const name='lingonberry-package-metadata-browser',failedName=name+'-migration-failure',blockedName=name+'-blocked';
  const seed=(name,close=true)=>new Promise((resolve,reject)=>{
   const request=indexedDB.open(name,2);request.onupgradeneeded=()=>request.result.createObjectStore('versionedPackages',{keyPath:['id','version']});request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('versionedPackages','readwrite');tx.objectStore('versionedPackages').put(core);tx.objectStore('versionedPackages').put(pair);tx.oncomplete=()=>{if(close)db.close();resolve(db);};};
  });
  await seed(name);await seed(failedName);const held=await seed(blockedName,false);
  const put=IDBObjectStore.prototype.put,remove=IDBObjectStore.prototype.delete,read=IDBObjectStore.prototype.getAll,cursor=IDBObjectStore.prototype.openCursor;
  let failMetadata=false,forbidPayloadReads=false,failDelete=false;
  IDBObjectStore.prototype.put=function(...args){if(this.name==='packageMetadata'&&failMetadata)throw new Error('Injected metadata write failure');return put.apply(this,args);};
  IDBObjectStore.prototype.delete=function(...args){if(this.name==='packageMetadata'&&failDelete)throw new Error('Injected metadata delete failure');return remove.apply(this,args);};
  for(const [method,original]of [['getAll',read],['openCursor',cursor]])IDBObjectStore.prototype[method]=function(...args){if(this.name==='versionedPackages'&&forbidPayloadReads)throw new Error('List read a full package payload');return original.apply(this,args);};
  try{
   const storage=createPackageStorage(indexedDB,name),migrated=await storage.list(),preserved=await storage.get(core.id,core.version);
   forbidPayloadReads=true;const indexed=await storage.list();forbidPayloadReads=false;
   const replacement={...core,version:'2.0.0',entries:[...core.entries,{...core.entries[0],id:'extra'}]};
   failMetadata=true;let replaceRejected=false;try{await storage.replaceMany([replacement],[[core.id,core.version]]);}catch{replaceRejected=true;}failMetadata=false;
   const afterFailure={old:await storage.get(core.id,core.version),new:await storage.get(core.id,'2.0.0'),list:await storage.list()};
   await storage.replaceMany([replacement],[[core.id,core.version]]);const afterReplacement=await storage.list();
   failDelete=true;let removeRejected=false;try{await storage.removeMany([[replacement.id,replacement.version]]);}catch{removeRejected=true;}failDelete=false;const afterDeleteFailure=await storage.get(replacement.id,replacement.version);
   await storage.removeMany([[replacement.id,replacement.version]]);const remaining=await storage.list();
   const broken=createPackageStorage(indexedDB,failedName);failMetadata=true;let migrationRejected=false;try{await broken.list();}catch{migrationRejected=true;}failMetadata=false;
   const oldAfterAbort=await new Promise((resolve,reject)=>{const request=indexedDB.open(failedName);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,result={version:db.version,hasIndex:db.objectStoreNames.contains('packageMetadata')},tx=db.transaction('versionedPackages','readonly'),read=tx.objectStore('versionedPackages').get([core.id,core.version]);tx.oncomplete=()=>{result.payload=read.result;db.close();resolve(result);};};});
   const retry=await broken.list();
   const blocked=createPackageStorage(indexedDB,blockedName);let blockedRejected=false;try{await blocked.list();}catch{blockedRejected=true;}held.close();const unblocked=await blocked.list();
   const database=createIndexedDatabase(indexedDB,'lingonberry-transaction-guard',1,db=>db.createObjectStore('test'));let asyncRejected=false;try{await database.runTransaction(['test'],'readwrite',async tx=>{tx.objectStore('test').put('bad','x');});}catch{asyncRejected=true;}const guardValue=await database.runTransaction(['test'],'readonly',tx=>tx.objectStore('test').get('x'));
   return {migrated,preserved,indexed,replaceRejected,afterFailure,afterReplacement,removeRejected,afterDeleteFailure,remaining,migrationRejected,oldAfterAbort,retry,blockedRejected,unblocked,asyncRejected,guardValue};
  }finally{IDBObjectStore.prototype.put=put;IDBObjectStore.prototype.delete=remove;IDBObjectStore.prototype.getAll=read;IDBObjectStore.prototype.openCursor=cursor;held.close();}
 },{core,pair});
 assert.equal(result.migrated.length,2);assert.deepEqual(result.preserved,core);assert.ok(result.migrated.every(row=>row.entryCount===1&&!row.entries));assert.deepEqual(result.indexed,result.migrated);
 assert.equal(result.replaceRejected,true);assert.deepEqual(result.afterFailure.old,core);assert.equal(result.afterFailure.new,undefined);assert.deepEqual(result.afterFailure.list,result.migrated);
 assert.equal(result.afterReplacement.find(row=>row.id===core.id).entryCount,2);assert.equal(result.removeRejected,true);assert.equal(result.afterDeleteFailure.version,'2.0.0');assert.deepEqual(result.remaining.map(row=>row.id),[pair.id]);
 assert.equal(result.migrationRejected,true);assert.equal(result.oldAfterAbort.version,2);assert.equal(result.oldAfterAbort.hasIndex,false);assert.deepEqual(result.oldAfterAbort.payload,core);assert.equal(result.retry.length,2);
 assert.equal(result.blockedRejected,true);assert.equal(result.unblocked.length,2);assert.equal(result.asyncRejected,true);assert.equal(result.guardValue,undefined);assert.deepEqual(errors,[]);
 console.log('Passed metadata-only listing, exact version2 migration, atomic replacement/removal, injected-failure rollback, blocked-upgrade retry and synchronous transaction guard.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
