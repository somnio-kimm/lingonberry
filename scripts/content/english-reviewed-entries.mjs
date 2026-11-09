import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {exampleDigest} from './reviewed-examples.mjs';
import {isEnglishReviewExcluded} from './supplemental-source-review.mjs';
import {resolveEnglishCanonicalId} from './english-review-identity.mjs';
import {ENGLISH_LEVELS} from '../../web/js/shared/english-levels.js';
import {ENGLISH_STUDY_POLICY_ID} from './english-study-relevance.mjs';

const authored={kind:'app-authored',creator:'Lingonberry contributors',license:'CC-BY-4.0'};
const text=value=>typeof value==='string'&&value.trim();
const unique=values=>[...new Set(values.filter(text))];
const copy=value=>structuredClone(value);
const active=row=>!row.mergeWith&&!isEnglishReviewExcluded(row);

export function englishDefinitionFieldsDigest(fields) {
 return exampleDigest(Object.fromEntries(['word','partOfSpeech','meaningEn','meaningKo'].map(key=>[key,fields[key]])));
}

function adaptationLicense(sources){
 const licenses=new Set();
 const visit=source=>{
  if(!source||typeof source!=='object')return;
  for(const name of ['license','adaptationLicense'])if(text(source[name]))licenses.add(source[name]);
  visit(source.source);for(const child of source.sources||[])visit(child);
 };
 sources.forEach(visit);
 const allowed=new Set(['MIT','CC-BY-4.0','CC-BY-SA-2.0-KR','CC-BY-SA-4.0','CC0-1.0']);
 for(const license of licenses)if(!allowed.has(license))throw new Error('Unreviewed definition licence: '+license);
 if(!licenses.size)throw new Error('Missing definition licence');
 // CC's compatibility terms permit these 2.0 KR adaptations under later BY-SA 4.0.
 return [...licenses].some(license=>license.startsWith('CC-BY-SA-'))?'CC-BY-SA-4.0':'CC-BY-4.0';
}

function findDefinitionSourceIssue(row){
 if(row.sourceVerification?.requiresDefinitionSourceCorrection&&!row.definitionSource){
  return 'Unapplied reviewed definition source correction';
 }
 if(row.definitionSource){
  if(row.definitionSourceFieldsDigest!==englishDefinitionFieldsDigest(row.reviewedFields)){
   return 'Stale reviewed definition source correction';
  }
  try{adaptationLicense([row.definitionSource]);}catch(error){return error.message;}
 }
 return null;
}

export function auditEnglishDefinitionSourceCorrections(reviews){
 const corrections=reviews.filter(row=>active(row)&&(row.definitionSource||row.sourceVerification?.requiresDefinitionSourceCorrection));
 const errors=corrections.flatMap(row=>{
  const error=findDefinitionSourceIssue(row);
  return error?[{id:row.id,error}]:[];
 });
 return {expected:corrections.length,resolved:corrections.length-errors.length,errors,complete:!errors.length};
}

function assertExampleSource(source,id){
 if(source.type==='quotation'||source.kind==='publication-quotation'||
    source.sourceExampleType&&source.sourceExampleType!=='example')throw new Error('Uncleared quotation or example type: '+id);
 try{adaptationLicense([source]);}catch(error){throw new Error(error.message+': '+id);}
 const translation=source.translationSource||source.translationAdaptation;
 if(translation)translateExampleSource(source,translation);
}

function translateExampleSource(source,explicit){
 const license=adaptationLicense([source]);
 if(explicit){
  adaptationLicense([explicit]);
  if(license==='CC-BY-SA-4.0'&&explicit.license!==license){
   throw new Error('Example translation must retain the source ShareAlike licence');
  }
  return copy(explicit);
 }
 return {kind:'licensed-adaptation',creator:authored.creator,license,source:copy(source)};
}

function findExampleSourceIssue(row){
 if(row.sourceVerification?.requiresExampleSourceCorrection&&!row.exampleSource){
  return 'Unapplied reviewed example source correction';
 }
 if(row.exampleSource){
  if(row.exampleSourceTextDigest!==exampleDigest(row.reviewedFields.exampleText))return 'Stale reviewed example source correction';
  try{
   assertExampleSource(row.exampleSource,row.id);
   translateExampleSource(row.exampleSource,row.exampleTranslationSource);
  }catch(error){return error.message;}
 }
 return null;
}

