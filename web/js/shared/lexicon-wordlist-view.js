import {escapeHtml as e} from './ui.js';
import {renderStudySearch} from './study-components.js';
import {mountWordRows} from './word-rows.js';

/** Own the list DOM and pager; filtering and learner state remain in the presentation. */
export function renderLexiconWordList(host,{t,query,filters,getWords,readStatus,renderHeading,renderTags,renderPreview},actions){
 host.innerHTML=`<div class="lexicon-view"><h2 class="section-title study-list-title">${t('Word List')}</h2>${renderStudySearch({id:'search-input',value:query,label:t('Search')})}${filters}<div class="wl-list wl-list--wordlist" id="wordlist-results"></div></div>`;
 actions.bindFilters(host);const list=host.querySelector('#wordlist-results'),search=host.querySelector('#search-input');let pager;
 function renderWord(word){const status=readStatus(word);return `<div class="wl-row" data-word="${e(word.id)}" data-sense-count="${word.senses?.length||1}" data-sense-ids="${e((word.senses||[word]).map(sense=>sense.id).join(' '))}"><div class="wl-main" role="button" tabindex="0"><div class="wl-headword">${renderHeading(word)}</div><div class="wl-meaning">${e(word.studyMeaning)}</div>${renderPreview(word)}</div><div class="wl-trail">${renderTags(word)}<span class="wl-tag wl-st-${status}">${t(status[0].toUpperCase()+status.slice(1))}</span><button class="wl-speak" data-row-speak="${e(word.id)}" aria-label="${t('Speak Word')}">🔊</button></div></div>`;}
 function renderResults(){pager?.cleanup();pager=mountWordRows(list,getWords(),renderWord,{moreLabel:t('Show More Words'),emptyMarkup:`<div class="panel">${t('No Matching Words')}</div>`});}
 search.oninput=()=>{actions.setQuery(search.value);renderResults();};search.onkeydown=event=>{if(event.key==='Enter'&&!event.isComposing)search.blur();};
 list.onclick=event=>{const speaker=event.target.closest('[data-row-speak]');if(speaker){actions.speakWord(speaker.dataset.rowSpeak);return;}const row=event.target.closest('[data-word]');if(row)actions.openWord(row.dataset.word);};
 list.onkeydown=event=>{if(event.target.closest('[data-row-speak]'))return;if(['Enter',' '].includes(event.key)&&event.target.closest('[data-word]')){event.preventDefault();actions.openWord(event.target.closest('[data-word]').dataset.word);}};
 renderResults();return()=>{pager?.cleanup();search.oninput=null;search.onkeydown=null;list.onclick=null;list.onkeydown=null;};
}
