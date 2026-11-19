import test from 'node:test';
import assert from 'node:assert/strict';
import {createQuestionRotation} from '../web/js/shared/question-rotation.js';
import {chooseCombinedCloze} from '../web/js/shared/combined-cloze.js';
import {createLexiconQuestions} from '../web/js/shared/lexicon-questions.js';
import {studyProfiles} from '../web/js/presentation/study-profiles.js';
test('each eligible content group appears once per round, even with fixed randomness',()=>{
 const rows=[{id:'a',text:'A'},{id:'alias',text:'A'},{id:'b',text:'B'},{id:'c',text:'C'}],rotation=createQuestionRotation(rows,{key:row=>row.text});let previous;
 const draws=Array.from({length:12},()=>{const q=rotation.choose(previous,()=>0);assert.notEqual(q.id,previous);previous=q.id;return q.text;});
 for(let i=0;i<draws.length;i+=3)assert.equal(new Set(draws.slice(i,i+3)).size,3);assert.equal(rows.length,4);
});
test('invalid rows are skipped, including an invalid alias of valid content',()=>{
 const rotation=createQuestionRotation([{id:'bad',key:'same'},{id:'ok',key:'same'},{id:'other',key:'other'}],{key:row=>row.key});assert.equal(rotation.choose(undefined,()=>0,row=>row.id==='bad'?null:row).id,'ok');assert.equal(rotation.choose(undefined,()=>0).id,'other');
 assert.equal(createQuestionRotation([]).choose(),undefined);assert.equal(createQuestionRotation([{id:'only'}]).choose().id,'only');
});
for(const answerMode of ['choice','input'])test(`combined ${answerMode} pool gives a tiny expression set no repeated 50% slot`,()=>{
 const engine=createLexiconQuestions(studyProfiles.en),words=Array.from({length:20},(_,i)=>({id:'w'+i,lemma:'word'+i,pos:'noun',studyMeaning:'meaning'+i,studyExplanationLanguage:'en',examples:[{text:`Use word${i} today.`,studyTranslation:`Use word${i} today.`}]}));
 const exercises=[{id:'wake',entryId:'w0',category:'phrasal',route:answerMode==='input'?'vocabinput':'vocabmeaning',prompt:'It is morning. ___ and leave your bed; breakfast is ready.',answer:'Get up',...(answerMode==='choice'?{options:['Get up','Stay down']}:{} )}];
 let previous;const seen=[];
 for(let i=0;i<21;i++){const q=chooseCombinedCloze({engine,words:[...words],exercises,locale:'en',answerMode,previousId:previous,random:()=>0});assert.ok(q);seen.push(q.sentence);previous=q.id;}
 assert.equal(new Set(seen).size,21);assert.equal(seen.filter(s=>s.startsWith('It is morning')).length,1);
 const next=chooseCombinedCloze({engine,words,exercises,locale:'en',answerMode,previousId:previous,random:()=>0});assert.notEqual(next.id,previous);
 const narrowed=chooseCombinedCloze({engine,words:words.slice(1,4),exercises,locale:'en',answerMode,random:()=>0});assert.ok(words.slice(1,4).some(word=>word.id===narrowed.word.id));assert.notEqual(narrowed.id,'wake');
});
test('ordinary sentence pools rotate examples and build fresh detached choices',()=>{
 const engine=createLexiconQuestions(studyProfiles.en),words=['cat','dog','bird'].map(lemma=>({id:lemma,lemma,pos:'noun',examples:[{text:`A ${lemma} is here.`,studyTranslation:'Here.'}]})),pool=engine.createSentencePool('cloze',words,'en');let previous;const ids=[];
 for(let i=0;i<3;i++){const q=pool.choose(previous,()=>0);ids.push(q.id);previous=q.id;q.options.length=0;}
 assert.equal(new Set(ids).size,3);assert.ok(pool.choose(previous,()=>0).options.length>1);
});
