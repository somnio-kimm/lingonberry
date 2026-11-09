import {isLanguageCode} from './language-pairs.js';
import {vocabularyWord,vocabularyMeaning,snapshotVocabularyQuestion} from './vocabulary.js';
export const LISTENING_MODES=Object.freeze(['listenword','listensentence']);
/** Playback and question shape are shared; accepted speech/spelling belongs to the language. */
export function createListeningEngine({language,spokenWord=vocabularyWord,wordAnswers=(_words,word)=>[vocabularyWord(word)],normalize}) {
 function listeningQuestions(mode,words,locale='en',allWords=words) {
  if(!LISTENING_MODES.includes(mode))return [];
  return words.flatMap(word=>{
   const lemma=vocabularyWord(word);if(!lemma)return [];
   if(mode==='listenword')return [{mode,id:word.id+':word:'+locale,word,locale,language,kind:'word',
    prompt:'Listen and type the word.',spokenText:spokenWord(word),answer:lemma,acceptedAnswers:wordAnswers(allWords,word),
    example:{de:spokenWord(word),en:vocabularyMeaning(word,'en'),ko:vocabularyMeaning(word,'ko')}}];
   return (word.sentences||word.examples||[]).flatMap((sentence,i)=>{
    const text=sentence.hanzi||sentence.de;if(sentence.practiceEligible===false||!text?.trim())return [];
    return [{mode,id:word.id+':sentence:'+i+':'+locale,word,locale,language,kind:'sentence',
     prompt:'Listen and type the sentence.',spokenText:text,answer:text,acceptedAnswers:[text],sentence:{...sentence},
     example:{de:text,en:sentence.meaningEn||sentence.en||'',ko:sentence.meaningKo||sentence.ko||''}}];
   });
  });
 }
 function normalizeListeningAnswer(value,question){return normalize(String(value??'').normalize('NFC').trim(),question);}
 function listeningAnswerCorrect(question,input){const value=normalizeListeningAnswer(input,question);return !!value&&question.acceptedAnswers.some(answer=>normalizeListeningAnswer(answer,question)===value);}
 function validListeningQuestion(q){return !!(q&&LISTENING_MODES.includes(q.mode)&&q.kind===(q.mode==='listenword'?'word':'sentence')
  &&q.word?.id&&vocabularyWord(q.word)&&isLanguageCode(q.locale)&&q.language===language
  &&typeof q.spokenText==='string'&&q.spokenText.trim()&&typeof q.answer==='string'&&q.answer.trim()
  &&Array.isArray(q.acceptedAnswers)&&q.acceptedAnswers.length&&q.acceptedAnswers.every(a=>typeof a==='string'&&a.trim())
  &&q.acceptedAnswers.includes(q.answer)&&q.example?.de===q.spokenText);}
 return {listeningQuestions,normalizeListeningAnswer,listeningAnswerCorrect,validListeningQuestion,snapshotListeningQuestion:snapshotVocabularyQuestion};
}
