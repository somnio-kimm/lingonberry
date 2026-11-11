import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from '../web/languages/de/js/core/store.js';
import {wrongEntries} from '../web/languages/de/js/core/wrong.js';
import {reviewItems,reviewCatalog} from '../web/languages/de/js/core/retest.js';
import {clozeQuestions,scrambleQuestions,scrambleCorrect} from '../web/languages/de/js/core/sentence-quizzes.js';
const word={id:'book',lemma:'Buch',cefr:'A1',pos:'noun',article:'das',studyMeaning:'book',studyExplanationLanguage:'en',meaning_en:['book'],meaning_ko:['책'],examples:[{de:'Das Buch liegt hier.',studyTranslation:'The book is here.',en:'The book is here.'}]};
const updated={...word,examples:[{de:'Ich lese das Buch.',studyTranslation:'I read the book.',en:'I read the book.'}]};
const builders={cloze:clozeQuestions,scramble:scrambleQuestions};
const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)};};
function queue(store,words){const rows=wrongEntries([],store.state,words,store.reviewContent);return reviewItems(rows,reviewCatalog(words,rows));}
for(const mode of ['cloze','scramble'])test(`saved ${mode} keeps its original sentence and results when dictionary examples change`,()=>{
 const storage=memory(),store=createStore(storage);store.setReviewContent({studyVersion:'1.0.0'});store.setWordStatus(word.id,'mastered');
 const oldQuestion=builders[mode]([word])[0];store.recordQuizAnswer(mode,oldQuestion,'wrong',false);
 const before=JSON.stringify(store.state.quizAnswers[mode][oldQuestion.id]);
 const reopened=createStore(storage);reopened.setReviewContent({studyVersion:'2.0.0'});
 const result=queue(reopened,[updated]);assert.equal(result.items.length,1);assert.equal(result.items[0].question.example.de,word.examples[0].de);
 if(mode==='cloze')assert.equal(result.items[0].question.answer,'Buch');else assert.equal(scrambleCorrect(result.items[0].question,result.items[0].question.tokens),true);
 assert.equal(JSON.stringify(reopened.state.quizAnswers[mode][oldQuestion.id]),before);
 const next=builders[mode]([updated])[0];assert.notEqual(next.id,oldQuestion.id);
 reopened.recordQuizAnswer(mode,next,mode==='cloze'?next.answer:next.example.de,true);
 assert.equal(JSON.stringify(reopened.state.quizAnswers[mode][oldQuestion.id]),before);assert.equal(reopened.wordStatus(word.id),'mastered');
 assert.equal(queue(reopened,[updated]).items[0].question.example.de,word.examples[0].de);
});
for(const mode of ['cloze','scramble'])test(`legacy ${mode} replays the original stored example without a snapshot`,()=>{
 const storage=memory(),store=createStore(storage);store.setReviewContent({studyVersion:'1.0.0'});
 const q=builders[mode]([word])[0];store.recordQuizAnswer(mode,q,'wrong',false);
 const record=store.state.quizAnswers[mode][q.id];record.questionSnapshot=null;
 // Simulate a genuine older storage representation without touching it during replay.
 const legacyId=mode==='scramble'?'book:0':'book:0:'+q.start;delete store.state.quizAnswers[mode][q.id];store.state.quizAnswers[mode][legacyId]=record;
 const before=JSON.stringify(store.state.quizAnswers[mode]);const result=queue(store,[updated]);
 assert.equal(result.items.length,1);assert.equal(result.items[0].question.id,legacyId);assert.equal(result.items[0].question.example.de,word.examples[0].de);
 assert.equal(JSON.stringify(store.state.quizAnswers[mode]),before);
});
test('semantic revisions and retired IDs still exclude stored sentence questions without deleting them',()=>{
 const store=createStore(memory());store.setReviewContent({studyVersion:'1.0.0'});
 for(const mode of ['cloze','scramble'])store.recordQuizAnswer(mode,builders[mode]([word])[0],'wrong',false);
 const before=JSON.stringify(store.state.quizAnswers);store.setReviewContent({studyVersion:'2.0.0',reviewInvalidations:[{id:word.id,minimumVersion:'2.0.0'}]});
 assert.equal(queue(store,[updated]).items.length,0);assert.equal(JSON.stringify(store.state.quizAnswers),before);
 store.setReviewContent({studyVersion:'2.0.0',retiredEntries:[{id:word.id}]});assert.equal(queue(store,[updated]).items.length,0);assert.equal(JSON.stringify(store.state.quizAnswers),before);
});
test('ambiguous legacy blanks require an actual stored position; invalid ones are not retargeted',()=>{
 const repeated={...word,examples:[{de:'Das Buch liegt neben dem Buch.'}]},store=createStore(memory()),q=clozeQuestions([repeated])[0];store.recordQuizAnswer('cloze',q,'wrong',false);
 const record=store.state.quizAnswers.cloze[q.id];record.questionSnapshot=null;record.questionContext.start=null;
 const before=JSON.stringify(record);assert.equal(queue(store,[updated]).items.length,0);assert.equal(JSON.stringify(record),before);
 record.questionContext.start=record.example.de.lastIndexOf('Buch');assert.equal(queue(store,[updated]).items[0].question.start,record.questionContext.start);
 record.questionContext.start=1;assert.equal(queue(store,[updated]).items.length,0);
});
test('foreign or malformed sentence snapshots fail closed and remain stored',()=>{
 const store=createStore(memory()),q=clozeQuestions([word])[0];store.recordQuizAnswer('cloze',q,'wrong',false);
 const good=structuredClone(store.state.quizAnswers.cloze[q.id]);
 for(const change of [r=>r.questionSnapshot.word.id='foreign',r=>r.questionSnapshot.start=1,r=>r.questionSnapshot.answer='Stuhl',r=>r.questionSnapshot.form=null,r=>r.questionSnapshot.form.text=undefined]){
  const record=structuredClone(good);change(record);store.state.quizAnswers.cloze[q.id]=record;const before=JSON.stringify(record);
  assert.equal(queue(store,[updated]).items.length,0);assert.equal(JSON.stringify(record),before);
 }
});
test('sentence IDs are content-scoped while unchanged normalised sentences stay stable',()=>{
 for(const mode of ['cloze','scramble']){
  const build=builders[mode];assert.equal(build([word])[0].id,build([{...word,examples:[{de:' Das  Buch liegt hier. '}]}])[0].id);
  assert.notEqual(build([word])[0].id,build([updated])[0].id);
 }
});
test('sentence Review heading uses the selected explanation without rewriting the original snapshot',()=>{
 const store=createStore(memory()),q=scrambleQuestions([word])[0];store.recordQuizAnswer('scramble',q,'wrong',false);
 const before=JSON.stringify(store.state.quizAnswers.scramble[q.id]),korean={...updated,studyMeaning:'책',studyExplanationLanguage:'ko'};
 const rows=wrongEntries([],store.state,[korean],store.reviewContent);assert.equal(rows[0].word.studyMeaning,'책');
 assert.equal(rows[0].questionSnapshot.word.studyMeaning,'book');assert.equal(queue(store,[korean]).items[0].question.example.de,word.examples[0].de);
 assert.equal(JSON.stringify(store.state.quizAnswers.scramble[q.id]),before);
});
