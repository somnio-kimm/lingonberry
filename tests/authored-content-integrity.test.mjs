import {createHash} from 'node:crypto';
import {reviewDigest} from '../scripts/content/english-meaning-review.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateExampleRecord,validateCorrection} from '../scripts/content/example-records.mjs';
import {STUDY_LANGUAGES} from '../web/js/shared/language-pairs.js';
const root=new URL('../',import.meta.url);
const json=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
async function records(path){try{return (await readFile(new URL(path,root),'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);}catch(error){if(error.code==='ENOENT')return [];throw error;}}
const catalogue=await json('language-packages/catalog.json');
for(const language of STUDY_LANGUAGES)test(`${language}: mutable authoring records retain valid IDs, focus and source attribution`,async()=>{
 const descriptor=catalogue.find(row=>row.id===language+'-core');
 const core=await json(descriptor.url.slice(1)),entries=new Map(core.entries.map(row=>[row.id,row])),ids=new Set();
 const folder='language-packages/sources/examples/';
 for(const row of await records(folder+language+'-authored.jsonl')){
  assert.ok(!ids.has(row.id),'duplicate authored ID: '+row.id);ids.add(row.id);
  let entry=entries.get(row.id);
  if(!entry&&language==='en'){
   const declared=await json(folder+'en-retirements.json'),migration=declared.records.find(item=>item.id===row.id),retirement=core.retiredEntries.find(item=>item.id===row.id);
   assert.equal(migration?.disposition,'deferred-additional-example');assert.equal(retirement?.sameConcept,true);assert.equal(retirement.replacementId,migration.replacementId);assert.ok(entries.has(migration.replacementId));assert.equal(reviewDigest(row),migration.recordDigest);
   const sourcePath=`language-packages/en-core-${migration.sourceVersion}.json`,bytes=await readFile(new URL(sourcePath,root));assert.equal(createHash('sha256').update(bytes).digest('hex'),declared.sourceCoreSha256);entry=JSON.parse(bytes).entries.find(item=>item.id===row.id);
  }
  validateExampleRecord(row,entry,language);
 }
 const corrections=new Set();
 for(const row of await records(folder+language+'-corrections.jsonl')){
  assert.ok(!corrections.has(row.id),'duplicate correction ID: '+row.id);corrections.add(row.id);
  validateCorrection(row,entries.get(row.id));
  assert.ok(ids.has(row.id),'corrected sense needs its matched authored example: '+row.id);
 }
});
