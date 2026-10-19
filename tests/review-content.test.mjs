import test from 'node:test';
import assert from 'node:assert/strict';
import {createReviewContentPolicy,compareContentVersions} from '../web/js/shared/review-content.js';
import {createLexiconStore} from '../web/js/shared/lexicon-store.js';
import {studyProfiles} from '../web/js/presentation/study-profiles.js';
import {validatePackage} from '../web/js/packages/schema.js';
import {fixture} from './package-fixture.js';
const study={studyVersion:'4.0.0',retiredEntries:[{id:'old-spin'}],reviewInvalidations:[{id:'he',minimumVersion:'4.0.0'}]};
const q=id=>({id,mode:'vocabmeaning',locale:'en',word:{id},options:[]});
test('corrected targets and distractors cannot replay old meanings; unrelated history remains usable',()=>{
 const policy=createReviewContentPolicy(study);
 assert.equal(policy.isCurrent(q('he')),false);assert.equal(policy.isCurrent(q('old-spin')),false);assert.equal(policy.isCurrent(q('book')),true);
 const mixed={...q('book'),options:[{id:'he',text:'old wrong definition'}]};assert.equal(policy.isCurrent(mixed),false);
 assert.equal(policy.isCurrent(policy.prepare(mixed)),true);assert.equal(policy.prepare(mixed).reviewRevision,'4.0.0');
 assert.equal(policy.isCurrent({...q('old-spin'),contentVersion:'4.0.0'}),false);
 assert.equal(createReviewContentPolicy({...study,studyVersion:'5.0.0'}).isCurrent(policy.prepare(mixed)),true);
 assert.equal(createReviewContentPolicy({...study,studyVersion:'3.0.0'}).isCurrent(policy.prepare(q('book'))),false);
 assert.equal(compareContentVersions('10.0.0','9.0.0'),1);
});
test('new corrected questions get separate wrong counts without deleting history or mastery',()=>{
 const data=new Map(),storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)},store=createLexiconStore(storage,studyProfiles.en);
 const old=q('he');store.setWordStatus('he','mastered');store.record(old,'old response',false);
 const updated=createReviewContentPolicy(study).prepare(old);store.record(updated,'new response',false);
 assert.equal(Object.keys(store.state.wrongs).length,2);assert.equal(store.wordStatus('he'),'mastered');
 store.record(updated,'right',true,true);assert.equal(store.state.wrongs['vocabmeaning:he:en'].count,1);assert.equal(store.state.wrongs['vocabmeaning:he:en:4.0.0'].count,0);
});
test('download schema rejects malformed retirement and review invalidation policies',()=>{
 const core=fixture({version:'4.0.0',retiredEntries:[{id:'old-house',replacementId:'de-house',reason:'Corrected concept'}],reviewInvalidations:[{id:'de-house',minimumVersion:'4.0.0'}]}).data;
 assert.equal(validatePackage(core),core);
 for(const mutate of [c=>c.retiredEntries[0].id='de-house',c=>c.retiredEntries[0].replacementId='missing',c=>c.reviewInvalidations[0].id='unknown',c=>c.reviewInvalidations[0].minimumVersion='5.0.0',c=>c.reviewInvalidations.push(c.reviewInvalidations[0])]){const changed=structuredClone(core);mutate(changed);assert.throws(()=>validatePackage(changed),/Invalid language package/);}
});

test('only verified equivalent retirements transfer word status, without erasing original history',()=>{
 const data=new Map(),storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)},store=createLexiconStore(storage,studyProfiles.en);
 store.setWordStatus('duplicate','mastered');store.setWordStatus('target','learning');store.setWordStatus('bad-concept','mastered');
 store.migrateEquivalentEntries([{id:'duplicate',replacementId:'target',sameConcept:true},{id:'bad-concept',replacementId:'new-concept'}]);
 assert.equal(store.wordStatus('target'),'mastered');assert.equal(store.wordStatus('duplicate'),'mastered');assert.equal(store.wordStatus('new-concept'),'new');assert.equal(store.wordStatus('bad-concept'),'mastered');
 assert.equal(createLexiconStore(storage,studyProfiles.en).wordStatus('target'),'mastered');
 store.setWordStatus('target','new');const reopened=createLexiconStore(storage,studyProfiles.en);reopened.migrateEquivalentEntries([{id:'duplicate',replacementId:'target',sameConcept:true}]);assert.equal(reopened.wordStatus('target'),'new','a later learner reset is not undone by repeating migration');
});
