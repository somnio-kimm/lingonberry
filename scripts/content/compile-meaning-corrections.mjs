import {createHash} from 'node:crypto';
import {validatePackage,validateExplanation} from '../../web/js/packages/schema.js';
import {compareContentVersions} from '../../web/js/shared/review-content.js';
import {assignEnglishLevel,ENGLISH_LEVELS} from '../../web/js/shared/english-levels.js';
import {prepareEnglishReview,reviewDigest,summariseEnglishReview} from './english-meaning-review.mjs';
import {assignIeltsTopics} from './ielts-topics.mjs';
import {prepareJapaneseReview,validateJapaneseDecisions} from './japanese-meaning-review.mjs';
import {validateExampleRecord} from './example-records.mjs';
const decisionsAllowed=new Set(['correct','replace','retain','retire']);
const partsOfSpeech=new Set(['noun','verb','adjective','adverb','pronoun','determiner','preposition','conjunction','interjection','numeral','particle','expression','classifier','prefix','suffix']);
const requireValue=(value,message)=>{if(!value)throw new Error('Invalid meaning correction: '+message);};
const text=(value,name)=>{requireValue(typeof value==='string'&&value.trim()&&value.length<=4000,name);return value.trim();};
export const decisionDigest=rows=>reviewDigest([...rows].sort((a,b)=>a.index-b.index));
function correctionSource(row){
 const sources=row.evidence.map(item=>item.source||item);
 return {kind:'licensed-adaptation',creator:'Lingonberry contributors',license:'CC-BY-SA-4.0',url:sources[0].url,method:'AI-assisted source adjudication and bilingual editorial correction',review:'source-checked; native-speaker-review-pending',sources};
}
export function compileMeaningCorrections({core,pairs,review,decisions,sourceValidation,version}){
 decisions=[...decisions].sort((a,b)=>a.index-b.index);
 const language=core.targetLanguage,isEnglish=language==='en',languageName=isEnglish?'English':'Japanese';
 requireValue(['en','ja'].includes(language),'supported study core');validatePackage(core);
 const levelFor=entry=>isEnglish?assignEnglishLevel(entry):entry.level;
 requireValue(compareContentVersions(version,core.version)>0,'new immutable version');
 const byLocale=new Map(pairs.map(pair=>[pair.explanationLanguage,pair]));
 requireValue(pairs.length===2&&byLocale.size===2&&byLocale.has('en')&&byLocale.has('ko'),'both English and Korean pairs');
 pairs.forEach(pair=>validateExplanation(core,pair));
 const originals=(isEnglish?prepareEnglishReview:prepareJapaneseReview)(core,byLocale.get('en'),byLocale.get('ko'));
 if(isEnglish)summariseEnglishReview(originals,review,{requireComplete:true});else validateJapaneseDecisions(originals,decisions);
 const findings=new Map((isEnglish?review.filter(row=>row.status!=='accepted'):decisions).map(row=>[row.id,row]));
 const originalsById=new Map(core.entries.map(row=>[row.id,row]));
 const edits=new Map();
 requireValue(sourceValidation?.checked===decisions.length&&sourceValidation?.failures?.length===0&&sourceValidation?.decisionDigest===decisionDigest(decisions),'matching successful source validation');
 for(const row of decisions){
  const finding=findings.get(row.id),original=originals[row.index];
  requireValue(finding&&original?.id===row.id&&original.digest===row.digest,'known unchanged finding '+row.id);
  requireValue(!edits.has(row.id),'duplicate decision '+row.id);requireValue(decisionsAllowed.has(row.decision),'resolved decision '+row.id);text(row.reason,'reason '+row.id);
  requireValue(Array.isArray(row.evidence)&&(row.evidence.length>0||(!isEnglish&&row.decision==='retain')),'source evidence '+row.id);
  if(['correct','replace'].includes(row.decision)){
   text(row.en,'English meaning '+row.id);requireValue(/[A-Za-z]/u.test(row.en),'English meaning text '+row.id);text(row.ko,'Korean meaning '+row.id);requireValue(/[가-힣]/u.test(row.ko),'Korean script '+row.id);
   if(row.word!==undefined)requireValue(text(row.word,'word').length<=200,'word length');
   if(row.pos!==undefined)requireValue(partsOfSpeech.has(row.pos),'part of speech '+row.id);
  }
  if(!isEnglish&&(row.decision==='replace'||(row.word&&row.word!==original.word)))text(row.pronunciation,'explicit replacement reading '+row.id);
  if(row.pronunciation!==undefined)text(row.pronunciation,'pronunciation '+row.id);
  if(row.example!==undefined){for(const field of ['text','en','ko'])text(row.example[field],'bilingual example '+field+' '+row.id);requireValue(/[가-힣]/u.test(row.example.ko),'Korean example '+row.id);validateExampleRecord({id:row.id,...row.example,provenance:{kind:'app-authored',license:'CC-BY-4.0'}},originalsById.get(row.id),language);}
  if(row.aliases!==undefined)requireValue(Array.isArray(row.aliases)&&row.aliases.length<=100&&row.aliases.every(value=>typeof value==='string'&&value.trim()&&value.length<=200),'aliases');
  if(row.decision==='retire'&&row.aliases?.length)requireValue(!!row.duplicateOf,'retired spelling aliases need an equivalent target');
  if(row.duplicateOf!==undefined)requireValue(row.decision==='retire'&&row.duplicateOf!==row.id&&originalsById.has(row.duplicateOf),'duplicate target '+row.id);
  if(row.decision==='replace')requireValue((!originalsById.get(row.id).example||!!row.example)&&!originalsById.get(row.id).additionalExamples?.length,'replacement examples need explicit re-authoring '+row.id);
  edits.set(row.id,row);
 }
 requireValue(edits.size===findings.size,'all findings resolved');
 const replacementIds=new Map();
 for(const row of decisions)if(row.decision==='replace')replacementIds.set(row.id,language+'-lex-'+createHash('sha256').update(row.id+'\n'+reviewDigest({word:row.word||originalsById.get(row.id).word,pos:row.pos||originalsById.get(row.id).partOfSpeech,en:row.en,ko:row.ko})).digest('hex').slice(0,20));
 const counts={retain:0,correct:0,replace:0,retire:0};decisions.forEach(row=>counts[row.decision]++);
 const entries=[],entryEdits=new Map(),invalidations=new Map((core.reviewInvalidations||[]).map(row=>[row.id,row.minimumVersion]));
 for(const original of core.entries){
  const edit=edits.get(original.id);
  if(!edit||edit.decision==='retain'){entries.push({...original,level:levelFor(original)});continue;}
  invalidations.set(original.id,version);
  if(edit.decision==='retire')continue;
  const source=correctionSource(edit),entry={...original,id:replacementIds.get(original.id)||original.id,word:edit.word||original.word,partOfSpeech:edit.pos||original.partOfSpeech,level:levelFor(original)};
  const lexical=edit.evidence.find(item=>item.license==='CC-BY-SA-4.0'&&item.sourceRowDigest);
  entry.grammar={...original.grammar};delete entry.grammar.senseAlignment;
  if(lexical)entry.grammar.lexicalSource={creator:lexical.creator,license:lexical.license,url:lexical.url,history:lexical.historyUrl,sourceRowDigest:lexical.sourceRowDigest,senseOrdinal:lexical.senseOrdinal};
  if(edit.decision==='replace'||entry.word!==original.word||entry.partOfSpeech!==original.partOfSpeech||(!isEnglish&&edit.pronunciation&&edit.pronunciation!==original.pronunciation)){delete entry.referenceExamples;if(isEnglish||edit.decision==='replace'||entry.word!==original.word)delete entry.pronunciation;delete entry.grammar.usageTags;delete entry.grammar.acceptedArticles;}
  if(edit.decision==='replace'||entry.word!==original.word)delete entry.aliases;
  if(edit.aliases)entry.aliases=[...edit.aliases];
  if(edit.retainOldSpellingAlias&&entry.word!==original.word)entry.aliases=[...new Set([...(entry.aliases||[]),original.word])];
  if(edit.pronunciation!==undefined)entry.pronunciation=edit.pronunciation;
  if(edit.example){entry.example={text:edit.example.text,source:{kind:'app-authored',creator:'Lingonberry contributors',license:'CC-BY-4.0',review:'AI-assisted-editorial-correction; native-speaker-review-pending'}};if(edit.example.focus)entry.example.focus=edit.example.focus;delete entry.exampleStatus;}
  if(isEnglish)entry.tags=assignIeltsTopics({word:entry.word,meaning:edit.en}).filter(tag=>tag.startsWith('topic:'));
  entry.provenance=source;
  entry.editorialCorrection={reason:edit.reason,reviewDigest:edit.digest,decision:edit.decision,...(edit.decision==='replace'?{replaces:original.id}:{}),license:'CC-BY-SA-4.0'};
  entries.push(entry);entryEdits.set(entry.id,{edit,originalId:original.id});
 }
 const activeIds=new Set(entries.map(row=>row.id));requireValue(activeIds.size===entries.length,'unique resulting IDs');
 function replacementFor(id,seen=new Set()){
  requireValue(!seen.has(id),'cyclic duplicate retirement');seen.add(id);
  if(replacementIds.has(id))return replacementIds.get(id);
  const edit=edits.get(id);if(edit?.decision==='retire')return edit.duplicateOf?replacementFor(edit.duplicateOf,seen):undefined;
  return activeIds.has(id)?id:undefined;
 }
 function sameConceptTarget(id,seen=new Set()){
  if(seen.has(id))return false;seen.add(id);const edit=edits.get(id);
  if(edit?.decision==='replace')return false;
  if(edit?.decision==='retire')return !!edit.duplicateOf&&sameConceptTarget(edit.duplicateOf,seen);
  return activeIds.has(id);
 }
 const retired=(core.retiredEntries||[]).map(row=>{const replacementId=row.replacementId?replacementFor(row.replacementId):undefined;return {id:row.id,reason:row.reason,...(replacementId?{replacementId,...(row.sameConcept&&sameConceptTarget(row.replacementId)?{sameConcept:true}:{})}:{})};});
 for(const row of decisions.filter(row=>['replace','retire'].includes(row.decision))){const replacementId=replacementFor(row.id);retired.push({id:row.id,...(replacementId?{replacementId,...(row.decision==='retire'&&row.duplicateOf&&sameConceptTarget(row.duplicateOf)?{sameConcept:true}:{})}:{}),reason:row.reason});}
 const aliasMerges=[];
 for(const row of decisions.filter(row=>row.decision==='retire'&&row.aliases?.length)){
  const targetId=replacementFor(row.duplicateOf);requireValue(targetId&&sameConceptTarget(row.duplicateOf),'equivalent alias target');
  const target=entries.find(entry=>entry.id===targetId),added=row.aliases.filter(alias=>alias!==target.word&&!(target.aliases||[]).includes(alias));
  if(added.length){target.aliases=[...new Set([...(target.aliases||[]),...added])];target.aliasCorrections=[...(target.aliasCorrections||[]),{aliases:added,reason:row.reason,provenance:correctionSource(row)}];invalidations.set(targetId,version);aliasMerges.push({from:row.id,to:targetId,aliases:added});}
 }
 const creators=[...new Set(decisions.flatMap(row=>row.evidence.map(item=>item.creator||item.source?.creator).filter(Boolean)))].sort();
 const notice=`Lingonberry ${languageName} meaning corrections, edition ${version}.\n\nEnglish and Korean definitions were adjudicated against licensed lexical sources and edited with AI assistance. This is not native-speaker certification. Corrections and new Korean translations adapted from Wiktionary/NIKL retain CC BY-SA 4.0 and per-entry source, history and snapshot references. Original source provenance remains preserved in the immutable earlier packages and correction ledger. Retired concepts do not transfer mastery to replacement entries. No audio or third-party quotations are imported.${!isEnglish?" Corrected original usage examples and translations are Lingonberry contributor text under CC BY 4.0; unchanged examples retain their earlier provenance.":""}\n\nSources credited in this correction edition: ${creators.join('; ')}. Wiktionary definition text retains CC BY-SA 4.0; NIKL source text retains CC BY-SA 2.0 KR. Article and contributor-history URLs, source snapshot identifiers and selected senses are retained in each correction record.\n\nEarlier source notices:\n\n${core.license.notice}`;
 const license={...core.license,notice,links:(core.license.links||[]).map(link=>link.title==='Unrestricted Content Downloads and Source Information'?{...link,url:'https://github.com/somnio-kimm/lingonberry/tree/main/language-packages'}:link)};
 const exam=isEnglish?{...core.exam,levels:[...ENGLISH_LEVELS],levelKind:'editorial-study-group',vocabularyMembership:'editorial'}:{...core.exam};if(isEnglish){delete exam.variants;delete exam.vocabularyTiers;}
 const updated={...core,version,exam,license,entries,retiredEntries:retired,reviewInvalidations:[...invalidations].map(([id,minimumVersion])=>({id,minimumVersion})),contentReview:{...core.contentReview,status:'source-adjudicated-meaning-corrections',nativeSpeakerReview:'pending',entries:entries.length,meaningReview:{sourceVersion:core.version,findings:isEnglish?findings.size:decisions.filter(row=>row.decision!=='retain').length,...counts},bilingualExamples:entries.filter(row=>row.example).length,examplesPending:entries.filter(row=>!row.example).length}};
 const explanations=pairs.map(pair=>{
  const old=new Map(pair.entries.map(row=>[row.id,row]));
  const translated=entries.map(entry=>{
   const change=entryEdits.get(entry.id);if(!change)return old.get(entry.id);
   const {edit,originalId}=change,row={...old.get(originalId),id:entry.id,meaning:pair.explanationLanguage==='en'?edit.en:edit.ko,provenance:correctionSource(edit),editorialCorrection:{reason:edit.reason,reviewDigest:edit.digest,decision:edit.decision}};
   delete row.meanings;
   if(edit.decision==='replace'){delete row.exampleTranslation;delete row.additionalExampleTranslations;delete row.exampleTranslationProvenance;}
   if(edit.example){row.exampleTranslation=edit.example[pair.explanationLanguage];row.exampleTranslationProvenance={kind:'app-authored',creator:'Lingonberry contributors',license:'CC-BY-4.0',review:'AI-assisted-editorial-correction; native-speaker-review-pending'};}
   return row;
  });
  return {...pair,version,studyVersion:version,license,entries:translated};
 });
 validatePackage(updated);explanations.forEach(pair=>validateExplanation(updated,pair));
 return {packages:[updated,...explanations],report:{sourceVersion:core.version,version,reviewed:originals.length,findings:isEnglish?findings.size:decisions.filter(row=>row.decision!=='retain').length,decisions:counts,entriesBefore:core.entries.length,entriesAfter:entries.length,aliasMerges,retired:retired.length,bilingualExamples:updated.contentReview.bilingualExamples,sourceValidationDigest:reviewDigest(sourceValidation),decisionDigest:decisionDigest(decisions),nativeSpeakerReview:'pending'}};
}
