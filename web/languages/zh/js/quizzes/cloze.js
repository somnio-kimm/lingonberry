import {findSentenceTarget} from '../services/sentence-focus.js';
import {createSentenceFilters} from '../services/sentence-filters.js';
import { clozeWordOptions,clozeStudyWords } from '../services/vocabulary-tests.js';
import { showQuizBurst } from '../components.js';
import { snapshotQuestion } from '../services/wrong-review.js';
import { Store } from '../services/store.js';
import { Pinyin } from '../services/pinyin.js';
import { TTS } from '../services/tts.js';
import { Haptic } from '../services/haptic.js';
import { recordAnswer } from '../services/srs.js';
import { pick, scorePill, posGroupIdsForWord } from '../components.js';
import { t, sentenceMeaning, wordMeaning } from '../services/i18n.js';

export function renderClozeQuiz(el,session={}) {
  const words = session.question?Store.words.filter(w=>w.hskLevel===session.question.word.hskLevel):Store.activeWords;
  const withSentences = session.question?[session.question.word]:clozeStudyWords(words);
  let score = 0, total = 0, word, sentence, blank, options, feedback = '', userAnswer = '';

  const filters=createSentenceFilters(withSentences,session,()=>{TTS.stop();newQ();});

  function newQ() {
    if(session.onNext&&word){session.onNext();return;}
    word = session.question?.word||pick(filters.pool());
    if(!word){feedback='';draw();return;}
    sentence = session.question?.sentence||pick(word.sentences.filter(s=>findSentenceTarget(s,word.hanzi)));
    blank = word.hanzi;
    options = clozeWordOptions(word, words);
    feedback = ''; userAnswer = '';
    draw();
  }

  function choose(opt) {
    if (feedback) return;
    userAnswer = opt; total++;
    if (opt === blank) {
      score++; feedback = 'correct'; Haptic.success();
      recordAnswer(true);
    } else {
      feedback = 'wrong'; Haptic.error();
      recordAnswer(false);
      if(!session.question)Store.addWrong({
        mode: 'cloze', wordHanzi: word.hanzi, wordId: word.id,
        hskLevel: word.hskLevel,
        posGroups: posGroupIdsForWord(word),
        userAnswer: opt, correctAnswer: blank,question:snapshotQuestion('cloze',word,sentence),
      });
    }
    showQuizBurst(feedback==='correct');
    session.onAnswer?.(feedback==='correct',userAnswer);
    draw();
  }

  function draw() {
    const displayed=session.score?.()||{correct:score,total};
    if(!word){el.innerHTML=`<div class="sentence-quiz-header"><div class="section-title">${t('mode_cloze')}</div></div>${filters.markup()}<section class="card empty-wrong quiz-after-filter"><p>${t('noWordsFilter')}</p></section>`;filters.bind(el);return;}
    const offset = findSentenceTarget(sentence,blank)?.start??-1;
    const escape = text => text.replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
    const blankMarkup = feedback
      ? `<mark class="cloze-answer">${escape(blank)}</mark>`
      : '<span class="cloze-blank">______</span>';
    const question = offset >= 0
      ? escape(sentence.hanzi.slice(0, offset)) + blankMarkup + escape(sentence.hanzi.slice(offset + blank.length))
      : escape(sentence.hanzi);
    const review = option => `<span class="cloze-option-word">${Pinyin.htmlMarkedColumns(option.syllables)}</span><span class="cloze-option-meaning">${escape(wordMeaning(option))}</span>`;
    el.innerHTML = `
      <div class="sentence-quiz-header">
        <div class="section-title" style="margin:0">${t('mode_cloze')}</div>
        ${scorePill(displayed.correct, displayed.total)}
      </div>
      ${filters.markup()}
      <div class="quiz-after-filter">
      <div class="card sentence-question cloze-question" style="text-align:center">
        <div class="cloze-tools">
          <div class="cloze-pinyin-control">
            <span id="cloze-pinyin-label">${t('showPinyin')}</span>
            <button type="button" id="cloze-show-pinyin" class="toggle-switch toggle-compact${Store.clozeShowPinyin ? ' on' : ''}"
              role="switch" aria-checked="${Store.clozeShowPinyin}" aria-labelledby="cloze-pinyin-label"></button>
          </div>
          <button type="button" class="speak-btn" aria-label="${t('listenSentence')}">🔊</button>
        </div>
        <div class="cloze-sentence sentence-quiz-text" style="font-size:22px;font-weight:600;line-height:1.5">${Store.clozeShowPinyin
          ? Pinyin.htmlSentence(sentence, { blank: feedback ? '' : blank, highlight: feedback ? blank : '' })
          : question}</div>
        <div style="font-size:14px;color:var(--text2);margin-top:8px">${sentenceMeaning(sentence)}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${options.map(o => {
          let bg = 'var(--card)', border = 'var(--sep)', color = 'inherit';
          if (feedback && o.hanzi === blank) { bg = 'rgba(52,199,89,0.1)'; border = 'var(--green)'; color = 'var(--green)'; }
          else if (feedback === 'wrong' && o.hanzi === userAnswer) { bg = 'rgba(255,59,48,0.1)'; border = 'var(--red)'; color = 'var(--red)'; }
          return `<button type="button" class="opt-btn" data-o="${escape(o.hanzi)}" ${feedback ? 'disabled' : ''} style="padding:14px;border-radius:12px;background:${bg};border:1.5px solid ${border};color:${color};font-size:17px">${feedback ? review(o) : escape(o.hanzi)}</button>`;
        }).join('')}
      </div>

      ${feedback?`<div class="quiz-next-bar"><button type="button" class="btn-primary" id="next-btn">${t('nextQ')}</button></div>`:`<div class="quiz-action-bar"><button type="button" class="btn-small" id="skip-btn">${t('skip')}</button></div>`}</div>`;

    filters.bind(el);
    el.querySelector('.speak-btn')?.addEventListener('click', () => TTS.speak(sentence.hanzi));
    el.querySelector('#cloze-show-pinyin')?.addEventListener('click', () => {
      Store.clozeShowPinyin = !Store.clozeShowPinyin;
      Haptic.light();
      draw();
    });
    el.querySelectorAll('.opt-btn').forEach(b => b.onclick = () => choose(b.dataset.o));
    el.querySelector('#skip-btn')?.addEventListener('click', () => {
      Haptic.light();
      if(session.onSkip)session.onSkip();else newQ();
    });
    el.querySelector('#next-btn')?.addEventListener('click', newQ);
  }
  newQ();
}
