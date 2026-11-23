import {createExerciseQuestions} from './language-exercises.js';
import {clozeSentence,clozeSentenceTranslation} from './cloze-translation.js';
import {createQuestionRotation,sentenceQuestionKey} from './question-rotation.js';
const prepared=new WeakMap();
const sameWords=(left,right)=>left.length===right.length&&left.every((word,index)=>word===right[index]);
/** One eligible-content rotation, rather than giving a tiny expression pool half the draws. */
export function chooseCombinedCloze({engine,words,exercises,locale,answerMode='choice',previousId,random=Math.random}){
 let modes=prepared.get(engine);if(!modes){modes=new Map();prepared.set(engine,modes);}
 let cached=modes.get(answerMode);
 if(!cached||cached.locale!==locale||cached.exercises!==exercises||!sameWords(cached.words,words)){
  const route=answerMode==='input'?'vocabinput':'vocabmeaning',byId=new Map(words.map(word=>[word.id,word]));
  const expressions=exercises.filter(row=>byId.has(row.entryId)&&['collocations','phrasal','idioms'].includes(row.category)&&row.route===route&&!row.referenceExample&&(row.gapFill||row.prompt.match(/_{2,}/gu)?.length===1)&&(locale==='en'||clozeSentenceTranslation({...row,word:byId.get(row.entryId)}))).map(row=>({id:row.id,row,expression:true,sentence:clozeSentence(row),answer:row.answer}));
  const normal=engine.createSentencePool('cloze',words,locale),candidates=[...expressions,...normal.candidates];
  const rotation=createQuestionRotation(candidates,{key:row=>sentenceQuestionKey(row.sentence,row.answer)});
  const build=(candidate,random)=>{
   if(candidate.expression){
    const row=candidate.row,q=createExerciseQuestions([row],words,route,row.category,locale,random)[0];if(!q)return;
    if(!q.gapFill)q.gapFill={parts:q.prompt.split(/_{2,}/u),answers:[q.answer]};
    return {...q,mode:'cloze',answerMode,sentence:clozeSentence(q),context:clozeSentenceTranslation(q)};
   }
   const q=normal.buildCandidate(candidate.id,random);if(!q)return;if(answerMode==='choice')return q;
   const parts=[q.sentence.slice(0,q.focus.start),q.sentence.slice(q.focus.start+q.focus.text.length)];
   return {...q,id:q.id+':input',exercise:true,route:'vocabinput',category:'cloze',answerMode,options:undefined,prompt:parts.join('___'),gapFill:{parts,answers:[q.answer]},context:locale==='en'?'':q.example.studyTranslation};
  };
  cached={words:words.slice(),exercises,locale,rotation,build};modes.set(answerMode,cached);
 }
 return cached.rotation.choose(previousId,random,cached.build);
}

/** Release both answer-mode preparations when their installed study is replaced or closed. */
export function clearCombinedClozeCache(engine){prepared.delete(engine);}