export function auditEnglishExampleSourceCorrections(reviews){
 const corrections=reviews.filter(row=>active(row)&&(row.exampleSource||row.sourceVerification?.requiresExampleSourceCorrection));
 const errors=corrections.flatMap(row=>{
  const error=findExampleSourceIssue(row);
  return error?[{id:row.id,error}]:[];
 });
 return {expected:corrections.length,resolved:corrections.length-errors.length,errors,complete:!errors.length};
}

/** A successful audit and its exact snapshot travel together, never an older preview. */
export async function loadReviewedEnglishSnapshot(reportPath,recordsPath){
 const [reportText,recordsText]=await Promise.all([readFile(reportPath,'utf8'),readFile(recordsPath,'utf8')]);
 const audit=JSON.parse(reportText);
 if(audit.complete!==true)throw new Error('English review is incomplete; no release may be assembled');
 if(audit.effectiveReviewSha256!==createHash('sha256').update(recordsText).digest('hex')){
  throw new Error('English review snapshot does not match its audit');
 }
 return {audit,reviews:recordsText.split('\n').filter(line=>line.trim()).map(line=>JSON.parse(line))};
}

/** Compose data-only rows. Exercises and family references are checked separately. */
export function assembleReviewedEnglishEntries({audit,reviews,inputs,baselineCore,baselineEnglish,baselineKorean={entries:[]},
 attributionBindings=[],invalidConceptIds=[],version}){
 if(audit.complete!==true||audit.reviewed!==audit.expected)throw new Error('English review is incomplete');
 const byId=new Map(reviews.map(row=>[row.id,row])),inputById=new Map(inputs.map(row=>[row.id,row]));
 if(byId.size!==reviews.length||inputById.size!==inputs.length||inputs.length!==audit.expected||
    inputs.some(row=>!byId.has(row.id)))throw new Error('English review input coverage changed');
 if(!/^\d+\.\d+\.\d+$/u.test(version))throw new Error('An explicit release version is required');
 const baseline=new Map(baselineCore.entries.map(row=>[row.id,row]));
 const previousMeanings=new Map(baselineEnglish.entries.map(row=>[row.id,row]));
 const previousKorean=new Map(baselineKorean.entries.map(row=>[row.id,row]));
 const invalid=new Set(invalidConceptIds),bindings=new Map();
 for(const binding of attributionBindings){
  if(binding.exampleTextDigest!==exampleDigest(binding.exampleText))throw new Error('Stale example attribution: '+binding.id);
  const key=binding.id+'\0'+binding.exampleTextDigest;
  if(bindings.has(key)&&exampleDigest(bindings.get(key))!==exampleDigest(binding))throw new Error('Conflicting example attribution: '+binding.id);
  bindings.set(key,binding);
 }
 function sourceIds(row){
  return unique([row.id,row.sourceId,...(row.sourceIds||[]),...(row.proposal?.sourceIds||[]),
   ...(inputById.get(row.id)?.sourceIds||[]),inputById.get(row.id)?.sourceId]);
 }
 function ancestors(row){
  const ids=new Set(),pending=sourceIds(row);
  while(pending.length){const id=pending.pop();if(ids.has(id))continue;ids.add(id);
   const input=inputById.get(id);if(input)pending.push(...unique([input.sourceId,...(input.sourceIds||[])]));
  }
  return [...ids];
 }
 function proposalCandidates(row){
  return [row.proposal,...(row.proposal?.origins||[]).map(origin=>origin.candidate)].filter(Boolean);
 }
 function exampleSource(row,ids){
  const sentence=row.reviewedFields.exampleText,digest=exampleDigest(sentence);
  const issue=findExampleSourceIssue(row);
  if(issue)throw new Error(issue+': '+row.id);
  if(row.exampleSource)return{source:copy(row.exampleSource),
   translationSource:translateExampleSource(row.exampleSource,row.exampleTranslationSource)};
  for(const candidate of proposalCandidates(row)){
   if(candidate.exampleText!==sentence||!candidate.exampleSource)continue;
   // Earlier conversation journals used this exact authorship declaration.
   // Unknown strings are not silently relabelled as original material.
   const source=candidate.exampleSource==='Original Lingonberry editorial bilingual example.'?
    {...authored,authorshipDeclaration:candidate.exampleSource}:candidate.exampleSource;
   assertExampleSource(source,row.id);
   return {source:copy(source),translationSource:translateExampleSource(source,candidate.exampleTranslationSource)};
  }
  for(const id of ids){const binding=bindings.get(id+'\0'+digest);if(!binding)continue;
   if(binding.sourceExampleType!=='example')throw new Error('Publication quotation is not an approved app example: '+row.id);
   assertExampleSource(binding.source,row.id);
   return {source:copy(binding.source),translationSource:translateExampleSource(binding.source,binding.koreanTranslationProvenance)};
  }
  for(const id of ids){const example=baseline.get(id)?.example;
   if(example?.text===sentence&&(example.source||example.provenance)){
    const source=example.source||example.provenance;
    assertExampleSource(source,row.id);
    return {source:copy(source),translationSource:translateExampleSource(source)};
   }
  }
  return {source:copy(authored),translationSource:copy(authored)};
 }
 const entries=[],englishEntries=[],koreanEntries=[];
 const invalidations=new Map((baselineCore.reviewInvalidations||[]).map(row=>[row.id,copy(row)]));
 const wordKey=value=>value.normalize('NFKC').toLowerCase().replace(/[‘’]/gu,"'");
 function meaningInventory(rows){
  const map=new Map();
  for(const row of rows){const key=wordKey(row.word);if(!map.has(key))map.set(key,[]);map.get(key).push([row.partOfSpeech,row.meaning]);}
  return new Map([...map].map(([key,values])=>[key,JSON.stringify(values.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))))]));
 }
 const oldInventory=meaningInventory(baselineCore.entries.map(row=>({...row,meaning:previousMeanings.get(row.id)?.meaning})));
 const newInventory=meaningInventory(reviews.filter(active).map(row=>({word:row.reviewedFields?.word||'',partOfSpeech:row.reviewedFields?.partOfSpeech,meaning:row.reviewedFields?.meaningEn})));
 const equivalentAliases=new Map(),equivalentListeningAliases=new Map();
 for(const row of reviews)if(row.mergeWith){
  const targetId=resolveEnglishCanonicalId(row.id,byId),target=byId.get(targetId);
  if(!target||!active(target))throw new Error('Inactive semantic replacement: '+row.id);
  if(invalid.has(row.id))continue;
  const original=baseline.get(row.id)||inputById.get(row.id);
  const forms=unique([original?.word,row.reviewedFields?.word,row.proposal?.word,...(original?.aliases||[]),...(row.aliases||[])]);
  equivalentAliases.set(targetId,unique([...(equivalentAliases.get(targetId)||[]),...forms]));
  equivalentListeningAliases.set(targetId,unique([...(equivalentListeningAliases.get(targetId)||[]),...(row.listeningAliases||[])]));
 }
 const retained=new Set();
 for(const row of reviews){
  if(!active(row))continue;
  const f=row.reviewedFields;
  if(!['word','partOfSpeech','meaningEn','meaningKo','exampleText','exampleTranslation'].every(key=>text(f?.[key]))||
     !ENGLISH_LEVELS.includes(row.proposedLevel)||!text(row.levelRationale))throw new Error('Incomplete reviewed sense: '+row.id);
  if(invalid.has(row.id))throw new Error('A retired invalid concept was reactivated: '+row.id);
  if(f.meaningEn.trim().toLowerCase()===f.word.trim().toLowerCase())throw new Error('Circular English self-definition: '+row.id);
  if(!/\p{Script=Hangul}/u.test(f.meaningKo)||!/\p{Script=Hangul}/u.test(f.exampleTranslation))throw new Error('Missing Korean language content: '+row.id);
  const original=baseline.get(row.id),ids=ancestors(row);
  const inherited=ids.flatMap(id=>{
   const sources=[baseline.get(id)?.provenance,previousMeanings.get(id)?.provenance].filter(Boolean);
   return sources;
  });
  const definitionSourceIssue=findDefinitionSourceIssue(row);
  if(definitionSourceIssue)throw new Error(definitionSourceIssue+': '+row.id);
  const declared=row.definitionSource?[row.definitionSource]:
   proposalCandidates(row).flatMap(candidate=>[candidate.definitionSource,candidate.provenance].filter(Boolean));
  const sources=[...new Map([...inherited,...declared].map(source=>[exampleDigest(source),source])).values()].map(copy);
  const provenance=sources.length?{kind:'licensed-adaptation',creator:authored.creator,
   license:adaptationLicense(sources),sources}:copy(authored);
  if(!provenance.license)throw new Error('Missing definition licence: '+row.id);
  const {source,translationSource}=exampleSource(row,ids);
  const focus=row.focus||row.proposal?.focus||(original?.example?.text===f.exampleText?original.example.focus:undefined);
  const example={text:f.exampleText,source,
   ...(focus?{focus:copy(focus)}:{}),...(row.practiceEligible===false||row.proposal?.practiceEligible===false?{practiceEligible:false}:{})};
  const aliases=unique([...(original?.aliases||[]),...(row.aliases||[]),...(equivalentAliases.get(row.id)||[])]).filter(alias=>alias!==f.word);
  const grammar=original?.word===f.word&&original.partOfSpeech===f.partOfSpeech?copy(original.grammar||{}):{};
  grammar.studyTier=['foundation','independent','advanced','precision'][ENGLISH_LEVELS.indexOf(row.proposedLevel)];
  grammar.levelEvidence={basis:'independently-reviewed-per-sense',officialExamVocabulary:false,
   reviewId:ENGLISH_STUDY_POLICY_ID};
  const entry={id:row.id,word:f.word,partOfSpeech:f.partOfSpeech,level:row.proposedLevel,
   tags:copy(original?.tags||['ielts:shared']),grammar,provenance,example,
   ...(aliases.length?{aliases}:{}),listeningAliases:unique([...(row.listeningAliases||[]),...(equivalentListeningAliases.get(row.id)||[])])
    .filter(alias=>alias!==f.word)};
  if(entry.listeningAliases.some(alias=>!aliases.includes(alias)))throw new Error('Unbound listening spelling: '+row.id);
  entries.push(entry);retained.add(row.id);
  englishEntries.push({id:row.id,meaning:f.meaningEn,exampleTranslation:f.exampleText,
   provenance:copy(provenance),exampleTranslationProvenance:copy(source)});
  koreanEntries.push({id:row.id,meaning:f.meaningKo,exampleTranslation:f.exampleTranslation,
   provenance:copy(provenance),exampleTranslationProvenance:translationSource});
  if(original){
   const oldEn=previousMeanings.get(row.id),oldKo=previousKorean.get(row.id);
   const changed=original.word!==f.word||original.partOfSpeech!==f.partOfSpeech||original.level!==row.proposedLevel||
    original.example?.text!==f.exampleText||oldEn?.meaning!==f.meaningEn||
    !!oldKo&&(oldKo.meaning!==f.meaningKo||oldKo.exampleTranslation!==f.exampleTranslation)||
    !!original.additionalExamples?.length||oldInventory.get(wordKey(f.word))!==newInventory.get(wordKey(f.word));
   if(changed)invalidations.set(row.id,{id:row.id,minimumVersion:version});
  }
 }
 const retiredEntries=[];
 for(const original of baselineCore.entries){
  if(retained.has(original.id))continue;
  const review=byId.get(original.id),targetId=resolveEnglishCanonicalId(original.id,byId);
  if(!review)throw new Error('A previous entry was not reviewed: '+original.id);
  const equivalent=!!review.mergeWith&&!invalid.has(original.id)&&retained.has(targetId);
  if(review.mergeWith&&!retained.has(targetId))throw new Error('Inactive semantic replacement: '+original.id);
  retiredEntries.push({id:original.id,reason:review.reason||'Excluded by the independent sense review.',
   ...(equivalent?{replacementId:targetId,sameConcept:true}:{})});
  invalidations.set(original.id,{id:original.id,minimumVersion:version});
 }
 for(const old of baselineCore.retiredEntries||[]){
  if(retained.has(old.id)||retiredEntries.some(row=>row.id===old.id))continue;
  const replacementId=old.replacementId&&resolveEnglishCanonicalId(old.replacementId,byId);
  retiredEntries.push({id:old.id,reason:old.reason,
   ...(replacementId&&retained.has(replacementId)&&!invalid.has(old.id)?{
    replacementId,...(old.sameConcept===true?{sameConcept:true}:{}),
   }:{})});
 }
 const validIds=new Set([...retained,...retiredEntries.map(row=>row.id)]);
 return {entries,englishEntries,koreanEntries,retiredEntries,reviewInvalidations:[...invalidations.values()].filter(row=>validIds.has(row.id))};
}
