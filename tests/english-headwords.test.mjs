import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadwords,groupHeadwords,readHeadwordStatus,readWordSenses} from '../web/js/shared/headwords.js';
const sense=(id,pos,level,meaning,lemma='appeal')=>({id,lemma,pos,level,studyMeaning:meaning,examples:[{text:`Example ${id}`}],search:meaning,searchAliases:[id]});
const request=sense('request','noun','middle','a request'),ask=sense('ask','verb','middle','make a request'),legal=sense('legal','verb','advanced','challenge a ruling');
test('same-spelling noun and verb meanings share one card in each level with their own examples',()=>{
 const words=[request,ask,legal],before=structuredClone(words),groups=groupHeadwords(words);assert.equal(groups.length,2);assert.equal(groups[0].lemma,'appeal');assert.deepEqual(groups[0].senses.map(word=>word.id),['request','ask']);assert.equal(groups[0].studyMeaning,'a request; make a request');assert.deepEqual(groups[0].senses.map(word=>word.examples[0].text),['Example request','Example ask']);assert.equal(groups[1],legal);assert.deepEqual(words,before);
});
test('capitalised words, accents and different spellings are not merged as aliases',()=>{
 const words=[sense('March','noun','middle','month','March'),sense('march','verb','middle','walk','march'),sense('resume','verb','middle','continue','resume'),sense('résumé','noun','middle','CV','résumé')];assert.equal(groupHeadwords(words).length,4);
});
test('filtered meaning cards retain only eligible senses while a raw dictionary link expands within its own level',()=>{
 const model=createHeadwords([request,ask,legal]);assert.deepEqual(readWordSenses(model.group([ask])[0]).map(word=>word.id),['ask']);assert.equal(model.expand(legal),legal);assert.deepEqual(model.expand(request).senses.map(word=>word.id),['request','ask']);const filtered=model.group([request])[0];assert.equal(readWordSenses(filtered).length,1);
});
for(const [statuses,expected]of [[['new','new'],'new'],[['mastered','mastered'],'mastered'],[['new','mastered'],'learning'],[['learning','new'],'learning']])test(`group study status is ${expected} for ${statuses.join('/')}`,()=>{
 const word=groupHeadwords([request,ask])[0],byId=new Map([['request',statuses[0]],['ask',statuses[1]]]);assert.equal(readHeadwordStatus(word,id=>byId.get(id)),expected);
});
test('search covers every grouped meaning and reading alias',()=>{const word=groupHeadwords([request,ask])[0];assert.ok(word.search.includes('make a request'));assert.deepEqual(word.searchAliases,['request','ask']);});

import {readDictionaryMeanings,selectSenseExamples} from '../web/js/shared/word-example.js';
test('each grouped meaning supplies its own selected example and Korean translation',()=>{
 const words=[{...request,studyExplanationLanguage:'ko',examples:[{text:'An appeal for help.',studyTranslation:'도움을 요청하는 호소.'}]},{...ask,studyExplanationLanguage:'ko',examples:[{text:'We appeal for help.',studyTranslation:'우리는 도움을 호소한다.'}]}],before=structuredClone(words),selected=selectSenseExamples(groupHeadwords(words)[0],'en');assert.deepEqual(selected.map(row=>[row.word.id,row.example.text,row.example.studyTranslation]),[['request','An appeal for help.','도움을 요청하는 호소.'],['ask','We appeal for help.','우리는 도움을 호소한다.']]);assert.deepEqual(words,before);
});
test('English self-explanations omit redundant sentence translations independently for every sense',()=>{
 const words=[request,ask].map(word=>({...word,studyExplanationLanguage:'en',examples:[{text:'An example.',studyTranslation:'An example.'}]}));assert.ok(selectSenseExamples(groupHeadwords(words)[0],'en').every(row=>row.example.studyTranslation===undefined));
});

test('meaning numbers follow source senses even when an earlier sense has no example',()=>{
 const words=[
  {...request,studyMeaning:'a request; a plea',examples:[]},
  {...ask,studyMeaning:'to request; to ask'},
  {...legal,level:ask.level},
 ];
 const [card]=groupHeadwords(words);
 assert.deepEqual(readDictionaryMeanings(card,'en'),['a request, a plea','to request, to ask','challenge a ruling']);
 assert.deepEqual(selectSenseExamples(card,'en').filter(row=>row.example).map(row=>[row.number,row.example.text]),[
  [2,'Example ask'],[3,'Example legal'],
 ]);
});

