import {escapeHtml as e} from './ui.js';
/** Answer-only reading alignment: never reveal a kana answer before submission. */
export function renderExerciseExplanation(question){
 if(!question.exercise)return '';
 const segments=question.segments?.map(segment=>`<span class="reading-segment ${segment.kind}"><ruby>${e(segment.text)}<rt>${e(segment.reading)}</rt></ruby></span>`).join('');
 return `<div class="exercise-explanation">${segments?`<div class="reading-segments" lang="ja">${segments}</div>`:''}<p>${e(question.explanation)}</p></div>`;
}
export function renderExercisePrompt(question){return `<p class="muted">${e(question.instruction)}</p><p class="lexicon-prompt" lang="${e(question.word.language||'')}">${e(question.prompt)}</p>`;}
