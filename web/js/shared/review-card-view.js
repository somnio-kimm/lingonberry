import {renderStudyMeaning} from './meaning-display.js';
import {escapeHtml as e} from './ui.js';
import {renderReviewBadge} from './review-badge.js';

/** Shared card hierarchy. Answer projection and event routing stay in history adapters. */
export function renderReviewCardBody(row,{countLabel,removeLabel,removeAttribute='data-remove',removeClass='del-wrong'}){
 if(!['data-remove','data-dismiss'].includes(removeAttribute))throw new Error('Unknown Review removal hook');
 return `<div class="wrong-card-heading"><div class="wrong-card-tags">${renderReviewBadge(row.modeKey,row.mode)}${row.pos?`<span class="badge wrong-pos">${e(row.pos)}</span>`:''}<span class="badge wrong-level">${e(row.level)}</span></div><div class="wrong-card-actions"><span class="wrong-count">${e(countLabel)}: ${e(row.count)}</span><button class="${e(removeClass)}" ${removeAttribute}="${e(row.removeKey??row.id)}" aria-label="${e(removeLabel)}">×</button></div></div><div class="wrong-word-block"><div class="wrong-main-word${row.headingClass?' '+e(row.headingClass):''}"${row.wordLanguage?` lang="${e(row.wordLanguage)}"`:''}>${row.headingHtml}</div>${row.meaning?`<p class="wrong-word-meaning" lang="${e(row.meaningLanguage)}">${renderStudyMeaning(row.meaning,row.meaningWord)}</p>`:''}</div>${row.extraWordHtml||''}<div class="review-answer-details">${row.answerHtml}</div>`;
}
