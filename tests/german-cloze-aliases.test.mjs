import test from'node:test';import assert from'node:assert/strict';
import{clozeQuestions,clozeOptions}from'../web/languages/de/js/core/sentence-quizzes.js';
import{snapshotQuestion}from'../web/js/shared/question-snapshot.js';
import{createStore}from'../web/languages/de/js/core/store.js';
import{wrongEntries}from'../web/languages/de/js/core/wrong.js';
import{reviewItems,reviewCatalog}from'../web/languages/de/js/core/retest.js';
const noun=(id,lemma,aliases=[])=>({id,lemma,aliases,pos:'noun',article:'die',gender:'feminine',accepted_articles:['die'],cefr:'C2',meaning_en:[lemma],meaning_ko:[lemma],examples:[{de:`Der Betrag ist in ${lemma} angegeben.`,en:'The amount is stated in the currency.',ko:'금액은 그 통화로 표시되어 있다.'}]});
const otherNouns=()=>['Krone','Mark','Rupie','Lira'].map(name=>noun(name,name));
const identityOrder=()=>.999999;
test('German Cloze excludes a declared alias and still offers four same-POS choices',()=>{
 const target=noun('griwna','Griwna',['Hrywnja']),alias=noun('hrywnja','Hrywnja'),words=[target,alias,...otherNouns()];const q=clozeQuestions([target])[0],options=clozeOptions(q,words,identityOrder);
 assert.equal(options.length,4);assert.ok(options.every(o=>o.word.pos==='noun'));assert.ok(options.some(o=>o.text==='Griwna'));assert.ok(!options.some(o=>o.text==='Hrywnja'));
});
test('German Cloze recognises an alias declared only by the competing word',()=>{
 const target=noun('hrywnja','Hrywnja'),alias=noun('griwna','Griwna',['Hrywnja']);const q=clozeQuestions([target])[0];assert.ok(!clozeOptions(q,[target,alias,...otherNouns()],identityOrder).some(o=>o.text==='Griwna'));
});
test('reloaded German Review recovers alias identity omitted by an older snapshot',()=>{
 const target=noun('griwna','Griwna',['Hrywnja']),alias=noun('hrywnja','Hrywnja'),words=[target,alias,...otherNouns()],q=clozeQuestions([target])[0],data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},store=createStore(storage);store.setReviewContent({studyVersion:'1.0.0'});store.recordQuizAnswer('cloze',q,'wrong',false);const saved=store.state.quizAnswers.cloze[q.id];delete saved.questionSnapshot.word.aliases;store.preference('theme','dark');const before=JSON.stringify(store.state.quizAnswers),reopened=createStore(storage);reopened.setReviewContent({studyVersion:'1.0.0'});const rows=wrongEntries([],reopened.state,words,reopened.reviewContent),replay=reviewItems(rows,reviewCatalog(words,rows));assert.equal(replay.items.length,1);const restored=replay.items[0].question;
 assert.ok(!Object.hasOwn(restored.word,'aliases'));assert.ok(!clozeOptions(restored,words,identityOrder).some(o=>o.text==='Hrywnja'));assert.equal(JSON.stringify(reopened.state.quizAnswers),before);assert.equal(reopened.state.preferences.theme,'dark');
});
test('new snapshots retain detached aliases when the target is absent from the choice pool',()=>{
 const target=noun('griwna','Griwna',['Hrywnja']),q=clozeQuestions([target])[0],saved=snapshotQuestion(q);target.aliases.push('Another spelling');assert.deepEqual(saved.word.aliases,['Hrywnja']);assert.ok(!clozeOptions(saved,[noun('hrywnja','Hrywnja'),...otherNouns()],identityOrder).some(o=>o.text==='Hrywnja'));
});
test('reference-only related forms do not turn ordinary wrong choices into aliases',()=>{
 const target=noun('griwna','Griwna'),reference=noun('mark','Mark');reference.related_forms=['Griwna','[1] UAH'];const q=clozeQuestions([target])[0];assert.ok(clozeOptions(q,[target,reference,...otherNouns().slice(1)],identityOrder).some(o=>o.text==='Mark'));
});
