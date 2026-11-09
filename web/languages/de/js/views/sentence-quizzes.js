import { escapeHtml as e, scorePill, showQuizBurst } from '../../../../js/shared/ui.js';
import { t, getLocale, sentenceMeaning, wordMeaning } from '../core/i18n.js';
import { studyFilterMarkup } from './study-components.js';
import { studyWords, filterStudyStatus, shuffleWords, wordHeading } from '../core/words.js';
import { clozeQuestions, clozeOptions, scrambleQuestions, scrambleCorrect, joinSentenceTokens } from '../core/sentence-quizzes.js';
import { speakGerman, stopMedia } from '../core/media.js';
function renderSentenceQuiz(el,ctx,mode,session={}) {
 const level=ctx.store.state.preferences.studyLevel,words=studyWords(ctx.words,level);
 const build=mode==='cloze'?pool=>clozeQuestions(pool).filter(q=>clozeOptions(q,pool).length>1):scrambleQuestions;
 let status='all',pos='all',filterOpen=false;
 let questions=session.question?[session.question]:build(words),question,options=[],pool=[],chosen=[],feedback='',input='',score=0,total=0,destroyed=false;
 const review=session.question?null:ctx.quizReview;ctx.quizReview=null;
 if(review?.mode===mode){const q=build(ctx.words).find(q=>q.id===review.id);if(q)questions=[q,...questions.filter(item=>item.id!==q.id)];}
 function filterMarkup(){return session.question?'':studyFilterMarkup(words,ctx.store,status,pos,filterOpen);}
 function bindFilters(){
  const fold=el.querySelector('.study-filter-panel');if(fold)fold.ontoggle=()=>{filterOpen=fold.open;};
  el.querySelectorAll('[data-f]').forEach(button=>button.onclick=()=>{status=button.dataset.f;ctx.haptic();newQuestion();});
  el.querySelectorAll('[data-tag]').forEach(button=>button.onclick=()=>{pos=button.dataset.tag;ctx.haptic();newQuestion();});
 }
 function newQuestion(first=false) {
  stopMedia();
  const ids=new Set(filterStudyStatus(studyWords(words,level,{pos}),ctx.store,status).map(word=>word.id));
  const available=session.question?questions:questions.filter(q=>ids.has(q.word.id));
  const previous=question?.id,candidates=available.filter(q=>q.id!==previous);question=first&&review?questions[0]:(candidates.length?candidates:available)[Math.floor(Math.random()*(candidates.length||available.length))];
  feedback='';input='';chosen=[];
  if(question){options=mode==='cloze'?clozeOptions(question,studyWords(ctx.words,question.word.cefr)):[];pool=mode==='scramble'?shuffleWords(question.tokens.map((text,id)=>({id,text}))):[];}
  draw();
 }
 function grade(answer) {
  if(feedback)return;
  const correct=mode==='cloze'?answer===question.answer:scrambleCorrect(question,chosen.map(tile=>tile.text));
  input=mode==='scramble'&&correct?question.example.de:answer;
  total++;if(correct)score++;feedback=correct?'correct':'wrong';ctx.haptic();
  showQuizBurst(correct);ctx.store.recordQuizAnswer(mode,question,input,correct,{review:!!session.question});session.onAnswer?.(correct,input);draw();ctx.updateStatus();
 }
 function draw() {
  if(!question){el.innerHTML=`<div class="sentence-quiz-header"><div class="section-title">${t(mode==='cloze'?'Cloze':'Sentence scramble')}</div></div>${filterMarkup()}<section class="panel empty-wrong quiz-after-filter"><p>${t('No sentence questions are available at this level.')}</p></section>`;bindFilters();return;}
  const shownScore=session.score?.()||{correct:score,total};
  const show=mode==='cloze'||ctx.store.state.preferences[mode+'ShowTranslation'];
  const sentence=question.example.de;
  const sentenceMarkup=mode==='cloze'?`${e(sentence.slice(0,question.start))}${feedback?`<mark class="cloze-answer">${e(question.answer)}</mark>`:'<span class="cloze-blank">______</span>'}${e(sentence.slice(question.start+question.answer.length))}`:feedback?e(sentence):'';
  el.innerHTML=`<div class="sentence-quiz-header"><div class="section-title">${t(mode==='cloze'?'Cloze':'Sentence scramble')}</div>${scorePill(shownScore.correct,shownScore.total)}</div>${filterMarkup()}<div class="quiz-after-filter"><section class="panel sentence-question ${mode==='scramble'?'scramble-question':'cloze-question'}" data-study-level="${e(question.word.cefr)}"><div class="cloze-tools">${mode==='scramble'?`<div class="cloze-pinyin-control"><span id="translation-label">${t('Show translation')}</span><button class="toggle-switch toggle-compact ${show?'on':''}" id="quiz-show-translation" role="switch" aria-checked="${show}" aria-labelledby="translation-label"></button></div>`:''}<button type="button" class="speak-btn" aria-label="${t('Speak sentence')}">🔊</button></div>${sentenceMarkup?`<div class="sentence-quiz-text ${feedback?'answered':''}" lang="de">${sentenceMarkup}</div>`:''}${show?`<div class="sentence-translation" lang="${getLocale()}">${e(sentenceMeaning(question.example))}</div>`:''}<p class="quiz-audio-status muted" role="status" hidden></p></section>
   ${mode==='cloze'?`<div class="cloze-options">${options.map((option,i)=>`<button class="opt-btn ${feedback&&(option.text===question.answer?'option-correct':option.text===input?'option-wrong':'')}" data-option="${i}" ${feedback?'disabled':''}><span class="cloze-option-word" lang="de">${feedback&&option.text===option.word.lemma?wordHeading(option.word):e(option.text)}</span>${feedback?`${option.text!==option.word.lemma?`<span class="cloze-option-base" lang="de">${wordHeading(option.word)}</span>`:''}<span class="cloze-option-meaning" lang="${getLocale()}">${e(wordMeaning(option.word))}</span>`:''}</button>`).join('')}</div>`:`<section class="panel scramble-answer"><div class="scramble-answer-label">${t('Your answer')}:</div><div class="flow-row chosen-row">${chosen.map((tile,i)=>`<button class="flow-chip scramble-chip chosen" lang="de" data-chosen="${i}" ${feedback?'disabled':''}>${e(tile.text)}</button>`).join('')}</div></section><section class="panel scramble-pool"><div class="flow-row">${pool.map((tile,i)=>`<button class="flow-chip scramble-chip" lang="de" data-pool="${i}" ${feedback?'disabled':''}>${e(tile.text)}</button>`).join('')}</div></section>`}
   ${feedback?`<div class="quiz-next-bar"><button class="primary sentence-next" id="quiz-next">${t('Next')}</button></div>`:`${mode==='scramble'?`<div class="sentence-reset-controls"><button class="btn-small" id="quiz-reset">${t('Reset')}</button></div>`:''}<div class="quiz-action-bar">${mode==='scramble'?`<button class="primary" id="quiz-submit" ${!chosen.length?'disabled':''}>${t('Submit')}</button>`:''}<button class="btn-small" id="quiz-skip">${t('Skip')}</button></div>`}</div>`;
  bindFilters();
  el.querySelector('#quiz-show-translation')?.addEventListener('click',()=>{ctx.store.preference(mode+'ShowTranslation',!show);ctx.haptic();draw();ctx.updateStatus();});
  el.querySelector('.speak-btn').onclick=()=>speakGerman(sentence,()=>{},()=>{if(destroyed)return;const message=el.querySelector('.quiz-audio-status');message.hidden=false;message.textContent=t('German speech is unavailable. Download a German voice in the phone’s speech settings.');});
  el.querySelectorAll('[data-option]').forEach(b=>b.onclick=()=>grade(options[Number(b.dataset.option)].text));
  el.querySelectorAll('[data-pool]').forEach(b=>b.onclick=()=>{if(feedback)return;const i=Number(b.dataset.pool);chosen.push(pool[i]);pool.splice(i,1);ctx.haptic();draw();});
  el.querySelectorAll('[data-chosen]').forEach(b=>b.onclick=()=>{if(feedback)return;const i=Number(b.dataset.chosen);pool.push(chosen[i]);chosen.splice(i,1);ctx.haptic();draw();});
  el.querySelector('#quiz-submit')?.addEventListener('click',()=>grade(joinSentenceTokens(chosen.map(tile=>tile.text))));
  el.querySelector('#quiz-reset')?.addEventListener('click',()=>{pool=shuffleWords([...pool,...chosen]);chosen=[];ctx.haptic();draw();});
  el.querySelector('#quiz-skip')?.addEventListener('click',()=>{ctx.haptic();if(session.onSkip)session.onSkip();else newQuestion();});
  el.querySelector('#quiz-next')?.addEventListener('click',()=>{ctx.haptic();if(session.onNext)session.onNext();else newQuestion();});
 }
 newQuestion(true);return()=>{destroyed=true;stopMedia();};
}
export const renderCloze=(el,ctx,session)=>renderSentenceQuiz(el,ctx,'cloze',session);
export const renderScramble=(el,ctx,session)=>renderSentenceQuiz(el,ctx,'scramble',session);
