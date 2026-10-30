import {japaneseReadingPrompt} from './japanese-reading-prompt.js';
import {lexiconText} from './lexicon-text.js';
import {renderPhraseGapSentence} from './phrase-gap-view.js';
import {escapeHtml as e} from './ui.js';
/** Render answer slots as the shared single underline; preserve marked characters. */
export function renderExerciseGap(text,locale='en'){
 const pattern=/(?:【[\s＿_]*】|［[\s＿_]*］|\[[\s＿_]*\]|（[\s＿_]*）|\([\s＿_]*\)|_{2,})/gu;
 let result='',at=0;
 for(const match of String(text).matchAll(pattern)){result+=e(String(text).slice(at,match.index))+`<span class="form-question-blank" role="img" aria-label="${locale==='ko'?'빈칸':'Blank'}"></span>`;at=match.index+match[0].length;}
 return result+e(String(text).slice(at));
}
/** Answer-only reading alignment: never reveal a kana answer before submission. */
export function renderExerciseExplanation(question){
 if(!question.exercise)return '';
 const segments=question.segments?.map(segment=>`<span class="reading-segment ${segment.kind}">${segment.kind==='kanji'?`<ruby>${e(segment.text)}<rt>${e(segment.reading)}</rt></ruby>`:e(segment.text)}</span>`).join('');
 return `<div class="exercise-explanation">${segments?`<div class="reading-segments" lang="ja">${segments}</div>`:''}<p>${e(question.explanation)}</p></div>`;
}
export function renderExercisePrompt(question,options={}){
 if(question.category==='reading'){
  const {prompt,readingFocus:focus}=japaneseReadingPrompt(question.word,question.prompt),display=options.uiLanguage||question.locale||'en';
  const instruction=lexiconText(display,question.options?'Choose the reading of the underlined word.':'Type the reading of the underlined word in hiragana.');
  const marked=e(prompt.slice(0,focus.start))+`<span class="study-reading-target">${e(focus.text)}</span>`+e(prompt.slice(focus.start+focus.text.length));
  return `<p class="vocab-instruction">${e(instruction)}</p><div class="vocab-prompt lexicon-prompt" lang="ja">${marked}</div>${question.context?`<p class="grammar-meaning exercise-context">${e(question.context)}</p>`:''}`;
 }
 if(question.gapFill)return `<p class="vocab-instruction">${e(question.instruction)}</p>${renderPhraseGapSentence(question,options)}${question.context?`<p class="grammar-meaning exercise-context">${e(question.context)}</p>`:''}`;
 const lang=e(question.word.language||'');
 if(question.route==='forms'||question.mode==='forms'){
  const word=question.word;
  return `<div class="form-original-word"><div class="grammar-word form-base-word lexicon-word" lang="${lang}">${word.pronunciation?`<ruby>${e(word.lemma||word.word||'')}<rt>${e(word.pronunciation)}</rt></ruby>`:e(word.lemma||word.word||'')}</div>${word.studyMeaning?`<p class="grammar-meaning">${e(word.studyMeaning)}</p>`:''}</div><div class="form-problem"><p class="vocab-instruction">${e(question.instruction)}</p><div class="${question.condition?'grammar-prompt':'vocab-prompt lexicon-prompt'}" lang="${lang}">${renderExerciseGap(question.condition||question.prompt,question.locale)}</div></div>`;
 }

 return `<p class="vocab-instruction">${e(question.instruction)}</p><div class="vocab-prompt lexicon-prompt" lang="${lang}">${renderExerciseGap(question.prompt,question.locale)}</div>${question.context?`<p class="grammar-meaning exercise-context">${e(question.context)}</p>`:''}`;
}
