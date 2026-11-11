import test from 'node:test';
import assert from 'node:assert/strict';
import {practiceSentences} from '../web/languages/zh/js/services/sentence-focus.js';
import {clozeStudyWords} from '../web/languages/zh/js/services/vocabulary-tests.js';
import {snapshotQuestion,resolveWrongQuestion,makeReviewQueue} from '../web/languages/zh/js/services/wrong-review.js';
import {chineseWords} from '../web/js/presentation/words.js';
import {validatePackage} from '../web/js/packages/schema.js';
import {fixture} from './package-fixture.js';
const example={hanzi:'我读书。',pinyin:'wo3 du2 shu1',focus:{start:2,text:'书'}};
const reference={...example,practiceEligible:false};
const word={id:'book',hanzi:'书',partOfSpeech:'Noun',hskLevel:1,syllables:[{hanzi:'书',base:'shu',tone:1}],sentences:[reference]};
const other={...word,id:'water',hanzi:'水',sentences:[]};
test('reference-only Chinese sentences cannot enter Cloze or Scramble pools',()=>{
 assert.deepEqual(practiceSentences(word),[]);
 assert.deepEqual(clozeStudyWords([word,other]),[]);
 assert.deepEqual(word.sentences,[reference]);
});
test('mixed examples select eligible sentences and keep legacy examples available',()=>{
 const clozeExcluded={...example,clozeEligible:false};
 const mixed={...word,sentences:[reference,clozeExcluded,example,{...example,practiceEligible:true}]};
 assert.deepEqual(practiceSentences(mixed),mixed.sentences.slice(1));
 assert.deepEqual(practiceSentences(mixed,{cloze:true}),mixed.sentences.slice(2));
 assert.ok(clozeStudyWords([mixed,other]).includes(mixed));
 assert.deepEqual(practiceSentences({...word,sentences:[]}),[]);
});
for(const mode of ['cloze','scramble'])test(`reference-only saved ${mode} remains readable without retest or history mutation`,()=>{
 const record={id:'old',mode,wordId:word.id,question:snapshotQuestion(mode,word,reference)},before=JSON.stringify(record);
 assert.equal(resolveWrongQuestion(record,[word]).sentence.hanzi,reference.hanzi);
 assert.equal(resolveWrongQuestion(record,[word]).retestEligible,false);
 const queue=makeReviewQueue([record],[word]);assert.deepEqual(queue.items,[]);assert.deepEqual(queue.unavailable,[record]);
 assert.equal(JSON.stringify(record),before);
});
test('a Cloze-only exclusion still permits Scramble and cannot silently reconstruct a Cloze',()=>{
 const sentence={...example,clozeEligible:false},current={...word,sentences:[sentence]};
 assert.equal(makeReviewQueue([{id:'a',mode:'cloze',wordId:word.id,question:snapshotQuestion('cloze',current,sentence)}],[current]).items.length,0);
 assert.equal(makeReviewQueue([{id:'b',mode:'scramble',wordId:word.id,question:snapshotQuestion('scramble',current,sentence)}],[current]).items.length,1);
 assert.equal(resolveWrongQuestion({mode:'cloze',wordId:word.id},[current]),null);
});
test('dictionary conversion preserves reference examples and their translations',()=>{
 const study={targetLanguage:'zh',explanationLanguage:'ko',entries:[{id:'book',word:'书',partOfSpeech:'Noun',level:'1',pronunciation:'shū',meaning:'책',example:{text:example.hanzi,translation:'나는 책을 읽는다.'},additionalExamples:[{text:'这是书。',translation:'이것은 책이다.',practiceEligible:false}]}]};
 const converted=chineseWords(study)[0];assert.equal(converted.sentences.length,2);
 assert.equal(converted.sentences[1].studyTranslation,'이것은 책이다.');assert.equal(converted.sentences[1].practiceEligible,false);
});
for(const field of ['practiceEligible','clozeEligible'])test(`additional example ${field} must be boolean`,()=>{
 const pack=fixture({entries:[{id:'book',word:'书',partOfSpeech:'Noun',additionalExamples:[{text:'我读书。',[field]:false}]}]}).data;
 assert.doesNotThrow(()=>validatePackage(pack));pack.entries[0].additionalExamples[0][field]='false';
 assert.throws(()=>validatePackage(pack),/eligibility/);
});

test('a saved reference Dictation sentence stays readable but is not retested',async()=>{
 const {listeningQuestions}=await import('../web/languages/zh/js/services/listening-tests.js');
 const question=listeningQuestions('listensentence',[{...word,sentences:[example]}],'en')[0];
 question.sentence.practiceEligible=false;
 const record={id:'old-listening',mode:'listensentence',wordId:word.id,question},before=JSON.stringify(record);
 assert.equal(resolveWrongQuestion(record,[word]).spokenText,example.hanzi);
 assert.equal(makeReviewQueue([record],[word]).items.length,0);assert.equal(JSON.stringify(record),before);
});
test('reference sentence exclusions do not disable word pronunciation practice',()=>{
 for(const mode of ['pinyin','tone'])assert.equal(makeReviewQueue([{id:mode,mode,wordId:word.id,question:snapshotQuestion(mode,word)}],[word]).items.length,1);
});
