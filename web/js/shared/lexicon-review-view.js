import {renderReviewCardBody} from './review-card-view.js';
import {escapeHtml as e} from './ui.js';
import {bindStudyReviewFilters,renderStudyReviewFilters} from './study-components.js';

export function bindReviewEntries(host,selector,open){
 const rows=[...host.querySelectorAll(selector)];
 for(const row of rows){
  row.onclick=event=>{if(!event.target.closest('button,a,input,select,summary'))open(row);};
  row.onkeydown=event=>{
   if(event.target===row&&['Enter',' '].includes(event.key)){event.preventDefault();open(row);}
  };
 }
 return()=>{for(const row of rows){row.onclick=null;row.onkeydown=null;}};
}

export function bindReviewActions(host,{confirmLabel,clear,retest}){
 const clearButton=host.querySelector('#clear-wrong'),retestButton=host.querySelector('#retest-filtered');
 if(clearButton)clearButton.onclick=()=>{if(confirm(confirmLabel))clear();};
 if(retestButton)retestButton.onclick=retest;
 return()=>{
  if(clearButton)clearButton.onclick=null;
  if(retestButton)retestButton.onclick=null;
 };
}

export function renderRetestCompletion(host,{title,correct,incorrect,skipped,next,score,onDone,panelClass='panel',buttonClass='primary'}){
 const counts=[[correct,score.correct],[incorrect,score.incorrect],[skipped,score.skipped]];
 host.innerHTML=`<section class="${e(panelClass)} retest-complete"><h2>${e(title)}</h2><div class="retest-summary">${counts.map(([label,count])=>`<span>${e(label)}: ${e(count)}</span>`).join('')}</div><button type="button" class="${e(buttonClass)}" id="retest-done" data-finish>${e(next)}</button></section>`;
 host.querySelector('#retest-done').onclick=onDone;
}

/** The view owns interaction; eligibility, snapshot policy and queues stay outside it. */
export function renderLexiconReview(host,{t,rows,total,groups,open},actions){
 const renderRow=row=>`<section class="panel wrong-card wrong-entry" tabindex="0" role="button" data-review-id="${e(row.id)}" data-review-word="${e(row.wordId)}">${renderReviewCardBody(row,{countLabel:t('Wrong Attempts'),removeLabel:t('Remove')})}</section>`;
 host.innerHTML=`<div class="lexicon-view"><div class="wrong-heading"><h2>${t('Review')} (${rows.length}${rows.length!==total?' / '+total:''})</h2>${total?`<button class="text-button danger wrong-clear" id="clear-wrong" data-clear>${t('Delete All')}</button>`:''}</div>${total?renderStudyReviewFilters({groups,open,title:t('Filters')}):''}${total?`<button class="primary wrong-retest" id="retest-filtered" data-retest ${rows.length?'':'disabled'}>${t('Retest')} (${rows.length})</button>`:''}<div class="wrong-results">${rows.length?rows.map(renderRow).join(''):`<section class="panel empty-wrong"><div aria-hidden="true">${total?'🔎':'🎉'}</div><h2>${t(total?'No Mistakes Match These Filters':'No Wrong Answers')}</h2><p>${t('Keep Practising to Build Your Review List')}</p></section>`}</div></div>`;
 const unbindFilters=bindStudyReviewFilters(host,actions);
 const unbindActions=bindReviewActions(host,{confirmLabel:t('Are you sure you want to delete?'),clear:actions.clear,retest:actions.retest});
 host.querySelectorAll('[data-remove]').forEach(button=>button.onclick=event=>{event.stopPropagation();actions.remove(button.dataset.remove);});
 const unbindRows=bindReviewEntries(host,'[data-review-word]',row=>actions.openWord(row.dataset.reviewWord));
 return()=>{unbindFilters();unbindRows();unbindActions();host.querySelectorAll('[data-remove]').forEach(node=>{node.onclick=null;});};
}
