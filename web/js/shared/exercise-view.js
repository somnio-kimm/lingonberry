import {japaneseReadingPrompt} from './japanese-reading-prompt.js';
import {lexiconText} from './lexicon-text.js';
import {localizeExerciseText} from './exercise-text.js';
import {localizeRootPromptOrigin} from './root-references.js';
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
 const prose=question.category==='okurigana'?'':`<p lang="${e(question.locale||question.word?.studyExplanationLanguage||'')}">${e(question.explanation)}</p>`;
 if(!segments&&!prose)return '';
 return `<div class="exercise-explanation">${segments?`<div class="reading-segments" lang="ja">${segments}</div>`:''}${prose}</div>`;
}
export function renderExercisePrompt(question,options={}){
 const display=options.uiLanguage||question.locale||'en',uiLang=display==='ko'?'ko':'en-GB',instruction=localizeExerciseText(question.instruction,display);
 const context=question.context?`<p class="grammar-meaning exercise-context" lang="${e(question.word.studyExplanationLanguage||question.locale||'')}">${e(question.context)}</p>`:'';
 if(question.category==='reading'){
  const {prompt,readingFocus:focus}=japaneseReadingPrompt(question.word,question.prompt);
  const readingInstruction=lexiconText(display,question.options?'Choose the reading of the underlined word.':'Type the reading of the underlined word in hiragana.');
  const marked=e(prompt.slice(0,focus.start))+`<span class="study-reading-target">${e(focus.text)}</span>`+e(prompt.slice(focus.start+focus.text.length));
  return `<p class="vocab-instruction" lang="${uiLang}">${e(readingInstruction)}</p><div class="vocab-prompt lexicon-prompt" lang="ja">${marked}</div>${context}`;
 }
 if(question.gapFill)return `<p class="vocab-instruction" lang="${uiLang}">${e(instruction)}</p>${renderPhraseGapSentence(question,{...options,uiLanguage:display})}${context}`;
 const lang=e(question.word.studyLanguage||question.word.language||'');
 const prompt=question.category==='roots'?localizeRootPromptOrigin(question.prompt,display):question.prompt;
 if(question.route==='forms'||question.mode==='forms'){
  const word=question.word;
  return `<div class="form-original-word"><div class="grammar-word form-base-word lexicon-word" lang="${lang}">${word.pronunciation?`<ruby>${e(word.lemma||word.word||'')}<rt>${e(word.pronunciation)}</rt></ruby>`:e(word.lemma||word.word||'')}</div>${word.studyMeaning?`<p class="grammar-meaning">${e(word.studyMeaning)}</p>`:''}</div><div class="form-problem"><p class="vocab-instruction" lang="${uiLang}">${e(instruction)}</p><div class="${question.condition?'grammar-prompt':'vocab-prompt lexicon-prompt'}" lang="${question.condition?uiLang:lang}">${renderExerciseGap(question.condition?localizeExerciseText(question.condition,display):question.prompt,display)}</div></div>`;
 }

 return `<p class="vocab-instruction" lang="${uiLang}">${e(instruction)}</p><div class="vocab-prompt lexicon-prompt" lang="${lang}">${renderExerciseGap(prompt,display)}</div>${context}`;
}
