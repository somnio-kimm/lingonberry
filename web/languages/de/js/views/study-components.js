import { studyLevelLabel } from '../app-definition.js';
import { escapeHtml as e } from '../../../../js/shared/ui.js';
import { t, getLocale, wordMeaning, sentenceMeaning } from '../core/i18n.js';
import { wordType } from '../core/dictionary.js';
import { studyTypes, wordHeading, filterStudyStatus } from '../core/words.js';
import { types } from '../core/word-types.js';
import { speakGerman, stopMedia } from '../core/media.js';
export const statusLabel=status=>t({new:'New',learning:'Learning',mastered:'Mastered'}[status]);
export const typeLabel=word=>t(types[wordType(word)]||wordType(word));
export const statusTag=(word,store)=>`<span class="wl-tag wl-st-${store.wordStatus(word.id)}">${statusLabel(store.wordStatus(word.id))}</span>`;
export function studyFilterMarkup(pool,store,status,pos,open=false,extraBody='') {
 const byType=pos==='all'?pool:pool.filter(w=>wordType(w)===pos);
 const byStatus=filterStudyStatus(pool,store,status);
 const statuses=['all','new','learning','mastered'].map(key=>[key,key==='all'?t('All'):statusLabel(key),filterStudyStatus(byType,store,key).length]);
 const tags=['all',...studyTypes(pool)].map(key=>[key,key==='all'?t('All'):t(types[key]||key),key==='all'?byStatus.length:byStatus.filter(w=>wordType(w)===key).length]);
 const selectedStatus=statuses.find(row=>row[0]===status),selectedTag=tags.find(row=>row[0]===pos)||tags[0];
 return `<details class="filter-fold filter-fold--combined study-filter-panel" ${open?'open':''}><summary class="filter-fold-sum filter-fold-sum--combined"><div class="filter-fold-sum-head"><span class="filter-fold-k filter-fold-k--panel">${t('Filters')}</span></div><div class="filter-fold-sum-picks"><span class="filter-fold-pick-l">${t('Study status')}</span><span class="filter-fold-pick-v">${e(selectedStatus[1])} (${selectedStatus[2]})</span><span class="filter-fold-pick-l">${t('Part of speech')}</span><span class="filter-fold-pick-v">${e(selectedTag[1])} (${selectedTag[2]})</span></div></summary><div class="filter-fold-body filter-fold-split"><div class="filter-split-head">${t('Study status')}</div><div class="wl-filter-row">${statuses.map(([key,label,count])=>`<button class="wl-filter ${status===key?'active':''}" data-f="${key}" aria-pressed="${status===key}">${e(label)} (${count})</button>`).join('')}</div><div class="filter-split-divider"></div><div class="filter-split-head">${t('Part of speech')}</div><div class="wl-filter-row wl-tag-filter-row">${tags.map(([key,label,count])=>`<button class="wl-filter ${pos===key?'active':''}" data-tag="${key}" aria-pressed="${pos===key}">${e(label)} (${count})</button>`).join('')}</div>${extraBody?`<div class="filter-split-divider"></div>${extraBody}`:''}</div></details>`;
}
export function exampleMarkup(word,limit=Infinity,withAudio=false) {
 return (word.examples||[]).slice(0,limit).map((ex,i)=>`<div class="fc-example-block ${withAudio?'example-with-audio':''}">${withAudio?`<button type="button" class="example-speak word-listen" data-example="${i}" aria-label="${t('Listen to sentence')}">🔊</button>`:''}<div class="example-sentence" lang="de">${e(ex.de)}</div><div class="example-translation" lang="${getLocale()}">${e(sentenceMeaning(ex))}</div></div>`).join('');
}
export function createStudyControls(host,ctx) {
 let sheet=null,closed=false;
 function speak(word) {
  const text=word.pos==='noun'&&word.article?word.article+' '+word.lemma:word.lemma;
  speakGerman(text,()=>{},()=>{
   if(closed)return;
   const message=sheet?.querySelector('.study-audio-status')||host.querySelector('.study-audio-status');
   if(message){message.hidden=false;message.textContent=t('German speech is unavailable. Download a German voice in the phone’s speech settings.');}
  });
 }
 function open(word,onDone) {
  sheet?.remove();const focus=document.activeElement;
  sheet=document.createElement('div');sheet.className='detail-overlay study-overlay';
  sheet.innerHTML=`<section class="detail-sheet study-detail-sheet" role="dialog" aria-modal="true" aria-labelledby="study-word-title"><div class="detail-sheet-head"><button class="detail-sheet-icon detail-sheet-close" aria-label="${t('Close')}">×</button><div class="detail-sheet-head-center"><span class="detail-badge detail-badge-hsk">${e(studyLevelLabel(word.cefr))}</span><span class="detail-badge detail-badge-pos">${e(typeLabel(word))}</span></div><button class="detail-sheet-icon detail-sheet-speak" aria-label="${t('Speak word')}">🔊</button></div><div class="study-sheet-core"><h2 id="study-word-title" class="study-headword" lang="de">${wordHeading(word)}</h2><div class="study-sheet-meaning" lang="${getLocale()}">${e(wordMeaning(word))}</div></div><div class="study-status-title">${t('Change study status')}</div><div class="status-btns">${['new','learning','mastered'].map(status=>`<button class="status-btn ${ctx.store.wordStatus(word.id)===status?'active':''}" data-word-status="${status}" aria-pressed="${ctx.store.wordStatus(word.id)===status}"><span class="status-dot ${status}"></span>${statusLabel(status)}</button>`).join('')}</div>${word.examples?.length?`<div class="study-examples"><h3>${t('Examples')}</h3>${exampleMarkup(word,Infinity,true)}</div>`:''}<p class="study-audio-status muted" role="status" hidden></p></section>`;
  document.body.appendChild(sheet);
  function close(){sheet?.remove();sheet=null;stopMedia();onDone?.();if(focus?.isConnected)focus.focus();else host.querySelector('#search-input,#fc-shuffle')?.focus();}
  sheet.querySelector('.detail-sheet-close').onclick=close;
  sheet.querySelector('.detail-sheet-speak').onclick=()=>speak(word);
  sheet.querySelectorAll('[data-example]').forEach(button=>button.onclick=()=>{const message=sheet.querySelector('.study-audio-status');message.hidden=true;speakGerman(word.examples[Number(button.dataset.example)].de,()=>{},()=>{if(!closed&&message.isConnected){message.hidden=false;message.textContent=t('German speech is unavailable. Download a German voice in the phone’s speech settings.');}});});
  sheet.querySelectorAll('[data-word-status]').forEach(b=>b.onclick=()=>{
   ctx.store.setWordStatus(word.id,b.dataset.wordStatus);ctx.haptic();
   sheet.querySelectorAll('[data-word-status]').forEach(button=>{const active=button.dataset.wordStatus===ctx.store.wordStatus(word.id);button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});onDone?.();ctx.updateStatus();
  });
  sheet.onclick=ev=>{if(ev.target===sheet)close();};
  sheet.onkeydown=ev=>{
   if(ev.key==='Escape'){ev.preventDefault();close();}
   if(ev.key==='Tab'){const buttons=[...sheet.querySelectorAll('button')],first=buttons[0],last=buttons.at(-1);if(ev.shiftKey&&document.activeElement===first){ev.preventDefault();last.focus();}else if(!ev.shiftKey&&document.activeElement===last){ev.preventDefault();first.focus();}}
  };
  sheet.querySelector('.detail-sheet-close').focus();
 }
 return {speak,open,cleanup(){closed=true;sheet?.remove();sheet=null;stopMedia();}};
}
