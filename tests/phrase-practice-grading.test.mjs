import test from 'node:test';
import assert from 'node:assert/strict';
import {createPhrasePractice} from '../web/js/shared/phrase-practice.js';
import {exerciseAnswerCorrect,createExerciseQuestions} from '../web/js/shared/language-exercises.js';

test('equivalent phrase meanings are accepted in recall and excluded from wrong choices',()=>{
 const word=(id,lemma,studyMeaning,pos='expression')=>({
  id,lemma,studyMeaning,pos,level:'A',tags:['practice:phrase:idioms'],examples:[],referenceExamples:[],
 });
 const words=[
  word('first','first of all','Firstly; before anything else.'),
  word('up','first up','firstly; before anything else'),
  word('last','at last','After a long wait.'),
  word('verb','start with','Firstly; before anything else.','verb'),
 ];
 const rows=createPhrasePractice({targetLanguage:'en',explanationLanguage:'en'},words);
 const choice=rows.find(row=>row.entryId==='first'&&row.options);
 assert.deepEqual(choice.options,['first of all','at last']);
 const recall=createExerciseQuestions(rows,words,'vocabinput','idioms','en').find(q=>q.entryId==='first');
 assert.equal(exerciseAnswerCorrect(recall,'first up'),true);
 assert.equal(exerciseAnswerCorrect(recall,'start with'),false);
 assert.equal(exerciseAnswerCorrect(recall,'at last'),false);
});

test('sentence gaps keep their bound expression instead of admitting a synonym into different syntax',()=>{
 const words=[
  {id:'one',lemma:'first of all',pos:'expression',level:'A',studyMeaning:'Firstly.',
   tags:['practice:phrase:idioms'],examples:[{text:'First of all, check your booking.'}],referenceExamples:[]},
  {id:'two',lemma:'first up',pos:'expression',level:'A',studyMeaning:'Firstly.',
   tags:['practice:phrase:idioms'],examples:[],referenceExamples:[]},
 ];
 const rows=createPhrasePractice({targetLanguage:'en',explanationLanguage:'en'},words);
 const recall=createExerciseQuestions(rows,words,'vocabinput','idioms','en').find(q=>q.entryId==='one');
 assert.equal(exerciseAnswerCorrect(recall,'first up'),false);
 assert.equal(exerciseAnswerCorrect(recall,'first of all'),true);
 assert.equal(rows.some(row=>row.entryId==='one'&&row.options),false);
});


test('inflected expression gaps reconstruct the original sentence rather than the dictionary infinitive',()=>{
 const text='The plane took off at noon.';
 const words=[{id:'take-off',lemma:'take off',pos:'verb',level:'A',studyMeaning:'To leave the ground.',tags:['practice:phrase:phrasal'],examples:[{text,focus:{start:10,text:'took off'}}],referenceExamples:[]},{id:'land',lemma:'land',pos:'verb',level:'A',studyMeaning:'To reach the ground.',tags:['practice:phrase:phrasal'],examples:[],referenceExamples:[]}];
 const rows=createPhrasePractice({targetLanguage:'en',explanationLanguage:'en'},words);
 const row=rows.find(row=>row.entryId==='take-off'&&row.route==='vocabinput');
 assert.equal(row.answer,'took off');assert.deepEqual(row.gapFill.answers,['took off']);
 assert.equal(row.gapFill.parts[0]+row.gapFill.answers[0]+row.gapFill.parts[1],text);
 assert.ok(rows.find(row=>row.entryId==='take-off'&&row.options).options.includes('took off'));
});
