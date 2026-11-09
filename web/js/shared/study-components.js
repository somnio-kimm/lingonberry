import {escapeHtml as e} from './ui.js';
/** Canonical German/Chinese study patterns. Geometry and colours live in study-theme.css. */
export function renderStudySearch({id,value='',label='Search'}){
 return `<div class="card study-search"><input id="${e(id)}" class="input-field" type="search" inputmode="text" enterkeyhint="search" placeholder="${e(label)}" aria-label="${e(label)}" value="${e(value)}" autocomplete="off" autocapitalize="none"></div>`;
}
export function renderStudyTabs({label,options,selected,attribute,variant='form'}){
 if(!/^data-[a-z]+(?:-[a-z]+)*$/u.test(attribute))throw new Error('Study tabs require a safe data attribute');
 if(!['form','listening'].includes(variant))throw new Error('Unknown study tabs variant');
 return `<div class="${variant==='listening'?'listening-mode-controls':'form-mode-controls'}" role="group" aria-label="${e(label)}">${options.map(({value,label})=>`<button type="button" ${variant==='listening'?'class="btn-small" ':''}${attribute}="${e(value)}" aria-pressed="${selected===value}">${e(label)}</button>`).join('')}</div>`;
}
export function renderStudyQuizHeader({title,score={correct:0,total:0}}){
 return `<div class="vocab-quiz-header"><div class="section-title">${e(title)}</div><span class="score-pill">${e(score.correct)} / ${e(score.total)}</span></div>`;
}
export function renderStudyReferenceHeading({word,origin}){
 return `<header class="study-reference-header"><h3 class="study-reference-heading">${e(word)}</h3>${origin?`<p class="study-reference-origin root-origin">${e(origin)}</p>`:''}</header>`;
}

/** Standard Review answer geometry; callers supply escaped or trusted rendered values. */
export function renderStudyReviewAnswer({label,valueHtml,correct=false,lang='',strike=true,only=false}){
 return `<p class="wrong-answer-row ${correct?'wrong-correct-line':'wrong-user-line'}${only?' wrong-only':''}"><span class="wrong-answer-label">${e(label)}:</span> <span class="${correct?'correct-answer':'wrong-answer-value--wrong'}"${lang?` lang="${e(lang)}"`:''}>${!correct&&strike?`<del>${valueHtml}</del>`:valueHtml}</span></p>`;
}

/** Shared Study filters for status and part of speech. Extra controls use the same panel. */
export function renderStudyFilters({title,status,pos,open=false,extraBody=''}){
 const groups=[status,pos];
 const optionLabel=({label,count})=>`${e(label)} (${e(count)})`;
 const picks=groups.map(group=>{
  const selected=group.options.find(option=>option.value===group.selected)||group.options[0];
  return `<span class="filter-fold-pick-l">${e(group.title)}</span><span class="filter-fold-pick-v">${optionLabel(selected)}</span>`;
 }).join('');
 const sections=groups.map((group,index)=>{
  const attribute=index?'data-tag':'data-f';
  const buttons=group.options.map(option=>{
   const selected=option.value===group.selected;
   return `<button type="button" class="wl-filter ${selected?'active':''}" ${attribute}="${e(option.value)}" aria-pressed="${selected}">${optionLabel(option)}</button>`;
  }).join('');
  return `${index?'<div class="filter-split-divider"></div>':''}<div class="filter-split-head">${e(group.title)}</div><div class="wl-filter-row${index?' wl-tag-filter-row':''}">${buttons}</div>`;
 }).join('');
 return `<details class="filter-fold filter-fold--combined study-filter-panel" ${open?'open':''}><summary class="filter-fold-sum filter-fold-sum--combined"><div class="filter-fold-sum-head"><span class="filter-fold-k filter-fold-k--panel">${e(title)}</span></div><div class="filter-fold-sum-picks">${picks}</div></summary><div class="filter-fold-body filter-fold-split">${sections}${extraBody?`<div class="filter-split-divider"></div>${extraBody}`:''}</div></details>`;
}

/** Combined filter geometry shared with the established Review screens. */
export function renderStudyReviewFilters({groups,open=false,title='Filters'}){
 return `<details class="filter-fold filter-fold--combined wrong-filter-panel" ${open?'open':''}><summary class="filter-fold-sum filter-fold-sum--combined"><div class="filter-fold-sum-head"><span class="filter-fold-k filter-fold-k--panel">${e(title)}</span></div><div class="filter-fold-sum-picks">${groups.map(group=>`<span class="filter-fold-pick-l">${e(group.title)}</span><span class="filter-fold-pick-v">${e(group.options.find(option=>option.value===group.selected)?.label||'')}</span>`).join('')}</div></summary><div class="filter-fold-body filter-fold-split">${groups.map((group,index)=>`${index?'<div class="filter-split-divider"></div>':''}<div class="filter-split-head">${e(group.title)}</div><div class="wl-filter-row">${group.options.map(option=>`<button class="wl-filter ${group.selected===option.value?'active':''}" data-review-filter="${e(group.key)}" data-value="${e(option.value)}" aria-pressed="${group.selected===option.value}">${e(option.label)} (${e(option.count)})</button>`).join('')}</div>`).join('')}</div></details>`;
}
