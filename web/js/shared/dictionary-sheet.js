import {bindCollocationAudio,renderCollocations} from './collocation-view.js';
import {appendStudySheetNext,renderDictionarySenses} from './study-components.js';
import {escapeHtml as e} from './ui.js';
import {readDictionaryMeanings,selectSenseExamples} from './word-example.js';

const statuses=['new','learning','mastered'];

/** Mount the shared word-detail dialog using the adapter's readings, audio and progress writes. */
export function mountDictionarySheet({
 word,language,locale,label,labels,heading,tags='',headingExtra='',className='',
 labelledBy,meaning=word.studyMeaning,renderExample,readTranslation,
 status,statusAttribute='data-status',statusValues={},audioStatusClass='',nextButton,
 speakWord,speakExample,speakCollocation=speakExample,stopSpeech,saveStatus,
 onDismiss,onClose,focusFallback,
}){
 const focus=document.activeElement;
 const overlay=document.createElement('div');
 overlay.className=['detail-overlay','study-overlay',className].filter(Boolean).join(' ');
 const examples=selectSenseExamples(word,language,meaning);
 const senses=renderDictionarySenses(readDictionaryMeanings(word,language,meaning),examples,{
  title:labels.examples,speakLabel:labels.speakExample,noExample:labels.noExample,
  locale,renderExample,readTranslation,
 });
 const pressed=value=>value===status;
 const buttons=statuses.map(value=>`<button type="button" class="status-btn ${pressed(value)?'active':''}" ${statusAttribute}="${e(statusValues[value]??value)}" aria-pressed="${pressed(value)}"><span class="status-dot ${value}"></span>${e(labels.status(value))}</button>`).join('');
 overlay.innerHTML=`<section class="detail-sheet study-detail-sheet" role="dialog" aria-modal="true" ${labelledBy?`aria-labelledby="${e(labelledBy)}"`:`aria-label="${e(label)}"`}>
  <div class="detail-sheet-head">
   <button type="button" class="detail-sheet-icon detail-sheet-close close-btn" data-close aria-label="${e(labels.close)}">×</button>
   <div class="detail-sheet-head-center">${tags}</div>
   <button type="button" class="detail-sheet-icon detail-sheet-speak speak-btn" data-speak aria-label="${e(labels.speakWord)}">🔊</button>
  </div>
  <div class="study-sheet-core">${heading}${headingExtra}</div>
  ${senses}
  ${renderCollocations(word,locale)}
  ${audioStatusClass?`<p class="${e(audioStatusClass)} muted" role="status" hidden></p>`:''}
  <div class="status-btns" role="group" aria-label="${e(labels.changeStatus)}">${buttons}</div>
 </section>`;
 appendStudySheetNext(overlay,nextButton,'[data-close]');
 document.body.appendChild(overlay);

 function dispose(){
  if(!overlay.isConnected)return false;
  overlay.remove();
  stopSpeech();
  return true;
 }

 function close(){
  if(!dispose())return;
  onDismiss?.();
  if(onClose)onClose();
  else (focus?.isConnected?focus:focusFallback?.())?.focus({preventScroll:true});
 }

 const closeButton=overlay.querySelector('[data-close]');
 closeButton.onclick=close;
 overlay.onclick=event=>{if(event.target===overlay)close();};
 overlay.onkeydown=event=>{
  if(event.key==='Escape'){
   event.preventDefault();
   close();
  }else if(event.key==='Tab'){
   const focusable=overlay.querySelectorAll('button:not([disabled]):not([hidden])');
   const first=focusable[0],last=focusable[focusable.length-1];
   const boundary=event.shiftKey?first:last;
   if(document.activeElement===boundary){
    event.preventDefault();
    (event.shiftKey?last:first).focus();
   }
  }
 };
 overlay.querySelector('[data-speak]').onclick=()=>speakWord(overlay);
 overlay.querySelectorAll('[data-example]').forEach(button=>button.onclick=()=>{
  speakExample(examples[Number(button.dataset.example)].example.text,overlay);
 });
 bindCollocationAudio(overlay,word,text=>speakCollocation(text,overlay));
 const statusButtons=[...overlay.querySelectorAll('.status-btns .status-btn')];
 statusButtons.forEach((button,index)=>button.onclick=()=>{
  saveStatus(statuses[index],close);
  for(const choice of statusButtons){
   choice.classList.toggle('active',choice===button);
   choice.setAttribute('aria-pressed',String(choice===button));
  }
 });
 closeButton.focus();
 return {overlay,close,dispose};
}
