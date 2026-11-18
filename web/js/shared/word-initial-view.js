import {escapeHtml as e} from './ui.js';
const copy={
 en:{all:'All',other:'Other',alphabet:'Alphabet',pinyin:'Pinyin Initial',kana:'Kana Group'},
 ko:{all:'전체',other:'기타',alphabet:'알파벳',pinyin:'병음 첫 글자',kana:'가나 행'},
};
function renderOptions(options,selected,locale){
 const t=copy[locale]||copy.en;
 return options.map(({value,count})=>`<option value="${e(value)}" ${selected===value?'selected':''} ${value!=='all'&&!count?'disabled':''}>${e(value==='all'?t.all:value==='#'?t.other:value)} (${Number(count).toLocaleString(locale==='ko'?'ko-KR':'en-GB')})</option>`).join('');
}
export function renderWordInitialFilter({language='en',locale='en',options,selected='all'}){
 const t=copy[locale]||copy.en,label=language==='ja'?t.kana:language==='zh'?t.pinyin:t.alphabet;
 return `<div class="word-initial-filter grammar-selectors"><label class="word-initial-label" for="word-initial-select"><span>${e(label)}</span><select class="word-initial-select" id="word-initial-select" data-word-initial aria-label="${e(label)}">${renderOptions(options,selected,locale)}</select></label></div>`;
}
/** Update only option content, leaving the search field and its keyboard focus untouched. */
export function updateWordInitialFilter(select,{options,selected='all',locale='en'}){select.innerHTML=renderOptions(options,selected,locale);select.value=selected;}
