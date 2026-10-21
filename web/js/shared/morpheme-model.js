/** Bounded rendering policy, independent of inventory coverage or study-level limits. */
export const MORPHEME_PAGING = Object.freeze({cards:8, initialWords:12, moreWords:20});

const normalise = value => String(value).normalize('NFKC').toLowerCase();

/** Prepare immutable source-derived indexes once per installed explanation set. */
export function createMorphemeModel(rows, words) {
 const byId = new Map(rows.map(row => [row.id, row]));
 const byWord = new Map();
 for (const word of words) {
  const key = normalise(word.lemma);
  const matches = byWord.get(key) || [];
  matches.push(word);
  byWord.set(key, matches);
 }
 const search = new Map(rows.map(row => [row.id, normalise([
  row.form, ...row.variants, ...row.senses.map(sense => sense.meaning), ...row.examples,
 ].join(' '))]));

 return {
  total:rows.length,
  kinds:['all', ...new Set(rows.map(row => row.kind))],
  find({query='', kind='all'}={}) {
   const term = normalise(query);
   return rows.filter(row => (kind==='all' || row.kind===kind) && search.get(row.id).includes(term));
  },
  uniqueWord(text) {
   const matches = byWord.get(normalise(text)) || [];
   return matches.length===1 ? matches[0] : undefined;
  },
  relatedWords(id, start=0, count=MORPHEME_PAGING.moreWords) {
   const examples = byId.get(id)?.examples || [];
   const offset = Number.isInteger(start) && start>=0 ? Math.min(start, examples.length) : 0;
   const size = Number.isInteger(count) && count>0 ? Math.min(count,MORPHEME_PAGING.moreWords) : MORPHEME_PAGING.moreWords;
   const end = Math.min(offset+size, examples.length);
   return {words:examples.slice(offset,end), next:end, hasMore:end<examples.length};
  },
 };
}
