import test from 'node:test';
import assert from 'node:assert/strict';
import {createLexiconStore} from '../web/js/shared/lexicon-store.js';
import {studyProfiles} from '../web/js/presentation/study-profiles.js';
function storage(){const data=new Map(),writes=[];return {data,writes,getItem:key=>data.get(key),setItem(key,value){writes.push({key,value});data.set(key,value);}};}
function backend(){
 const states=new Map();let failure=false,hook,operations=0;
 return {states,get operations(){return operations;},fail:value=>{failure=value;},onApply:fn=>{hook=fn;},
  async initialise(language,legacy,{allowImport=true}={}){if(failure)throw new Error('Unavailable');if(!states.has(language)){if(!allowImport)throw new Error('Unreadable legacy progress');states.set(language,structuredClone(legacy));}},
  async load(language){if(failure)throw new Error('Unavailable');return structuredClone(states.get(language));},
  async apply(language,patch){operations++;if(failure)throw new Error('Unavailable');if(hook)await hook();let value=states.get(language);if(patch.resetRevision)value={...patch.base.value,wordStatus:{},wrongs:{}};else if(patch.base)value={...patch.base.value,wordStatus:value.wordStatus,wrongs:value.wrongs};
   for(const [key,target]of [['statuses','wordStatus'],['wrongs','wrongs']])for(const [id,change]of Object.entries(patch[key])){if(change.value===null)delete value[target][id];else value[target][id]=structuredClone(change.value);}states.set(language,value);
  },
 };
}
const q={mode:'vocabinput',id:'word:ko',locale:'ko',prompt:'적다',answer:'write',word:{id:'write',lemma:'write',level:'IELTS 1.0–3.5',pronunciation:'raɪt',studyLanguage:'en',studyExplanationLanguage:'ko',studyMeaning:'적다',aliases:['writes'],search:'large search index',examples:[{text:'Unused additional sentence.'}]} ,example:{text:'Please write it down.',studyTranslation:'적어 주세요.'}};

