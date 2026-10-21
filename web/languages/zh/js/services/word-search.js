import {collocationSearchTerms} from '../../../../js/shared/collocations.js';
import { Pinyin } from './pinyin.js';
const index=new WeakMap();
export const wordSearchQuery=query=>({text:String(query).trim().toLowerCase(),pinyin:Pinyin.searchKey(query)});
export function matchesWordSearch(word,query){
 if(!query.text)return true;
 let row=index.get(word);
 if(!row){row={text:[word.hanzi,word.meaningKo||'',word.meaningEn||'',...collocationSearchTerms(word)].map(s=>s.toLowerCase()),pinyin:[word.syllables,...(word.alternateSyllables||[])].filter(Boolean).flatMap(s=>Pinyin.searchForms(s))};index.set(word,row);}
 return row.text.some(text=>text.includes(query.text))||!!query.pinyin&&row.pinyin.some(form=>form.includes(query.pinyin));
}
