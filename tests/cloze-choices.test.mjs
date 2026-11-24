import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseClozeOptions} from '../web/js/shared/cloze-choices.js';
import {createSentenceEngine} from '../web/js/shared/lexicon-sentences.js';

test('fresh Cloze selection draws across alphabetically clustered same-POS entries',()=>{
 const words=['observe','take','talk','teach','tell','think','try','visit','walk','write','table'].map(lemma=>({
  id:lemma,lemma,pos:lemma==='table'?'noun':'verb',studyMeaning:lemma,
  examples:lemma==='observe'?[{text:'They observe the birds.',studyTranslation:'그들은 새를 관찰한다.'}]:[],
 }));
 const pool=createSentenceEngine({id:'en'}).createSentencePool('cloze',words,'ko');
 for(const random of [()=>0,()=>0.15,()=>0.98]){
  const question=pool.all(random)[0],choices=question.options.map(option=>option.text[0]);
  assert.equal(choices.length,4);
  assert.equal(new Set(choices).size,4);
  assert.ok(question.options.every(option=>option.type==='verb'));
  assert.equal(question.options.find(option=>option.id==='observe').text,'observe');
 }
});

test('a fixed expression bank drops excess same-initial options while preserving the correct ID',()=>{
 const correct={id:'1',text:'observe … closely'};
 const choices=['take … out','turn … down','think … over'].map((text,index)=>({id:String(index+2),text}));
 const result=chooseClozeOptions(correct,choices,option=>option,()=>0);
 assert.equal(result.length,2);
 assert.ok(result.includes(correct));
});
