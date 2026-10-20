import {createHash} from 'node:crypto';
import {ENGLISH_LEVELS} from '../../web/js/shared/english-levels.js';
export function appendEnglishWords(core,pairs,additions){
 const entries=new Set(core.entries.flatMap(row=>[row.word,...(row.aliases||[])]).map(word=>word.toLowerCase()));
 for(const row of additions.entries){
  if([row.word,...(row.aliases||[])].some(word=>entries.has(word.toLowerCase())))throw new Error(`Word already present: ${row.word}`);for(const word of [row.word,...(row.aliases||[])])entries.add(word.toLowerCase());
  const id=`en-editorial-${row.word}`,source={kind:'app-authored',creator:'Lingonberry contributors',license:'MIT',review:'AI-assisted authoring with bilingual editorial checks'};
  core.entries.push({id,word:row.word,partOfSpeech:row.partOfSpeech,...(row.aliases?.length?{aliases:row.aliases}:{}),level:ENGLISH_LEVELS[3],grammar:{studyTier:'precision'},tags:row.tags||['ielts:shared'],provenance:source,example:{text:row.example.text,source}});
  for(const pair of pairs){const locale=pair.explanationLanguage;pair.entries.push({id,meaning:row.meaning[locale],exampleTranslation:row.example[locale],provenance:source});}
  if(row.familyMember){const family=core.families.find(item=>item.id==='en-family-claudere');family.members.push({entryId:id,word:row.word,parts:row.familyMember.parts});for(const pair of pairs){const translated=pair.families.find(item=>item.id===family.id);translated.members.push({entryId:id,note:row.familyMember.note[pair.explanationLanguage]});}}
 }
 for(const update of additions.rootFamilyNoteUpdates||[])for(const pair of pairs){const member=pair.families.find(family=>family.id===update.familyId)?.members.find(member=>member.entryId===update.entryId);if(!member)throw new Error('Unknown root-family note target');member.note=update.note[pair.explanationLanguage];}

}
export function englishSenseBinding(core,pairs){
 const translations=Object.fromEntries(pairs.map(pair=>[pair.explanationLanguage,new Map(pair.entries.map(row=>[row.id,row.meaning]))]));
 return createHash('sha256').update(JSON.stringify(core.entries.map(row=>[row.id,row.word,row.partOfSpeech,translations.en.get(row.id),translations.ko.get(row.id)]))).digest('hex');
}
export function applyEnglishDifficulty(core,pairs,review){
 if(review.senseSha256!==englishSenseBinding(core,pairs))throw new Error('Difficulty review no longer matches the stored senses');
 const decisions=new Map(review.decisions.map(row=>[row.id,row]));
 if(decisions.size!==core.entries.length||decisions.size!==review.decisions.length)throw new Error('Incomplete or duplicate difficulty review');
 const counts=Object.fromEntries(ENGLISH_LEVELS.map(level=>[level,0])),lemmas=ENGLISH_LEVELS.map(()=>new Set());let moved=0;
 for(const row of core.entries){
  const decision=decisions.get(row.id);if(!decision||!Number.isInteger(decision.band)||decision.band<0||decision.band>3||typeof decision.reason!=='string'||!decision.reason.trim())throw new Error(`Invalid difficulty decision: ${row.id}`);
  const previous=row.level,level=ENGLISH_LEVELS[decision.band];row.level=level;
  row.grammar={...row.grammar,studyTier:['foundation','independent','advanced','precision'][decision.band],levelEvidence:{...row.grammar?.levelEvidence,basis:'editorial-per-sense-difficulty-review',reviewId:review.id,officialExamVocabulary:false,previousLevel:previous}};
  counts[level]++;lemmas[decision.band].add(row.word.toLocaleLowerCase('en'));if(previous!==level)moved++;
 }
 const distinctWords=Object.fromEntries(ENGLISH_LEVELS.map((level,index)=>[level,lemmas[index].size]));
 if(distinctWords[ENGLISH_LEVELS[3]]<1000)throw new Error('The highest band must contain at least 1000 distinct reviewed GRE-level words');
 return {counts,distinctWords,moved,reviewed:core.entries.length,reviewId:review.id,senseSha256:review.senseSha256};
}
