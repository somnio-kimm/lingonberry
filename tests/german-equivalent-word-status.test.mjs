import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from '../web/languages/de/js/core/store.js';
const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};};
const equivalent={studyVersion:'4.0.0',retiredEntries:[{id:'old-greeting',replacementId:'greeting',sameConcept:true}]};

test('German equivalent replacement carries the manual marker once and preserves original answers',()=>{
 const storage=memory(),store=createStore(storage);
 store.setWordStatus('old-greeting','mastered');store.preference('uiLang','ko');
 store.recordQuizAnswer('vocabinput',{id:'old-greeting:en',word:{id:'old-greeting',lemma:'gute Nacht',pos:'functional',cefr:'A1'},mode:'vocabinput',locale:'en',prompt:'good night',answer:'gute Nacht',acceptedAnswers:['gute Nacht'],example:{de:'gute Nacht'}},'wrong',false);
 const before=structuredClone(store.state.quizAnswers);
 store.setReviewContent(equivalent);
 assert.equal(store.wordStatus('greeting'),'mastered');assert.equal(store.wordStatus('old-greeting'),'mastered');
 assert.deepEqual(store.state.quizAnswers,before);assert.equal(store.reviewContent.isCurrent(before.vocabinput['old-greeting:en'].questionSnapshot),false);assert.equal(store.state.quizAnswerHistory,undefined);assert.equal(store.state.preferences.uiLang,'ko');
 const reopened=createStore(storage);reopened.setReviewContent(equivalent);assert.equal(reopened.wordStatus('greeting'),'mastered');assert.deepEqual(reopened.state.quizAnswers,before);
});

test('materially different replacements and missing source markers do not create mastery',()=>{
 const store=createStore(memory());store.setWordStatus('old-sense','mastered');
 store.setReviewContent({retiredEntries:[{id:'old-sense',replacementId:'new-sense',sameConcept:false},{id:'unseen',replacementId:'unseen-new',sameConcept:true}]});
 assert.equal(store.wordStatus('new-sense'),'new');assert.equal(store.wordStatus('unseen-new'),'new');assert.equal(store.wordStatus('old-sense'),'mastered');
});

test('equivalent migration never downgrades an existing marker or reverses a later learner reset',()=>{
 const storage=memory(),store=createStore(storage);store.setWordStatus('old-greeting','learning');store.setWordStatus('greeting','mastered');store.setReviewContent(equivalent);
 assert.equal(store.wordStatus('greeting'),'mastered');store.setWordStatus('greeting','new');
 const reopened=createStore(storage);reopened.setReviewContent(equivalent);assert.equal(reopened.wordStatus('greeting'),'new');assert.equal(reopened.wordStatus('old-greeting'),'learning');
});
