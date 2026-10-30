// Legacy exercise fixtures used to audit stored/source answers; excluded from the app bundle.
import {normaliseKana} from '../../web/js/shared/japanese-reading.js';
import {formKindLabel} from '../../web/js/shared/language-exercises.js';
const adjectiveLabels={adnominal:['Adnominal','관형형'],negative:['Negative','부정형'],past:['Past','과거형'],'past-negative':['Past Negative','과거 부정형'],te:['Te Form','て형'],conditional:['Conditional','조건형'],adverbial:['Adverbial','부사형']};
/** KANJIDIC dots mark written endings, hyphens mark bound readings. The input is the full reading. */
export const kanjiAnswer=reading=>normaliseKana(reading.replace(/[.\-]/gu,''));
export function createDictionaryExercises(study,words,{includeForms=true}={}){
 const data=study?.practiceData;if(data?.version!==1)return [];
 const ko=study.explanationLanguage==='ko',locale=ko?'ko':'en',byId=new Map(words.map(word=>[word.id,word])),result=[];
 if(study.targetLanguage==='ja'){
  const kanji=new Map((data.kanji||[]).map(row=>[row.literal,row]));
  for(const word of words)for(const literal of new Set([...word.lemma].filter(char=>/\p{Script=Han}/u.test(char)))){
   const readings=kanji.get(literal);if(!readings)continue;
   for(const [type,category] of [['on','onyomi'],['kun','kunyomi']]){
    const raw=readings[type],answers=[...new Set(raw.map(kanjiAnswer))];if(!answers.length)continue;
    const name=ko?(type==='on'?'음독':'훈독'):(type==='on'?'on’yomi':'kun’yomi');
    result.push({id:`${category}-${word.id}-${literal.codePointAt(0).toString(16)}`,entryId:word.id,route:'vocabinput',category,kanji:literal,prompt:literal,answer:answers[0],acceptedAnswers:answers.slice(1),
     instruction:ko?`이 한자의 사전에 실린 ${name} 중 하나를 입력하세요. 훈독은 오쿠리가나까지 포함한 전체 읽기를 입력하세요.`:`Type one dictionary-listed ${name} of this character. For kun’yomi, include the written kana ending in the full reading.`,
     context:ko?`관련 단어: ${word.lemma}. 여기서는 이 단어 속 읽기가 아니라 한자 자체의 읽기를 묻습니다.`:`Related word: ${word.lemma}. This asks for a character reading, which need not be the reading used in this word.`,
     explanation:`${literal}: ${raw.join(' / ')}\n${ko?'허용되는 입력':'Accepted answers'}: ${answers.join(' / ')}\n${ko?'점 뒤는 오쿠리가나, 붙임표는 접사로 쓰이는 읽기를 표시합니다. 입력할 때 점과 붙임표는 빼세요.':'A dot separates okurigana; a hyphen marks a bound reading. Omit dots and hyphens when typing.'}`});
   }
  }
  if(includeForms)for(const row of data.forms||[]){const word=byId.get(row.entryId);if(!word)continue;
   for(const group of row.groups){let name=group.formKind==='adjective'?adjectiveLabels[group.subKind][ko?1:0]:formKindLabel(group.formKind,locale),full=['causative','causative-passive'].includes(group.formKind);
    if(group.formKind==='conditional'||group.subKind==='conditional')name=group.answers.some(answer=>/なら(?:ば)?$/u.test(answer))?(ko?'なら 조건형':'Nara Conditional'):(ko?'ば 조건형':'Ba Conditional');
    const potential=group.formKind==='potential';
    result.push({id:`form-${row.entryId}-${group.formKind}${group.subKind?'-'+group.subKind:''}`,entryId:row.entryId,route:'forms',category:'forms',formKind:group.formKind,subKind:group.subKind,condition:name,prompt:`${word.lemma}（${word.pronunciation}）\n${name}`,context:word.studyMeaning,
     instruction:ko?`지정된 표준 보통체 형태를 입력하세요.${full?' 줄이지 않은 형태를 쓰세요.':''}${potential?' 1단 동사와 来る는 ら를 생략하지 마세요.':''}`:`Type the specified standard plain form.${full?' Use the full, uncontracted form.':''}${potential?' Retain ら for ichidan verbs and 来る.':''}`,answer:group.answers[0],acceptedAnswers:group.answers.slice(1),explanation:`${word.lemma} → ${group.answers.join(' / ')}\n${name}`});
   }
  }
 }
 return result;
}
