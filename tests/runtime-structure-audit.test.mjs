import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {auditRuntime} from '../scripts/audit-runtime-structure.mjs';
test('runtime audit reports clones, unresolved modules and unreachable files without executing source',async t=>{
 const root=await mkdtemp(join(tmpdir(),'lingonberry-structure-'));t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(join(root,'js'));
 for(const [name,body]of [['app.js',"import {used,absent} from './a.js'; import './b.js'; import './missing.js'; void import('./dynamic.js'); console.log(used);"],['a.js','export const used=1;'],['b.js','export const used=1;'],['orphan.js','throw new Error("Must never execute");']])await writeFile(join(root,'js',name),body);
 const report=await auditRuntime(root);assert.equal(report.modules,4);assert.deepEqual(report.exactDuplicateModules,[['js/a.js','js/b.js']]);assert.deepEqual(report.missingImports,[{file:'js/app.js',specifier:'./missing.js'},{file:'js/app.js',specifier:'./dynamic.js'}]);assert.deepEqual(report.unreachableModules,['js/orphan.js']);assert.deepEqual(report.unusedImportCandidates,[{file:'js/app.js',name:'absent'}]);
});
test('shipped runtime has a resolved reachable graph and no exact module clones or zero-reference imports',async()=>{
 const report=await auditRuntime();assert.deepEqual(report.missingImports,[]);assert.deepEqual(report.unreachableModules,[]);assert.deepEqual(report.exactDuplicateModules,[]);assert.deepEqual(report.unusedImportCandidates,[]);
});
