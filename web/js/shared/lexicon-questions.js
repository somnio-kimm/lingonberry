import {createSentenceEngine} from './lexicon-sentences.js';
import {createVocabularyEngine} from './vocabulary.js';
import {createListeningEngine} from './listening.js';
import {displayStudyWord,studySpokenWord,normaliseStudyAnswer,studyInputAnswers} from '../presentation/study-profiles.js';
export function createLexiconQuestions(profile){
 const vocabulary=createVocabularyEngine({inputAnswer:word=>profile.nounArticles?displayStudyWord(word):word.lemma,
  gradeInput:(q,input)=>[...(q.acceptedAnswers||[q.answer]),...studyInputAnswers(q.word,profile)].some(answer=>normaliseStudyAnswer(answer)===normaliseStudyAnswer(input))});
 const readingIndexes=new WeakMap();
 function equivalentsFor(words,word){
  if(!word.pronunciation||!['ja','ko'].includes(profile.id))return [word];
  if(!readingIndexes.has(words)){const index=new Map();for(const item of words){const reading=item.pronunciation;if(!reading)continue;if(!index.has(reading))index.set(reading,[]);index.get(reading).push(item);}readingIndexes.set(words,index);}
  return readingIndexes.get(words).get(word.pronunciation)||[word];
 }
 const listening=createListeningEngine({language:profile.speech,spokenWord:word=>studySpokenWord(word,profile),
  wordAnswers:(words,word)=>{
   const equivalents=equivalentsFor(words,word);
   return [...new Set(equivalents.flatMap(other=>[other.lemma,...(other.listeningAliases??other.aliases??[]),displayStudyWord(other)]))];
  },
  normalize:text=>normaliseStudyAnswer(text).replace(/[.,!?;:…。，！？；：]/gu,'').replace(/\s+/gu,' ').toLocaleLowerCase(profile.id),
 });
 return {...vocabulary,...listening,...createSentenceEngine(profile)};
}
