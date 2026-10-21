import {collocationPicker} from '../../../../js/shared/collocation-view.js';
import {collocationInstruction} from '../../../../js/shared/collocations.js';
import { speakGerman, stopMedia } from '../core/media.js';
import { escapeHtml as e, scorePill, showQuizBurst } from '../../../../js/shared/ui.js';
import { t, getLocale } from '../core/i18n.js';
import { studyWords, filterStudyStatus, wordHeading } from '../core/words.js';
import { createVocabularyPool, vocabularyAnswerCorrect, requiresNounArticle, vocabularyExpectedAnswer } from '../core/vocabulary-tests.js';
import { studyFilterMarkup, typeLabel } from './study-components.js';
export function renderVocabularyTest(el, ctx, mode, session = {}) {
  const level = ctx.store.state.preferences.studyLevel;
  let question, input = '', feedback = '', score = 0, total = 0, status = 'all', pos = 'all', open = false, composing = false;
  const pool = studyWords(ctx.words, level);
  let preparedPool,poolSignature;
  let alive = true, category='vocabulary';
  function next() {
    if (!alive) return;
    if(session.question)question=session.question;
    else {const filtered=filterStudyStatus(studyWords(pool,level,{pos}),ctx.store,status),signature=category+':'+getLocale()+':'+filtered.map(w=>w.id).join('|');if(signature!==poolSignature){preparedPool=createVocabularyPool(mode,filtered,getLocale(),category);poolSignature=signature;}question=preparedPool.choose(question?.id);}
    input = ''; feedback = ''; composing = false; draw();
  }
  function submit(value = input) {
    if (!alive || !question || feedback || composing || !value.trim()) return;
    const correct = vocabularyAnswerCorrect(question, value);
    input = mode === 'vocabmeaning' ? question.options.find(option => option.id === value).text : value;
    feedback = correct ? 'correct' : 'wrong'; total++; if (correct) score++;
    el.querySelector('#vocab-answer')?.blur();
    showQuizBurst(correct);ctx.store.recordQuizAnswer(mode, question, input, correct,{review:!!session.question}); session.onAnswer?.(correct, input); ctx.haptic(); draw(); ctx.updateStatus();
  }
  function draw() {
    if (!alive) return;
    stopMedia();
    const shown = session.score?.() || { correct: score, total };
    el.innerHTML = `<div class="sentence-quiz-header"><div class="section-title">${t(mode === 'vocabinput' ? 'Word input' : 'Meaning quiz')}</div>${scorePill(shown.correct,shown.total)}</div>${!session.question&&pool.some(word=>word.collocations?.length)?collocationPicker(getLocale(),category):''}${session.question ? '' : studyFilterMarkup(pool, ctx.store, status, pos, open)}${question ? `<div class="vocab-test quiz-after-filter" data-question-id="${e(question.id)}" data-vocab-mode="${mode}">
      <section class="panel vocab-question"><div class="vocab-question-top"><span class="badge">${question.collocationId?(getLocale()==='ko'?'연어':'Collocations'):e(typeLabel(question.word))} · ${question.locale.toUpperCase()}</span><button type="button" class="word-listen" id="vocab-listen" aria-label="${t('Listen to word')}">🔊</button></div><p class="vocab-instruction">${question.collocationId?collocationInstruction(mode,question.locale):t(mode === 'vocabinput' ? requiresNounArticle(question.word) ? 'Type the noun with its article.' : 'Type the word for this meaning.' : 'Choose the correct meaning.')}</p><div class="vocab-prompt" lang="${mode === 'vocabinput' ? question.locale : 'de'}">${mode === 'vocabinput'||question.collocationId ? e(question.prompt) : wordHeading(question.word)}</div>
      ${mode === 'vocabinput' ? `<div class="vocab-answer-cell ${feedback || 'active'}">${feedback ? `<div role="status" aria-label="${t(feedback === 'correct' ? 'Correct' : 'Incorrect')}"><span class="vocab-correction" lang="de">${e(vocabularyExpectedAnswer(question))}</span>${feedback === 'wrong' ? `<del class="vocab-wrong" lang="de">${e(input)}</del>` : ''}</div>` : `<input id="vocab-answer" type="text" inputmode="text" enterkeyhint="done" value="${e(input)}" lang="de" aria-label="${t('Your answer')}" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" maxlength="120">`}</div>` : ''}<p class="vocab-speech-status" role="status" hidden></p></section>
      ${mode === 'vocabmeaning' ? `<div class="vocab-options">${question.options.map(option => `<button class="vocab-choice ${feedback ? option.id === question.word.id ? 'correct' : option.text === input ? 'wrong' : '' : ''}" data-vocab-option="${e(option.id)}" data-vocab-type="${e(option.type)}" lang="${question.locale}" ${feedback ? 'disabled' : ''}>${e(option.text)}</button>`).join('')}</div>` : ''}
      ${feedback ? `<div class="quiz-next-bar"><button class="primary" id="vocab-next">${t('Next')}</button></div>` : `<div class="quiz-action-bar">${mode === 'vocabinput' ? `<button class="primary submit-pill" id="vocab-submit" ${input.trim() && !composing ? '' : 'disabled'}>${t('Submit')}</button>` : ''}<button class="btn-small vocab-skip" id="vocab-skip">${t('Skip')}</button></div>`}</div>` : `<section class="panel quiz-after-filter"><p>${t('Not enough vocabulary matches these filters. Meaning options must share the same word type.')}</p></section>`}`;
    if(question?.collocationId&&mode==='vocabinput'&&!feedback)el.querySelector('#vocab-listen')?.remove();
    const fold = el.querySelector('.filter-fold'); if (fold) fold.ontoggle = () => { open = fold.open; };
    el.querySelectorAll('[data-f]').forEach(button => button.onclick = () => { status = button.dataset.f; next(); });
    el.querySelectorAll('[data-tag]').forEach(button => button.onclick = () => { pos = button.dataset.tag; next(); });
    function showSpeechError(){if(!alive)return;const message=el.querySelector('.vocab-speech-status');if(message){message.textContent=t('German speech is unavailable. Download a German voice in the phone’s speech settings.');message.hidden=false;}}
    el.querySelector('#vocab-listen')?.addEventListener('click',()=>{const message=el.querySelector('.vocab-speech-status');if(message)message.hidden=true;speakGerman(question.collocationId?question.phrase:question.word.pos==='noun'&&question.word.article?question.word.article+' '+question.word.lemma:question.word.lemma,()=>{},()=>showSpeechError());});
    const picker=el.querySelector('[data-collocation-kind]');if(picker)picker.onchange=()=>{category=picker.value;preparedPool=undefined;poolSignature=undefined;next();};
    const field = el.querySelector('#vocab-answer');
    if (field) {
      field.oninput = () => { if (!alive) return; input = field.value; const button=el.querySelector('#vocab-submit'); if(button)button.disabled = !input.trim() || composing; };
      field.addEventListener('compositionstart',()=>{ composing = true; const button=el.querySelector('#vocab-submit');if(button)button.disabled=true; }); field.addEventListener('compositionend',()=>{ if (!alive) return; composing = false; input = field.value; const button=el.querySelector('#vocab-submit'); if(button)button.disabled = !input.trim() || composing; });
      field.onkeydown = event => { if (event.key === 'Enter' && !event.isComposing && !composing && event.keyCode !== 229) { event.preventDefault(); submit(field.value); } };
    }
    el.querySelector('#vocab-submit')?.addEventListener('click', () => submit(field.value));
    el.querySelectorAll('[data-vocab-option]').forEach(button => button.onclick = () => submit(button.dataset.vocabOption));
    el.querySelector('#vocab-next')?.addEventListener('click', () => session.onNext ? session.onNext() : next());
    el.querySelector('#vocab-skip')?.addEventListener('click', () => session.onSkip ? session.onSkip() : next());
  }
  next();
  return () => { alive = false; stopMedia(); el.querySelector('#vocab-answer')?.blur(); };
}
export const renderWordInput = (el, ctx, session) => renderVocabularyTest(el, ctx, 'vocabinput', session);
export const renderMeaningQuiz = (el, ctx, session) => renderVocabularyTest(el, ctx, 'vocabmeaning', session);
