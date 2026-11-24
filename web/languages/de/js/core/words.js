export {shuffle as shuffleWords} from '../../../../js/shared/random.js';
import { escapeHtml as e } from '../../../../js/shared/ui.js';
import { dictionaryEntries, wordType } from './dictionary.js';
export function wordHeading(w) {
  const article=w.pos==='noun'&&w.article;
  const articleClass=w.number_restriction==='plural'?'plural':w.gender||'plural';
  return `${article?`<span class="noun-article ${e(articleClass)}">${e(article)}</span> `:''}${e(w.lemma)}`;
}
export const studyWords=(words,level,filters={})=>dictionaryEntries(words,{...filters,level});
export const studyTypes=words=>[...new Set(words.map(wordType))];
export function filterStudyStatus(words,store,status='all'){return status==='all'?[...words]:words.filter(w=>store.wordStatus(w.id)===status);}
