import {escapeHtml as e} from './ui.js';
import {vocabularyWord,vocabularyMeaning} from './vocabulary.js';

/** Keep the current-language word meaning separate from the original test prompt. */
export function createVocabularyReview({requiresNounArticle=()=>false,vocabularyInputAnswer=vocabularyWord}={}) {
return function vocabularyReview({mode, question, word, locale, prompt = '', example, questionLocale, correctAnswer = '', userAnswer = ''}) {
  const savedWord = {...word, ...question?.word};
  const originalLocale = question?.locale || questionLocale;
  const savedPrompt = question?.prompt || prompt;
  let meaning = vocabularyMeaning(savedWord, locale);
  if (!meaning) meaning = question?.example?.[locale] || example?.[locale] || '';
  if (!meaning && originalLocale === locale) meaning = mode === 'vocabinput' ? savedPrompt : question?.answer || correctAnswer;
  return {
    mode, requiresArticle: mode === 'vocabinput' && !question?.collocationId && requiresNounArticle(savedWord), word: vocabularyWord(savedWord) || question?.example?.de || example?.de || '', wordId: savedWord.id,
    meaning, locale: originalLocale, prompt: savedPrompt,
    correctAnswer: mode === 'vocabinput' && !question?.collocationId && requiresNounArticle(savedWord) ? vocabularyInputAnswer(savedWord) : question?.answer || correctAnswer, userAnswer,
    collocationPhrase:question?.collocationId?question.phrase:undefined,
    options: mode === 'vocabmeaning' && Array.isArray(question?.options) ? question.options : [],
  };
}

}

export function vocabularyReviewQuestion(review, labels, wordLanguage, wordPromptMarkup = '') {
  return `<div class="wrong-question-block wrong-vocab-question"><div class="wrong-question-head"><span>${e(labels.question)}</span>${review.locale ? `<span class="wrong-question-language">${e(review.locale.toUpperCase())}</span>` : ''}</div><p class="wrong-question-instruction">${e(review.mode === 'vocabinput' ? review.requiresArticle ? labels.nounInput || labels.input : labels.input : labels.meaning)}</p><div class="wrong-question wrong-vocab-prompt" lang="${e(review.mode === 'vocabinput' ? review.locale || '' : wordLanguage)}">${review.prompt ? wordPromptMarkup || e(review.prompt) : e(labels.unavailable)}</div></div>`;
}

export function vocabularyReviewChoices(review, labels) {
  if (!review.options.length) return '';
  return `<div class="wrong-choice-list">${review.collocationPhrase?`<p class="wrong-vocab-prompt">${e(review.collocationPhrase)}</p>`:''}<ol class="vocab-review-options">${review.options.map(option => {
    const correct = option.id === review.wordId, wrong = !correct && option.text === review.userAnswer;
    return `<li class="vocab-review-option ${correct ? 'correct' : wrong ? 'wrong' : ''}" lang="${e(review.locale || '')}"><span class="wrong-choice-text">${wrong ? `<del>${e(option.text)}</del>` : e(option.text)}</span>${wrong ? `<span class="wrong-choice-status">${e(labels.yours)}</span>` : ''}</li>`;
  }).join('')}</ol></div>`;
}

/** Translate a selected meaning for display without rewriting the saved answer. */
export function localizedReviewAnswer(review,locale,findWord=()=>undefined) {
 const original={text:review.userAnswer,locale:review.locale};
 if(review.mode!=='vocabmeaning'||review.locale===locale)return original;
 const selected=review.options.find(option=>option.text===review.userAnswer);
 if(!selected)return original;
 const text=selected.meanings?.[locale]||vocabularyMeaning(findWord(selected.id)||{},locale);
 return text?{text,locale}:original;
}
