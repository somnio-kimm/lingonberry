import test from 'node:test';
import assert from 'node:assert/strict';
import {createDictionaryExercises,kanjiAnswer} from '../web/js/shared/dictionary-practice.js';
import {validatePracticeData} from '../web/js/packages/practice-data.js';
import {exerciseAnswerCorrect,createExerciseQuestions} from '../web/js/shared/language-exercises.js';
import {prepareLanguageExercises} from '../web/js/shared/exercise-pools.js';
const word={id:'ja-test',lemma:'食べる',pronunciation:'たべる',studyMeaning:'eat',partOfSpeech:'verb'};
const data={version:1,kanji:[{literal:'食',on:['ショク','ジキ'],kun:['た.べる','く.う']}],forms:[{entryId:word.id,groups:[{formKind:'past',answers:['食べた','たべた'],references:['https://en.wiktionary.org/wiki/食べる']}]}]};
const study={targetLanguage:'ja',explanationLanguage:'en',practiceData:data};
const pack={kind:'study',targetLanguage:'ja',entries:[{id:word.id,partOfSpeech:'verb'}],practiceData:data};
test('character drills accept every explicitly typed reading, preserve long vowels and do not confuse full kun reading with the kanji portion',()=>{
 const rows=createDictionaryExercises(study,[word]),kun=rows.find(row=>row.category==='kunyomi'),on=rows.find(row=>row.category==='onyomi');
 assert.equal(kanjiAnswer('-センチメートル'),'せんちめーとる');assert.ok(exerciseAnswerCorrect(kun,'くう'));assert.ok(exerciseAnswerCorrect(kun,'たべる'));assert.ok(!exerciseAnswerCorrect(kun,'た'));assert.ok(exerciseAnswerCorrect(on,'ジキ'));assert.match(on.context,/need not be the reading used in this word/);assert.equal(on.prompt,'食');
});
test('on and kun classifications come from source attributes even when the scripts overlap',()=>{
 const rows=createDictionaryExercises({...study,practiceData:{version:1,kanji:[{literal:'食',on:['タ'],kun:['タ']}] }},[word]);assert.equal(rows.length,2);for(const row of rows)assert.ok(exerciseAnswerCorrect(row,'た'));
});
test('form drills accept sourced spelling and kana alternatives and specify long causatives',()=>{
 const forms=createDictionaryExercises(study,[word]).filter(row=>row.route==='forms');assert.equal(forms.length,1);assert.ok(exerciseAnswerCorrect(forms[0],'たべた'));
 const long=createDictionaryExercises({...study,practiceData:{version:1,forms:[{entryId:word.id,groups:[{formKind:'causative-passive',answers:['食べさせられる']}]}]}},[word])[0];assert.match(long.instruction,/full, uncontracted/);
});
test('countability prompts make dictionary-wide scope explicit and keep bilingual answer sets distinct',()=>{
 const noun={id:'en-test',lemma:'paper'},base={targetLanguage:'en',practiceData:{version:1,countability:[{entryId:noun.id,labels:['countable','uncountable']}]}};
 for(const locale of ['en','ko']){const row=createDictionaryExercises({...base,explanationLanguage:locale},[noun])[0],question=createExerciseQuestions([row],[noun],'articles','all',locale)[0];assert.equal(question.options.length,4);assert.ok(exerciseAnswerCorrect(question,question.correctOption));assert.equal(row.answer,locale==='en'?'Countable and Uncountable':'가산·불가산 명사');}
});
test('curated forms suppress only the same form, while character and reading directions survive',()=>{
 const curated={id:'curated',entryId:word.id,route:'forms',category:'forms',formKind:'past'};
 const rows=prepareLanguageExercises({...study,exercises:[curated]},[word]);assert.equal(rows.filter(row=>row.formKind==='past').length,1);assert.equal(rows.filter(row=>row.category==='onyomi').length,1);
});
test('practice packages reject cross-language metadata, missing entries, bad URLs and duplicate answer sets',()=>{
 assert.doesNotThrow(()=>validatePracticeData(pack));
 const invalid=[{...pack,targetLanguage:'en'},{...pack,kind:'explanation'},{...pack,entries:[]},{...pack,practiceData:{...data,code:'alert(1)'}},{...pack,practiceData:{version:1,kanji:[{literal:'食',on:['ショク','ショク'],kun:[]}]}},{...pack,practiceData:{version:1,forms:[{entryId:word.id,groups:[{formKind:'past',answers:['食べた'],references:['javascript:alert(1)']}]}]}}];
 for(const value of invalid)assert.throws(()=>validatePracticeData(value),/Invalid language package/);
});
