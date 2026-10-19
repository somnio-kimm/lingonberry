import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

for (const name of ['sources', 'match', 'reuse']) {
 test(`Wiktionary ${name} preserves source identity and review boundaries`, () => {
  const result = spawnSync('python3', ['-m', 'unittest', 'discover', '-s', 'tests', '-p', `test_wiktionary_${name}.py`], {
   cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stdout + '\n' + result.stderr);
  assert.match(result.stderr, /Ran [1-9][0-9]* tests?/);
 });
}
