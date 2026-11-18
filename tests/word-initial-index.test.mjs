import test from 'node:test';
import assert from 'node:assert/strict';
import {createWordInitialIndex,readWordInitial} from '../web/js/shared/word-initial-index.js';

for(const [word,language,expected]of [
 [{lemma:'apple'},'en','A'],[{lemma:'éclair'},'en','E'],[{lemma:'the'},'en','T'],[{lemma:'ßeta'},'de','S'],
 [{lemma:'Ärger',pos:'noun',article:'der'},'de','A'],[{lemma:'der Apfel',pos:'noun'},'de','A'],[{lemma:'die Hoffnung aufgeben',pos:'expression'},'de','D'],
 [{hanzi:'中国',syllables:[{base:'zhōng',tone:1}]},'zh','Z'],[{hanzi:'吕',syllables:[{base:'lü',tone:3}]},'zh','L'],[{hanzi:'中国',pronunciation:'zhong1 guo2'},'zh','Z'],[{hanzi:'未知'},'zh','#'],
 [{lemma:'学校',pronunciation:'がっこう'},'ja','か'],[{lemma:'パンダ',pronunciation:'パンダ'},'ja','は'],[{lemma:'車',pronunciation:'ｸﾙﾏ'},'ja','か'],[{lemma:'キャベツ',pronunciation:'キャベツ'},'ja','か'],[{lemma:'ヴァイオリン',pronunciation:'ヴァイオリン'},'ja','あ'],
 [{lemma:'未知'},'ja','#'],[{lemma:'ありがとう'},'ja','あ'],[{lemma:'東京',pronunciation:'toukyou'},'ja','#'],
])test(`${language}: ${word.lemma||word.hanzi} indexes as ${expected}`,()=>assert.equal(readWordInitial(word,language),expected));

test('initial filtering keeps grouped senses and works within the supplied eligible set only',()=>{
 const apple={id:'apple',lemma:'apple',level:'A1',senses:[{id:'apple-noun'},{id:'apple-verb'}]},boat={id:'boat',lemma:'boat',level:'A1'},advanced={id:'aberrant',lemma:'aberrant',level:'C2'},words=[apple,boat,advanced],before=structuredClone(words),index=createWordInitialIndex('en');
 const eligible=words.filter(word=>word.level==='A1');assert.deepEqual(index.filter(eligible,'A').map(word=>word.id),['apple']);assert.equal(index.filter(eligible,'A')[0].senses.length,2);assert.deepEqual(index.filter(eligible,'all').map(word=>word.id),['apple','boat']);assert.deepEqual(words,before);
});
test('options count currently eligible cards and include an accessible Other group',()=>{
 const words=[{lemma:'apple'},{lemma:'Äther'},{lemma:'boat'},{lemma:'123'}],index=createWordInitialIndex('de'),options=index.readOptions(words);assert.equal(options.find(row=>row.value==='all').count,4);assert.equal(options.find(row=>row.value==='A').count,2);assert.equal(options.find(row=>row.value==='B').count,1);assert.equal(options.find(row=>row.value==='#').count,1);assert.equal(options.find(row=>row.value==='Z').count,0);
});
test('kana options use the declared reading rows instead of Latin spelling or kanji guesses',()=>{
 const index=createWordInitialIndex('ja'),words=[{lemma:'学校',pronunciation:'がっこう'},{lemma:'車',pronunciation:'くるま'},{lemma:'未知'}];assert.deepEqual(index.filter(words,'か').map(word=>word.lemma),['学校','車']);assert.deepEqual(index.filter(words,'#').map(word=>word.lemma),['未知']);assert.deepEqual(index.readOptions(words).map(row=>row.value),['all','あ','か','さ','た','な','は','ま','や','ら','わ','#']);
});
