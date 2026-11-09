import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {writeTextAtomic} from '../scripts/content/atomic-text.mjs';

test('concurrent ledger readers only see complete previous or replacement content',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'review-ledger-')),path=join(dir,'ledger.jsonl');
 const old=JSON.stringify({version:1,text:'a'.repeat(100000)})+'\n';
 const next=JSON.stringify({version:2,text:'b'.repeat(100000)})+'\n';
 try {
  await writeTextAtomic(pathToFileURL(path),old);
  const writing=writeTextAtomic(path,next);
  for(let i=0;i<20;i++)assert.ok([old,next].includes(await readFile(path,'utf8')));
  await writing;
  assert.equal(await readFile(path,'utf8'),next);
  assert.deepEqual(await readdir(dir),['ledger.jsonl']);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('failed replacement preserves the destination and cleans its temporary file',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'review-ledger-failure-')),path=join(dir,'directory');
 try{
  await mkdir(path);
  await assert.rejects(writeTextAtomic(path,'replacement'),{code:'EISDIR'});
  assert.deepEqual(await readdir(dir),['directory']);
 }finally{await rm(dir,{recursive:true,force:true});}
});
