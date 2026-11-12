import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validatePackage,validateExplanation} from '../web/js/packages/schema.js';
import {assembleStudy} from '../web/js/packages/study.js';
import {studyWords} from '../web/js/presentation/study-profiles.js';
import {prepareLanguageExercises} from '../web/js/shared/exercise-pools.js';
import {renderExercisePrompt} from '../web/js/shared/exercise-view.js';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const json=async path=>JSON.parse(await read(path));
test('reviewed Japanese release preserves identities and complete bilingual primary examples',async()=>{
 const catalog=await json('language-packages/catalog.json'),report=await json('language-packages/sources/reviews/ja-5.0.0.json'),packs=[];
 for(const id of ['ja-core','ja-en','ja-ko']){
  const descriptor=catalog.find(row=>row.id===id&&row.version===report.edition);assert.ok(descriptor);
  const raw=await read(descriptor.url.slice(1));assert.equal(Buffer.byteLength(raw),descriptor.bytes);
  assert.equal(createHash('sha256').update(raw).digest('hex'),descriptor.sha256);
  const pack=JSON.parse(raw);validatePackage(pack);packs.push(pack);
 }
 const [core,...pairs]=packs,ids=new Set(core.entries.map(row=>row.id)),retired=new Map(core.retiredEntries.map(row=>[row.id,row]));
 assert.equal(ids.size,12031);assert.equal(core.entries.length,report.entryCountEach);
 const previous=await json('language-packages/ja-core-4.5.0.json');
 for(const row of [...previous.entries,...(previous.retiredEntries||[])])assert.ok(ids.has(row.id)||retired.has(row.id),'Missing original identity: '+row.id);
 for(const row of retired.values())if(row.replacementId)assert.ok(ids.has(row.replacementId));
 assert.ok(core.entries.every(row=>row.example?.text?.trim()&&!row.referenceExamples?.length));
 for(const pair of pairs){
  validateExplanation(core,pair);assert.deepEqual(pair.entries.map(row=>row.id),core.entries.map(row=>row.id));
  for(const [i,row] of pair.entries.entries()){
   assert.ok(row.meaning?.trim()&&row.exampleTranslation?.trim());
   assert.equal(row.additionalExampleTranslations?.length||0,core.entries[i].additionalExamples?.length||0);
  }
 }
 assert.equal(report.review.nativeSpeakerCertification,false);
});

test('reviewed reading spans preserve their source sentence in both explanation packs without enabling ambiguous readings',async()=>{
 const core=await json('language-packages/ja-core-5.0.0.json');
 const source=core.exercises.find(row=>row.category==='reading'&&row.route==='vocabinput'&&row.readingFocus?.start>0);
 assert.ok(source);assert.equal(source.prompt.slice(source.readingFocus.start,source.readingFocus.start+source.readingFocus.text.length),source.readingFocus.text);
 for(const locale of ['en','ko']){
  const study=assembleStudy(core,await json(`language-packages/ja-${locale}-5.0.0.json`)),words=studyWords(study),rows=prepareLanguageExercises(study,words),word=words.find(row=>row.id===source.entryId),question=rows.find(row=>row.id===source.id);
  assert.ok(question);assert.equal(question.prompt,source.prompt);assert.deepEqual(question.readingFocus,source.readingFocus);assert.ok(question.context?.trim());
  const html=renderExercisePrompt({...question,word},{uiLanguage:locale});
  assert.ok(html.includes(`<span class="study-reading-target">${source.readingFocus.text}</span>`));
  assert.equal(rows.some(row=>row.category==='reading'&&words.find(word=>word.id===row.entryId)?.lemma==='体中'),false);
 }
});
