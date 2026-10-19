import { STUDY_LEVELS, studyLevelGroup } from '../app-definition.js';
const levels=STUDY_LEVELS.map(level=>level.id);
const levelRank=word=>{const rank=levels.indexOf(studyLevelGroup(word.cefr));return rank<0?levels.length:rank;};
const compare=new Intl.Collator('de',{sensitivity:'base'});
export const foldDictionaryText=value=>String(value??'').normalize('NFC').toLocaleLowerCase('de').replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').replace(/\s+/g,' ').trim();
const values=v=>typeof v==='string'?[v]:Array.isArray(v)?v.flatMap(values):v&&typeof v==='object'?Object.values(v).flatMap(values):[];
export const wordType=w=>w.pos==='functional'?w.subtype:w.pos;
export function dictionaryEntries(words,{level='all',pos='all',query=''}={}) {
 const tokens=foldDictionaryText(query).split(' ').filter(Boolean);
 const filtered=words.filter(w=>!((level==='reference'?!w.reference_only:level!=='all'&&studyLevelGroup(w.cefr)!==studyLevelGroup(level))||pos!=='all'&&w.pos!==pos&&wordType(w)!==pos));
 const queryText=foldDictionaryText(query);
 const exact=filtered.filter(w=>queryText&&[w.lemma,w.plural,w.comparative,w.superlative,...values(w.declension).map(x=>x.replace(/^(der|die|das|den|dem|des) /u,'')),...values(w.forms),...values(w.attested_forms).map(x=>x.replace(/^(hat|ist) /u,'')),...values(w.pronoun_forms),...values(w.article_forms),...w.meaning_en.flatMap(x=>x.split(';').map(y=>y.trim().replace(/^to /u,''))),...w.meaning_ko.flatMap(x=>x.split(';'))].some(x=>foldDictionaryText(x)===queryText));
 return (exact.length?exact:filtered.filter(w=>{
  if(!tokens.length)return true;
  const text=w._search||foldDictionaryText([w.lemma,w.studyMeaning,...w.meaning_en,...w.meaning_ko,w.plural,w.comparative,w.superlative,...values(w.declension),...values(w.forms),...values(w.attested_forms),...values(w.pronoun_forms),...values(w.article_forms)].filter(Boolean).join(' '));
  return tokens.every(token=>text.includes(token));
 })).sort((a,b)=>levelRank(a)-levelRank(b)||compare.compare(a.lemma,b.lemma)||a.sense_id.localeCompare(b.sense_id));
}
