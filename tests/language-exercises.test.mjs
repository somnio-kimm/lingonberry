import test from 'node:test';
import assert from 'node:assert/strict';
import {validateExercises,validateExerciseTranslations,assembleExercises} from '../web/js/packages/exercises.js';
import {createExerciseQuestions,exerciseAnswerCorrect} from '../web/js/shared/language-exercises.js';
import {renderExerciseExplanation,renderExercisePrompt} from '../web/js/shared/exercise-view.js';
import {createLexiconStore} from '../web/js/shared/lexicon-store.js';
const entry={id:'ja-taberu',word:'食べる',pronunciation:'たべる'};
const exercise={id:'ja-ex-tab',entryId:entry.id,route:'vocabinput',category:'okurigana',prompt:'食べる → 食【　】べる',answer:'た',segments:[{text:'食',reading:'た',kind:'kanji'},{text:'べる',reading:'べる',kind:'kana'}]};
const core=()=>({kind:'study',targetLanguage:'ja',entries:[entry],exercises:[structuredClone(exercise)]});
const pair=()=>({kind:'explanation',targetLanguage:'ja',entries:[{id:entry.id}],exercises:[{id:exercise.id,instruction:'Write only the reading of 食.',explanation:'食 is た; べる is written in kana.'}]});
test('exercise data joins the separately downloaded explanation by stable ID',()=>{validateExercises(core());validateExercises(pair());validateExerciseTranslations(core(),pair());assert.equal(assembleExercises(core(),pair()).exercises[0].instruction,'Write only the reading of 食.');});
test('reject corrupt or incomplete exercises before installation',()=>{
 for(const mutate of [p=>p.exercises.push(p.exercises[0]),p=>p.exercises[0].entryId='missing',p=>p.exercises[0].route='keigo',p=>p.exercises[0].segments[0].reading='たべ',p=>p.exercises[0].options=['た','た'],p=>p.exercises[0].explanation='English in core']){const p=core();mutate(p);assert.throws(()=>validateExercises(p),/Invalid language package/);}
 const p=pair();p.exercises=[];assert.throws(()=>validateExerciseTranslations(core(),p),/incomplete/);
});
test('reading boundary accepts kana input but not the morphological stem',()=>{assert.ok(exerciseAnswerCorrect(exercise,' タ '));assert.ok(!exerciseAnswerCorrect(exercise,'たべ'));assert.ok(!exerciseAnswerCorrect(exercise,'たべる'));});
test('exercise pool respects category, route and already-filtered level/POS/status words',()=>{const rows=[exercise,{...exercise,id:'ja-ex-other',entryId:'other'},{...exercise,id:'ja-ex-form',route:'forms',category:'forms'}];const questions=createExerciseQuestions(rows,[{id:entry.id}], 'vocabinput','okurigana','ko');assert.deepEqual(questions.map(q=>q.id),[exercise.id]);assert.equal(questions[0].locale,'ko');assert.equal(createExerciseQuestions(rows,[],'vocabinput','all','en').length,0);});
test('choice grading uses an option ID and displays the actual answer in Review',()=>{const q=createExerciseQuestions([{...exercise,route:'vocabmeaning',options:['会う','合う'],answer:'会う'}],[{id:entry.id}],'vocabmeaning','all','en')[0];assert.ok(exerciseAnswerCorrect(q,'0'));assert.ok(!exerciseAnswerCorrect(q,'1'));assert.equal(q.options.find(o=>o.id==='1').text,'合う');});
test('kana segments appear in answer explanation, never in the question markup',()=>{const q={...exercise,exercise:true,word:{},instruction:'Read only 食.',explanation:'食 = た'};assert.ok(!renderExercisePrompt(q).includes('た'));assert.match(renderExerciseExplanation(q),/<rt>た<\/rt>/);assert.match(renderExerciseExplanation(q),/べる/);assert.ok(!renderExerciseExplanation(q).includes('<rt>べる</rt>'));});
test('custom exercise mistakes participate in mixed retests and auto removal',()=>{const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},store=createLexiconStore(storage,{id:'ja',levels:['N5']});const q={...exercise,exercise:true,mode:'vocabinput',locale:'ko',word:{id:entry.id}};store.record(q,'たべ',false);assert.equal(Object.values(store.state.wrongs)[0].question.segments[0].reading,'た');store.preference('autoRemoveResolvedWrongs',true);store.record(q,'た',true,true);assert.equal(Object.keys(store.state.wrongs).length,0);});
test('form metadata cannot introduce unsupported or cross-language exercise modes',()=>{const p=core();p.exercises[0]={...exercise,route:'forms',category:'forms',formKind:'potential'};validateExercises(p);p.exercises[0].formKind='politeness';assert.throws(()=>validateExercises(p),/form kind/);});
test('form prompts use the default base word, meaning and condition hierarchy',()=>{const html=renderExercisePrompt({route:'forms',word:{lemma:'食べる',studyMeaning:'먹다',pronunciation:'たべる',language:'ja'},condition:'Te Form',instruction:'Write the form.',prompt:'食べる（たべる）\nTe Form'});assert.match(html,/form-original-word/);assert.ok(html.indexOf('먹다')<html.indexOf('form-problem'));assert.match(html,/<rt>たべる<\/rt>/);assert.equal((html.match(/Te Form/g)||[]).length,1);assert.match(html,/grammar-prompt/);});

test('English combines phrase sections while preserving content labels and historical mode identity',async()=>{
 const {exerciseModes,exerciseSectionCategories,exerciseLabel,EXERCISE_ROUTES}=await import('../web/js/shared/language-exercises.js');
 const {lexiconText}=await import('../web/js/shared/lexicon-text.js');
 assert.equal(exerciseModes('en').phrasal,undefined);assert.equal(exerciseModes('en').collocations[0],'Collocations & Phrasal Verbs');
 assert.deepEqual(exerciseSectionCategories('en','collocations'),['collocations','phrasal']);assert.deepEqual(exerciseSectionCategories('en','phrasal'),['phrasal']);assert.deepEqual(exerciseSectionCategories('ja','collocations'),['collocations']);
 assert.equal(exerciseModes('ja').collocations[0],'Collocations');assert.equal(exerciseLabel('phrasal','ko'),'구동사');assert.equal(lexiconText('ko',exerciseModes('en').collocations[0]),'연어·구동사');assert.ok(EXERCISE_ROUTES.en.phrasal.includes('vocabinput'));
 const rows=['collocations','phrasal'].map(category=>({id:category,entryId:'write',route:'vocabinput',category,answer:'write … down'}));
 const section=rows.filter(row=>exerciseSectionCategories('en','collocations').includes(row.category));
 assert.deepEqual(section.flatMap(row=>createExerciseQuestions([row],[{id:'write'}],row.route,row.category,'en')).map(row=>row.category),['collocations','phrasal']);
});
