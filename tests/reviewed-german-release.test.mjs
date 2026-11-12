import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validatePackage,validateExplanation} from '../web/js/packages/schema.js';
import {assembleStudy} from '../web/js/packages/study.js';
import {germanWords} from '../web/js/presentation/words.js';
import {listeningQuestions,listeningAnswerCorrect} from '../web/languages/de/js/core/listening-tests.js';
import {articleQuestions} from '../web/languages/de/js/core/grammar-quizzes.js';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const json=async path=>JSON.parse(await read(path));
test('reviewed German release accounts for old identities and real answer-version safeguards',async()=>{
 const catalog=await json('language-packages/catalog.json'),packs=[];
 for(const id of ['de-core','de-en','de-ko']){
  const descriptor=catalog.find(row=>row.id===id&&row.version==='4.0.0');assert.ok(descriptor);
  const raw=await read(descriptor.url.slice(1));assert.equal(Buffer.byteLength(raw),descriptor.bytes);
  assert.equal(createHash('sha256').update(raw).digest('hex'),descriptor.sha256);
  const pack=JSON.parse(raw);validatePackage(pack);packs.push(pack);
 }
 const [core,...pairs]=packs,active=new Set(core.entries.map(row=>row.id)),retired=new Map(core.retiredEntries.map(row=>[row.id,row]));
 assert.equal(active.size,11286);assert.equal(retired.size,20);
 assert.equal([...retired.values()].filter(row=>row.sameConcept===true).length,6);
 assert.equal([...retired.values()].filter(row=>row.sameConcept===false).length,12);
 assert.equal([...retired.values()].filter(row=>!row.replacementId).length,2);
 const old=await json('language-packages/de-core-3.2.0.json');
 for(const row of old.entries)assert.ok(active.has(row.id)||retired.has(row.id),'Missing source identity: '+row.id);
 for(const row of retired.values()){assert.ok(!active.has(row.id));if(row.replacementId)assert.ok(active.has(row.replacementId));}
 const minima=new Map(core.reviewInvalidations.map(row=>[row.id,row.minimumVersion]));assert.equal(minima.size,9894);
 for(const id of ['de-ref-fba829170e9567cb5e27','de-ref-b506704bac85c2fcfefa','de-ref-6e30f877859caace8f2a'])assert.equal(minima.get(id),'4.0.0');
 for(const id of ['de-ref-ae99805e91b75d344922','de-ref-b83e99ba6c33578136c4','de-ref-e1bb52f47faff2ed5bd5'])assert.equal(minima.has(id),false);
 for(const pair of pairs){
  validateExplanation(core,pair);assert.deepEqual(pair.entries.map(row=>row.id),core.entries.map(row=>row.id));
  assert.ok(pair.entries.every(row=>row.meaning?.trim()&&row.exampleTranslation?.trim()));
  const words=germanWords(assembleStudy(core,pair));
  for(const [id,alias] of [['de-ref-fba829170e9567cb5e27','wehtun'],['de-ref-b506704bac85c2fcfefa','etc.']]){
   const word=words.find(row=>row.id===id),question=listeningQuestions('listenword',[word],pair.explanationLanguage)[0];
   assert.equal(listeningAnswerCorrect(question,alias),true);
   const sentence=listeningQuestions('listensentence',[word],pair.explanationLanguage)[0];
   assert.equal(listeningAnswerCorrect(sentence,word.examples[0].listeningAlternatives[0]),true);
  }
  const matches=words.find(row=>row.id==='de-sense-zuender-austrian-matches-b44caa58e16a1a1c');
  assert.ok(matches);assert.equal(matches.number_restriction,'plural');assert.equal(articleQuestions([matches]).length,0);
 }
 assert.ok(core.entries.every(row=>row.example?.text?.trim()));
});
