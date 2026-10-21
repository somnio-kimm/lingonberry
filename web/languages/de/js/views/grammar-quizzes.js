import {bindTypingAnswer} from '../../../../js/shared/typing-answer.js';
import { createQuestionCatalog } from '../core/question-catalog.js';
import { escapeHtml as e, scorePill, showQuizBurst } from '../../../../js/shared/ui.js';
import { t,getLocale,wordMeaning } from '../core/i18n.js';
import { studyWords,filterStudyStatus,wordHeading } from '../core/words.js';
import { articleQuestions,articleAnswerCorrect,verbFormQuestions,verbFormCorrect,personLabel,tenseLabel,VERB_FORMS } from '../core/grammar-quizzes.js';
import { caseQuestions,adjectiveQuestions,nominalAnswerCorrect,caseLabel,patternLabel,genderLabel,CASES } from '../core/nominal-grammar.js';
import { studyFilterMarkup,createStudyControls } from './study-components.js';
import { speakGerman,stopMedia } from '../core/media.js';
const modeTitle=mode=>({articles:'Article',cases:'Case',adjendings:'Adjective',verbforms:'Verb'}[mode]);
const numberLabel=number=>number==='plural'?'Plural':'Singular';
const formBlank=()=>`<span class="form-question-blank" role="img" aria-label="${t('Answer')}"></span>`;
const options=(values,label)=>`<option value="all">${t('All')}</option>${values.map(value=>`<option value="${value}">${e(t(label(value)))}</option>`).join('')}`;
function renderGrammarQuiz(el,ctx,initialMode,session={}) {
 const inputFamily=initialMode!=='articles';
 const level=ctx.store.state.preferences.studyLevel,pool=studyWords(ctx.words,level);
 let mode=initialMode,questionWords=[],questions=[],question=null,answer='',feedback='',score=0,total=0,status='all',pos='all',tense='all',person='all',grammaticalCase='all',number='all',pattern='all',gender='all',filterOpen=false,typing,destroyed=false;
 const controls=createStudyControls(el,ctx),review=session.question?null:ctx.quizReview;ctx.quizReview=null;
 const builders = {
  articles: articleQuestions,
  cases: caseQuestions,
  adjendings: words => adjectiveQuestions(words, ctx.words),
  verbforms: words => verbFormQuestions(words, ctx.words),
 };
 const catalog = createQuestionCatalog(builders, pool);
 const wordsById = new Map(ctx.words.map(word => [word.id, word]));
 const reviewed=session.question||(review?.mode===mode?builders[mode](ctx.words).find(q=>q.id===review.id):null);
 function rebuild() {
  if (session.question) {
   questions = [session.question];
   questionWords = [session.question.word];
   return;
  }
  const prepared = catalog.get(mode);
  questions = prepared.questions;
  questionWords = prepared.words;
  if (reviewed?.mode === mode && !prepared.find(reviewed.id)) {
   questions = [reviewed, ...questions];
   questionWords = [...new Map([reviewed.word, ...questionWords].map(word => [word.id, word])).values()];
  }
 }
 if(reviewed&&mode==='verbforms'){tense=reviewed.tense;person=reviewed.person;}
 function eligible(){
  if(session.question)return [session.question];
  const ids=new Set(filterStudyStatus(studyWords(questionWords,level,{pos}),ctx.store,status).map(w=>w.id));
  return questions.filter(q=>ids.has(q.word.id)&&(mode!=='verbforms'||(tense==='all'||q.tense===tense)&&(person==='all'||q.person===person))&&(!['cases','adjendings'].includes(mode)||(grammaticalCase==='all'||q.case===grammaticalCase)&&(number==='all'||q.number===number))&&(mode!=='adjendings'||(pattern==='all'||q.pattern===pattern)&&(gender==='all'||q.gender===gender)));
 }
 function resetScroll(){el.closest('main')?.scrollTo(0,0);window.scrollTo(0,0);}
 function next(first=false) {
  stopMedia();const available=eligible(),different=available.filter(q=>q.id!==question?.id),choices=different.length?different:available;
  question=first&&reviewed?reviewed:choices[Math.floor(Math.random()*choices.length)];answer='';feedback='';draw();resetScroll();
 }
 function submit() {
  if(feedback||typing?.isComposing||!answer.trim()||!question)return;
  const correct=mode==='articles'?articleAnswerCorrect(question,answer):mode==='verbforms'?verbFormCorrect(question,answer):nominalAnswerCorrect(question,answer);
  el.querySelector('#form-answer')?.blur();total++;if(correct)score++;feedback=correct?'correct':'wrong';filterOpen=false;ctx.haptic();
  const input=mode==='articles'?answer+' '+question.word.lemma:answer;
  showQuizBurst(correct);ctx.store.recordQuizAnswer(mode,question,input,correct,{review:!!session.question});session.onAnswer?.(correct,input);draw();ctx.updateStatus();resetScroll();if(mode!=='articles')el.querySelector('.grammar-question')?.scrollIntoView({block:'start'});
 }
 function nominalSentence(q,filled=false){
  const at=q.sentence.indexOf('___');return `<div class="nominal-sentence" lang="de">${e(q.sentence.slice(0,at))}${filled?`<span class="correct-answer nominal-filled">${e(q.answer)}</span>`:formBlank()}${e(q.sentence.slice(at+3))}</div>`;
 }
 function draw() {
  typing?.destroy();typing=undefined;
  const shownScore=session.score?.()||{correct:score,total};
  const noun=question?.noun?{...wordsById.get(question.noun.id),...question.noun}:null;
  const nominal=['cases','adjendings'].includes(mode);
  const nominalSelectors=nominal&&!session.question?`<div class="grammar-selectors nominal-selectors"><label>${t('Case')}<select id="grammar-case">${options(CASES,caseLabel)}</select></label><label>${t('Grammatical number')}<select id="grammar-number">${options(['singular','plural'],numberLabel)}</select></label>${mode==='adjendings'?`<label>${t('Article pattern')}<select id="grammar-pattern">${options(['strong','weak','mixed'],patternLabel)}</select></label><label>${t('Gender / plural')}<select id="grammar-gender">${options(['masculine','feminine','neuter','plural'],genderLabel)}</select></label>`:''}</div>`:'';
  el.innerHTML=`<div class="sentence-quiz-header"><div class="section-title">${t(modeTitle(mode))}</div>${scorePill(shownScore.correct,shownScore.total)}</div>
   ${inputFamily&&!session.question?`<div class="form-mode-controls" role="group" aria-label="${t('Exercise type')}">${['verbforms','cases','adjendings'].map(kind=>`<button data-form-mode="${kind}" aria-pressed="${mode===kind}">${t(modeTitle(kind))}</button>`).join('')}</div>`:''}
   ${session.question?'':studyFilterMarkup(questionWords,ctx.store,status,pos,filterOpen,nominalSelectors)}
   ${mode==='verbforms'&&!session.question?`<div class="grammar-selectors"><label>${t('Form')}<select id="grammar-tense">${options(VERB_FORMS,tenseLabel)}</select></label><label>${t('Person')}<select id="grammar-person">${options(['ich','du','er','wir','ihr','sie'],personLabel)}</select></label></div>`:''}

   ${question?`<div class="quiz-after-filter ${nominal?'nominal-question-wrap':''}"><section class="panel grammar-question ${inputFamily?'form-question':''}" data-question-id="${e(question.id)}" data-grammar-mode="${mode}"><div class="grammar-card-tools"><button class="quiz-status-btn" id="grammar-status">${t('Study status')}</button><button class="detail-sheet-icon speak-btn" id="grammar-speak" aria-label="${t('Speak word')}">🔊</button></div>
   ${mode==='articles'?`<div class="grammar-prompt">${t('Choose the nominative singular article.')}</div><div class="grammar-target"><div class="article-answer-cell answer-cell ${feedback||'active'}" role="status" lang="de">${feedback?`${feedback==='wrong'?`<span class="input-correction">${e(question.answer)}</span><del class="input-wrong">${e(answer)}</del>`:`<span class="input-correct">${e(answer)}</span>`}`:e(answer||'…')}</div><span class="grammar-word" lang="de">${e(question.word.lemma)}</span></div><div class="grammar-meaning" lang="${getLocale()}">${e(wordMeaning(question.word))}</div>`:`
   <div class="form-original-word"><div class="grammar-word form-base-word ${nominal?'nominal-base-word':''}" lang="de">${mode==='cases'?wordHeading(question.word):e(question.word.infinitive||question.word.lemma)}</div><div class="grammar-meaning" lang="${getLocale()}">${e(wordMeaning(question.word))}</div></div>
   ${mode==='adjendings'?`<div class="form-noun-word"><div class="grammar-word form-base-word adjective-noun-cue" lang="de">${wordHeading({...noun,pos:'noun'})}</div><div class="grammar-meaning adjective-noun-meaning" lang="${getLocale()}">${e(wordMeaning(noun))}</div></div>`:''}
   <div class="form-problem"><div class="grammar-prompt">${mode==='verbforms'?`${e(tenseLabel(question.tense))} · <span lang="de">${e(personLabel(question.person))}</span>`:`${t(caseLabel(question.case))} · ${t(numberLabel(question.number))}${mode==='adjendings'?` · ${t(patternLabel(question.pattern))}`:''}`}</div>
   ${nominal?nominalSentence(question,!!feedback):`<div class="form-verb-prompt" lang="de">${e(personLabel(question.person))} ${feedback?`<span class="correct-answer">${e(question.answer)}</span>`:formBlank()}</div>`}</div>
   <div class="grammar-target form-input-target"><div class="verb-answer-cell answer-cell ${feedback||'active'}">${feedback?`<div class="grammar-answer-feedback" role="status" lang="de"><span class="input-correction">${e(question.answer)}</span>${feedback==='wrong'?`<del class="input-wrong">${e(answer)}</del>`:''}</div>`:`<input id="form-answer" type="text" inputmode="text" enterkeyhint="done" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" maxlength="250" aria-label="${t('Your answer')}" value="${e(answer)}">`}</div></div>`}
   ${feedback&&nominal?`<p class="grammar-explanation" lang="${getLocale()}">${e(question.explanation[getLocale()])}</p>`:''}<p class="study-audio-status muted" role="status" hidden></p></section>
   ${!feedback?`${mode==='articles'?`<div class="article-choices" role="group" aria-label="${t('Article')}">${['der','die','das'].map(article=>`<button class="article-choice ${answer===article?'selected':''}" data-article="${article}" lang="de" aria-pressed="${answer===article}">${article}</button>`).join('')}</div>`:''}<div class="quiz-action-bar"><button class="primary submit-pill" id="grammar-submit" ${answer.trim()?'':'disabled'}>${t('Submit')}</button><button class="btn-small" id="grammar-skip">${t('Skip')}</button></div>`:`<div class="quiz-next-bar"><button class="primary" id="grammar-next">${t('Next')}</button></div>`}</div>`:`<section class="panel empty-wrong quiz-after-filter"><p>${t('No grammar questions match these filters.')}</p></section>`}`;
  const fold=el.querySelector('.filter-fold');if(fold)fold.ontoggle=()=>{filterOpen=fold.open;};
  el.querySelectorAll('button[data-form-mode]').forEach(button=>button.onclick=()=>{mode=button.dataset.formMode;pos='all';filterOpen=false;rebuild();next();});
  el.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{status=b.dataset.f;ctx.haptic();next();});
  el.querySelectorAll('[data-tag]').forEach(b=>b.onclick=()=>{pos=b.dataset.tag;ctx.haptic();next();});
  for(const [id,value,change] of [['grammar-tense',tense,v=>tense=v],['grammar-person',person,v=>person=v],['grammar-case',grammaticalCase,v=>grammaticalCase=v],['grammar-number',number,v=>number=v],['grammar-pattern',pattern,v=>pattern=v],['grammar-gender',gender,v=>gender=v]]){
   const select=el.querySelector('#'+id);if(select){select.value=value;select.onchange=()=>{change(select.value);ctx.haptic();next();};}
  }
  el.querySelectorAll('[data-article]').forEach(b=>b.onclick=()=>{answer=b.dataset.article;ctx.haptic();draw();});
  const field=el.querySelector('#form-answer');
  if(field)typing=bindTypingAnswer(field,{
   button:el.querySelector('#grammar-submit'),
   onChange:value=>{answer=value;filterOpen=false;const fold=el.querySelector('.filter-fold');if(fold)fold.open=false;},
   onSubmit:submit,isActive:()=>!destroyed&&!feedback,
  });
  else el.querySelector('#grammar-submit')?.addEventListener('click',submit);
  el.querySelector('#grammar-skip')?.addEventListener('click',()=>{ctx.haptic();if(session.onSkip)session.onSkip();else next();});
  el.querySelector('#grammar-next')?.addEventListener('click',()=>{ctx.haptic();if(session.onNext)session.onNext();else next();});
  el.querySelector('#grammar-status')?.addEventListener('click',()=>{ctx.haptic();controls.open(question.word,()=>{if(!eligible().some(q=>q.id===question.id))next();else draw();});});
  el.querySelector('#grammar-speak')?.addEventListener('click',()=>speakGerman(feedback&&nominal?question.example.de:feedback&&mode==='articles'?question.displayAnswer:question.word.lemma,()=>{},()=>{if(destroyed)return;const message=el.querySelector('.study-audio-status');if(message){message.hidden=false;message.textContent=t('German speech is unavailable. Download a German voice in the phone’s speech settings.');}}));
 }
 rebuild();next(true);return()=>{destroyed=true;typing?.destroy();controls.cleanup();stopMedia();};
}
export const renderArticles=(el,ctx,session={})=>renderGrammarQuiz(el,ctx,session.question?.mode||'articles',session);
export const renderCases=(el,ctx,session)=>renderGrammarQuiz(el,ctx,'cases',session);
export const renderAdjectiveEndings=(el,ctx,session)=>renderGrammarQuiz(el,ctx,'adjendings',session);
export const renderVerbForms=(el,ctx,session)=>renderGrammarQuiz(el,ctx,'verbforms',session);
