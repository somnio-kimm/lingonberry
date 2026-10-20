import test from 'node:test';
import assert from 'node:assert/strict';
import {selectWordExample} from '../web/js/shared/word-example.js';
const source={creator:'Wiktionary contributors',license:'CC-BY-SA-4.0',url:'https://en.wiktionary.org/wiki/book'};
test('reviewed bilingual examples win over source references without mutating quiz data',()=>{
 const primary={text:'Read this book.',studyTranslation:'이 책을 읽으세요.'},word={lemma:'book',studyExplanationLanguage:'ko',examples:[primary],referenceExamples:[{text:'Another book.',source,sourceEnglishTranslation:'Another book.'}]},before=structuredClone(word);
 assert.equal(selectWordExample(word,'en'),primary);assert.deepEqual(word,before);
});
test('fallback selects a target-bearing source sentence and retains its attribution',()=>{
 const word={lemma:'猫',studyExplanationLanguage:'en',examples:[],referenceExamples:[{text:'犬がいます。',source,sourceEnglishTranslation:'There is a dog.'},{text:'猫がいます。',source,sourceEnglishTranslation:'There is a cat.'}]};
 const chosen=selectWordExample(word,'ja');assert.equal(chosen.text,'猫がいます。');assert.equal(chosen.studyTranslation,'There is a cat.');assert.deepEqual(chosen.source,source);assert.deepEqual(word.examples,[]);
});
test('source English translations never leak into a Korean explanation',()=>{
 const word={lemma:'猫',studyExplanationLanguage:'ko',referenceExamples:[{text:'猫がいます。',source,sourceEnglishTranslation:'There is a cat.'}]};
 assert.equal(selectWordExample(word,'ja').studyTranslation,undefined);assert.equal(selectWordExample({...word,referenceExamples:[]},'ja'),undefined);
});
