import {escapeHtml as e} from './ui.js';
import {gradePhraseGaps,splitGapAnswers} from './phrase-gaps.js';
export function renderPhraseGapSentence(question,{input='',checked=false,editable=false}={}) {
 const gap=question.gapFill,given=splitGapAnswers(input),result=gradePhraseGaps(gap,given),ko=question.locale==='ko';
 const blanks=gap.answers.map((_,index)=>{
  const label=`${ko?'빈칸':'Blank'} ${index+1}`;
  if(checked){
   const correct=result.matches[index];
   return `<span class="phrase-gap-result ${correct?'correct':'wrong'}"><span class="input-correction">${e(result.answers[index])}</span>${!correct?`<del class="input-wrong">${e(given[index]||'')}</del>`:''}</span>`;
  }
  if(editable)return `<input class="phrase-gap-input" data-phrase-gap="${index}" aria-label="${label}" lang="${e(question.word.language||'en')}" type="text" inputmode="text" enterkeyhint="${index===gap.answers.length-1?'done':'next'}" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" maxlength="80" value="${e(given[index]||'')}">`;
  return `<span class="form-question-blank" role="img" aria-label="${label}"></span>`;
 });
 return `<div class="vocab-prompt lexicon-prompt phrase-gap-sentence">${gap.parts.map((part,index)=>e(part)+(blanks[index]||'')).join('')}</div>`;
}
