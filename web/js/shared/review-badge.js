import {escapeHtml as e} from './ui.js';
import {renderStudyIcon} from './study-icons.js';
/** Keep the shared exercise colour; icons distinguish types without colour dependence. */
export function renderReviewBadge(mode,label){return `<span class="badge wrong-mode">${renderStudyIcon(mode?.startsWith('listen')?'listening':mode)}<span>${e(label)}</span></span>`;}
