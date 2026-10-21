import {shuffle} from '../../../../js/shared/random.js';
import { LISTENING_MODES, validListeningQuestion } from './listening-tests.js';
import { validVocabularyQuestion } from './vocabulary-tests.js';
import { Pinyin } from './pinyin.js';
export const REVIEW_MODES=['pinyin','tone','cloze','scramble','vocabinput','vocabmeaning',...LISTENING_MODES];
export function snapshotQuestion(mode,word,sentence=null){
 const {id,hanzi,hskLevel,syllables,alternateSyllables,meaningEn,meaningKo,partOfSpeech,studyMeaning,studyExplanationLanguage}=word;
 return {mode,word:{id,hanzi,hskLevel,syllables,alternateSyllables,meaningEn,meaningKo,partOfSpeech,studyMeaning,studyExplanationLanguage},sentence:sentence?{...sentence}:null,blankStart:mode==='cloze'?sentence?.hanzi.indexOf(hanzi):null};
}
export function resolveWrongQuestion(record,words){
 if(!REVIEW_MODES.includes(record.mode))return null;
 const live=words.find(w=>w.id===record.wordId)||(!record.wordId?words.find(w=>w.hanzi===record.wordHanzi):null);
 if(LISTENING_MODES.includes(record.mode))return validListeningQuestion(record.question)?{...record.question,word:{...live,...record.question.word},reconstructed:false}:null;
 if(['vocabinput','vocabmeaning'].includes(record.mode)){return validVocabularyQuestion(record.question)?{...record.question,word:{...live,...record.question.word},reconstructed:false}:null;}
 if(record.question?.word?.syllables?.length){const q=record.question;return {...q,word:{...live,...q.word},reconstructed:false};}
 if(!live)return null;
 if(record.mode==='pinyin'||record.mode==='tone')return {mode:record.mode,word:live,sentence:null,reconstructed:true};
 const candidates=live.sentences||[];
 const sentence=record.mode==='scramble'?candidates.find(s=>s.hanzi===record.correctAnswer):candidates.find(s=>s.hanzi.includes(live.hanzi));
 if(!sentence)return null;
 return {...snapshotQuestion(record.mode,live,sentence),reconstructed:true,originalMissing:record.mode==='cloze'};
}
export function expectedSyllables(record,word){
 if(record.mode!=='pinyin')return word?.syllables||[];
 return [word?.syllables,...(word?.alternateSyllables||[])].filter(Array.isArray).find(syls=>Pinyin.compare(String(record.correctAnswer||''),{syllables:syls}))||word?.syllables||[];
}
export function syllableMistakes(record,word){
 if(Array.isArray(record.wrongParts))return record.wrongParts;
 if(!word?.syllables?.length)return [];
 const actual=String(record.userAnswer||'').trim().split(/\s+/u),expected=String(record.correctAnswer||'').trim().split(/\s+/u);
 return expectedSyllables(record,word).flatMap((s,i)=>{
  const answer=actual[i]||'',target=expected[i]||Pinyin.marked(s.base,s.tone);
  const correct=record.mode==='pinyin'?Pinyin.compare(answer,{syllables:[s]}):answer.normalize('NFC')===target.normalize('NFC');
  return correct?[]:[{index:i,hanzi:s.hanzi,actual:Pinyin.convertLive(answer),expected:Pinyin.convertLive(target)}];
 });
}
export function characterDifferences(expected,actual){
 const correct=[...String(expected||'')],given=[...String(actual||'')],positions=[];
 for(let i=0;i<Math.max(correct.length,given.length);i++)if(correct[i]!==given[i])positions.push(i);
 return {expected:correct,actual:given,positions};
}
export function makeReviewQueue(rows,words,random=Math.random){
 const items=[],unavailable=[];
 for(const record of rows){const question=resolveWrongQuestion(record,words);if(question)items.push({recordId:record.id,mode:record.mode,question});else unavailable.push(record);}
 const ordered=shuffle(items,random);
 return {items:ordered,unavailable,index:0,results:ordered.map(()=>null)};
}
export const reviewScore=session=>({correct:session.results.filter(r=>r?.correct).length,total:session.results.filter(r=>r&&!r.skipped).length,incorrect:session.results.filter(r=>r&&!r.correct&&!r.skipped).length,skipped:session.results.filter(r=>r?.skipped).length});

export { wrongAnswerCount } from './wrong-count.js';
