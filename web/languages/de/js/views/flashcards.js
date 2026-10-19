import { studyLevelLabel } from '../app-definition.js';
import { escapeHtml as e } from '../../../../js/shared/ui.js';
import { t, getLocale, wordMeaning } from '../core/i18n.js';
import { studyWords, shuffleWords, wordHeading, filterStudyStatus } from '../core/words.js';
import { studyFilterMarkup, typeLabel, exampleMarkup, createStudyControls } from './study-components.js';
export function renderFlashcards(el,ctx) {
 const level=ctx.store.state.preferences.studyLevel,pool=studyWords(ctx.words,level);
 let pos='all',status='all',deck=[],index=0,flipped=false,filterOpen=false;
 const controls=createStudyControls(el,ctx);
 const currentPool=()=>filterStudyStatus(studyWords(ctx.words,level,{pos}),ctx.store,status);
 function reshuffle(){deck=shuffleWords(currentPool());index=0;flipped=false;}
 function move(){if(deck.length<=1)return;const previous=index;index=Math.floor(Math.random()*(deck.length-1));if(index>=previous)index++;flipped=false;ctx.haptic();draw();}
 function draw() {
  const available=new Set(currentPool().map(w=>w.id));deck=deck.filter(w=>available.has(w.id));if(!deck.length&&available.size)reshuffle();index=Math.min(index,Math.max(0,deck.length-1));const w=deck[index];
  function face(back) {
   const badges=`<span class="detail-badge detail-badge-hsk">${e(studyLevelLabel(w.cefr))}</span><span class="detail-badge detail-badge-pos">${e(typeLabel(w))}</span>`;
   return `<div class="flashcard-${back?'back':'front'}" aria-hidden="${back!==flipped}" ${back!==flipped?'inert':''}><div class="fc-card-head"><button class="quiz-status-btn fc-card-status">${t('Study status')}</button><div class="fc-head-center"><div class="fc-head-badges ${back?'':'fc-head-badges--mirror'}" ${back?'':'aria-hidden="true"'}>${badges}</div></div><button class="detail-sheet-icon detail-sheet-speak speak-btn" aria-label="${t('Speak word')}">🔊</button></div><div class="fc-card-main ${back?'fc-card-main-back':''}" role="button" tabindex="${back===flipped?'0':'-1'}" aria-label="${t(back?'Show word':'Show meaning')}"><div class="fc-core ${back?'':'fc-core--front'}"><div class="flashcard-word" lang="de">${wordHeading(w)}</div><div class="fc-meaning" lang="${getLocale()}">${e(wordMeaning(w))}</div></div>${back&&w.examples?.length?`<div class="fc-examples">${exampleMarkup(w,2)}</div>`:''}</div></div>`;
  }
  el.innerHTML=`<div class="fc-toolbar"><div class="section-title">${t('Flashcards')}</div><div class="fc-tools"><button class="btn-small" id="fc-shuffle">🔀 ${t('Shuffle')}</button><span id="flashcard-count">${deck.length} ${t('cards')}</span></div></div>${studyFilterMarkup(pool,ctx.store,status,pos,filterOpen)}<div class="quiz-after-filter">${w?`<div class="flashcard-wrapper"><div class="flashcard ${flipped?'flipped':''}" id="card" data-word-id="${e(w.id)}">${face(false)}${face(true)}</div></div><div class="fc-navigation"><button class="fc-nav" id="prev-btn" aria-label="${t('Previous word')}" ${deck.length<=1?'disabled':''}>‹</button><button class="fc-nav" id="next-btn" aria-label="${t('Next word')}" ${deck.length<=1?'disabled':''}>›</button></div>`:`<section class="panel empty-wrong"><p>${t('No matching words for these filters.')}</p></section>`}</div><p class="study-audio-status muted" role="status" hidden></p>`;
  el.querySelector('.filter-fold').ontoggle=ev=>{filterOpen=ev.target.open;};
  el.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{status=b.dataset.f;ctx.haptic();reshuffle();draw();});
  el.querySelectorAll('[data-tag]').forEach(b=>b.onclick=()=>{pos=b.dataset.tag;ctx.haptic();reshuffle();draw();});
  el.querySelector('#fc-shuffle').onclick=()=>{ctx.haptic();reshuffle();draw();};
  el.querySelector('#card')?.addEventListener('click',ev=>{if(ev.target.closest('.speak-btn,.fc-card-status'))return;flipped=!flipped;ctx.haptic();draw();});
  el.querySelectorAll('.fc-card-main').forEach(main=>main.onkeydown=ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();flipped=!flipped;ctx.haptic();draw();}});
  el.querySelectorAll('.fc-card-status').forEach(b=>b.onclick=ev=>{ev.stopPropagation();ctx.haptic();controls.open(w,draw);});
  el.querySelectorAll('.speak-btn').forEach(b=>b.onclick=ev=>{ev.stopPropagation();controls.speak(w);});
  el.querySelector('#prev-btn')?.addEventListener('click',move);el.querySelector('#next-btn')?.addEventListener('click',move);
 }
 reshuffle();draw();return controls.cleanup;
}
