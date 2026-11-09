const TONE_MAP = {
  a: ['ā','á','ǎ','à'], e: ['ē','é','ě','è'], i: ['ī','í','ǐ','ì'],
  o: ['ō','ó','ǒ','ò'], u: ['ū','ú','ǔ','ù'], 'ü': ['ǖ','ǘ','ǚ','ǜ']
};
const VOWELS = new Set(['a','e','i','o','u','ü']);
/** Max grapheme length for a single syllable’s marked pinyin in our data (column `ch` width). */
const PY_COL_MIN_CH = 6;

export const Pinyin = {
  marked(base, tone) {
    if (tone === 0) return base;
    // Syllabic consonants occur in the official interjection 嗯 (ǹg).
    if (/^(m|n|ng)$/i.test(base)) {
      return (base[0] + ['\u0304', '\u0301', '\u030c', '\u0300'][tone - 1] + base.slice(1)).normalize('NFC');
    }
    const cs = [...base];
    const lower = base.toLowerCase();
    const place = i => {
      const m = TONE_MAP[cs[i].toLowerCase()];
      if (m) {
        cs[i] = cs[i] === cs[i].toUpperCase() ? m[tone - 1].toUpperCase() : m[tone - 1];
        return cs.join('');
      }
      return base;
    };
    let idx = lower.indexOf('a'); if (idx >= 0) return place(idx);
    idx = lower.indexOf('e');     if (idx >= 0) return place(idx);
    if (lower.includes('ou')) { idx = lower.indexOf('o'); if (idx >= 0) return place(idx); }
    for (let i = cs.length - 1; i >= 0; i--) if (VOWELS.has(cs[i].toLowerCase())) return place(i);
    return base;
  },

  numbered(syls) { return syls.map(s => s.base + (s.tone === 0 ? '' : s.tone)).join(' '); },
  markedWord(syls) { return syls.map(s => this.marked(s.base, s.tone)).join(' '); },

  /** Dictionary search accepts spaced/compact, numbered and marked pinyin. */
  searchKey(value) {return this._umlautFromAscii(String(value).toLowerCase()).normalize('NFC').replace(/[\s'’\-]+/g,'').replace(/0/g,'5');},
  searchForms(syls) {
    if(!syls?.length)return [];
    return [syls.map(s=>s.base).join(''),syls.map(s=>s.base+(s.tone===0?5:s.tone)).join(''),this.markedWord(syls)].map(value=>this.searchKey(value));
  },
  matchesSearch(syls,query) {
    const q=this.searchKey(query);return !!q&&this.searchForms(syls).some(form=>form.includes(q));
  },

  _col(py, hz) {
    return `<span class="py-char-col"><span class="py-char-py">${py}</span><span class="py-char-hz">${hz}</span></span>`;
  },
  /** Fixed column width: longest syllable pinyin in data is capped at PY_COL_MIN_CH graphemes. */
  _syllableGridVars(syls) {
    const n = syls.length;
    return `--py-cols:${n};--py-min-ch:${PY_COL_MIN_CH}`;
  },
  /** `style=""` value for tone quiz / shared syllable rows (same column metrics as py-per-char). */
  syllableRowStyle(syls) {
    if (!syls?.length) return '';
    return this._syllableGridVars(syls);
  },
  /** Marked pinyin above each syllable’s hanzi (centered columns). */
  htmlMarkedColumns(syls) {
    if (!syls?.length) return '';
    const st = this._syllableGridVars(syls);
    return `<span class="py-per-char" style="${st}">${syls.map(s => this._col(this.marked(s.base, s.tone), s.hanzi)).join('')}</span>`;
  },
  /** Align spoken tokens; punctuation may be explicit or absent in the reading. */
  sentenceColumns(sentence) {
    const chars = [...(sentence.hanzi || '')];
    const tokens = (sentence.pinyin || '').trim().split(/\s+/).filter(Boolean);
    const columns = [];
    let i = 0;
    for (const token of tokens) {
      const syllable = token.match(/^([a-zü:v]+)([0-5])$/i);
      if (syllable) {
        while (chars[i] && /\p{P}/u.test(chars[i])) {
          columns.push({ hanzi: chars[i++], pinyin: '' });
        }
        if (!chars[i] || !/\p{Script=Han}/u.test(chars[i])) return null;
        let hanzi = chars[i++];
        const base = syllable[1].toLowerCase();
        // A suffix-r syllable covers both the preceding character and 儿.
        if (base.endsWith('r') && base !== 'er' && chars[i] === '儿') hanzi += chars[i++];
        columns.push({ hanzi, pinyin: this.convertLive(token) });
      } else {
        if (token !== chars[i]) return null;
        columns.push({ hanzi: chars[i++], pinyin: '' });
      }
    }
    while (chars[i] && /\p{P}/u.test(chars[i])) {
      columns.push({ hanzi: chars[i++], pinyin: '' });
    }
    return i === chars.length ? columns : null;
  },

  htmlSentence(sentence, { blank = '', highlight = '' } = {}) {
    const escape = value => String(value).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
    let columns = this.sentenceColumns(sentence);
    // Preserve readable text rather than show incorrect pairings for future
    // content whose transcription does not follow the reviewed token format.
    const target = blank || highlight;
    const offset = target ? (sentence.hanzi || '').indexOf(target) : -1;
    const fallback = () => {
      const text = sentence.hanzi || '';
      const slot = blank ? '<span class="cloze-blank">______</span>' : `<mark class="cloze-answer">${escape(highlight)}</mark>`;
      const display = offset < 0 ? escape(text) : escape(text.slice(0, offset)) + slot + escape(text.slice(offset + target.length));
      return `<div class="example-pinyin">${escape(this.convertLive(sentence.pinyin || '').replace(/\p{P}/gu, ''))}</div><div class="example-sentence">${display}</div>`;
    };
    if (!columns) return fallback();
    if (offset >= 0) {
      const boundaries = [0];
      for (const column of columns) boundaries.push(boundaries[boundaries.length - 1] + column.hanzi.length);
      const start = boundaries.indexOf(offset);
      const end = boundaries.indexOf(offset + target.length);
      // Preserve joined erhua instead of guessing where to split its pinyin.
      if (start < 0 || end < 0) return fallback();
      if (blank) {
        columns = [...columns.slice(0, start), {
          hanzi: '______', pinyin: columns.slice(start, end).map(c => c.pinyin).filter(Boolean).join(' '), blank: true,
        }, ...columns.slice(end)];
      } else {
        columns = columns.map((column, i) => ({ ...column, highlight: i >= start && i < end }));
      }
    }
    const groups = [];
    for (const column of columns) {
      if (column.pinyin || !groups.length) groups.push([]);
      groups[groups.length - 1].push(column);
    }
    // Punctuation gets an empty annotation slot and the same character row.
    // Keep trailing punctuation with its character when the sentence wraps.
    return `<div class="example-sentence">${groups.map(group =>
      `<span class="example-unit">${group.map(c => `<ruby><span class="example-hanzi${c.blank ? ' cloze-blank' : ''}${c.highlight ? ' cloze-answer' : ''}">${escape(c.hanzi)}</span><rt${c.pinyin ? '' : ' aria-hidden="true"'}>${escape(c.pinyin)}</rt></ruby>`).join('')}</span>`
    ).join('')}</div>`;
  },
  /** Live input (space-separated syllables) aligned to word syllables. */
  htmlLiveInputColumns(word, input) {
    const syls = word?.syllables;
    if (!syls?.length) return '';
    const st = this._syllableGridVars(syls);
    const parts = input.trim().split(/\s+/).filter(Boolean);
    return `<span class="py-per-char" style="${st}">${syls.map((s, i) =>
      this._col(this.convertLive(parts[i] || '') || '\u00a0', s.hanzi)).join('')}</span>`;
  },
  /** ü as `:u`, `u:`, or keyboard `v` (no plain `v` in Hanyu Pinyin). */
  _umlautFromAscii(s) {
    if (!s) return s;
    return s.toLowerCase().replace(/:u/g, 'ü').replace(/u:/g, 'ü').replace(/v/g, 'ü');
  },

  normalize(s) { return this._umlautFromAscii(s.trim()).replace(/ +/g, ' '); },

  compare(input, word) {
    const parts = this.normalize(input).split(' ').filter(Boolean);
    return [word.syllables, ...(word.alternateSyllables || [])].some(syls =>
      parts.length === syls.length && parts.every((p, i) => {
        const { tone } = syls[i];
        const base = syls[i].base.toLowerCase();
        return tone === 0 ? [base, base + '0', base + '5'].includes(p) : p === base + tone;
      }));
  },

  convertLive(input) {
    const s = this._umlautFromAscii(input);
    return s.replace(/([a-zü]+)([0-5])/gi, (_, base, toneStr) => {
      const t = parseInt(toneStr, 10);
      const b = base.toLowerCase();
      if (t === 0 || t === 5) return b;
      return this.marked(b, t);
    });
  }
};
