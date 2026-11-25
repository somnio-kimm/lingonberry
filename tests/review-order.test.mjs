import test from 'node:test';
import assert from 'node:assert/strict';
import {newestMistakesFirst,lastMistakeTime} from '../web/js/shared/review-order.js';
import {renderReviewBadge} from '../web/js/shared/review-badge.js';
import {createLexiconStore} from '../web/js/shared/lexicon-store.js';
import {scoreRetestResults} from '../web/js/shared/retest-results.js';
const question=id=>({id,mode:'vocabinput',locale:'en',word:{id,lemma:id},answer:id});
test('latest incorrect retest sorts first; correct retests do not move a card',()=>{
 const rows=[{id:'a',timestamp:10,retests:[{at:40,correct:true}]},{id:'b',timestamp:20},{id:'c',timestamp:5,retests:[{at:30,correct:false}]}];
 assert.deepEqual(newestMistakesFirst(rows).map(row=>row.id),['c','b','a']);assert.deepEqual(rows.map(row=>row.id),['a','b','c']);assert.equal(lastMistakeTime({timestamp:'invalid'}),0);
});
test('untimed legacy records retain their given fallback order and are never erased',()=>{
 assert.deepEqual(newestMistakesFirst([{id:'b'},{id:'a'}]).map(row=>row.id),['b','a']);
});
test('generic wrong records persist recency and preserve it on successful retests',t=>{
 let time=10;t.mock.method(Date,'now',()=>time);const data=new Map(),storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)},profile={id:'en',levels:['A1']},store=createLexiconStore(storage,profile);
 store.record(question('a'),'wrong',false);time=20;store.record(question('b'),'wrong',false);time=30;store.record(question('a'),'wrong again',false);
 let rows=Object.values(store.state.wrongs);assert.equal(newestMistakesFirst(rows)[0].question.id,'a');time=40;store.record(question('a'),'a',true,true);assert.equal(Object.values(store.state.wrongs).find(row=>row.question.id==='a').lastWrongAt,30);
 const reopened=createLexiconStore(storage,profile);assert.equal(newestMistakesFirst(Object.values(reopened.state.wrongs))[0].lastWrongAt,30);
});
test('exercise badges retain escaped labels and distinct outline icons',()=>{
 const input=renderReviewBadge('vocabinput','<Word Input>'),scramble=renderReviewBadge('scramble','Sentence Scramble');assert.match(input,/&lt;Word Input&gt;/);assert.match(input,/aria-hidden="true"/);assert.notEqual(input.match(/<svg.*<\/svg>/u)[0],scramble.match(/<svg.*<\/svg>/u)[0]);
});
test('retest scores count only recorded answers and keep skipped questions separate',()=>{
 assert.deepEqual(scoreRetestResults([null,{correct:true},{correct:false},{skipped:true},null]),
  {correct:1,incorrect:1,skipped:1,total:2});
});
