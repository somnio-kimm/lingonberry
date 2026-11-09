import {ENGLISH_LEVELS} from '../../web/js/shared/english-levels.js';
import {exampleDigest} from './reviewed-examples.mjs';

const accepted=new Set(['verified','corrected','merge-duplicate']);
const retired=new Set(['retire-unsupported','retire-error']);
const adjudications=new Set([
 'accept-cross-review','accept-cross-review-with-refinement',
 'accept-cross-review-with-correction','accept-cross-review-with-final-corrections',
]);
const nonempty=value=>typeof value==='string'&&value.trim();

/** A source finding closes only against the exact evidence and correction that were reviewed. */
export function auditSourceResolutions({inputs,resolutions,crossReviews,finalDecisions=[]}){
 const originals=new Map(inputs.map(row=>[row.id,row]));
 const errors=[],originalsById=new Map(),finalById=new Map();
 if(originals.size!==inputs.length)throw new Error('Duplicate source flag input');
 const fail=(id,error)=>errors.push({id,error});
 function checkSense(value,id){
  if(!nonempty(value?.headword||value?.word)||!nonempty(value?.partOfSpeech)||
     !nonempty(value?.englishMeaning)||!nonempty(value?.meaning)||!nonempty(value?.exampleText)||
     !nonempty(value?.exampleTranslation)||!ENGLISH_LEVELS.includes(value?.proposedLevel)||
     !nonempty(value?.levelRationale))fail(id,'Incomplete bilingual sense or individual level evidence');
 }
 function checkResolution(row){
  const original=originals.get(row.id);
  if(!original){fail(row.id,'Unknown source flag ID');return;}
  if(row.sourceDigest!==original.sourceDigest||
     (row.englishMeaning||row.originalEnglishMeaning)!==original.englishMeaning)fail(row.id,'Source binding changed');
  if(!accepted.has(row.disposition)&&!retired.has(row.disposition))fail(row.id,'Unresolved disposition');
  if(!nonempty(row.researchReason)||!Array.isArray(row.evidenceUrls)||!row.evidenceUrls.length){
   fail(row.id,'Missing source research reasoning or evidence');
  }else for(const link of row.evidenceUrls){
   try{
    const url=new URL(link);
    if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error('Unsafe URL');
   }catch{fail(row.id,'Invalid evidence URL');}
  }
  const senses=row.acceptedSenses||(row.resolved&&typeof row.resolved==='object'?[row.resolved]:[]);
  if(accepted.has(row.disposition)&&!senses.length)fail(row.id,'Accepted resolution has no resolved sense');
  for(const sense of senses)checkSense(sense,row.id);
  for(const candidate of row.additionalSenseCandidates||[])checkSense(candidate,row.id);
 }
 for(const row of resolutions){
  if(originalsById.has(row.id)){fail(row.id,'Duplicate source resolution');continue;}
  originalsById.set(row.id,row);
  checkResolution(row);
 }
 const crossById=new Map();
 for(const row of crossReviews){
  const original=originalsById.get(row.id);
  if(original&&row.resolutionDigest===exampleDigest(original))crossById.set(row.id,row);
 }
 for(const row of finalDecisions){
  const original=originalsById.get(row.id),cross=crossById.get(row.id);
  if(finalById.has(row.id)){fail(row.id,'Duplicate final adjudication');continue;}
  if(!original||!cross||cross.verdict!=='revise'||
     row.originalResolutionDigest!==exampleDigest(original)||row.crossReviewDigest!==exampleDigest(cross)){
   fail(row.id,'Final adjudication does not bind the current resolution and cross-review');
   continue;
  }
  if(!adjudications.has(row.adjudicationVerdict)||!nonempty(row.reviewer)||row.reviewer===cross.reviewer||
     !nonempty(row.adjudicationReason||row.reason)||row.finalResolution?.id!==row.id){
   fail(row.id,'Incomplete or non-independent final adjudication');
   continue;
  }
  checkResolution(row.finalResolution);
  finalById.set(row.id,row);
 }
 const counts={},missingFlags=[],remainingIndependentChecks=[],finalized=[];
 for(const input of inputs){
  const original=originalsById.get(input.id);
  if(!original){missingFlags.push(input.id);remainingIndependentChecks.push(input.id);continue;}
  const final=finalById.get(input.id),cross=crossById.get(input.id);
  const resolution=final?.finalResolution||original;
  counts[resolution.disposition]=(counts[resolution.disposition]||0)+1;
  if(!final&&cross?.verdict!=='pass')remainingIndependentChecks.push(input.id);
  finalized.push({id:input.id,resolution,crossReview:cross||null,adjudication:final||null});
 }
 const structuralComplete=missingFlags.length===0&&errors.length===0;
 return {
  report:{expected:inputs.length,recorded:resolutions.length,uniqueResolvedFlags:originalsById.size,
   missingFlags,counts,errors,structuralComplete,
   independentlyPassed:inputs.length-remainingIndependentChecks.length,
   finalAdjudications:finalById.size,remainingIndependentChecks,
   complete:structuralComplete&&remainingIndependentChecks.length===0},
  finalized,
 };
}
