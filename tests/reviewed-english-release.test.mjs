import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateCatalog} from '../web/js/packages/catalog.js';
import {validateExplanation} from '../web/js/packages/schema.js';
import {auditEnglishSenseExamples} from '../scripts/content/english-sense-examples.mjs';
import {assembleStudy} from '../web/js/packages/study.js';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const json=async path=>JSON.parse(await read(path));
test('reviewed English release has identical bilingual sense coverage and exact immutable descriptors',async()=>{
 const [catalog,report]=await Promise.all([json('language-packages/catalog.json'),json('language-packages/sources/reviews/en-7.0.4.json')]);
 validateCatalog(catalog);assert.equal(report.review.sourceAndSenseReviewComplete,true);assert.equal(report.uniqueAlignedEntryIds,true);
 const packs=[];
 for(const id of ['en-core','en-en','en-ko']){
  const descriptor=catalog.find(row=>row.id===id&&row.version===report.edition);assert.ok(descriptor);
  const raw=await read(descriptor.url.slice(1));assert.equal(Buffer.byteLength(raw),descriptor.bytes);
  assert.equal(createHash('sha256').update(raw).digest('hex'),descriptor.sha256);packs.push(JSON.parse(raw));
 }
 const [core,...pairs]=packs;
 const previous=await json('language-packages/en-core-5.0.0.json');
 const activeIds=new Set(core.entries.map(row=>row.id)),retired=new Map(core.retiredEntries.map(row=>[row.id,row]));
 for(const row of [...previous.entries,...(previous.retiredEntries||[])])assert.ok(activeIds.has(row.id)||retired.has(row.id),'Old identity missing from active content and history: '+row.id);
 for(const row of retired.values())if(row.sameConcept)assert.ok(activeIds.has(row.replacementId));
assert.equal(core.entries.length,report.entryCountEach);assert.equal(core.contentReview.effectiveReviewSha256,report.review.effectiveReviewSha256);
 for(const pair of pairs){validateExplanation(core,pair);assert.deepEqual(pair.entries.map(row=>row.id),core.entries.map(row=>row.id));
  const audit=auditEnglishSenseExamples(assembleStudy(core,pair));assert.deepEqual(audit.missingExamples,[]);assert.deepEqual(audit.repeatedExamples,[]);assert.deepEqual(audit.combinedMeanings,[]);
 }
 const heads=new Set(core.entries.filter(row=>!['root','prefix','suffix'].includes(row.partOfSpeech)).map(row=>row.word.normalize('NFKC').toLowerCase()));
 assert.ok([...heads].filter(word=>! /\s/u.test(word)).length>=20000);assert.ok([...heads].filter(word=>/\s/u.test(word)).length>10000);
 assert.equal(core.practiceData?.countability,undefined);assert.ok(core.morphemes.every(row=>row.examples.length));
 assert.ok(pairs.every(pair=>pair.entries.every(row=>row.meaning?.trim()&&row.exampleTranslation?.trim())));
});
