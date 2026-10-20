import {findSentenceFocus} from './lexicon-sentences.js';
/** Choose display content without promoting reference material into scored exercises. */
export function selectWordExample(word,language){
 const primary=(word.examples||[]).filter(example=>example.text?.trim());
 const reviewed=primary.find(example=>example.studyTranslation?.trim())||primary[0];
 if(reviewed)return reviewed;
 const candidates=(word.referenceExamples||[]).filter(example=>example.text?.trim()).map(example=>({...example,studyTranslation:word.studyExplanationLanguage==='en'?example.sourceEnglishTranslation:undefined}));
 const rank=example=>(findSentenceFocus(word,example,language)?2:0)+(example.studyTranslation?.trim()?1:0);
 return candidates.reduce((best,example)=>!best||rank(example)>rank(best)?example:best,undefined);
}