test('an example for a source record with several meanings stays unnumbered',()=>{
 const word={...request,studyMeaning:'a request; a plea\na legal challenge'};
 assert.deepEqual(readDictionaryMeanings(word,'en'),['a request, a plea','a legal challenge']);
 assert.equal(selectSenseExamples(word,'en')[0].number,undefined);
 assert.equal(selectSenseExamples(request,'en')[0].number,undefined);
});

import {createMorphemeModel} from '../web/js/shared/morpheme-model.js';
test('Root Families links use the same same-level dictionary groups',()=>{
 const headwords=createHeadwords([request,ask,legal]),model=createMorphemeModel([{id:'root',form:'appell-',variants:[],kind:'root',senses:[],examples:['appeal']}],headwords.group([request,ask,legal]));const linked=model.matchingWords('appeal');assert.equal(linked.length,2);assert.deepEqual(linked.flatMap(readWordSenses).map(word=>word.id),['request','ask','legal']);
});

test('merged German, Chinese and Japanese headwords retain all parts of speech and per-sense examples',()=>{
 for(const [language,words] of [
  ['de',[{id:'adjective',lemma:'wahrscheinlich',cefr:'A2',pos:'adjective',studyMeaning:'probable',examples:[{de:'Das ist wahrscheinlich.'}]},{id:'adverb',lemma:'wahrscheinlich',cefr:'A2',pos:'adverb',studyMeaning:'probably',examples:[{de:'Wahrscheinlich kommt er.'}]}]],
  ['zh',[{id:'noun',hanzi:'点',hskLevel:2,partOfSpeech:'Noun',studyMeaning:'point',sentences:[{hanzi:'这一点很重要。'}]},{id:'verb',hanzi:'点',hskLevel:2,partOfSpeech:'Verb',studyMeaning:'to order',sentences:[{hanzi:'我们点了两碗面。'}]}]],
  ['ja',[{id:'pronoun',lemma:'何',level:'N5',pos:'pronoun',studyMeaning:'what',examples:[{text:'何が好きですか。'}]},{id:'interjection',lemma:'何',level:'N5',pos:'interjection',studyMeaning:'what?!',examples:[{text:'何？'}]}]],
 ]){
  const [word]=groupHeadwords(words);assert.equal(groupHeadwords(words).length,1);
  assert.deepEqual(readWordSenses(word),words);
  const examples=selectSenseExamples(word,language);
  assert.deepEqual(examples.map(row=>row.word.id),words.map(sense=>sense.id));
  assert.deepEqual(examples.map(row=>row.number),[1,2]);
  assert.equal(new Set(examples.map(row=>row.example.text)).size,2);
 }
});

test('a consolidated Chinese word pairs each explicitly matched usage with only its original sentence',()=>{
 const sentence=(hanzi,studyTranslation)=>({hanzi,studyTranslation});
 const meaning='분; 점; 펀(위안의 100분의 1) (양사, HSK 1); 나누다; 분배하다 (동사, HSK 3); 부분; 점 (명사, HSK 3)';
 const word={id:'hsk1_56',hanzi:'分',studyExplanationLanguage:'ko',studyMeaning:meaning,sentences:[
  sentence('她的分比我高。','그녀의 점수는 내 점수보다 높다.'),
  sentence('我们把蛋糕分成了四块。','우리는 케이크를 네 조각으로 나눴다.'),
  sentence('现在是八点十分。','지금은 여덟 시 십 분이다.'),
 ]};
 assert.deepEqual(readDictionaryMeanings(word,'zh'),['분','점','펀','나누다','분배하다','점수','부분']);
 assert.deepEqual(selectSenseExamples(word,'zh').map(({word:sense,example,number})=>[number,sense.partOfSpeech,sense.studyMeaning,example.text]),[
  [1,'classifier','분','现在是八点十分。'],
  [4,'verb','나누다','我们把蛋糕分成了四块。'],
  [6,'noun','점수','她的分比我高。'],
 ]);
 assert.equal(word.studyMeaning,meaning);
 assert.deepEqual(readDictionaryMeanings({...word,studyMeaning:'새 뜻'},'zh'),['새 뜻']);
});
