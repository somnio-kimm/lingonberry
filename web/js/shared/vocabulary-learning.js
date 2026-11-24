import {selectWordExample} from './word-example.js';
import {findSentenceFocus} from './lexicon-sentences.js';
import {vocabularyMeaning,vocabularyWord} from './vocabulary.js';
/** Use the question's own sense and selected explanation; never substitute a neighbour. */
export function vocabularyLearningContent(question,{language,locale,fallbackWord}){
 const word=question.word,contentLocale=word.studyExplanationLanguage||question.locale||locale,live=fallbackWord?.id===word.id&&fallbackWord.studyExplanationLanguage===contentLocale?fallbackWord:undefined,examples=[...(question.learningExample?[question.learningExample]:[]),...(word.examples||word.sentences||live?.examples||live?.sentences||[])].map(row=>({...row,text:row.text||row.de||row.hanzi,studyTranslation:row.studyTranslation??(contentLocale==='ko'?row.ko??row.meaningKo:row.en??row.meaningEn)}));
 const adapted={...word,lemma:vocabularyWord(word),studyExplanationLanguage:contentLocale,examples};
 const example=selectWordExample(adapted,language),meaning=vocabularyMeaning(word,locale);
 let hint;
 if(example&&examples.some(row=>row.text===example.text)&&example.practiceEligible!==false&&example.clozeEligible!==false){
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
export const vocabularyLearningLabels=locale=>locale==='ko'?{hint:'힌트'}:{hint:'Hint'};

/** Save one sense example alongside the question, not an entire dictionary entry. */
export function withVocabularyLearning(question,config){
 const example=vocabularyLearningContent(question,config).example;
 return example?{...question,learningExample:example}:question;
}
