import {normaliseKana} from './japanese-reading.js';
/** Use verified reading answers as distractors; never mark an accepted variant wrong. */
export function createReadingChoices(rows,words,locale='en'){
 const byId=new Map(words.map(word=>[word.id,word])),pools=new Map(),result=[];
 const key=row=>row.category+(['onyomi','kunyomi'].includes(row.category)?'':':'+(byId.get(row.entryId)?.subtype||byId.get(row.entryId)?.pos));
 const eligible=rows.filter(row=>row.route==='vocabinput'&&['reading','onyomi','kunyomi','okurigana'].includes(row.category));
 for(const row of eligible){const values=pools.get(key(row))||new Set();if(values.size<128)values.add(row.answer);pools.set(key(row),values);}
 for(const row of eligible){
  const accepted=new Set([row.answer,...(row.acceptedAnswers||[])].map(normaliseKana)),pool=[...pools.get(key(row))];
  const start=[...row.id].reduce((sum,char)=>sum+char.codePointAt(0),0)%pool.length,options=[row.answer],seen=new Set(accepted);
  for(let i=0;i<pool.length&&options.length<4;i++){const text=pool[(start+i)%pool.length],fold=normaliseKana(text);if(!seen.has(fold)){options.push(text);seen.add(fold);}}
  if(options.length<3)continue;
  const instruction=row.category==='onyomi'||row.category==='kunyomi'?(locale==='ko'?`이 한자의 사전에 실린 ${row.category==='onyomi'?'음독':'훈독'}을 선택하세요.`:`Choose a dictionary-listed ${row.category==='onyomi'?'on’yomi':'kun’yomi'} of this character.`):(locale==='ko'?'표시된 빈칸이나 단어에 해당하는 읽기를 선택하세요.':'Choose the reading for the displayed word or blank.');
  result.push({...row,id:row.id+'-choice',route:'vocabmeaning',options,instruction});
 }
 return result;
}
