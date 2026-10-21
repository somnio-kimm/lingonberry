import {renderCollocations,bindCollocationAudio} from '../../../js/shared/collocation-view.js';
import {escapeHtml as escape} from '../../../js/shared/ui.js';
export {showQuizBurst,scorePill} from '../../../js/shared/ui.js';
import { SCREENS, HOME_MODES } from './app-definition.js';
import { Store } from './services/store.js';
import { Pinyin } from './services/pinyin.js';
import { TTS } from './services/tts.js';
import { Haptic } from './services/haptic.js';
import { t, wordMeaning, sentenceMeaning } from './services/i18n.js';

export function hskBandLabel(lv) {
  return lv === 7 ? 'HSK 7–9' : `HSK ${lv}`;
}

export function statusLabel(level) {
  if (level === 0) return [t('statusNew'), 'var(--text3)'];
  if (level < 5) return [t('statusLearning'), 'var(--blue)'];
  return [t('statusMastered'), 'var(--green)'];
}

export function filterByStudyStatus(words, key) {
  if (!words?.length) return [];
  if (key === 'new') return words.filter(w => w.srs.level === 0);
  if (key === 'learning') return words.filter(w => w.srs.level > 0 && w.srs.level < 5);
  if (key === 'mastered') return words.filter(w => w.srs.level >= 5);
  return [...words];
}

export const POS_GROUP_ORDER = ['noun', 'verb', 'adj', 'adv', 'pron', 'num_cls', 'func', 'expr'];

const POS_GROUP_RULES = {
  noun: new Set(['n', 'nr', 'ns', 'nt', 'nz', 'nx', 'ng', 's', 'noun', 'place name', 'organization name', 'other proper noun', 'nominal character string', 'noun morpheme', 'space word']),
  verb: new Set(['v', 'vd', 'vn', 'vg', 'verb', 'verb as adverbial', 'verb with nominal function', 'verb morpheme']),
  adj: new Set(['a', 'ad', 'ag', 'an', 'b', 'z', 'adjective', 'adjective as adverbial', 'adjective morpheme', 'adjective with nominal function', 'non-predicate adjective', 'descriptive']),
  adv: new Set(['d', 'dg', 'adverb', 'adverb morpheme']),
  pron: new Set(['r', 'rg', 'pronoun', 'pronoun morpheme']),
  num_cls: new Set(['m', 'mg', 'q', 'numeral', 'numeric morpheme', 'classifier']),
  func: new Set(['c', 'p', 'u', 'y', 'k', 'h', 'conjunction', 'preposition', 'auxiliary', 'modal particle', 'suffix', 'prefix', 'particle']),
  expr: new Set(['i', 'l', 'j', 't', 'tg', 'f', 'e', 'o', 'g', 'w', 'x', 'idiom', 'phrase', 'fixed expressions', 'abbreviation', 'time word', 'time word morpheme', 'time', 'directional locality', 'interjection', 'onomatopoeia', 'morpheme', 'symbol and non-sentential punctuation', 'other', 'unclassified items']),
};

