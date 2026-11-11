import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from '../web/languages/de/js/core/store.js';
import {wrongEntries} from '../web/languages/de/js/core/wrong.js';
import {Store as ChineseStore} from '../web/languages/zh/js/services/store.js';
import {createReviewContentPolicy} from '../web/js/shared/review-content.js';
const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};
const revised={studyVersion:'4.0.0',retiredEntries:[{id:'old'}],reviewInvalidations:[{id:'changed',minimumVersion:'4.0.0'}]};
const word=id=>({id,lemma:id,hanzi:id,cefr:'A1',hskLevel:1,pos:'noun',meaning_en:[id],meaning_ko:[id]});
const question=id=>({id:id+':en',mode:'vocabinput',locale:'en',word:word(id),answer:id,prompt:'Meaning',example:{de:id}});
test('German corrections exclude outdated questions but preserve history, mastery and unrelated wrongs',()=>{
 const storage=memory(),store=createStore(storage);
 store.setWordStatus('changed','mastered');store.preference('uiLang','ko');
 for(const id of ['changed','old','unrelated'])store.recordQuizAnswer('vocabinput',question(id),'wrong',false);
 const original=structuredClone(store.state.quizAnswers.vocabinput['changed:en']);
 store.setReviewContent(revised);
 assert.deepEqual(wrongEntries([],store.state,[],store.reviewContent).map(r=>r.wordId),['unrelated']);
 assert.deepEqual(store.state.quizAnswers.vocabinput['changed:en'],original);
 store.recordQuizAnswer('vocabinput',{...question('changed'),answer:'corrected',prompt:'New meaning'},'another wrong',false);
 const fresh=store.state.quizAnswers.vocabinput['changed:en'];
 assert.equal(fresh.questionSnapshot.contentVersion,'4.0.0');assert.equal(fresh.questionSnapshot.reviewRevision,'4.0.0');
 assert.equal(fresh.attempts.length,1);assert.equal(fresh.answer,'corrected');
 assert.deepEqual(store.state.quizAnswerHistory,[{mode:'vocabinput',questionId:'changed:en',record:original}]);
 assert.equal(store.wordStatus('changed'),'mastered');assert.equal(store.wordStatus('new-sense'),'new');assert.equal(store.state.preferences.uiLang,'ko');
 const reopened=createStore(storage);reopened.setReviewContent(revised);
 assert.deepEqual(reopened.state.quizAnswerHistory,store.state.quizAnswerHistory);
 assert.deepEqual(new Set(wrongEntries([],reopened.state,[],reopened.reviewContent).map(r=>r.wordId)),new Set(['changed','unrelated']));
});
test('German sentence snapshots also honour versioned corrections',()=>{
 const store=createStore(memory()),q={...question('changed'),mode:'cloze',id:'changed:cloze'};
 store.setReviewContent({studyVersion:'3.2.0'});store.recordQuizAnswer('cloze',q,'wrong',false);
 assert.equal(store.state.quizAnswers.cloze[q.id].questionSnapshot.contentVersion,'3.2.0');
 store.setReviewContent(revised);assert.equal(wrongEntries([],store.state,[],store.reviewContent).length,0);
 store.recordQuizAnswer('cloze',q,'new wrong',false);
 assert.equal(wrongEntries([],store.state,[],store.reviewContent).length,1);
 assert.equal(store.state.quizAnswerHistory[0].record.contentVersion,'3.2.0');
 assert.equal(store.state.quizAnswers.cloze[q.id].attempts.length,1);
});
test('Chinese corrections filter active Review without deleting stored answers or SRS',()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');Object.defineProperty(globalThis,'localStorage',{value:memory(),writable:true,configurable:true});
 try{
  ChineseStore.setReviewContent({studyVersion:'2.2.0'});
  localStorage.setItem('learn-language.zh.srsById',JSON.stringify({changed:{level:5},old:{level:3}}));
  for(const id of ['changed','old','unrelated'])ChineseStore.addWrong({wordId:id,mode:'vocabinput',question:question(id),userAnswer:'wrong'});
  const before=localStorage.getItem('learn-language.zh.wrong'),srs=localStorage.getItem('learn-language.zh.srsById');
  ChineseStore.setReviewContent(revised);
  assert.deepEqual(ChineseStore.wrongAnswers.map(r=>r.wordId),['unrelated']);
  assert.equal(localStorage.getItem('learn-language.zh.wrong'),before);assert.equal(localStorage.getItem('learn-language.zh.srsById'),srs);
  const old=JSON.parse(before).find(r=>r.wordId==='changed');assert.equal(ChineseStore.isReviewQuestionCurrent(old.question),false);
  assert.equal(ChineseStore.addWrong({wordId:'changed',mode:'vocabinput',question:old.question}),false);
  ChineseStore.recordWrongRetest(old.id,'stale response',true);
  assert.deepEqual(JSON.parse(localStorage.getItem('learn-language.zh.wrong')).find(r=>r.id===old.id),old);
  ChineseStore.addWrong({wordId:'changed',mode:'vocabinput',question:{...question('changed'),answer:'new answer'},userAnswer:'new wrong'});
  const fresh=ChineseStore.wrongAnswers.find(r=>r.wordId==='changed');assert.equal(fresh.question.contentVersion,'4.0.0');assert.equal(fresh.question.reviewRevision,'4.0.0');
  ChineseStore.recordWrongRetest(fresh.id,'new answer',true);
  assert.deepEqual(JSON.parse(localStorage.getItem('learn-language.zh.wrong')).find(r=>r.id===old.id),old);
  assert.equal(localStorage.getItem('learn-language.zh.srsById'),srs);
 }finally{ChineseStore.setReviewContent();if(previous)Object.defineProperty(globalThis,'localStorage',previous);else delete globalThis.localStorage;}
});
test('German refuses a queued obsolete snapshot without rewriting its version or history',()=>{
 const store=createStore(memory());store.setReviewContent({studyVersion:'3.0.0'});
 store.recordQuizAnswer('vocabinput',question('changed'),'old wrong',false);
 const original=structuredClone(store.state.quizAnswers.vocabinput['changed:en']);store.setReviewContent(revised);
 assert.equal(store.recordQuizAnswer('vocabinput',original.questionSnapshot,'stale answer',true),false);
 assert.deepEqual(store.state.quizAnswers.vocabinput['changed:en'],original);assert.equal(store.state.quizAnswerHistory,undefined);
 assert.equal(store.recordQuizAnswer('vocabinput',question('old'),'retired answer',false),false);
 assert.equal(store.state.quizAnswers.vocabinput['old:en'],undefined);
});
test('corrected adjective nouns invalidate saved questions independently of the adjective target',()=>{
 const policy=createReviewContentPolicy(revised),q={...question('adjective'),noun:word('changed')};
 assert.equal(policy.isCurrent(q),false);assert.equal(policy.isCurrent(policy.prepare(q)),true);
 assert.equal(policy.isCurrent({...q,noun:word('old'),contentVersion:'4.0.0'}),false);
});
