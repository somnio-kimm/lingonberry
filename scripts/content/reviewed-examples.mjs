import {createHash} from 'node:crypto';
import {validateExampleRecord,validateCorrection} from './example-records.mjs';
import {compileExamples} from './compile-examples.mjs';

const bindingFields=['id','word','reading','partOfSpeech','level','meaningEn','meaningKo'];
function canonical(value){
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
 if(value===undefined||typeof value==='number'&&!Number.isFinite(value))throw new Error('Cannot hash an incomplete JSON value');
 return value;
}
export const exampleDigest=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
export function exampleSourceBinding(row){
 return Object.fromEntries(bindingFields.map(field=>{
  const value=field==='reading'?row[field]??null:row[field];
  if(value===undefined)throw new Error(`Missing source binding ${field}: ${row.id}`);
  return [field,value];
 }));
}
function unique(rows,name){
 const result=new Map();
 for(const row of rows){if(!row?.id||result.has(row.id))throw new Error(`Duplicate or missing ${name} ID: ${row?.id}`);result.set(row.id,row);}
 return result;
}
function headwordCorrection(record,entry){
 const proposal=record.headwordCorrection;if(!proposal)return null;
 const allowed=new Set(['word','pronunciation','aliases','reason','provenance']);
 if(Object.keys(proposal).some(key=>!allowed.has(key)))throw new Error('Only a headword/reading correction is permitted: '+record.id);
 if(!proposal.word?.trim()||!proposal.pronunciation?.trim())throw new Error('Corrected word and reading are required: '+record.id);
 const correction={...proposal,id:record.id};validateCorrection(correction,entry);
 const evidence=proposal.provenance.evidenceUrls;
 if(proposal.provenance.license!=='CC-BY-SA-4.0'||!proposal.provenance.creator?.trim()||!Array.isArray(evidence)||!evidence.length)throw new Error('Credited headword correction evidence is required: '+record.id);
 for(const link of evidence){const url=new URL(link);if(url.protocol!=='https:'||url.username||url.password)throw new Error('Invalid correction evidence URL: '+record.id);}
 return correction;
}
/** Structural checks verify review evidence, not linguistic correctness itself. */
export function auditReviewedExamples({core,pairs,inputs,ownership,authored,reviews}){
 if(core.targetLanguage!=='ja')throw new Error('This completion gate expects Japanese content');
 const entries=unique(core.entries,'entry'),source=unique(inputs,'input'),records=unique(authored,'example');
 const translations=Object.fromEntries(['en','ko'].map(locale=>{
  const pair=pairs.find(row=>row.explanationLanguage===locale);
  if(!pair||pair.studyVersion!==core.version)throw new Error(`Missing compatible ${locale} explanation`);
  return [locale,unique(pair.entries,locale)];
 }));
 const missing=core.entries.filter(row=>!row.example);
 if(source.size!==missing.length||missing.some(row=>!source.has(row.id)))throw new Error('Input scope must include every currently missing primary example');
 for(const row of inputs){
  const entry=entries.get(row.id);if(!entry||entry.example)throw new Error('Input is not a missing primary example: '+row.id);
  const current={id:entry.id,word:entry.word,reading:entry.pronunciation??null,partOfSpeech:entry.partOfSpeech,level:entry.level,meaningEn:translations.en.get(row.id)?.meaning,meaningKo:translations.ko.get(row.id)?.meaning};
  if(exampleDigest(exampleSourceBinding(row))!==exampleDigest(exampleSourceBinding(current)))throw new Error('Stale source binding: '+row.id);
  if(typeof ownership[row.id]!=='string'||!ownership[row.id].trim())throw new Error('Missing assigned author: '+row.id);
 }
 const hashes=new Map();
 for(const record of authored){
  if(!source.has(record.id))throw new Error('Example outside completion scope: '+record.id);
  validateExampleRecord(record,entries.get(record.id),'ja');
  headwordCorrection(record,entries.get(record.id));
  for(const locale of ['en','ko'])if(typeof record[locale]!=='string'||!record[locale].trim())throw new Error(`Missing ${locale} translation: ${record.id}`);
  if(!record.focus||!Number.isInteger(record.focus.start))throw new Error('Explicit focus offset required: '+record.id);
  if(record.provenance.kind==='app-authored'&&!record.provenance.creator?.trim())throw new Error('Missing original creator: '+record.id);
  hashes.set(record.id,{recordSha256:exampleDigest(record),sourceBindingSha256:exampleDigest(exampleSourceBinding(source.get(record.id)))});
 }
 const latest=new Map();let staleReviews=0;
 for(const review of reviews){
  if(!source.has(review.id))throw new Error('Review outside completion scope: '+review.id);
  if(!['pass','revise','uncertain'].includes(review.verdict)||!Array.isArray(review.notes)||typeof review.reviewer!=='string'||!review.reviewer.trim())throw new Error('Invalid semantic review: '+review.id);
  if(review.reviewer===ownership[review.id])throw new Error('Independent review required: '+review.id);
  const hashesForRecord=hashes.get(review.id);
  if(!hashesForRecord||review.recordSha256!==hashesForRecord.recordSha256||review.sourceBindingSha256!==hashesForRecord.sourceBindingSha256){staleReviews++;continue;}
  const key=JSON.stringify([review.id,review.reviewer]);latest.set(key,review);
 }
 const currentById=new Map();
 for(const review of latest.values()){
  if(!currentById.has(review.id))currentById.set(review.id,[]);
  currentById.get(review.id).push(review);
 }
 const reviewed=[],unreviewed=[],findings=[];
 for(const record of authored){
  const evidence=currentById.get(record.id)||[];
  if(!evidence.length)unreviewed.push(record.id);
  else if(evidence.some(row=>row.verdict!=='pass'))findings.push(record.id);
  else reviewed.push(record.id);
 }
 const missingIds=missing.filter(row=>!records.has(row.id)).map(row=>row.id);
 return {target:missing.length,drafted:records.size,independentlyReviewed:reviewed.length,staleReviews,missingIds,unreviewedIds:unreviewed,findings,fullCoverage:missingIds.length===0&&unreviewed.length===0&&findings.length===0,evidence:currentById};
}

