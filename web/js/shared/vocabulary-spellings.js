/** Curated lexical spellings only; reference inflections and symbols are separate. */
export const normalizeVocabularySpelling=value=>String(value??'').normalize('NFC').trim().replace(/\s+/gu,' ');
export const readVocabularyWord=word=>word.lemma??word.hanzi??'';
export const collectVocabularySpellings=word=>[...new Set([readVocabularyWord(word),...(word.aliases||[])].map(normalizeVocabularySpelling).filter(Boolean))];
