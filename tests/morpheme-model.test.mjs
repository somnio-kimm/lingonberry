import test from 'node:test';
import assert from 'node:assert/strict';
import {createMorphemeModel,MORPHEME_PAGING} from '../web/js/shared/morpheme-model.js';
import {morphemeOriginLabel,morphemeRegisters,morphemeCountLabel} from '../web/js/shared/morpheme-text.js';
const rows=[
 {id:'ab',form:'ab-',variants:['abs-'],kind:'prefix',senses:[{meaning:'away from'}],examples:['absent','abnormal']},
 {id:'ling',form:'-ling',variants:[],kind:'suffix',senses:[{meaning:'small'}],examples:['duckling']},
 {id:'aud',form:'aud-',variants:[],kind:'root',senses:[{meaning:'듣다'}],examples:['audience']},
];
test('search covers variants, explanation meanings and external examples independently of study words',()=>{
 const before=structuredClone(rows),model=createMorphemeModel(rows,[]);
 for(const query of ['ABS-','ＡＢＳ－','away from','abnormal'])assert.deepEqual(model.find({query}).map(r=>r.id),['ab']);
 assert.deepEqual(model.find({query:'듣다'}).map(r=>r.id),['aud']);
 assert.deepEqual(model.find({kind:'suffix'}).map(r=>r.id),['ling']);
 assert.deepEqual(model.find({kind:'prefix',query:'duckling'}),[]);
 assert.equal(model.total,3);assert.deepEqual(rows,before);
});
test('dictionary links retain every headword sense and explicit alias without duplicate entries',()=>{
 const model=createMorphemeModel(rows,[{id:'a',lemma:'absent'},{id:'b',lemma:'address',aliases:['address']},{id:'c',lemma:'address'},{id:'d',lemma:'colour',aliases:['color']}]);
 assert.equal(model.matchingWords('ＡＢＳＥＮＴ')[0].id,'a');assert.deepEqual(model.matchingWords('address').map(word=>word.id),['b','c']);assert.equal(model.matchingWords(' color ')[0].id,'d');assert.deepEqual(model.matchingWords('external'),[]);
 const copy=model.matchingWords('address');copy.pop();assert.equal(model.matchingWords('address').length,2);
});
test('related words page predictably to the end without duplicates or unbounded batches',()=>{
 const examples=Array.from({length:47},(_,i)=>'word '+i),model=createMorphemeModel([{...rows[0],examples}],[]);
 const first=model.relatedWords('ab',0,MORPHEME_PAGING.initialWords),second=model.relatedWords('ab',first.next),last=model.relatedWords('ab',second.next);
 assert.equal(first.words.length,12);assert.equal(second.words.length,20);assert.equal(last.words.length,15);assert.equal(last.hasMore,false);
 assert.deepEqual([...first.words,...second.words,...last.words],examples);
 assert.equal(model.relatedWords('ab',0,100000).words.length,MORPHEME_PAGING.moreWords);
 assert.deepEqual(model.relatedWords('missing').words,[]);assert.equal(model.relatedWords('ab',1000).hasMore,false);
});
test('feature copy preserves origin, usage-label and locale-specific count behaviour',()=>{
 assert.equal(morphemeOriginLabel('Latin','ko'),'라틴어');assert.equal(morphemeOriginLabel('Unknown Language','en'),'Unknown Language');
 assert.deepEqual(morphemeRegisters(['morpheme','obsolete','offensive'],'ko'),['폐어','모욕적']);
 assert.equal(morphemeCountLabel('en',1234,5863),'1,234 Entries · 5,863 Total');assert.equal(morphemeCountLabel('ko',1,10),'1개 항목 · 전체 10개');
});
