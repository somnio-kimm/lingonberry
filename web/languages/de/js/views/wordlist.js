import { studyLevelLabel } from '../app-definition.js';
import { escapeHtml as e } from '../../../../js/shared/ui.js';
import { t, getLocale, wordMeaning } from '../core/i18n.js';
import { studyWords, wordHeading, filterStudyStatus } from '../core/words.js';
import { mountWordRows } from '../../../../js/shared/word-rows.js';
import { studyFilterMarkup, statusTag, typeLabel, createStudyControls } from './study-components.js';
export function renderWordList(el,ctx) {
 const level=ctx.store.state.preferences.studyLevel,pool=studyWords(ctx.words,level),byId=new Map(pool.map(w=>[w.id,w]));
 const state=ctx.wordListState?.level===level?ctx.wordListState:{level,pos:'all',query:'',status:'all'};state.status||='all';ctx.wordListState=state;
 let filterOpen=false,pager=null,frame=0,alive=true;
 const controls=createStudyControls(el,ctx);
 const row=w=>`<div class="wl-row" data-id="${e(w.id)}"><div class="wl-main" role="button" tabindex="0" aria-label="${e(w.lemma)} · ${t('Word details')}"><div class="wl-headword" lang="de">${wordHeading(w)}</div><div class="wl-meaning" lang="${getLocale()}">${e(wordMeaning(w))}</div></div><div class="wl-trail"><span class="wl-tag wl-hsk">${e(studyLevelLabel(w.cefr))}</span><span class="wl-tag wl-pos">${e(typeLabel(w))}</span>${statusTag(w,ctx.store)}<button class="wl-speak" aria-label="${t('Speak word')}">🔊</button></div></div>`;
 function results(initialCount=80){
  if(!alive)return;
  const filtered=filterStudyStatus(studyWords(pool,level,state),ctx.store,state.status);
  el.querySelector('.study-list-title').innerHTML=`${t('Word list')} <span class="muted">(${filtered.length})</span>`;
  el.querySelector('#wordlist-results').dataset.query=state.query;
  pager?.cleanup();pager=mountWordRows(el.querySelector('#wordlist-results'),filtered,row,{initialCount,moreLabel:t('Show more words'),emptyMarkup:`<div class="empty">${t('No matching words for these filters.')}</div>`});
 }
 function draw(reset=false){
  cancelAnimationFrame(frame);const count=reset?80:pager?.count||80;pager?.cleanup();
  el.innerHTML=`<div class="section-title study-list-title"></div><div class="card study-search"><input class="input-field" id="search-input" type="search" inputmode="text" enterkeyhint="search" autocapitalize="none" autocorrect="off" spellcheck="false" aria-label="${t('Search')}" placeholder="${t('Search')}" value="${e(state.query)}" autocomplete="off"></div>${studyFilterMarkup(pool,ctx.store,state.status,state.pos,filterOpen)}<div class="wl-list wl-list--wordlist" id="wordlist-results" aria-live="polite"></div><p class="study-audio-status muted" role="status" hidden></p>`;
  const search=el.querySelector('#search-input');
  search.closest('.study-search').onclick=()=>search.focus({preventScroll:true});
  search.onkeydown=event=>{if(event.key==='Enter'&&!event.isComposing&&event.keyCode!==229){event.preventDefault();search.blur();}};
  search.oninput=()=>{state.query=search.value;cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>results());};
  search.addEventListener('compositionstart',()=>cancelAnimationFrame(frame));
  search.addEventListener('compositionend',()=>{state.query=search.value;cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>results());});
  el.querySelector('.filter-fold').ontoggle=ev=>{filterOpen=ev.target.open;};
  el.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{state.status=b.dataset.f;ctx.haptic();draw(true);});
  el.querySelectorAll('[data-tag]').forEach(b=>b.onclick=()=>{state.pos=b.dataset.tag;ctx.haptic();draw(true);});
  const list=el.querySelector('#wordlist-results');
  list.onclick=ev=>{const element=ev.target.closest('.wl-row');if(!element)return;const word=byId.get(element.dataset.id);if(ev.target.closest('.wl-speak'))controls.speak(word);else{ctx.haptic();controls.open(word,draw);}};
  list.onkeydown=ev=>{if(!ev.target.closest('.wl-main')||!['Enter',' '].includes(ev.key))return;ev.preventDefault();controls.open(byId.get(ev.target.closest('.wl-row').dataset.id),draw);};
  results(count);
 }
 draw();return()=>{alive=false;cancelAnimationFrame(frame);pager?.cleanup();controls.cleanup();};
}
