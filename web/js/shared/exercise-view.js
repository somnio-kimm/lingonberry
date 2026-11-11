import {japaneseReadingContext,japaneseReadingPrompt} from './japanese-reading-prompt.js';
import {localizeExerciseText} from './exercise-text.js';
import {localizeRootPromptOrigin} from './root-references.js';
import {renderPhraseGapSentence} from './phrase-gap-view.js';
import {escapeHtml as e} from './ui.js';
/** Render answer slots as the shared single underline; preserve marked characters. */
export function renderExerciseGap(text,locale='en',variant='quiz',answer){
 const pattern=/(?:【[\s＿_]*】|［[\s＿_]*］|\[[\s＿_]*\]|（[\s＿_]*）|\([\s＿_]*\)|_{2,})/gu;
 const source=String(text);
 const answerMarkup=answer===undefined?'':`<mark class="cloze-answer">${e(answer)}</mark>`;
 let result='',at=0;
 for(const match of source.matchAll(pattern)){
  const slot=answerMarkup||`<span class="${variant==='review'?'wrong-test-slot wrong-test-blank':'form-question-blank'}" role="img" aria-label="${locale==='ko'?'빈칸':'Blank'}"></span>`;
  result+=e(source.slice(at,match.index))+slot;
  at=match.index+match[0].length;
 }
 return result+e(source.slice(at))+(at===0&&answerMarkup?' '+answerMarkup:'');
}
/** Answer-only reading alignment: never reveal a kana answer before submission. */
export function renderExerciseExplanation(question){
 if(!question.exercise)return '';
 const segments=question.segments?.map(segment=>`<span class="reading-segment ${segment.kind}">${segment.kind==='kanji'?`<ruby>${e(segment.text)}<rt>${e(segment.reading)}</rt></ruby>`:e(segment.text)}</span>`).join('');
 const prose=question.category==='okurigana'||!question.explanation?'':`<p lang="${e(question.locale||question.word?.studyExplanationLanguage||'')}">${e(question.explanation)}</p>`;
 if(!segments&&!prose)return '';
 return `<div class="exercise-explanation">${segments?`<div class="reading-segments" lang="ja">${segments}</div>`:''}${prose}</div>`;
}
export function renderExercisePrompt(question,options={}){
 const display=options.uiLanguage||question.locale||'en',uiLang=display==='ko'?'ko':'en-GB';
 const renderContext=clue=>clue?`<p class="grammar-meaning exercise-context" lang="${e(question.word.studyExplanationLanguage||question.locale||'')}">${e(clue)}</p>`:'';
 if(question.category==='reading'){
  const target=japaneseReadingPrompt(question.word,question.prompt,question.readingFocus);
  if(!target)return '';
  const {prompt,readingFocus:focus}=target;
  const marked=e(prompt.slice(0,focus.start))+`<span class="study-reading-target">${e(focus.text)}</span>`+e(prompt.slice(focus.start+focus.text.length));
  const clue=question.context===''?'':japaneseReadingContext(question.word,prompt,question.context);
  return `<div class="vocab-prompt lexicon-prompt" lang="ja">${marked}</div>${renderContext(clue)}`;
 }
 const context=renderContext(question.context);
 if(question.gapFill)return `${renderPhraseGapSentence(question,{...options,uiLanguage:display})}${context}`;
 const lang=e(question.word.studyLanguage||question.word.language||'');
 const prompt=question.category==='roots'?localizeRootPromptOrigin(question.prompt,display):question.prompt;
 if(question.route==='forms'||question.mode==='forms'){
  const word=question.word;
  return `<div class="form-original-word"><div class="grammar-word form-base-word lexicon-word" lang="${lang}">${word.pronunciation?`<ruby>${e(word.lemma||word.word||'')}<rt>${e(word.pronunciation)}</rt></ruby>`:e(word.lemma||word.word||'')}</div>${word.studyMeaning?`<p class="grammar-meaning">${e(word.studyMeaning)}</p>`:''}</div><div class="form-problem"><div class="${question.condition?'grammar-prompt':'vocab-prompt lexicon-prompt'}" lang="${question.condition?uiLang:lang}">${renderExerciseGap(question.condition?localizeExerciseText(question.condition,display):question.prompt,display)}</div></div>`;
 }

 return `<div class="vocab-prompt lexicon-prompt" lang="${lang}">${renderExerciseGap(prompt,display,'quiz',options.inlineAnswer)}</div>${context}`;
}
