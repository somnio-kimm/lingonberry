import {advanceMistakeBalance} from '../../../../js/shared/mistake-balance.js';
/** German history starts at zero after the last dismissal; regular correct answers do not repay mistakes. */
export const wrongAnswerCount=(attempts,dismissed=-1)=>attempts.slice(dismissed+1).reduce(advanceMistakeBalance,0);
