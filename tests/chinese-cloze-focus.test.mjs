import test from 'node:test';
import assert from 'node:assert/strict';
import {findSentenceTarget} from '../web/languages/zh/js/services/sentence-focus.js';
import {Pinyin} from '../web/languages/zh/js/services/pinyin.js';
import {clozeStudyWords} from '../web/languages/zh/js/services/vocabulary-tests.js';
import {snapshotQuestion,resolveWrongQuestion,makeReviewQueue} from '../web/languages/zh/js/services/wrong-review.js';
// Independently written repeated-word fixture, not imported learner content.
const sentence={hanzi:'他看书，我读书。',pinyin:'ta1 kan4 shu1 wo3 du2 shu1',focus:{start:6,text:'书'}};
const word={id:'book',hanzi:'书',partOfSpeech:'Noun',hskLevel:1,syllables:[{hanzi:'书',base:'shu',tone:1}],sentences:[sentence]};
const other={...word,id:'water',hanzi:'水'};
test('a reviewed repeated-word target overrides the legacy first match',()=>{
 assert.deepEqual(findSentenceTarget(sentence,'书'),{start:6,text:'书'});
 const {focus,...legacy}=sentence;assert.deepEqual(findSentenceTarget(legacy,'书'),{start:2,text:'书'});
 assert.equal(findSentenceTarget({...sentence,focus:{text:'书'}},'书'),null);
});
test('invalid explicit positions do not fall back to a different occurrence or enter Cloze',()=>{
 for(const focus of [{start:1,text:'书'},{start:6,text:'水'},{start:-1,text:'书'},null,{}]){
  const invalid={...word,sentences:[{...sentence,focus}]};
  assert.equal(findSentenceTarget(invalid.sentences[0],'书'),null);
  assert.ok(!clozeStudyWords([invalid,other]).some(row=>row.id===word.id));
 }
 assert.ok(clozeStudyWords([word,other]).some(row=>row.id===word.id));
});
test('reading and answer feedback mark the reviewed occurrence, including fallback text',()=>{
 const html=Pinyin.htmlSentence(sentence,{blank:'书'}),before=html.split('cloze-blank')[0];
 assert.match(before,/>书</);assert.match(before,/>读</);
 assert.doesNotMatch(html.split('cloze-blank')[1],/>书</);
 const checked=Pinyin.htmlSentence(sentence,{highlight:'书'});
 assert.match(checked,/example-hanzi">书<.*cloze-answer">书</);
 assert.match(Pinyin.htmlSentence({...sentence,pinyin:''},{blank:'书'}),/他看书，我读<span class="cloze-blank">______<\/span>。/);
 const erhua={hanzi:'有点儿，还有点儿。',pinyin:'you3 dianr3 hai2 you3 dianr3',focus:{start:6,text:'点儿'}};
 assert.match(Pinyin.htmlSentence(erhua,{blank:'点儿'}),/cloze-blank.*diǎnr/);
});
test('new Review snapshots preserve the exact target and remain eligible for retesting',()=>{
 const question=snapshotQuestion('cloze',word,sentence),record={id:'wrong',mode:'cloze',wordId:word.id,question};
 assert.equal(question.blankStart,6);assert.equal(resolveWrongQuestion(record,[word]).blankStart,6);
 assert.equal(makeReviewQueue([record],[word]).items.length,1);
 assert.equal(sentence.focus.start,6);
});
test('historical mismatched blanks remain readable without silently retargeting a retest',()=>{
 const question={...snapshotQuestion('cloze',word,sentence),blankStart:2};
 const record={id:'old',mode:'cloze',wordId:word.id,question},before=JSON.stringify(record);
 const resolved=resolveWrongQuestion(record,[word]);assert.equal(resolved.blankStart,2);assert.equal(resolved.retestEligible,false);
 const queue=makeReviewQueue([record],[word]);assert.equal(queue.items.length,0);assert.deepEqual(queue.unavailable,[record]);
 assert.equal(JSON.stringify(record),before);
});
test('an explicit saved blank remains the historical location for a legacy snapshot',()=>{
 const {focus,...legacy}=sentence,question={...snapshotQuestion('cloze',word,legacy),blankStart:6};
 const record={mode:'cloze',wordId:word.id,question},before=JSON.stringify(record),resolved=resolveWrongQuestion(record,[word]);
 assert.equal(resolved.retestEligible,true);assert.deepEqual(resolved.sentence.focus,{start:6,text:'书'});
 assert.deepEqual(findSentenceTarget(resolved.sentence,'书'),{start:6,text:'书'});assert.equal(JSON.stringify(record),before);
});
