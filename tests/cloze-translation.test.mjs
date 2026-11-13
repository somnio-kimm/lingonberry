import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {clozeSentenceTranslation} from '../web/js/shared/cloze-translation.js';
import {chooseCombinedCloze} from '../web/js/shared/combined-cloze.js';
import {createLexiconQuestions} from '../web/js/shared/lexicon-questions.js';
import {studyProfiles,studyWords} from '../web/js/presentation/study-profiles.js';
import {assembleStudy} from '../web/js/packages/study.js';
import {prepareLanguageExercises} from '../web/js/shared/exercise-pools.js';
import {renderLexiconSentence} from '../web/js/shared/lexicon-sentence-view.js';
const json=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const example={text:'The plane will take off at noon.',studyTranslation:'비행기는 정오에 이륙할 것이다.'};
const word={id:'take-off',lemma:'take off',pos:'verb',level:'IELTS 1.0–3.5',studyLanguage:'en',studyMeaning:'이륙하다',examples:[example]};

test('an exact sentence translation replaces a word gloss without changing the saved source',()=>{
 const q={sentence:example.text,context:'이륙하다',word},before=structuredClone(q);
 assert.equal(clozeSentenceTranslation(q),example.studyTranslation);assert.deepEqual(q,before);
});
test('a different example or a word meaning never substitutes for the question translation',()=>{
 assert.equal(clozeSentenceTranslation({sentence:'We will take off tomorrow.',context:'이륙하다',word}), '');
 assert.equal(clozeSentenceTranslation({sentence:'We will take off tomorrow.',context:'우리는 내일 이륙할 것이다.',word}), '우리는 내일 이륙할 것이다.');
});
test('matching additional examples are selected exactly and conflicting translations are withheld',()=>{
 const next={text:'We will take off tomorrow.',studyTranslation:'우리는 내일 이륙할 것이다.'};
 assert.equal(clozeSentenceTranslation({sentence:next.text,word:{...word,examples:[example,next]}}),next.studyTranslation);
 assert.equal(clozeSentenceTranslation({sentence:example.text,word:{...word,examples:[example,{...example,studyTranslation:'다른 해석'}]}}),'');
});
test('fresh Cloze skips an untranslated authored sentence rather than showing its headword meaning',()=>{
 const exercises=[{id:'other-input',entryId:word.id,category:'phrasal',route:'vocabinput',prompt:'We will ___ tomorrow.',answer:'take off',context:'이륙하다'}];
 const q=chooseCombinedCloze({engine:createLexiconQuestions(studyProfiles.en),words:[word,{id:'land',lemma:'land',pos:'verb',studyMeaning:'착륙하다',examples:[]}],exercises,locale:'ko',answerMode:'input',random:()=>0});
 assert.equal(q.sentence,example.text);assert.equal(q.context,example.studyTranslation);
});
test('English self-study shows the word meaning while Korean shows the full sentence in both modes',()=>{
 for(const mode of ['input','choice'])for(const locale of ['en','ko']){
  const host={innerHTML:'',querySelector:()=>({addEventListener(){},set onclick(value){}}),querySelectorAll:()=>[]};
  const question={mode:'cloze',answerMode:mode,locale,exercise:true,word:{...word,studyMeaning:locale==='en'?'To leave the ground and begin flying.':word.studyMeaning},context:'이륙하다',sentence:example.text,focus:{start:15,text:'take off'},gapFill:{parts:['The plane will ',' at noon.'],answers:['take off']},options:[{id:word.id,text:'take off'}]};
  renderLexiconSentence(host,{question,chosenTokens:[],showTranslation:true,t:value=>value},{language:'en',uiLanguage:locale});
  if(locale==='en'){assert.ok(host.innerHTML.includes('To leave the ground and begin flying.'));assert.ok(!host.innerHTML.includes(example.studyTranslation));}
  else {assert.ok(host.innerHTML.includes(example.studyTranslation));assert.ok(!host.innerHTML.includes('>이륙하다<'));}
 }
});
test('the Korean context edition preserves vocabulary and completes every sentence hint and completes every current expression Cloze',async()=>{
 const [core,pair,before,source]=await Promise.all([json('language-packages/en-core-7.0.5.json'),json('language-packages/en-ko-7.0.6.json'),json('language-packages/en-ko-7.0.5.json'),json('language-packages/sources/exercises/cloze-sentence-contexts-ko-7.0.6.json')]);
 assert.deepEqual(pair.entries,before.entries);assert.equal(pair.studyVersion,core.version);
 const changed=new Map(source.entries.map(row=>[row.exerciseId,row.translation])),questions=new Map(core.exercises.map(row=>[row.id,row])),entries=new Map(core.entries.map(row=>[row.id,row])),meanings=new Map(before.entries.map(row=>[row.id,row]));let contextChanges=0;
 assert.equal(changed.size,6);
 for(const [i,row]of pair.exercises.entries()){
  if(changed.has(row.id))assert.deepEqual(row,{...before.exercises[i],context:changed.get(row.id)});
  else if(row.context!==before.exercises[i].context){
   const question=questions.get(row.id),entry=entries.get(question.entryId),meaning=meanings.get(entry.id),sentence=question.gapFill?question.gapFill.parts.map((part,index)=>part+(question.gapFill.answers[index]||'')).join(''):question.prompt.replace(/_{2,}/u,question.answer);
   const examples=[entry.example,...(entry.additionalExamples||[])],index=examples.findIndex(example=>example?.text===sentence);assert.ok(index>=0,row.id);
   const expected=index===0?meaning.exampleTranslation:meaning.additionalExampleTranslations[index-1];assert.deepEqual(row,{...before.exercises[i],context:expected});
  }else assert.deepEqual(row,before.exercises[i]);
  if(row.context!==before.exercises[i].context)contextChanges++;
 }
 assert.equal(contextChanges,193);
 const study=assembleStudy(core,pair),words=studyWords(study),byId=new Map(words.map(word=>[word.id,word]));
 const rows=prepareLanguageExercises(study,words).filter(row=>['vocabinput','vocabmeaning'].includes(row.route)&&['collocations','phrasal','idioms'].includes(row.category)&&(row.gapFill||row.prompt.match(/_{2,}/gu)?.length===1));
 assert.ok(rows.length>=193);
 for(const row of rows){const word=byId.get(row.entryId),translation=clozeSentenceTranslation({...row,word});assert.ok(translation,row.id);assert.notEqual(translation,word.studyMeaning,row.id);}
});
