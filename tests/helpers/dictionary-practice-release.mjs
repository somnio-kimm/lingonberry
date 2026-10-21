import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assembleStudy} from '../../web/js/packages/study.js';
import {studyWords} from '../../web/js/presentation/study-profiles.js';
import {prepareLanguageExercises} from '../../web/js/shared/exercise-pools.js';
const read=name=>JSON.parse(fs.readFileSync(new URL('../../'+name,import.meta.url)));
export function testDictionaryPracticeRelease(language,version,previous){test(`${language}: broad practice preserves all vocabulary IDs and separately validated explanations`,()=>{
 const core=read(`language-packages/${language}-core-${version}.json`),before=read(`language-packages/${language}-core-${previous}.json`),ledger=read(`language-packages/sources/exercises/${language}-practice-coverage.json`);
 assert.deepEqual(core.entries.map(row=>row.id),before.entries.map(row=>row.id));assert.equal(new Set(ledger.entries.map(row=>row.entryId)).size,core.entries.length);
 for(const locale of ['en','ko']){
  const pair=read(`language-packages/${language}-${locale}-${version}.json`),oldPair=read(`language-packages/${language}-${locale}-${previous}.json`);assert.deepEqual(pair.entries,oldPair.entries);
  const study=assembleStudy(core,pair),words=studyWords(study),rows=prepareLanguageExercises(study,words);assert.equal(new Set(rows.map(row=>row.id)).size,rows.length);
  const byId=new Map(words.map(word=>[word.id,word]));for(const level of new Set(words.map(word=>word.level))){const types=new Set(rows.filter(row=>byId.get(row.entryId).level===level).map(row=>row.category));for(const category of language==='ja'?['reading','onyomi','kunyomi','okurigana','forms','particles','counters','transitivity','kanji']:['collocations','phrasal','patterns','roots'])assert.ok(types.has(category),`${level}: missing ${category}`);}
 }
 if(language==='ja'){
  const actual=new Set(core.practiceData.kanji.map(row=>row.literal));for(const entry of core.entries)for(const char of entry.word.match(/\p{Script=Han}/gu)||[])assert.ok(char==='々'||actual.has(char),`missing ${char}`);
  const formIds=new Set(core.practiceData.forms.map(row=>row.entryId));assert.ok(core.entries.filter(row=>['verb','adjective'].includes(row.partOfSpeech)).every(row=>formIds.has(row.id)));
  const corrected=core.entries.find(row=>row.word==='見苦しい');assert.equal(corrected.pronunciation,'みぐるしい');assert.ok(!corrected.aliases.includes('みくるしい'));assert.ok(core.reviewInvalidations.some(row=>row.id===corrected.id&&row.minimumVersion===version));
 }else{
  assert.ok(core.practiceData.countability.length>7500);assert.ok(core.practiceData.rootFamilies.length>600);
  assert.ok(core.practiceData.countability.filter(row=>row.scope==='selected-sense').length>=34);
 }
});

}
