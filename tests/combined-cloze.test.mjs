import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseCombinedCloze} from '../web/js/shared/combined-cloze.js';
import {createLexiconQuestions} from '../web/js/shared/lexicon-questions.js';
import {studyProfiles} from '../web/js/presentation/study-profiles.js';
import {exerciseAnswerCorrect} from '../web/js/shared/language-exercises.js';
import {createPhrasePractice} from '../web/js/shared/phrase-practice.js';
import {selectWordExample} from '../web/js/shared/word-example.js';

const engine=createLexiconQuestions(studyProfiles.en);
const words=[
 {id:'take-off',lemma:'take off',level:'A',pos:'verb',aliases:[],studyMeaning:'이륙하다',studyExplanationLanguage:'ko',
  examples:[{text:'The plane will take off at noon.',studyTranslation:'비행기는 정오에 이륙할 것이다.'}]},
 {id:'land',lemma:'land',level:'A',pos:'verb',aliases:[],studyMeaning:'착륙하다',studyExplanationLanguage:'ko',examples:[]},
 {id:'write',lemma:'write',level:'A',pos:'verb',aliases:[],studyMeaning:'쓰다',studyExplanationLanguage:'ko',examples:[]},
];
const gaps=['vocabinput','vocabmeaning'].map(route=>({
 id:'write-down-'+route,entryId:'write',category:'phrasal',route,prompt:'Please ___ it ___.',
 answer:'write … down',gapFill:{parts:['Please ',' it ','.'],answers:['write','down']},
 ...(route==='vocabmeaning'?{options:['write … down','cross … out']}:{}),
}));

test('existing Meaning Quiz includes expression headwords and keeps their meanings as choices',()=>{
 const question=engine.createVocabularyPool('vocabmeaning',words,'ko').all(()=>.2).find(q=>q.word.id==='take-off');
 assert.equal(question.prompt,'take off');
 assert.equal(question.options.find(option=>option.id==='take-off').text,'이륙하다');
});
test('Cloze retains authored separate blanks in both answer modes, with existing grading',()=>{
 for(const answerMode of ['choice','input']){
  const q=chooseCombinedCloze({engine,words,exercises:gaps,locale:'ko',answerMode,random:()=>0});
  assert.equal(q.mode,'cloze');assert.equal(q.category,'phrasal');
  assert.deepEqual(q.gapFill.answers,['write','down']);assert.equal(q.sentence,'Please write it down.');
  assert.equal(exerciseAnswerCorrect(q,answerMode==='choice'?q.correctOption:'write … down'),true);
  assert.equal(exerciseAnswerCorrect(q,answerMode==='choice'?'wrong':'write … off'),false);
 }
});
test('Cloze typing also handles ordinary word examples and retains their sentence translation',()=>{
 const q=chooseCombinedCloze({engine,words,exercises:[],locale:'ko',answerMode:'input',random:()=>0});
 assert.equal(q.mode,'cloze');assert.equal(q.category,'cloze');
 assert.deepEqual(q.gapFill.parts,['The plane will ',' at noon.']);
 assert.equal(q.context,'비행기는 정오에 이륙할 것이다.');
 assert.equal(exerciseAnswerCorrect(q,'take off'),true);
 assert.equal(exerciseAnswerCorrect(q,'land'),false);
});
test('expression questions respect the filtered Word List and fallback to a normal example',()=>{
 const q=chooseCombinedCloze({engine,words,exercises:gaps.map(row=>({...row,entryId:'excluded'})),locale:'ko',random:()=>0});
 assert.equal(q.exercise,undefined);
 assert.equal(q.word.id,'take-off');
});
test('reference-only expression examples do not enter default scored Cloze',()=>{
 const q=chooseCombinedCloze({engine,words,exercises:gaps.map(row=>({...row,referenceExample:true})),locale:'ko',random:()=>0});
 assert.equal(q.exercise,undefined);
 assert.equal(q.word.id,'take-off');
});
test('a quoted unusual form stays visible in the dictionary and out of sentence practice',()=>{
 const example={text:"Replace 'or so on' with 'and so on'.",de:"Replace 'or so on' with 'and so on'.",
  studyTranslation:'목록을 고친다.',practiceEligible:false};
 const entry={id:'unusual',lemma:'or so on',pos:'expression',level:'A',studyMeaning:'An unusual list extender.',
  studyExplanationLanguage:'en',examples:[example],referenceExamples:[],tags:['practice:phrase:idioms']};
 assert.equal(selectWordExample(entry,'en').text,example.text);
 assert.equal(engine.sentenceQuestions('cloze',[entry]).length,0);
 assert.equal(engine.sentenceQuestions('scramble',[entry]).length,0);
 assert.equal(engine.listeningQuestions('listensentence',[entry]).length,0);
 assert.equal(createPhrasePractice({targetLanguage:'en',explanationLanguage:'en'},[entry]).some(q=>q.gapFill),false);
 assert.equal(engine.listeningQuestions('listenword',[entry]).length,1);
});
