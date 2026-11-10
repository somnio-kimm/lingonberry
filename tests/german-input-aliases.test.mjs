import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,explanationFixture} from './package-fixture.js';
import {assembleStudy} from '../web/js/packages/study.js';
import {germanWords} from '../web/js/presentation/words.js';
import {vocabularyQuestions,vocabularyAnswerCorrect,snapshotVocabularyQuestion} from '../web/languages/de/js/core/vocabulary-tests.js';
const dinosaur={id:'dinosaur',word:'Diplodocus',aliases:['Diplodokus'],article:'der',partOfSpeech:'noun',level:'C2',grammar:{source_related_forms:['Diplodoken'],dictionaryLemma:'source-label-only'}};
for(const locale of ['en','ko'])test(`German ${locale} Word Input accepts declared spelling aliases with an article through assembly and Review`,()=>{
 const core=fixture({entries:[dinosaur]}).data,pair=explanationFixture(core,locale,{entries:[{id:dinosaur.id,meaning:locale==='en'?'diplodocus':'디플로도쿠스'}]}).data;
 const word=germanWords(assembleStudy(core,pair))[0],q=vocabularyQuestions('vocabinput',[word],locale)[0];
 assert.equal(q.answer,'der Diplodocus');assert.deepEqual(q.acceptedAnswers,['der Diplodocus','der Diplodokus']);
 for(const candidate of [q,snapshotVocabularyQuestion(q)]){
  for(const answer of ['der Diplodocus','der Diplodokus'])assert.equal(vocabularyAnswerCorrect(candidate,answer),true);
  for(const wrong of ['Diplodocus','Diplodokus','die Diplodokus','der Diplodoken','der source-label-only'])assert.equal(vocabularyAnswerCorrect(candidate,wrong),false);
 }
});
test('German spelling aliases combine only declared noun articles and do not add plural/source forms',()=>{
 const word={id:'alias',lemma:'Joghurt',aliases:['Jogurt','Jogurt'],pos:'noun',article:'der',accepted_articles:['das'],meaning_en:['yoghurt'],related_forms:['Joghurts']};
 const q=vocabularyQuestions('vocabinput',[word],'en')[0];
 assert.deepEqual(q.acceptedAnswers,['der Joghurt','der Jogurt','das Joghurt','das Jogurt']);
 assert.equal(vocabularyAnswerCorrect(q,'das Jogurt'),true);assert.equal(vocabularyAnswerCorrect(q,'die Jogurt'),false);assert.equal(vocabularyAnswerCorrect(q,'der Joghurts'),false);
});
test('German non-noun aliases are explicit answers without adding an article',()=>{
 const word={id:'spelling',lemma:'aufwendig',aliases:['aufwändig'],pos:'adjective',meaning_en:['elaborate']};
 const q=vocabularyQuestions('vocabinput',[word],'en')[0];
 assert.equal(q.answer,'aufwendig');assert.equal(vocabularyAnswerCorrect(q,'aufwändig'),true);assert.equal(vocabularyAnswerCorrect(q,'der aufwändig'),false);
});
