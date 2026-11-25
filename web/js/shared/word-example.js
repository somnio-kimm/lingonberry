import {readChineseUsages,selectChineseUsageExamples} from './chinese-usage-examples.js';
import {readWordSenses} from './headwords.js';
import {findSentenceFocus} from './lexicon-sentences.js';
import {meaningDisplayLines} from './meaning-display.js';
import {reviewedExampleMeanings} from './reviewed-example-links.js';
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

export function readDictionaryMeanings(word,language,value=word.studyMeaning){
 const lines=readWordSenses(word).flatMap(sense=>{
  const usages=language==='zh'?readChineseUsages(sense):[];
  if(usages.length)return usages.flatMap(({word:usage})=>meaningDisplayLines(usage.studyMeaning,usage));
  return meaningDisplayLines(sense.studyMeaning??value,sense);
 });
 return [...new Set(lines)];
}

/** Use one attested example per recorded sense or explicitly matched usage. */
export function selectSenseExamples(word,language,value=word.studyMeaning){
 const rows=readWordSenses(word).flatMap(sense=>{
  const legacyExamples=language==='zh'||language==='de'?wordDisplayExamples(sense):[];
  const usages=language==='zh'?selectChineseUsageExamples(sense,legacyExamples):[];
  if(usages.length)return usages;
  // Older packages have examples without sense labels. Retain their contexts without guessing the usage.
  if(legacyExamples.length){
   const links=reviewedExampleMeanings(sense,legacyExamples.length);
   return legacyExamples.map((example,index)=>({word:sense,example,meaningIndex:links[index]}));
  }
  return [{word:sense,example:selectWordExample(sense,language)}];
 });
 const meanings=readDictionaryMeanings(word,language,value);
 if(!meanings.length)return rows;
 const numbers=new Map(meanings.map((meaning,index)=>[meaning,index+1]));
 return rows.map(row=>{
  const lines=meaningDisplayLines(row.word.studyMeaning??value,row.word);
  // An example owned by a record with several unlabelled meanings has no reliable match.
  const meaning=lines.length===1?lines[0]:lines[row.meaningIndex-1];
  const number=numbers.get(meaning);
  return number?{...row,number}:row;
 });
}
