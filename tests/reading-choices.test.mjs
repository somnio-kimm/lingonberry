import test from 'node:test';
import assert from 'node:assert/strict';
import {createReadingChoices} from '../web/js/shared/reading-choices.js';
const rows=['た','だ','ま','か','タ'].map((answer,i)=>({id:'read-'+i,entryId:'w'+i,route:'vocabinput',category:'reading',answer,instruction:'Type the reading.',acceptedAnswers:i===0?['だ']:[]}));
const words=rows.map((row,i)=>({id:row.entryId,pos:i===4?'noun':'verb'}));
test('reading choices exclude every accepted variant and require same word type for distractors',()=>{
 const choices=createReadingChoices(rows,words);assert.equal(choices.length,4);const first=choices.find(row=>row.entryId==='w0');assert.equal(first.route,'vocabmeaning');assert.ok(!first.options.includes('だ'));assert.ok(!first.options.includes('タ'));assert.equal(first.answer,'た');assert.equal(first.options.length,3);
});
test('do not invent reading choices with insufficient verified distractors',()=>{assert.deepEqual(createReadingChoices(rows.slice(0,1),words),[]);});
test('Korean explanation uses Korean instructions regardless of original imperative wording',()=>{const translated=rows.map(row=>({...row,instruction:'읽기를 적으세요.'}));assert.match(createReadingChoices(translated,words,'ko')[0].instruction,/선택/);});
