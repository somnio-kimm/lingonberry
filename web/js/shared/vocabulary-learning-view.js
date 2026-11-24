import {renderStudyHint} from './study-components.js';
import {escapeHtml as e} from './ui.js';
import {vocabularyLearningContent,vocabularyLearningLabels} from './vocabulary-learning.js';
export function renderVocabularyHints(question,{language,locale}){
 const {hint}=vocabularyLearningContent(question,{language,locale});
 if(!hint)return '';
 const labels=vocabularyLearningLabels(locale);
 return renderStudyHint({label:labels.hint,body:`<p class="vocab-context-hint" lang="${e(language)}">${e(hint[0])}<span class="cloze-blank">______</span>${e(hint[1])}</p>`});
}
export function renderVocabularyLearning(question,{language,locale,fallbackWord,renderWord,renderExample=example=>`<div class="example-sentence">${e(example.text)}</div>`}){
 const content=vocabularyLearningContent(question,{language,locale,fallbackWord}),labels=vocabularyLearningLabels(locale);
 return `<section class="vocab-learning" data-vocabulary-learning><div class="study-sheet-core"><h2 id="vocab-result-word" class="study-headword" lang="${e(language)}">${renderWord?renderWord(question.word):e(content.word)}</h2><p class="study-sheet-meaning vocab-learning-meaning" lang="${e(question.word.studyExplanationLanguage||question.locale||locale)}">${e(content.meaning)}</p></div>${content.example?`<div class="study-example"><div class="vocab-learning-example-heading"><h3>${labels.examples}</h3><button class="word-listen" data-learning-example aria-label="${locale==='ko'?'예문 듣기':'Listen to Example'}">🔊</button></div><div class="vocab-learning-example" lang="${e(language)}">${renderExample(content.example)}</div>${content.example.studyTranslation?`<p class="example-translation" lang="${e(question.word.studyExplanationLanguage||question.locale||locale)}">${e(content.example.studyTranslation)}</p>`:''}</div>`:''}</section>`;
}

export function renderVocabularyResult(question,config,{speaker}){
 const close=config.locale==='ko'?'닫기':'Close';
 return `<dialog class="detail-sheet study-detail-sheet vocab-result-sheet" data-vocab-result aria-labelledby="vocab-result-word">
  <div class="detail-sheet-head"><button type="button" class="detail-sheet-icon detail-sheet-close" data-close-vocab-result aria-label="${e(close)}" autofocus>×</button><div class="detail-sheet-head-center"></div>${speaker}</div>
  ${renderVocabularyLearning(question,config)}
  <p class="vocab-speech-status lexicon-audio-status" role="status" hidden></p>
  <div class="quiz-next-bar" data-vocab-result-actions></div>
 </dialog>`;
}
