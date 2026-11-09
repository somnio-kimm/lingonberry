import test from 'node:test';
import assert from 'node:assert/strict';
import {studyProfiles,studyWords} from '../web/js/presentation/study-profiles.js';
import {createLexiconQuestions} from '../web/js/shared/lexicon-questions.js';
import {validatePackage} from '../web/js/packages/schema.js';
import {fixture} from './package-fixture.js';
const engine=createLexiconQuestions(studyProfiles.en);
function question(entry){
 const words=studyWords({targetLanguage:'en',explanationLanguage:'ko',entries:[entry]});
 return {word:words[0],question:engine.listeningQuestions('listenword',words,'ko')[0]};
}
test('searchable plural is not an answer when Dictation speaks the singular',()=>{
 const {word,question:q}=question({id:'day',word:'day',partOfSpeech:'noun',meaning:'하루',aliases:['days'],listeningAliases:[]});
 assert.deepEqual(word.aliases,['days']);
 assert.equal(q.spokenText,'day');assert.equal(engine.listeningAnswerCorrect(q,'day'),true);
 assert.equal(engine.listeningAnswerCorrect(q,'days'),false);
 assert.equal(engine.vocabularyAnswerCorrect({mode:'vocabinput',word,answer:'day'},'days'),true);
});
test('Dictation accepts reviewed spelling variants while excluding other search aliases',()=>{
 const {question:q}=question({id:'colour',word:'colour',partOfSpeech:'noun',meaning:'색',aliases:['color','colours'],listeningAliases:['color']});
 assert.equal(engine.listeningAnswerCorrect(q,'color'),true);
 assert.equal(engine.listeningAnswerCorrect(q,'colours'),false);
});
test('previously installed packages keep their original alias answer behaviour',()=>{
 const {question:q}=question({id:'colour',word:'colour',partOfSpeech:'noun',meaning:'색',aliases:['color']});
 assert.equal(engine.listeningAnswerCorrect(q,'color'),true);
});
test('package validation rejects unbound, duplicate and malformed listening aliases',()=>{
 for(const listeningAliases of [['days'],['day','day'],'day']){
  const {data}=fixture();data.entries[0].aliases=['day'];data.entries[0].listeningAliases=listeningAliases;
  assert.throws(()=>validatePackage(data),/Invalid language package/);
 }
 const {data}=fixture();data.entries[0].listeningAliases=[];validatePackage(data);
});
