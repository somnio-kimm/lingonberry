import {advanceMistakeBalance} from '../../../../js/shared/mistake-balance.js';
/** A Chinese wrong record starts with one mistake; its history contains retests only. */
export const wrongAnswerCount=record=>(Array.isArray(record.retests)?record.retests:[]).reduce((balance,{correct,skipped})=>advanceMistakeBalance(balance,{correct,skipped}),1);
