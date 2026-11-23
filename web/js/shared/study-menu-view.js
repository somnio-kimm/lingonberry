import {escapeHtml as e} from './ui.js';
import {renderStudyIcon} from './study-icons.js';

/** Shared geometry and escaping; adapters supply available routes and translated labels. */
export function renderStudyMenu(items,{variant='menu',label=''}={}){
 if(!['menu','quiz'].includes(variant))throw new Error('Unknown Study menu variant');
 const attribute=variant==='quiz'?'data-quiz':'data-route';
 return `<div class="${variant}-grid"${label?` aria-label="${e(label)}"`:''}>${items.map(({id,label})=>`<button type="button" class="${variant}-card" ${attribute}="${e(id)}"><span class="${variant}-icon" aria-hidden="true">${renderStudyIcon(id)}</span><span class="${variant}-label">${e(label)}</span></button>`).join('')}</div>`;
}

export function renderStudyLevels({title,levels,selected,variant='level',wideLabels=false}){
 if(!['level','hsk'].includes(variant))throw new Error('Unknown Study level variant');
 const attribute=variant==='hsk'?'data-lv':'data-level';
 return `<section class="panel card level-panel study-level-card"><h2>${e(title)}</h2><div class="level-chips study-level-options${wideLabels?' english-level-options':''}" role="group" aria-label="${e(title)}">${levels.map(({id,label})=>{const active=String(id)===String(selected);return `<button type="button" class="${variant}-chip${variant==='hsk'&&active?' active':''}" ${attribute}="${e(id)}" aria-pressed="${active}">${e(label)}</button>`;}).join('')}</div></section>`;
}