function normPos(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function posGroupForToken(token) {
  const key = normPos(token);
  for (const id of POS_GROUP_ORDER) {
    if (POS_GROUP_RULES[id].has(key)) return id;
  }
  return null;
}

function posGroupLabel(id) {
  const key = `posGroup_${id}`;
  return t(key);
}

// POS metadata is stable for a word; cache parsing, not language-specific labels or study status.
const posCache=new WeakMap();
function parsedPos(w){
 if(!w?.partOfSpeech)return {tokens:[],groups:[]};
 let row=posCache.get(w);
 if(!row||row.source!==w.partOfSpeech){const tokens=w.partOfSpeech.split(/\s*\/\s*/).map(s=>s.trim()).filter(Boolean),found=new Set(tokens.map(posGroupForToken));row={source:w.partOfSpeech,tokens,groups:POS_GROUP_ORDER.filter(id=>found.has(id))};posCache.set(w,row);}
 return row;
}
export function wordPosGroupDisplay(w){const groups=parsedPos(w).groups;return groups.length?groups.map(posGroupLabel).join(' · '):w?.partOfSpeech?.trim()||'';}
export function posGroupIdsForWord(w){return [...parsedPos(w).groups];}
export function posTagsForWords(words){const found=new Set(words.flatMap(w=>parsedPos(w).groups));return POS_GROUP_ORDER.filter(id=>found.has(id));}
export function filterByPosTag(words,tag){return !tag||tag==='all'?[...words]:words.filter(w=>{const row=parsedPos(w);return row.groups.includes(tag)||row.tokens.includes(tag)||row.source?.trim()===tag;});}

export function statusTagClass(level) {
  if (level === 0) return 'wl-tag wl-st-new';
  if (level < 5) return 'wl-tag wl-st-learning';
  return 'wl-tag wl-st-mastered';
}

export function statusTagHTML(level) {
  const [label] = statusLabel(level);
  return `<span class="${statusTagClass(level)}">${label}</span>`;
}

/** Word list: one collapsible "필터" with study status + POS sections inside when open. */
export function wordlistCombinedFilterMarkup(forStatusRow, statusFilter, forTagRow, tagFilter, pool=forTagRow, open=false) {
  const statusFilters = [
    ['all', t('filterAll'), forStatusRow.length],
    ['new', t('statusNew'), forStatusRow.filter(w => w.srs.level === 0).length],
    ['learning', t('statusLearning'), forStatusRow.filter(w => w.srs.level > 0 && w.srs.level < 5).length],
    ['mastered', t('statusMastered'), forStatusRow.filter(w => w.srs.level >= 5).length],
  ];
  const tags = posTagsForWords(pool);
  const tagRows = [['all', t('filterAll'), forTagRow.length]];
  for (const tg of tags) {
    const n = filterByPosTag(forTagRow, tg).length;
    tagRows.push([tg, posGroupLabel(tg), n]);
  }
  const sCur = statusFilters.find(([k]) => k === statusFilter) || statusFilters[0];
  const tCur = tagRows.find(([k]) => k === tagFilter) || tagRows[0];
  const statusPick = `${sCur[1]} (${sCur[2]})`;
  const tagPick = `${tCur[1]} (${tCur[2]})`;
  return `<details class="filter-fold filter-fold--combined study-filter-panel" ${open?'open':''}><summary class="filter-fold-sum filter-fold-sum--combined"><div class="filter-fold-sum-head"><span class="filter-fold-k filter-fold-k--panel">${t('filterPanel')}</span></div><div class="filter-fold-sum-picks"><span class="filter-fold-pick-l">${t('filterStatus')}</span><span class="filter-fold-pick-v">${statusPick}</span><span class="filter-fold-pick-l">${t('filterTags')}</span><span class="filter-fold-pick-v">${tagPick}</span></div></summary><div class="filter-fold-body filter-fold-split"><div class="filter-split-head">${t('filterStatus')}</div><div class="wl-filter-row">${statusFilters.map(([key,label,count])=>`<button type="button" class="wl-filter ${statusFilter===key?'active':''}" data-f="${key}" aria-pressed="${statusFilter===key}">${label} (${count})</button>`).join('')}</div><div class="filter-split-divider"></div><div class="filter-split-head">${t('filterTags')}</div><div class="wl-filter-row wl-tag-filter-row">${tagRows.map(([key,label,count])=>`<button type="button" class="wl-filter ${tagFilter===key?'active':''}" data-tag="${encodeURIComponent(key)}" aria-pressed="${tagFilter===key}">${label} (${count})</button>`).join('')}</div></div></details>`;
}

/** Wrong-answer book: HSK level + POS group filters (counts cross-filter like word list). */
export function wrongBookCombinedFilterMarkup(
  forLevelRow, levelFilter,
  forTagRow, tagFilter,
  { levelOf, groupsOf, showMode=false, modeFilter='all', forModeRow=[] },
) {
  const levelFilters = [
    ...[1, 2, 3, 4, 5, 6, 7].map((lv) => {
      const n = forLevelRow.filter((w) => levelOf(w) === lv).length;
      return [String(lv), lv === 7 ? hskBandLabel(7) : `HSK ${lv}`, n];
    }),
  ];
  const tagIds = POS_GROUP_ORDER.filter((id) => id === tagFilter || forTagRow.some((w) => groupsOf(w).includes(id)));
  const tagRows = [['all', t('filterAll'), forTagRow.length]];
  for (const tg of tagIds) {
    const n = forTagRow.filter((w) => groupsOf(w).includes(tg)).length;
    tagRows.push([tg, posGroupLabel(tg), n]);
  }
  const modeRows=[['all',t('filterAll'),forModeRow.length],...['pinyin','tone','cloze','scramble','vocabinput','vocabmeaning','listenword','listensentence'].filter(mode=>mode===modeFilter||forModeRow.some(w=>w.mode===mode)).map(mode=>[mode,modeTitle(mode),forModeRow.filter(w=>w.mode===mode).length])];
  const mCur=modeRows.find(([id])=>id===modeFilter)||modeRows[0];
  const lCur = levelFilters.find(([k]) => k === levelFilter) || levelFilters[0];
  const tCur = tagRows.find(([k]) => k === tagFilter) || tagRows[0];
  const levelPick = `${lCur[1]} (${lCur[2]})`;
  const tagPick = `${tCur[1]} (${tCur[2]})`;
  const group = (title, rows, selected, attribute) => `<div class="filter-split-head">${title}</div><div class="wl-filter-row">${rows.map(([id,label,count])=>`<button type="button" class="wl-filter ${selected===id?'active':''}" ${attribute}="${encodeURIComponent(id)}" aria-pressed="${selected===id}">${label} (${count})</button>`).join('')}</div>`;
  return `<details class="filter-fold filter-fold--combined wrong-filter-panel"><summary class="filter-fold-sum filter-fold-sum--combined"><div class="filter-fold-sum-head"><span class="filter-fold-k filter-fold-k--panel">${t('filterPanel')}</span></div><div class="filter-fold-sum-picks"><span class="filter-fold-pick-l">${t('wrongFilterHsk')}</span><span class="filter-fold-pick-v">${levelPick}</span><span class="filter-fold-pick-l">${t('filterTags')}</span><span class="filter-fold-pick-v">${tagPick}</span>${showMode?`<span class="filter-fold-pick-l">${t('wrongFilterMode')}</span><span class="filter-fold-pick-v">${mCur[1]} (${mCur[2]})</span>`:''}</div></summary><div class="filter-fold-body filter-fold-split">${group(t('wrongFilterHsk'),levelFilters,levelFilter,'data-wlv')}<div class="filter-split-divider"></div>${group(t('filterTags'),tagRows,tagFilter,'data-wtag')}${showMode?`<div class="filter-split-divider"></div>${group(t('wrongFilterMode'),modeRows,modeFilter,'data-wmode')}`:''}</div></details>`;
}

export function showStatusSheet(wordId, onDone, fallbackWord) {
  const words = Store.words;
  const w = words.find(x => x.id === wordId) || (fallbackWord ? {...fallbackWord,srs:fallbackWord.srs||{level:0}} : null);
  if (!w) return;

  const posGrouped = wordPosGroupDisplay(w);
  const focus=document.activeElement;
  const overlay = document.createElement('div');
  overlay.className = 'detail-overlay';
  overlay.innerHTML = `<div class="detail-sheet">
    <div class="detail-sheet-head">
      <button type="button" class="detail-sheet-icon detail-sheet-close close-btn">×</button>
      <div class="detail-sheet-head-center">
        <span class="detail-badge detail-badge-hsk">${hskBandLabel(w.hskLevel)}</span>
        ${posGrouped ? `<span class="detail-badge detail-badge-pos">${posGrouped}</span>` : ''}
      </div>
      <button type="button" class="detail-sheet-icon detail-sheet-speak speak-btn">🔊</button>
    </div>
    <div class="study-sheet-core">
      <div class="py-per-char py-per-char--sheet">${Pinyin.htmlMarkedColumns(w.syllables)}</div>
      <div class="study-sheet-meaning">${wordMeaning(w)}</div>
    </div>
    ${renderCollocations(w,Store.uiLang)}<div class="study-status-title">${t('changeStudyStatus')}</div>
    <div class="status-btns">
      <button class="status-btn ${w.srs.level === 0 ? 'active' : ''}" data-lv="0">
        <span class="status-dot" style="background:var(--text3)"></span>${t('statusNew')}
      </button>
      <button class="status-btn ${w.srs.level > 0 && w.srs.level < 5 ? 'active' : ''}" data-lv="2">
        <span class="status-dot" style="background:var(--blue)"></span>${t('statusLearning')}
      </button>
      <button class="status-btn ${w.srs.level >= 5 ? 'active' : ''}" data-lv="5">
        <span class="status-dot" style="background:var(--green)"></span>${t('statusMastered')}
      </button>
    </div>
    ${w.sentences?.length ? `
      <div class="study-examples"><h3>${t('examples')}</h3>
      ${w.sentences.map((s,i) => `<div class="fc-example-block example-with-audio"><button type="button" class="example-speak word-listen" data-example="${i}" aria-label="${t('listenSentence')}">🔊</button>
        ${Pinyin.htmlSentence(s)}
        <div style="font-size:13px;color:var(--text2);margin-top:2px">${sentenceMeaning(s)}</div>
      </div>`).join('')}</div>` : ''}
  </div>`;

  bindCollocationAudio(overlay,w,text=>TTS.speak(text));
  document.body.appendChild(overlay);
  const close = () => { TTS.stop(); overlay.remove(); onDone?.(); if(focus?.isConnected)focus.focus({preventScroll:true}); };
  overlay.querySelector('.close-btn').onclick = close;
  overlay.querySelector('.speak-btn').onclick = () => TTS.speak(w.hanzi);
  overlay.querySelectorAll('[data-example]').forEach(button=>button.onclick=()=>TTS.speak(w.sentences[Number(button.dataset.example)].hanzi));
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  overlay.querySelectorAll('.status-btn').forEach(b => b.onclick = () => {
    const lv = Number(b.dataset.lv);
    Store.updateWord(wordId, ww => {
      ww.srs.level = lv;
      ww.srs.nextReview = Date.now();
    });
    Haptic.success();
    overlay.querySelectorAll('.status-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    onDone?.();
  });
}

export function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}
export function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

export const modeTitle = mode => t(SCREENS[mode]?.title || `mode_${mode}`) || mode;
export const modeIcon = mode => SCREENS[mode]?.icon || (['listenword','listensentence'].includes(mode) ? '🎧' : '❓');
export const QUIZ_MODES = HOME_MODES;

/** Keep a wrong syllable visible under its correction. */
export function quizPinyinFeedback(answer, correction, correct) {
  return `<span class="quiz-pinyin-feedback">${correct
    ? `<span class="quiz-pinyin-right" aria-label="${t('correctAnswer')}">${escape(answer)}</span>`
    : `<span class="quiz-pinyin-correction" aria-label="${t('correctAnswer')}">${escape(correction)}</span><del class="quiz-pinyin-wrong" aria-label="${t('yourAnswer')}">${escape(answer)}</del>`}</span>`;
}

export function showDetail(id, words) {
  const w = words.find(x => x.id === id);
  if (!w) return;
  const overlay = document.createElement('div');
  overlay.className = 'detail-overlay';
  overlay.innerHTML = `<div class="detail-sheet">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <button class="close-btn" style="font-size:28px;color:var(--text2)">✕</button>
      <button class="speak-btn" style="font-size:24px;color:var(--blue)">🔊</button>
    </div>
    <div style="text-align:center;margin-bottom:16px">
      <div class="py-per-char py-per-char--detail">${Pinyin.htmlMarkedColumns(w.syllables)}</div>
      <div style="font-size:20px;margin-top:10px">${wordMeaning(w)}</div>
    </div>
    <div style="display:flex;gap:6px;margin-bottom:12px">
      <span class="badge" style="background:rgba(0,122,255,0.1);color:var(--blue)">${hskBandLabel(w.hskLevel)}</span>
      <span class="badge" style="background:rgba(175,82,222,0.1);color:var(--purple)">${w.partOfSpeech}</span>
    </div>
    ${w.measureWord ? `<div style="font-size:14px;margin-bottom:8px">${t('measureWord')}: ${w.measureWord}</div>` : ''}
    ${w.sentences?.length ? `
      <div style="border-top:0.5px solid var(--sep);margin:12px 0"></div>
      <div style="font-weight:600;margin-bottom:8px">${t('examples')}:</div>
      ${w.sentences.map(s => `<div style="margin-bottom:10px">
        ${Pinyin.htmlSentence(s)}
        <div style="font-size:14px;color:var(--text2);margin-top:2px">${sentenceMeaning(s)}</div>
      </div>`).join('')}` : ''}
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.close-btn').onclick = () => overlay.remove();
  overlay.querySelector('.speak-btn').onclick = () => TTS.speak(w.hanzi);
  overlay.querySelectorAll('[data-example]').forEach(button=>button.onclick=()=>TTS.speak(w.sentences[Number(button.dataset.example)].hanzi));
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

export function renderKeyboard() {
  const toneSvg = [
    `<svg viewBox="0 0 32 20" class="tone-svg"><line x1="4" y1="6" x2="28" y2="6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`,
    `<svg viewBox="0 0 32 20" class="tone-svg"><line x1="4" y1="16" x2="28" y2="4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`,
    `<svg viewBox="0 0 32 20" class="tone-svg"><polyline points="4,6 16,17 28,4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    `<svg viewBox="0 0 32 20" class="tone-svg"><line x1="4" y1="4" x2="28" y2="16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  ];
  return `<div class="keyboard">
    <div class="kb-tones">${toneSvg.map((svg, i) => `<button class="kb-tone" data-k="${i+1}">${svg}</button>`).join('')}</div>
    <div class="kb-letters">
      <div class="kb-row">${[...'qwertyuiop'].map(k => `<button class="kb-key" data-k="${k}">${k}</button>`).join('')}</div>
      <div class="kb-row kb-row-mid">${[...'asdfghjkl'].map(k => `<button class="kb-key" data-k="${k}">${k}</button>`).join('')}</div>
      <div class="kb-row">${[...'zxc'].map(k => `<button class="kb-key" data-k="${k}">${k}</button>`).join('')}<button class="kb-key" data-k="ü">ü</button>${[...'bnm'].map(k => `<button class="kb-key" data-k="${k}">${k}</button>`).join('')}<button class="kb-key kb-fn kb-del" data-act="delete"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 4h8a3 3 0 013 3v6a3 3 0 01-3 3H9l-5-6 5-6z"/><line x1="13" y1="8.5" x2="17" y2="12.5"/><line x1="17" y1="8.5" x2="13" y2="12.5"/></svg></button></div>
    </div>
  </div>`;
}

export function attachKeyboard(el, cb) {
  el.querySelectorAll('.kb-key[data-k]').forEach(b => b.onclick = () => { Haptic.light(); cb.onTap(b.dataset.k); });
  el.querySelectorAll('.kb-tone[data-k]').forEach(b => b.onclick = () => { Haptic.medium(); cb.onTap(b.dataset.k); });
  el.querySelectorAll('.kb-key[data-act]').forEach(b => b.onclick = () => {
    Haptic.light();
    if (b.dataset.act === 'delete') cb.onDelete();
  });
}
