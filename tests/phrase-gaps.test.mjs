import test from 'node:test';
import assert from 'node:assert/strict';
import {gradePhraseGaps,joinGapAnswers,completeGapSentence} from '../web/js/shared/phrase-gaps.js';
import {renderExercisePrompt} from '../web/js/shared/exercise-view.js';
import {exerciseAnswerCorrect} from '../web/js/shared/language-exercises.js';
import {validateExercises,validateExerciseTranslations,assembleExercises} from '../web/js/packages/exercises.js';
const gapFill={parts:['Please ',' it ',' before you forget.'],answers:['write','down'],alternatives:[['note','down']]};
const exercise={id:'en-gap-write-input',entryId:'en-write',category:'phrasal',route:'vocabinput',prompt:gapFill.parts.join('___'),answer:joinGapAnswers(gapFill.answers),gapFill};
const core=()=>({kind:'study',targetLanguage:'en',entries:[{id:'en-write'}],exercises:[structuredClone(exercise)]});
const pair=()=>({kind:'explanation',targetLanguage:'en',entries:[{id:'en-write'}],exercises:[{id:exercise.id,instruction:'Fill each blank.',context:'Record it for later.',explanation:'The pronoun goes between write and down.'}]});
test('separate gaps grade all slots, normalise input and reconstruct the complete sentence',()=>{
 for(const answers of [['write','down'],[' ＷＲＩＴＥ ','DOWN'],['note','down']])assert.ok(exerciseAnswerCorrect(exercise,joinGapAnswers(answers)));
 for(const answers of [['write'],['','down'],['write','off'],['write','down','extra']])assert.equal(exerciseAnswerCorrect(exercise,joinGapAnswers(answers)),false);
 assert.equal(completeGapSentence(gapFill),'Please write it down before you forget.');
});
test('approved alternatives stay aligned instead of accepting mixed patterns',()=>{
 const gap={parts:['They ',' it ',' scrutiny.'],answers:['subjected','to'],alternatives:[['put','under'],['placed','under']]};
 assert.equal(gradePhraseGaps(gap,'put … under').correct,true);
 assert.equal(gradePhraseGaps(gap,'subjected … under').correct,false);
 assert.deepEqual(gradePhraseGaps(gap,'placed … to').matches,[false,true]);
 assert.equal(gradePhraseGaps({parts:['',''],answers:["don't"]},'DON’T').correct,true);
});
test('inline inputs hide answers before checking and show per-slot corrections afterwards',()=>{
 const q={...exercise,exercise:true,word:{language:'en'},instruction:'Fill each blank.',context:'Record it for later.'};
 const html=renderExercisePrompt(q,{editable:true});
 assert.equal((html.match(/data-phrase-gap=/g)||[]).length,2);assert.ok(!html.includes('value="write"'));assert.match(html,/enterkeyhint="next"/);assert.match(html,/enterkeyhint="done"/);
 const checked=renderExercisePrompt(q,{checked:true,input:'write … off'});
 assert.ok(!checked.includes('<input'));assert.match(checked,/phrase-gap-result correct/);assert.match(checked,/phrase-gap-result wrong/);assert.match(checked,/>down<\/span><del class="input-wrong">off<\/del>/);
 const review=renderExercisePrompt(q);assert.equal((review.match(/form-question-blank/g)||[]).length,2);assert.ok(!review.includes('data-phrase-gap'));
 const hostile=renderExercisePrompt({...q,gapFill:{parts:['<script>','',''],answers:['x','y']}},{editable:true,input:'\" onfocus=bad … <b>'});assert.ok(!hostile.includes('<script>'));assert.ok(!hostile.includes('value="" onfocus'));
});
test('package validation preserves gap identity and requires separately downloaded context',()=>{
 validateExercises(core());validateExercises(pair());validateExerciseTranslations(core(),pair());assert.deepEqual(assembleExercises(core(),pair()).exercises[0].gapFill,gapFill);
 for(const mutate of [p=>p.exercises[0].gapFill.parts.pop(),p=>p.exercises[0].gapFill.alternatives=[['note']],p=>p.exercises[0].answer='write down',p=>p.exercises[0].prompt='unstructured',p=>p.exercises[0].gapFill.answers[0]='',p=>p.exercises[0].gapFill.executable='bad',p=>p.exercises[0].context='English in core']){const p=core();mutate(p);assert.throws(()=>validateExercises(p),/Invalid language package/);}
 const missing=pair();delete missing.exercises[0].context;assert.throws(()=>validateExerciseTranslations(core(),missing),/context/);
 const override=pair();override.exercises[0].gapFill={};assert.throws(()=>validateExercises(override),/translation fields/);
});
