import test from 'node:test';
import assert from 'node:assert/strict';
import {SCREENS as germanScreens,HOME_MODES as germanModes} from '../web/languages/de/js/app-definition.js';
import {SCREENS as chineseScreens,HOME_MODES as chineseModes} from '../web/languages/zh/js/app-definition.js';
import {germanWords,chineseWords} from '../web/js/presentation/words.js';
import {exerciseModes,isActiveExerciseCategory} from '../web/js/shared/language-exercises.js';
import {collocationQuestions} from '../web/js/shared/collocations.js';
import {renderCollocations,collocationPreview} from '../web/js/shared/collocation-view.js';
import {createVocabularyEngine,validVocabularyQuestion} from '../web/js/shared/vocabulary.js';
import {dictionaryEntries} from '../web/languages/de/js/core/dictionary.js';
import {matchesWordSearch,wordSearchQuery} from '../web/languages/zh/js/services/word-search.js';
for(const [language,project,screens,modes,word,phrase]of [
 ['de',germanWords,germanScreens,germanModes,'Entscheidung','eine Entscheidung treffen'],
 ['zh',chineseWords,chineseScreens,chineseModes,'电话','打电话'],
]){
 test(`${language}: collocations have no active Study route, word preview, detail, search or fresh question`,()=>{
  const entry={id:'anchor',word,article:language==='de'?'die':undefined,partOfSpeech:'noun',level:language==='de'?'A1':'1',meaning:'decision',collocations:[{id:'phrase',phrase,meaning:'make a decision',acceptedAnswers:[],example:phrase,exampleTranslation:'Make a decision.',meaningChoices:['make a decision','drink tea','read a book']}]};
  const study={targetLanguage:language,explanationLanguage:'en',entries:[entry]},original=structuredClone(study),projected=project(study)[0];
  assert.equal(screens.collocations,undefined);assert.ok(!modes.includes('collocations'));assert.equal(exerciseModes(language).collocations,undefined);assert.equal(isActiveExerciseCategory(language,'collocations'),false);
  assert.deepEqual(projected.collocations,[]);assert.equal(projected.id,entry.id);assert.equal(projected.studyMeaning,entry.meaning);assert.equal(collocationPreview(projected),'');assert.equal(renderCollocations(projected),'');assert.equal(createVocabularyEngine().createVocabularyPool('vocabinput',[projected],'en','collocations').choose(),undefined);
  if(language==='de')assert.equal(dictionaryEntries([projected],{query:phrase}).length,0);else assert.equal(matchesWordSearch(projected,wordSearchQuery(phrase)),false);
  assert.deepEqual(study,original,'Immutable package content is preserved');
 });
 test(`${language}: historical collocation input and meaning snapshots remain valid and gradable`,()=>{
  const word={id:'saved-anchor',lemma:language==='de'?'Entscheidung':undefined,hanzi:language==='zh'?'电话':undefined,studyLanguage:language,collocations:[{id:'saved-phrase',phrase,meaning:'make a decision',acceptedAnswers:['alternative phrase'],example:phrase,exampleTranslation:'Make a decision.',meaningChoices:['make a decision','drink tea','read a book']}]},engine=createVocabularyEngine();
  for(const mode of ['vocabinput','vocabmeaning']){const [question]=collocationQuestions(mode,[word],'en'),before=structuredClone(question);assert.ok(validVocabularyQuestion(question));assert.equal(engine.vocabularyAnswerCorrect(question,mode==='vocabinput'?phrase:word.id),true);assert.equal(engine.vocabularyAnswerCorrect(question,'incorrect'),false);assert.deepEqual(question,before);}
 });
}
test('other active language collocation sections and German/Chinese specialist modes remain available',()=>{
 for(const language of ['en','ko','es','fr'])assert.ok(exerciseModes(language).collocations);
 for(const mode of ['articles','verbforms'])assert.ok(germanScreens[mode]);for(const mode of ['pinyin','tone'])assert.ok(chineseScreens[mode]);
});
