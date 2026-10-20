import {reviewDigest} from './english-meaning-review.mjs';
/** Bind review decisions to every Japanese lexical field and existing primary example. */
export function prepareJapaneseReview(core,english,korean){
 const pairs=[english,korean].map(pair=>new Map(pair.entries.map(row=>[row.id,row])));
 return core.entries.map((entry,index)=>{
  const [en,ko]=pairs.map(pair=>pair.get(entry.id));
  if(!en?.meaning||!ko?.meaning)throw new Error('Missing bilingual meaning: '+entry.id);
  const row={index,id:entry.id,word:entry.word,pos:entry.partOfSpeech,pronunciation:entry.pronunciation??null,level:entry.level,en:en.meaning,ko:ko.meaning,source:entry.provenance,examples:entry.example?[{text:entry.example.text,en:en.exampleTranslation??null,ko:ko.exampleTranslation??null}]:[]};
  return {...row,digest:reviewDigest(row)};
 });
}
export function validateJapaneseDecisions(entries,decisions){
 const seen=new Set();
 for(const row of decisions){
  const original=entries[row.index];
  if(!original||original.id!==row.id||original.digest!==row.digest||seen.has(row.id))throw new Error('Stale or duplicate Japanese review: '+row.id);
  if(!['retain','correct','replace','retire'].includes(row.decision)||!row.reason?.trim())throw new Error('Unresolved Japanese review: '+row.id);
  if(row.decision==='retain'&&['word','pos','en','ko','pronunciation','aliases','example','duplicateOf'].some(field=>row[field]!==undefined))throw new Error('Retained entry has edits: '+row.id);
  seen.add(row.id);
 }
 if(seen.size!==entries.length)throw new Error('Incomplete Japanese review: '+(entries.length-seen.size)+' entries remain');
}
