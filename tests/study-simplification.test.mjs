import test from 'node:test';
import assert from 'node:assert/strict';
import {renderExerciseGap} from '../web/js/shared/exercise-view.js';
import {selectWordExample} from '../web/js/shared/word-example.js';
import {renderCollocations} from '../web/js/shared/collocation-view.js';
import {exerciseModes,exerciseAnswerCorrect} from '../web/js/shared/language-exercises.js';
import {prepareLanguageExercises} from '../web/js/shared/exercise-pools.js';
test('answer slots use one line and preserve marked kanji and escaped text',()=>{
 for(const text of ['食【　】べる','食[ ]べる','食（　）べる','食___べる']){const html=renderExerciseGap(text);assert.equal((html.match(/form-question-blank/g)||[]).length,1);assert.ok(!html.includes('【'));}
 assert.equal(renderExerciseGap('電［話］'), '電［話］');assert.match(renderExerciseGap('<b>[ ]'),/&lt;b&gt;/);
});
test('English-English examples hide their translation without erasing learning data',()=>{
 const word={studyExplanationLanguage:'en',examples:[{text:'I left early.',studyTranslation:'I departed before the others.'}]};assert.equal(selectWordExample(word,'en').studyTranslation,undefined);assert.equal(word.examples[0].studyTranslation,'I departed before the others.');word.studyExplanationLanguage='ko';assert.ok(selectWordExample(word,'en').studyTranslation);
 const row={phrase:'make a decision',meaning:'decide',example:'We made a decision.',exampleTranslation:'We decided.'};const html=renderCollocations({studyLanguage:'en',studyExplanationLanguage:'en',collocations:[row]},'en');assert.ok(html.includes('decide'));assert.ok(!html.includes('We decided.'));assert.ok(renderCollocations({studyLanguage:'en',studyExplanationLanguage:'ko',collocations:[row]},'ko').includes('We decided.'));
});
test('Root Families is a reference without fresh questions; saved root questions stay gradable',()=>{
 const words=[{id:'a',lemma:'include',pos:'verb',studyMeaning:'contain'},{id:'b',lemma:'exclude',pos:'verb',studyMeaning:'leave out'},{id:'c',lemma:'inclusion',pos:'noun',studyMeaning:'act of including'}];
 const saved={id:'saved-root-input',entryId:'a',route:'vocabinput',category:'roots',prompt:'contain',answer:'include',acceptedAnswers:['include'],word:words[0],exercise:true};
 const study={targetLanguage:'en',explanationLanguage:'en',families:[{id:'f',root:'clude',origin:'la',members:words.map(word=>({entryId:word.id}))}],exercises:[saved]},before=structuredClone(study);
 assert.equal(exerciseModes('en').roots,undefined);assert.equal(prepareLanguageExercises(study,words).some(row=>row.category==='roots'),false);
 assert.equal(exerciseAnswerCorrect(saved,'include'),true);assert.equal(exerciseAnswerCorrect(saved,'exclude'),false);
 assert.deepEqual(study,before,'Retiring a feature does not mutate installed content or saved questions');
});
