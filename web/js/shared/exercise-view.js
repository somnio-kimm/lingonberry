import {escapeHtml as e} from './ui.js';
/** Answer-only reading alignment: never reveal a kana answer before submission. */
export function renderExerciseExplanation(question){
 if(!question.exercise)return '';
 const segments=question.segments?.map(segment=>`<span class="reading-segment ${segment.kind}">${segment.kind==='kanji'?`<ruby>${e(segment.text)}<rt>${e(segment.reading)}</rt></ruby>`:e(segment.text)}</span>`).join('');
 return `<div class="exercise-explanation">${segments?`<div class="reading-segments" lang="ja">${segments}</div>`:''}<p>${e(question.explanation)}</p></div>`;
}
export function renderExercisePrompt(question){
 const lang=e(question.word.language||'');
 if(question.route==='forms'||question.mode==='forms'){
  const word=question.word;
  return `<div class="form-original-word"><div class="grammar-word form-base-word lexicon-word" lang="${lang}">${word.pronunciation?`<ruby>${e(word.lemma||word.word||'')}<rt>${e(word.pronunciation)}</rt></ruby>`:e(word.lemma||word.word||'')}</div>${word.studyMeaning?`<p class="grammar-meaning">${e(word.studyMeaning)}</p>`:''}</div><div class="form-problem"><p class="vocab-instruction">${e(question.instruction)}</p><div class="${question.condition?'grammar-prompt':'vocab-prompt lexicon-prompt'}" lang="${lang}">${e(question.condition||question.prompt)}</div></div>`;
 }

 return `<p class="vocab-instruction">${e(question.instruction)}</p><div class="vocab-prompt lexicon-prompt" lang="${lang}">${e(question.prompt)}</div>${question.context?`<p class="grammar-meaning exercise-context">${e(question.context)}</p>`:''}`;
}
