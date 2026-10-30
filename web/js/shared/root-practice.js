import {learnerOriginLabel} from './root-references.js';
const key=value=>String(value||'').normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/gu,' ');
/** Meaning retrieval within a documented family; never infer a modern meaning from a prefix. */
export function createRootPractice(study,words){
 if(study?.targetLanguage!=='en')return [];
 const byId=new Map(words.map(word=>[word.id,word])),ko=study.explanationLanguage==='ko',rows=[];
 const families=(study.families||[]).map(row=>({...row,term:row.root,language:row.origin||'la'}));
 for(const family of families){
  const members=family.members.map(row=>byId.get(row.entryId)).filter(word=>word?.studyMeaning),hint=`${learnerOriginLabel(family.language,study.explanationLanguage)} · ${family.term}${family.meaning?` — ${family.meaning}`:''}`;
  for(const word of members){
   if(key(hint).includes(key(word.lemma)))continue;
   const sameType=members.filter(other=>(other.subtype||other.pos)===(word.subtype||word.pos));
   const equivalent=sameType.filter(other=>key(other.studyMeaning)===key(word.studyMeaning)).map(other=>other.lemma);
   const base={entryId:word.id,category:'roots',rootFamilyId:family.id,prompt:`${hint}\n${word.studyMeaning}`,answer:word.lemma,acceptedAnswers:[...new Set(equivalent)],
    instruction:ko?'어근·접사와 표시된 뜻에 맞는 단어를 입력하세요.':'Type the word matching the meaning, using the root or affix clue.',
    explanation:`${word.lemma} — ${word.studyMeaning}\n${hint}\n${ko?'같은 계열의 단어':'Related words'}: ${[...new Set(members.map(item=>item.lemma))].join(' · ')}`};
   rows.push({...base,id:`root-${family.id}-${word.id}-input`,route:'vocabinput'});
   const seen=new Set(equivalent.map(key)),meanings=new Set([key(word.studyMeaning)]),options=[word.lemma];
   for(const other of sameType){if(seen.has(key(other.lemma))||meanings.has(key(other.studyMeaning)))continue;options.push(other.lemma);seen.add(key(other.lemma));meanings.add(key(other.studyMeaning));if(options.length===4)break;}
   if(options.length>=2)rows.push({...base,id:`root-${family.id}-${word.id}-choice`,route:'vocabmeaning',options,instruction:ko?'같은 어원 계열에서 표시된 뜻에 맞는 단어를 선택하세요.':'Choose the word in this family that matches the displayed meaning.'});
  }
 }
 return rows;
}
