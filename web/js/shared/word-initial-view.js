import {escapeHtml as e} from './ui.js';
import {renderStudyFilterPick,renderStudyFilterTags} from './study-components.js';

const copy={
 en:{all:'All',other:'Other',alphabet:'Alphabet',pinyin:'Pinyin Initial',kana:'Kana Group'},
 ko:{all:'전체',other:'기타',alphabet:'알파벳',pinyin:'병음 첫 글자',kana:'가나 행'},
};
const initialLabel=(value,locale)=>value==='all'?copy[locale].all:value==='#'?copy[locale].other:value;

export function renderWordInitialFilter({language='en',locale='en',options,selected='all'}){
 locale=copy[locale]?locale:'en';
 const t=copy[locale],label=language==='ja'?t.kana:language==='zh'?t.pinyin:t.alphabet;
 const tags=options.map(({value,count})=>({value,label:initialLabel(value,locale),disabled:value!=='all'&&!count}));
 const group=`<div class="filter-split-head">${e(label)}</div><div class="wl-filter-row" role="group" aria-label="${e(label)}" data-word-initial data-selected="${e(selected)}">${renderStudyFilterTags({options:tags,selected,attribute:'data-initial-value'})}</div>`;
 return {beforeGroups:group,beforePicks:renderStudyFilterPick(label,e(initialLabel(selected,locale)),'data-word-initial-summary')};
}

/** Keep the search field, the focused tag and the horizontal scroll position in place. */
export function updateWordInitialFilter(group,{options,selected='all',locale='en'}){
 const activeOptions=new Map(options.map(({value,count})=>[value,count]));
 group.dataset.selected=selected;
 group.querySelectorAll('[data-initial-value]').forEach(button=>{
  const value=button.dataset.initialValue,active=value===selected;
  button.classList.toggle('active',active);
  button.setAttribute('aria-pressed',String(active));
  button.disabled=!active&&value!=='all'&&!activeOptions.get(value);
 });
 const summary=group.closest('.filter-fold')?.querySelector('[data-word-initial-summary]');
 if(summary)summary.textContent=initialLabel(selected,copy[locale]?locale:'en');
}
