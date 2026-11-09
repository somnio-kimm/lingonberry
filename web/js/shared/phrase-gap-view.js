import {escapeHtml as e} from './ui.js';
import {gradePhraseGaps,splitGapAnswers} from './phrase-gaps.js';
export function renderPhraseGapSentence(question,{input='',checked=false,editable=false,uiLanguage=question.locale,variant='quiz'}={}) {
 const gap=question.gapFill,given=splitGapAnswers(input),result=gradePhraseGaps(gap,given),ko=uiLanguage==='ko';
 const blanks=gap.answers.map((_,index)=>{
  const label=`${ko?'빈칸':'Blank'} ${index+1}`;
  if(checked)return `<mark class="cloze-answer">${e(result.answers[index])}</mark>`;
  if(editable)return `<input class="phrase-gap-input" data-phrase-gap="${index}" aria-label="${label}" lang="${e(question.word.studyLanguage||question.word.language||'en')}" type="text" inputmode="text" enterkeyhint="${index===gap.answers.length-1?'done':'next'}" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" maxlength="80" value="${e(given[index]||'')}">`;
  return `<span class="${variant==='review'?'wrong-test-slot wrong-test-blank':'form-question-blank'}" role="img" aria-label="${label}"></span>`;
 });
 const classes=variant==='review'?'wrong-question':variant==='sentence'?'phrase-gap-sentence':'vocab-prompt lexicon-prompt phrase-gap-sentence';
 return `<div class="${classes}">${gap.parts.map((part,index)=>e(part)+(blanks[index]||'')).join('')}</div>`;
}