test('legacy migration preserves old records and markers, then stores new compact snapshots',async()=>{
 const disk=storage(),db=backend(),old=createLexiconStore(disk,studyProfiles.en);old.record(q,'bad',false);Object.values(old.state.wrongs)[0].question=structuredClone(q);old.setWordStatus('write','mastered');old.preference('clozeShowReading',false);const legacy=structuredClone(old.state);
 const store=createLexiconStore(disk,studyProfiles.en,{progressStorage:db});assert.throws(()=>store.record(q,'bad',false),/loading/);await store.ready();assert.deepEqual(store.state,legacy);assert.deepEqual(db.states.get('en'),legacy);assert.equal(JSON.parse(disk.getItem('learn-language.en.lexicon.v1')).version,2);
 store.record({...q,id:'second'},'bad',false);await store.flush();const saved=Object.values(store.state.wrongs).find(row=>row.question.id==='second');assert.equal(saved.question.word.search,undefined);assert.equal(saved.question.word.examples,undefined);assert.equal(saved.question.word.pronunciation,'raɪt');assert.equal(saved.question.word.level,q.word.level);assert.deepEqual(saved.question.example,q.example);
 const reopened=createLexiconStore(disk,studyProfiles.en,{progressStorage:db});await reopened.ready();assert.deepEqual(reopened.state,store.state);
});
test('ordinary correct answers cause no progress write; retests and actual removals do',async()=>{
 const disk=storage(),db=backend(),store=createLexiconStore(disk,studyProfiles.en,{progressStorage:db});await store.ready();disk.writes.length=0;const operations=db.operations;store.record(q,'write',true);assert.equal(disk.writes.length,0);assert.equal(db.operations,operations);
 store.record(q,'bad',false);await store.flush();store.record(q,'write',true,true);await store.flush();assert.equal(Object.values(db.states.get('en').wrongs)[0].count,0);
 store.preference('autoRemoveResolvedWrongs',true);await store.flush();assert.deepEqual(db.states.get('en').wrongs,{});
});
test('a durable pending journal recovers answers after an interrupted asynchronous commit',async()=>{
 const disk=storage(),db=backend(),store=createLexiconStore(disk,studyProfiles.en,{progressStorage:db});await store.ready();db.fail(true);store.record(q,'bad',false);assert.equal(await store.flush(),false);assert.equal(store.warning,true);assert.ok(disk.getItem('learn-language.en.lexicon.v1.pending').includes('bad'));
 db.fail(false);const reopened=createLexiconStore(disk,studyProfiles.en,{progressStorage:db});await reopened.ready();assert.equal(Object.values(reopened.state.wrongs)[0].count,1);assert.deepEqual(reopened.state.wrongs,db.states.get('en').wrongs);
});
test('updates arriving during a commit retain their newer revisions',async()=>{
 const disk=storage(),db=backend(),store=createLexiconStore(disk,studyProfiles.en,{progressStorage:db});await store.ready();let release,entered;const started=new Promise(resolve=>{entered=resolve;});const gate=new Promise(resolve=>{release=resolve;});let first=true;db.onApply(async()=>{if(first){first=false;entered();await gate;}});
 store.record(q,'bad',false);await started;store.record(q,'another bad',false);store.setWordStatus('write','learning');release();await store.flush();assert.equal(Object.values(db.states.get('en').wrongs)[0].count,2);assert.equal(db.states.get('en').wordStatus.write,'learning');assert.equal(Object.keys(JSON.parse(disk.getItem('learn-language.en.lexicon.v1.pending')).wrongs).length,0);
});
test('reset is atomic in the pending intent, keeps preferences and preserves another language',async()=>{
 const disk=storage(),db=backend(),en=createLexiconStore(disk,studyProfiles.en,{progressStorage:db}),ja=createLexiconStore(disk,studyProfiles.ja,{progressStorage:db});await Promise.all([en.ready(),ja.ready()]);en.preference('theme','dark');en.setWordStatus('write','mastered');en.record(q,'bad',false);ja.record({...q,word:{id:'ja-word'}},'bad',false);await Promise.all([en.flush(),ja.flush()]);en.reset();await en.flush();assert.deepEqual(db.states.get('en').wordStatus,{});assert.deepEqual(db.states.get('en').wrongs,{});assert.equal(db.states.get('en').preferences.theme,'dark');assert.equal(Object.keys(db.states.get('ja').wrongs).length,1);
});
test('failed journal writes roll back reset and do not schedule a destructive backend write',async()=>{
 const disk=storage(),db=backend(),store=createLexiconStore(disk,studyProfiles.en,{progressStorage:db});await store.ready();store.setWordStatus('write','mastered');await store.flush();const before=structuredClone(db.states.get('en')),operations=db.operations;disk.setItem=()=>{throw new Error('Quota');};assert.throws(()=>store.reset());assert.equal(store.wordStatus('write'),'mastered');assert.equal(db.operations,operations);assert.deepEqual(db.states.get('en'),before);
});
test('failed initialisation retries without erasing legacy or recovered data',async()=>{
 const disk=storage(),db=backend(),legacy=createLexiconStore(disk,studyProfiles.en);legacy.record(q,'bad',false);const raw=disk.getItem('learn-language.en.lexicon.v1');db.fail(true);const store=createLexiconStore(disk,studyProfiles.en,{progressStorage:db});await assert.rejects(store.ready());assert.equal(disk.getItem('learn-language.en.lexicon.v1'),raw);db.fail(false);await store.ready();assert.equal(Object.values(store.state.wrongs)[0].count,1);
});
test('invalid recovery data is retained rather than replacing the existing history',async()=>{
 const disk=storage(),db=backend();disk.setItem('learn-language.en.lexicon.v1.pending','{"version":1,"sequence":1,"wrongs":{"x":{}}}');const raw=disk.getItem('learn-language.en.lexicon.v1.pending'),store=createLexiconStore(disk,studyProfiles.en,{progressStorage:db});await assert.rejects(store.ready(),/invalid/);assert.equal(disk.getItem('learn-language.en.lexicon.v1.pending'),raw);assert.equal(db.states.size,0);
});
test('fresh synchronous state is read-only until an actual progress change',()=>{
 const disk=storage(),store=createLexiconStore(disk,studyProfiles.en);assert.equal(disk.writes.length,0);store.record(q,'write',true);assert.equal(disk.writes.length,0);store.record(q,'bad',false);assert.equal(disk.writes.length,1);
});
test('an unsupported backend state cannot silently become empty progress',async()=>{
 const disk=storage(),db=backend(),legacy=createLexiconStore(disk,studyProfiles.en);legacy.record(q,'bad',false);const raw=disk.getItem('learn-language.en.lexicon.v1');db.states.set('en',{...structuredClone(legacy.state),version:99});
 const store=createLexiconStore(disk,studyProfiles.en,{progressStorage:db});await assert.rejects(store.ready(),/not supported/);assert.equal(db.states.get('en').version,99);assert.equal(disk.getItem('learn-language.en.lexicon.v1'),raw);
});
test('unreadable first-import legacy data is retained rather than replaced by an empty profile',async()=>{
 for(const raw of ['{broken','{"version":1,"wrongs":{"old":{"input":"wrong"}}}','{"version":99,"wrongs":{}}','{"version":2,"storage":"indexeddb","preferences":{}}']){
  const disk=storage(),db=backend();disk.setItem('learn-language.en.lexicon.v1',raw);const store=createLexiconStore(disk,studyProfiles.en,{progressStorage:db});await assert.rejects(store.ready());assert.equal(disk.getItem('learn-language.en.lexicon.v1'),raw);assert.equal(db.states.size,0);
 }
});
test('an existing canonical profile recovers even when its old marker is unreadable',async()=>{
 const disk=storage(),db=backend(),old=createLexiconStore(disk,studyProfiles.en,{progressStorage:db});await old.ready();old.setWordStatus('write','mastered');await old.flush();disk.setItem('learn-language.en.lexicon.v1','{broken');const store=createLexiconStore(disk,studyProfiles.en,{progressStorage:db});await store.ready();assert.equal(store.wordStatus('write'),'mastered');assert.equal(JSON.parse(disk.getItem('learn-language.en.lexicon.v1')).version,2);
});
