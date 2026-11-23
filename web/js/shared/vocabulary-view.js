import {escapeHtml as e,scorePill} from './ui.js';
import {bindTypingAnswer} from './typing-answer.js';
import {renderVocabularyHints,renderVocabularyLearning} from './vocabulary-learning-view.js';
import {vocabularyLearningContent,withVocabularyLearning} from './vocabulary-learning.js';

/** One default vocabulary screen. Adapters own language rules, filters and persistence. */
export function renderVocabularyView(host,config,session={}){
 const {mode,language,labels}=config,meaning=mode==='vocabmeaning';
 let alive=true,generation=0,question,input='',selected='',feedback='',score=0,total=0;
 let status='all',pos='all',open=false,typing,prepared,preparedWords=[],preparedLocale;
 const filters=()=>({status,pos,open});
 const learning=q=>({language,locale:config.locale(),...config.learning?.(q)});
 function stopAudio(){generation++;config.stopAudio();}
 function next(){
  if(!alive)return;
  if(session.question)question=session.question;
  else{
   const words=config.words(filters()),locale=config.questionLocale?.()||config.locale();
   if(!prepared||locale!==preparedLocale||words.length!==preparedWords.length||words.some((word,index)=>word!==preparedWords[index])){
    prepared=config.createPool(words,locale);preparedWords=words.slice();preparedLocale=locale;
   }
   question=prepared.choose(question?.id||session.previousId);
  }
  config.onQuestion?.(question);input='';selected='';feedback='';draw();
 }
 function submit(value=input){
  if(!alive||!question||feedback||typing?.isComposing||!value.trim())return;
  const option=meaning?question.options.find(row=>row.id===value):undefined;
  if(meaning&&!option)return;
  const correct=config.answerCorrect(question,value),displayInput=meaning?option.text:value;
  input=displayInput;selected=meaning?value:'';feedback=correct?'correct':'wrong';total++;if(correct)score++;
  host.querySelector('#vocab-answer')?.blur();
  config.record(withVocabularyLearning(question,learning(question)),value,correct,{displayInput},session);
  session.onAnswer?.(correct,displayInput);config.feedback(correct);draw();config.update?.();
 }
 function speak(text){
  if(!alive)return;
  const ticket=generation,message=host.querySelector('.vocab-speech-status');if(message)message.hidden=true;
  const fail=()=>{if(alive&&ticket===generation&&message?.isConnected){message.textContent=labels.audioError;message.hidden=false;}};
  try{Promise.resolve(config.speak(text,fail)).catch(fail);}catch{fail();}
 }
 function draw(){
  if(!alive)return;
  typing?.destroy();typing=undefined;stopAudio();
  const shown=session.score?.()||{correct:score,total},checked=!!feedback;
  const audio=`<button type="button" class="word-listen" id="vocab-listen" ${!meaning&&!checked?'data-quiz-sound-hint':'data-quiz-speak'} aria-label="${e(labels.listen)}">🔊</button>`;
  const prompt=question&&(config.renderPrompt?.(question)||e(question.prompt));
  host.innerHTML=`<div class="lexicon-view vocabulary-view"><div class="sentence-quiz-header vocab-quiz-header"><div class="section-title">${e(labels.title)}</div>${scorePill(shown.correct,shown.total)}</div>${session.question?'':config.filters?.(filters())||''}${question?`
   <div class="vocab-test quiz-after-filter" data-question-id="${e(question.id)}" data-vocab-mode="${mode}"><section class="panel card vocab-question lexicon-question ${feedback}" data-question-word="${e(question.word.id)}">
    ${meaning||checked?`<div class="vocab-question-top vocab-question-top--audio">${audio}</div>`:''}<div class="vocab-prompt" lang="${e(meaning?language:question.locale)}">${prompt}</div>
    ${meaning?'':`<div class="vocab-answer-cell ${feedback||'active'}">${checked?`<div role="status" aria-label="${e(correctLabel())}"><span class="vocab-correction" lang="${e(language)}">${config.renderAnswer?.(question)||e(question.answer)}</span>${feedback==='wrong'?`<del class="vocab-wrong" lang="${e(language)}">${e(input)}</del>`:''}</div>`:`<input id="vocab-answer" type="text" inputmode="text" enterkeyhint="done" lang="${e(config.inputLanguage||language)}" aria-label="${e(labels.answer)}" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" maxlength="120" value="${e(input)}">`}</div>`}
    ${!meaning&&!checked?renderVocabularyHints(question,{language,locale:config.locale(),audioButton:audio}):''}<p class="vocab-speech-status lexicon-audio-status" role="status" hidden></p></section>
    ${meaning?`<div class="vocab-options lexicon-options">${question.options.map(option=>`<button class="vocab-choice ${checked?option.id===question.word.id?'correct':option.id===selected?'wrong':'':''}" data-vocab-option="${e(option.id)}" data-option="${e(option.id)}" data-vocab-type="${e(option.type)}" lang="${e(question.locale)}" ${checked?'disabled':''}>${e(option.text)}</button>`).join('')}</div>`:''}
    ${checked?renderVocabularyLearning(question,learning(question)):''}${checked?`<div class="quiz-next-bar"><button class="primary btn-primary" id="vocab-next" data-next>${e(labels.next)}</button></div>`:`<div class="quiz-action-bar">${meaning?'':`<button class="primary submit-pill" id="vocab-submit" data-submit disabled>${e(labels.submit)}</button>`}<button class="btn-small vocab-skip" id="vocab-skip" data-skip>${e(labels.skip)}</button></div>`}</div>`:`<section class="panel card quiz-after-filter"><p>${e(labels.empty)}</p></section>`}${config.warning?.()?`<p role="status">${e(config.warning())}</p>`:''}</div>`;
  if(config.bindFilters&&!session.question)config.bindFilters(host,next);
  else if(!session.question){
   const fold=host.querySelector('.filter-fold');if(fold){fold.open=open;fold.ontoggle=()=>open=fold.open;}
   host.querySelectorAll('[data-f]').forEach(button=>button.onclick=()=>{status=button.dataset.f;next();});
   host.querySelectorAll('[data-tag]').forEach(button=>button.onclick=()=>{pos=button.dataset.tag;next();});
  }
  if(!question)return;
  // Historical phrase gaps keep their original no-audio-before-answer rule.
  if(question.collocationId&&!meaning&&!checked)host.querySelector('#vocab-listen')?.remove();
  host.querySelector('#vocab-listen')?.addEventListener('click',()=>speak(config.spokenWord(question)));
  host.querySelector('[data-learning-example]')?.addEventListener('click',()=>{const example=vocabularyLearningContent(question,learning(question)).example;if(example)speak(example.text);});
  const field=host.querySelector('#vocab-answer');if(field)typing=bindTypingAnswer(field,{button:host.querySelector('#vocab-submit'),onChange:value=>input=value,onSubmit:submit,isActive:()=>alive&&!feedback});
  host.querySelectorAll('[data-vocab-option]').forEach(button=>button.onclick=()=>submit(button.dataset.vocabOption));
  host.querySelector('#vocab-next')?.addEventListener('click',()=>{if(alive)session.onNext?session.onNext():next();});
  host.querySelector('#vocab-skip')?.addEventListener('click',()=>{if(alive)session.onSkip?session.onSkip():next();});
 }
 function correctLabel(){return feedback==='correct'?labels.correct:labels.incorrect;}
 next();
 return()=>{if(!alive)return;alive=false;typing?.destroy();stopAudio();host.querySelector('#vocab-answer')?.blur();host.querySelectorAll('button,.filter-fold').forEach(node=>{node.onclick=null;node.ontoggle=null;});};
}
