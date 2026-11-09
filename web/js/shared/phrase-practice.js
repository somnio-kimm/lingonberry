import {findSentenceFocus} from './lexicon-sentences.js';
import {vocabularyGlossKey,vocabularyType} from './vocabulary.js';

const categories = ['idioms','phrasal','collocations'];
const recallInstructions = {
 vocabmeaning:['Choose the expression that matches the meaning.','뜻에 맞는 표현을 선택하세요.'],
 vocabinput:['Type the expression that matches the meaning.','뜻에 맞는 표현을 입력하세요.'],
};
export const phraseRecallUiPairs = Object.values(recallInstructions);

/** Build phrase practice from dictionary entries without storing copies of each question in the package. */
export function createPhrasePractice(study, words) {
 if (study?.targetLanguage !== 'en' || study.explanationLanguage !== 'en') return [];
 const groups = new Map();
 for (const word of words) {
  const category = categories.find(value => word.tags?.includes('practice:phrase:'+value));
  if (!category || !word.studyMeaning) continue;
  const key = category+':'+word.level+':'+vocabularyType(word);
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push({word,category,gloss:vocabularyGlossKey(word.studyMeaning)});
 }
 const questions = [];
 for (const group of groups.values()) {
  const equivalents = new Map();
  for (const {word,gloss} of group) {
   if (!equivalents.has(gloss)) equivalents.set(gloss,[]);
   equivalents.get(gloss).push(word.lemma);
  }
  for (const [index,{word,category,gloss}] of group.entries()) {
   const example = word.examples[0] || word.referenceExamples[0];
   const focus = example?.practiceEligible!==false && example?.clozeEligible!==false && example && findSentenceFocus(word,example,'en');
   const gapFill = focus && {
    parts:[example.text.slice(0,focus.start),example.text.slice(focus.start+focus.text.length)],
    answers:[focus.text],
   };
   const base = {
    entryId:word.id,category,answer:focus?focus.text:word.lemma,
    prompt:gapFill?gapFill.parts.join('___'):word.studyMeaning,
    explanation:word.lemma+' — '+word.studyMeaning,
    ...(gapFill&&!word.examples.length?{referenceExample:true}:{}),
    ...(gapFill?{gapFill,context:word.studyMeaning}:{}),
    ...(!gapFill?{acceptedAnswers:equivalents.get(gloss)}:{}),
   };
   const options = [base.answer];
   for (let offset=1;offset<group.length&&options.length<4;offset++) {
    const candidate = group[(index+offset)%group.length];
    if (candidate.gloss!==gloss&&!options.includes(candidate.word.lemma)) options.push(candidate.word.lemma);
   }
   questions.push({
    ...base,id:word.id+'-input',route:'vocabinput',
    instruction:gapFill?'Fill each blank with the missing part of the expression.':recallInstructions.vocabinput[0],
   });
   if (options.length>1) questions.push({
    ...base,id:word.id+'-choice',route:'vocabmeaning',options,
    instruction:gapFill?'Choose the missing parts in order.':recallInstructions.vocabmeaning[0],
   });
  }
 }
 return questions;
}
