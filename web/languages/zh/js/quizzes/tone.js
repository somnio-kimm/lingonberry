import { showQuizBurst } from '../components.js';
import { snapshotQuestion } from '../services/wrong-review.js';
import { Store } from '../services/store.js';
import { Pinyin } from '../services/pinyin.js';
import { TTS } from '../services/tts.js';
import { Haptic } from '../services/haptic.js';
import { recordAnswer } from '../services/srs.js';
import {
  pick, scorePill, posGroupIdsForWord,
  wordlistCombinedFilterMarkup, filterByStudyStatus, filterByPosTag,
  quizPinyinFeedback,
} from '../components.js';
import { t, wordMeaning } from '../services/i18n.js';

export function renderToneQuiz(el,session={}) {
  const filters = session.filters || {status:'all', pos:'all', open:false};
  let score = 0, total = 0, word = null;
  /** @type {(number|null)[]} */
  let picks = [];
  let focusIdx = 0;
  /** '' | 'correct' | 'wrong' */
  let feedback = '';

  function buildRows() {
    const aw = session.question?[session.question.word]:Store.activeWords;
    const forStatusRow = filterByPosTag(aw, filters.pos);
    const forTagRow = filterByStudyStatus(aw, filters.status);
    const pool = filterByPosTag(forTagRow, filters.pos);
    return { aw, forStatusRow, forTagRow, pool };
  }

  function syncWord() {
    if(session.question){if(!word){word=session.question.word;initPicks();}return;}
    const { pool } = buildRows();
    if (!pool.length) {
      word = null;
      return;
    }
    const fresh = word?.id && Store.words.find(x => x.id === word.id);
    if (!fresh || !pool.some(w => w.id === fresh.id)) {
      word = pick(pool);
      initPicks();
    } else {
      word = fresh;
    }
  }

  function initPicks() {
    if (!word?.syllables?.length) {
      picks = [];
      return;
    }
    picks = word.syllables.map(() => null);
    focusIdx = 0;
    feedback = '';
  }

  function bindFilters() {
    const fold = el.querySelector('.study-filter-panel');
    if (fold) fold.ontoggle = () => { if (fold.isConnected) filters.open = fold.open; };
    el.querySelectorAll('.wl-filter[data-f]').forEach(b => b.onclick = () => {
      filters.status = b.dataset.f;
      Haptic.light();
      syncWord();
      if (word) initPicks();
      draw();
    });
    el.querySelectorAll('.wl-filter[data-tag]').forEach(b => b.onclick = () => {
      filters.pos = decodeURIComponent(b.getAttribute('data-tag') || 'all');
      Haptic.light();
      syncWord();
      if (word) initPicks();
      draw();
    });
  }

  function newQ() {
    if(session.onNext){session.onNext();return;}
    const { pool } = buildRows();
    if (!pool.length) {
      draw();
      return;
    }
    word = pick(pool);
    initPicks();
    draw();
  }

  function allFilled() {
    return word && picks.length === word.syllables.length && picks.every(p => p !== null);
  }

  function selectChar(i) {
    if (feedback || !word) return;
    focusIdx = i;
    draw();
  }

  function selectTone(tone) {
    if (feedback || !word || picks.length === 0) return;
    picks[focusIdx] = tone;
    const next = picks.findIndex((p, j) => j > focusIdx && p === null);
    if (next >= 0) focusIdx = next;
    else {
      const firstEmpty = picks.findIndex(p => p === null);
      focusIdx = firstEmpty >= 0 ? firstEmpty : word.syllables.length - 1;
    }
    draw();
  }

  function checkAnswer() {
    if (feedback || !word || !allFilled()) return;
    const syls = word.syllables;
    const ok = syls.every((s, i) => picks[i] === s.tone);
    total++;
    if (ok) {
      score++;
      feedback = 'correct';
      recordAnswer(true);
      Haptic.success();
    } else {
      feedback = 'wrong';
      recordAnswer(false);
      Haptic.error();
      const userStr = syls.map((s, i) => Pinyin.marked(s.base, picks[i])).join(' ');
      const ansStr = Pinyin.markedWord(syls);
      if(!session.question)Store.addWrong({
        mode: 'tone', wordHanzi: word.hanzi, wordId: word.id,
        hskLevel: word.hskLevel,
        posGroups: posGroupIdsForWord(word),
        userAnswer: userStr, correctAnswer: ansStr,question:snapshotQuestion('tone',word),wrongParts:syls.flatMap((s,i)=>picks[i]===s.tone?[]:[{index:i,hanzi:s.hanzi,actual:Pinyin.marked(s.base,picks[i]),expected:Pinyin.marked(s.base,s.tone)}]),
      });
    }
    showQuizBurst(feedback==='correct');
    session.onAnswer?.(ok,syls.map((s,i)=>Pinyin.marked(s.base,picks[i])).join(' '),syls.flatMap((s,i)=>picks[i]===s.tone?[]:[{index:i,hanzi:s.hanzi,actual:Pinyin.marked(s.base,picks[i]),expected:Pinyin.marked(s.base,s.tone)}]));
    draw();
  }

  function cellClass(i) {
    const syl = word.syllables[i];
    const picked = picks[i];
    let cls = 'tone-syl-cell';
    if (feedback) {
      if (picked === syl.tone) cls += ' tone-syl-cell--ok';
      else cls += ' tone-syl-cell--bad';
    } else {
      if (i === focusIdx) cls += ' tone-syl-cell--focus';
      if (picked !== null) cls += ' tone-syl-cell--filled';
    }
    return cls;
  }

  function cellPinyinHtml(i) {
    const syl = word.syllables[i];
    const picked = picks[i];
    if (feedback) {
      return quizPinyinFeedback(Pinyin.marked(syl.base, picked), Pinyin.marked(syl.base, syl.tone), picked === syl.tone);
    }
    if (picked !== null) {
      return Pinyin.marked(syl.base, picked);
    }
    return '·';
  }

  function draw() {
    const displayed=session.score?.()||{correct:score,total};
    const { aw, forStatusRow, forTagRow, pool } = buildRows();
    if (!aw.length) {
      el.innerHTML = `<div class="card" style="text-align:center;padding:24px"><div style="font-size:40px">📭</div><div style="margin-top:8px;font-weight:600">${t('noWordsTitle')}</div><div style="font-size:14px;color:var(--text2);margin-top:6px">${t('pickLevelHint')}</div></div>`;
      return;
    }

    syncWord();
    if (!word && pool.length) {
      word = pick(pool);
      initPicks();
    }

    if (!pool.length) {
      el.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div class="section-title" style="margin:0">${session.title ?? t('mode_tone')}</div>
          ${scorePill(displayed.correct, displayed.total)}
        </div>
        ${session.modeTabs || ''}
      ${session.question?'':wordlistCombinedFilterMarkup(forStatusRow, filters.status, forTagRow, filters.pos, forTagRow, filters.open)}
        <div class="quiz-after-filter card" style="text-align:center;padding:28px">
          <div style="font-size:40px;margin-bottom:8px">📭</div>
          <div style="font-weight:600">${t('noWordsFilter')}</div>
          <div style="font-size:14px;color:var(--text2);margin-top:6px">${t('tryOtherFilter')}</div>
        </div>`;
      bindFilters();
      return;
    }

    if (!word.syllables?.length) {
      newQ();
      return;
    }

    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div class="section-title" style="margin:0">${session.title ?? t('mode_tone')}</div>
        ${scorePill(displayed.correct, displayed.total)}
      </div>
      ${session.modeTabs || ''}
      ${session.question?'':wordlistCombinedFilterMarkup(forStatusRow, filters.status, forTagRow, filters.pos, forTagRow, filters.open)}
      <div class="quiz-after-filter">
      <div class="card tone-quiz-card">
        <div class="vocab-question-top vocab-question-top--audio">
          <button type="button" class="word-listen tone-quiz-speak" aria-label="${t('listenWord')}">🔊</button>
        </div>
        <div class="tone-word-full" style="${Pinyin.syllableRowStyle(word.syllables)}" role="group" aria-label="word">
          ${word.syllables.map((syl, i) => `
            <button type="button" class="${cellClass(i)}" data-ci="${i}" ${feedback ? 'disabled' : ''}>
              <span class="tone-syl-py">${cellPinyinHtml(i)}</span>
              <span class="tone-syl-hz">${syl.hanzi}</span>
            </button>
          `).join('')}
        </div>
        <div class="tone-quiz-meaning" style="margin-top:12px">${wordMeaning(word)}</div>
        ${!feedback ? `<div class="tone-num-grid" style="margin-top:16px">
          ${[0, 1, 2, 3, 4].map(tn => {
            const syl = word.syllables[focusIdx];
            const main = syl ? Pinyin.marked(syl.base, tn) : String(tn);
            return `<button type="button" class="tone-num-btn" data-tn="${tn}" style="background:var(--card);border-color:var(--sep);color:var(--text)">
              <span class="tone-num-main">${main}</span>
            </button>`;
          }).join('')}
        </div>
        ` : ''}
      </div>
      ${!feedback?`<div class="quiz-action-bar"><button type="button" class="btn-primary" id="tone-check" ${allFilled()?'':'disabled'}>${t('submit')}</button><button class="btn-small" id="skip-btn">${t('skip')}</button></div>`:''}
      ${feedback ? `<div class="quiz-next-bar"><button type="button" class="btn-primary" id="next-btn">${t('nextQ')}</button></div>` : ''}
      </div>`;

    bindFilters();
    el.querySelector('.tone-quiz-speak')?.addEventListener('click', () => TTS.speak(word.hanzi));

    if (!feedback) {
      el.querySelectorAll('.tone-syl-cell[data-ci]').forEach(b => {
        b.addEventListener('click', () => selectChar(Number(b.dataset.ci)));
      });
      el.querySelectorAll('.tone-num-btn[data-tn]').forEach(b => {
        b.addEventListener('click', () => selectTone(Number(b.dataset.tn)));
      });
      el.querySelector('#tone-check')?.addEventListener('click', () => {
        Haptic.light();
        checkAnswer();
      });
    }
    el.querySelector('#next-btn')?.addEventListener('click', newQ);
    el.querySelector('#skip-btn')?.addEventListener('click',()=>{Haptic.light();if(session.onSkip)session.onSkip();else newQ();});
  }
  draw();
}
