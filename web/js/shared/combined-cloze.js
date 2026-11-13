import {createExerciseQuestions} from './language-exercises.js';
import {selectExerciseRow} from './exercise-pools.js';
import {clozeSentence,clozeSentenceTranslation} from './cloze-translation.js';

/** Keep authored expression gaps and ordinary dictionary sentences in the same Cloze session. */
export function chooseCombinedCloze({engine,words,exercises,locale,answerMode='choice',previousId,random=Math.random}){
 const route=answerMode==='input'?'vocabinput':'vocabmeaning';
 const byId=new Map(words.map(word=>[word.id,word]));
 const rows=exercises.filter(row=>['collocations','phrasal','idioms'].includes(row.category)&&
  row.route===route&&!row.referenceExample&&(row.gapFill||row.prompt.match(/_{2,}/gu)?.length===1)&&
  (locale==='en'||clozeSentenceTranslation({...row,word:byId.get(row.entryId)})));
 const selected=selectExerciseRow(rows,words,{previousId,random});
 const expression=selected&&createExerciseQuestions([selected],words,route,selected.category,locale,random)[0];
 if(expression){
  if(!expression.gapFill)expression.gapFill={parts:expression.prompt.split(/_{2,}/u),answers:[expression.answer]};
  expression.mode='cloze';
  expression.answerMode=answerMode;
  expression.sentence=clozeSentence(expression);
  expression.context=clozeSentenceTranslation(expression);
 }
 if(expression&&random()<.5)return expression;
 const normal=engine.createSentencePool('cloze',words,locale).choose(previousId?.replace(/:input$/u,''),random);
 if(!normal)return expression;
 if(answerMode==='choice')return normal;
 const parts=[normal.sentence.slice(0,normal.focus.start),normal.sentence.slice(normal.focus.start+normal.focus.text.length)];
 return {...normal,id:normal.id+':input',exercise:true,route:'vocabinput',category:'cloze',answerMode,
  options:undefined,prompt:parts.join('___'),gapFill:{parts,answers:[normal.answer]},context:locale==='en'?'':normal.example.studyTranslation};
}
