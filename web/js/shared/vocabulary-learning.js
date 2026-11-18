import {selectWordExample} from './word-example.js';
import {findSentenceFocus} from './lexicon-sentences.js';
import {vocabularyMeaning,vocabularyWord} from './vocabulary.js';
/** Use the question's own sense and selected explanation; never substitute a neighbour. */
export function vocabularyLearningContent(question,{language,locale}){
 const word=question.word,contentLocale=word.studyExplanationLanguage||question.locale||locale,examples=(word.examples||word.sentences||[]).map(row=>({...row,text:row.text||row.de||row.hanzi,studyTranslation:row.studyTranslation??(contentLocale==='ko'?row.ko??row.meaningKo:row.en??row.meaningEn)}));
 const adapted={...word,lemma:vocabularyWord(word),studyExplanationLanguage:contentLocale,examples};
 const example=selectWordExample(adapted,language),meaning=vocabularyMeaning(word,locale);
 let hint;
 if(example&&example.practiceEligible!==false&&example.clozeEligible!==false){
  const focus=findSentenceFocus(adapted,example,language);
  if(focus){
   const parts=[example.text.slice(0,focus.start),example.text.slice(focus.start+focus.text.length)];
   // Repeated answers outside an explicit focus would give the hint away.
   const remainder=parts.join(' ').normalize('NFC').toLocaleLowerCase(language),answer=focus.text.normalize('NFC').toLocaleLowerCase(language);
   if(!remainder.includes(answer))hint=parts;
  }
 }
 return {word:vocabularyWord(word),meaning,example,hint};
}
export const vocabularyLearningLabels=locale=>locale==='ko'?{sound:'소리 힌트',example:'예문 힌트',examples:'예문'}:{sound:'Sound Hint',example:'Example Hint',examples:'Examples'};
