import {renderStudySearch,renderStudyReferenceHeading} from './study-components.js';
import {escapeHtml as e} from './ui.js';
import {mountWordRows} from './word-rows.js';
import {createMorphemeModel,MORPHEME_PAGING} from './morpheme-model.js';
import {morphemeOriginLabel,morphemeRegisters,morphemeCountLabel,morphemeRelatedLabel} from './morpheme-text.js';

export function renderMorphemeSense(sense,locale) {
 const badges = morphemeRegisters(sense.tags,locale).map(label =>
  `<span class="wl-tag wl-pos morpheme-register">${e(label)}</span> `,
 );
 return badges.join('') + e(sense.meaning);
}

/** The model owns data lookup; this view owns markup, user events and their cleanup. */
export function renderMorphemeInventory(host,{
 rows,words,model=createMorphemeModel(rows,words),state,t,locale,tabs,bindTabs,openWord,tags,
}) {
 function renderKindOptions() {
  return model.kinds.map(kind => {
   const label = kind==='all' ? 'All' : kind[0].toUpperCase()+kind.slice(1);
   return `<option value="${e(kind)}" ${(state.rootKind||'all')===kind?'selected':''}>${e(t(label))}</option>`;
  }).join('');
 }

 function renderRelatedWord(text) {
  const matches = model.matchingWords(text);
  if (!matches.length) {
   return `<div class="wl-row root-member"><div class="wl-main"><span class="wl-headword">${e(text)}</span></div></div>`;
  }
  return matches.map(word=>`<div class="wl-row root-member" data-root-entry="${e(word.id)}">
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
  return `<details class="morpheme-words study-reference-words" open>
   <summary>${e(morphemeRelatedLabel(locale,row.examples.length))}</summary>
   <div class="wl-list wl-list--wordlist">
    <div data-related-list class="word-row-window">${page.words.map(renderRelatedWord).join('')}</div>
   </div>
   ${page.hasMore?`<button class="btn-small text-button" data-more-related="${e(row.id)}" data-shown="${page.next}">${e(t('Show More Words'))}</button>`:''}
  </details>`;
 }

 function renderCard(row) {
  const heading = renderStudyReferenceHeading({
   word:[row.form,...row.variants].join(', '),
   origin:morphemeOriginLabel(row.origin,locale),
  });
  return `<section class="panel study-reference-card" data-morpheme="${e(row.id)}">
   ${heading}
   <ol class="morpheme-meanings study-reference-meanings">${row.senses.map(sense=>`<li>${renderMorphemeSense(sense,locale)}</li>`).join('')}</ol>
   ${renderRelatedWords(row)}
   <a class="morpheme-source study-reference-source" href="${e(row.source)}" target="_blank" rel="noopener noreferrer">${e(t('Source'))}</a>
  </section>`;
 }

 host.innerHTML = `<div class="lexicon-view">
  <h2 class="section-title study-list-title">${e(t('Root Families'))}</h2>
  ${tabs}
  <p class="muted" data-root-count></p>
  <div class="grammar-selectors"><label>${e(t('Type'))}<select data-root-kind>${renderKindOptions()}</select></label></div>
  ${renderStudySearch({id:'root-search',value:state.rootQuery||'',label:t('Search')})}
  <div data-root-list class="study-reference-list"></div>
 </div>`;
 const list = host.querySelector('[data-root-list]');
 const count = host.querySelector('[data-root-count]');
 const search = host.querySelector('#root-search');
 const kind = host.querySelector('[data-root-kind]');
 let pager;

 function renderResults() {
  pager?.cleanup();
  const matching = model.find({query:state.rootQuery,kind:state.rootKind});
  count.textContent = morphemeCountLabel(locale,matching.length,model.total);
  count.dataset.total = String(model.total);
  count.dataset.visible = String(matching.length);
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
 bindTabs(host);
 kind.onchange = () => {
  state.rootKind = kind.value;
  renderResults();
 };
 search.oninput = () => {
  state.rootQuery = search.value;
  renderResults();
 };
 list.onclick = handleListClick;

 return () => {
  pager.cleanup();
  kind.onchange = null;
  search.oninput = null;
  list.onclick = null;
 };
}
