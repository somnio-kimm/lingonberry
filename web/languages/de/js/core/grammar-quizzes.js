import {formAlternatives,finiteVerbAlternatives} from './form-alternatives.js';
import {nounArticles} from './vocabulary-tests.js';
export const PERSONS=['ich','du','er','wir','ihr','sie'];
export const personLabel=person=>person==='er'?'er / sie / es':person==='sie'?'sie / Sie':person;
const koreanPersons={
 ich:'1인칭 단수',
 du:'2인칭 단수',
 er:'3인칭 단수',
 wir:'1인칭 복수',
 ihr:'2인칭 복수',
 sie:'3인칭 복수 / 존칭',
};
export function localizedPersonLabel(person,locale,withPronoun=false){
 const pronoun=personLabel(person);
 const label=koreanPersons[person];
 if(locale!=='ko'||!label)return pronoun;
 if(!withPronoun)return label;
 if(person==='sie')return '3인칭 복수 (sie) / 존칭 (Sie)';
 return label+' ('+pronoun+')';
}
export const VERB_FORMS=['praesens','praeteritum','perfekt','plusquamperfekt','futur_i','futur_ii','konjunktiv_ii'];
export const tenseLabel=tense=>({praesens:'Präsens',praeteritum:'Präteritum',perfekt:'Perfekt',plusquamperfekt:'Plusquamperfekt',futur_i:'Futur I',futur_ii:'Futur II',konjunktiv_ii:'Konjunktiv II'}[tense]);
const futureAuxiliary={ich:'werde',du:'wirst',er:'wird',wir:'werden',ihr:'werdet',sie:'werden'};
const gloss=word=>({de:word.lemma,en:word.meaning_en.join('; '),ko:word.meaning_ko.join('; ')});
export const articleAnswerCorrect=(question,input)=>nounArticles(question.word).includes(input);
export function articleQuestions(words) {
 return words.filter(w=>w.pos==='noun'&&['der','die','das'].includes(w.article)&&w.number_restriction!=='plural').map(word=>({mode:'articles',id:word.id,word,answer:word.article,displayAnswer:word.article+' '+word.lemma,example:gloss(word)}));
}
export function verbFormQuestions(words,allWords=words) {
 const auxiliaries=new Map(allWords.filter(w=>w.pos==='verb'&&['haben','sein'].includes(w.lemma)).map(w=>[w.lemma,w]));
 return words.filter(w=>w.pos==='verb'&&w.forms).flatMap(word=>VERB_FORMS.flatMap(tense=>PERSONS.flatMap(person=>{
  let answer;
  if(['perfekt','plusquamperfekt','futur_ii'].includes(tense)){
   const match=/^(hat|ist) (.+)$/u.exec(word.forms.perfekt||'');
   const auxiliary=word.auxiliary;
   if(match&&(auxiliary==='haben'&&match[1]==='hat'||auxiliary==='sein'&&match[1]==='ist')){
    const conjugated=auxiliaries.get(auxiliary)?.forms?.[tense==='plusquamperfekt'?'praeteritum':'praesens']?.[person];
    if(tense==='futur_ii')answer=futureAuxiliary[person]+' '+match[2]+' '+auxiliary;
    else if(conjugated)answer=conjugated+' '+match[2];
   }
  }else if(tense==='futur_i')answer=futureAuxiliary[person]+' '+(word.infinitive||word.lemma);
  else answer=word.forms[tense]?.[person];
  if(typeof answer!=='string'||!answer.trim())return [];
  const acceptedAnswers=['perfekt','plusquamperfekt','futur_ii'].includes(tense)?formAlternatives(word.forms.perfekt?.replace(/^(hat|ist) /u,'')).map(participle=>tense==='futur_ii'?futureAuxiliary[person]+' '+participle+' '+word.auxiliary:answer.split(' ')[0]+' '+participle):finiteVerbAlternatives(answer,word);
  answer=acceptedAnswers[0];if(!answer)return [];
  return [{mode:'verbforms',id:word.id+':'+tense+':'+person,word,tense,person,answer,acceptedAnswers,example:gloss(word),prompt:tenseLabel(tense)+' · '+personLabel(person)+' · '+word.lemma}];
 })));
}
export const normalizeVerbForm=value=>String(value).normalize('NFC').trim().replace(/\s+/gu,' ');
export const verbFormCorrect=(question,input)=>(question.acceptedAnswers||[question.answer]).some(answer=>normalizeVerbForm(input)===normalizeVerbForm(answer));
import { NOMINAL_MODES, validNominalQuestion, snapshotGrammarQuestion } from './nominal-grammar.js';
export { snapshotGrammarQuestion };
import { GRAMMAR_MODES } from './quiz-modes.js';
export { GRAMMAR_MODES } from './quiz-modes.js';
export function validGrammarQuestion(q) {
 if(NOMINAL_MODES.includes(q?.mode))return validNominalQuestion(q);
 if(!q?.word?.id||typeof q.answer!=='string'||!q.answer.trim())return false;
 return q.mode==='articles'?['der','die','das'].includes(q.answer)&&q.displayAnswer===q.answer+' '+q.word.lemma&&q.example?.de===q.word.lemma
  :q.mode==='verbforms'&&VERB_FORMS.includes(q.tense)&&PERSONS.includes(q.person)&&q.example?.de===q.word.lemma;
}
