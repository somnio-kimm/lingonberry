import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assembleStudy} from '../web/js/packages/study.js';
import {studyWords,studyInputAnswers,studyProfiles} from '../web/js/presentation/study-profiles.js';
import {createMorphemeModel} from '../web/js/shared/morpheme-model.js';
const json=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));

test('suffix supplement preserves all existing senses and restores independently checked related words in both explanations',async()=>{
 const [core,before,source]=await Promise.all([
  json('language-packages/en-core-7.0.5.json'),json('language-packages/en-core-7.0.3.json'),
  json('language-packages/sources/exercises/english-suffix-supplement-7.0.5.json'),
 ]);
 assert.equal(core.entries.length,40713);assert.deepEqual(core.entries.slice(0,before.entries.length),before.entries);
 for(const key of ['families','exercises','retiredEntries','reviewInvalidations','practiceData'])assert.deepEqual(core[key],before[key]);
 const updated=new Set(source.morphemeUpdates.map(row=>row.morpheme.id));
 assert.deepEqual(core.morphemes.filter(row=>!updated.has(row.id)),before.morphemes.filter(row=>!updated.has(row.id)));
 for(const locale of ['en','ko']){
  const pair=await json(`language-packages/en-${locale}-7.0.5.json`),previous=await json(`language-packages/en-${locale}-7.0.3.json`);
  assert.deepEqual(pair.entries.slice(0,previous.entries.length),previous.entries);
  const study=assembleStudy(core,pair),words=studyWords(study),model=createMorphemeModel(study.morphemes,words);
  assert.equal(model.total,1503);assert.equal(source.morphemeUpdates.length,14);
  for(const {morpheme} of source.morphemeUpdates){
   const row=model.find({query:morpheme.form}).find(row=>row.id===morpheme.id);assert.ok(row,morpheme.form);
   assert.deepEqual(row.examples,morpheme.examples);
   assert.deepEqual(row.senses.map(sense=>sense.meaning),morpheme.senses.map(sense=>sense[locale]));
   const pos=['-ate','-en','-ify','-fy','-ise','-ize'].includes(row.form)?'verb':'noun';
   for(const example of row.examples)assert.ok(model.matchingWords(example).some(word=>word.pos===pos),row.form+': '+example);
  }
  for(const expected of source.newDictionaryEntries){
   const word=words.find(row=>row.id===expected.id);assert.equal(word.lemma,expected.word);
   assert.equal(word.studyMeaning,locale==='ko'?expected.meaningKo:expected.meaningEn);
   const example=word.examples[0];assert.equal(example.text,expected.sentence);
   assert.equal(example.text.slice(example.focus.start,example.focus.start+example.focus.text.length),word.lemma);
   assert.equal(example.studyTranslation,locale==='ko'?expected.translationKo:expected.sentence);
   for(const spelling of [word.lemma,...word.aliases])assert.ok(studyInputAnswers(word,studyProfiles.en).includes(spelling));
  }
 }
});
