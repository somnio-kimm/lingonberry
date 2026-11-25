import {renderStudyMeaning} from './meaning-display.js';
import {listeningReadingHint} from './listening.js';
import {renderStudyTabs,renderStudyQuizHeader,renderStudyHint} from './study-components.js';
import {bindTypingAnswer} from './typing-answer.js';
import {escapeHtml as e} from './ui.js';
import { DeviceSpeech } from './device-speech.js';

const PLAY_LIMIT=3;

export function renderListeningView(el, config, session = {}) {
  const labels = config.labels;
  let mode = session.question?.mode || 'listenword', question, input = '', feedback = '', heard = false, playing = false;
  let hintUsed = false, plays = 0, status = 'all', pos = 'all', open = false;
  let alive = true, generation = 0, ready = !config.prepare || !!session.question;
  let loadError = false,typing;
  function cancelAudio() { generation++; playing = false; DeviceSpeech.stop(); }
  function syncSubmit() { typing?.refresh(); }
  const playCount=()=>`${plays} / ${PLAY_LIMIT}`;
  const isOutOfPlays=()=>plays>=PLAY_LIMIT;
  function next() {
    cancelAudio(); const choices = ready ? session.question ? [session.question] : config.questions(mode,{status,pos}) : [];
    const different = choices.filter(q => q.spokenText !== question?.spokenText);
    question = (different.length ? different : choices)[Math.floor(Math.random() * (different.length || choices.length))];
    input = ''; feedback = ''; heard = false; hintUsed = false; plays = 0; draw();el.closest('main')?.scrollTo(0,0);window.scrollTo(0,0);
  }
  async function play() {
    if (!alive || !question || playing || isOutOfPlays()) return;
    const current = ++generation; playing = true; syncSubmit();
    const button = el.querySelector('#listening-play'), message = el.querySelector('.listening-status');
    button.disabled = true; button.setAttribute('aria-busy','true'); button.setAttribute('aria-label',labels.playing); message.hidden=true;message.textContent = '';
    const success = await DeviceSpeech.speak(question.spokenText,{language:question.language,rate:question.language==='zh-CN'?.8:.85,
      onError:code=>{if(alive&&generation===current){message.hidden=false;message.textContent=code==='NO_VOICE'?labels.noVoice:labels.audioError;}}});
    if (!alive || generation !== current) return;
    playing = false; if (success) {heard = true; plays++;}
    button.disabled = isOutOfPlays(); button.setAttribute('aria-busy','false');
    el.querySelector('[data-listening-play-count]').textContent=playCount();
    const skip=el.querySelector('#listening-skip');
    if(skip&&isOutOfPlays())skip.textContent=labels.giveUp; button.setAttribute('aria-label',(heard?labels.replay:labels.play).replace(/^🔊\s*/u,''));
    if (success) {message.textContent = '';message.hidden=true;}
    syncSubmit();
  }
  function grade(gaveUp=false) {
    if (!alive || !question || feedback || !heard || playing || typing?.isComposing) return;
    if(gaveUp?!isOutOfPlays():!input.trim())return;
    el.querySelector('#listening-answer')?.blur();
    const correct=!gaveUp&&config.answerCorrect(question,input);
    feedback = correct ? 'correct' : 'wrong';
    cancelAudio(); config.record(question,input,correct,{heard:true,hintUsed,plays},session); session.onAnswer?.(correct,input,[],null,{listening:{heard:true,hintUsed,plays}});
    config.haptic?.(correct); draw(); config.update?.();el.closest('main')?.scrollTo(0,0);window.scrollTo(0,0);
  }
  function draw() {
    if (!alive) return;
    cancelAudio(); typing?.destroy();typing=undefined;
    const translation=question&&feedback?config.translation(question)||'':'',warning=config.warning?.()||'';
    const hintText=question&&!feedback?config.hint(question):'',reading=question&&!feedback?listeningReadingHint(question):'';
    const hints=[
      renderStudyHint({label:labels.hint,summaryId:'listening-hint',body:hintText?`<p class="listening-hint-text" lang="${e(question.word.studyExplanationLanguage||question.locale)}">${question.kind==='word'?renderStudyMeaning(hintText,question.word):e(hintText)}</p>`:''}),
      renderStudyHint({label:labels.readingHint,summaryId:'listening-reading-hint',body:reading?`<p class="listening-reading" lang="${e(question.language)}">${e(reading)}</p>`:''}),
    ].join('');
    el.innerHTML=`${renderStudyQuizHeader({title:labels.title})}${session.question?'':`${renderStudyTabs({label:labels.mode,options:[{value:'listenword',label:labels.word},{value:'listensentence',label:labels.sentence}],selected:mode,attribute:'data-listening-mode',variant:'listening'})}${ready?config.filters?.({status,pos,open})||'':''}`}
      ${question?`<div class="listening-test quiz-after-filter" data-question-id="${e(question.id)}" data-listening-mode="${mode}"><section class="card panel listening-question"><div class="vocab-question-top vocab-question-top--audio"><span class="listening-play-count" data-listening-play-count role="status" aria-label="${e(labels.playCount)}">${playCount()}</span><button type="button" class="word-listen" id="listening-play" aria-label="${e((heard?labels.replay:labels.play).replace(/^🔊\s*/u,''))}" aria-busy="false" ${isOutOfPlays()?'disabled':''}>🔊</button></div><p class="listening-status" role="status" hidden></p>
      ${feedback?`<div class="vocab-answer-cell ${feedback}"><span class="wrong-answer-label">${labels.correctAnswer}</span><div class="listening-transcript correct-answer" lang="${question.language}">${config.answerMarkup?.(question)||e(question.answer)}</div>${feedback==='wrong'?`<span class="wrong-answer-label">${labels.wrongAnswer}</span><div class="listening-user-answer wrong-answer-value--wrong" lang="${question.language}">${input.trim()?`<del>${e(input)}</del>`:e(labels.noAnswer)}</div>`:''}</div>${translation?`<p class="listening-translation" lang="${e(question.word.studyExplanationLanguage||question.locale||config.locale())}">${question.kind==='word'?renderStudyMeaning(translation,question.word):e(translation)}</p>`:''}`:`<div class="vocab-answer-cell active"><textarea id="listening-answer" rows="1" maxlength="1000" inputmode="text" enterkeyhint="done" lang="${question.language}" aria-label="${labels.yourAnswer}" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false">${e(input)}</textarea></div>${hints}`}
      </section>${!feedback?`<div class="quiz-action-bar"><button class="primary submit-pill" id="listening-submit" disabled>${labels.check}</button><button class="btn-small listening-skip" id="listening-skip">${isOutOfPlays()?labels.giveUp:labels.skip}</button></div>`:`<div class="quiz-next-bar"><button class="primary btn-primary" id="listening-next">${labels.next}</button></div>`}</div>`:`<section class="card panel"><p role="status">${!ready?loadError?labels.loadError:labels.loading:labels.empty}</p></section>`}${warning?`<p role="status">${e(warning)}</p>`:''}`;
    el.querySelectorAll('button[data-listening-mode]').forEach(button=>button.onclick=()=>{mode=button.dataset.listeningMode;next();});
    const fold=el.querySelector('.filter-fold');if(fold)fold.ontoggle=()=>open=fold.open;
    el.querySelectorAll('[data-f]').forEach(button=>button.onclick=()=>{status=button.dataset.f;next();});
    el.querySelectorAll('[data-tag]').forEach(button=>button.onclick=()=>{pos=button.dataset.tag;next();});
    if(!session.question&&ready)config.bindFilters?.(el,next);
    el.querySelector('#listening-play')?.addEventListener('click',play);
    const field=el.querySelector('#listening-answer');
    if(field)typing=bindTypingAnswer(field,{
      button:el.querySelector('#listening-submit'),
      onChange:value=>{input=value;},onSubmit:()=>grade(),
      enabled:()=>heard&&!playing,isActive:()=>alive&&!feedback,
    });
    el.querySelectorAll('.study-hint summary').forEach(summary=>summary.onclick=()=>{
      hintUsed ||= !summary.parentElement.open;
    });
    el.querySelector('#listening-next')?.addEventListener('click',()=>{if(alive)session.onNext?session.onNext():next();},{once:true});
    el.querySelector('#listening-skip')?.addEventListener('click',()=>{
      if(!alive||feedback)return;
      if(isOutOfPlays())grade(true);
      else if(session.onSkip)session.onSkip();
      else next();
    });syncSubmit();
  }
  next();
  if(!ready)config.prepare().then(()=>{if(!alive)return;ready=true;next();}).catch(()=>{if(!alive)return;loadError=true;draw();});
  return()=>{if(!alive)return;alive=false;typing?.destroy();cancelAudio();el.querySelector('#listening-answer')?.blur();};
}
