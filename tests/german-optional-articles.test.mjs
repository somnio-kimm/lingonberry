import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,explanationFixture} from './package-fixture.js';
import {assembleStudy} from '../web/js/packages/study.js';
import {germanWords} from '../web/js/presentation/words.js';
import {vocabularyQuestions,vocabularyAnswerCorrect,snapshotVocabularyQuestion} from '../web/languages/de/js/core/vocabulary-tests.js';
import {caseQuestions,nominalAnswerCorrect,adjectiveQuestions,snapshotGrammarQuestion} from '../web/languages/de/js/core/nominal-grammar.js';
import {clozeQuestions,clozeOptions} from '../web/languages/de/js/core/sentence-quizzes.js';
const language={id:'language-fixture',word:'Deutsch',article:'das',partOfSpeech:'noun',level:'A1',grammar:{article_optional:true,gender:'neuter',number_restriction:'singular',related_forms:['de','deu'],declension:{nom:['Deutsch / das Deutsche',null],acc:['Deutsch / das Deutsche',null],dat:['Deutsch / dem Deutschen',null],gen:['Deutschs / des Deutsch / des Deutschs / des Deutschen',null]}},example:{text:'Sie übersetzt aus dem Deutschen.'}};
for(const locale of ['en','ko'])test(`explicit optional articles survive ${locale} package assembly, typing and saved questions`,()=>{
 const core=fixture({entries:[language]}).data,pair=explanationFixture(core,locale,{entries:[{id:language.id,meaning:locale==='en'?'German (language)':'독일어',exampleTranslation:locale==='en'?'She translates from German.':'그녀는 독일어로 된 글을 번역한다.'}]}).data;
 const word=germanWords(assembleStudy(core,pair))[0],q=vocabularyQuestions('vocabinput',[word],locale)[0];
 assert.equal(q.answer,'Deutsch');assert.deepEqual(q.acceptedAnswers,['Deutsch','das Deutsch','das Deutsche']);
 for(const candidate of [q,snapshotVocabularyQuestion(q)]){
  assert.equal(candidate.word.article_optional,true);
  for(const good of ['Deutsch','das Deutsch','Das Deutsche'])assert.equal(vocabularyAnswerCorrect(candidate,good),true);
  for(const bad of ['die Deutsch','Deutsche','Deutschen','de','deu'])assert.equal(vocabularyAnswerCorrect(candidate,bad),false);
 }
 const questions=caseQuestions([word]);assert.equal(questions.length,4);
 for(const [grammaticalCase,good]of [['nom',['Deutsch','das Deutsche']],['acc',['Deutsch','das Deutsche']],['dat',['Deutsch','dem Deutschen']],['gen',['Deutschs','des Deutsch','des Deutschs','des Deutschen']]]){
  const q=questions.find(q=>q.case===grammaticalCase);for(const candidate of [q,snapshotGrammarQuestion(q)])for(const answer of good)assert.equal(nominalAnswerCorrect(candidate,answer),true);
 }
 assert.equal(nominalAnswerCorrect(questions.find(q=>q.case==='dat'),'das Deutsche'),false);
 const cloze=clozeQuestions([word])[0];assert.equal(cloze.answer,'Deutschen');assert.equal(clozeOptions(cloze,[word])[0].text,'Deutschen');
 assert.equal(adjectiveQuestions([{id:'good',lemma:'gut',pos:'adjective'}],[word]).length,0,'Bare optional phrases must not become article-less weak adjective frames');
});
test('ordinary nouns and proper-noun labels alone still require their reviewed article',()=>{
 for(const word of [{id:'book',lemma:'Buch',pos:'noun',article:'das',meaning_en:['book']},{id:'language',lemma:'Deutsch',pos:'noun',article:'das',proper_noun:true,meaning_en:['German']}]){
  const q=vocabularyQuestions('vocabinput',[word],'en')[0];assert.equal(q.answer,'das '+word.lemma);assert.equal(vocabularyAnswerCorrect(q,word.lemma),false);
 }
});
test('bare-first case inventories are not enabled without the explicit reviewed flag',()=>{
 const word=germanWords({targetLanguage:'de',explanationLanguage:'en',entries:[{...language,meaning:'German',grammar:{...language.grammar,article_optional:undefined}}]})[0];
 assert.equal(caseQuestions([word]).length,0);
});
