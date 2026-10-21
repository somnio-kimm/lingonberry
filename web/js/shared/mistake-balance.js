/** Outstanding mistakes, distinct from lifetime attempts or accuracy scores. */
export function advanceMistakeBalance(balance,{correct,skipped=false,review=true}) {
 if (skipped) return balance;
 if (correct===false) return balance+1;
 if (correct===true && review!==false) return Math.max(0,balance-1);
 return balance;
}
