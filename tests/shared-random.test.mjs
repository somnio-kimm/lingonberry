import test from 'node:test';
import assert from 'node:assert/strict';
import {shuffle,pick} from '../web/js/shared/random.js';
import {shuffle as vocabularyShuffle} from '../web/js/shared/vocabulary.js';
import {shuffleWords} from '../web/languages/de/js/core/words.js';
test('shared shuffle preserves inputs/items and seeded ordering across adapters',()=>{
 const source=['a','b','c'];assert.deepEqual(shuffle(source,()=>0),['b','c','a']);assert.deepEqual(source,['a','b','c']);
 assert.deepEqual(vocabularyShuffle(source,()=>0),shuffleWords(source,()=>0));assert.deepEqual(shuffle([],()=>0),[]);assert.deepEqual(shuffle(['a'],()=>0),['a']);
});
test('random item selection handles empty/single pools with deterministic injection',()=>{
 assert.equal(pick([],()=>0),undefined);assert.equal(pick(['a'],()=>.9),'a');assert.equal(pick(['a','b'],()=>.9),'b');
});
