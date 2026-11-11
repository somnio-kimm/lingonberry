import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {loadEnglishBuildConfig} from '../scripts/content/english-build-config.mjs';

const root=new URL('file:///workspace/lingonberry/');
test('default English build preserves the existing snapshot, version and private stage',async()=>{
 const result=await loadEnglishBuildConfig(root,[]);
 assert.equal(result.version,'7.0.0');assert.equal(result.write,false);
 assert.equal(result.snapshot.href,root.href+'local-data/coverage/four-language-review/english-sense-plan/independent-effective-finalized.jsonl');
 assert.equal(result.audit.href,root.href+'local-data/coverage/four-language-review/english-sense-plan/independent-audit.json');
 assert.equal(result.stage.href,root.href+'local-data/coverage/reviewed-english-release/');
 assert.equal(result.optionalGapDecisions,true);
});

async function configured(t,config,args=['--write']){
 const folder=await mkdtemp(tmpdir()+'/lingonberry-build-config-');
 t.after(()=>rm(folder,{recursive:true,force:true}));
 const file=folder+'/build.json';await writeFile(file,JSON.stringify(config));
 return loadEnglishBuildConfig(root,['--config',pathToFileURL(file).href,...args]);
}

test('an explicit configuration selects immutable review inputs and a new version without mutating defaults',async t=>{
 const result=await configured(t,{schemaVersion:1,version:'7.0.1',audit:'local-data/new/audit.json',snapshot:'local-data/new/reviews.jsonl',
  overlapAudit:'local-data/new/overlap.json',focusDecisions:'local-data/new/foci.jsonl',gapDecisions:'local-data/new/gaps.jsonl',
  gapApprovals:'local-data/new/approvals.jsonl',stage:'local-data/new-release'});
 assert.equal(result.version,'7.0.1');assert.equal(result.write,true);
 for(const [key,path]of Object.entries({audit:'audit.json',snapshot:'reviews.jsonl',overlapAudit:'overlap.json',focusDecisions:'foci.jsonl',gapDecisions:'gaps.jsonl',gapApprovals:'approvals.jsonl'})){
  assert.equal(result[key].href,root.href+'local-data/new/'+path,key);
 }
 assert.equal(result.stage.href,root.href+'local-data/new-release/');assert.equal(result.optionalGapDecisions,false);
 assert.equal((await loadEnglishBuildConfig(root,[])).version,'7.0.0');
});

test('configuration alone never enables writes',async t=>{
 const result=await configured(t,{schemaVersion:1,version:'7.0.1'},[]);
 assert.equal(result.write,false);assert.equal(result.optionalGapDecisions,true);
});

for(const stage of ['web/','language-packages/','local-data/../web/','../outside/','https://example.com/stage/']){
 test('rejects non-private staging path '+stage,async t=>{
  await assert.rejects(configured(t,{schemaVersion:1,stage}),/private local-data|local file/);
 });
}
for(const config of [null,[],{schemaVersion:2},{schemaVersion:1,version:'latest'},{schemaVersion:1,version:7},
 {schemaVersion:1,snapshot:''},{schemaVersion:1,audit:null},{schemaVersion:1,snapshot:'https://example.com/audit.json'},
 {schemaVersion:1,write:true},{schemaVersion:1,overlapAudti:'local-data/typo.json'}]){
 test('rejects malformed English build configuration '+JSON.stringify(config),async t=>{
  await assert.rejects(configured(t,config),/English build|local file/);
 });
}
for(const args of [['--unknown'],['--config'],['--config','--write'],['--config','a.json','--config','b.json'],['--write','--write']]){
 test('rejects malformed command arguments '+args.join(' '),async()=>{
  await assert.rejects(loadEnglishBuildConfig(root,args),/English build/);
 });
}
test('a missing explicitly requested configuration does not silently use defaults',async()=>{
 await assert.rejects(loadEnglishBuildConfig(root,['--config','missing-config.json']),{code:'ENOENT'});
});
