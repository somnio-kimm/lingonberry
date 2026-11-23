import {createWordInitialIndex} from './word-initial-index.js';
import {renderWordInitialFilter,updateWordInitialFilter} from './word-initial-view.js';
import {escapeHtml as e} from './ui.js';
import {renderStudySearch} from './study-components.js';
import {mountWordRows} from './word-rows.js';

/** One list DOM/input/pager owner; adapters retain query, grouping and learner policies. */
export function renderLexiconWordList(host,{t,query,filters,language='en',locale='en',selectedInitial='all',getWords,readStatus,renderHeading,renderTags,renderPreview,readMeaning=word=>word.studyMeaning,headingClass='wl-headword',showCount=false},actions){
 const index=createWordInitialIndex(language);let initial=selectedInitial||'all',searchValue=query,pager,frame=0,alive=true;
 function renderWord(word){const status=readStatus(word);return `<div class="wl-row" data-word="${e(word.id)}" data-id="${e(word.id)}" data-sense-count="${word.senses?.length||1}" data-sense-ids="${e((word.senses||[word]).map(sense=>sense.id).join(' '))}"><div class="wl-main" role="button" tabindex="0"><div class="${e(headingClass)}">${renderHeading(word)}</div><div class="wl-meaning">${e(readMeaning(word))}</div>${renderPreview(word)}</div><div class="wl-trail">${renderTags(word)}<span class="wl-tag wl-st-${e(status)}">${t(status[0].toUpperCase()+status.slice(1))}</span><button class="wl-speak" data-row-speak="${e(word.id)}" aria-label="${t('Speak Word')}">🔊</button></div></div>`;}
 function renderResults(initialCount=80){
  if(!alive)return;const words=getWords(),filtered=index.filter(words,initial),list=host.querySelector('#wordlist-results');
  updateWordInitialFilter(host.querySelector('[data-word-initial]'),{options:index.readOptions(words),selected:initial,locale});list.dataset.initial=initial;list.dataset.query=host.querySelector('#search-input').value;
  if(showCount)host.querySelector('.study-list-title').innerHTML=`${e(t('Word List'))} <span class="muted">(${filtered.length})</span>`;
  pager?.cleanup();pager=mountWordRows(list,filtered,renderWord,{initialCount,moreLabel:t('Show More Words'),emptyMarkup:`<div class="panel">${t('No Matching Words')}</div>`});
 }
 function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>renderResults());}
 function clearHandlers(){host.querySelectorAll('button,input,select,.filter-fold,.study-search,#wordlist-results').forEach(node=>{node.oninput=null;node.onchange=null;node.onkeydown=null;node.onclick=null;node.ontoggle=null;node.oncompositionstart=null;node.oncompositionend=null;});}
 function draw(reset=false){
  if(!alive)return;cancelAnimationFrame(frame);const count=reset?80:pager?.count||80;pager?.cleanup();clearHandlers();
  host.innerHTML=`<div class="lexicon-view"><h2 class="section-title study-list-title">${t('Word List')}</h2>${renderStudySearch({id:'search-input',value:searchValue,label:t('Search')})}${typeof filters==='function'?filters():filters}${renderWordInitialFilter({language,locale,options:index.readOptions([]),selected:initial})}<div class="wl-list wl-list--wordlist" id="wordlist-results" aria-live="polite"></div><p class="study-audio-status lexicon-audio-status muted" role="status" hidden></p></div>`;
  actions.bindFilters(host,draw);const list=host.querySelector('#wordlist-results'),search=host.querySelector('#search-input'),initialSelect=host.querySelector('[data-word-initial]');
  initialSelect.onchange=()=>{initial=initialSelect.value;actions.setInitial?.(initial);cancelAnimationFrame(frame);renderResults();};
  search.closest('.study-search').onclick=()=>search.focus({preventScroll:true});
  search.oninput=()=>{searchValue=search.value;actions.setQuery(searchValue);schedule();};
  search.oncompositionstart=()=>cancelAnimationFrame(frame);search.oncompositionend=()=>{searchValue=search.value;actions.setQuery(searchValue);schedule();};
  search.onkeydown=event=>{if(event.key==='Enter'&&!event.isComposing&&event.keyCode!==229){event.preventDefault();search.blur();}};
  list.onclick=event=>{if(!alive)return;const speaker=event.target.closest('[data-row-speak]');if(speaker){actions.speakWord(speaker.dataset.rowSpeak);return;}const row=event.target.closest('[data-word]');if(row)actions.openWord(row.dataset.word,draw);};
  list.onkeydown=event=>{if(!alive||event.target.closest('[data-row-speak]'))return;if(['Enter',' '].includes(event.key)&&event.target.closest('[data-word]')){event.preventDefault();actions.openWord(event.target.closest('[data-word]').dataset.word,draw);}};
  renderResults(count);
 }
 draw();return()=>{if(!alive)return;alive=false;cancelAnimationFrame(frame);pager?.cleanup();clearHandlers();actions.cleanup?.();};
}
