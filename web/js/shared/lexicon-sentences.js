import {shuffle,vocabularyType} from './vocabulary.js';
const letter=/[\p{L}\p{M}\p{N}]/u;
export function sentenceTiles(text,language){
 const segmenter=new Intl.Segmenter(language,{granularity:'word'}),tiles=[];
 for(const part of segmenter.segment(text.normalize('NFC'))){
  if(part.isWordLike)tiles.push(part.segment);
  else for(const character of part.segment)if(!/\s/u.test(character))tiles.push(character);
 }
 return tiles;
}
export function joinSentenceTiles(tiles,language){
 if(['ja','zh'].includes(language))return tiles.join('');
 // German low opening quotes pair with high closing quotes; English high
 // opening quotes remain supported when that typography is used instead.
 const lowQuotes=language==='de'&&tiles.some(tile=>/[„‚]/u.test(tile));
 const closing=lowQuotes?/^[.,!?;:%)\]}»”’“‘，。]$/u:/^[.,!?;:%)\]}»”’，。]$/u;
 const opening=lowQuotes?/[([{«„‚]$/u:/[([{«“‘]$/u;
 let result='';
 for(const tile of tiles){const tight=closing.test(tile)||opening.test(result);result+=(result&&!tight?' ':'')+tile;}
 return result;
}
export function findSentenceFocus(word,example,language){
 const text=example.text.normalize('NFC'),explicit=example.focus?.text;
 if(explicit){const start=example.focus.start??text.indexOf(explicit);if(example.focus.start===undefined&&text.indexOf(explicit,start+explicit.length)>=0)return null;return Number.isInteger(start)&&start>=0&&text.slice(start,start+explicit.length)===explicit?{start,text:explicit}:null;}
 const lemma=word.lemma.normalize('NFC');
 if(['ja','zh'].includes(language)){
  const matches=[...new Intl.Segmenter(language,{granularity:'word'}).segment(text)].filter(part=>part.segment===lemma);
  return matches.length===1?{start:matches[0].index,text:matches[0].segment}:null;
 }
 const folded=text.toLocaleLowerCase(language),wanted=lemma.toLocaleLowerCase(language),matches=[];
 for(let start=folded.indexOf(wanted);start>=0;start=folded.indexOf(wanted,start+1)){
  const end=start+lemma.length,before=start?text[start-1]:'',after=text[end]||'';
  const koreanSuffix=language==='ko'&&/^(?:은|는|이|가|을|를|에|에서|에게|한테|께|로|으로|와|과|의|도|만|부터|까지|보다|처럼|이라도|라도|이나|나|이며|이고|이다|입니다|이었다|였다)(?=$|[^\p{L}\p{M}\p{N}])/u.test(text.slice(end));
  if(!letter.test(before)&&(!letter.test(after)||koreanSuffix))matches.push({start,text:text.slice(start,end)});
 }
 const exact=matches.filter(match=>match.text===lemma);return exact.length===1?exact[0]:matches.length===1?matches[0]:null;
}
export function createSentenceEngine(profile){
 function createSentencePool(mode,words,locale='en'){
  if(!['cloze','scramble'].includes(mode))return {all:()=>[],choose:()=>undefined};
  const rows=words.flatMap(word=>(word.examples||[]).flatMap((example,i)=>{
   if(example.practiceEligible===false||!example.text?.trim()||!example.studyTranslation?.trim())return [];
   const sentence=example.text.normalize('NFC'),id=word.id+':'+i+':'+locale;
   if(mode==='cloze'){
    if(example.clozeEligible===false)return [];
    const focus=findSentenceFocus(word,example,profile.id);if(!focus)return [];
    return [{mode,id,word,locale,example,sentence,focus,answer:focus.text,type:vocabularyType(word)}];
   }
   const tokens=sentenceTiles(sentence,profile.id);return tokens.length>1?[{mode,id,word,locale,example,sentence,tokens,answer:sentence}]:[];
  }));
  const groups=new Map(),wordGroups=new Map();if(mode==='cloze'){for(const row of rows){if(row.answer.toLocaleLowerCase(profile.id)===row.word.lemma.toLocaleLowerCase(profile.id))continue;if(!groups.has(row.type))groups.set(row.type,[]);groups.get(row.type).push(row);}for(const word of words){const type=vocabularyType(word);if(!wordGroups.has(type))wordGroups.set(type,[]);wordGroups.get(type).push(word);}}
  function build(row,random){
   if(mode==='scramble'){
    let pool=shuffle(row.tokens.map((_,index)=>index),random);
    if(pool.every((id,index)=>row.tokens[id]===row.tokens[index]))pool=[...pool.slice(1),pool[0]];
    return {...row,pool};
   }
   const literal=row.answer.toLocaleLowerCase(profile.id)===row.word.lemma.toLocaleLowerCase(profile.id);
   const group=literal?wordGroups.get(row.type):(groups.get(row.type)||[]);
   const options=[{id:row.word.id,text:row.answer,meaning:row.word.studyMeaning,type:row.type}],seen=new Set([row.answer]),start=Math.floor(random()*group.length);
   for(let i=0;i<group.length&&options.length<4;i++){
    const other=group[(start+i)%group.length],word=literal?other:other.word;let answer=literal?word.lemma:other.answer;if(literal&&row.focus.start===0&&row.answer[0]===row.answer[0].toLocaleUpperCase(profile.id))answer=answer[0].toLocaleUpperCase(profile.id)+answer.slice(1);if(word.id===row.word.id||word.lemma===row.word.lemma||seen.has(answer))continue;
    options.push({id:word.id,text:answer,meaning:word.studyMeaning,type:row.type});seen.add(answer);
   }
   return options.length>1?{...row,options:shuffle(options,random)}:null;
  }
  return {
   all(random=Math.random){return rows.map(row=>build(row,random)).filter(Boolean);},
   choose(previous,random=Math.random){const start=Math.floor(random()*rows.length);let old;for(let i=0;i<rows.length;i++){const row=rows[(start+i)%rows.length];if(row.id===previous){old=row;continue;}const question=build(row,random);if(question)return question;}return old?build(old,random)||undefined:undefined;},
  };
 }
 function sentenceAnswerCorrect(question,answer){
  if(question.mode==='cloze')return answer===question.word.id;
  return Array.isArray(answer)&&answer.length===question.tokens.length&&new Set(answer).size===answer.length&&answer.every((id,index)=>Number.isInteger(id)&&id>=0&&id<question.tokens.length&&question.tokens[id]===question.tokens[index]);
 }
 return {createSentencePool,sentenceQuestions:(mode,words,locale)=>createSentencePool(mode,words,locale).all(),sentenceAnswerCorrect};
}
