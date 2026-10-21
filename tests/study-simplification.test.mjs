import test from 'node:test';
import assert from 'node:assert/strict';
import {renderExerciseGap} from '../web/js/shared/exercise-view.js';
import {selectWordExample} from '../web/js/shared/word-example.js';
import {renderCollocations} from '../web/js/shared/collocation-view.js';
import {createRootPractice} from '../web/js/shared/root-practice.js';
import {prepareLanguageExercises} from '../web/js/shared/exercise-pools.js';
test('answer slots use one line and preserve marked kanji and escaped text',()=>{
 for(const text of ['食【　】べる','食[ ]べる','食（　）べる','食___べる']){const html=renderExerciseGap(text);assert.equal((html.match(/form-question-blank/g)||[]).length,1);assert.ok(!html.includes('【'));}
 assert.equal(renderExerciseGap('電［話］'), '電［話］');assert.match(renderExerciseGap('<b>[ ]'),/&lt;b&gt;/);
});
test('English-English examples hide their translation without erasing learning data',()=>{
 const word={studyExplanationLanguage:'en',examples:[{text:'I left early.',studyTranslation:'I departed before the others.'}]};assert.equal(selectWordExample(word,'en').studyTranslation,undefined);assert.equal(word.examples[0].studyTranslation,'I departed before the others.');word.studyExplanationLanguage='ko';assert.ok(selectWordExample(word,'en').studyTranslation);
 const row={phrase:'make a decision',meaning:'decide',example:'We made a decision.',exampleTranslation:'We decided.'};const html=renderCollocations({studyLanguage:'en',studyExplanationLanguage:'en',collocations:[row]},'en');assert.ok(html.includes('decide'));assert.ok(!html.includes('We decided.'));assert.ok(renderCollocations({studyLanguage:'en',studyExplanationLanguage:'ko',collocations:[row]},'ko').includes('We decided.'));
});
test('root practice uses verified families, same-POS options and the dictionary meaning',()=>{
 const words=[{id:'a',lemma:'include',pos:'verb',studyMeaning:'contain'},{id:'b',lemma:'exclude',pos:'verb',studyMeaning:'leave out'},{id:'c',lemma:'inclusion',pos:'noun',studyMeaning:'act of including'}];const study={targetLanguage:'en',explanationLanguage:'en',families:[{id:'f',root:'clude',origin:'la',members:words.map(word=>({entryId:word.id}))}]};
 const rows=createRootPractice(study,words);assert.equal(rows.filter(row=>row.route==='vocabinput').length,3);const q=rows.find(row=>row.entryId==='a'&&row.options);assert.deepEqual(q.options,['include','exclude']);assert.ok(q.prompt.includes('contain'));assert.ok(!q.prompt.includes('include'));
 const prepared=prepareLanguageExercises(study,words);assert.equal(prepared.filter(row=>row.category==='roots').length,rows.length);
});
