import {practiceSentences} from '../services/sentence-focus.js';
import {createSentenceFilters} from '../services/sentence-filters.js';
import { showQuizBurst } from '../components.js';
import { snapshotQuestion } from '../services/wrong-review.js';
import { Store } from '../services/store.js';
import { Pinyin } from '../services/pinyin.js';
import { TTS } from '../services/tts.js';
import { Haptic } from '../services/haptic.js';
import { recordAnswer } from '../services/srs.js';
import { shuffle, pick, scorePill, posGroupIdsForWord } from '../components.js';
import { t, sentenceMeaning } from '../services/i18n.js';

export function renderScrambleQuiz(el,session={}) {
  const words = session.question?Store.words.filter(w=>w.hskLevel===session.question.word.hskLevel):Store.activeWords;
  const withSentences = session.question?[session.question.word]:words.filter(w => practiceSentences(w).length);
  let score = 0, total = 0, word, sentence, pool = [], chosen = [], feedback = '';

  const filters=createSentenceFilters(withSentences,session,()=>{TTS.stop();newQ();});

  function newQ() {
    if(session.onNext&&word){session.onNext();return;}
    word = session.question?.word||pick(filters.pool());
    if(!word){feedback='';draw();return;}
    sentence = session.question?.sentence||pick(practiceSentences(word));
    const chars = Pinyin.sentenceColumns(sentence) || [...sentence.hanzi].map(hanzi => ({ hanzi, pinyin: '' }));
    pool = shuffle(chars);
    chosen = [];
    feedback = '';
    draw();
  }

  function tapPool(i) {
    if (feedback) return;
    chosen.push(pool[i]);
    pool = pool.filter((_, j) => j !== i);
    Haptic.light();
    draw();
  }
  function tapChosen(i) {
    if (feedback) return;
    pool.push(chosen[i]);
    chosen = chosen.filter((_, j) => j !== i);
    Haptic.light();
    draw();
  }

  function checkAnswer() {
    if (feedback) return;
    total++;
    const user = chosen.map(c => c.hanzi).join('');
    if (user === sentence.hanzi) {
      score++; feedback = 'correct'; Haptic.success();
      recordAnswer(true);
    } else {
      feedback = 'wrong'; Haptic.error();
      recordAnswer(false);
      if(!session.question)Store.addWrong({
        mode: 'scramble', wordHanzi: word.hanzi, wordId: word.id,
        hskLevel: word.hskLevel,
        posGroups: posGroupIdsForWord(word),
        userAnswer: user, correctAnswer: sentence.hanzi,question:snapshotQuestion('scramble',word,sentence),
      });
    }
    showQuizBurst(feedback==='correct');
    session.onAnswer?.(feedback==='correct',user);
    draw();
  }

  function draw() {
    const displayed=session.score?.()||{correct:score,total};
    if(!word){el.innerHTML=`<div class="sentence-quiz-header"><div class="section-title">${t('mode_scramble')}</div></div>${filters.markup()}<section class="card empty-wrong quiz-after-filter"><p>${t('noWordsFilter')}</p></section>`;filters.bind(el);return;}
    const escape = text => text.replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
    const tile = c => `${Store.scrambleShowPinyin ? `<span class="scramble-chip-pinyin"${c.pinyin ? '' : ' aria-hidden="true"'}>${escape(c.pinyin)}</span>` : ''}<span class="scramble-chip-hanzi">${escape(c.hanzi)}</span>`;
    el.innerHTML = `
      <div class="sentence-quiz-header">
        <div class="section-title" style="margin:0">${t('mode_scramble')}</div>
        ${scorePill(displayed.correct, displayed.total)}
      </div>
      ${filters.markup()}
      <div class="quiz-after-filter">
      <div class="card sentence-question scramble-question" style="text-align:center">
        <div class="cloze-tools">
          <div class="cloze-pinyin-control">
            <span id="scramble-pinyin-label">${t('showPinyin')}</span>
            <button type="button" id="scramble-show-pinyin" class="toggle-switch toggle-compact${Store.scrambleShowPinyin ? ' on' : ''}"
              role="switch" aria-checked="${Store.scrambleShowPinyin}" aria-labelledby="scramble-pinyin-label"></button>
          </div>
          <button type="button" class="speak-btn" aria-label="${t('listenSentence')}">🔊</button>
        </div>
        ${feedback ? `<div class="scramble-sentence sentence-quiz-text" style="font-size:22px;font-weight:600;line-height:1.5;color:var(--green)">${Store.scrambleShowPinyin ? Pinyin.htmlSentence(sentence) : escape(sentence.hanzi)}</div>` : ''}
        <div style="font-size:14px;color:var(--text2);${feedback ? 'margin-top:8px' : ''}">${sentenceMeaning(sentence)}</div>
      </div>
      <div class="card">
        <div style="font-size:13px;color:var(--text3);margin-bottom:8px">${t('yourAnswer')}:</div>
        <div class="flow-row">${chosen.map((c, i) => `<button class="flow-chip scramble-chip chosen" data-i="${i}" ${feedback ? 'disabled' : ''}>${tile(c)}</button>`).join('')}</div>
      </div>
      <div class="card">
        <div class="flow-row">${pool.map((c, i) => `<button class="flow-chip scramble-chip" data-pi="${i}" ${feedback ? 'disabled' : ''}>${tile(c)}</button>`).join('')}</div>
      </div>
      ${!feedback?`<div class="sentence-reset-controls"><button class="btn-small" id="clr-btn">${t('reset')}</button></div><div class="quiz-action-bar"><button class="btn-primary" id="sub-btn" ${!chosen.length?'disabled':''}>${t('submit')}</button><button class="btn-small" id="skip-btn">${t('skip')}</button></div>`:`<div class="quiz-next-bar"><button class="btn-primary" id="next-btn">${t('nextQ')}</button></div>`}</div>`;

    filters.bind(el);
    el.querySelector('.speak-btn')?.addEventListener('click', () => TTS.speak(sentence.hanzi));
    el.querySelector('#scramble-show-pinyin')?.addEventListener('click', () => {
      Store.scrambleShowPinyin = !Store.scrambleShowPinyin;
      Haptic.light();
      draw();
    });
    el.querySelectorAll('.flow-chip[data-pi]').forEach(b => b.onclick = () => tapPool(Number(b.dataset.pi)));
    el.querySelectorAll('.flow-chip.chosen').forEach(b => b.onclick = () => tapChosen(Number(b.dataset.i)));
    el.querySelector('#sub-btn')?.addEventListener('click', checkAnswer);
    el.querySelector('#clr-btn')?.addEventListener('click', () => { pool = shuffle([...pool, ...chosen]); chosen = []; draw(); });
    el.querySelector('#skip-btn')?.addEventListener('click', () => {
      Haptic.light();
      if(session.onSkip)session.onSkip();else newQ();
    });
    el.querySelector('#next-btn')?.addEventListener('click', newQ);
  }
  newQ();
}
