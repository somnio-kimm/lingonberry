import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {prepareConciseChanges,compileConcisePair} from '../scripts/content/concise-translations.mjs';
import {validatePackage,validateExplanation} from '../web/js/packages/schema.js';
const base='language-packages/sources/concise-translations/',bytes=path=>readFile(new URL('../'+path,import.meta.url)),json=async path=>JSON.parse(await bytes(path));
const rows=async path=>(await bytes(path)).toString().trim().split('\n').map(JSON.parse),digest=value=>createHash('sha256').update(value).digest('hex');
test('concise editions reproduce exact source-bound translations while preserving every example, source credit and lexical ID',async()=>{
 const release=await json(base+'release.json'),catalog=await json('language-packages/catalog.json');
 for(const input of [...release.inputs,...release.sourceSnapshots])assert.equal(digest(await bytes(input.path)),input.sha256,input.path);
 const nikl=new Map((await rows(base+'nikl-equivalents.jsonl')).map(row=>[row.id+':'+row.sense,row])),editorial=await rows(base+'ja-editorial.jsonl');
 let changed=0;
 for(const [id,version]of Object.entries(release.outputs)){
  const descriptor=catalog.find(row=>row.id===id),language=descriptor.targetLanguage,source=release.inputs.find(row=>row.path.includes('/'+id+'-')),coreSource=release.inputs.find(row=>row.path.includes('/'+language+'-core-'));
  const core=await json(coreSource.path),old=await json(source.path),actualBytes=await bytes(`language-packages/${id}-${version}.json`),actual=JSON.parse(actualBytes);
  validatePackage(actual,descriptor.version===version?descriptor:undefined);validateExplanation(core,actual);if(descriptor.version===version){assert.equal(digest(actualBytes),descriptor.sha256);assert.equal(actualBytes.length,descriptor.bytes);}assert.equal(actual.version,version);assert.equal(actual.studyVersion,core.version);
  const edits=prepareConciseChanges(core,old,nikl,language==='ja'?editorial:[]),expected=compileConcisePair(core,old,edits,version);assert.deepEqual(actual,expected);changed+=edits.length;
  assert.deepEqual(actual.entries.map(row=>row.id),old.entries.map(row=>row.id));assert.equal(actual.license.identifier,old.license.identifier);assert.ok(actual.license.notice.endsWith(old.license.notice));
  for(let i=0;i<actual.entries.length;i++){
   const {meaning:before,meanings:beforeList,meaningStyle:beforeStyle,...original}=old.entries[i],{meaning,meanings,meaningStyle,...updated}=actual.entries[i];assert.deepEqual(updated,original,'Only meaning/style/list fields may change: '+id+' '+updated.id);
  }
  if(language==='ja')assert.ok(actual.entries.every(row=>row.exampleTranslation),'Japanese full example translations remain complete');
 }
 const report=await json(base+'report.json');assert.equal(report.changed,changed);assert.equal(report.englishSelfDefinitions,'unchanged');
 const self=catalog.find(row=>row.id==='en-en');assert.equal(digest(await bytes(self.url.slice(1))),self.sha256);
 const previousSelf=await json('language-packages/en-en-4.8.0.json'),currentSelf=await json(self.url.slice(1)),previousIds=new Set(previousSelf.entries.map(row=>row.id));assert.deepEqual(currentSelf.entries.filter(row=>previousIds.has(row.id)).map(row=>[row.id,row.meaning,row.meanings,row.meaningStyle]),previousSelf.entries.map(row=>[row.id,row.meaning,row.meanings,row.meaningStyle]),'Later example editions retain English self-definitions');
 const core=await json(catalog.find(row=>row.id==='ja-core').url.slice(1)),byWord=new Map(core.entries.map(row=>[row.word,row.id]));
 for(const [locale,examples]of [['ko',{車:'자동차',猫:'고양이',犬:'개',机:'책상',食べる:'먹다'}],['en',{車:'car',猫:'cat',犬:'dog',机:'desk',食べる:'eat'}]]){
  const pair=await json(catalog.find(row=>row.id==='ja-'+locale).url.slice(1)),byId=new Map(pair.entries.map(row=>[row.id,row.meaning]));for(const [word,meaning]of Object.entries(examples))assert.equal(byId.get(byWord.get(word)),meaning);
 }
});
