import {collocationPreview} from '../../../../js/shared/collocation-view.js';
import {escapeHtml as e} from '../../../../js/shared/ui.js';
import { Store } from '../services/store.js';
import { Pinyin } from '../services/pinyin.js';
import { TTS } from '../services/tts.js';
import { Haptic } from '../services/haptic.js';
import { mountWordRows } from '../../../../js/shared/word-rows.js';
import { matchesWordSearch,wordSearchQuery } from '../services/word-search.js';
import { showStatusSheet,wordlistCombinedFilterMarkup,statusTagHTML,hskBandLabel,filterByStudyStatus,filterByPosTag,wordPosGroupDisplay } from '../components.js';
import { t,wordMeaning } from '../services/i18n.js';
export function renderWordList(el){
 let status='all',tag='all',search='',open=false,pager=null,frame=0,alive=true;
 const active=Store.activeWords;
 const row=w=>`<div class="wl-row" data-id="${e(w.id)}"><div class="wl-main" role="button" tabindex="0"><div class="wl-py-hz">${Pinyin.htmlMarkedColumns(w.syllables)}</div><div class="wl-meaning">${wordMeaning(w)}</div>${collocationPreview(w)}</div><div class="wl-trail"><span class="wl-tag wl-hsk">${hskBandLabel(w.hskLevel)}</span><span class="wl-tag wl-pos">${wordPosGroupDisplay(w)}</span>${statusTagHTML(w.srs.level)}<button type="button" class="wl-speak" data-hz="${e(w.hanzi)}">🔊</button></div></div>`;
 function results(initialCount=80){
  if(!alive)return;
  const query=wordSearchQuery(search),filtered=filterByPosTag(filterByStudyStatus(active,status),tag).filter(w=>matchesWordSearch(w,query));
  el.querySelector('.study-list-title').innerHTML=`${t('wordlistTitle')} <span style="color:var(--text2);font-weight:400">(${filtered.length})</span>`;
  el.querySelector('#wordlist-results').dataset.query=search;
  pager?.cleanup();pager=mountWordRows(el.querySelector('#wordlist-results'),filtered,row,{initialCount,moreLabel:t('showMoreWords'),emptyMarkup:`<div style="text-align:center;padding:24px;color:var(--text2)">${t('noSearchResults')}</div>`});
 }
 function draw(reset=false){
  cancelAnimationFrame(frame);const count=reset?80:pager?.count||80;pager?.cleanup();
  el.innerHTML=`<div class="section-title study-list-title" style="margin-top:0"></div><div class="card study-search" style="padding:10px"><input class="input-field" id="search-input" type="search" inputmode="text" enterkeyhint="search" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="${t('searchPlaceholder')}" value="${e(search)}"></div>${wordlistCombinedFilterMarkup(filterByPosTag(active,tag),status,filterByStudyStatus(active,status),tag,active)}<div class="wl-list wl-list--wordlist" id="wordlist-results" aria-live="polite"></div>`;
  const field=el.querySelector('#search-input');field.closest('.study-search').onclick=()=>field.focus({preventScroll:true});field.onkeydown=event=>{if(event.key==='Enter'&&!event.isComposing&&event.keyCode!==229){event.preventDefault();field.blur();}};field.oninput=()=>{search=field.value;cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>results());};
  field.addEventListener('compositionstart',()=>cancelAnimationFrame(frame));field.addEventListener('compositionend',()=>{search=field.value;cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>results());});
  const fold=el.querySelector('.filter-fold');fold.open=open;fold.ontoggle=()=>open=fold.open;
  el.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{status=b.dataset.f;Haptic.light();draw(true);});
  el.querySelectorAll('[data-tag]').forEach(b=>b.onclick=()=>{tag=decodeURIComponent(b.dataset.tag);Haptic.light();draw(true);});
  const list=el.querySelector('#wordlist-results');
  list.onclick=ev=>{const node=ev.target.closest('.wl-row');if(!node)return;const speaker=ev.target.closest('.wl-speak');if(speaker)TTS.speak(speaker.dataset.hz);else showStatusSheet(node.dataset.id,draw);};
  list.onkeydown=ev=>{if(!ev.target.closest('.wl-main')||!['Enter',' '].includes(ev.key))return;ev.preventDefault();showStatusSheet(ev.target.closest('.wl-row').dataset.id,draw);};
  results(count);
 }
 draw();return()=>{alive=false;cancelAnimationFrame(frame);pager?.cleanup();};
}