/** Fill missing examples with explicitly reviewed equivalents; never reapply old sense corrections. */
export function compileReviewedExamples({core,pairs,inputs,ownership,authored,reviews,version}){
 const report=auditReviewedExamples({core,pairs,inputs,ownership,authored,reviews});
 if(!report.fullCoverage)throw new Error(`Example completion is not ready: ${report.missingIds.length} missing, ${report.unreviewedIds.length} unreviewed, ${report.findings.length} unresolved`);
 const bindings=new Map(inputs.map(row=>[row.id,exampleDigest(exampleSourceBinding(row))]));
 const sourceRows=new Map(inputs.map(row=>[row.id,row])),originals=new Map(core.entries.map(row=>[row.id,row]));
 const corrections=authored.flatMap(record=>{
  const correction=headwordCorrection(record,originals.get(record.id));
  return correction?[{...correction,meaningEn:sourceRows.get(record.id).meaningEn,meaningKo:sourceRows.get(record.id).meaningKo}]:[];
 });
 const corrected=new Map(corrections.map(row=>[row.id,row]));
 const checked=authored.map(record=>({...record,provenance:{...record.provenance,review:'AI-editorial-checked; native-speaker-review-pending',editorialReview:{status:'checked',nativeSpeakerReview:'pending',recordSha256:exampleDigest(record),sourceBindingSha256:bindings.get(record.id),reviewers:report.evidence.get(record.id).map(row=>row.reviewer).sort()}}}));
 const packages=compileExamples({core,pairs,authored:checked,corrections,version});
 const before=new Map(core.entries.map(row=>[row.id,row]));
 for(const row of packages[0].entries){
  const old=before.get(row.id),{example,exampleStatus,...unchanged}=row,{example:oldExample,exampleStatus:oldStatus,...oldUnchanged}=old;
  const correction=corrected.get(row.id);
  if(correction){
   for(const key of ['word','pronunciation','aliases','referenceExamples','editorialCorrection']){delete unchanged[key];delete oldUnchanged[key];}
   if(row.word!==correction.word||row.pronunciation!==correction.pronunciation||exampleDigest(row.editorialCorrection)!==exampleDigest({reason:correction.reason,provenance:correction.provenance}))throw new Error('Unbound headword correction: '+row.id);
  }
  if(exampleDigest(unchanged)!==exampleDigest(oldUnchanged)||oldExample&&exampleDigest(row)!==exampleDigest(old))throw new Error('Existing entry changed: '+row.id);
 }
 for(const [index,pair]of pairs.entries()){
  const compiled=packages[index+1];
  if(!compiled||compiled.id!==pair.id)throw new Error('Explanation pair order changed');
  const compiledEntries=new Map(compiled.entries.map(row=>[row.id,row]));
  for(const old of pair.entries){
   const row=compiledEntries.get(old.id),{exampleTranslation,exampleTranslationProvenance,...meaning}=row,{exampleTranslation:oldText,exampleTranslationProvenance:oldProvenance,...oldMeaning}=old;
   const correction=corrected.get(old.id);
   if(correction){
    const expected={reason:correction.reason,provenance:correction.provenance};
    if(exampleDigest(row.editorialCorrection)!==exampleDigest(expected))throw new Error('Unbound explanation correction: '+old.id);
    delete meaning.editorialCorrection;delete oldMeaning.editorialCorrection;
   }
   if(exampleDigest(meaning)!==exampleDigest(oldMeaning)||before.get(old.id).example&&exampleDigest(row)!==exampleDigest(old))throw new Error('Existing meaning or translation changed: '+old.id);
  }
 }
 return {packages,report};
}
