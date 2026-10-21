import {createVocabularyEngine,vocabularyWord,normalize} from '../../../../js/shared/vocabulary.js';
export {VOCABULARY_MODES,vocabularyWord,vocabularyType,vocabularyMeaning,snapshotVocabularyQuestion,validVocabularyQuestion} from '../../../../js/shared/vocabulary.js';
export const requiresNounArticle=word=>word?.pos==='noun'&&['der','die','das'].includes(word.article);
export const nounArticles=word=>[...new Set([word?.article,...(word?.accepted_articles||[])])].filter(article=>['der','die','das'].includes(article));
export const vocabularyInputAnswer=word=>requiresNounArticle(word)?word.article+' '+vocabularyWord(word):vocabularyWord(word);
export const vocabularyExpectedAnswer=question=>question.mode==='vocabinput'&&!question.collocationId&&requiresNounArticle(question.word)?vocabularyInputAnswer(question.word):question.answer;
function gradeInput(question,input) {
 let answers=question.acceptedAnswers||[question.answer];
 if(requiresNounArticle(question.word)){
  // Old snapshots accepted bare nouns; current recall still requires their article.
  const key=value=>normalize(value).replace(/^(Der|Die|Das)(?= )/u,article=>article.toLowerCase());
  answers=[...answers.filter(answer=>/^(der|die|das) /u.test(key(answer))),...nounArticles(question.word).map(article=>article+' '+vocabularyWord(question.word))];
  return answers.some(answer=>key(input)===key(answer));
 }
 return answers.some(answer=>normalize(input)===normalize(answer));
}
export const {createVocabularyPool,vocabularyQuestions,vocabularyAnswerCorrect}=createVocabularyEngine({inputAnswer:vocabularyInputAnswer,gradeInput});
