import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,explanationFixture} from './package-fixture.js';
import {assembleStudy} from '../web/js/packages/study.js';
import {germanWords} from '../web/js/presentation/words.js';
import {wordHeading} from '../web/languages/de/js/core/words.js';
import {vocabularyQuestions,snapshotVocabularyQuestion} from '../web/languages/de/js/core/vocabulary-tests.js';
import {articleQuestions} from '../web/languages/de/js/core/grammar-quizzes.js';
import {caseQuestions} from '../web/languages/de/js/core/nominal-grammar.js';
const holidays={id:'holidays-fixture',word:'Ferien',article:'die',partOfSpeech:'noun',level:'A1',grammar:{gender:null,genders:[],number_restriction:'plural',declension:{nom:[null,'die Ferien'],acc:[null,'die Ferien'],dat:[null,'den Ferien'],gen:[null,'der Ferien']}}};
for(const locale of ['en','ko'])test(`plural-only no-singular-gender metadata survives ${locale} assembly and saved headings`,()=>{
 const core=fixture({entries:[holidays]}).data,pair=explanationFixture(core,locale,{entries:[{id:holidays.id,meaning:locale==='en'?'holidays':'방학; 휴가'}]}).data;
 const word=germanWords(assembleStudy(core,pair))[0];assert.equal(word.gender,null);assert.deepEqual(word.genders,[]);assert.match(wordHeading(word),/noun-article plural/);assert.doesNotMatch(wordHeading(word),/feminine/);
 const saved=snapshotVocabularyQuestion(vocabularyQuestions('vocabinput',[word],locale)[0]);assert.equal(saved.word.gender,null);assert.equal(saved.word.number_restriction,'plural');assert.match(wordHeading(saved.word),/noun-article plural/);
 assert.equal(articleQuestions([word]).length,0);const cases=caseQuestions([word]);assert.equal(cases.length,4);assert.ok(cases.every(q=>q.number==='plural'));
});
test('ordinary singular article fallback remains while explicit null never becomes feminine',()=>{
 const word=entry=>germanWords({explanationLanguage:'en',targetLanguage:'de',entries:[{id:'fixture',word:'Frau',article:'die',partOfSpeech:'noun',meaning:'woman',...entry}]})[0];
 assert.equal(word({}).gender,'feminine');assert.match(wordHeading(word({})),/noun-article feminine/);
 assert.equal(word({grammar:{gender:null}}).gender,null);
});
test('plural scope without a gender field does not infer singular feminine from die',()=>{
 const word=germanWords({explanationLanguage:'en',entries:[{...holidays,meaning:'holidays',grammar:{number_restriction:'plural'}}]})[0];assert.equal(word.gender,null);assert.match(wordHeading(word),/noun-article plural/);
});
test('a legacy plural-only word uses plural styling even with old feminine metadata',()=>{
 assert.match(wordHeading({lemma:'Ferien',pos:'noun',article:'die',gender:'feminine',number_restriction:'plural'}),/noun-article plural/);
});
