import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('correction source verification rejects fabricated or altered evidence',()=>{
 const result=spawnSync('python3',['-m','unittest','discover','-s','tests','-p','test_english_correction_sources.py'],{cwd:fileURLToPath(new URL('../',import.meta.url)),encoding:'utf8',timeout:30000});
 assert.equal(result.status,0,result.stderr+'\n'+result.stdout);
});
