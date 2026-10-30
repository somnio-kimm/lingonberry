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
