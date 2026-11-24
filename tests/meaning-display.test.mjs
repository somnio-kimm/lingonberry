import test from 'node:test';
import assert from 'node:assert/strict';
import {meaningDisplayLines,renderStudyMeaning} from '../web/js/shared/meaning-display.js';

test('Chinese glosses lose source and level notes and keep their existing sense breaks',()=>{
 assert.deepEqual(meaningDisplayLines('시(시각 단위) (양사, HSK 1); 점; 지점 (추가 사전 용법)'),['시','점','지점']);
});
test('nested full-width notes are removed without cutting text or splitting commas',()=>{
 assert.deepEqual(meaningDisplayLines(['  red, orange （rare (literary; old)）; blue','blue\n green']),['red, orange','blue','green']);
});
test('meanings remain escaped when rendered as separate lines',()=>{
 assert.equal(renderStudyMeaning('<b>first</b> (old); Fish & chips'), '&lt;b&gt;first&lt;/b&gt;<br>Fish &amp; chips');
});
