import { wrongAnswerCount } from './wrong-count.js';
import { LISTENING_MODES } from './quiz-modes.js';
// Keep review-list dismissal separate from assessment and attempt history.
import { wordType } from './dictionary.js';
export const wrongMode=row=>row.quizMode||row.stage;
export { wrongAnswerCount } from './wrong-count.js';
export const filterWrongEntries=(rows,{level='all',pos='all',mode='all'}={})=>rows.filter(row=>(level==='all'||row.unit.level===level)&&(pos==='all'||row.type===pos)&&(mode==='all'||wrongMode(row)===mode));
export function wrongEntries(units, state, words=[]) {
  const byId=new Map(words.map(w=>[w.id,w]));
  const rows = [];
  for (const unit of units) {
    for (const stage of ['reading','practice','listening','checkpoint']) {
      const questions = Array.isArray(unit[stage]) ? unit[stage] : unit[stage]?.questions||[];
      for (const question of questions) {
        const record = state.units[unit.id]?.answers[question.id];
        const attempts = record?.attempts || [];
        let index = -1;
        for (let i = 0; i < attempts.length; i++) if (attempts[i].correct === false) index = i;
        const wrongCount=wrongAnswerCount(attempts,state.wrongDismissed?.[unit.id]?.[question.id]??-1);
        if (index < 0 || index <= (state.wrongDismissed?.[unit.id]?.[question.id]??-1)) continue;
        rows.push({ unit, question, stage, attempt:attempts[index], corrected:record.correct === true,wrongCount,type:'saved' });
      }
    }
  }
  for(const mode of ['cloze','scramble','articles','verbforms','vocabinput','vocabmeaning',...LISTENING_MODES,'cases','adjendings']){
    for(const [id,record] of Object.entries(state.quizAnswers?.[mode]||{})){
      const attempts=record.attempts||[];let index=-1;
      for(let i=0;i<attempts.length;i++)if(attempts[i].correct===false)index=i;
      const wrongCount=wrongAnswerCount(attempts,record.dismissedThrough??-1);
      if(index<0||index<=(record.dismissedThrough??-1))continue;
      const word=record.questionSnapshot?.word||byId.get(record.wordId||id.split(':')[0]);
      rows.push({unit:{id:'vocabulary-quizzes',level:record.level},question:{id,prompt:{cloze:'Cloze',scramble:'Sentence scramble',articles:'Article',verbforms:'Verb',cases:'Case',adjendings:'Adjective',vocabinput:'Word input',vocabmeaning:'Meaning quiz',listenword:'Dictation · Word',listensentence:'Dictation · Sentence'}[mode],sentence:record.example.de,answer:record.answer,explanation:'The correct answer is shown in the sentence.'},stage:mode,attempt:attempts[index],corrected:record.correct===true,wrongCount,quizMode:mode,example:record.example,grammarPrompt:record.prompt,questionContext:record.questionContext,questionSnapshot:record.questionSnapshot,word,wordId:record.wordId,type:word?wordType(word):'other'});
    }
  }
  return rows.sort((a,b)=>b.attempt.at-a.attempt.at);
}
