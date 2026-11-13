import {advanceMistakeBalance} from './mistake-balance.js';
import {snapshotQuestion} from './question-snapshot.js';
import {createProgressJournal} from './progress-journal.js';
import {migrateEquivalentWordStatuses} from './word-status-migration.js';
/** Small language-neutral progress store for the additional vocabulary presentations. */
export function createLexiconStore(storage,profile,{progressStorage}={}){
 const key=`learn-language.${profile.id}.lexicon.v1`;
 let saved,rawLegacy,legacyReadFailed=false;try{rawLegacy=storage.getItem(key);if(rawLegacy!=null&&rawLegacy!=='')saved=JSON.parse(rawLegacy);}catch{legacyReadFailed=true;}
 const fresh=()=>({version:1,wordStatus:{},wrongs:{},contentMigrations:{},preferences:{theme:'system',uiLanguage:'en',studyLevel:profile.levels[0],hapticEnabled:false,autoRemoveResolvedWrongs:false,clozeShowTranslation:false,scrambleShowTranslation:true,clozeShowReading:true,scrambleShowReading:true}});
 const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
 function restore(value){
  const next=value?.version===1&&object(value.wordStatus)&&object(value.wrongs)&&object(value.preferences)?{...fresh(),...value,preferences:{...fresh().preferences,...value.preferences}}:fresh();
  if(!object(next.contentMigrations))next.contentMigrations={};
  if(profile.normaliseLevel)next.preferences.studyLevel=profile.normaliseLevel(next.preferences.studyLevel);
  if(!profile.levels.includes(next.preferences.studyLevel))next.preferences.studyLevel=profile.levels[0];
  return next;
 }
 const validSaved=saved?.version===1&&object(saved.wordStatus)&&object(saved.wrongs)&&object(saved.preferences),previousLevel=validSaved?{...fresh().preferences,...saved.preferences}.studyLevel:profile.levels[0];
 const allowImport=!!(!legacyReadFailed&&(rawLegacy==null||rawLegacy===''||saved===null||validSaved));
 let state=restore(saved),warning=false,hydrated=!progressStorage,loading;
 const journal=progressStorage?createProgressJournal({storage,key,language:profile.id,backend:progressStorage}):null;
 const base=()=>{const {wordStatus,wrongs,...value}=state;return value;};
 const save=()=>{try{storage.setItem(key,JSON.stringify(state));warning=false;return true;}catch{warning=true;return false;}};
 const persist=patch=>journal?journal.stage(patch):save();
 const requireReady=()=>{if(!hydrated)throw new Error('Study progress is still loading.');};
 function ready(){
  if(hydrated)return Promise.resolve();
  if(!loading)loading=journal.load(state,{allowImport}).then(value=>{const previous=value.preferences?.studyLevel;state=restore(value);hydrated=true;if(previous!==state.preferences.studyLevel)persist({base:base()});}).catch(error=>{loading=undefined;throw error;});
  return loading;
 }
 if(!journal&&previousLevel!==state.preferences.studyLevel)save();
 return {
  get state(){return state;},get warning(){return warning||journal?.warning||false;},ready,flush:()=>journal?ready().then(()=>journal.flush()):Promise.resolve(!warning),
  preference(name,value){
   requireReady();
   const allowed={theme:['system','light','dark'],uiLanguage:['en','ko'],studyLevel:profile.levels,hapticEnabled:[true,false],autoRemoveResolvedWrongs:[true,false],clozeShowTranslation:[true,false],scrambleShowTranslation:[true,false],clozeShowReading:[true,false],scrambleShowReading:[true,false]};
   if(!allowed[name]?.includes(value))throw new Error('Invalid preference');
   state.preferences[name]=value;
   const removed={};if(name==='autoRemoveResolvedWrongs'&&value)for(const [id,row]of Object.entries(state.wrongs))if(row.count===0){delete state.wrongs[id];removed[id]=null;}
   persist({base:base(),wrongs:removed});
  },
  wordStatus(id){return state.wordStatus[id]||'new';},
  setWordStatus(id,status){requireReady();if(!id||!['new','learning','mastered'].includes(status))throw new Error('Invalid word status');state.wordStatus[id]=status;persist({statuses:{[id]:status}});},
  migrateEquivalentEntries(rows=[]){
   requireReady();const before={...state.wordStatus};
   if(migrateEquivalentWordStatuses(state,rows)){const ids=new Set([...Object.keys(before),...Object.keys(state.wordStatus)]),statuses=Object.fromEntries([...ids].filter(id=>before[id]!==state.wordStatus[id]).map(id=>[id,state.wordStatus[id]??null]));persist({base:base(),statuses});}
  },
  record(question,input,correct,retest=false){
   requireReady();const id=[question.mode,question.id,question.locale,...(question.reviewRevision?[question.reviewRevision]:[])].join(':');
   if(!correct){const old=state.wrongs[id],row={id,question:snapshotQuestion(question),input,count:advanceMistakeBalance(old?.count||0,{correct:false})};state.wrongs[id]=row;persist({wrongs:{[id]:row}});}
   else if(retest&&state.wrongs[id]){const row={...state.wrongs[id],id,count:advanceMistakeBalance(state.wrongs[id].count,{correct:true})};if(!row.count&&state.preferences.autoRemoveResolvedWrongs){delete state.wrongs[id];persist({wrongs:{[id]:null}});}else{state.wrongs[id]=row;persist({wrongs:{[id]:row}});}}
  },
  removeWrong(id){requireReady();if(!state.wrongs[id])return;delete state.wrongs[id];persist({wrongs:{[id]:null}});},
  clearWrongs(){requireReady();const removed=Object.fromEntries(Object.keys(state.wrongs).map(id=>[id,null]));state.wrongs={};persist({wrongs:removed});},
  reset(){requireReady();const previous=state,preferences={...state.preferences};state=fresh();state.preferences=preferences;if(!persist({reset:true,base:base(),statuses:{},wrongs:{}})){state=previous;throw new Error('Could not erase study progress');}},
 };
}
