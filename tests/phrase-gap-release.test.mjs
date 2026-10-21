import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildPhraseGapRelease} from '../scripts/build-phrase-gap-packages.mjs';
import {exerciseAnswerCorrect} from '../web/js/shared/language-exercises.js';
import {joinGapAnswers} from '../web/js/shared/phrase-gaps.js';
const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const source=await read('language-packages/sources/exercises/phrase-gaps.json');
const release=await read('language-packages/sources/exercises/phrase-gaps-release.json');
test('English gap release preserves vocabulary and old exercises with complete bilingual data',async()=>{
 const previous=await read(`language-packages/en-core-${release.from}.json`),oldPairs=await Promise.all(['en','ko'].map(locale=>read(`language-packages/en-${locale}-${release.from}.json`)));
 const {core,pairs}=buildPhraseGapRelease(previous,oldPairs,source,release.to);
 assert.deepEqual(core.entries,previous.entries);assert.deepEqual(core.morphemes,previous.morphemes);assert.deepEqual(core.exercises.slice(0,previous.exercises.length),previous.exercises);assert.equal(core.exercises.length-previous.exercises.length,36);
 assert.deepEqual(core,await read(`language-packages/en-core-${release.to}.json`));
 for(const [index,pair]of pairs.entries()){assert.deepEqual(pair.entries,oldPairs[index].entries);assert.deepEqual(pair.exercises.slice(0,oldPairs[index].exercises.length),oldPairs[index].exercises);assert.deepEqual(pair,await read(`language-packages/en-${pair.explanationLanguage}-${release.to}.json`));}
 const levels=new Map(previous.entries.map(row=>[row.id,row.level]));
 for(const category of ['collocations','phrasal'])assert.equal(new Set(source.questions.filter(row=>row.category===category).map(row=>levels.get(row.entryId))).size,4);
 for(const row of source.questions){
  const q=core.exercises.find(item=>item.id===row.id+'-input');for(const answers of [row.answers,...row.alternatives])assert.ok(exerciseAnswerCorrect(q,joinGapAnswers(answers)),row.id);
  for(const answers of row.distractors)assert.equal(exerciseAnswerCorrect(q,joinGapAnswers(answers)),false,row.id);
  for(const pair of pairs)for(const suffix of ['-input','-choice']){const translated=pair.exercises.find(item=>item.id===row.id+suffix);assert.ok(translated.instruction&&translated.context&&translated.explanation);}
 }
});
