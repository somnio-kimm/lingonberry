/** Group the dictionary view only; quizzes and history retain their original sense IDs. */
export const readWordSenses=word=>word.senses||[word];
export function readHeadwordStatus(word,readStatus){
 const statuses=readWordSenses(word).map(sense=>readStatus(sense.id));
 return statuses.every(status=>status==='new')?'new':statuses.every(status=>status==='mastered')?'mastered':'learning';
}
const readHeadwordKey=word=>JSON.stringify([word.level,word.lemma.normalize('NFC')]);
export function groupEnglishHeadwords(words){
 const groups=new Map();
 for(const word of words){const key=readHeadwordKey(word);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(word);}
 return [...groups.values()].map(senses=>senses.length===1?senses[0]:{
  ...senses[0],senses,
  studyMeaning:[...new Set(senses.map(word=>word.studyMeaning))].join('; '),
  search:senses.map(word=>word.search||'').join(' '),
  searchAliases:[...new Set(senses.flatMap(word=>word.searchAliases||[]))],
  tags:[...new Set(senses.flatMap(word=>word.tags||[]))],
  collocations:[...new Map(senses.flatMap(word=>word.collocations||[]).map(row=>[JSON.stringify(row),row])).values()],
 });
}
export function createEnglishHeadwords(words){
 const byKey=new Map(groupEnglishHeadwords(words).map(word=>[readHeadwordKey(word),word]));
 return {group:list=>groupEnglishHeadwords(list).map(word=>word.senses||!byKey.get(readHeadwordKey(word))?.senses?word:{...word,senses:[word]}),expand:word=>word.senses?word:byKey.get(readHeadwordKey(word))||word};
}
