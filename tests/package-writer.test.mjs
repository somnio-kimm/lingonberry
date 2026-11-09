import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {writePackageRelease} from '../scripts/content/package-writer.mjs';
import {validateCatalog} from '../web/js/packages/catalog.js';
const core={schemaVersion:2,kind:'study',id:'en-core',targetLanguage:'en',version:'1.0.0',
 license:{identifier:'CC-BY-4.0',notice:'Original content.'},entries:[{id:'bank',word:'bank',partOfSpeech:'noun'}]};
const pair={schemaVersion:2,kind:'explanation',id:'en-ko',targetLanguage:'en',explanationLanguage:'ko',
 version:'1.0.0',studyVersion:'1.0.0',license:core.license,entries:[{id:'bank',meaning:'은행'}]};
async function fixture(t){
 const path=await mkdtemp(join(tmpdir(),'lingonberry-release-'));
 t.after(()=>rm(path,{recursive:true,force:true}));
 await Promise.all(['language-packages','web'].map(name=>mkdir(join(path,name))));
 const descriptor=pack=>({...Object.fromEntries(['id','kind','targetLanguage','version','explanationLanguage','studyVersion']
  .filter(key=>pack[key]!==undefined).map(key=>[key,pack[key]])),url:'/existing.json',bytes:1,sha256:'0'.repeat(64)});
 const catalog=JSON.stringify([descriptor(core),descriptor(pair)]);
 await Promise.all(['language-packages/catalog.json','web/catalog.json'].map(name=>writeFile(join(path,name),catalog)));
 return {path,root:pathToFileURL(path+'/'),catalog};
}
test('compact packages retain exact integrity descriptors and paired version compatibility',async t=>{
 const {path,root}=await fixture(t);
 await writePackageRelease(root,core,[pair],{compact:true});
 const raw=await readFile(join(path,'language-packages/en-core-1.0.0.json'),'utf8');
 assert.equal(raw,JSON.stringify(core)+'\n');
 const catalog=JSON.parse(await readFile(join(path,'web/catalog.json'),'utf8'));
 validateCatalog(catalog);
 assert.equal(catalog[0].bytes,Buffer.byteLength(raw));
 assert.equal(catalog[0].sha256,createHash('sha256').update(raw).digest('hex'));
 assert.equal(await readFile(join(path,'language-packages/catalog.json'),'utf8'),await readFile(join(path,'web/catalog.json'),'utf8'));
});
test('an invalid byte descriptor leaves catalogues and payload directory untouched',async t=>{
 const {path,root,catalog}=await fixture(t);
 // Provenance is deliberately unconstrained by entry text limits, but the download cap still applies.
 const oversized={...core,entries:[{...core.entries[0],provenance:{padding:'x'.repeat(64*1024*1024)}}]};
 await assert.rejects(writePackageRelease(root,oversized,[pair],{compact:true}),/byte length/);
 assert.deepEqual(await readdir(join(path,'language-packages')),['catalog.json']);
 assert.equal(await readFile(join(path,'web/catalog.json'),'utf8'),catalog);
});
test('a conflicting immutable payload is rejected before any new pair is written',async t=>{
 const {path,root,catalog}=await fixture(t);
 await writeFile(join(path,'language-packages/en-core-1.0.0.json'),'existing release');
 await assert.rejects(writePackageRelease(root,core,[pair]),/Refusing to overwrite/);
 assert.equal(await readFile(join(path,'language-packages/catalog.json'),'utf8'),catalog);
 assert.deepEqual((await readdir(join(path,'language-packages'))).sort(),['catalog.json','en-core-1.0.0.json']);
});

test('an untouched explanation pack retains its compatible older study core',async t=>{
 const {path,root,catalog}=await fixture(t);
 const descriptors=JSON.parse(catalog);
 descriptors.push({...descriptors[1],id:'en-en',explanationLanguage:'en'});
 await writeFile(join(path,'language-packages/catalog.json'),JSON.stringify(descriptors));
 await writePackageRelease(root,{...core,version:'2.0.0'},[{...pair,version:'2.0.0',studyVersion:'2.0.0'}],
  {compact:true,preserveCompatibleCores:true});
 const next=JSON.parse(await readFile(join(path,'web/catalog.json'),'utf8'));
 validateCatalog(next);
 assert.deepEqual(next.filter(row=>row.id==='en-core').map(row=>row.version),['2.0.0','1.0.0']);
 assert.equal(next.find(row=>row.id==='en-en').studyVersion,'1.0.0');
 assert.equal(next.find(row=>row.id==='en-ko').studyVersion,'2.0.0');
});
