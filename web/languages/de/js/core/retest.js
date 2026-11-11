import { LISTENING_MODES, validListeningQuestion } from './listening-tests.js';
import { validVocabularyQuestion } from './vocabulary-tests.js';
import { clozeQuestions,scrambleQuestions,normalizeSentence,sentenceTokens,scrambleCorrect } from './sentence-quizzes.js';
import { articleQuestions,verbFormQuestions,GRAMMAR_MODES,validGrammarQuestion } from './grammar-quizzes.js';
import { shuffleWords } from './words.js';
export const modeLabels={cloze:'Cloze',scramble:'Sentence scramble',articles:'Article',verbforms:'Verb',cases:'Case',adjendings:'Adjective',vocabinput:'Word input',vocabmeaning:'Meaning quiz',listenword:'Dictation · Word',listensentence:'Dictation · Sentence',reading:'Reading',practice:'Grammar',listening:'Listening',checkpoint:'Checkpoint'};
export function reviewCatalog(words,rows=null) {
 const index=new Map(),builders={cloze:clozeQuestions,scramble:scrambleQuestions,articles:articleQuestions,verbforms:pool=>verbFormQuestions(pool,words)};
 // Snapshots already contain their original question; generate only needed legacy questions.
 for(const [mode,build] of Object.entries(builders)){
  const needed=rows?.filter(row=>row.quizMode===mode&&!row.questionSnapshot);
  if(needed&&!needed.length)continue;
  const ids=needed?new Set(needed.map(row=>row.word?.id||row.wordId)):null;
  const pool=ids?words.filter(word=>ids.has(word.id)):words;
  for(const question of build(pool))index.set(mode+':'+question.id,{mode,question,key:mode+':'+question.id});
 }
 return index;
}
/** Replay the original bound sentence, never substitute an updated dictionary example. */
function originalSentenceItem(row){
 const mode=row.quizMode,saved=row.questionSnapshot,word=saved?.word||row.word,example=saved?.example||row.example;
 if(!word?.id||typeof word.lemma!=='string'||!word.lemma||row.wordId&&word.id!==row.wordId||
    typeof example?.de!=='string'||!example.de||example.de!==row.example?.de||normalizeSentence(example.de)!==example.de)return null;
 if(saved&&(saved.id!==row.question.id||saved.mode!==undefined&&saved.mode!==mode))return null;
 let question;
 if(mode==='scramble'){
  if(row.question.answer!==example.de||saved?.tokens&&!scrambleCorrect({example},saved.tokens))return null;
  const tokens=sentenceTokens(example.de);if(tokens.length<2)return null;
  question={...saved,id:row.question.id,mode,word,example:{...example},tokens};
 }else{
  const answer=saved?.answer??row.question.answer;
  if(typeof answer!=='string'||!answer||answer!==row.question.answer)return null;
  const declared=example.focus,start=saved?.start??row.questionContext?.start??declared?.start;
  if(start!==undefined&&start!==null&&(!Number.isInteger(start)||start<0||example.de.slice(start,start+answer.length)!==answer||
     declared!==undefined&&(declared?.start!==start||declared?.text!==answer)))return null;
  if(saved){
   if(!Number.isInteger(start)||!saved.form||typeof saved.form.kind!=='string'||typeof saved.form.text!=='string'||!saved.form.text||!Array.isArray(saved.form.path)||
      saved.form.adjectivePatterns!==undefined&&!Array.isArray(saved.form.adjectivePatterns))return null;
   question={...saved,id:row.question.id,mode,word,example:{...example},start,answer};
  }else{
   // Legacy records need either a saved blank position or an unambiguous target.
   if(start===undefined||start===null){const at=example.de.indexOf(answer);if(at<0||example.de.indexOf(answer,at+answer.length)>=0)return null;}
   const source=Number.isInteger(start)?{...example,focus:{start,text:answer}}:example;
   const rebuilt=clozeQuestions([{...word,examples:[source]}])[0];
   if(!rebuilt||rebuilt.answer!==answer||Number.isInteger(start)&&rebuilt.start!==start||
      rebuilt.form.kind==='focus'&&declared===undefined&&!rebuilt.form.adjectivePatterns?.length)return null;
   question={...rebuilt,id:row.question.id,mode};
  }
 }
 return {mode,question,key:mode+':'+row.question.id};
}
export function reviewItems(rows,catalog) {
 const items=[],unavailable=[],seen=new Set();
 for(const row of rows){
  const sentence=['cloze','scramble'].includes(row.quizMode),vocab=['vocabinput','vocabmeaning'].includes(row.quizMode),listening=LISTENING_MODES.includes(row.quizMode),grammar=GRAMMAR_MODES.includes(row.quizMode)&&row.questionSnapshot;
  const item=sentence?originalSentenceItem(row):grammar?(validGrammarQuestion(row.questionSnapshot)?{mode:row.quizMode,question:row.questionSnapshot,key:row.quizMode+':'+row.question.id}:null):listening?(validListeningQuestion(row.questionSnapshot)?{mode:row.quizMode,question:row.questionSnapshot,key:row.quizMode+':'+row.question.id}:null):vocab?(validVocabularyQuestion(row.questionSnapshot)?{mode:row.quizMode,question:row.questionSnapshot,key:row.quizMode+':'+row.question.id}:null):row.quizMode?catalog.get(row.quizMode+':'+row.question.id):{mode:'saved',stage:row.stage,unit:row.unit,question:row.question,key:'saved:'+row.unit.id+':'+row.question.id};
  if(!item||row.quizMode&&(item.question.id!==row.question.id||item.question.mode&&item.question.mode!==row.quizMode||(item.mode==='scramble'?item.question.example.de:item.question.displayAnswer||item.question.answer)!==row.question.answer||item.question.example.de!==row.example?.de)||!row.quizMode&&!Array.isArray(row.question.accepted)){unavailable.push(row);continue;}
  if(!seen.has(item.key)){items.push(item);seen.add(item.key);}
 }
 return {items,unavailable};
}
export function createRetestSession(items,random=Math.random) {
 return {items:shuffleWords(items,random),index:0,results:items.map(()=>null)};
}
export function recordRetestResult(session,result) {
 if(session.index>=session.items.length||session.results[session.index])return false;
 session.results[session.index]={...result};return true;
}
export function retestScore(session) {
 const results=session.results.filter(Boolean),answered=results.filter(r=>!r.skipped);
 return {correct:answered.filter(r=>r.correct).length,total:answered.length,incorrect:answered.filter(r=>!r.correct).length,skipped:results.filter(r=>r.skipped).length};
}
export function advanceRetest(session) {
 if(!session.results[session.index])return false;
 session.index=Math.min(session.index+1,session.items.length);return true;
}
