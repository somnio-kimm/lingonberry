const empty=sequence=>({version:1,sequence,resetRevision:0,base:null,statuses:{},wrongs:{}});
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const hasChanges=patch=>patch.resetRevision||patch.base||Object.keys(patch.statuses).length||Object.keys(patch.wrongs).length;

/** A small synchronous intent journal protects asynchronous incremental commits. */
export function createProgressJournal({storage,key,language,backend}){
 const journalKey=key+'.pending';let pending=empty(0),loaded=false,loading,flushing,storageWarning=false,backendWarning=false;
 function readJournal(){
  const raw=storage.getItem(journalKey);if(!raw)return;
  const value=JSON.parse(raw);
  const validChange=change=>object(change)&&Number.isSafeInteger(change.revision)&&change.revision>0&&change.revision<=value.sequence&&Object.hasOwn(change,'value');
  const valid=value?.version===1&&Number.isSafeInteger(value.sequence)&&value.sequence>=0&&Number.isSafeInteger(value.resetRevision)&&value.resetRevision>=0&&value.resetRevision<=value.sequence&&object(value.statuses)&&object(value.wrongs)&&
   (value.base===null||validChange(value.base)&&value.base.value?.version===1&&object(value.base.value.preferences)&&object(value.base.value.contentMigrations))&&(!value.resetRevision||value.base)&&
   Object.values(value.statuses).every(change=>validChange(change)&&(change.value===null||['new','learning','mastered'].includes(change.value)))&&
   Object.values(value.wrongs).every(change=>validChange(change)&&(change.value===null||object(change.value)&&object(change.value.question)&&object(change.value.question.word)&&Number.isSafeInteger(change.value.count)&&change.value.count>=0));
  if(!valid)throw new Error('Saved progress recovery data is invalid.');
  pending=value;
 }
 function checkpoint(value){try{storage.setItem(journalKey,JSON.stringify(value));storageWarning=false;}catch{storageWarning=true;}}
 function marker(preferences){try{storage.setItem(key,JSON.stringify({version:2,storage:'indexeddb',preferences}));}catch{storageWarning=true;}}
 async function load(legacy,{allowImport=true}={}){
  if(loaded)return backend.load(language);
  if(!loading)loading=(async()=>{
   readJournal();await backend.initialise(language,legacy,{allowImport});
   if(hasChanges(pending))await backend.apply(language,pending);
   const state=await backend.load(language);if(state?.version!==1||!object(state.preferences)||!object(state.wordStatus)||!object(state.wrongs))throw new Error('Saved progress format is not supported.');loaded=true;backendWarning=false;
   pending=empty(pending.sequence);checkpoint(pending);marker(state.preferences);return state;
  })().catch(error=>{backendWarning=true;loading=undefined;throw error;});
  return loading;
 }
 function stage({reset=false,base,statuses={},wrongs={}}){
  if(!loaded)throw new Error('Study progress is still loading.');
  const revision=pending.sequence+1,next=reset?empty(revision):{...pending,statuses:{...pending.statuses},wrongs:{...pending.wrongs}};next.sequence=revision;
  if(reset)next.resetRevision=revision;
  if(base)next.base={revision,value:base};
  for(const [id,value]of Object.entries(statuses))next.statuses[id]={revision,value};
  for(const [id,value]of Object.entries(wrongs))next.wrongs[id]={revision,value};
  try{const raw=JSON.stringify(next);storage.setItem(journalKey,raw);pending=JSON.parse(raw);storageWarning=false;}
  catch{storageWarning=true;return false;}
  if(base)marker(base.preferences);void flush();return true;
 }
 function flush(){
  if(!loaded)return Promise.resolve(false);
  if(!flushing)flushing=Promise.resolve().then(async()=>{
   while(hasChanges(pending)){
    const batch=pending;await backend.apply(language,batch);backendWarning=false;
    const remaining=empty(pending.sequence);
    if(pending.resetRevision!==batch.resetRevision)remaining.resetRevision=pending.resetRevision;
    if(pending.base?.revision!==batch.base?.revision)remaining.base=pending.base;
    for(const key of ['statuses','wrongs'])for(const [id,change]of Object.entries(pending[key]))if(change.revision!==batch[key][id]?.revision)remaining[key][id]=change;
    pending=remaining;checkpoint(pending);
   }
   return true;
  }).catch(()=>{backendWarning=true;return false;}).finally(()=>{flushing=undefined;});
  return flushing;
 }
 return {load,stage,flush,get warning(){return storageWarning||backendWarning;}};
}
