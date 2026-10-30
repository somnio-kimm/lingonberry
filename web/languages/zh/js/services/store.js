import { wrongAnswerCount } from './wrong-count.js';
import * as Vocab from './vocabulary.js';

function _get(k, d) {
  try { const v = localStorage.getItem('learn-language.zh.'+k); return v ? JSON.parse(v) : d; }
  catch { return d; }
}
function _set(k, v) { localStorage.setItem('learn-language.zh.'+k, JSON.stringify(v)); }

export const Store = {
  get uiLang() { return _get('uiLang', 'ko'); },
  set uiLang(v) { _set('uiLang', v === 'en' ? 'en' : 'ko'); },

  get theme() {
    const x = _get('theme', 'system');
    return ['light', 'dark', 'system'].includes(x) ? x : 'system';
  },
  set theme(v) { _set('theme', ['light', 'dark', 'system'].includes(v) ? v : 'system'); },

  get hapticEnabled() { return _get('hapticEnabled', false) === true; },
  set hapticEnabled(v) { _set('hapticEnabled', !!v); },

  get clozeShowPinyin() { return _get('clozeShowPinyin', true) !== false; },
  set clozeShowPinyin(v) { _set('clozeShowPinyin', !!v); },

  get scrambleShowPinyin() { return _get('scrambleShowPinyin', true) !== false; },
  set scrambleShowPinyin(v) { _set('scrambleShowPinyin', !!v); },

  get words() {
    return Vocab.getWords();
  },

  updateWord(id, fn) {
    const w = Vocab.getWords().find(x => x.id === id);
    if (w) {
      fn(w);
      Vocab.persistSrs(id, w.srs);
    }
  },

  get autoRemoveResolvedWrongs() { return _get('autoRemoveResolvedWrongs', false) === true; },
  set autoRemoveResolvedWrongs(value) {
    _set('autoRemoveResolvedWrongs', !!value);
    if(value)_set('wrong', _get('wrong', []).filter(row=>wrongAnswerCount(row)>0));
  },
  get wrongAnswers() { return _get('wrong', []); },
  addWrong(w) {
    const arr = _get('wrong', []);
    arr.unshift({ ...w, id: crypto.randomUUID(), timestamp: Date.now() });
    _set('wrong', arr);
  },
  recordWrongRetest(id,input,correct,parts=[],expected=null,metadata={}) {
    const rows=_get('wrong', []);
    const row=rows.find(r=>r.id===id);if(!row)return;
    row.retests=[...(row.retests||[]),{input,correct,expected,at:Date.now(),...(metadata.listening?{listening:metadata.listening}:{})}];row.corrected=correct;
    if(!correct){if(expected){row.initialCorrectAnswer??=row.correctAnswer;row.correctAnswer=expected;}row.initialUserAnswer??=row.userAnswer;row.userAnswer=input;if(parts.length)row.wrongParts=parts;}
    _set('wrong',this.autoRemoveResolvedWrongs?rows.filter(record=>wrongAnswerCount(record)>0):rows);
  },
  deleteWrong(id) { _set('wrong', _get('wrong', []).filter(x => x.id !== id)); },
  clearWrong() { _set('wrong', []); },

  get streak() { return _get('streak', { count: 0, lastDate: null, sessions: 0, correct: 0, answered: 0 }); },
  set streak(v) { _set('streak', v); },

  /** Single HSK band 1..7 (stored as a one-element array). Legacy multi-select is coerced to min level. */
  get hskLevels() {
    const raw = _get('hskLevels', [1]);
    const arr = Array.isArray(raw) ? raw : [1];
    const valid = arr.map(Number).filter(x => x >= 1 && x <= 7);
    if (!valid.length) return [1];
    if (valid.length === 1) return [valid[0]];
    return [Math.min(...valid)];
  },
  set hskLevels(v) {
    const arr = Array.isArray(v) ? v : [v];
    const lv = arr.map(Number).find(x => x >= 1 && x <= 7) ?? 1;
    _set('hskLevels', [lv]);
  },

  get activeWords() {
    const levels = this.hskLevels;
    return Vocab.getWords().filter(w => levels.includes(w.hskLevel));
  },
};
