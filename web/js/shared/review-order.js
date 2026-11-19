/** Prefer the last incorrect attempt; a later correct retest must not move a card. */
export function lastMistakeTime(row){
 const times=[row.lastWrongAt,row.timestamp,row.attempt?.at,...(row.retests||[]).filter(attempt=>attempt.correct===false).map(attempt=>attempt.at)];
 return Math.max(0,...times.filter(value=>Number.isFinite(value)&&value>0));
}
export function newestMistakesFirst(rows){return rows.slice().sort((a,b)=>lastMistakeTime(b)-lastMistakeTime(a));}
