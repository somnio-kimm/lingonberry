import test from 'node:test';
import assert from 'node:assert/strict';
import {createFlashcardSession,normaliseFlashcardSetSize,readFlashcardSetSize,saveFlashcardSetSize} from '../web/js/shared/flashcard-session.js';
const makeWords=(count,start=0)=>Array.from({length:count},(_,index)=>({id:'word'+(start+index),lemma:'Word '+(start+index)}));
function createSession(words){const statuses=new Map(words.map(word=>[word.id,'new'])),session=createFlashcardSession({readStatus:word=>statuses.get(word.id)||'new',random:()=>0});return {session,statuses,mark(status){const current=session.current;assert.ok(current);statuses.set(current.id,status);session.mark(status);},eligible(){return words.filter(word=>statuses.get(word.id)!=='mastered');}};}

test('sets are capped, nonmutating, unique and prioritise Learning before New and Mastered',()=>{
 const words=makeWords(40),before=structuredClone(words),{session,statuses}=createSession(words);for(const word of words.slice(0,3))statuses.set(word.id,'learning');for(const word of words.slice(30))statuses.set(word.id,'mastered');session.begin(words,{size:10});assert.equal(session.total,10);assert.equal(new Set(session.cards.map(word=>word.id)).size,10);assert.deepEqual(session.cards.slice(0,3).map(word=>statuses.get(word.id)),['learning','learning','learning']);assert.ok(session.cards.every(word=>statuses.get(word.id)!=='mastered'));assert.deepEqual(words,before);
});
test('direct Mastered classifications finish one fixed round instead of endlessly topping it up',()=>{
 const words=makeWords(30),{session,mark,eligible}=createSession(words);session.begin(words,{size:20});
 for(let index=0;index<20;index++){mark('mastered');session.reconcile(eligible());assert.equal(session.total,20);assert.equal(session.completed,index+1);}
 assert.equal(session.phase,'complete');assert.equal(session.current,undefined);assert.deepEqual(session.summary,{total:20,learning:0,mastered:20});assert.equal(session.learningCount,0);
});
test('Shuffle Learning repeats only the unfinished round, without adding unseen words',()=>{
 const words=makeWords(30),{session,mark,eligible}=createSession(words);session.begin(words,{size:20});for(let index=0;index<20;index++)mark(index<15?'mastered':'learning');assert.equal(session.phase,'complete');assert.equal(session.learningCount,5);const unfinished=session.cards.slice(15).map(word=>word.id);
 assert.equal(session.reviewLearning(),true);session.reconcile(eligible());assert.equal(session.total,5);assert.deepEqual(session.cards.map(word=>word.id),unfinished);assert.equal(session.completed,0);assert.equal(session.phase,'studying');
});
test('the next set prefers unseen eligible words and restores the configured set size after a short repeat',()=>{
 const words=makeWords(50),{session,mark,eligible}=createSession(words);session.begin(words,{size:20});const first=new Set(session.cards.map(word=>word.id));for(let index=0;index<20;index++)mark(index<15?'mastered':'learning');session.reviewLearning();session.reconcile(eligible());assert.equal(session.total,5);session.begin(eligible(),{size:20});assert.equal(session.total,20);assert.ok(session.cards.every(word=>!first.has(word.id)));
});
test('Previous can reopen and correct a completed card without increasing the round count',()=>{
 const words=makeWords(3),{session,mark}=createSession(words);session.begin(words,{size:10});let last;
 while(session.phase==='studying'){last=session.current.id;mark('mastered');}session.move(-1);session.reconcile([]);assert.equal(session.phase,'studying');assert.equal(session.current.id,last);mark('learning');assert.equal(session.phase,'complete');assert.equal(session.completed,3);assert.deepEqual(session.summary,{total:3,learning:1,mastered:2});assert.equal(session.learningCount,1);
});
test('when an ungraded current card becomes ineligible, reconciliation selects another ungraded card',()=>{
 const words=makeWords(3),{session,mark,statuses,eligible}=createSession(words);session.begin(words,{size:10});mark('mastered');const current=session.current.id;statuses.set(current,'mastered');session.reconcile(eligible());assert.equal(session.current.id,'word2');assert.equal(session.completed,1);assert.equal(session.total,2);
});
test('an empty set becomes usable when Word List makes a word eligible later',()=>{
 const words=makeWords(2),{session}=createSession(words);session.begin([],{size:20});assert.equal(session.phase,'empty');session.reconcile(words);assert.equal(session.phase,'studying');assert.equal(session.total,2);assert.ok(session.current);
});
test('newly eligible words fill a short studying set but never exceed its cap',()=>{
 const words=makeWords(30),{session}=createSession(words);session.begin(words.slice(0,3),{size:10});session.reconcile(words);assert.equal(session.total,10);assert.equal(new Set(session.cards.map(word=>word.id)).size,10);
});
test('a completed set remains complete when more words become eligible until Next Set is chosen',()=>{
 const words=makeWords(12),{session,mark}=createSession(words);session.begin(words.slice(0,2),{size:10});mark('mastered');mark('mastered');session.reconcile(words);assert.equal(session.phase,'complete');assert.equal(session.total,2);session.begin(words,{size:10});assert.equal(session.total,10);assert.ok(session.cards.every(word=>!['word0','word1'].includes(word.id)));
});
test('a sparse one-card set, and an entirely empty set, never need random-navigation loops',()=>{
 const words=makeWords(1),{session,mark}=createSession(words);session.begin(words,{size:100});assert.equal(session.total,1);session.move(1);assert.equal(session.current.id,'word0');session.move(-1);assert.equal(session.current.id,'word0');mark('mastered');assert.equal(session.phase,'complete');assert.equal(session.reviewLearning(),false);session.begin([],{size:10});session.move(1);session.mark('learning');assert.equal(session.phase,'empty');assert.equal(session.completed,0);
});
test('reconciliation refreshes ungraded word content without changing its stable progress ID',()=>{
 const words=makeWords(2),{session}=createSession(words);session.begin(words,{size:10});const latest={...words[0],lemma:'Updated form'};session.reconcile([latest,words[1]]);assert.equal(session.current,latest);assert.equal(session.current.id,'word0');assert.equal(session.completed,0);
});
test('set-size preferences survive independent language sessions and storage failures are safe',()=>{
 const values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};assert.equal(readFlashcardSetSize(storage),20);saveFlashcardSetSize(50,storage);for(const language of ['de','zh','en','ja']){const session=createFlashcardSession();session.begin(makeWords(70).map(word=>({...word,language})),{size:readFlashcardSetSize(storage)});assert.equal(session.total,50);}assert.equal(normaliseFlashcardSetSize(99),20);assert.equal(readFlashcardSetSize({getItem(){throw new Error('Unavailable');}}),20);assert.equal(saveFlashcardSetSize(10,{setItem(){throw new Error('Full');}}),10);
});
test('duplicate pool IDs cannot create an unfinishable reconciled round',()=>{
 const words=makeWords(2),{session,mark}=createSession(words);session.begin(words.slice(0,1),{size:10});session.reconcile([words[0],words[1],words[1]]);assert.equal(session.total,2);assert.equal(new Set(session.cards.map(word=>word.id)).size,2);mark('mastered');mark('mastered');assert.equal(session.phase,'complete');
});

