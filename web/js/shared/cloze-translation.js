import {completeGapSentence} from './phrase-gaps.js';
const clean=value=>typeof value==='string'?value.normalize('NFC').trim():'';

export function clozeSentence(question){
 return question.sentence||(question.gapFill?completeGapSentence(question.gapFill):question.prompt?.replace(/_{2,}/u,question.answer||''))||'';
}

/** A hint belongs to the exact question sentence, never to the headword's gloss. */
export function clozeSentenceTranslation(question){
 const sentence=clean(clozeSentence(question)),word=question.word;
 if(!sentence)return '';
 const translations=new Set([question.example,...(word?.examples||[])].filter(example=>example&&clean(example.text||example.de)===sentence)
  .map(example=>clean(example.studyTranslation)).filter(Boolean));
 if(translations.size===1)return [...translations][0];
 if(translations.size>1)return '';
 const context=clean(question.context);
 return context&&context!==clean(word?.studyMeaning)?context:'';
}
