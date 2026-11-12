import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,explanationFixture} from './package-fixture.js';
import {validatePackage} from '../web/js/packages/schema.js';
import {assembleStudy} from '../web/js/packages/study.js';
import {germanWords} from '../web/js/presentation/words.js';
import {listeningQuestions,listeningAnswerCorrect} from '../web/languages/de/js/core/listening-tests.js';
import {createStore} from '../web/languages/de/js/core/store.js';
import {wrongEntries} from '../web/languages/de/js/core/wrong.js';
import {reviewItems,reviewCatalog} from '../web/languages/de/js/core/retest.js';
const text='Das kann weh tun.',alternative='Das kann wehtun.';
function content(locale,example={text,listeningAlternatives:[alternative]}){
 const core=fixture({entries:[{id:'hurt',word:'weh tun',partOfSpeech:'verb',level:'A1',aliases:['wehtun','schmerzen'],listeningAliases:['wehtun'],example}]}).data;
 validatePackage(core);
 return assembleStudy(core,explanationFixture(core,locale).data);
}
for(const locale of ['en','ko'])test(`reviewed full sentence alternatives survive ${locale} saved Review`,()=>{
 const study=content(locale),words=germanWords(study),question=listeningQuestions('listensentence',words,locale)[0];
 assert.equal(question.spokenText,text);assert.equal(question.answer,text);
 assert.deepEqual(question.acceptedAnswers,[text,alternative]);
 for(const answer of [text,alternative])assert.equal(listeningAnswerCorrect(question,answer),true);
 assert.equal(listeningAnswerCorrect(question,'Das kann schmerzen.'),false);
 const data=new Map(),storage={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)},store=createStore(storage);
 store.setReviewContent(study);store.recordQuizAnswer('listensentence',question,'wrong',false,{heard:true,plays:1});
 const reopened=createStore(storage);reopened.setReviewContent(study);
 const rows=wrongEntries([],reopened.state,words,reopened.reviewContent),replay=reviewItems(rows,reviewCatalog(words,rows));
 assert.equal(replay.items.length,1);const saved=replay.items[0].question;
 question.acceptedAnswers.push('unreviewed');
 assert.deepEqual(saved.acceptedAnswers,[text,alternative]);
 assert.equal(listeningAnswerCorrect(saved,alternative),true);assert.equal(listeningAnswerCorrect(saved,'unreviewed'),false);
});
test('word aliases never generate sentence alternatives, including fronted finite clauses',()=>{
 for(const sentence of [text,'Weh tun mir beide Füße.']){
  const words=germanWords(content('en',{text:sentence})),question=listeningQuestions('listensentence',words)[0];
  assert.deepEqual(question.acceptedAnswers,[sentence]);
  assert.equal(listeningAnswerCorrect(question,sentence.replace('weh tun','wehtun').replace('Weh tun','Wehtun')),false);
 }
});
test('primary and additional examples validate bounded unique complete alternatives',()=>{
 for(const invalid of ['sentence',[null],[''],['   '],['x'.repeat(4001)],['duplicate','duplicate'],Array.from({length:11},(_,i)=>'Sentence '+i)]){
  for(const location of ['example','additionalExamples']){
   const example={text,listeningAlternatives:invalid};
   const entry={id:'hurt',word:'weh tun',partOfSpeech:'verb',[location]:location==='example'?example:[example]};
   assert.throws(()=>validatePackage(fixture({entries:[entry]}).data),/sentence listening/);
  }
 }
 assert.doesNotThrow(()=>content('en',{text,listeningAlternatives:[]}));
});
