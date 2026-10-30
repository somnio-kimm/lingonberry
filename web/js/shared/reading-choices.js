import {normaliseKana,splitOkurigana,indexJapaneseSpellings} from './japanese-reading.js';
/** Use verified reading answers as distractors; never mark an accepted variant wrong. */
export function createReadingChoices(rows,words,locale='en',spellings=indexJapaneseSpellings(words)){
 const byId=new Map(words.map(word=>[word.id,word])),pools=new Map(),result=[];
 const key=row=>row.category+(['onyomi','kunyomi'].includes(row.category)?'':':'+(byId.get(row.entryId)?.subtype||byId.get(row.entryId)?.pos));
 const eligible=rows.filter(row=>row.route==='vocabinput'&&['reading','onyomi','kunyomi','okurigana'].includes(row.category));
 for(const row of eligible){if(row.boundaryKind==='spelling')continue;const values=pools.get(key(row))||new Set();if(values.size<128)values.add(row.answer);pools.set(key(row),values);}
 for(const row of eligible){
  if(row.category==='okurigana'&&row.boundaryKind==='spelling'){
   const word=byId.get(row.entryId),segments=word&&splitOkurigana(word);if(!segments)continue;
   const reading=normaliseKana(row.prompt),boundary=reading.length-segments[1].text.length,options=[row.answer];
   const seen=new Set([row.answer,...(row.acceptedAnswers||[]),...(spellings.get(reading)||[])].map(normaliseKana));
   const positions=[boundary+1,boundary-1,boundary+2,boundary-2,...Array.from({length:reading.length+1},(_,i)=>i)];
   for(const at of positions){if(options.length===4)break;if(at<0||at>reading.length)continue;const text=segments[0].text+reading.slice(at),fold=normaliseKana(text);if(!seen.has(fold)){options.push(text);seen.add(fold);}}
   if(options.length>=3)result.push({...row,id:row.id+'-choice',route:'vocabmeaning',options,instruction:locale==='ko'?'올바른 오쿠리가나를 사용한 단어 전체를 선택하세요.':'Choose the complete word with the correct okurigana.'});
   continue;
  }
  const accepted=new Set([row.answer,...(row.acceptedAnswers||[])].map(normaliseKana)),pool=[...pools.get(key(row))];
  const start=[...row.id].reduce((sum,char)=>sum+char.codePointAt(0),0)%pool.length,options=[row.answer],seen=new Set(accepted);
  for(let i=0;i<pool.length&&options.length<4;i++){const text=pool[(start+i)%pool.length],fold=normaliseKana(text);if(!seen.has(fold)){options.push(text);seen.add(fold);}}
  if(options.length<3)continue;
  const instruction=row.category==='onyomi'||row.category==='kunyomi'?(locale==='ko'?`이 한자의 사전에 실린 ${row.category==='onyomi'?'음독':'훈독'}을 선택하세요.`:`Choose a dictionary-listed ${row.category==='onyomi'?'on’yomi':'kun’yomi'} of this character.`):(row.category==='reading'?(locale==='ko'?'밑줄 친 단어의 읽기를 선택하세요.':'Choose the reading of the underlined word.'):(locale==='ko'?'표시된 빈칸이나 단어에 해당하는 읽기를 선택하세요.':'Choose the reading for the displayed word or blank.'));
  result.push({...row,id:row.id+'-choice',route:'vocabmeaning',options,instruction});
 }
 return result;
}
