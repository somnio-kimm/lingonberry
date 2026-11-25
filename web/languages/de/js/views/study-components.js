import {groupHeadwords,headwordsForInventory,readHeadwordStatus,readWordSenses} from '../../../../js/shared/headwords.js';
import {selectSenseExamples} from '../../../../js/shared/word-example.js';
import {appendStudySheetNext,renderDictionaryMeanings,renderStudyExamples,renderStudyUsageLabel,renderStudyFilters} from '../../../../js/shared/study-components.js';
import {renderCollocations,bindCollocationAudio} from '../../../../js/shared/collocation-view.js';
import { studyLevelLabel } from '../app-definition.js';
import { escapeHtml as e } from '../../../../js/shared/ui.js';
import { t, getLocale, wordMeaning, sentenceMeaning } from '../core/i18n.js';
import { wordType } from '../core/dictionary.js';
import { studyTypes, wordHeading, filterStudyStatus } from '../core/words.js';
import { types } from '../core/word-types.js';
import { speakGerman, stopMedia } from '../core/media.js';
export const statusLabel=status=>t({new:'New',learning:'Learning',mastered:'Mastered'}[status]);
export const typeLabel=word=>t(types[wordType(word)]||wordType(word));
export const headwordTypeLabels=word=>[...new Set(readWordSenses(word).map(typeLabel))];
export const germanHeadwordStatus=(word,store)=>readHeadwordStatus(word,id=>store.wordStatus(id));
export const statusTag=(word,store)=>`<span class="wl-tag wl-st-${store.wordStatus(word.id)}">${statusLabel(store.wordStatus(word.id))}</span>`;
export function studyFilterMarkup(pool,store,status,pos,open=false,extraBody='',leading={},grouped=false) {
 const byType=pos==='all'?pool:pool.filter(w=>wordType(w)===pos);
 const byStatus=filterStudyStatus(pool,store,status);
 const count=list=>grouped?groupHeadwords(list).length:list.length;
 const statuses=['all','new','learning','mastered'].map(key=>[key,key==='all'?t('All'):statusLabel(key),count(filterStudyStatus(byType,store,key))]);
 const tags=['all',...studyTypes(pool)].map(key=>[key,key==='all'?t('All'):t(types[key]||key),count(key==='all'?byStatus:byStatus.filter(w=>wordType(w)===key))]);
 const group=(title,selected,rows)=>({title:t(title),selected,options:rows.map(([value,label,count])=>({value,label,count}))});
 return renderStudyFilters({title:t('Filters'),open,extraBody,...leading,status:group('Study status',status,statuses),pos:group('Part of speech',pos,tags)});
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
 function open(word,onDone,{nextButton,onClose}={}) {
  word=headwordsForInventory(ctx.words).expand(word);
  const senses=readWordSenses(word),examples=selectSenseExamples(word,'de',wordMeaning(word));
  const examplesHTML=renderStudyExamples(examples,{title:t('Examples'),speakLabel:t('Listen to sentence'),renderUsage:sense=>renderStudyUsageLabel(sense,[typeLabel(sense),senses.length>1&&sense.article].filter(Boolean).join(' · '),senses.some(item=>item.pronunciation!==word.pronunciation)),readTranslation:sentenceMeaning,renderExample:example=>`<div class="example-sentence" lang="de">${e(example.text)}</div>`});
  sheet?.remove();const focus=document.activeElement;
  sheet=document.createElement('div');sheet.className='detail-overlay study-overlay';
  sheet.innerHTML=`<section class="detail-sheet study-detail-sheet" role="dialog" aria-modal="true" aria-labelledby="study-word-title"><div class="detail-sheet-head"><button class="detail-sheet-icon detail-sheet-close" aria-label="${t('Close')}">×</button><div class="detail-sheet-head-center"><span class="detail-badge detail-badge-hsk">${e(studyLevelLabel(word.cefr))}</span>${headwordTypeLabels(word).map(label=>`<span class="detail-badge detail-badge-pos">${e(label)}</span>`).join('')}</div><button class="detail-sheet-icon detail-sheet-speak" aria-label="${t('Speak word')}">🔊</button></div><div class="study-sheet-core"><h2 id="study-word-title" class="study-headword" lang="de">${wordHeading(word)}</h2><div class="study-sheet-meaning" lang="${getLocale()}">${renderDictionaryMeanings(word,'de',wordMeaning(word))}</div></div>${renderCollocations(word,getLocale())}<div class="study-status-title">${t('Change study status')}</div><div class="status-btns">${['new','learning','mastered'].map(status=>`<button class="status-btn ${germanHeadwordStatus(word,ctx.store)===status?'active':''}" data-word-status="${status}" aria-pressed="${germanHeadwordStatus(word,ctx.store)===status}"><span class="status-dot ${status}"></span>${statusLabel(status)}</button>`).join('')}</div>${examplesHTML}<p class="study-audio-status muted" role="status" hidden></p></section>`;
  const overlay=sheet;
  appendStudySheetNext(overlay,nextButton,'.detail-sheet-close');
  document.body.appendChild(sheet);
  function close(){if(sheet!==overlay)return;overlay.remove();sheet=null;stopMedia();onDone?.();if(onClose)onClose();else if(focus?.isConnected)focus.focus();else host.querySelector('#search-input,#fc-shuffle')?.focus();}
  sheet.querySelector('.detail-sheet-close').onclick=close;
  sheet.querySelector('.detail-sheet-speak').onclick=()=>speak(word);
  bindCollocationAudio(sheet,word,text=>speakGerman(text));
  sheet.querySelectorAll('[data-example]').forEach(button=>button.onclick=()=>{const message=sheet.querySelector('.study-audio-status');message.hidden=true;speakGerman(examples[Number(button.dataset.example)].example.text,()=>{},()=>{if(!closed&&message.isConnected){message.hidden=false;message.textContent=t('German speech is unavailable. Download a German voice in the phone’s speech settings.');}});});
  sheet.querySelectorAll('[data-word-status]').forEach(b=>b.onclick=()=>{
   for(const sense of senses)ctx.store.setWordStatus(sense.id,b.dataset.wordStatus);ctx.haptic();
   sheet.querySelectorAll('[data-word-status]').forEach(button=>{const active=button.dataset.wordStatus===germanHeadwordStatus(word,ctx.store);button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});onDone?.();ctx.updateStatus();
  });
  sheet.onclick=ev=>{if(ev.target===sheet)close();};
  sheet.onkeydown=ev=>{
   if(ev.key==='Escape'){ev.preventDefault();close();}
   if(ev.key==='Tab'){const buttons=[...sheet.querySelectorAll('button')],first=buttons[0],last=buttons.at(-1);if(ev.shiftKey&&document.activeElement===first){ev.preventDefault();last.focus();}else if(!ev.shiftKey&&document.activeElement===last){ev.preventDefault();first.focus();}}
  };
  sheet.querySelector('.detail-sheet-close').focus();
  return close;
 }
 return {speak,open,cleanup(){closed=true;sheet?.remove();sheet=null;stopMedia();}};
}
