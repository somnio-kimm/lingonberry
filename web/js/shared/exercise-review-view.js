import {escapeHtml as e} from './ui.js';
import {renderStudyReviewAnswer} from './study-components.js';
import {renderExerciseGap} from './exercise-view.js';
import {renderPhraseGapSentence} from './phrase-gap-view.js';
import {gradePhraseGaps,splitGapAnswers,joinGapAnswers} from './phrase-gaps.js';
import {normaliseKana} from './japanese-reading.js';
import {formKindLabel} from './language-exercises.js';
import {localizeExerciseText} from './exercise-text.js';
import {localizeRootPromptOrigin} from './root-references.js';
import {japaneseReadingPrompt,japaneseReadingContext} from './japanese-reading-prompt.js';
const normalise=value=>String(value??'').normalize('NFKC').trim().replace(/[’‘]/gu,"'").replace(/\s+/gu,' ');
/** Review owns its compact details; quiz prompts/controls must not be embedded in a saved card. */
export function renderExerciseReview(record,{word,headword,language,displayLanguage,t}){
 const q=record.question,meaningChoice=!!q.collocationId&&!!q.options;
 const given=q.options?q.options.find(option=>option.id===record.input)?.text??record.input:record.input;
 const answerLanguage=meaningChoice?q.locale:language,field=(label,valueHtml,correct=false,options={})=>renderStudyReviewAnswer({label:t(label),valueHtml,correct,lang:answerLanguage,...options});
 let expected=q.answer,wrongHtml=e(given||'—'),strike=true;
 if(q.gapFill){
  const parts=splitGapAnswers(given),result=gradePhraseGaps(q.gapFill,parts);expected=joinGapAnswers(result.answers);strike=false;
  wrongHtml=result.matches.map((correct,index)=>correct?`<span class="correct-answer">${e(parts[index])}</span>`:`<del class="wrong-token">${e(parts[index]||'—')}</del>`).join(' … ');
 }
 const covered=[word.lemma,headword,...(meaningChoice?[word.studyMeaning]:[])].some(value=>value&&normalise(value)===normalise(expected));
 const readingCovered=q.category==='reading'&&word.pronunciation&&normaliseKana(expected).trim()===normaliseKana(word.pronunciation).trim();
 const correct=covered||readingCovered?'':field('Correct Answer',e(expected),true),wrong=field('Wrong Answer',wrongHtml,false,{strike,only:!correct});
 if(q.category==='reading'){
  const snapshot=q.word||word;
  const target=japaneseReadingPrompt(snapshot,q.prompt,q.readingFocus);
  if(!target)return correct+wrong;
  const {prompt,readingFocus:focus}=target;
  if(prompt===(snapshot.lemma||snapshot.word))return correct+wrong;
  const sentence=e(prompt.slice(0,focus.start))+`<span class="study-reading-target">${e(focus.text)}</span>`+e(prompt.slice(focus.start+focus.text.length));
  const translation=q.context===''?'':japaneseReadingContext(snapshot,prompt,q.context);
  const context=translation?`<p class="wrong-translation" lang="${e(q.locale||snapshot.studyExplanationLanguage||'')}">${e(translation)}</p>`:'';
  return `<div class="wrong-question-block"><p class="wrong-question" lang="ja">${sentence}</p>${context}</div>`+correct+wrong;
 }
 if(q.category==='okurigana'&&q.boundaryKind==='spelling')return correct+wrong;
 if(q.category==='forms'||q.route==='forms'||q.mode==='forms'){
  const condition=localizeExerciseText(q.condition||formKindLabel(q.formKind,displayLanguage)||q.instruction||'',displayLanguage),base=q.word?.lemma||word.lemma;
  const baseLines=[base,`${base}（${q.word?.pronunciation||''}）`,`${base} (${q.word?.pronunciation||''})`];
  const question=baseLines.some(value=>q.prompt===value+'\n'+q.condition)||q.prompt===q.condition?'___':q.prompt;
  const row=(key,label,value,classes='',lang='')=>`<div class="wrong-form-row ${classes}" data-form-detail="${key}"><span class="wrong-form-label">${e(t(label))}</span><div class="wrong-form-value"${lang?` lang="${e(lang)}"`:''}>${value}</div></div>`;
  return `<div class="wrong-form-details">${row('conditions','Conditions',e(condition))}${row('base','Base Form',e(headword),'',language)}${row('question','Question',renderExerciseGap(question,displayLanguage,'review'),'',language)}${row('correct','Correct Answer',`<span class="correct-answer">${e(expected)}</span>`,'wrong-correct-line wrong-answer-row',language)}${row('wrong','Wrong Answer',`<del class="wrong-answer-value--wrong">${e(given||'—')}</del>`,'wrong-user-line wrong-answer-row',language)}</div>`;
 }
 let prompt=q.prompt||'';
 if(q.category==='roots'&&q.rootFamilyId){
  const suffix='\n'+(q.word?.studyMeaning||'');if(q.word?.studyMeaning&&prompt.endsWith(suffix))prompt=prompt.slice(0,-suffix.length);
  prompt=localizeRootPromptOrigin(prompt,displayLanguage);
 }
 if(q.collocationId&&!q.options){const suffix='\n('+(q.word?.lemma||q.word?.hanzi||'')+')';if(prompt.endsWith(suffix))prompt=prompt.slice(0,-suffix.length);}
 const duplicates=[word.lemma,headword,word.studyMeaning,q.word?.studyMeaning].filter(Boolean).map(normalise);
 const question=q.gapFill?renderPhraseGapSentence(q,{uiLanguage:displayLanguage,variant:'review'}):prompt&&!duplicates.includes(normalise(prompt))?`<p class="wrong-question" lang="${e(q.category==='roots'||q.collocationId&&!q.options?q.locale||language:language)}">${renderExerciseGap(prompt,displayLanguage,'review')}</p>`:'';
 const context=q.context&&!duplicates.includes(normalise(q.context))?`<p class="wrong-translation" lang="${e(q.locale||language)}">${e(q.context)}</p>`:'';
 return (question||context?`<div class="wrong-question-block">${question}${context}</div>`:'')+correct+wrong;
}