import {createEnglishHeadwords,readWordSenses,readHeadwordStatus} from '../web/js/shared/english-headwords.js';
test('English groups retain one stable round identity when the first eligible sense changes',()=>{
 const words=[{id:'appeal-noun',lemma:'appeal',level:'middle',pos:'noun',studyMeaning:'request'},{id:'appeal-verb',lemma:'appeal',level:'middle',pos:'verb',studyMeaning:'make a request'},{id:'book',lemma:'book',level:'middle',pos:'noun',studyMeaning:'volume'},{id:'cake',lemma:'cake',level:'middle',pos:'noun',studyMeaning:'baked food'}],statuses=new Map(words.map(word=>[word.id,'new'])),model=createEnglishHeadwords(words);
 const readPool=()=>model.group(words.filter(word=>statuses.get(word.id)!=='mastered'));
 const session=createFlashcardSession({readStatus:word=>readHeadwordStatus(word,id=>statuses.get(id)),readIdentity:word=>JSON.stringify([word.level,word.lemma.normalize('NFC')]),random:()=>0});
 const mark=status=>{for(const sense of readWordSenses(session.current))statuses.set(sense.id,status);session.mark(status);};
 session.begin(readPool(),{size:10});assert.equal(session.current.lemma,'appeal');mark('learning');statuses.set('appeal-noun','mastered');session.reconcile(readPool());
 assert.equal(session.total,3);const grouped=session.cards.filter(word=>word.lemma==='appeal');assert.equal(grouped.length,1);assert.deepEqual(readWordSenses(grouped[0]).map(word=>word.id),['appeal-verb']);
 while(session.phase==='studying')mark('learning');assert.equal(session.phase,'complete');session.reviewLearning();session.reconcile(readPool());assert.equal(session.cards.filter(word=>word.lemma==='appeal').length,1);assert.equal(session.current.lemma,'appeal');mark('learning');assert.equal(statuses.get('appeal-noun'),'mastered','Repeating the remaining verb must not demote its already-mastered noun');
});

test('previewing a completed short round never pulls newly eligible words into that finished set',()=>{
 const words=makeWords(3),{session,mark}=createSession(words);session.begin(words.slice(0,2),{size:20});mark('mastered');mark('mastered');session.move(-1);session.reconcile([words[2]]);assert.equal(session.total,2);assert.equal(session.current.id,'word1');mark('learning');assert.equal(session.phase,'complete');assert.deepEqual(session.summary,{total:2,learning:1,mastered:1});
});

test('repeat rounds auto-complete externally mastered words without refilling or showing them as the next task',()=>{
 const words=makeWords(40),{session,mark,statuses,eligible}=createSession(words);session.begin(words,{size:20});for(let index=0;index<20;index++)mark('learning');session.reviewLearning();const external=session.current.id;statuses.set(external,'mastered');session.reconcile(eligible());assert.equal(session.total,20);assert.equal(session.completed,1);assert.notEqual(session.current.id,external);assert.equal(session.learningCount,19);
 while(session.phase==='studying')mark('learning');assert.equal(statuses.get(external),'mastered');assert.deepEqual(session.summary,{total:20,learning:19,mastered:1});const old=new Set(session.cards.map(word=>word.id));session.begin(eligible(),{size:20});assert.equal(session.total,20);assert.ok(session.cards.every(word=>!old.has(word.id)));
});
