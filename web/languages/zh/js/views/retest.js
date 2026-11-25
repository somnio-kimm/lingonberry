import { renderListeningTest } from '../quizzes/listening.js';
import { TTS } from '../services/tts.js';
import { renderWordInput, renderMeaningQuiz } from '../quizzes/vocabulary-tests.js';
import { Store } from '../services/store.js';
import { t } from '../services/i18n.js';
import { navigate } from '../router.js';
import {renderRetestCompletion} from '../../../../js/shared/lexicon-review-view.js';
import {scoreRetestResults} from '../../../../js/shared/retest-results.js';
import { renderPinyinQuiz } from '../quizzes/pinyin.js';
import { renderToneQuiz } from '../quizzes/tone.js';
import { renderClozeQuiz } from '../quizzes/cloze.js';
import { renderScrambleQuiz } from '../quizzes/scramble.js';
import {escapeHtml as escape} from '../../../../js/shared/ui.js';
export const reviewState={session:null,filters:{level:null,tag:'all',mode:'all',status:'all',open:false}};
export function renderRetest(el){
 if(reviewState.session?.items.some(item=>!Store.isReviewQuestionCurrent(item.question)))reviewState.session=null;
 const session=reviewState.session;let childCleanup=()=>{};
 const back=()=>navigate('wrong',{title:t('wrongBook')});
 const advance=()=>{if(!session.results[session.index])return;session.index++;draw();window.scrollTo(0,0);};
 function draw(){
  childCleanup();childCleanup=()=>{};TTS.stop();
  if(!session){el.innerHTML=`<div class='card'><p>${t('retestStartHint')}</p><button class='btn-primary' id='retest-done'>${t('retestBack')}</button></div>`;el.querySelector('#retest-done').onclick=back;return;}
  if(session.index>=session.items.length){
   renderRetestCompletion(el,{
    title:t('retestComplete'),correct:t('retestCorrect'),incorrect:t('retestIncorrect'),skipped:t('retestSkipped'),
    next:t('nextQ'),score:scoreRetestResults(session.results),onDone:back,panelClass:'card',buttonClass:'btn-primary',
   });
   return;
  }
  const item=session.items[session.index];el.innerHTML=`<div class='retest-progress' role='status'>${t('retestQuestion')} ${session.index+1} / ${session.items.length}</div>${item.question.originalMissing?`<p class='wrong-details-note'>${t('retestCurrentExample')}</p>`:''}<div id='retest-question' data-review-mode='${item.mode}' data-review-id='${escape(item.recordId)}'></div>`;
  const options={question:item.question,onAnswer:(correct,input,parts=[],expected=null,metadata={})=>{if(session.results[session.index])return;session.results[session.index]={correct,input};Store.recordWrongRetest(item.recordId,input,correct,parts,expected,metadata);},onNext:advance,onSkip:()=>{if(session.results[session.index])return;session.results[session.index]={skipped:true};advance();}};
  const renderers={pinyin:renderPinyinQuiz,tone:renderToneQuiz,cloze:renderClozeQuiz,scramble:renderScrambleQuiz,vocabinput:renderWordInput,vocabmeaning:renderMeaningQuiz,listenword:renderListeningTest,listensentence:renderListeningTest};childCleanup=renderers[item.mode](el.querySelector('#retest-question'),options)||(()=>{});
 }
 draw();return()=>{childCleanup();TTS.stop();reviewState.session=null;};
}
