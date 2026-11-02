import {exampleDigest,resolveReviewGroup} from './reviewed-examples.mjs';
import {compileConcisePair} from './concise-translations.mjs';
import {validateExplanation} from '../../web/js/packages/schema.js';

const requireValue=(value,message)=>{if(!value)throw new Error('Invalid Korean meaning review: '+message);};
export function meaningStyleSourceDigest(row){const {sourceDigest,...source}=row;return exampleDigest(source);}
export function auditKoreanMeaningStyle({inputs,decisions,reviews,independentReviewRequired=true}){
 const source=new Map(),edits=new Map(),current=new Map();
 for(const row of inputs){requireValue(row.id&&!source.has(row.id)&&row.sourceDigest===meaningStyleSourceDigest(row),'unique bound source '+row.id);source.set(row.id,row);}
 const allowed=new Set(['id','sourceDigest','author','action','meaning','reason','assessment']);
 for(const row of decisions){
  const input=source.get(row.id);requireValue(input&&!edits.has(row.id)&&row.sourceDigest===input.sourceDigest,'known unchanged decision '+row.id);
  requireValue(Object.keys(row).every(key=>allowed.has(key))&&typeof row.author==='string'&&row.author.trim(),'decision fields/author '+row.id);
  requireValue(['retain','change','uncertain'].includes(row.action),'decision action '+row.id);
  requireValue(row.assessment===undefined||['editorial','screening'].includes(row.assessment),'assessment method '+row.id);
  requireValue(row.assessment!=='screening'||row.action==='retain','screening cannot approve edits '+row.id);
  if(row.action==='change')requireValue(typeof row.meaning==='string'&&row.meaning.trim()===row.meaning&&row.meaning!==input.ko&&row.meaning.length<=4000&&/[가-힣]/u.test(row.meaning)&&typeof row.reason==='string'&&row.reason.trim(),'explicit Korean equivalent and reason '+row.id);
  else requireValue(row.meaning===undefined||row.meaning===input.ko,'retained meaning cannot change '+row.id);
  edits.set(row.id,row);
 }
 let staleReviews=0;const groups=new Map();
 for(const row of reviews){
  requireValue(source.has(row.id)&&typeof row.reviewer==='string'&&row.reviewer.trim()&&['pass','revise','uncertain'].includes(row.verdict)&&Array.isArray(row.notes),'review record '+row.id);
  const decision=edits.get(row.id);requireValue(row.reviewer!==decision?.author,'independent reviewer '+row.id);
  if(decision?.action!=='change'||row.sourceDigest!==decision.sourceDigest||row.decisionDigest!==exampleDigest(decision)){staleReviews++;continue;}
  const key=JSON.stringify([row.id,row.reviewer]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);
 }
 for(const group of groups.values()){const row=resolveReviewGroup(group);if(!current.has(row.id))current.set(row.id,[]);current.get(row.id).push(row);}
 const missingIds=inputs.filter(row=>!edits.has(row.id)).map(row=>row.id),uncertainIds=decisions.filter(row=>row.action==='uncertain').map(row=>row.id),changes=decisions.filter(row=>row.action==='change'),unreviewedIds=[],findings=[];
 for(const row of changes){const evidence=current.get(row.id)||[];if(!evidence.length)unreviewedIds.push(row.id);else if(evidence.some(review=>review.verdict!=='pass'))findings.push(row.id);}
 const screenedRetained=decisions.filter(row=>row.assessment==='screening').length;
 return {target:inputs.length,assessed:edits.size,reviewed:edits.size-screenedRetained,screenedRetained,retained:decisions.filter(row=>row.action==='retain').length,changed:changes.length,independentReviewRequired,independentlyReviewedChanges:changes.length-unreviewedIds.length-findings.length,staleReviews,missingIds,uncertainIds,unreviewedIds:independentReviewRequired?unreviewedIds:[],findings,completeDecisionCoverage:!missingIds.length&&!uncertainIds.length&&(!independentReviewRequired||!unreviewedIds.length)&&!findings.length};
}
/** Data-only explanation edition: preserve words, examples, source credits and learner IDs. */
export function compileNaturalKoreanPair({core,english,pair,inputs,decisions,reviews,version,independentReviewRequired=true}){
 requireValue(core.targetLanguage==='ja'&&pair.id==='ja-ko'&&english.id==='ja-en','Japanese/Korean scope');validateExplanation(core,pair);validateExplanation(core,english);
 requireValue(inputs.length===core.entries.length,'full vocabulary scope');const ko=new Map(pair.entries.map(row=>[row.id,row])),en=new Map(english.entries.map(row=>[row.id,row]));
 for(const [index,row]of inputs.entries()){
  const word=core.entries[index],translation=ko.get(word.id);requireValue(row.index===index&&row.id===word.id&&row.word===word.word&&row.reading===(word.pronunciation??null)&&row.pos===word.partOfSpeech&&row.level===word.level&&row.en===en.get(word.id).meaning&&row.ko===translation.meaning&&row.example===word.example?.text&&row.exampleKo===translation.exampleTranslation,'stale package binding '+row.id);
 }
 const report=auditKoreanMeaningStyle({inputs,decisions,reviews,independentReviewRequired});requireValue(report.completeDecisionCoverage,'complete decisions and required current reviews');
 const byId=new Map(inputs.map(row=>[row.id,row]));const changes=decisions.filter(row=>row.action==='change').map(row=>({id:row.id,word:byId.get(row.id).word,before:byId.get(row.id).ko,meaning:row.meaning,method:'editorial-equivalent'}));
 const result=compileConcisePair(core,pair,changes,version);
 result.meaningPolicy='natural-concise-korean-equivalents';result.license={...pair.license,notice:'Lingonberry natural Korean equivalents for Japanese vocabulary. Everyday Korean words and concise phrases replace obscure, literary or incomplete source headwords while preserving the selected senses. Editorial adaptations by Lingonberry contributors retain CC BY-SA 4.0 and all earlier dictionary credits. Original meanings and source-bound decisions/reviews remain available in language-packages/sources/meaning-style/. Examples, sentence translations, lexical IDs and study cores are preserved. AI-assisted editorial review; native-speaker certification pending.\n\nEarlier source notices:\n\n'+pair.license.notice};
 validateExplanation(core,result);return {pair:result,report};
}
