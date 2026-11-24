import {renderStudySearchWithFilters,renderStudyReferenceHeading,renderStudyFilterPanel,renderStudyFilterPick,renderStudyTagFilterGroup} from './study-components.js';
import {escapeHtml as e} from './ui.js';
import {mountWordRows} from './word-rows.js';
import {createMorphemeModel,MORPHEME_PAGING} from './morpheme-model.js';
import {morphemeOriginText,morphemeRegisters,morphemeRelatedLabel} from './morpheme-text.js';

export function renderMorphemeSense(sense,locale) {
 const badges = morphemeRegisters(sense.tags,locale).map(label =>
  `<span class="wl-tag wl-pos morpheme-register">${e(label)}</span> `,
 );
 return badges.join('') + e(sense.meaning);
}

export function renderRootKindFilter(t,kinds,selected='all'){
 const options=kinds.map(value=>({value,label:t(value[0].toUpperCase()+value.slice(1))}));
 const title=t('Type');
 return {beforeGroups:renderStudyTagFilterGroup({title,attribute:'data-root-kind',options,selected}),
  beforePicks:renderStudyFilterPick(title,e(options.find(option=>option.value===selected)?.label||t('All')),'data-root-kind-summary')};
}

/** The model owns data lookup; this view owns markup, user events and their cleanup. */
export function renderMorphemeInventory(host,{
 rows,words,model=createMorphemeModel(rows,words),state,t,locale,openWord,tags,
}) {
 function renderRelatedWord(text) {
  const matches = model.matchingWords(text);
  return matches.map(word=>`<div class="wl-row root-member" data-root-entry="${e(word.id)}" data-sense-ids="${e((word.senses||[word]).map(sense=>sense.id).join(' '))}">
   <div class="wl-main">
    <button class="wl-headword root-member-trigger" data-root-word="${e(word.id)}">${e(text)}</button>
    <div class="wl-meaning">${e(word.studyMeaning)}</div>
   </div>
   <div class="wl-trail">${tags(word)}</div>
  </div>`).join('');
 }

 function renderRelatedWords(row) {
  if (!row.examples.length) return '';
  const page = model.relatedWords(row.id,0,MORPHEME_PAGING.initialWords);
  return `<div class="morpheme-words study-reference-words">
   <h3 class="study-reference-words-title">${e(morphemeRelatedLabel(locale,row.examples.length))}</h3>
   <div class="wl-list wl-list--wordlist">
    <div data-related-list class="word-row-window">${page.words.map(renderRelatedWord).join('')}</div>
   </div>
   ${page.hasMore?`<button class="btn-small text-button" data-more-related="${e(row.id)}" data-shown="${page.next}">${e(t('Show More Words'))}</button>`:''}
  </div>`;
 }

 function renderCard(row) {
  const heading = renderStudyReferenceHeading({
   word:[row.form,...row.variants].join(', '),
   origin:morphemeOriginText(row.origin,locale),
  });
  return `<section class="panel study-reference-card" data-morpheme="${e(row.id)}">
   ${heading}
   <ol class="morpheme-meanings study-reference-meanings">${row.senses.map(sense=>`<li>${renderMorphemeSense(sense,locale)}</li>`).join('')}</ol>
   ${renderRelatedWords(row)}
  </section>`;
 }

 const kindFilter=renderRootKindFilter(t,model.kinds,state.rootKind);
 const filters=renderStudyFilterPanel({title:t('Filters'),open:state.open,body:kindFilter.beforeGroups,picks:kindFilter.beforePicks});
 host.innerHTML = `<div class="lexicon-view">
  <h2 class="section-title study-list-title">${e(t('Root Families'))}</h2>
  ${renderStudySearchWithFilters({id:'root-search',value:state.rootQuery||'',label:t('Search'),filters})}
  <div data-root-list data-total="${model.total}" class="study-reference-list"></div>
 </div>`;
 const list=host.querySelector('[data-root-list]'),search=host.querySelector('#root-search'),fold=host.querySelector('.filter-fold');
 const kinds=[...fold.querySelectorAll('[data-root-kind]')];
 let pager;

 function renderResults() {
  pager?.cleanup();
  const matching = model.find({query:state.rootQuery,kind:state.rootKind});
  list.dataset.visible=String(matching.length);
  pager = mountWordRows(list,matching,renderCard,{
   initialCount:MORPHEME_PAGING.cards,
   batchSize:MORPHEME_PAGING.cards,
   moreLabel:t('Show More Words'),
   emptyMarkup:`<section class="panel">${e(t('No Matching Words'))}</section>`,
  });
 }

 function showMoreRelated(button) {
  const page = model.relatedWords(button.dataset.moreRelated,Number(button.dataset.shown));
  const container = button.parentElement.querySelector('[data-related-list]');
  container.insertAdjacentHTML('beforeend',page.words.map(renderRelatedWord).join(''));
  button.dataset.shown = String(page.next);
  button.hidden = !page.hasMore;
 }

 function handleListClick(event) {
  if (event.target.closest('a')) return;
  const more = event.target.closest('[data-more-related]');
  if (more) {
   showMoreRelated(more);
   return;
  }
  const row = event.target.closest('[data-root-entry]');
  if (row) openWord(row.dataset.rootEntry);
 }

 renderResults();
 fold.ontoggle=()=>{if(fold.isConnected)state.open=fold.open;};
 kinds.forEach(button=>button.onclick=()=>{
  state.rootKind=button.dataset.rootKind;
  fold.querySelector('[data-root-kind-summary]').textContent=button.textContent;
  kinds.forEach(option=>{
   option.classList.toggle('active',option===button);
   option.setAttribute('aria-pressed',String(option===button));
  });
  renderResults();
 });
 search.oninput = () => {
  state.rootQuery = search.value;
  renderResults();
 };
 list.onclick = handleListClick;

 return () => {
  pager.cleanup();
  fold.ontoggle=null;
  kinds.forEach(button=>button.onclick=null);
  search.oninput = null;
  list.onclick = null;
 };
}
