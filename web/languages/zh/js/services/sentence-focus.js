import {findSentenceFocus} from '../../../../js/shared/lexicon-sentences.js';
/** Legacy examples use the first match; explicit reviewed spans must validate exactly. */
export function findSentenceTarget(sentence,target){
 if(!target||typeof sentence?.hanzi!=='string')return null;
 if(sentence.focus!==undefined){
  if(sentence.focus?.text!==target)return null;
  const focus=findSentenceFocus({lemma:target},{text:sentence.hanzi,focus:sentence.focus},'zh');
  return focus&&sentence.hanzi.slice(focus.start,focus.start+target.length)===target?focus:null;
 }
 const start=sentence.hanzi.indexOf(target);
 return start>=0?{start,text:target}:null;
}

/** Dictionary/reference examples stay visible without becoming graded questions. */
export function practiceSentences(word,{cloze=false}={}){
 return (word.sentences||[]).filter(sentence=>sentence.practiceEligible!==false&&typeof sentence.hanzi==='string'&&sentence.hanzi.trim()&&
  (!cloze||sentence.clozeEligible!==false&&findSentenceTarget(sentence,word.hanzi)));
}
