import {collectEnglishTranslationForms,collectKoreanTranslationForms,acceptsKoreanPredicateSuffix,koreanParticles} from './translation-forms.js';
const letters=/[\p{L}\p{M}\p{N}_]/u,hangul=/[가-힣]/u;
const segmenter=new Intl.Segmenter('und',{granularity:'grapheme'});
const escapePattern=text=>text.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&').replace(/\s+/gu,'\\s+');
function prepareTranslation(text){
 let normalized='',boundaries=new Map([[0,0]]);
 for(const part of segmenter.segment(text)){const value=part.segment.normalize('NFC');boundaries.set(normalized.length,part.index);normalized+=value;boundaries.set(normalized.length,part.index+part.segment.length);}
 return {text:normalized,boundaries};
}
function validateExplicitFocus(text,focus,locale,boundaries){
 const selected=focus&&typeof focus==='object'&&!Array.isArray(focus)&&!Object.hasOwn(focus,'start')?focus[locale]:focus;
 const rows=Array.isArray(selected)?selected:[selected],result=[];
 if(!rows.length||rows.length>16)return [];
 const originalBoundaries=new Set(boundaries.values());
 for(const row of rows){if(!row||row.locale&&row.locale!==locale||!Number.isInteger(row.start)||row.start<0||typeof row.text!=='string'||!row.text||text.slice(row.start,row.start+row.text.length)!==row.text||!originalBoundaries.has(row.start)||!originalBoundaries.has(row.start+row.text.length))return [];result.push({start:row.start,text:row.text});}
 result.sort((a,b)=>a.start-b.start);return result.some((row,i)=>i&&row.start<result[i-1].start+result[i-1].text.length)?[]:result;
}
export function collectTranslationTerms(word,locale){
 let source=typeof word?.studyMeaning==='string'&&(!word.studyExplanationLanguage||word.studyExplanationLanguage===locale)?word.studyMeaning:locale==='en'?word?.meaning_en??word?.meaningEn:word?.meaning_ko??word?.meaningKo;
 const values=Array.isArray(source)?source:[source],terms=[];
 for(const value of values)if(typeof value==='string')for(let term of value.split(/[;；]/u)){
  for(let i=0;i<3;i++)term=term.replace(/\([^()]*\)|（[^（）]*）/gu,' ');
  term=term.normalize('NFC').trim().replace(/\s+/gu,' ').replace(/[.。]$/u,'');
  if(locale==='en')term=term.replace(/^(?:to|an?|the)\s+/iu,'');
  if(term&&term.length<=80&&!/[~…]/u.test(term))terms.push(term);
 }
 return [...new Set(terms)].slice(0,24);
}
function findMatches(prepared,form,locale){
 const text=prepared.text,result=[],pattern=new RegExp(escapePattern(form.text),'giu');
 for(const match of text.matchAll(pattern)){
  let start=match.index,end=start+match[0].length;
  if(letters.test(text[start-1]||''))continue;
  if(locale==='en'){
   if(letters.test(text[end]||''))continue;
   const first=match[0][0],capitalized=first!==first.toLowerCase();
   if(form.avoidCapitalized&&capitalized&&start!==0&&!/[.!?]["'”’)]*\s*$/u.test(text.slice(0,start)))continue;
  }
  else{
   let tail=end;while(hangul.test(text[tail]||''))tail++;
   const suffix=text.slice(end,tail);
   if(form.predicate){if(!acceptsKoreanPredicateSuffix(match[0],suffix,text.slice(start,tail),form))continue;end=tail;}
   else if(!koreanParticles.test(suffix))continue;
   if(letters.test(text[tail]||''))continue;
  }
  const originalStart=prepared.boundaries.get(start),originalEnd=prepared.boundaries.get(end);
  if(originalStart!==undefined&&originalEnd!==undefined)result.push({start:originalStart,end:originalEnd});
 }
 return result;
}
/** Conservative lexical alignment; absent/ambiguous paraphrases deliberately stay unmarked. */
export function findTranslationFocus({text,word,locale,studyLanguage,focus}){
 if(typeof text!=='string'||!text||text.length>10000||!['en','ko'].includes(locale)||studyLanguage==='en'&&locale==='en')return [];
 const prepared=prepareTranslation(text);
 if(focus!==undefined)return validateExplicitFocus(text,focus,locale,prepared.boundaries);
 const pos=String(word?.pos||word?.partOfSpeech||'').toLowerCase(),matches=[];
 for(const term of collectTranslationTerms(word,locale)){
  const forms=locale==='en'?collectEnglishTranslationForms(term,pos).map(text=>({text,predicate:false,avoidCapitalized:/verb|adjective|^v$|^a$/u.test(pos)&&term[0]===term[0].toLowerCase()})):collectKoreanTranslationForms(term,pos);
  for(const form of forms)matches.push(...findMatches(prepared,form,locale));
 }
 const unique=[...new Map(matches.map(row=>[row.start+':'+row.end,row])).values()];
 // Several forms may identify the same inflected token; retain its maximal span.
 const maximal=unique.filter(row=>!unique.some(other=>other!==row&&other.start<=row.start&&other.end>=row.end&&(other.start<row.start||other.end>row.end)));
 if(maximal.length!==1)return [];
 return maximal.map(row=>({start:row.start,text:text.slice(row.start,row.end)}));
}
