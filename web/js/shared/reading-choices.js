import {normaliseKana,splitOkurigana,indexJapaneseSpellings} from './japanese-reading.js';
const readingKey=value=>normaliseKana(value).trim();
const readingRows=rows=>rows.filter(row=>row.route==='vocabinput'&&['reading','onyomi','kunyomi','okurigana'].includes(row.category));
/** Cache all verified readings once; sample a few distinct indices without copying/shuffling the full pool. */
export function createReadingChoiceSampler(rows,words){
 const byId=new Map(words.map(word=>[word.id,word])),groups=new Map();
 const key=row=>{
  if(['onyomi','kunyomi'].includes(row.category))return row.category;
  const word=byId.get(row.entryId);if(!word?.pos)return;
  return row.category+':'+word.pos+(word.pos==='functional'?':'+(word.subtype||''):'');
 };
 for(const row of readingRows(rows)){
  if(row.boundaryKind==='spelling')continue;
  const group=key(row);if(!group)continue;
  if(!groups.has(group))groups.set(group,new Map());
  groups.get(group).set(readingKey(row.answer),row.answer);
 }
 const pools=new Map([...groups].map(([group,values])=>[group,[...values.values()]]));
 return (row,random=Math.random)=>{
  const pool=pools.get(key(row));if(!pool)return;
  const seen=new Set([row.answer,...(row.acceptedAnswers||[])].map(readingKey)),options=[row.answer],indices=new Map();let remaining=pool.length;
  while(remaining&&options.length<4){
   const pick=Math.floor(random()*remaining),index=indices.get(pick)??pick;remaining--;
   indices.set(pick,indices.get(remaining)??remaining);
   const text=pool[index],fold=readingKey(text);if(!seen.has(fold)){options.push(text);seen.add(fold);}
  }
  return options.length>=3?{...row,options}:undefined;
 };
}
/** Use verified reading answers as distractors; never mark an accepted variant wrong. */
export function createReadingChoices(rows,words,locale='en',spellings=indexJapaneseSpellings(words)){
 const byId=new Map(words.map(word=>[word.id,word])),sample=createReadingChoiceSampler(rows,words),result=[];
 const eligible=readingRows(rows);
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
  const choice=sample(row);if(!choice)continue;
  const instruction=row.category==='onyomi'||row.category==='kunyomi'?(locale==='ko'?`이 한자의 사전에 실린 ${row.category==='onyomi'?'음독':'훈독'}을 선택하세요.`:`Choose a dictionary-listed ${row.category==='onyomi'?'on’yomi':'kun’yomi'} of this character.`):(row.category==='reading'?(locale==='ko'?'밑줄 친 단어의 읽기를 선택하세요.':'Choose the reading of the underlined word.'):(locale==='ko'?'표시된 빈칸이나 단어에 해당하는 읽기를 선택하세요.':'Choose the reading for the displayed word or blank.'));
  result.push({...choice,id:row.id+'-choice',route:'vocabmeaning',instruction});
 }
 return result;
}
