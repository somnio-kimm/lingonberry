import test from 'node:test';
import assert from 'node:assert/strict';
import {vocabularyLearningContent} from '../web/js/shared/vocabulary-learning.js';
import {renderVocabularyHints} from '../web/js/shared/vocabulary-learning-view.js';
const word={id:'midday-noun',lemma:'midday',pos:'noun',studyMeaning:'정오',studyExplanationLanguage:'ko',examples:[{text:'There was no one in the square at midday.',studyTranslation:'정오에는 광장에 아무도 없었다.'}]};
test('context hint masks the exact sense example and never includes its translation',()=>{
 const q={word,locale:'ko'},result=vocabularyLearningContent(q,{language:'en',locale:'ko'});
 assert.deepEqual(result.hint,['There was no one in the square at ','.']);
 const html=renderVocabularyHints(q,{language:'en',locale:'ko'});
 assert.ok(!html.includes('midday'));assert.ok(!html.includes('정오'));assert.match(html,/<summary>힌트<\/summary>/);assert.equal((html.match(/<details\b/g)||[]).length,1);assert.doesNotMatch(html,/<button\b/);assert.doesNotMatch(html,/<details[^>]*\sopen/);
});
test('the masked example escapes angle brackets',()=>{
 const q={word:{...word,examples:[{text:'<p>At midday.</p>'}]},locale:'ko'};
 assert.match(renderVocabularyHints(q,{language:'en',locale:'ko'}),/&lt;p&gt;At/);
});
test('inflected explicit targets mask the actual answer',()=>{
 const q={word:{...word,lemma:'go',pos:'verb',examples:[{text:'She went home.',focus:{start:4,text:'went'},studyTranslation:'그녀는 집에 갔다.'} ]},locale:'ko'};
 assert.deepEqual(vocabularyLearningContent(q,{language:'en',locale:'ko'}).hint,['She ',' home.']);
});
test('unsafe or repeated targets offer no example hint',()=>{
 for(const example of [{text:'No match here.'},{text:'midday and midday',focus:{start:0,text:'midday'}},{text:'at midday',practiceEligible:false},{text:'at midday',clozeEligible:false}]){
  assert.equal(renderVocabularyHints({word:{...word,examples:[example]},locale:'ko'},{language:'en',locale:'ko'}),'');
 }
});
test('learning content preserves the selected sense and explanation',()=>{
 const content=vocabularyLearningContent({word,locale:'ko'},{language:'en',locale:'en'});
 assert.equal(content.meaning,word.studyMeaning);
 assert.equal(content.example.studyTranslation,word.examples[0].studyTranslation);
});
test('English-to-English learning content omits a redundant example translation',()=>{
 const content=vocabularyLearningContent({word:{...word,studyMeaning:'The middle of the day.',studyExplanationLanguage:'en'},locale:'en'},{language:'en',locale:'ko'});
 assert.ok(!content.example.studyTranslation);assert.equal(content.meaning,'The middle of the day.');
});
test('legacy Chinese sentences are adapted without losing their readings',()=>{
 const q={word:{id:'car',hanzi:'车',meaningKo:'차',partOfSpeech:'noun',sentences:[{hanzi:'我坐车去。',pinyin:'wǒ zuò chē qù',meaningKo:'차를 타고 가요.'}]},locale:'ko'};
 const data=vocabularyLearningContent(q,{language:'zh',locale:'ko'});assert.equal(data.example.pinyin,'wǒ zuò chē qù');assert.equal(data.example.text,'我坐车去。');assert.equal(data.example.studyTranslation,'차를 타고 가요.');
});
test('one saved example survives snapshotting without retaining every word example',async()=>{
 const {withVocabularyLearning}=await import('../web/js/shared/vocabulary-learning.js'),{snapshotQuestion}=await import('../web/js/shared/question-snapshot.js');const q={mode:'vocabinput',word,locale:'ko',answer:'midday'},before=structuredClone(q),saved=snapshotQuestion(withVocabularyLearning(q,{language:'en',locale:'ko'}));assert.equal(saved.word.examples,undefined);assert.equal(vocabularyLearningContent(saved,{language:'en',locale:'ko'}).example.text,word.examples[0].text);assert.deepEqual(q,before);
});
test('legacy example fallback is limited to the same word ID and explanation language',()=>{
 const q={word:{...word,examples:undefined},locale:'ko'};assert.equal(vocabularyLearningContent(q,{language:'en',locale:'en',fallbackWord:word}).example.text,word.examples[0].text);for(const fallbackWord of [{...word,id:'another'},{...word,studyExplanationLanguage:'en'}])assert.equal(vocabularyLearningContent(q,{language:'en',locale:'ko',fallbackWord}).example,undefined);
});
