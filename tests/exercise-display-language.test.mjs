import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {EXERCISE_INSTRUCTIONS} from '../web/js/shared/exercise-instructions.js';
import {localizeExerciseText} from '../web/js/shared/exercise-text.js';
import {renderExercisePrompt,renderExerciseExplanation} from '../web/js/shared/exercise-view.js';
import {createOkuriganaSpellingQuestion} from '../web/js/shared/japanese-reading.js';
import {createReadingChoices} from '../web/js/shared/reading-choices.js';
import {lexiconText} from '../web/js/shared/lexicon-text.js';
const instruction=html=>html.match(/<p class="vocab-instruction"[^>]*>(.*?)<\/p>/u)?.[1];
test('bundled exercise UI copy covers every supported display language and translates both directions',()=>{
 assert.ok(EXERCISE_INSTRUCTIONS.length>100);
 for(const row of EXERCISE_INSTRUCTIONS){
  for(const language of ['en','ko'])assert.ok(row[language]?.trim());
  assert.ok(EXERCISE_INSTRUCTIONS.some(copy=>copy.ko===localizeExerciseText(row.en,'ko')));
  assert.ok(EXERCISE_INSTRUCTIONS.some(copy=>copy.en===localizeExerciseText(row.ko,'en')));
 }
});
test('Okurigana keeps the reading and meaning without a visible instruction in either display language',()=>{
 for(const source of ['en','ko']){
  const word={id:'long',lemma:'久しい',pronunciation:'ひさしい',pos:'adjective',studyLanguage:'ja',studyExplanationLanguage:source,studyMeaning:source==='en'?'long-standing':'오래되다'},typed=createOkuriganaSpellingQuestion(word,source),choice=createReadingChoices([typed],[word],source)[0];
  for(const display of ['en','ko'])for(const row of [typed,choice]){
   const question={...row,word,locale:source,exercise:true},before=structuredClone(question),html=renderExercisePrompt(question,{uiLanguage:display});
   assert.equal(instruction(html),undefined);assert.ok(html.includes(word.studyMeaning));assert.ok(html.includes('ひさしい'));assert.deepEqual(question,before);
  }
 }
});
test('phrase gaps omit the instruction line and keep localised accessible blank labels',()=>{
 const pairs={en:'Fill each blank with the missing part of the expression.',ko:'각 빈칸에 표현의 빠진 부분을 입력하세요.'};
 for(const source of ['en','ko'])for(const display of ['en','ko']){
  const q={locale:source,word:{studyLanguage:'en'},instruction:pairs[source],gapFill:{parts:['Please ',' it ','.'],answers:['write','down']},context:source==='ko'?'적다':'record'},html=renderExercisePrompt(q,{uiLanguage:display,editable:true});
  assert.equal(instruction(html),undefined);assert.match(html,display==='ko'?/aria-label="빈칸 1"/:/aria-label="Blank 1"/);assert.ok(html.includes('Please '));assert.ok(html.includes(q.context));assert.match(html,/lang="en"/);
 }
});
test('question-specific instructions retain letter and length constraints when display language changes',()=>{
 assert.equal(localizeExerciseText('Type the missing verb beginning with d.','ko'),'d로 시작하는 동사를 입력하세요.');assert.equal(localizeExerciseText('여러 해석 사이의 불명확함을 뜻하는 아홉 글자 명사를 입력하세요.','en'),'Type the nine-letter noun meaning uncertainty between interpretations.');
 assert.equal(localizeExerciseText('Unrecognised original constraint.','ko'),'Unrecognised original constraint.');
});
test('root origin labels follow Display Language while clue meanings and explanations retain their language',()=>{
 const q={exercise:true,category:'roots',locale:'en',word:{studyLanguage:'en'},instruction:'Type the word matching the meaning, using the root or affix clue.',prompt:'Latin · aud — hear\nlisteners',explanation:'Original explanation in English.'},before=structuredClone(q),html=renderExercisePrompt(q,{uiLanguage:'ko'});
 assert.match(html,/라틴어 · aud — hear/);assert.match(html,/listeners/);assert.match(renderExerciseExplanation(q),/lang="en">Original explanation in English/);assert.deepEqual(q,before);
 const reverse=renderExercisePrompt({...q,locale:'ko',prompt:'라틴어 · aud — 듣다\n청중'},{uiLanguage:'en'});assert.match(reverse,/Latin · aud — 듣다/);assert.match(reverse,/청중/);
});
test('retired form conditions and their blank names use UI language without altering the Japanese prompt',()=>{
 const html=renderExercisePrompt({mode:'forms',locale:'en',word:{lemma:'食べる',studyLanguage:'ja'},instruction:'Write the complete て-form.',condition:'Te Form',prompt:'食べる ___'},{uiLanguage:'ko'});assert.match(html,/て형/);assert.match(html,/食べる/);assert.ok(!html.includes('>Te Form<'));
});
test('every current generated/curated specialist instruction resolves in either supported display language',async()=>{
 const {assembleStudy}=await import('../web/js/packages/study.js'),{studyWords}=await import('../web/js/presentation/study-profiles.js'),{prepareLanguageExercises}=await import('../web/js/shared/exercise-pools.js'),json=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url))),catalog=await json('web/catalog.json'),known={en:new Set(EXERCISE_INSTRUCTIONS.map(row=>row.en)),ko:new Set(EXERCISE_INSTRUCTIONS.map(row=>row.ko))};
 for(const language of ['ja','en','ko','es','fr']){
  for(const descriptor of catalog.filter(row=>row.kind==='explanation'&&row.targetLanguage===language)){
   const core=await json(catalog.find(row=>row.id===language+'-core'&&row.version===descriptor.studyVersion).url.slice(1));
   const study=assembleStudy(core,await json(descriptor.url.slice(1))),rows=prepareLanguageExercises(study,studyWords(study));
   for(const text of new Set(rows.map(row=>row.instruction).filter(Boolean)))for(const display of ['en','ko'])assert.ok(known[display].has(localizeExerciseText(text,display)),language+' '+descriptor.explanationLanguage+' '+text);
  }
 }
});
test('exercise UI catalogue reproduces from immutable published copy and bundled generators',async()=>{
 const {exerciseUiPairs}=await import('../scripts/build-exercise-ui-copy.mjs');assert.deepEqual(EXERCISE_INSTRUCTIONS,(await exerciseUiPairs()).map(([en,ko])=>({en,ko})));
});

test('a neutral live answer label does not become Wrong Answer in Korean',()=>{
 assert.equal(lexiconText('ko','Your Answer'),'내 답');assert.equal(lexiconText('ko','Wrong Answer'),'오답');assert.equal(lexiconText('en','Your Answer'),'Your Answer');
});
