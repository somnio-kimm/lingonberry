import {findSentenceTarget} from './sentence-focus.js';
import {createVocabularyEngine,vocabularyWord,vocabularyType,shuffle} from '../../../../js/shared/vocabulary.js';
export {VOCABULARY_MODES,vocabularyWord,vocabularyType,vocabularyMeaning,snapshotVocabularyQuestion,validVocabularyQuestion} from '../../../../js/shared/vocabulary.js';
export const {createVocabularyPool,vocabularyQuestions,vocabularyAnswerCorrect}=createVocabularyEngine();

/** Cloze distractors share the complete normalized part-of-speech set. */
export function clozeWordOptions(word,words,random=Math.random) {
 const type=vocabularyType(word),seen=new Set([vocabularyWord(word)]),options=[word];
 if(!type)return options;
 for(const candidate of shuffle(words.filter(w=>vocabularyType(w)===type),random)){
  const text=vocabularyWord(candidate);if(!text||seen.has(text))continue;
  seen.add(text);options.push(candidate);if(options.length===4)break;
 }
 return shuffle(options,random);
}
export function clozeStudyWords(words) {
 const types=new Map();
 for(const word of words){const type=vocabularyType(word);if(!type)continue;if(!types.has(type))types.set(type,new Set());types.get(type).add(vocabularyWord(word));}
 return words.filter(word=>types.get(vocabularyType(word))?.size>1&&word.sentences?.some(s=>findSentenceTarget(s,word.hanzi)));
}
