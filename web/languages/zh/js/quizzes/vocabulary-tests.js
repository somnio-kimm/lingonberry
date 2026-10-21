import {bindTypingAnswer} from '../../../../js/shared/typing-answer.js';
import {lexiconText} from '../../../../js/shared/lexicon-text.js';
import {collocationAnswerModes} from '../../../../js/shared/collocation-view.js';
import {collocationInstruction} from '../../../../js/shared/collocations.js';
import {escapeHtml as e} from '../../../../js/shared/ui.js';
import { showQuizBurst } from '../components.js';
import { TTS } from '../services/tts.js';
import { Store } from '../services/store.js';
import { createVocabularyPool, vocabularyAnswerCorrect, snapshotVocabularyQuestion } from '../services/vocabulary-tests.js';
import { Haptic } from '../services/haptic.js';
import { Pinyin } from '../services/pinyin.js';
import { recordAnswer } from '../services/srs.js';
import { scorePill, posGroupIdsForWord, wordlistCombinedFilterMarkup, filterByStudyStatus, filterByPosTag } from '../components.js';
import { t } from '../services/i18n.js';
const typeLabel = question => question.type.split('/').map(type => ({noun:t('posGroup_noun'),verb:t('posGroup_verb'),adjective:t('posGroup_adj'),adverb:t('posGroup_adv'),pronoun:t('posGroup_pron'),numeral:t('vocabNumeral'),classifier:t('posGroup_num_cls'),preposition:t('vocabPreposition'),conjunction:t('vocabConjunction'),particle:t('vocabParticle'),expression:t('posGroup_expr')}[type]||type)).join(' · ');
export function renderVocabularyTest(el, mode, session = {}) {
  let preparedPool,poolSignature,typing;
  const pool = Store.activeWords;
  let question, input = '', feedback = '', score = 0, total = 0, status='all', pos='all', open=false;
  let alive = true, category=session.category||'vocabulary';
  function next() {
    if (!alive) return;
    if(session.question)question=session.question;
    else {const filtered=filterByStudyStatus(filterByPosTag(pool,pos),status),signature=category+':'+Store.uiLang+':'+filtered.map(w=>w.id).join('|');if(signature!==poolSignature){preparedPool=createVocabularyPool(mode,filtered,Store.uiLang,category);poolSignature=signature;}question=preparedPool.choose(question?.id);}
    input = ''; feedback = ''; draw();
  }
  function submit(value = input) {
    if (!alive || !question || feedback || typing?.isComposing || !value.trim()) return;
    const correct = vocabularyAnswerCorrect(question, value);
    input = mode === 'vocabmeaning' ? question.options.find(option => option.id === value).text : value;
    feedback = correct ? 'correct' : 'wrong'; total++; if (correct) score++;
    el.querySelector('#vocab-answer')?.blur(); recordAnswer(correct); showQuizBurst(correct); correct ? Haptic.success() : Haptic.error();
    if (!correct && !session.question) Store.addWrong({ mode, wordId: question.word.id, wordHanzi: question.word.hanzi,
      hskLevel: question.word.hskLevel, posGroups: posGroupIdsForWord(question.word), userAnswer: input, correctAnswer: question.answer,
      question: snapshotVocabularyQuestion(question) });
    session.onAnswer?.(correct, input); draw();
  }
  function draw() {
    if (!alive) return;
    typing?.destroy();typing=undefined;
    TTS.stop();
    const shown = session.score?.() || { correct: score, total };
    el.innerHTML = `<div class="vocab-quiz-header"><div class="section-title">${session.category?lexiconText(Store.uiLang,'Collocations'):t('mode_' + mode)}</div>${scorePill(shown.correct, shown.total)}</div>${!session.question&&session.category?collocationAnswerModes(Store.uiLang,mode):''}${session.question?'':wordlistCombinedFilterMarkup(filterByPosTag(pool,pos),status,filterByStudyStatus(pool,status),pos)}${question ? `<div class="vocab-test quiz-after-filter" data-question-id="${e(question.id)}" data-vocab-mode="${mode}">
      <section class="card vocab-question"><div class="vocab-question-top"><span class="badge">${question.collocationId?(Store.uiLang==='ko'?'연어':'Collocations'):e(typeLabel(question))} · ${question.locale.toUpperCase()}</span><button type="button" class="word-listen" id="vocab-listen" aria-label="${t('listenWord')}">🔊</button></div><p class="vocab-instruction">${question.collocationId?collocationInstruction(mode,question.locale):t(mode === 'vocabinput' ? 'vocabTypePrompt' : 'vocabMeaningPrompt')}</p><div class="vocab-prompt" lang="${mode === 'vocabinput' ? question.locale : 'zh'}">${mode === 'vocabinput'||question.collocationId ? e(question.prompt) : e(question.word.hanzi)}</div>
      ${mode === 'vocabinput' ? `<div class="vocab-answer-cell ${feedback || 'active'}">${feedback ? `<div role="status" aria-label="${t(feedback === 'correct' ? 'retestCorrect' : 'retestIncorrect')}"><span class="vocab-correction" lang="zh">${question.collocationId?e(question.answer):Pinyin.htmlMarkedColumns(question.word.syllables)}</span>${feedback === 'wrong' ? `<del class="vocab-wrong" lang="zh">${e(input)}</del>` : ''}</div>` : `<input id="vocab-answer" type="text" inputmode="text" enterkeyhint="done" value="${e(input)}" lang="zh-CN" aria-label="${t('yourAnswer')}" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" maxlength="120">`}</div>` : ''}<p class="vocab-speech-status" role="status" hidden></p></section>
      ${mode === 'vocabmeaning' ? `<div class="vocab-options">${question.options.map(option => `<button class="vocab-choice ${feedback ? option.id === question.word.id ? 'correct' : option.text === input ? 'wrong' : '' : ''}" data-vocab-option="${e(option.id)}" data-vocab-type="${e(option.type)}" lang="${question.locale}" ${feedback ? 'disabled' : ''}>${e(option.text)}</button>`).join('')}</div>` : ''}
      ${feedback ? `<div class="quiz-next-bar"><button class="btn-primary" id="vocab-next">${t('nextQ')}</button></div>` : `<div class="quiz-action-bar">${mode === 'vocabinput' ? `<button class="submit-pill" id="vocab-submit" ${input.trim() ? '' : 'disabled'}>${t('submit')}</button>` : ''}<button class="btn-small vocab-skip" id="vocab-skip">${t('skip')}</button></div>`}</div>` : `<section class="card"><p>${t('vocabEmpty')}</p></section>`}`;
    if(question?.collocationId&&mode==='vocabinput'&&!feedback)el.querySelector('#vocab-listen')?.remove();
    const fold=el.querySelector('.filter-fold');if(fold){fold.open=open;fold.ontoggle=()=>{open=fold.open;};}
    el.querySelectorAll('[data-f]').forEach(button=>button.onclick=()=>{status=button.dataset.f;next();});
    el.querySelectorAll('[data-tag]').forEach(button=>button.onclick=()=>{pos=button.dataset.tag;next();});
    function showSpeechError(){if(!alive)return;const message=el.querySelector('.vocab-speech-status');if(message){message.textContent=t('chineseSpeechUnavailable');message.hidden=false;}}
    el.querySelector('#vocab-listen')?.addEventListener('click',()=>{const message=el.querySelector('.vocab-speech-status');if(message)message.hidden=true;TTS.speak(question.collocationId?question.phrase:question.word.hanzi,()=>{},()=>showSpeechError());});
    el.querySelectorAll('[data-collocation-answer]').forEach(button=>button.onclick=()=>{mode=button.dataset.collocationAnswer;preparedPool=undefined;poolSignature=undefined;next();});
    const field = el.querySelector('#vocab-answer');
    if(field)typing=bindTypingAnswer(field,{
      button:el.querySelector('#vocab-submit'),
      onChange:value=>{input=value;},onSubmit:submit,
      isActive:()=>alive&&!feedback,
    });
    el.querySelectorAll('[data-vocab-option]').forEach(button => button.onclick = () => submit(button.dataset.vocabOption));
    el.querySelector('#vocab-next')?.addEventListener('click', () => session.onNext ? session.onNext() : next());
    el.querySelector('#vocab-skip')?.addEventListener('click', () => session.onSkip ? session.onSkip() : next());
  }
  next();
  return () => { alive = false; typing?.destroy(); TTS.stop(); el.querySelector('#vocab-answer')?.blur(); };
}
export const renderWordInput = (el, session) => renderVocabularyTest(el, 'vocabinput', session);
export const renderMeaningQuiz = (el, session) => renderVocabularyTest(el, 'vocabmeaning', session);

export const renderCollocationPractice=(el,session={})=>renderVocabularyTest(el,session.question?.mode||'vocabmeaning',{...session,category:'collocations'});
