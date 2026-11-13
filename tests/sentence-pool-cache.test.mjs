import test from 'node:test';
import assert from 'node:assert/strict';
import {createSentenceEngine} from '../web/js/shared/lexicon-sentences.js';
function fixture(){
 let reads=0;
 const words=['cat','dog','bird'].map(lemma=>({id:lemma,lemma,pos:'noun',studyMeaning:lemma,examples:[{get text(){reads++;return `The ${lemma} sleeps.`;},studyTranslation:lemma+' translation'}]}));
 return {words,reads:()=>reads,engine:createSentenceEngine({id:'en'})};
}
for(const mode of ['cloze','scramble'])test(`${mode} reuses unchanged filtered words without rereading source examples`,()=>{
 const {engine,words,reads}=fixture();const first=engine.createSentencePool(mode,words,'ko'),prepared=reads();assert.ok(prepared>0);
 const second=engine.createSentencePool(mode,words.slice(),'ko');second.choose();assert.equal(reads(),prepared);
 assert.deepEqual(second.all(()=>.3),first.all(()=>.3));
});
test('changed membership, order, locale and replacement content invalidate prepared rows',()=>{
 const {engine,words,reads}=fixture();engine.createSentencePool('scramble',words,'ko');let before=reads();
 const filtered=engine.createSentencePool('scramble',words.slice(1),'ko');assert.ok(reads()>before);assert.ok(filtered.all().every(q=>q.word.id!=='cat'));
 before=reads();const ordered=engine.createSentencePool('scramble',[words[2],words[1]],'ko');assert.ok(reads()>before);assert.equal(ordered.all()[0].word.id,'bird');
 before=reads();assert.equal(engine.createSentencePool('scramble',[words[2],words[1]],'en').choose().locale,'en');assert.ok(reads()>before);
 const updated={...words[0],examples:[{text:'The cat waits.',studyTranslation:'Updated sentence.'}]};
 assert.equal(engine.createSentencePool('scramble',[updated],'ko').choose().sentence,'The cat waits.');
});
test('only the last word set per mode is retained and content release clears both modes',()=>{
 const {engine,words,reads}=fixture();engine.createSentencePool('scramble',words,'ko');engine.createSentencePool('scramble',words.slice(1),'ko');let before=reads();engine.createSentencePool('scramble',words,'ko');assert.ok(reads()>before);
 engine.createSentencePool('cloze',words,'ko');engine.clearSentencePools();before=reads();engine.createSentencePool('scramble',words,'ko');assert.ok(reads()>before);before=reads();engine.createSentencePool('cloze',words,'ko');assert.ok(reads()>before);
});
test('fresh draws keep random choices and independent mutable question state',()=>{
 const {engine,words}=fixture(),cloze=engine.createSentencePool('cloze',words,'ko');
 const first=cloze.all(()=>0)[0],second=cloze.all(()=>.99)[0];assert.notDeepEqual(first.options,second.options);first.focus.start=999;assert.notEqual(cloze.all()[0].focus.start,999);
 const scramble=engine.createSentencePool('scramble',words,'ko'),a=scramble.choose(undefined,()=>0),b=scramble.choose(undefined,()=>.5);assert.notDeepEqual(a.pool,b.pool);
 const original=a.tokens.slice();a.tokens.push('corrupt');a.pool.length=0;assert.deepEqual(scramble.all()[0].tokens,original);assert.notEqual(scramble.choose(a.id,()=>0).id,a.id);
});
