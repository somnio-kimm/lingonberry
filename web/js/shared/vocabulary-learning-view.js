import {renderStudyHint} from './study-components.js';
import {escapeHtml as e} from './ui.js';
import {vocabularyLearningContent,vocabularyLearningLabels} from './vocabulary-learning.js';
export function renderVocabularyHints(question,{language,locale}){
 const {hint}=vocabularyLearningContent(question,{language,locale});
 if(!hint)return '';
 const labels=vocabularyLearningLabels(locale);
 return renderStudyHint({label:labels.hint,body:`<p class="vocab-context-hint" lang="${e(language)}">${e(hint[0])}<span class="cloze-blank">______</span>${e(hint[1])}</p>`});
}
