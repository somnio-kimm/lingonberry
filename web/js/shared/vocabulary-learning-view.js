import {escapeHtml as e} from './ui.js';
import {vocabularyLearningContent,vocabularyLearningLabels} from './vocabulary-learning.js';
export function renderVocabularyHints(question,{language,locale,audioButton}){
 const content=vocabularyLearningContent(question,{language,locale}),labels=vocabularyLearningLabels(locale);
 return `<div class="vocab-hints"><details class="vocab-hint" data-sound-hint><summary>${labels.sound}</summary><div class="vocab-hint-content">${audioButton}</div></details>${content.hint?`<details class="vocab-hint" data-example-hint><summary>${labels.example}</summary><p class="vocab-context-hint" lang="${e(language)}">${e(content.hint[0])}<span class="cloze-blank">______</span>${e(content.hint[1])}</p></details>`:''}</div>`;
}
export function renderVocabularyLearning(question,{language,locale,fallbackWord,renderWord,renderExample=example=>`<div class="example-sentence">${e(example.text)}</div>`}){
 const content=vocabularyLearningContent(question,{language,locale,fallbackWord}),labels=vocabularyLearningLabels(locale);
 return `<section class="panel card vocab-learning" data-vocabulary-learning><div class="vocab-learning-word" lang="${e(language)}">${renderWord?renderWord(question.word):e(content.word)}</div><p class="vocab-learning-meaning" lang="${e(question.word.studyExplanationLanguage||question.locale||locale)}">${e(content.meaning)}</p>${content.example?`<div class="study-example"><div class="vocab-learning-example-heading"><h3>${labels.examples}</h3><button class="word-listen" data-learning-example aria-label="${locale==='ko'?'예문 듣기':'Listen to Example'}">🔊</button></div><div class="vocab-learning-example" lang="${e(language)}">${renderExample(content.example)}</div>${content.example.studyTranslation?`<p class="example-translation" lang="${e(question.word.studyExplanationLanguage||question.locale||locale)}">${e(content.example.studyTranslation)}</p>`:''}</div>`:''}</section>`;
}
