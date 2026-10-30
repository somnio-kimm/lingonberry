/** Explicit aligned gaps: never infer valid object positions or accept arbitrary wildcard text. */
const separator=' … ';
const normalise=value=>String(value).normalize('NFKC').trim().toLowerCase().replace(/[’‘]/gu,"'").replace(/\s+/gu,' ');
export const joinGapAnswers=values=>values.join(separator);
export const splitGapAnswers=value=>Array.isArray(value)?value:String(value).split(separator);
export function gradePhraseGaps(gapFill,input) {
 const given=splitGapAnswers(input);
 const candidates=[gapFill.answers,...(gapFill.alternatives||[])];
 let best=gapFill.answers,matches=[],score=-1;
 for(const answers of candidates){
  const result=answers.map((answer,index)=>normalise(answer)===normalise(given[index]||''));
  const count=result.filter(Boolean).length;
  if(count>score){best=answers;matches=result;score=count;}
 }
 return {correct:given.length===best.length&&matches.every(Boolean),answers:best,matches};
}
export const completeGapSentence=(gapFill,answers=gapFill.answers)=>gapFill.parts.reduce((text,part,index)=>text+part+(answers[index]||''),'');
