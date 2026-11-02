import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validatePackage,validateExplanation} from '../web/js/packages/schema.js';
import {assembleStudy} from '../web/js/packages/study.js';
import {studyWords,studyProfiles} from '../web/js/presentation/study-profiles.js';
import {selectWordExample} from '../web/js/shared/word-example.js';
import {createSentenceEngine,findSentenceFocus} from '../web/js/shared/lexicon-sentences.js';
import {auditReviewedExamples} from '../scripts/content/reviewed-examples.mjs';

const bytes=path=>readFile(new URL('../'+path,import.meta.url)),json=async path=>JSON.parse(await bytes(path)),rows=async path=>(await bytes(path)).toString().trim().split('\n').map(JSON.parse),hash=data=>createHash('sha256').update(data).digest('hex');
const edition='language-packages/sources/examples/editions/5.0.0/',corePath='language-packages/en-core-5.0.0.json';
test('all 12,745 English entries have primary examples and complete Korean translations in valid current downloads',async()=>{
 const catalog=await json('language-packages/catalog.json'),core=await json(corePath);
 assert.equal(core.entries.length,12745);assert.equal(core.contentReview.examplesPending,0);assert.equal(core.contentReview.completionReview.fullCoverage,true);
 for(const id of ['en-core','en-en','en-ko']){const descriptor=catalog.find(row=>row.id===id),data=await bytes(descriptor.url.slice(1));assert.equal(descriptor.version,'5.0.0');assert.equal(data.length,descriptor.bytes);assert.equal(hash(data),descriptor.sha256);validatePackage(JSON.parse(data),descriptor);}
 for(const locale of ['en','ko']){
  const pair=await json(`language-packages/en-${locale}-5.0.0.json`);validateExplanation(core,pair);const byId=new Map(pair.entries.map(row=>[row.id,row]));
  const words=studyWords(assembleStudy(core,pair)),engine=createSentenceEngine(studyProfiles.en);
  assert.equal(new Set(engine.createSentencePool('scramble',words,locale).all(()=>.3).map(row=>row.word.id)).size,core.entries.length);
  for(const word of words){const example=selectWordExample(word,'en');assert.ok(example?.text?.trim(),word.id);assert.equal(example.text,word.examples[0].text);assert.ok(byId.get(word.id).exampleTranslation?.trim());if(locale==='en'){assert.equal(byId.get(word.id).exampleTranslation,example.text);assert.equal(example.studyTranslation,undefined);}else assert.equal(example.studyTranslation,byId.get(word.id).exampleTranslation);}
 }
});
test('English completion retains every existing lexical field, old example, meaning and unrelated exercise',async()=>{
 const core=await json(corePath),old=await json('language-packages/en-core-4.8.0.json');assert.deepEqual(core.entries.map(row=>row.id),old.entries.map(row=>row.id));
 for(let i=0;i<old.entries.length;i++){
  const before=old.entries[i],after=core.entries[i];if(before.example)assert.deepEqual(after,before);
  else{const {example,exampleStatus,...unchanged}=after,{exampleStatus:oldStatus,...original}=before;assert.deepEqual(unchanged,original);assert.ok(findSentenceFocus({lemma:after.word},example,'en'));assert.equal(example.provenance.editorialReview.status,'checked');}
 }
 for(const key of ['morphemes','families','exercises','practiceData','retiredEntries','reviewInvalidations'])assert.deepEqual(core[key],old[key],key);
 for(const [locale,version]of [['en','4.8.0'],['ko','4.9.0']]){
  const current=await json(`language-packages/en-${locale}-5.0.0.json`),previous=await json(`language-packages/en-${locale}-${version}.json`);assert.deepEqual(current.entries.map(row=>row.id),previous.entries.map(row=>row.id));
  for(let i=0;i<previous.entries.length;i++){if(old.entries[i].example)assert.deepEqual(current.entries[i],previous.entries[i]);else{const {exampleTranslation,exampleTranslationProvenance,...now}=current.entries[i],{exampleTranslation:oldText,exampleTranslationProvenance:oldProvenance,...before}=previous.entries[i];assert.deepEqual(now,before);}}
  const extra=previous.license.notice.replace(old.license.notice,'').trim();if(extra)assert.ok(current.license.notice.includes(extra),'Explanation-specific credits survive');
 }
});
test('every new English example has an exact source binding and current independent review',async()=>{
 const report=await json(edition+'en-completion-report.json');for(const file of report.files){const data=await bytes(file.path);assert.equal(data.length,file.bytes);assert.equal(hash(data),file.sha256);}
 for(const source of report.sourcePackages){const data=await bytes(source.url.slice(1));assert.equal(hash(data),source.sha256);assert.equal(data.length,source.bytes);}
 const core=await json('language-packages/en-core-4.8.0.json'),pairs=await Promise.all(['en-4.8.0','ko-4.9.0'].map(name=>json('language-packages/en-'+name+'.json'))),inputs=await rows(edition+'en-completion-bindings.jsonl'),authored=await rows(edition+'en-completion-authored.jsonl'),reviews=await rows(edition+'en-completion-reviews.jsonl'),ownership=await json(edition+'en-completion-ownership.json');
 const audited=auditReviewedExamples({core,pairs,inputs,authored,reviews,ownership});assert.equal(audited.fullCoverage,true);assert.equal(audited.target,11838);assert.equal(audited.independentlyReviewed,11838);assert.equal(report.fullCoverage,true);
});
