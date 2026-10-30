import test from 'node:test';
import assert from 'node:assert/strict';
import {listeningLabels} from '../web/js/shared/listening-text.js';
test('every Dictation adapter uses complete English/Korean labels with the requested wrong-answer wording',()=>{
 const en=listeningLabels('en'),ko=listeningLabels('ko');assert.deepEqual(Object.keys(en),Object.keys(ko));assert.ok(Object.values(ko).every(text=>/[가-힣]/u.test(text)));assert.equal(en.correctAnswer,'Correct answer');assert.equal(ko.yourAnswer,'오답');assert.equal(ko.hint,'뜻 힌트');en.word='Changed';assert.equal(listeningLabels('en').word,'Word');
});
