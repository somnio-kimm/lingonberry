import {normaliseKana,splitOkurigana,indexJapaneseSpellings} from './japanese-reading.js';
const readingKey=value=>normaliseKana(value).trim();
const readingRows=rows=>rows.filter(row=>row.route==='vocabinput'&&['reading','onyomi','kunyomi','okurigana'].includes(row.category));
const kana=/^[ぁ-ゖー]+$/u;
const readingTarget=(row,word)=>(row.readingFocus?.text||word?.lemma||'').normalize('NFC');
const hiraganaEnding=target=>/\p{Script=Han}/u.test(target)?target.match(/[ぁ-ゖー]+$/u)?.[0]||'':'';

function addPoolValue(pools,key,value){
 if(!pools.has(key))pools.set(key,new Map());
 pools.get(key).set(readingKey(value),value);
}

function drawOptions(pool,options,seen,random,readText=value=>value){
 const indices=new Map();let remaining=pool.length;
 while(remaining&&options.length<4){
  const pick=Math.floor(random()*remaining),index=indices.get(pick)??pick;remaining--;
  indices.set(pick,indices.get(remaining)??remaining);
  const text=readText(pool[index]),fold=readingKey(text);
  if(!seen.has(fold)){options.push(text);seen.add(fold);}
 }
}

/** Cache verified readings and prefixes once for the installed study. */
export function createReadingChoiceSampler(rows,words){
 const byId=new Map(words.map(word=>[word.id,word])),groups=new Map(),prefixes=new Map(),bySpelling=new Map();
 const key=row=>{
  if(['onyomi','kunyomi'].includes(row.category))return row.category;
  const word=byId.get(row.entryId);if(!word?.pos)return;
  return row.category+':'+word.pos+(word.pos==='functional'?':'+(word.subtype||''):'');
 };
 for(const row of readingRows(rows)){
  if(row.boundaryKind==='spelling')continue;
  const group=key(row);if(!group)continue;
  addPoolValue(groups,group,row.answer);
  if(row.category!=='reading')continue;
  const target=readingTarget(row,byId.get(row.entryId)),reading=readingKey(row.answer),ending=hiraganaEnding(target);
  if(!target||!kana.test(reading))continue;
  for(const answer of [row.answer,...(row.acceptedAnswers||[])])addPoolValue(bySpelling,target,answer);
  // Only split a reading when the visible kana actually match it.
  const prefix=ending&&reading.endsWith(ending)?reading.slice(0,-ending.length):
   /^[\p{Script=Han}々]+$/u.test(target)?reading:'';
  if(prefix)addPoolValue(prefixes,group,prefix);
 }
 const materialise=source=>new Map([...source].map(([group,values])=>[group,[...values.values()]]));
 const pools=materialise(groups),prefixPools=materialise(prefixes),endingPools=new Map();
 return (row,random=Math.random)=>{
  const group=key(row),pool=pools.get(group);if(!pool)return;
  const target=row.category==='reading'?readingTarget(row,byId.get(row.entryId)):'',ending=hiraganaEnding(target);
  const answer=ending?readingKey(row.answer):row.answer;
  const seen=new Set([answer,...(row.acceptedAnswers||[]),...(bySpelling.get(target)?.keys()||[])].map(readingKey)),options=[answer];
  if(ending){
   if(!kana.test(answer)||!answer.endsWith(ending)||answer.length<=ending.length)return;
   const endingKey=group+':'+ending;
   if(!endingPools.has(endingKey))endingPools.set(endingKey,pool.map(readingKey).filter(text=>kana.test(text)&&text.length>ending.length&&text.endsWith(ending)));
   drawOptions(endingPools.get(endingKey),options,seen,random);
   // Rare endings still get plausible distractors, without changing the answer.
   if(options.length<3)drawOptions(prefixPools.get(group)||[],options,seen,random,prefix=>prefix+ending);
  }else drawOptions(pool,options,seen,random);
  return options.length>=3?{...row,answer,options}:undefined;
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
