import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceMistakeBalance} from '../web/js/shared/mistake-balance.js';
import {wrongAnswerCount as germanCount} from '../web/languages/de/js/core/wrong-count.js';
import {wrongAnswerCount as chineseCount} from '../web/languages/zh/js/services/wrong-count.js';
test('mistake balance increments, repays reviews, ignores skips and cannot become negative',()=>{
 let balance=0;
 for(const [attempt,expected] of [[{correct:false},1],[{correct:false},2],[{correct:true,review:false},2],[{correct:true,skipped:true},2],[{correct:true},1],[{correct:true},0],[{correct:true},0]]){balance=advanceMistakeBalance(balance,attempt);assert.equal(balance,expected);}
});
test('language adapters preserve distinct initial histories and dismissal rules',()=>{
 const attempts=[{correct:false},{correct:false},{correct:true,review:false},{correct:true}];
 assert.equal(germanCount(attempts),1);assert.equal(germanCount(attempts,1),0);
 assert.equal(chineseCount({}),1);assert.equal(chineseCount({retests:[{correct:false},{correct:true}]}),1);
 assert.equal(chineseCount({retests:[{correct:true,review:false}]}),0);
});
