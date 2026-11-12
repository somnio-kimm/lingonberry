import test from 'node:test';
import assert from 'node:assert/strict';
import {germanWords} from '../web/js/presentation/words.js';
import {listeningQuestions,listeningAnswerCorrect} from '../web/languages/de/js/core/listening-tests.js';
import {createStore} from '../web/languages/de/js/core/store.js';
import {wrongEntries} from '../web/languages/de/js/core/wrong.js';
import {reviewCatalog,reviewItems} from '../web/languages/de/js/core/retest.js';
const study=(locale,entry)=>({targetLanguage:'de',explanationLanguage:locale,studyVersion:'1.0.0',entries:[{id:'hurt',word:'weh tun',partOfSpeech:'verb',level:'A1',meaning:locale==='en'?'hurt':'아프다',...entry}]});
for(const locale of ['en','ko'])test(`German ${locale} Word Dictation accepts curated spellings through saved Review`,()=>{
 const content=study(locale,{aliases:['wehtun','schmerzen'],listeningAliases:['wehtun']}),words=germanWords(content),q=listeningQuestions('listenword',words,locale)[0];
 assert.deepEqual(words[0].listeningAliases,['wehtun']);assert.equal(q.spokenText,'weh tun');assert.equal(q.answer,'weh tun');
 assert.equal(listeningAnswerCorrect(q,'weh tun'),true);assert.equal(listeningAnswerCorrect(q,'wehtun'),true);assert.equal(listeningAnswerCorrect(q,'schmerzen'),false);
 const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},store=createStore(storage);store.setReviewContent(content);store.recordQuizAnswer('listenword',q,'wrong',false,{heard:true,plays:1});
 const reopened=createStore(storage);reopened.setReviewContent(content);const rows=wrongEntries([],reopened.state,words,reopened.reviewContent),replay=reviewItems(rows,reviewCatalog(words,rows));assert.equal(replay.items.length,1);
 const saved=replay.items[0].question;assert.notEqual(saved.acceptedAnswers,q.acceptedAnswers);assert.deepEqual(saved.acceptedAnswers,['weh tun','wehtun']);assert.equal(listeningAnswerCorrect(saved,'wehtun'),true);assert.equal(listeningAnswerCorrect(saved,'schmerzen'),false);
});
test('absent or empty German listening aliases never promote ordinary search aliases',()=>{
 for(const listeningAliases of [undefined,[]]){
  const words=germanWords(study('en',{aliases:['wehtun'],listeningAliases})),q=listeningQuestions('listenword',words)[0];assert.deepEqual(q.acceptedAnswers,['weh tun']);assert.equal(listeningAnswerCorrect(q,'wehtun'),false);
 }
});
test('German reviewed noun spellings retain the actually spoken article alternatives',()=>{
 const words=germanWords(study('en',{id:'drain',word:'Abfluss',article:'der',partOfSpeech:'noun',aliases:['Abfluß','Ausguss'],listeningAliases:['Abfluß']})),q=listeningQuestions('listenword',words)[0];
 assert.equal(q.spokenText,'der Abfluss');
 for(const answer of ['Abfluss','der Abfluss','Der Abfluss','Abfluß','der Abfluß','Der Abfluß'])assert.equal(listeningAnswerCorrect(q,answer),true);
 for(const answer of ['das Abfluß','Ausguss','der Ausguss'])assert.equal(listeningAnswerCorrect(q,answer),false);
});
