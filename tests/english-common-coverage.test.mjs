import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {auditCommonCoverage,readCommonWordLists,expandCommonEnglish} from '../scripts/content/english-common-coverage.mjs';
import {validateExplanation} from '../web/js/packages/schema.js';
import {ENGLISH_LEVELS} from '../web/js/shared/english-levels.js';
import {findSentenceFocus} from '../web/js/shared/lexicon-sentences.js';
const text=path=>readFile(new URL('../'+path,import.meta.url),'utf8'),read=async path=>JSON.parse(await text(path)),base='language-packages/sources/english-common/';
const source=await read(base+'additions.json'),review=await read(base+'level-review.json'),reference=readCommonWordLists(await text(base+'NGSL_12_stats.csv'),await text(base+'SUP_lemmatized.csv'));
test('reference coverage does not confuse derived words, inflections or the month May with its modal verb',()=>{
 const core={entries:[{id:'m',word:'may',level:ENGLISH_LEVELS[0]},{id:'e',word:'economics',level:ENGLISH_LEVELS[1]},{id:'d',word:'dialogue',aliases:['dialog'],level:ENGLISH_LEVELS[1]}]};
 const audit=auditCommonCoverage(core,[{word:'May',caseSensitive:true},{word:'economic'},{word:'dialog'}]);assert.deepEqual(audit.missing,['May','economic']);assert.equal(audit.covered,1);
 assert.throws(()=>readCommonWordLists('Lemma,Changed\na,1','Monday'),/columns/);assert.throws(()=>readCommonWordLists('Lemma,SFI Rank,SFI,Adjusted Frequency per Million (U)\na,1,2,3','Monday'),/Incomplete/);
});
test('4.8 English has complete bounded common-word coverage, preserves old senses and keeps 1000+ expert headwords',async()=>{
 const core=await read('language-packages/en-core-4.8.0.json'),old=await read('language-packages/en-core-4.7.0.json'),report=await read(base+'coverage.json'),release=await read(base+'release.json');
 for(const row of [...source.references,...release.inputs])assert.equal(createHash('sha256').update(await readFile(new URL('../'+row.path,import.meta.url))).digest('hex'),row.sha256,row.path);
 assert.equal(core.entries.length,old.entries.length+389);assert.deepEqual(core.entries.slice(0,old.entries.length).map(row=>[row.id,row.word,row.partOfSpeech,row.example,row.provenance]),old.entries.map(row=>[row.id,row.word,row.partOfSpeech,row.example,row.provenance]));
 for(const key of ['exercises','families','morphemes','practiceData','retiredEntries','reviewInvalidations'])assert.deepEqual(core[key],old[key]);
 const audit=auditCommonCoverage(core,reference);assert.equal(audit.referenceEntries,2861);assert.equal(audit.covered,2861);assert.deepEqual(audit.missing,[]);assert.deepEqual(audit.upperOnly,[]);assert.deepEqual(report.decisions,audit.decisions);
 assert.ok(new Set(core.entries.filter(row=>row.level===ENGLISH_LEVELS[3]).map(row=>row.word.toLowerCase())).size>=1000);
 for(const word of ['address','the','and','email','Monday','March','May','eleven','trousers','parent'])assert.ok(core.entries.some(row=>row.word===word&&row.level===ENGLISH_LEVELS[0]),word);
 for(const locale of ['en','ko']){const pair=await read(`language-packages/en-${locale}-4.8.0.json`),before=await read(`language-packages/en-${locale}-4.7.0.json`);validateExplanation(core,pair);assert.deepEqual(pair.entries.slice(0,before.entries.length),before.entries);assert.match(pair.license.notice,/Browne, C\., Culligan, B\., and Phillips, J\./);assert.ok(pair.license.links.some(row=>row.url===source.sourcePage));
  if(locale==='en'){const {assembleStudy}=await import('../web/js/packages/study.js'),{studyWords}=await import('../web/js/presentation/study-profiles.js'),{prepareLanguageExercises}=await import('../web/js/shared/exercise-pools.js');const study=assembleStudy(core,pair),words=studyWords(study),byId=new Map(words.map(row=>[row.id,row])),questions=prepareLanguageExercises(study,words);for(const level of ENGLISH_LEVELS)for(const category of ['collocations','phrasal','roots'])assert.ok(questions.some(row=>row.category===category&&byId.get(row.entryId).level===level),level+': '+category);}
  const translated=new Map(pair.entries.map(row=>[row.id,row]));for(const row of source.entries){assert.ok(translated.get(row.id).meaning&&translated.get(row.id).exampleTranslation);assert.ok(findSentenceFocus({lemma:row.word},{text:row.example.text},'en'));}
 }
});
test('common-level decisions reject changed stored senses before publishing',async()=>{
 const core=await read('language-packages/en-core-4.7.0.json'),pairs=await Promise.all(['en','ko'].map(locale=>read(`language-packages/en-${locale}-4.7.0.json`))),entry=pairs[0].entries.find(row=>row.id===review.decisions[0].id);entry.meaning='A changed meaning.';
 assert.throws(()=>expandCommonEnglish(core,pairs,source,review,reference),/Stale common-sense level review/);
});
