import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateExercises,validateExerciseTranslations} from '../web/js/packages/exercises.js';
import {EXERCISE_ROUTES,exerciseAnswerCorrect} from '../web/js/shared/language-exercises.js';
for(const language of ['ja','en'])test(`${language} original exercise content has complete bilingual answers and verified dictionary links`,async()=>{
 const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8')),source=await read(`language-packages/sources/exercises/${language}.json`),core=await read(`language-packages/${language}-core-4.0.0.json`);
 core.exercises=source.exercises.map(({instruction,explanation,...row})=>row);validateExercises(core);assert.ok(source.exercises.length>=40);assert.equal(source.license,'MIT');assert.deepEqual(new Set(source.exercises.map(row=>row.category)),new Set(Object.keys(EXERCISE_ROUTES[language])));
 for(const locale of ['en','ko']){const pair={kind:'explanation',targetLanguage:language,entries:core.entries,exercises:source.exercises.map(row=>({id:row.id,instruction:row.instruction[locale],explanation:row.explanation[locale]}))};validateExercises(pair);validateExerciseTranslations({...core,families:undefined},pair);assert.ok(pair.exercises.every(row=>locale!=='ko'||/[가-힣]/u.test(row.explanation)));}
 for(const row of source.exercises){assert.ok(!(language==='en'?new RegExp('\\b'+row.answer+'\\b','i').test(row.prompt):row.prompt.includes(row.answer)),`${row.id} leaks answer`);if(row.route==='vocabinput')assert.ok(!row.options);}
 if(language==='ja'){const q=source.exercises.find(row=>row.category==='okurigana'&&row.segments?.map(s=>s.text).join('')==='食べる');assert.equal(q.answer,'た');assert.equal(exerciseAnswerCorrect(q,'たべ'),false);assert.equal(exerciseAnswerCorrect(q,'た'),true);}
 else{assert.ok(source.exercises.some(row=>row.options?.includes('elicit')&&row.options.includes('illicit')));assert.ok(source.exercises.some(row=>row.acceptedAnswers?.includes('close')));assert.ok(!source.exercises.some(row=>['stress','formation'].includes(row.category)));}
});
