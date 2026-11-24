import {hasClozeTranslationTarget,preferAlignedCloze} from '../../../../js/shared/cloze-translation.js';
import {projectScrambleTiles} from '../../../../js/shared/lexicon-sentences.js';
import {readQuestionTranslationFocus} from '../../../../js/shared/translation-focus.js';
import {createQuestionRotation,sentenceQuestionKey} from '../../../../js/shared/question-rotation.js';
import {renderLexiconSentence} from '../../../../js/shared/lexicon-sentence-view.js';
import { escapeHtml as e, showQuizBurst } from '../../../../js/shared/ui.js';
import { t, getLocale, sentenceMeaning, wordMeaning } from '../core/i18n.js';
import { createStudyControls, studyFilterMarkup } from './study-components.js';
import { studyWords, filterStudyStatus, shuffleWords, wordHeading } from '../core/words.js';
import { clozeQuestions, clozeOptions, hasClozeDistractor, scrambleQuestions, scrambleCorrect, joinSentenceTokens } from '../core/sentence-quizzes.js';
import { speakGerman, stopMedia } from '../core/media.js';
function renderSentenceQuiz(el,ctx,mode,session={}) {
 const level=ctx.store.state.preferences.studyLevel,words=studyWords(ctx.words,level);
 const build=mode==='cloze'?pool=>clozeQuestions(pool).filter(q=>hasClozeDistractor(q,pool)):scrambleQuestions;
 const alignment=new WeakMap(),details=mode==='cloze'?createStudyControls(el,ctx):null;
 const aligned=question=>hasClozeTranslationTarget(question,sentenceMeaning(question.example),'de',question.word.studyExplanationLanguage||getLocale());
 let status='all',pos='all',filterOpen=false,rotation,rotationRows=[];
 let questions=session.question?[session.question]:build(words),question,options=[],pool=[],chosen=[],feedback='',input='',destroyed=false,childCleanup=()=>{},generation=0;
 const review=session.question?null:ctx.quizReview;ctx.quizReview=null;
 if(review?.mode===mode){const q=build(ctx.words).find(q=>q.id===review.id);if(q)questions=[q,...questions.filter(item=>item.id!==q.id)];}
 function filterMarkup(){return session.question?'':studyFilterMarkup(words,ctx.store,status,pos,filterOpen);}
 function bindFilters(){
  const fold=el.querySelector('.study-filter-panel');if(fold)fold.ontoggle=()=>{filterOpen=fold.open;};
  el.querySelectorAll('[data-f]').forEach(button=>button.onclick=()=>{status=button.dataset.f;ctx.haptic();newQuestion();});
  el.querySelectorAll('[data-tag]').forEach(button=>button.onclick=()=>{pos=button.dataset.tag;ctx.haptic();newQuestion();});
 }
 function newQuestion(first=false) {
  if(destroyed)return;
  stopMedia();
  const ids=new Set(filterStudyStatus(studyWords(words,level,{pos}),ctx.store,status).map(word=>word.id));
  let available=session.question?questions:questions.filter(q=>ids.has(q.word.id));
  if(mode==='cloze'&&!session.question)available=preferAlignedCloze(available,q=>{
   if(!alignment.has(q))alignment.set(q,aligned(q));
   return alignment.get(q);
  });
  if(!rotation||rotationRows.length!==available.length||available.some((row,index)=>row!==rotationRows[index])){rotationRows=available.slice();rotation=createQuestionRotation(available,{key:q=>sentenceQuestionKey(q.example.de,mode==='cloze'?q.answer:'')});}question=first&&review?questions[0]:rotation.choose(question?.id);
  feedback='';input='';chosen=[];
  if(question){options=mode==='cloze'?clozeOptions(question,studyWords(ctx.words,question.word.cefr)):[];pool=mode==='scramble'?shuffleWords(question.tokens.map((text,id)=>({id,text}))):[];}
  draw();
 }
 function grade(answer) {
  if(destroyed||feedback)return;
  const correct=mode==='cloze'?answer===question.answer:scrambleCorrect(question,chosen.map(tile=>tile.text));
  input=mode==='scramble'&&correct?question.example.de:answer;
  feedback=correct?'correct':'wrong';ctx.haptic();
  showQuizBurst(correct);ctx.store.recordQuizAnswer(mode,question,input,correct,{review:!!session.question});session.onAnswer?.(correct,input);draw();ctx.updateStatus();
 }
 function draw() {
  if(destroyed)return;childCleanup();generation++;
  el.innerHTML=`<div class="sentence-quiz-header"><div class="section-title">${t(mode==='cloze'?'Cloze':'Sentence scramble')}</div></div>${filterMarkup()}<div data-sentence-body></div>`;bindFilters();
  const host=el.querySelector('[data-sentence-body]');if(!question){host.innerHTML=`<section class="panel empty-wrong quiz-after-filter"><p>${t('No sentence questions are available at this level.')}</p></section>`;return;}
  const sentence=question.example.de,show=mode==='cloze'||ctx.store.state.preferences[mode+'ShowTranslation'],tiles=projectScrambleTiles(chosen,pool,tile=>tile.text);
  const view={...question,mode,answer:mode==='scramble'?sentence:question.answer,locale:question.locale||question.word.studyExplanationLanguage||getLocale(),sentence,focus:{start:question.start,text:question.answer},translationFocus:readQuestionTranslationFocus(question),correctOption:String(options.findIndex(option=>option.text===question.answer)),options:options.map((option,index)=>({...option,id:String(index),meaning:wordMeaning(option.word)})),tokens:tiles.tokens,pool:tiles.pool};
  const text=key=>t({'Show Translation':'Show translation','Speak Example':'Speak sentence','Your Answer':'Your answer'}[key]||key);
  childCleanup=renderLexiconSentence(host,{question:view,feedback,selectedOption:String(options.findIndex(option=>option.text===input)),chosenTokens:tiles.chosenTokens,showTranslation:show,translationVisible:show,translation:sentenceMeaning(question.example),t:text},{
   language:'de',uiLanguage:getLocale(),renderOption:option=>option.text===option.word.lemma?wordHeading(option.word):e(option.text),renderOptionBase:option=>option.text!==option.word.lemma?`<span class="cloze-option-base" lang="de">${wordHeading(option.word)}</span>`:'',
   openDetails:details?(word,options)=>details.open(ctx.words.find(entry=>entry.id===word.id)||word,undefined,options):undefined,
   speak:()=>{const ticket=generation;speakGerman(sentence,()=>{},()=>{if(destroyed||ticket!==generation)return;const message=host.querySelector('.lexicon-audio-status');message.hidden=false;message.textContent=t('German speech is unavailable. Download a German voice in the phone’s speech settings.');});},
   select:id=>grade(options[Number(id)].text),choose:id=>{if(feedback)return;const index=id-chosen.length;chosen.push(pool[index]);pool.splice(index,1);ctx.haptic();draw();},remove:index=>{if(feedback)return;pool.push(chosen[index]);chosen.splice(index,1);ctx.haptic();draw();},
   toggle:value=>{ctx.store.preference(mode+'ShowTranslation',value);ctx.haptic();draw();ctx.updateStatus();},
   reset:()=>{pool=shuffleWords([...pool,...chosen]);chosen=[];ctx.haptic();draw();},submit:()=>grade(joinSentenceTokens(chosen.map(tile=>tile.text))),skip:()=>{ctx.haptic();session.onSkip?session.onSkip():newQuestion();},next:()=>{ctx.haptic();session.onNext?session.onNext():newQuestion();},
  });
 }
 newQuestion(true);return()=>{destroyed=true;childCleanup();stopMedia();};
}
export const renderCloze=(el,ctx,session)=>renderSentenceQuiz(el,ctx,'cloze',session);
export const renderScramble=(el,ctx,session)=>renderSentenceQuiz(el,ctx,'scramble',session);
