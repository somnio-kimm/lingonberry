import test from 'node:test';
import assert from 'node:assert/strict';
import {germanWords,chineseWords,wordSyllables} from '../web/js/presentation/words.js';
import {wordHeading} from '../web/languages/de/js/core/words.js';
import {vocabularyInputAnswer} from '../web/languages/de/js/core/vocabulary-tests.js';
import {caseQuestions} from '../web/languages/de/js/core/nominal-grammar.js';
test('archived word fields retain only the selected explanation while preserving stable IDs',()=>{
 const study={explanationLanguage:'ko',entries:[{id:'de-haus',word:'Haus',article:'das',partOfSpeech:'noun',meaning:'집',example:{text:'Das Haus ist klein.',translation:'그 집은 작아요.'}}]};
 const word=germanWords(study)[0];assert.equal(word.id,'de-haus');assert.equal(word.gender,'neuter');assert.deepEqual(word.meaning_en,[]);assert.deepEqual(word.meaning_ko,['집']);assert.equal(word.studyMeaning,'집');assert.equal(word.examples[0].studyTranslation,'그 집은 작아요.');
});
test('Chinese archive columns receive correct per-character pinyin without bundling dictionary data',()=>{
 assert.deepEqual(wordSyllables('书','shū'),[{hanzi:'书',base:'shu',tone:1}]);
 assert.deepEqual(wordSyllables('学习','xuéxí'),[{hanzi:'学',base:'xue',tone:2},{hanzi:'习',base:'xi',tone:2}]);
 const word=chineseWords({explanationLanguage:'en',entries:[{id:'zh-shu',word:'书',pronunciation:'shū',partOfSpeech:'noun',meaning:'book'}]})[0];
 assert.equal(word.meaningEn,'book');assert.equal(word.meaningKo,'');assert.equal(word.studyMeaning,'book');assert.equal(word.id,'zh-shu');
});


test('vocabulary questions use the downloaded explanation locale, independently of interface language',async()=>{
 const {createVocabularyPool,validVocabularyQuestion}=await import('../web/languages/de/js/core/vocabulary-tests.js');
 const words=germanWords({explanationLanguage:'fr',entries:[{id:'de-haus',word:'Haus',article:'das',partOfSpeech:'noun',meaning:'maison'}]});
 const question=createVocabularyPool('vocabinput',words,'en').choose();
 assert.equal(question.locale,'fr');assert.equal(question.prompt,'maison');assert.equal(question.answer,'das Haus');assert.equal(validVocabularyQuestion(question),true);
});

test('German dictionary article notes disappear from headings, answers, forms and examples',()=>{
 const sentence='😀 In diesem Text geht es um das (das) Arabisch.';
 const study={explanationLanguage:'en',entries:[{id:'de-arabisch',word:'(das) Arabisch',article:'das',partOfSpeech:'noun',meaning:'Arabic',
  grammar:{gender:'neuter',dictionaryLemma:'Arabisch',declension:{nom:['das (das) Arabisch',null],dat:['dem (dem) Arabisch',null]},related_forms:['(das) Arabisch','(dem) Arabisch']},
  example:{text:sentence,translation:'This text is about Arabic.',focus:{text:'Arabisch',start:sentence.indexOf('Arabisch')},source:{license:'CC-BY-SA-4.0'}},
  additionalExamples:[{text:'Ich lerne (das) Arabisch (freiwillig).',translation:'I learn Arabic voluntarily.'}]}]};
 const original=structuredClone(study),word=germanWords(study)[0];
 assert.equal(word.id,'de-arabisch');assert.equal(word.lemma,'Arabisch');assert.equal(word.article,'das');
 assert.equal(wordHeading(word),'<span class="noun-article neuter">das</span> Arabisch');
 assert.equal(vocabularyInputAnswer(word),'das Arabisch');
 assert.equal(word.examples[0].de,'😀 In diesem Text geht es um das Arabisch.');
 assert.equal(word.examples[0].text,word.examples[0].de);
 assert.equal(word.examples[0].focus.start,word.examples[0].de.indexOf('Arabisch'));
 assert.equal(word.examples[1].de,'Ich lerne Arabisch (freiwillig).');
 assert.equal(word.examples[0].studyTranslation,original.entries[0].example.translation);
 assert.deepEqual(word.examples[0].source,original.entries[0].example.source);
 assert.deepEqual(word.related_forms,['Arabisch','Arabisch']);
 assert.equal(caseQuestions([word]).find(q=>q.case==='dat').answer,'dem Arabisch');
 assert.deepEqual(study,original);
});

test('German article cleanup leaves unrelated parentheses and non-nouns intact',()=>{
 const entries=[{id:'n',word:'Bank (Sitzmöbel)',partOfSpeech:'noun',article:'die',meaning:'bench'},
  {id:'p',word:'(das) Beispiel',partOfSpeech:'phrase',meaning:'example'},
  {id:'f',word:'(die) Inanna',partOfSpeech:'noun',article:'die',meaning:'Inanna'},
  {id:'m',word:'(der) Shiva',partOfSpeech:'noun',article:'der',meaning:'Shiva'}];
 const words=germanWords({explanationLanguage:'en',entries});
 assert.deepEqual(words.map(w=>w.lemma),['Bank (Sitzmöbel)','(das) Beispiel','Inanna','Shiva']);
});
