import test from 'node:test';
import assert from 'node:assert/strict';
import {verbFormQuestions,verbFormCorrect,validGrammarQuestion} from '../web/languages/de/js/core/grammar-quizzes.js';
import {createStore} from '../web/languages/de/js/core/store.js';
import {wrongEntries} from '../web/languages/de/js/core/wrong.js';
import {reviewCatalog,reviewItems} from '../web/languages/de/js/core/retest.js';
const people=[
 ['ich','habe','hatte','werde','mich','mir'],['du','hast','hattest','wirst','dich','dir'],
 ['er','hat','hatte','wird','sich','sich'],['wir','haben','hatten','werden','uns','uns'],
 ['ihr','habt','hattet','werdet','euch','euch'],['sie','haben','hatten','werden','sich','sich'],
];
const haben={id:'haben',lemma:'haben',pos:'verb',forms:{praesens:Object.fromEntries(people.map(p=>[p[0],p[1]])),praeteritum:Object.fromEntries(people.map(p=>[p[0],p[2]]))}};
const introduce=()=>({id:'vorstellen',lemma:'vorstellen',pos:'verb',cefr:'B1',meaning_en:['introduce; imagine'],meaning_ko:['소개하다; 상상하다'],reflexive_case:'accusative / dative',infinitive:'vorstellen / sich vorstellen',forms:{perfekt:'hat vorgestellt / hat sich vorgestellt'}});

test('explicit accusative and dative alternatives expand all persons in each derived tense',()=>{
 const word=introduce(),questions=verbFormQuestions([word],[haben]);assert.equal(questions.length,24);
 for(const [person,have,had,future,acc,dat]of people){
  for(const [tense,prefix,complement]of [['perfekt',have,'vorgestellt'],['plusquamperfekt',had,'vorgestellt'],['futur_i',future,'vorstellen'],['futur_ii',future,'vorgestellt haben']]){
   const q=questions.find(q=>q.tense===tense&&q.person===person),expected=[...new Set([prefix+' '+complement,prefix+' '+acc+' '+complement,prefix+' '+dat+' '+complement])];
   assert.deepEqual(q.acceptedAnswers,expected);assert.equal(q.answer,expected[0]);
   for(const answer of expected)assert.equal(verbFormCorrect(q,answer),true);
   assert.equal(verbFormCorrect(q,prefix+' ihm '+complement),false);
   if(person==='ich'||person==='du')assert.equal(verbFormCorrect(q,prefix+' sich '+complement),false);
  }
 }
});

test('multiple-case expansion keeps each citation auxiliary paired with its own complement',()=>{
 const word={...introduce(),forms:{perfekt:'ist angekommen / hat sich vorgestellt'}};
 const q=verbFormQuestions([word],[haben]).find(q=>q.tense==='futur_ii'&&q.person==='ich');
 assert.deepEqual(q.acceptedAnswers,['werde angekommen sein','werde mich vorgestellt haben','werde mir vorgestellt haben']);
 for(const wrong of ['werde mich angekommen sein','werde vorgestellt sein','werde mir vorgestellt sein'])assert.equal(verbFormCorrect(q,wrong),false);
});

test('an unknown case alternative withholds incomplete derived inventories without removing finite forms',()=>{
 for(const grammaticalCase of ['accusative / unknown',undefined,'',[]]){
  const word={...introduce(),reflexive_case:grammaticalCase,forms:{...introduce().forms,praesens:{ich:'stelle vor / stelle mich vor / stelle mir vor'}}};
  const questions=verbFormQuestions([word],[haben]);assert.equal(questions.length,1);assert.equal(questions[0].tense,'praesens');
 }
 const word={...introduce(),reflexive_case:'acc / dat / acc'};
 assert.deepEqual(verbFormQuestions([word],[haben]).find(q=>q.person==='ich'&&q.tense==='perfekt').acceptedAnswers,['habe vorgestellt','habe mich vorgestellt','habe mir vorgestellt']);
});

test('saved Review and re-test retain the complete answer inventory after Store reload',()=>{
 const word=introduce(),words=[word,haben],q=verbFormQuestions([word],words).find(q=>q.tense==='perfekt'&&q.person==='ich'),data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},store=createStore(storage);
 store.setReviewContent({studyVersion:'1.0.0'});store.recordQuizAnswer('verbforms',q,'habe sich vorgestellt',false);
 const reopened=createStore(storage);reopened.setReviewContent({studyVersion:'1.0.0'});
 const rows=wrongEntries([],reopened.state,words,reopened.reviewContent),replay=reviewItems(rows,reviewCatalog(words,rows));assert.equal(replay.items.length,1);
 const saved=replay.items[0].question;assert.equal(validGrammarQuestion(saved),true);assert.notEqual(saved.acceptedAnswers,q.acceptedAnswers);assert.deepEqual(saved.acceptedAnswers,['habe vorgestellt','habe mich vorgestellt','habe mir vorgestellt']);
 assert.equal(verbFormCorrect(saved,'habe mich vorgestellt'),true);assert.equal(verbFormCorrect(saved,'habe mir vorgestellt'),true);assert.equal(verbFormCorrect(saved,'habe sich vorgestellt'),false);
});
