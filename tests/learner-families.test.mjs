import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateExplanation} from '../web/js/packages/schema.js';
import {assembleStudy} from '../web/js/packages/study.js';
import {studyWords} from '../web/js/presentation/study-profiles.js';
import {prepareLanguageExercises} from '../web/js/shared/exercise-pools.js';
import {exerciseModes} from '../web/js/shared/language-exercises.js';
const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
test('learner family release preserves vocabulary and confusables with separately translated root meanings',async()=>{
 const release=await read('language-packages/sources/exercises/learner-word-families-release.json');
 const source=await read('language-packages/sources/exercises/learner-word-families.json');
 const bytes=await readFile(new URL('../language-packages/sources/exercises/learner-word-families.json',import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),release.sourceSha256);
 const before=await read(`language-packages/en-core-${release.from}.json`),core=await read(`language-packages/en-core-${release.to}.json`);
 assert.deepEqual(core.entries,before.entries);assert.equal(core.families.length,27);
 assert.deepEqual(core.exercises.filter(row=>row.category==='confusables'),before.exercises.filter(row=>row.category==='confusables'));
 assert.equal(core.practiceData.rootFamilies,undefined);
 assert.deepEqual(new Set(core.families.map(row=>row.kind)),new Set(['prefix','suffix','root']));
 assert.ok(core.families.every(row=>!row.root.includes('*')));
 assert.ok(core.families.some(row=>row.root==='aud'));assert.ok(core.families.some(row=>row.root==='-less'));
 for(const locale of ['en','ko']){
  const pair=await read(`language-packages/en-${locale}-${release.to}.json`);validateExplanation(core,pair);
  for(const family of pair.families)assert.equal(family.meaning,source.families.find(row=>row.id===family.id).meaning[locale]);
  const study=assembleStudy(core,pair),rows=prepareLanguageExercises(study,studyWords(study));
  assert.ok(rows.some(row=>row.category==='roots'));assert.ok(!rows.some(row=>row.category==='confusables'));
  assert.ok(!rows.some(row=>row.category==='articles'));
 }
 assert.ok(exerciseModes('en').roots);assert.equal(exerciseModes('en').confusables,undefined);
});
