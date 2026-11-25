import {selectChineseUsageExamples} from './chinese-usage-examples.js';
import {findSentenceFocus} from './lexicon-sentences.js';
/** Choose display content without promoting reference material into scored exercises. */
export function selectWordExample(word,language){
 const display=example=>example&&language==='en'&&word.studyExplanationLanguage==='en'?{...example,studyTranslation:undefined}:example;
 const primary=wordDisplayExamples(word);
 const reviewed=primary.find(example=>example.studyTranslation?.trim())||primary[0];
 if(reviewed)return display(reviewed);
 const candidates=(word.referenceExamples||[]).filter(example=>example.text?.trim()).map(example=>({...example,studyTranslation:word.studyExplanationLanguage==='en'?example.sourceEnglishTranslation:undefined}));
 const rank=example=>(findSentenceFocus(word,example,language)?2:0)+(example.studyTranslation?.trim()?1:0);
 return display(candidates.reduce((best,example)=>!best||rank(example)>rank(best)?example:best,undefined));
}

function wordDisplayExamples(word){
 return (word.examples||word.sentences||[]).map(example=>example.text?example:{...example,text:example.de||example.hanzi}).filter(example=>example.text?.trim());
}

/** Use one attested example per recorded sense or explicitly matched usage. */
export function selectSenseExamples(word,language){
 return (word.senses||[word]).flatMap(sense=>{
  const legacyExamples=language==='zh'||language==='de'?wordDisplayExamples(sense):[];
  const usages=language==='zh'?selectChineseUsageExamples(sense,legacyExamples):[];
  if(usages.length)return usages;
  // Older packages have examples without sense labels. Retain their contexts without guessing the usage.
  if(legacyExamples.length)return legacyExamples.map(example=>({word:sense,example}));
  return [{word:sense,example:selectWordExample(sense,language)}];
 });
}
