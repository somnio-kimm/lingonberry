import {renderStudyTabs,renderStudyQuizHeader} from './study-components.js';
import {bindTypingAnswer} from './typing-answer.js';
import {escapeHtml as e} from './ui.js';
import { DeviceSpeech } from './device-speech.js';

export function renderListeningView(el, config, session = {}) {
  const labels = config.labels;
  let mode = session.question?.mode || 'listenword', question, input = '', feedback = '', heard = false, playing = false;
  let hint = false, hintUsed = false, plays = 0, score = 0, total = 0, status = 'all', pos = 'all', open = false;
  let alive = true, generation = 0, ready = !config.prepare || !!session.question;
  let loadError = false,typing;
  function cancelAudio() { generation++; playing = false; DeviceSpeech.stop(); }
  function syncSubmit() { typing?.refresh(); }
  function next() {
    cancelAudio(); const choices = ready ? session.question ? [session.question] : config.questions(mode,{status,pos}) : [];
    const different = choices.filter(q => q.spokenText !== question?.spokenText);
    question = (different.length ? different : choices)[Math.floor(Math.random() * (different.length || choices.length))];
    input = ''; feedback = ''; heard = false; hint = hintUsed = false; plays = 0; draw();el.closest('main')?.scrollTo(0,0);window.scrollTo(0,0);
  }
  async function play() {
    if (!alive || !question || playing) return;
    const current = ++generation; playing = true; syncSubmit();
    const button = el.querySelector('#listening-play'), message = el.querySelector('.listening-status');
    button.disabled = true; button.setAttribute('aria-busy','true'); button.setAttribute('aria-label',labels.playing); message.hidden=true;message.textContent = '';
    const success = await DeviceSpeech.speak(question.spokenText,{language:question.language,rate:question.language==='zh-CN'?.8:.85,
      onError:code=>{if(alive&&generation===current){message.hidden=false;message.textContent=code==='NO_VOICE'?labels.noVoice:labels.audioError;}}});
    if (!alive || generation !== current) return;
    playing = false; if (success) {heard = true; plays++;}
    button.disabled = false; button.setAttribute('aria-busy','false'); button.setAttribute('aria-label',(heard?labels.replay:labels.play).replace(/^🔊\s*/u,''));
    if (success) {message.textContent = '';message.hidden=true;}
    syncSubmit();
  }
  function submit() {
    if (!alive || !question || feedback || !heard || playing || typing?.isComposing || !input.trim()) return;
    el.querySelector('#listening-answer')?.blur();const correct = config.answerCorrect(question,input); feedback = correct ? 'correct' : 'wrong'; total++; if(correct)score++;
    cancelAudio(); config.record(question,input,correct,{heard:true,hintUsed,plays},session); session.onAnswer?.(correct,input,[],null,{listening:{heard:true,hintUsed,plays}});
    config.haptic?.(correct); draw(); config.update?.();el.closest('main')?.scrollTo(0,0);window.scrollTo(0,0);
  }
  function draw() {
    if (!alive) return;
    cancelAudio(); typing?.destroy();typing=undefined;
    const shown = session.score?.() || {correct:score,total},translation=question&&feedback?config.translation(question)||'':'',warning=config.warning?.()||'';
    el.innerHTML=`${renderStudyQuizHeader({title:labels.title,score:shown})}${session.question?'':`${renderStudyTabs({label:labels.mode,options:[{value:'listenword',label:labels.word},{value:'listensentence',label:labels.sentence}],selected:mode,attribute:'data-listening-mode',variant:'listening'})}${ready?config.filters?.({status,pos,open})||'':''}`}
      ${question?`<div class="listening-test quiz-after-filter" data-question-id="${e(question.id)}" data-listening-mode="${mode}"><section class="card panel listening-question"><div class="vocab-question-top"><span class="badge">${mode==='listenword'?labels.word:labels.sentence} · ${e(config.level(question))}</span><button type="button" class="word-listen" id="listening-play" aria-label="${e((heard?labels.replay:labels.play).replace(/^🔊\s*/u,''))}" aria-busy="false">🔊</button></div><p class="listening-status" role="status" hidden></p>
      ${feedback?`<div class="vocab-answer-cell ${feedback}"><span class="wrong-answer-label">${labels.correctAnswer}</span><div class="listening-transcript correct-answer" lang="${question.language}">${config.answerMarkup?.(question)||e(question.answer)}</div><span class="wrong-answer-label">${labels.yourAnswer}</span><div class="listening-user-answer ${feedback==='wrong'?'wrong-answer-value--wrong':'correct-answer'}" lang="${question.language}">${feedback==='wrong'?`<del>${e(input)}</del>`:e(input)}</div></div>${translation?`<p class="listening-translation" lang="${e(question.word.studyExplanationLanguage||question.locale||config.locale())}">${e(translation)}</p>`:''}`:`<div class="vocab-answer-cell active"><textarea id="listening-answer" rows="${mode==='listensentence'?2:1}" maxlength="1000" inputmode="text" enterkeyhint="done" lang="${question.language}" aria-label="${labels.yourAnswer}" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false">${e(input)}</textarea></div><button class="btn-small listening-hint" id="listening-hint" aria-expanded="${hint}">${labels.hint}</button>${hint?`<p class="listening-hint-text" lang="${e(question.word.studyExplanationLanguage||question.locale)}">${e(config.hint(question))}</p>`:''}`}
      </section>${!feedback?`<div class="quiz-action-bar"><button class="primary submit-pill" id="listening-submit" disabled>${labels.check}</button><button class="btn-small listening-skip" id="listening-skip">${labels.skip}</button></div>`:`<div class="quiz-next-bar"><button class="primary btn-primary" id="listening-next">${labels.next}</button></div>`}</div>`:`<section class="card panel"><p role="status">${!ready?loadError?labels.loadError:labels.loading:labels.empty}</p></section>`}${warning?`<p role="status">${e(warning)}</p>`:''}`;
    el.querySelectorAll('button[data-listening-mode]').forEach(button=>button.onclick=()=>{mode=button.dataset.listeningMode;next();});
    const fold=el.querySelector('.filter-fold');if(fold)fold.ontoggle=()=>open=fold.open;
    el.querySelectorAll('[data-f]').forEach(button=>button.onclick=()=>{status=button.dataset.f;next();});
    el.querySelectorAll('[data-tag]').forEach(button=>button.onclick=()=>{pos=button.dataset.tag;next();});
    if(!session.question&&ready)config.bindFilters?.(el,next);
    el.querySelector('#listening-play')?.addEventListener('click',play);
    const field=el.querySelector('#listening-answer');
    if(field)typing=bindTypingAnswer(field,{
      button:el.querySelector('#listening-submit'),
      onChange:value=>{input=value;},onSubmit:submit,
      enabled:()=>heard&&!playing,isActive:()=>alive&&!feedback,
    });
    el.querySelector('#listening-hint')?.addEventListener('click',()=>{
      hint=!hint;hintUsed ||= hint;const button=el.querySelector('#listening-hint');button.setAttribute('aria-expanded',String(hint));el.querySelector('.listening-hint-text')?.remove();
      if(hint){const text=document.createElement('p');text.className='listening-hint-text';text.lang=question.word.studyExplanationLanguage||question.locale;text.textContent=config.hint(question);button.after(text);}
    });
    el.querySelector('#listening-next')?.addEventListener('click',()=>{if(alive)session.onNext?session.onNext():next();},{once:true});
    el.querySelector('#listening-skip')?.addEventListener('click',()=>{if(alive)session.onSkip?session.onSkip():next();},{once:true});syncSubmit();
  }
  next();
  if(!ready)config.prepare().then(()=>{if(!alive)return;ready=true;next();}).catch(()=>{if(!alive)return;loadError=true;draw();});
  return()=>{if(!alive)return;alive=false;typing?.destroy();cancelAudio();el.querySelector('#listening-answer')?.blur();};
}
