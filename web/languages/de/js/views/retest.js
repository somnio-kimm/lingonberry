import { studyLevelLabel } from '../app-definition.js';
import { renderListeningTest } from './listening.js';
import { renderWordInput, renderMeaningQuiz } from './vocabulary-tests.js';
import { t } from '../core/i18n.js';
import { escapeHtml as e, showQuizBurst } from '../../../../js/shared/ui.js';
import { recordRetestResult,retestScore,advanceRetest,modeLabels } from '../core/retest.js';
import { judgeAnswer } from '../core/assessment.js';
import { speakGerman,stopMedia } from '../core/media.js';
import { renderCloze,renderScramble } from './sentence-quizzes.js';
import { renderArticles,renderVerbForms,renderCases,renderAdjectiveEndings } from './grammar-quizzes.js';
function renderSaved(el,ctx,item,options){
 let feedback=null,input='';const q=item.question;
 function draw(){
  const dialogue=item.unit.reading?.dialogue?.map(line=>line.text).join('\n')||'',script=item.unit.listening?.script||'';
  el.innerHTML=`<section class='panel saved-review'><span class='badge'>${e(studyLevelLabel(item.unit.level))} · ${t(modeLabels[item.stage])}</span><h2>${e(q.prompt)}</h2>${item.stage==='reading'?`<p class='saved-review-context' lang='de'>${e(dialogue)}</p>`:''}${item.stage==='listening'?`<button class='secondary' id='saved-speak'>${t('Speak sentence')}</button>`:''}${q.sentence?`<p lang='de' class='exercise-sentence'>${e(feedback?q.sentence.replace('___',q.answer):q.sentence)}</p>`:''}${feedback?`<p class='correct-answer' lang='de'>${e(q.answer)}</p><del class='wrong-answer' lang='de'>${feedback.correct?'':e(input)}</del><p>${e(feedback.explanation)}</p><div class='quiz-next-bar'><button class='primary' id='saved-next'>${t('Next')}</button></div>`:`<input id='saved-answer' aria-label='${t('Your answer')}' autocomplete='off'><div class='quiz-action-bar'><button class='primary' id='saved-submit'>${t('Submit')}</button><button class='btn-small' id='saved-skip'>${t('Skip')}</button></div>`}</section>`;
  el.querySelector('#saved-speak')?.addEventListener('click',()=>speakGerman(script,()=>{},()=>{}));
  const submit=()=>{if(feedback)return;input=el.querySelector('#saved-answer').value;if(!input.trim())return;feedback=judgeAnswer(q,input);showQuizBurst(feedback.correct);ctx.store.recordReviewAnswer(item.unit.id,q,input,feedback);options.onAnswer(feedback.correct,input);ctx.haptic();draw();ctx.updateStatus();};
  el.querySelector('#saved-skip')?.addEventListener('click',options.onSkip);
  el.querySelector('#saved-submit')?.addEventListener('click',submit);el.querySelector('#saved-answer')?.addEventListener('keydown',ev=>{if(ev.key==='Enter')submit();});el.querySelector('#saved-next')?.addEventListener('click',options.onNext);
 }
 draw();return stopMedia;
}
export function renderRetest(el,ctx){
 const session=ctx.retestSession;let cleanup=()=>{};
 function draw(){
  cleanup();cleanup=()=>{};
  if(!session){el.innerHTML=`<section class='panel'><p>${t('Choose mistakes in Review to start a re-test.')}</p><button class='primary' id='retest-done'>${t('Back to Review')}</button></section>`;el.querySelector('#retest-done').onclick=()=>ctx.navigate('wrong');return;}
  if(session.index>=session.items.length){const score=retestScore(session);el.innerHTML=`<section class='panel retest-complete'><h2>${t('Re-test complete')}</h2><p class='retest-summary'><span>${t('Correct')}: ${score.correct}</span><span>${t('Incorrect')}: ${score.incorrect}</span><span>${t('Skipped')}: ${score.skipped}</span></p><button class='primary' id='retest-done'>${t('Next')}</button></section>`;el.querySelector('#retest-done').onclick=()=>ctx.navigate('wrong');return;}
  const item=session.items[session.index];el.innerHTML=`<div class='retest-progress' role='status'>${t('Question')} ${session.index+1} / ${session.items.length}</div><div id='retest-question' data-review-mode='${item.mode}' data-review-id='${e(item.question.id)}'></div>`;
  const options={question:item.question,score:()=>retestScore(session),onAnswer:(correct,input)=>recordRetestResult(session,{correct,input}),onNext:()=>{if(advanceRetest(session)){ctx.haptic();draw();window.scrollTo(0,0);}},onSkip:()=>{recordRetestResult(session,{skipped:true});if(advanceRetest(session)){ctx.haptic();draw();window.scrollTo(0,0);}}};
  const host=el.querySelector('#retest-question'),renderers={cloze:renderCloze,scramble:renderScramble,articles:renderArticles,verbforms:renderVerbForms,cases:renderCases,adjendings:renderAdjectiveEndings,vocabinput:renderWordInput,vocabmeaning:renderMeaningQuiz,listenword:renderListeningTest,listensentence:renderListeningTest};cleanup=item.mode==='saved'?renderSaved(host,ctx,item,options):renderers[item.mode](host,ctx,options);
 }
 draw();return()=>{cleanup();stopMedia();};
}
