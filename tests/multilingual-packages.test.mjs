import {studyProfiles} from '../web/js/presentation/study-profiles.js';
import {allowsExplanation} from '../web/js/shared/language-pairs.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseEditorialRows,packageProfiles} from '../scripts/build-multilingual-packages.mjs';
import {validatePackage,validateExplanation} from '../web/js/packages/schema.js';
const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const catalog=await read('language-packages/catalog.json');
const contents={};
for(const language of Object.keys(packageProfiles)){
 const core=await read(catalog.find(row=>row.id===language+'-core').url.slice(1));
 contents[language]=core;
 for(const locale of ['en','ko'].filter(locale=>allowsExplanation(language,locale)))test(`${language}-${locale}: complete meanings, validated available examples and intact downloads`,async()=>{
  const pair=await read(catalog.find(row=>row.id===language+'-'+locale).url.slice(1));
  validateExplanation(core,pair);
  assert.ok(core.entries.length>=8000);
  for(const data of [core,pair]){
   const descriptor=catalog.find(row=>row.id===data.id),raw=await readFile(new URL('..'+descriptor.url,import.meta.url));
   assert.equal(descriptor.bytes,raw.length);assert.equal(descriptor.sha256,createHash('sha256').update(raw).digest('hex'));
   assert.ok(data.license.identifier.includes('CC-BY-SA-4.0'));
  }
  assert.ok(new Set(core.entries.map(row=>row.word)).size>=7500);
  for(const level of (language==='en'?studyProfiles.en.levels:packageProfiles[language].levels))assert.ok(core.entries.some(row=>row.level===level));
  for(const entry of pair.entries){assert.ok(entry.meaning.trim());if(core.entries.find(word=>word.id===entry.id).example)assert.ok(entry.exampleTranslation.trim());else assert.equal(entry.exampleTranslation,undefined);if(language===locale)assert.notEqual(entry.meaning,core.entries.find(word=>word.id===entry.id).word);}
 });
}
test('English uses four editorial groups while original starter-band metadata stays archived',()=>{
 const profile=packageProfiles.en;
 assert.equal(profile.levels.length,17);assert.equal(profile.levels.at(-1),'9.0');
 assert.equal(contents.en.exam.levelKind,'editorial-study-group');assert.deepEqual(contents.en.exam.levels,studyProfiles.en.levels);
 assert.deepEqual(contents.fr.exam.exams,[{id:'delf',levels:['A1','A2','B1','B2']},{id:'dalf',levels:['C1','C2']}]);
});
test('malformed imported metadata and missing editorial fields fail before installation',()=>{
 for(const extra of [{aliases:'text'},{tags:[3]},{grammar:{acceptedArticles:'la'}},{level:7}])assert.throws(()=>validatePackage({...contents.fr,entries:[{...contents.fr.entries[0],...extra}]}));
 assert.throws(()=>parseEditorialRows('A1\tmissing','fr'));
 const row='A1\tmot\t-\tnoun\tword\t단어\tUn mot.\tA word.\t단어.';assert.throws(()=>parseEditorialRows(row,'fr'));
});
