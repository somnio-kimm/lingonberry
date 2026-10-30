import {escapeHtml as e} from './ui.js';
import {normaliseKana} from './japanese-reading.js';
const han=/[\p{Script=Han}々]/u,kana=/^[ぁ-ゖー]+$/u;
/** Align known whole-word readings to kana anchors; never assign a reading to each kanji by guess. */
export function renderJapaneseRuby(text,reading){
 text=String(text);reading=normaliseKana(reading);if(!han.test(text)||!kana.test(reading))return e(text);
 const parts=text.match(/[\p{Script=Han}々]+|[ぁ-ゖァ-ヶー]+|./gu)||[],memo=new Map();
 function align(index,at){
  const key=index+':'+at;if(memo.has(key))return memo.get(key);
  if(index===parts.length)return at===reading.length?[[]]:[];
  const part=parts[index],result=[];
  if(han.test(part)){
   for(let end=at+1;end<=reading.length&&result.length<2;end++)for(const tail of align(index+1,end)){result.push([{text:part,reading:reading.slice(at,end)},...tail]);if(result.length===2)break;}
  }else{const literal=normaliseKana(part);if(reading.startsWith(literal,at))for(const tail of align(index+1,at+literal.length))result.push([{text:part},...tail]);}
  memo.set(key,result);return result;
 }
 const matches=align(0,0),ruby=(word,sound)=>`<ruby>${e(word)}<rt>${e(sound)}</rt></ruby>`;
 return matches.length===1?matches[0].map(part=>part.reading?ruby(part.text,part.reading):e(part.text)).join(''):ruby(text,reading);
}
/** Polite written forms use the dictionary's verified negative paradigm to identify the stem. */
function politeStem(word,groups){
 const text=word.lemma,reading=normaliseKana(word.pronunciation),negative=groups.find(group=>group.formKind==='negative')?.answers||[];
 if(!negative.length||!kana.test(reading))return;
 if(text.endsWith('する')&&reading.endsWith('する'))return [text.slice(0,-2)+'し',reading.slice(0,-2)+'し'];
 if(text.endsWith('来る')&&reading.endsWith('くる'))return [text.slice(0,-1),reading.slice(0,-2)+'き'];
 const stem=text.slice(0,-1),sound=reading.slice(0,-1),last=text.at(-1);
 if(last==='る'&&negative.includes(stem+'ない')&&negative.includes(sound+'ない'))return [stem,sound];
 const a={う:'わ',く:'か',ぐ:'が',す:'さ',つ:'た',ぬ:'な',ぶ:'ば',む:'ま',る:'ら'},i={う:'い',く:'き',ぐ:'ぎ',す:'し',つ:'ち',ぬ:'に',ぶ:'び',む:'み',る:'り'};
 if(i[last]&&reading.at(-1)===last&&negative.includes(stem+a[last]+'ない'))return [stem+i[last],sound+i[last]];
}
/** Index installed lexical readings/forms once. Unknown and ambiguous non-anchor words stay plain. */
export function createJapaneseFurigana(words,data={},policy={}){
 const index=new Map(),byId=new Map(words.map(word=>[word.id,word])),excluded=new Set(policy.excludedSpellings||[]),ambiguousIds=new Set([...(policy.variants||[]).filter(row=>row.readings.length>1).map(row=>row.entryId),...words.filter(word=>excluded.has(word.lemma)).map(word=>word.id)]),cache=new Map(),segmenter=new Intl.Segmenter('ja',{granularity:'word'});
 function add(text,reading,id){reading=normaliseKana(reading);if(!text||!han.test(text)||!kana.test(reading))return;const rows=index.get(text)||[];if(!rows.some(row=>row.id===id&&row.reading===reading))rows.push({reading,id});index.set(text,rows);}
 for(const word of words)add(word.lemma,word.pronunciation,word.id);
 for(const row of data.forms||[]){const word=byId.get(row.entryId);if(!word)continue;
  for(const group of row.groups){const readings=group.answers.filter(value=>kana.test(normaliseKana(value)));for(const text of group.answers.filter(value=>han.test(value)))for(const reading of readings)add(text,reading,word.id);}
  const stem=politeStem(word,row.groups);if(stem)for(const ending of ['ます','ました','ません','ませんでした','ましょう'])add(stem[0]+ending,stem[1]+ending,word.id);
 }
 function resolve(text,anchor){const rows=index.get(text)||[],preferred=rows.filter(row=>row.id===anchor?.id);if(!preferred.length&&(excluded.has(text)||rows.some(row=>ambiguousIds.has(row.id))))return;const readings=[...new Set((preferred.length?preferred:rows).map(row=>row.reading))];return readings.length===1?readings[0]:undefined;}
 function renderWord(text,reading){const key=text+'\0'+reading;if(!cache.has(key))cache.set(key,renderJapaneseRuby(text,reading));return cache.get(key);}
 function renderSentence(text,anchor){
  const tokens=[...segmenter.segment(text)],html=[];
  for(let start=0;start<tokens.length;){let chosen,spelling='';
   if(tokens[start].isWordLike)for(let end=start;end<Math.min(tokens.length,start+12)&&tokens[end].isWordLike;end++){spelling+=tokens[end].segment;const reading=resolve(spelling,anchor);if(reading)chosen={end,text:spelling,reading};}
   if(chosen){html.push(renderWord(chosen.text,chosen.reading));start=chosen.end+1;}else html.push(e(tokens[start++].segment));
  }
  return html.join('');
 }
 return {renderQuestion(question){const text=question.answer;return question.kind==='word'?renderWord(text,question.word.pronunciation||byId.get(question.word.id)?.pronunciation):renderSentence(text,question.word);},renderSentence};
}
