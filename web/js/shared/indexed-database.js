/** Shared connection and transaction lifecycle; callers own schemas and data policies. */
export function createIndexedDatabase(indexedDB,name,version,upgrade){
 let connection;
 function open(){
  if(!connection)connection=new Promise((resolve,reject)=>{
   const request=indexedDB.open(name,version);let abandoned=false,upgradeError;
   request.onupgradeneeded=event=>{
    if(abandoned){request.transaction.abort();return;}
    try{upgrade(request.result,request.transaction,event.oldVersion);}catch(error){upgradeError=error;request.transaction.abort();}
   };
   request.onerror=()=>reject(upgradeError||request.error);
   request.onblocked=()=>{abandoned=true;reject(new Error('Close other app windows and retry.'));};
   request.onsuccess=()=>{const db=request.result;if(abandoned){db.close();return;}db.onversionchange=()=>{db.close();connection=undefined;};resolve(db);};
  }).catch(error=>{connection=undefined;throw error;});
  return connection;
 }
 async function runTransaction(stores,mode,action){
  const db=await open();return new Promise((resolve,reject)=>{
   const tx=db.transaction(stores,mode);let result;
   tx.oncomplete=()=>{try{resolve(typeof result==='function'?result():result?.result);}catch(error){reject(error);}};
   tx.onabort=()=>reject(tx.error||new Error('Database transaction aborted.'));tx.onerror=()=>reject(tx.error||new Error('Database storage failed.'));
   try{result=action(tx);if(result&&typeof result.then==='function'){void Promise.resolve(result).catch(()=>{});throw new Error('Database actions must enqueue requests synchronously.');}}
   catch(error){try{tx.abort();}catch{}reject(error);}
  });
 }
 return {open,runTransaction};
}
