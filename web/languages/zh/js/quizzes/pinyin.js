import { showQuizBurst } from '../components.js';
import { snapshotQuestion } from '../services/wrong-review.js';
import { Store } from '../services/store.js';
import { Pinyin } from '../services/pinyin.js';
import { TTS } from '../services/tts.js';
import { Haptic } from '../services/haptic.js';
import { recordAnswer } from '../services/srs.js';
import {
  pick, scorePill, renderKeyboard, attachKeyboard,
  posGroupIdsForWord, wordlistCombinedFilterMarkup,
  filterByStudyStatus, filterByPosTag,
  quizPinyinFeedback,
} from '../components.js';
import { t, wordMeaning } from '../services/i18n.js';

export function renderPinyinQuiz(el,session={}) {
  const filters = session.filters || {status:'all', pos:'all', open:false};
  let score = 0, total = 0, feedback = '';
  let inputs = [], focusIdx = 0;
  let results = [];
  let corrections = [];
  let word = null;

  function resetInputs() {
    inputs = (word?.syllables || []).map(() => '');
    focusIdx = 0;
    feedback = '';
    results = [];
    corrections = [];
  }

  function allFilled() {
    return word && inputs.length === word.syllables.length && inputs.every(p => p.trim());
  }

  function buildRows() {
    const aw = session.question?[session.question.word]:Store.activeWords;
    const forStatusRow = filterByPosTag(aw, filters.pos);
    const forTagRow = filterByStudyStatus(aw, filters.status);
    const pool = filterByPosTag(forTagRow, filters.pos);
    return { aw, forStatusRow, forTagRow, pool };
  }

  function syncWord() {
    if(session.question){if(!word){word=session.question.word;resetInputs();}return;}
    const { pool } = buildRows();
    if (!pool.length) {
      word = null;
      return;
    }
    const fresh = word?.id && Store.words.find(x => x.id === word.id);
    if (!fresh || !pool.some(w => w.id === fresh.id)) {
      word = pick(pool);
      resetInputs();
    } else {
      word = fresh;
    }
  }

  function bindFilters() {
    const fold = el.querySelector('.study-filter-panel');
    if (fold) fold.ontoggle = () => { if (fold.isConnected) filters.open = fold.open; };
    el.querySelectorAll('.wl-filter[data-f]').forEach(b => b.onclick = () => {
      filters.status = b.dataset.f;
      Haptic.light();
      syncWord();
      resetInputs();
      draw();
    });
    el.querySelectorAll('.wl-filter[data-tag]').forEach(b => b.onclick = () => {
      filters.pos = decodeURIComponent(b.getAttribute('data-tag') || 'all');
      Haptic.light();
      syncWord();
      resetInputs();
      draw();
    });
  }

  function next() {
    if(session.onNext){session.onNext();return;}
    const { pool } = buildRows();
    if (!pool.length) {
      draw();
      return;
    }
    word = pick(pool);
    resetInputs();
    draw();
  }

  function submit() {
    if (feedback || !allFilled()) return;
    const input = inputs.join(' ');
    // Use one complete accepted reading so mixed alternate readings cannot
    // produce all-green cells for an incorrect word.
    const closest = [word.syllables, ...(word.alternateSyllables || [])]
      .filter(syls => syls.length === inputs.length)
      .map(syls => ({ syllables: syls, results: syls.map((syl, i) => Pinyin.compare(inputs[i], { syllables: [syl] })) }))
      .reduce((best, candidate) => candidate.results.filter(Boolean).length > best.results.filter(Boolean).length ? candidate : best);
    results = closest.results;
    corrections = closest.syllables;
    total++;
    if (Pinyin.compare(input, word)) {
      score++; feedback = 'correct';
      recordAnswer(true); Haptic.success();
    } else {
      feedback = 'wrong';
      recordAnswer(false); Haptic.error();
      if(!session.question)Store.addWrong({
        mode: 'pinyin', wordHanzi: word.hanzi, wordId: word.id,
        hskLevel: word.hskLevel,
        posGroups: posGroupIdsForWord(word),
        userAnswer: input, correctAnswer: Pinyin.numbered(corrections),
        question:snapshotQuestion('pinyin',word),wrongParts:results.flatMap((ok,i)=>ok?[]:[{index:i,hanzi:corrections[i].hanzi,actual:Pinyin.convertLive(inputs[i]),expected:Pinyin.marked(corrections[i].base,corrections[i].tone)}]),
      });
    }
    showQuizBurst(feedback==='correct');
    session.onAnswer?.(feedback==='correct',input,results.flatMap((ok,i)=>ok?[]:[{index:i,hanzi:corrections[i].hanzi,actual:Pinyin.convertLive(inputs[i]),expected:Pinyin.marked(corrections[i].base,corrections[i].tone)}]),Pinyin.numbered(corrections));
    draw();
  }

  function draw() {
    const displayed=session.score?.()||{correct:score,total};
    const { aw, forStatusRow, forTagRow, pool } = buildRows();
    if (!aw.length) {
      el.innerHTML = `<div class="card" style="text-align:center;padding:24px"><div style="font-size:40px">📭</div><div style="margin-top:8px;font-weight:600">${t('noWordsTitle')}</div><div style="font-size:14px;color:var(--text2);margin-top:6px">${t('pickLevelHint')}</div></div>`;
      return;
    }

    syncWord();
    if (!word && pool.length) word = pick(pool);

    if (!pool.length) {
      el.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div class="section-title" style="margin:0">${session.title ?? t('mode_pinyin')}</div>
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

    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div class="section-title" style="margin:0">${session.title ?? t('mode_pinyin')}</div>
        ${scorePill(displayed.correct, displayed.total)}
      </div>
      ${session.modeTabs || ''}
      ${session.question?'':wordlistCombinedFilterMarkup(forStatusRow, filters.status, forTagRow, filters.pos, forTagRow, filters.open)}
      <div class="quiz-after-filter">
      <div class="card" style="text-align:center">
        <div class="vocab-question-top vocab-question-top--audio">
          <button type="button" class="word-listen speak-btn" aria-label="${t('listenWord')}">🔊</button>
        </div>
        <div class="pinyin-quiz-word">
          <div class="py-per-char" style="${Pinyin.syllableRowStyle(word.syllables)}" role="group" aria-label="${word.hanzi}">
            ${word.syllables.map((syl, i) => `
              <button type="button" class="py-char-col pinyin-char${feedback ? (results[i] ? ' pinyin-char--ok' : ' pinyin-char--bad') : (i === focusIdx ? ' pinyin-char--focus' : '')}"
                data-ci="${i}" aria-label="${syl.hanzi}" aria-pressed="${!feedback && i === focusIdx}" ${feedback ? 'disabled' : ''}>
                <span class="py-char-py">${feedback
                  ? quizPinyinFeedback(Pinyin.convertLive(inputs[i]), Pinyin.marked(corrections[i].base, corrections[i].tone), results[i])
                  : Pinyin.convertLive(inputs[i] || '') || '·'}</span>
                <span class="py-char-hz">${syl.hanzi}</span>
              </button>
            `).join('')}
          </div>
        </div>
        <div style="font-size:14px;color:var(--text2);margin-top:4px">${wordMeaning(word)}</div>
      </div>
      ${!feedback ? renderKeyboard() : ''}
      ${!feedback ? `<div class="quiz-action-bar"><button class="submit-pill" id="submit-btn" ${allFilled() ? '' : 'disabled'}>${t('submit')}</button><button class="btn-small" id="skip-btn">${t('skip')}</button></div>` : ''}
      ${feedback ? `<div class="quiz-next-bar"><button type="button" class="btn-primary" id="next-btn">${t('nextQ')}</button></div>` : ''}
      </div>`;

    bindFilters();
    el.querySelector('.speak-btn')?.addEventListener('click', () => TTS.speak(word.hanzi));
    el.querySelector('#submit-btn')?.addEventListener('click', submit);
    el.querySelector('#skip-btn')?.addEventListener('click',()=>{Haptic.light();if(session.onSkip)session.onSkip();else next();});
    el.querySelector('#next-btn')?.addEventListener('click', next);
    if (!feedback) {
      el.querySelectorAll('.pinyin-char[data-ci]').forEach(b => b.onclick = () => {
        focusIdx = Number(b.dataset.ci);
        Haptic.light();
        draw();
      });
      attachKeyboard(el, {
        onTap(k) {
          const current = inputs[focusIdx];
          if (/^[1-4]$/.test(k)) {
            if (!current) return;
            inputs[focusIdx] = current.replace(/[0-5]$/, '') + k;
          } else {
            const tone = current.match(/[0-5]$/)?.[0] || '';
            inputs[focusIdx] = current.replace(/[0-5]$/, '') + k + tone;
          }
          draw();
        },
        onDelete() { inputs[focusIdx] = inputs[focusIdx].slice(0, -1); draw(); },
      });
    }
  }
  draw();
}
