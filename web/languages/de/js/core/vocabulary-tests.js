import {formAlternatives} from './form-alternatives.js';
import {createVocabularyEngine,vocabularyWord,normalize} from '../../../../js/shared/vocabulary.js';
export {VOCABULARY_MODES,vocabularyWord,vocabularyType,vocabularyMeaning,snapshotVocabularyQuestion,validVocabularyQuestion} from '../../../../js/shared/vocabulary.js';
const hasNounArticle=word=>word?.pos==='noun'&&['der','die','das'].includes(word.article);
export const requiresNounArticle=word=>hasNounArticle(word)&&word.article_optional!==true;
export const nounArticles=word=>[...new Set([word?.article,...(word?.accepted_articles||[])])].filter(article=>['der','die','das'].includes(article));
export const vocabularyInputAnswer=word=>requiresNounArticle(word)?word.article+' '+vocabularyWord(word):vocabularyWord(word);
const inputAnswers=word=>{
 const spellings=[...new Set([vocabularyWord(word),...(word.aliases||[])].map(normalize).filter(Boolean))];
 const withArticles=nounArticles(word).flatMap(article=>spellings.map(spelling=>article+' '+spelling));
 if(word.pos==='noun'&&word.article_optional===true)return [...new Set([...spellings,...withArticles,...formAlternatives(word.declension?.nom?.[0])])];
 return requiresNounArticle(word)?withArticles:spellings;
};
export const vocabularyExpectedAnswer=question=>question.mode==='vocabinput'&&!question.collocationId&&requiresNounArticle(question.word)?vocabularyInputAnswer(question.word):question.answer;
function gradeInput(question,input) {
 let answers=question.acceptedAnswers||[question.answer];
 const key=value=>hasNounArticle(question.word)?normalize(value).replace(/^(Der|Die|Das)(?= )/u,article=>article.toLowerCase()):normalize(value);
 if(requiresNounArticle(question.word)){
  // Old snapshots accepted bare nouns; current recall still requires their article.
  answers=[...answers.filter(answer=>/^(der|die|das) /u.test(key(answer))),...nounArticles(question.word).map(article=>article+' '+vocabularyWord(question.word))];
 }
 return answers.some(answer=>key(input)===key(answer));
}
export const {createVocabularyPool,vocabularyQuestions,vocabularyAnswerCorrect}=createVocabularyEngine({inputAnswer:vocabularyInputAnswer,inputAnswers,gradeInput});
