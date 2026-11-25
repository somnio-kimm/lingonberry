/** Group the dictionary view only; quizzes and history retain their original sense IDs. */
export const readWordSenses=word=>word.senses||[word];
export function readHeadwordStatus(word,readStatus){
 const statuses=readWordSenses(word).map(sense=>readStatus(sense.id,sense));
 return statuses.every(status=>status==='new')?'new':statuses.every(status=>status==='mastered')?'mastered':'learning';
}
export const readHeadwordIdentity=word=>JSON.stringify([word.level??word.cefr??word.hskLevel,(word.lemma||word.hanzi||word.word||word.id).normalize('NFC')]);
export function groupHeadwords(words){
 const groups=new Map();
 for(const word of words){const key=readHeadwordIdentity(word);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(word);}
 return [...groups.values()].map(senses=>senses.length===1?senses[0]:{
  ...senses[0],senses,
  studyMeaning:[...new Set(senses.map(word=>word.studyMeaning))].join('; '),
  search:senses.map(word=>word.search||'').join(' '),
  searchAliases:[...new Set(senses.flatMap(word=>word.searchAliases||[]))],
  tags:[...new Set(senses.flatMap(word=>word.tags||[]))],
  collocations:[...new Map(senses.flatMap(word=>word.collocations||[]).map(row=>[JSON.stringify(row),row])).values()],
 });
}
export function createHeadwords(words){
 const byKey=new Map(groupHeadwords(words).map(word=>[readHeadwordIdentity(word),word]));
 return {group:list=>groupHeadwords(list).map(word=>word.senses||!byKey.get(readHeadwordIdentity(word))?.senses?word:{...word,senses:[word]}),expand:word=>word.senses?word:byKey.get(readHeadwordIdentity(word))||word};
}

const inventories=new WeakMap();
export function headwordsForInventory(words){
 if(!inventories.has(words))inventories.set(words,createHeadwords(words));
 return inventories.get(words);
}
