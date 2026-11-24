import {escapeHtml as e} from './ui.js';
import {vocabularyLearningContent,vocabularyLearningLabels} from './vocabulary-learning.js';
export function renderVocabularyHints(question,{language,locale}){
 const {hint}=vocabularyLearningContent(question,{language,locale});
 if(!hint)return '';
 const labels=vocabularyLearningLabels(locale);
 return `<details class="vocab-hint" data-vocabulary-hint>
  <summary>${e(labels.hint)}</summary>
  <p class="vocab-context-hint" lang="${e(language)}">${e(hint[0])}<span class="cloze-blank">______</span>${e(hint[1])}</p>
 </details>`;
}
export function renderVocabularyLearning(question,{language,locale,fallbackWord,renderWord,renderExample=example=>`<div class="example-sentence">${e(example.text)}</div>`}){
 const content=vocabularyLearningContent(question,{language,locale,fallbackWord}),labels=vocabularyLearningLabels(locale);
 return `<section class="panel card vocab-learning" data-vocabulary-learning><div class="vocab-learning-word" lang="${e(language)}">${renderWord?renderWord(question.word):e(content.word)}</div><p class="vocab-learning-meaning" lang="${e(question.word.studyExplanationLanguage||question.locale||locale)}">${e(content.meaning)}</p>${content.example?`<div class="study-example"><div class="vocab-learning-example-heading"><h3>${labels.examples}</h3><button class="word-listen" data-learning-example aria-label="${locale==='ko'?'예문 듣기':'Listen to Example'}">🔊</button></div><div class="vocab-learning-example" lang="${e(language)}">${renderExample(content.example)}</div>${content.example.studyTranslation?`<p class="example-translation" lang="${e(question.word.studyExplanationLanguage||question.locale||locale)}">${e(content.example.studyTranslation)}</p>`:''}</div>`:''}</section>`;
}
