import {findAdjectiveFocusPatterns,pickAdjectiveFocusOption} from './adjective-forms.js';
import {findSentenceFocus} from '../../../../js/shared/lexicon-sentences.js';
import {nounPhraseAlternatives,formAlternatives} from './form-alternatives.js';
import { wordType } from './dictionary.js';
import { shuffleWords } from './words.js';
export const normalizeSentence=text=>String(text).normalize('NFC').trim().replace(/\s+/gu,' ');
export const sentenceTokens=text=>normalizeSentence(text).match(/[^\s.,，。]+|[.,，。]/gu)||[];
const wordCharacter=/[\p{L}\p{M}\p{N}]/u;
const standaloneInflections=['plural','comparative','superlative'];
function values(value,path=[]) {
 if(typeof value==='string')return [{text:value,path}];
 if(Array.isArray(value))return value.flatMap((v,i)=>values(v,[...path,i]));
 if(value&&typeof value==='object')return Object.entries(value).flatMap(([key,v])=>values(v,[...path,key]));
 return [];
}
function formText(value,kind) {
 if(kind==='declension')return value.replace(/^(der|die|das|den|dem|des)\s+/u,'');
 if(kind==='forms')return value.replace(/^(hat|ist)\s+/u,'');
 return value;
}
function forms(word) {
 const result=[{text:word.lemma,kind:'lemma',path:[]}];
 for(const kind of standaloneInflections)formAlternatives(word[kind]).forEach((text,alternativeIndex)=>result.push({text,kind,path:[],alternativeIndex}));
 for(const kind of ['forms','declension','pronoun_forms','article_forms','attested_forms']){
  for(const form of values(word[kind])){
   const alternatives=kind==='declension'?nounPhraseAlternatives(form.text,{allowBare:word.article_optional===true}):formAlternatives(form.text);
   alternatives.forEach((value,alternativeIndex)=>{
    const text=formText(value,kind);result.push({...form,text,kind,alternativeIndex});
    if(kind==='forms'&&text.includes(' '))result.push({...form,text:text.split(' ')[0],kind,alternativeIndex,firstToken:true});
   });
  }
 }
 return result.filter(f=>f.text&&f.text!=='—');
}
function findSpan(sentence,form) {
 // Literal lookup avoids compiling thousands of one-off Unicode regexes.
 const find=(text,initialOnly=false)=>{
  for(let start=sentence.indexOf(text);start>=0;start=sentence.indexOf(text,start+1)){
   const before=start?[...sentence.slice(0,start)].at(-1):'',after=String.fromCodePoint(sentence.codePointAt(start+text.length)||0);
   if(wordCharacter.test(before)||wordCharacter.test(after))continue;
   if(initialOnly&&start!==0&&!/[.!?]["'»”]?$/u.test(sentence.slice(0,start).trimEnd()))continue;
   return {start,text};
  }
  return null;
 };
 const exact=find(form);if(exact)return exact;
 // Sentence-initial capitalization is permitted after punctuation as well.
 const initial=form[0]?.toLocaleUpperCase('de')+form.slice(1);
 if(initial!==form){
  return find(initial,true);
 }
 return null;
}
export function clozeQuestions(words) {
 return words.flatMap(word=>(word.examples||[]).flatMap((example,i)=>{
  const sentence=normalizeSentence(example.de),declared=forms(word);
  if(example.focus!==undefined){
   if(typeof example.focus?.text!=='string'||!example.focus.text.trim())return [];
   const focus=findSentenceFocus(word,{text:sentence,focus:example.focus},'de');if(!focus)return [];
   let form=declared.find(form=>form.text===focus.text)||{text:focus.text,kind:'focus',path:[]};
   if(word.pos==='adjective')form={...form,adjectivePatterns:findAdjectiveFocusPatterns(word,focus.text)};
   return [{id:word.id+':'+i+':'+focus.start,word,example:{...example,de:sentence},answer:focus.text,start:focus.start,form}];
  }
  for(const form of declared){
   const span=findSpan(sentence,form.text);
   if(span)return [{id:word.id+':'+i+':'+span.start,word,example:{...example,de:sentence},answer:span.text,start:span.start,form}];
  }
  return [];
 }));
}
export function scrambleQuestions(words) {
 return words.flatMap(word=>(word.examples||[]).map((example,i)=>({id:word.id+':'+i,word,example:{...example,de:normalizeSentence(example.de)},tokens:sentenceTokens(example.de)}))).filter(q=>q.tokens.length>1);
}
function optionForm(word,question) {
 const form=question.form;let text;
 if(form.adjectivePatterns){
  text=pickAdjectiveFocusOption(word,form.adjectivePatterns);if(!text)return null;
  const initial=question.start===0||question.answer[0]!==question.answer[0].toLocaleLowerCase('de')&&question.word.lemma[0]===question.word.lemma[0].toLocaleLowerCase('de');
  return initial?text[0].toLocaleUpperCase('de')+text.slice(1):text;
 }
 if(form.kind==='lemma')text=word.lemma;
 else if(standaloneInflections.includes(form.kind)){
  const alternatives=formAlternatives(word[form.kind]).filter(text=>text!=='—');
  text=alternatives[form.alternativeIndex||0]||alternatives[0];if(!text)return null;
 }
 else{let value=word[form.kind];for(const part of form.path)value=value?.[part];if(typeof value==='string')text=formText(form.kind==='declension'?(nounPhraseAlternatives(value,{allowBare:word.article_optional===true})[form.alternativeIndex||0]||nounPhraseAlternatives(value,{allowBare:word.article_optional===true})[0]||value):(formAlternatives(value)[form.alternativeIndex||0]||formAlternatives(value)[0]||value),form.kind);}
 text||=word.lemma;
 if(form.firstToken)text=text.split(' ')[0];
 if(text&&(question.start===0||question.answer!==form.text&&question.answer===form.text[0]?.toLocaleUpperCase('de')+form.text.slice(1)))text=text[0].toLocaleUpperCase('de')+text.slice(1);
 return text;
}
export function clozeOptions(question,words,random=Math.random) {
 const options=[{word:question.word,text:question.answer}],seen=new Set([question.answer]);
 const type=wordType(question.word),similar=words.filter(w=>type&&wordType(w)===type);
 for(const word of shuffleWords(similar,random)){
  if(word.lemma===question.word.lemma)continue;
  const text=optionForm(word,question);if(!text||seen.has(text))continue;seen.add(text);options.push({word,text});if(options.length===4)break;
 }
 return shuffleWords(options,random);
}
export const joinSentenceTokens=tokens=>normalizeSentence(tokens.join(' ')).replace(/\s+([.,，。])/gu,'$1');
export const scrambleCorrect=(question,tokens)=>{
 const expected=sentenceTokens(question.example.de),actual=tokens.flatMap(sentenceTokens);
 return actual.length===expected.length&&actual.every((token,index)=>token===expected[index]);
};
