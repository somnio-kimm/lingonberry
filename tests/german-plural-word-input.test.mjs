import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,explanationFixture} from './package-fixture.js';
import {assembleStudy} from '../web/js/packages/study.js';
import {germanWords} from '../web/js/presentation/words.js';
import {vocabularyQuestions,vocabularyAnswerCorrect,snapshotVocabularyQuestion} from '../web/languages/de/js/core/vocabulary-tests.js';
const dreadlocks={id:'dreadlocks',word:'Dreadlocks',partOfSpeech:'noun',level:'B2',grammar:{gender:null,number_restriction:'plural',declension:{nom:[null,'die Dreadlocks'],dat:[null,'den Dreadlocks']},related_forms:['Dreadlock']}};
for(const locale of ['en','ko'])test(`${locale} Word Input accepts a declared plural nominative without inventing a singular gender`,()=>{
 const core=fixture({entries:[dreadlocks]}).data,pair=explanationFixture(core,locale,{entries:[{id:dreadlocks.id,meaning:locale==='en'?'dreadlocks':'드레드록스'}]}).data;
 const word=germanWords(assembleStudy(core,pair))[0],question=vocabularyQuestions('vocabinput',[word],locale)[0];
 assert.equal(word.gender,null);assert.equal(word.article,undefined);assert.equal(question.answer,'Dreadlocks');
 for(const candidate of [question,snapshotVocabularyQuestion(question)]){
  for(const answer of ['Dreadlocks','die Dreadlocks','Die Dreadlocks'])assert.equal(vocabularyAnswerCorrect(candidate,answer),true,answer);
  for(const answer of ['der Dreadlocks','das Dreadlocks','den Dreadlocks','die dreadlocks','Dreadlock'])assert.equal(vocabularyAnswerCorrect(candidate,answer),false,answer);
 }
});
test('plural noun input adds only declared nominatives and does not infer articles or use other cases',()=>{
 for(const declension of [undefined,{nom:[null,null],dat:[null,'den Dreadlocks']}]){
  const word={id:'plural',lemma:'Dreadlocks',pos:'noun',number_restriction:'plural',declension,meaning_en:['dreadlocks']};
  const question=vocabularyQuestions('vocabinput',[word],'en')[0];
  assert.deepEqual(question.acceptedAnswers,['Dreadlocks']);assert.equal(vocabularyAnswerCorrect(question,'die Dreadlocks'),false);
 }
});
