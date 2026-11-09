import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validatePackage,validateExplanation} from '../web/js/packages/schema.js';
import {assembleStudy} from '../web/js/packages/study.js';
import {studyWords,studyProfiles} from '../web/js/presentation/study-profiles.js';
import {selectWordExample} from '../web/js/shared/word-example.js';
import {createSentenceEngine,findSentenceFocus} from '../web/js/shared/lexicon-sentences.js';
import {createPhrasePractice} from '../web/js/shared/phrase-practice.js';
import {auditReviewedExamples} from '../scripts/content/reviewed-examples.mjs';

const bytes=path=>readFile(new URL('../'+path,import.meta.url)),json=async path=>JSON.parse(await bytes(path)),rows=async path=>(await bytes(path)).toString().trim().split('\n').map(JSON.parse),hash=data=>createHash('sha256').update(data).digest('hex');
const edition='language-packages/sources/examples/editions/5.0.0/',corePath='language-packages/en-core-5.0.0.json';
test('current English downloads bind each explanation to its own core and preserve all primary examples',async()=>{
 const catalog=await json('language-packages/catalog.json');
 for(const locale of ['en','ko']){
  const descriptor=catalog.find(row=>row.id==='en-'+locale);
  const coreDescriptor=catalog.find(row=>row.id==='en-core'&&row.version===descriptor.studyVersion);
  for(const item of [descriptor,coreDescriptor]){
   const data=await bytes(item.url.slice(1));
   assert.equal(data.length,item.bytes);assert.equal(hash(data),item.sha256);validatePackage(JSON.parse(data),item);
  }
  const core=await json(coreDescriptor.url.slice(1)),pair=await json(descriptor.url.slice(1));
  validateExplanation(core,pair);
  const primary=core.entries.filter(row=>row.example),byId=new Map(pair.entries.map(row=>[row.id,row]));
  assert.equal(core.entries.length,core.contentReview.entries);
  assert.equal(core.entries.length-primary.length,core.contentReview.examplesPending);
  assert.equal(core.contentReview.completionReview.fullCoverage,true);
  if(core.contentReview.vocabularyExpansion){
   assert.equal(locale,'en');
   assert.equal(new Set(core.entries.map(row=>row.word.normalize('NFKC').trim().toLowerCase())).size,20000+(core.contentReview.phraseExpansion?.entries||0));
   const baseline=await json('language-packages/en-core-5.2.0.json');
   assert.deepEqual(primary.slice(0,baseline.entries.length),baseline.entries);
   if(core.contentReview.phraseExpansion?.legacyDictionarySourcePath){
    const dictionary=new Set(core.entries.map(row=>row.word.toLowerCase()));
    for(const phrase of 'make a decision|pay attention|heavy rain|strong coffee|take responsibility|break the silence|catch a cold|give advice|do homework|keep a promise|make progress|look up|turn off|put off|find out|pick up|turn on|give up|run out of|take off|carry on|make a mistake|make the bed|make an effort|bring to a conclusion|conduct research|reach a consensus|draw an inference|test a hypothesis|carry out an analysis|come under scrutiny|set a precedent|financial probity|resolve ambiguity|put on|get up|put up with|root out|do away with|rule out|write down|make every effort|subject to scrutiny|take a photo'.split('|'))assert.ok(dictionary.has(phrase),phrase);
   }
   const inventory=core.contentReview.phraseExpansion?.inventory;
   if(inventory){
    const study=assembleStudy(core,pair),practice=createPhrasePractice(study,studyWords(study));
    assert.equal(new Set(practice.map(row=>row.entryId)).size,inventory.added);
    assert.equal(practice.length,inventory.added*2);
    assert.equal(practice.filter(row=>row.gapFill).length,(inventory.sourceExamples+inventory.authoredExamples)*2);
    assert.ok(practice.every(row=>!row.options||row.options.includes(row.answer)));
    assert.ok(core.contentReview.phraseExpansion.entries>10000);
   }
   if(core.contentReview.phraseExpansion?.sourcePath.endsWith('/usage-by-band.tsv')){
    const byId=new Map(core.entries.map(entry=>[entry.id,entry]));
    for(const category of ['idioms','phrasal','collocations']){
     for(const level of studyProfiles.en.levels){
      const questions=core.exercises.filter(row=>row.category===category&&byId.get(row.entryId).level===level&&byId.get(row.entryId).provenance?.sourcePath===core.contentReview.phraseExpansion.sourcePath);
      assert.equal(questions.filter(row=>row.route==='vocabmeaning').length,3);
      assert.equal(questions.filter(row=>row.route==='vocabinput').length,3);
     }
    }
   }
  }else assert.equal(primary.length,core.entries.length);
  const words=studyWords(assembleStudy(core,pair)).filter(word=>word.examples.length),engine=createSentenceEngine(studyProfiles.en);
  assert.equal(new Set(engine.createSentencePool('scramble',words,locale).all(()=>.3).map(row=>row.word.id)).size,primary.length);
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
